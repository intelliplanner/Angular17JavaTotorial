const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DraftImportError, importDrafts, listDrafts } = require('./json-draft-store');

function makeFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'json-draft-store-'));
  const dataDirectory = path.join(root, 'data');
  const outputDirectory = path.join(root, 'generated-json');
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.mkdirSync(outputDirectory, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { dataDirectory, outputDirectory };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function tutorial(id, title = `Draft ${id}`) {
  return {
    id,
    title,
    category: 'Java',
    subCategory: 'Basics',
    description: 'Draft description',
    content: 'Draft content',
    difficulty: 'Beginner',
    tags: ['Java', 'Draft'],
    author: 'Content Draft Generator',
    createdAt: '2026-11-15T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
    published: false
  };
}

function quiz(id, category = 'Java', subCategory = 'Basics') {
  return {
    id,
    category,
    subCategory,
    difficulty: 'Easy',
    question: `Question ${id}`,
    image: '',
    options: ['Correct', 'Wrong one', 'Wrong two', 'Wrong three'],
    correctAnswer: 'Correct',
    explanation: 'A draft explanation.'
  };
}

test('imports only selected tutorials, publishes them, and removes them from drafts', t => {
  const { dataDirectory, outputDirectory } = makeFixture(t);
  writeJson(path.join(dataDirectory, 'tutorials.json'), [tutorial('existing', 'Existing')]);
  writeJson(path.join(outputDirectory, 'tutorials.json'), [tutorial('draft-1'), tutorial('draft-2')]);

  const result = importDrafts('tutorials', ['draft-1'], dataDirectory, outputDirectory);
  const actual = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'tutorials.json'), 'utf8'));
  const drafts = JSON.parse(fs.readFileSync(path.join(outputDirectory, 'tutorials.json'), 'utf8'));

  assert.equal(result.imported, 1);
  assert.equal(result.published, 1);
  assert.equal(actual.length, 2);
  assert.equal(actual[1].published, true);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].id, 'draft-2');
});

test('imports quizzes to mapped category files and adds missing subcategories', t => {
  const { dataDirectory, outputDirectory } = makeFixture(t);
  writeJson(path.join(dataDirectory, 'question-files.json'), { Java: 'java.json' });
  writeJson(path.join(dataDirectory, 'topic_categories.json'), [{ name: 'Java', subCategories: ['Basics'] }]);
  writeJson(path.join(dataDirectory, 'java.json'), []);
  writeJson(path.join(outputDirectory, 'quiz_questions.json'), [quiz(10, 'Java', 'Generics')]);

  const result = importDrafts('quiz', [10], dataDirectory, outputDirectory);
  const actual = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'java.json'), 'utf8'));
  const categories = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'topic_categories.json'), 'utf8'));

  assert.equal(result.destinations['java.json'], 1);
  assert.equal(actual[0].id, 10);
  assert.deepEqual(categories[0].subCategories, ['Basics', 'Generics']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(outputDirectory, 'quiz_questions.json'), 'utf8')).length, 0);
});

test('rejects unmapped quiz categories without changing source or drafts', t => {
  const { dataDirectory, outputDirectory } = makeFixture(t);
  writeJson(path.join(dataDirectory, 'question-files.json'), { Java: 'java.json' });
  writeJson(path.join(dataDirectory, 'topic_categories.json'), [{ name: 'Java', subCategories: ['Basics'] }]);
  writeJson(path.join(dataDirectory, 'java.json'), []);
  writeJson(path.join(outputDirectory, 'quiz_questions.json'), [quiz(10, 'Spring', 'Core')]);

  assert.throws(
    () => importDrafts('quiz', [10], dataDirectory, outputDirectory),
    error => error instanceof DraftImportError && error.status === 422
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDirectory, 'java.json'), 'utf8')), []);
  assert.equal(JSON.parse(fs.readFileSync(path.join(outputDirectory, 'quiz_questions.json'), 'utf8')).length, 1);
  assert.equal(listDrafts('quiz', dataDirectory, outputDirectory)[0].importable, false);
});

test('blocks duplicate questions without modifying the source', t => {
  const { dataDirectory, outputDirectory } = makeFixture(t);
  writeJson(path.join(dataDirectory, 'questions-and-answers.json'), [{
    id: 'existing',
    question: 'What is Java?'
  }]);
  writeJson(path.join(outputDirectory, 'questions_answers.json'), [{
    id: 'new',
    category: 'Java',
    subCategory: 'Basics',
    question: ' What   is Java? ',
    answer: 'A language.',
    difficulty: 'Beginner',
    tags: [],
    createdAt: '2026-11-15T00:00:00.000Z',
    likeCount: 0,
    dislikeCount: 0,
    viewCount: 0
  }]);

  assert.throws(
    () => importDrafts('answers', ['new'], dataDirectory, outputDirectory),
    error => error instanceof DraftImportError && error.status === 409
  );
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDirectory, 'questions-and-answers.json'), 'utf8')).length, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(outputDirectory, 'questions_answers.json'), 'utf8')).length, 1);
});
