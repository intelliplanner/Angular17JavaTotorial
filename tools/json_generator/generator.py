"""Validation and safe draft generation for learning-portal JSON datasets."""

from __future__ import annotations

import json
import re
import tempfile
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


QUIZ_DIFFICULTIES = {"easy", "medium", "hard"}
CONTENT_DIFFICULTIES = {"beginner", "intermediate", "advanced"}
OUTPUT_NAMES = {
    "tutorials": "tutorials.json",
    "answers": "questions_answers.json",
    "quiz": "quiz_questions.json",
}
MAX_RECORDS_PER_FILE = 100_000
SCHEMAS: dict[str, tuple[set[str], set[str]]] = {
    "tutorials": (
        {"id", "title", "category", "subCategory", "description", "content", "difficulty",
         "tags", "author", "createdAt", "updatedAt", "published"},
        CONTENT_DIFFICULTIES,
    ),
    "answers": (
        {"id", "category", "subCategory", "question", "answer", "difficulty", "tags",
         "createdAt", "likeCount", "dislikeCount", "viewCount"},
        CONTENT_DIFFICULTIES,
    ),
    "quiz": (
        {"id", "category", "subCategory", "difficulty", "question", "image", "options",
         "correctAnswer", "explanation"},
        QUIZ_DIFFICULTIES,
    ),
}


@dataclass(frozen=True)
class Issue:
    severity: str
    source: str
    location: str
    message: str

    def __str__(self) -> str:
        return f"[{self.severity}] {self.source} {self.location}: {self.message}"


@dataclass
class ScanResult:
    records: dict[str, list[dict[str, Any]]]
    sources: dict[str, list[str]]
    files: dict[str, dict[str, list[dict[str, Any]]]]
    issues: list[Issue]
    catalog: dict[str, list[str]]


def load_master_catalog(path: Path | None = None) -> dict[str, list[str]]:
    catalog_path = path or Path(__file__).with_name("master_catalog.json")
    try:
        value = json.loads(catalog_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Unable to read master catalog {catalog_path}: {exc}") from exc
    return _validate_catalog(value, str(catalog_path))


def _validate_catalog(value: Any, source: str) -> dict[str, list[str]]:
    if not isinstance(value, dict) or not value:
        raise ValueError(f"{source} must be a non-empty category-to-subcategories object.")
    catalog: dict[str, list[str]] = {}
    for category, subcategories in value.items():
        if not isinstance(category, str) or not category.strip() or not isinstance(subcategories, list):
            raise ValueError(f"{source} has an invalid category entry: {category!r}.")
        if not subcategories or any(not isinstance(item, str) or not item.strip() for item in subcategories):
            raise ValueError(f"{source} category {category!r} must have non-empty subcategories.")
        if len({item.casefold() for item in subcategories}) != len(subcategories):
            raise ValueError(f"{source} category {category!r} has duplicate subcategories.")
        catalog[category.strip()] = [item.strip() for item in subcategories]
    if len({name.casefold() for name in catalog}) != len(catalog):
        raise ValueError(f"{source} has duplicate category names.")
    return catalog


def _merge_local_catalog(base: dict[str, list[str]], path: Path, issues: list[Issue]) -> dict[str, list[str]]:
    result = {name: list(subcategories) for name, subcategories in base.items()}
    config = path / "topic_categories.json"
    if not config.exists():
        return result
    try:
        values = json.loads(config.read_text(encoding="utf-8"))
        if not isinstance(values, list):
            raise ValueError("expected an array of category objects")
        for item in values:
            if not isinstance(item, dict) or not isinstance(item.get("name"), str) or not isinstance(item.get("subCategories"), list):
                raise ValueError("each entry must have a name and a subCategories array")
            name = item["name"].strip()
            subs = item["subCategories"]
            if not name or any(not isinstance(sub, str) or not sub.strip() for sub in subs):
                raise ValueError("category names and subcategories must be non-empty strings")
            existing_name = next((key for key in result if key.casefold() == name.casefold()), name)
            combined = result.setdefault(existing_name, [])
            known = {sub.casefold() for sub in combined}
            for sub in subs:
                if sub.strip().casefold() not in known:
                    combined.append(sub.strip())
                    known.add(sub.strip().casefold())
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        issues.append(Issue("ERROR", config.name, "$", f"Invalid topic catalog: {exc}"))
    return result


def _read_array(path: Path, issues: list[Issue]) -> list[dict[str, Any]] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        issues.append(Issue("ERROR", path.name, "$", f"Could not read JSON: {exc}"))
        return None
    if not isinstance(value, list):
        issues.append(Issue("ERROR", path.name, "$", "Expected a JSON array of records."))
        return None
    return [entry if isinstance(entry, dict) else {"__invalid_record__": entry} for entry in value]


def _quiz_file(path: Path, issues: list[Issue]) -> bool:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return isinstance(value, list) and bool(value) and any(
        isinstance(item, dict) and {"question", "options", "correctAnswer"}.issubset(item)
        for item in value
    )


def scan_directory(directory: Path, catalog: dict[str, list[str]] | None = None) -> ScanResult:
    directory = Path(directory)
    if not directory.is_dir():
        raise NotADirectoryError(f"Input folder does not exist: {directory}")
    issues: list[Issue] = []
    master = catalog or load_master_catalog()
    merged_catalog = _merge_local_catalog(master, directory, issues)
    records: dict[str, list[dict[str, Any]]] = {kind: [] for kind in SCHEMAS}
    sources: dict[str, list[str]] = {kind: [] for kind in SCHEMAS}
    files: dict[str, dict[str, list[dict[str, Any]]]] = {kind: {} for kind in SCHEMAS}
    seen: set[Path] = set()

    def add(kind: str, filename: str) -> None:
        path = directory / filename
        if path in seen or not path.is_file():
            return
        seen.add(path)
        values = _read_array(path, issues)
        if values is not None:
            records[kind].extend(values)
            sources[kind].append(filename)
            files[kind][filename] = values

    add("tutorials", "tutorials.json")
    add("answers", "questions_answers.json")
    add("answers", "questions-and-answers.json")
    add("quiz", "quiz_questions.json")
    add("quiz", "quiz-questions.json")

    manifest_path = directory / "question-files.json"
    if manifest_path.is_file():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            if not isinstance(manifest, dict):
                raise ValueError("expected a category-to-filename object")
            for filename in manifest.values():
                if not isinstance(filename, str) or Path(filename).name != filename or not filename.lower().endswith(".json"):
                    raise ValueError(f"unsafe or invalid quiz filename: {filename!r}")
                add("quiz", filename)
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            issues.append(Issue("ERROR", manifest_path.name, "$", f"Invalid quiz manifest: {exc}"))

    for path in sorted(directory.glob("*.json")):
        if path not in seen and path.name not in {"topic_categories.json", "question-files.json"} and _quiz_file(path, issues):
            add("quiz", path.name)

    return ScanResult(records, sources, files, issues, merged_catalog)


def _topic_key(record: dict[str, Any]) -> tuple[str, str] | None:
    category, subcategory = record.get("category"), record.get("subCategory")
    if isinstance(category, str) and isinstance(subcategory, str):
        return category.strip().casefold(), subcategory.strip().casefold()
    return None


def _id_key(value: Any) -> tuple[str, Any] | None:
    if isinstance(value, bool) or not isinstance(value, (str, int)):
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return type(value).__name__, value.casefold() if isinstance(value, str) else value


def validate_records(
    kind: str,
    records: list[dict[str, Any]],
    catalog: dict[str, list[str]],
    source: str,
    *,
    check_duplicate_ids: bool = True,
) -> list[Issue]:
    if kind not in SCHEMAS:
        raise ValueError(f"Unsupported dataset type: {kind}")
    required, difficulties = SCHEMAS[kind]
    issues: list[Issue] = []
    identifiers: dict[tuple[str, Any], int] = {}
    questions: dict[str, int] = {}
    categories = {name.casefold(): subs for name, subs in catalog.items()}

    for index, record in enumerate(records):
        location = f"$[{index}]"
        if "__invalid_record__" in record:
            issues.append(Issue("ERROR", source, location, "Each array entry must be a JSON object."))
            continue
        missing_fields = sorted(required - record.keys())
        if missing_fields:
            issues.append(Issue("ERROR", source, location, f"Missing mandatory fields: {', '.join(missing_fields)}."))
        identifier = _id_key(record.get("id"))
        if identifier is None:
            issues.append(Issue("ERROR", source, location, "id must be a non-empty string or integer."))
        elif check_duplicate_ids and identifier in identifiers:
            issues.append(Issue("ERROR", source, location, f"Duplicate id; first used at $[{identifiers[identifier]}]."))
        elif check_duplicate_ids:
            identifiers[identifier] = index
        if kind == "quiz" and (isinstance(record.get("id"), bool) or not isinstance(record.get("id"), int)):
            issues.append(Issue("ERROR", source, location, "Quiz id must be an integer."))

        question_field = "title" if kind == "tutorials" else "question"
        question = record.get(question_field)
        if not isinstance(question, str) or not question.strip():
            issues.append(Issue("ERROR", source, location, "Question/title text must not be empty."))
        else:
            normalized = " ".join(question.split()).casefold()
            if normalized in questions:
                issues.append(Issue("ERROR", source, location, f"Duplicate question; first used at $[{questions[normalized]}]."))
            else:
                questions[normalized] = index

        category, subcategory = record.get("category"), record.get("subCategory")
        if not isinstance(category, str) or not category.strip():
            issues.append(Issue("ERROR", source, location, "category must be a non-empty string."))
        else:
            known_category = categories.get(category.casefold())
            if known_category is None:
                issues.append(Issue("ERROR", source, location, f"Unknown category: {category!r}."))
            elif not isinstance(subcategory, str) or not subcategory.strip():
                issues.append(Issue("ERROR", source, location, "subCategory must be a non-empty string."))
            elif subcategory.casefold() not in {item.casefold() for item in known_category}:
                issues.append(Issue("ERROR", source, location, f"Unknown subcategory {subcategory!r} for {category!r}."))

        difficulty = record.get("difficulty")
        if not isinstance(difficulty, str) or difficulty.casefold() not in difficulties:
            expected = ", ".join(sorted(item.title() for item in difficulties))
            issues.append(Issue("ERROR", source, location, f"Invalid difficulty; expected one of: {expected}."))

        if kind == "tutorials":
            for field in ("title", "description", "content", "author", "createdAt", "updatedAt"):
                if field in record and (not isinstance(record[field], str) or not record[field].strip()):
                    issues.append(Issue("ERROR", source, location, f"{field} must be a non-empty string."))
            if "published" in record and not isinstance(record["published"], bool):
                issues.append(Issue("ERROR", source, location, "published must be a boolean."))
            if "tags" in record and (
                not isinstance(record["tags"], list)
                or any(not isinstance(tag, str) or not tag.strip() for tag in record["tags"])
            ):
                issues.append(Issue("ERROR", source, location, "tags must be an array of non-empty strings."))
        elif kind == "answers":
            if "answer" not in record or not isinstance(record.get("answer"), str) or not record["answer"].strip():
                issues.append(Issue("ERROR", source, location, "Missing answer."))
            if "tags" in record and (
                not isinstance(record["tags"], list)
                or any(not isinstance(tag, str) or not tag.strip() for tag in record["tags"])
            ):
                issues.append(Issue("ERROR", source, location, "tags must be an array of non-empty strings."))
            for field in ("createdAt",):
                if field in record and (not isinstance(record[field], str) or not record[field].strip()):
                    issues.append(Issue("ERROR", source, location, f"{field} must be a non-empty string."))
            for field in ("likeCount", "dislikeCount", "viewCount"):
                if field in record and (
                    isinstance(record[field], bool) or not isinstance(record[field], int) or record[field] < 0
                ):
                    issues.append(Issue("ERROR", source, location, f"{field} must be a non-negative integer."))
        else:
            if "options" not in record or not isinstance(record.get("options"), list) or len(record["options"]) != 4:
                issues.append(Issue("ERROR", source, location, "Quiz must have exactly four options."))
            elif any(not isinstance(option, str) or not option.strip() for option in record["options"]):
                issues.append(Issue("ERROR", source, location, "Quiz options must be non-empty strings."))
            elif len({option.casefold() for option in record["options"]}) != len(record["options"]):
                issues.append(Issue("ERROR", source, location, "Quiz options must be unique."))
            options = record.get("options")
            if (
                not isinstance(record.get("correctAnswer"), str)
                or not isinstance(options, list)
                or record["correctAnswer"] not in options
            ):
                issues.append(Issue("ERROR", source, location, "correctAnswer must match one of the quiz options."))
            if "explanation" in record and (not isinstance(record["explanation"], str) or not record["explanation"].strip()):
                issues.append(Issue("ERROR", source, location, "explanation must be a non-empty string."))
            for field in ("image",):
                if field in record and not isinstance(record[field], str):
                    issues.append(Issue("ERROR", source, location, f"{field} must be a string."))
    return issues


def _validate_file_ids(files: dict[str, list[dict[str, Any]]], kind: str) -> list[Issue]:
    issues: list[Issue] = []
    for source, records in files.items():
        seen: dict[tuple[str, Any], int] = {}
        for index, record in enumerate(records):
            identifier = _id_key(record.get("id"))
            if identifier is None:
                continue
            if identifier in seen:
                issues.append(Issue("ERROR", source, f"$[{index}]", f"Duplicate id; first used at $[{seen[identifier]}]."))
            else:
                seen[identifier] = index
    return issues


def _catalog_topics(catalog: dict[str, list[str]]) -> list[tuple[str, str]]:
    return [(category, subcategory) for category, values in catalog.items() for subcategory in values]


def missing_topics(records: list[dict[str, Any]], catalog: dict[str, list[str]]) -> list[tuple[str, str]]:
    available = {_topic_key(record) for record in records}
    return [
        topic for topic in _catalog_topics(catalog)
        if (topic[0].casefold(), topic[1].casefold()) not in available
    ]


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-") or "topic"


def _next_identifier(
    kind: str,
    known_ids: set[tuple[str, Any]],
    category: str,
    subcategory: str,
    next_quiz_id: list[int],
    suffixes: dict[str, int],
) -> str | int:
    if kind == "quiz":
        while _id_key(next_quiz_id[0]) in known_ids:
            next_quiz_id[0] += 1
        candidate: str | int = next_quiz_id[0]
        next_quiz_id[0] += 1
        known_ids.add(_id_key(candidate))
        return candidate
    prefix = f"{_slug(category)}-{_slug(subcategory)}"
    candidate, suffix = prefix, suffixes.get(prefix, 2)
    if _id_key(candidate) in known_ids:
        candidate = f"{prefix}-{suffix}"
        while _id_key(candidate) in known_ids:
            suffix += 1
            candidate = f"{prefix}-{suffix}"
        suffixes[prefix] = suffix + 1
    else:
        suffixes[prefix] = 2
    known_ids.add(_id_key(candidate))
    return candidate


def _draft(
    kind: str,
    category: str,
    subcategory: str,
    identifier: str | int,
    timestamp: str,
    draft_number: int,
) -> dict[str, Any]:
    topic = f"{subcategory} in {category}"
    draft_label = f"(Draft {draft_number:04d})"
    if kind == "tutorials":
        return {
            "id": identifier,
            "title": f"REVIEW REQUIRED: {topic} {draft_label}",
            "category": category,
            "subCategory": subcategory,
            "description": f"Draft lesson outline for {topic}; verify technical details before publishing.",
            "content": (
                f"## Learning objectives\n\n"
                f"- Define the central concepts in {topic}.\n"
                f"- Explain when and why they are used.\n"
                f"- Compare common approaches and their trade-offs.\n\n"
                f"## Author review required\n\n"
                f"Replace this outline with version-appropriate examples, verified explanations, "
                f"and practical exercises for {topic} before publication."
            ),
            "difficulty": "Beginner",
            "tags": [category, subcategory, "Draft"],
            "author": "Content Draft Generator",
            "createdAt": timestamp,
            "updatedAt": timestamp,
            "published": False,
        }
    if kind == "answers":
        return {
            "id": identifier,
            "category": category,
            "subCategory": subcategory,
            "question": f"REVIEW REQUIRED: What should an engineer understand about {topic}? {draft_label}",
            "answer": (
                f"Draft answer for {topic}. Add a precise definition, a practical example, "
                "relevant trade-offs, and version-specific details; verify the explanation before publishing."
            ),
            "difficulty": "Beginner",
            "tags": [category, subcategory, "Draft"],
            "createdAt": timestamp,
            "likeCount": 0,
            "dislikeCount": 0,
            "viewCount": 0,
        }
    correct = f"A verified explanation of {topic} and its intended use."
    return {
        "id": identifier,
        "category": category,
        "subCategory": subcategory,
        "difficulty": "Easy",
        "question": f"REVIEW REQUIRED: Which statement best explains {topic}? {draft_label}",
        "image": "",
        "options": [
            correct,
            "It is unrelated to the selected technical topic.",
            "It removes the need to validate design choices.",
            "It always has the same behavior in every version and context.",
        ],
        "correctAnswer": correct,
        "explanation": f"Draft quiz item for {topic}; replace the options and explanation with verified content.",
    }


def _write_json(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", newline="\n", dir=path.parent, suffix=".tmp", delete=False
        ) as handle:
            temporary_path = Path(handle.name)
            json.dump(records, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        temporary_path.replace(path)
    except OSError:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        raise


def generate_missing(
    input_directory: Path,
    output_directory: Path,
    catalog: dict[str, list[str]] | None = None,
    *,
    minimum_counts: dict[str, int] | None = None,
    selected_kinds: set[str] | None = None,
) -> dict[str, int]:
    source_dir = Path(input_directory).resolve()
    target_dir = Path(output_directory).resolve()
    if source_dir == target_dir:
        raise ValueError("Choose a separate output folder to protect your source JSON files.")

    selected = set(SCHEMAS) if selected_kinds is None else set(selected_kinds)
    unknown_kinds = selected - SCHEMAS.keys()
    if unknown_kinds:
        raise ValueError(f"Unknown dataset type(s): {', '.join(sorted(unknown_kinds))}.")
    requested_counts = minimum_counts or {}
    for kind, count in requested_counts.items():
        if kind not in SCHEMAS:
            raise ValueError(f"Unknown dataset type in minimum counts: {kind}.")
        if isinstance(count, bool) or not isinstance(count, int) or not 0 <= count <= MAX_RECORDS_PER_FILE:
            raise ValueError(f"Minimum record counts must be integers between 0 and {MAX_RECORDS_PER_FILE}.")

    source_scan = scan_directory(source_dir, catalog)
    target_scan = scan_directory(target_dir, source_scan.catalog) if target_dir.is_dir() else ScanResult(
        {kind: [] for kind in SCHEMAS}, {kind: [] for kind in SCHEMAS},
        {kind: {} for kind in SCHEMAS}, [], source_scan.catalog
    )
    issues = source_scan.issues + target_scan.issues
    for kind in SCHEMAS:
        source_name = ", ".join(source_scan.sources[kind]) or OUTPUT_NAMES[kind]
        issues.extend(validate_records(
            kind, source_scan.records[kind], source_scan.catalog, source_name, check_duplicate_ids=False
        ))
        issues.extend(_validate_file_ids(source_scan.files[kind], kind))
        target_name = OUTPUT_NAMES[kind]
        output_records = target_scan.records[kind]
        issues.extend(validate_records(kind, output_records, source_scan.catalog, target_name))
    errors = [issue for issue in issues if issue.severity == "ERROR"]
    if errors:
        raise GenerationBlocked(errors)

    generated_counts: dict[str, int] = {kind: 0 for kind in SCHEMAS}
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    for kind, filename in OUTPUT_NAMES.items():
        if kind not in selected:
            continue
        existing_records = [*source_scan.records[kind], *target_scan.records[kind]]
        output_records = list(target_scan.records[kind])
        absent = missing_topics(existing_records, source_scan.catalog)
        minimum_count = requested_counts.get(kind, 0)
        amount_to_generate = max(len(absent), minimum_count - len(output_records), 0)
        topics = list(absent)
        all_topics = _catalog_topics(source_scan.catalog)
        while len(topics) < amount_to_generate:
            topics.append(all_topics[len(topics) % len(all_topics)])

        new_records: list[dict[str, Any]] = []
        known_ids = {key for record in existing_records if (key := _id_key(record.get("id"))) is not None}
        next_quiz_id = [max(
            (record["id"] for record in existing_records
             if isinstance(record.get("id"), int) and not isinstance(record.get("id"), bool)),
            default=0,
        ) + 1]
        suffixes: dict[str, int] = {}
        for index, (category, subcategory) in enumerate(topics):
            record = _draft(
                kind,
                category,
                subcategory,
                _next_identifier(kind, known_ids, category, subcategory, next_quiz_id, suffixes),
                timestamp,
                len(existing_records) + index + 1,
            )
            new_records.append(record)
        if new_records:
            _write_json(target_dir / filename, [*output_records, *new_records])
        generated_counts[kind] = len(new_records)
    return generated_counts


class GenerationBlocked(ValueError):
    def __init__(self, issues: list[Issue]):
        self.issues = issues
        super().__init__(f"Generation stopped: {len(issues)} validation error(s) must be fixed first.")


def validation_report(scan: ScanResult) -> list[Issue]:
    issues = list(scan.issues)
    for kind, files in scan.sources.items():
        source = ", ".join(files) or OUTPUT_NAMES[kind]
        issues.extend(validate_records(
            kind, scan.records[kind], scan.catalog, source, check_duplicate_ids=False
        ))
        issues.extend(_validate_file_ids(scan.files[kind], kind))
    return issues


def coverage_report(scan: ScanResult) -> list[str]:
    lines: list[str] = []
    for kind in SCHEMAS:
        observed = {_topic_key(record) for record in scan.records[kind]}
        covered = sum(
            (category.casefold(), subcategory.casefold()) in observed
            for category, subcategory in _catalog_topics(scan.catalog)
        )
        total = len(_catalog_topics(scan.catalog))
        missing = total - covered
        lines.append(f"{kind}: {covered}/{total} catalog topics covered; {missing} missing")
        categories = defaultdict(set)
        for record in scan.records[kind]:
            topic = _topic_key(record)
            if topic:
                categories[topic[0]].add(topic[1])
        if categories:
            lines.append(f"  Observed categories: {len(categories)}")
            for category, subcategories in sorted(categories.items()):
                lines.append(f"  {category}: {len(subcategories)} subcategories")
    return lines
