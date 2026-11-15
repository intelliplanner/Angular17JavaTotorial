import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from tools.json_generator.generator import (
    GenerationBlocked,
    generate_missing,
    missing_topics,
    scan_directory,
    validate_records,
)


class GeneratorTests(unittest.TestCase):
    def setUp(self):
        self.catalog = {"Python": ["Basics", "Testing"]}
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def write_json(self, path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding="utf-8")

    def quiz_record(self, **overrides):
        record = {
            "id": 1,
            "category": "Python",
            "subCategory": "Basics",
            "difficulty": "Easy",
            "question": "What is Python?",
            "image": "",
            "options": ["A language", "An OS", "A database", "A protocol"],
            "correctAnswer": "A language",
            "explanation": "It is a programming language.",
        }
        record.update(overrides)
        return record

    def test_validation_reports_duplicate_id_question_and_missing_quiz_options(self):
        records = [
            self.quiz_record(),
            self.quiz_record(subCategory="Testing", question="  what   is python? ", options=[]),
        ]
        issues = validate_records("quiz", records, self.catalog, "quiz.json")
        messages = [issue.message for issue in issues]
        self.assertTrue(any("Duplicate id" in message for message in messages))
        self.assertTrue(any("Duplicate question" in message for message in messages))
        self.assertTrue(any("exactly four options" in message for message in messages))

    def test_interview_answer_must_be_present_and_non_empty(self):
        record = {
            "id": "python-basics",
            "category": "Python",
            "subCategory": "Basics",
            "question": "What is Python?",
            "answer": "  ",
            "difficulty": "Beginner",
            "tags": ["Python"],
            "createdAt": "2026-01-01T00:00:00Z",
            "likeCount": 0,
            "dislikeCount": 0,
            "viewCount": 0,
        }
        issues = validate_records("answers", [record], self.catalog, "answers.json")
        self.assertTrue(any(issue.message == "Missing answer." for issue in issues))

    def test_invalid_quiz_options_type_is_reported_without_crashing(self):
        issues = validate_records(
            "quiz", [self.quiz_record(options=5)], self.catalog, "quiz.json"
        )
        self.assertTrue(any("exactly four options" in issue.message for issue in issues))

    def test_scan_detects_manifest_quiz_files_and_local_categories(self):
        self.write_json(self.root / "topic_categories.json", [
            {"name": "Python", "subCategories": ["Basics", "Testing"]},
            {"name": "Java", "subCategories": ["Collections"]},
        ])
        self.write_json(self.root / "question-files.json", {"Python": "python.json"})
        self.write_json(self.root / "python.json", [self.quiz_record()])
        scan = scan_directory(self.root, self.catalog)
        self.assertEqual(len(scan.records["quiz"]), 1)
        self.assertIn("Java", scan.catalog)
        self.assertFalse(scan.issues)

    def test_generation_writes_separate_valid_draft_datasets(self):
        self.write_json(self.root / "tutorials.json", [])
        self.write_json(self.root / "questions-and-answers.json", [])
        self.write_json(self.root / "quiz_questions.json", [])
        output = self.root / "generated-json"
        counts = generate_missing(self.root, output, self.catalog)
        self.assertEqual(counts, {"tutorials": 2, "answers": 2, "quiz": 2})

        generated = scan_directory(output, self.catalog)
        for kind, records in generated.records.items():
            self.assertEqual(len(records), 2)
            self.assertFalse(validate_records(kind, records, self.catalog, kind))
        self.assertTrue(all(not record["published"] for record in generated.records["tutorials"]))
        self.assertEqual((self.root / "tutorials.json").read_text(encoding="utf-8"), "[]")
        self.assertEqual((self.root / "questions-and-answers.json").read_text(encoding="utf-8"), "[]")
        self.assertEqual(missing_topics(generated.records["quiz"], self.catalog), [])

    def test_generation_is_idempotent_when_rerun(self):
        source = self.root / "source"
        output = self.root / "generated"
        self.write_json(source / "tutorials.json", [])
        self.write_json(source / "questions_answers.json", [])
        self.write_json(source / "quiz_questions.json", [])
        first = generate_missing(source, output, self.catalog)
        second = generate_missing(source, output, self.catalog)
        self.assertEqual(first, {"tutorials": 2, "answers": 2, "quiz": 2})
        self.assertEqual(second, {"tutorials": 0, "answers": 0, "quiz": 0})

    def test_generation_meets_1000_record_minimum_for_each_selected_dataset(self):
        source = self.root / "source"
        output = self.root / "generated"
        self.write_json(source / "tutorials.json", [])
        self.write_json(source / "questions_answers.json", [])
        self.write_json(source / "quiz_questions.json", [])
        minimum_counts = {"tutorials": 1000, "answers": 1000, "quiz": 1000}

        counts = generate_missing(
            source,
            output,
            self.catalog,
            minimum_counts=minimum_counts,
            selected_kinds=set(minimum_counts),
        )
        self.assertEqual(counts, minimum_counts)

        generated = scan_directory(output, self.catalog)
        for kind, records in generated.records.items():
            self.assertEqual(len(records), 1000)
            self.assertFalse(validate_records(kind, records, self.catalog, kind))
            self.assertEqual(len({record["id"] for record in records}), 1000)
            text_field = "title" if kind == "tutorials" else "question"
            self.assertEqual(len({record[text_field] for record in records}), 1000)

    def test_generation_can_select_only_one_dataset(self):
        source = self.root / "source"
        output = self.root / "generated"
        self.write_json(source / "tutorials.json", [])
        self.write_json(source / "questions_answers.json", [])
        self.write_json(source / "quiz_questions.json", [])

        counts = generate_missing(
            source,
            output,
            self.catalog,
            selected_kinds={"quiz"},
        )
        self.assertEqual(counts, {"tutorials": 0, "answers": 0, "quiz": 2})
        self.assertTrue((output / "quiz_questions.json").is_file())
        self.assertFalse((output / "tutorials.json").exists())
        self.assertFalse((output / "questions_answers.json").exists())

    def test_cli_generates_selected_dataset_and_returns_totals(self):
        source = self.root / "source"
        output = self.root / "generated"
        self.write_json(source / "tutorials.json", [])
        self.write_json(source / "questions_answers.json", [])
        self.write_json(source / "quiz_questions.json", [])
        repository_root = Path(__file__).resolve().parents[2]
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "tools.json_generator.cli",
                "--input-dir",
                str(source),
                "--output-dir",
                str(output),
                "--dataset",
                "quiz",
                "--minimum",
                "quiz=1000",
            ],
            cwd=repository_root,
            capture_output=True,
            check=True,
            text=True,
        )
        response = json.loads(result.stdout)
        self.assertEqual(response["generated"]["quiz"], 1000)
        self.assertEqual(response["totals"]["quiz"], 1000)
        self.assertEqual(response["totals"]["tutorials"], 0)

    def test_generation_blocks_invalid_existing_records(self):
        self.write_json(self.root / "quiz_questions.json", [self.quiz_record(options=[])])
        with self.assertRaises(GenerationBlocked):
            generate_missing(self.root, self.root / "output", self.catalog)

    def test_generation_rejects_source_as_output(self):
        with self.assertRaisesRegex(ValueError, "separate output folder"):
            generate_missing(self.root, self.root, self.catalog)


if __name__ == "__main__":
    unittest.main()
