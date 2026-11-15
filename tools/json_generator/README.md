# Learning Portal JSON Generator

A Windows desktop application built with Python's standard-library Tkinter. It validates existing tutorial, interview Q&A, and quiz JSON; reports category/subcategory coverage against `master_catalog.json`; and creates missing entries as unpublished review drafts.

## Run

1. Install Python 3.10 or later with Tcl/Tk enabled.
2. Double-click `launch.bat`, or run `py -3 -m tools.json_generator.app` from the repository root.
3. Choose the existing data folder (for this project, `src\assets\data`). The default output is a separate `generated-json` folder alongside the source files.
4. Select **Analyze & Validate** to inspect coverage and validation issues.
5. In **Generation settings**, select the datasets and their minimum output counts. All three are enabled by default with a minimum of 1,000 records each.
6. Resolve validation errors, then select **Generate Selected Datasets**.

No third-party packages, network access, or API keys are required. The source and output folders must be different.

The same generator can be invoked by the Node.js administrator endpoint from **Settings → Generate JSON data**. That flow uses the repository data folder as input and `data/generated-json` as output; it requires Python 3.10+ on the server (`py -3` on Windows or `python3` on other systems). The browser cannot supply executable commands or filesystem paths.

## Data formats and validation

- Tutorials: `tutorials.json`
- Interview answers: `questions_answers.json` or the repository's existing `questions-and-answers.json`
- Quiz questions: `quiz_questions.json`, `quiz-questions.json`, or category files listed in `question-files.json`
- Category definitions: the built-in `master_catalog.json`, extended with `topic_categories.json` when present

Validation checks JSON arrays and record objects, mandatory fields, IDs and duplicate questions, category/subcategory membership, content and quiz difficulty levels, non-empty answers, and quiz options/correct answers. The report identifies the source file and record location and can be exported from the desktop app.

The generator writes `tutorials.json`, `questions_answers.json`, and `quiz_questions.json` in the output folder. These files contain only generated records (and records previously generated into that output folder); the input files are never copied over or modified. Selected files are filled to at least their configured minimum and every missing catalog topic is included. Generated items are schema-valid starter drafts, not vetted technical content; repeated practice prompts have unique IDs and labels but still require an author to add accurate, topic-specific material. Tutorials default to `published: false`. Review and replace draft content before importing or publishing it.

In the web administrator Settings page, a separate review flow can import up to 100 explicitly selected records at a time. It removes imported records from the generated output, blocks duplicate IDs and prompts, publishes imported tutorials immediately, and routes quizzes only to existing category files. Quiz subcategories missing from an existing category are added to its category configuration. Quiz drafts whose categories have no mapped file remain in the review list. A static frontend deployment must be rebuilt and redeployed for imported quiz questions to appear to learners.

The minimum is configurable from 1,000 to 100,000 records per file. Generation stops if source or existing output records have validation errors. It preserves prior output records and writes files atomically.

## Tests

From the repository root:

```powershell
py -3 -m unittest tools.json_generator.test_generator
```
