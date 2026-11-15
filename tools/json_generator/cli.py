"""Command-line entry point for running the JSON generator from the API server."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from .generator import (
    MAX_RECORDS_PER_FILE,
    OUTPUT_NAMES,
    SCHEMAS,
    GenerationBlocked,
    generate_missing,
)

MIN_RECORDS_PER_FILE = 1000


def _minimum_argument(value: str) -> tuple[str, int]:
    try:
        kind, raw_count = value.split("=", 1)
        count = int(raw_count)
    except (ValueError, TypeError) as exc:
        raise argparse.ArgumentTypeError("Use dataset=count, for example tutorials=1000.") from exc
    if kind not in SCHEMAS:
        raise argparse.ArgumentTypeError(f"Unknown dataset: {kind}.")
    if not MIN_RECORDS_PER_FILE <= count <= MAX_RECORDS_PER_FILE:
        raise argparse.ArgumentTypeError(
            f"Record count must be between {MIN_RECORDS_PER_FILE} and {MAX_RECORDS_PER_FILE}."
        )
    return kind, count


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--dataset", choices=tuple(SCHEMAS), action="append")
    parser.add_argument("--minimum", type=_minimum_argument, action="append", default=[])
    return parser


def _output_totals(output_directory: Path) -> dict[str, int]:
    totals: dict[str, int] = {}
    for kind, filename in OUTPUT_NAMES.items():
        path = output_directory / filename
        if not path.is_file():
            totals[kind] = 0
            continue
        value: Any = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(value, list):
            raise ValueError(f"{filename} must contain a JSON array.")
        totals[kind] = len(value)
    return totals


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    datasets = list(dict.fromkeys(args.dataset or SCHEMAS))
    minimum_counts = dict(args.minimum)
    if len(minimum_counts) != len(args.minimum):
        _parser().error("Specify each dataset minimum only once.")
    if not minimum_counts:
        minimum_counts = {kind: MIN_RECORDS_PER_FILE for kind in datasets}

    try:
        generated = generate_missing(
            args.input_dir,
            args.output_dir,
            minimum_counts=minimum_counts,
            selected_kinds=set(datasets),
        )
        result = {"generated": generated, "totals": _output_totals(args.output_dir)}
        sys.stdout.write(json.dumps(result) + "\n")
        return 0
    except GenerationBlocked as exc:
        issues = [str(issue) for issue in exc.issues]
        payload = {
            "message": str(exc),
            "issues": issues[:50],
            "truncated": max(0, len(issues) - 50),
        }
        sys.stderr.write(json.dumps(payload) + "\n")
        return 2
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        sys.stderr.write(json.dumps({"message": str(exc)}) + "\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
