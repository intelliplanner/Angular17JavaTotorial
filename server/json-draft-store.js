const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATASETS = {
  tutorials: { output: 'tutorials.json', source: 'tutorials.json' },
  answers: { output: 'questions_answers.json', source: 'questions-and-answers.json' },
  quiz: { output: 'quiz_questions.json' }
};
const MAX_IMPORT_RECORDS = 100;
const CONTENT_DIFFICULTIES = new Set(['Beginner', 'Intermediate', 'Advanced']);
const QUIZ_DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);

class DraftImportError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readArray(filePath, label, { optional = false } = {}) {
  if (optional && !fs.existsSync(filePath)) return [];
  let value;
  try {
    value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new DraftImportError(500, `Could not read ${label}: ${error.message}`);
  }
  if (!Array.isArray(value) || value.some(record => !record || typeof record !== 'object' || Array.isArray(record))) {
    throw new DraftImportError(500, `${label} must contain a JSON array of records.`);
  }
  return value;
}

function readObject(filePath, label) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new DraftImportError(500, `Could not read ${label}: ${error.message}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DraftImportError(500, `${label} must contain a JSON object.`);
  }
  return value;
}

function readManifest(dataDirectory) {
  const manifest = readObject(path.join(dataDirectory, 'question-files.json'), 'question-files.json');
  const mappedFiles = new Set();
  for (const [category, filename] of Object.entries(manifest)) {
    if (!category.trim() || typeof filename !== 'string' || !/^[a-z0-9-]+\.json$/i.test(filename) ||
        mappedFiles.has(filename.toLowerCase())) {
      throw new DraftImportError(500, `Invalid quiz file mapping for category "${category}".`);
    }
    mappedFiles.add(filename.toLowerCase());
  }
  return manifest;
}

function readCategories(dataDirectory) {
  const categoriesPath = path.join(dataDirectory, 'topic_categories.json');
  let categories;
  try {
    categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
  } catch (error) {
    throw new DraftImportError(500, `Could not read topic_categories.json: ${error.message}`);
  }
  const categoryNames = new Set();
  if (!Array.isArray(categories) || categories.some(category => {
    if (!category || typeof category.name !== 'string' || !category.name.trim() ||
        !Array.isArray(category.subCategories) || category.subCategories.length > 100 ||
        category.subCategories.some(subcategory => typeof subcategory !== 'string' || !subcategory.trim())) {
      return true;
    }
    const name = category.name.toLowerCase();
    const subcategories = category.subCategories.map(subcategory => subcategory.toLowerCase());
    if (categoryNames.has(name) || new Set(subcategories).size !== subcategories.length) return true;
    categoryNames.add(name);
    return false;
  })) {
    throw new DraftImportError(500, 'topic_categories.json must contain categories with subcategory lists.');
  }
  return { categoriesPath, categories };
}

function idKey(value) {
  if (typeof value === 'string' && value.trim()) return `string:${value}`;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return `number:${value}`;
  return null;
}

function questionKey(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';
}

function requireText(record, field, maximum = Infinity) {
  const value = record[field];
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new DraftImportError(422, `${field} is missing or invalid on record ${String(record.id)}.`);
  }
}

function validateRecord(kind, record) {
  if (!idKey(record.id) || (kind === 'quiz' && (!Number.isSafeInteger(record.id) || record.id < 1))) {
    throw new DraftImportError(422, `Record has an invalid ID: ${String(record.id)}.`);
  }
  if (kind === 'tutorials') {
    for (const [field, maximum] of Object.entries({
      title: 180, category: 80, subCategory: 100, description: 400, content: 50000,
      author: 100, createdAt: 100, updatedAt: 100
    })) {
      requireText(record, field, maximum);
    }
    if (!CONTENT_DIFFICULTIES.has(record.difficulty) || typeof record.published !== 'boolean' ||
        !Array.isArray(record.tags) || record.tags.some(tag => typeof tag !== 'string' || !tag.trim())) {
      throw new DraftImportError(422, `Tutorial record ${String(record.id)} has invalid difficulty, tags, or publish status.`);
    }
    return;
  }
  if (kind === 'answers') {
    for (const [field, maximum] of Object.entries({
      category: 80, subCategory: 100, question: 1000, answer: 20000, createdAt: 100
    })) {
      requireText(record, field, maximum);
    }
    if (!CONTENT_DIFFICULTIES.has(record.difficulty) ||
        !Array.isArray(record.tags) || record.tags.some(tag => typeof tag !== 'string' || !tag.trim()) ||
        ['likeCount', 'dislikeCount', 'viewCount'].some(field =>
          !Number.isSafeInteger(record[field]) || record[field] < 0
        )) {
      throw new DraftImportError(422, `Answer record ${String(record.id)} has invalid difficulty, tags, or counters.`);
    }
    return;
  }
  for (const [field, maximum] of Object.entries({
    category: 80, subCategory: 100, question: 1000, explanation: 20000
  })) {
    requireText(record, field, maximum);
  }
  if (!QUIZ_DIFFICULTIES.has(record.difficulty) || typeof record.image !== 'string' ||
      !Array.isArray(record.options) || record.options.length !== 4 ||
      record.options.some(option => typeof option !== 'string' || !option.trim()) ||
      new Set(record.options.map(option => option.toLowerCase())).size !== 4 ||
      typeof record.correctAnswer !== 'string' || !record.options.includes(record.correctAnswer)) {
    throw new DraftImportError(422, `Quiz record ${String(record.id)} has invalid difficulty, options, or correct answer.`);
  }
}

function sourceFilePath(kind, dataDirectory) {
  const config = DATASETS[kind];
  return config && config.source ? path.join(dataDirectory, config.source) : null;
}

function listDrafts(kind, dataDirectory, outputDirectory) {
  if (!Object.prototype.hasOwnProperty.call(DATASETS, kind)) {
    throw new DraftImportError(400, 'Select a valid dataset: tutorials, answers, or quiz.');
  }
  const outputPath = path.join(outputDirectory, DATASETS[kind].output);
  const records = readArray(outputPath, DATASETS[kind].output, { optional: true });
  if (kind !== 'quiz') {
    return records.map(record => ({ ...record, importable: true, importIssue: '' }));
  }

  const manifest = readManifest(dataDirectory);
  const { categories } = readCategories(dataDirectory);
  const categoryNames = new Set(categories.map(category => category.name.toLowerCase()));
  return records.map(record => {
    const mapped = Object.prototype.hasOwnProperty.call(manifest, record.category);
    const configured = typeof record.category === 'string' && categoryNames.has(record.category.toLowerCase());
    const importable = mapped && configured;
    return {
      ...record,
      importable,
      importIssue: importable ? '' : `No configured quiz category file for ${String(record.category)}.`
    };
  });
}

function validateSelection(kind, ids) {
  if (!Object.prototype.hasOwnProperty.call(DATASETS, kind) ||
      !Array.isArray(ids) || !ids.length || ids.length > MAX_IMPORT_RECORDS) {
    throw new DraftImportError(400, `Select between 1 and ${MAX_IMPORT_RECORDS} records from one dataset.`);
  }
  const keys = ids.map(idKey);
  if (keys.some(key => !key) || new Set(keys).size !== keys.length ||
      (kind === 'quiz' && ids.some(id => !Number.isSafeInteger(id) || id < 1))) {
    throw new DraftImportError(400, 'Selected record IDs are invalid or duplicated.');
  }
  return new Set(keys);
}

function assertNoConflicts(kind, selected, existingRecords) {
  const ids = new Set(existingRecords.map(record => idKey(record.id)).filter(Boolean));
  const questions = new Set(existingRecords.map(record =>
    questionKey(kind === 'tutorials' ? record.title : record.question)
  ).filter(Boolean));
  const batchIds = new Set();
  const batchQuestions = new Set();
  for (const record of selected) {
    validateRecord(kind, record);
    const key = idKey(record.id);
    const prompt = questionKey(kind === 'tutorials' ? record.title : record.question);
    if (ids.has(key) || batchIds.has(key)) {
      throw new DraftImportError(409, `Record ID ${String(record.id)} already exists in the source dataset.`);
    }
    if (questions.has(prompt) || batchQuestions.has(prompt)) {
      throw new DraftImportError(409, `A duplicate ${kind === 'tutorials' ? 'title' : 'question'} was found; no records were imported.`);
    }
    batchIds.add(key);
    batchQuestions.add(prompt);
  }
}

function assertNoQuizConflicts(selected, quizFiles) {
  const existingRecords = [...quizFiles.values()].flat();
  const ids = new Set(existingRecords.map(record => idKey(record.id)).filter(Boolean));
  const questions = new Set(existingRecords.map(record => questionKey(record.question)).filter(Boolean));
  const batchIds = new Set();
  const batchQuestions = new Set();
  for (const record of selected) {
    validateRecord('quiz', record);
    if (ids.has(idKey(record.id)) || batchIds.has(idKey(record.id))) {
      throw new DraftImportError(409, `Quiz record ID ${record.id} already exists in the source data.`);
    }
    const key = questionKey(record.question);
    if (questions.has(key) || batchQuestions.has(key)) {
      throw new DraftImportError(409, 'A duplicate quiz question was found; no records were imported.');
    }
    batchIds.add(idKey(record.id));
    batchQuestions.add(key);
  }
}

function writeJsonFilesAtomically(updates) {
  const staged = updates.map(({ filePath, value }) => ({
    filePath,
    value,
    tempPath: path.join(path.dirname(filePath), `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`),
    backupPath: path.join(path.dirname(filePath), `.${path.basename(filePath)}.${crypto.randomUUID()}.bak`),
    backedUp: false,
    installed: false
  }));
  try {
    for (const item of staged) {
      fs.writeFileSync(item.tempPath, `${JSON.stringify(item.value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    }
    for (const item of staged) {
      if (fs.existsSync(item.filePath)) {
        fs.renameSync(item.filePath, item.backupPath);
        item.backedUp = true;
      }
      fs.renameSync(item.tempPath, item.filePath);
      item.installed = true;
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const item of staged.slice().reverse()) {
      try {
        if (item.installed && fs.existsSync(item.filePath)) fs.unlinkSync(item.filePath);
        if (item.backedUp && fs.existsSync(item.backupPath)) fs.renameSync(item.backupPath, item.filePath);
        if (fs.existsSync(item.tempPath)) fs.unlinkSync(item.tempPath);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError.message);
      }
    }
    if (rollbackErrors.length) {
      throw new DraftImportError(500, `Import failed and rollback needs attention: ${rollbackErrors.join('; ')}`);
    }
    throw error;
  }

  const warnings = [];
  for (const item of staged) {
    if (item.backedUp) {
      try {
        fs.unlinkSync(item.backupPath);
      } catch (error) {
        warnings.push(`Could not remove temporary backup ${path.basename(item.backupPath)}: ${error.message}`);
      }
    }
  }
  return warnings;
}

function importDrafts(kind, ids, dataDirectory, outputDirectory) {
  const requestedKeys = validateSelection(kind, ids);
  const outputPath = path.join(outputDirectory, DATASETS[kind].output);
  if (!fs.existsSync(outputPath)) {
    throw new DraftImportError(404, `No generated ${kind} drafts were found. Generate this dataset first.`);
  }
  const draftRecords = readArray(outputPath, DATASETS[kind].output);
  const draftIds = new Set();
  for (const record of draftRecords) {
    const key = idKey(record.id);
    if (!key || draftIds.has(key)) {
      throw new DraftImportError(422, `${DATASETS[kind].output} contains invalid or duplicate IDs.`);
    }
    draftIds.add(key);
  }
  const selected = draftRecords.filter(record => requestedKeys.has(idKey(record.id)));
  if (selected.length !== requestedKeys.size) {
    throw new DraftImportError(404, 'One or more selected drafts are no longer available. Reload the draft list.');
  }

  const now = new Date().toISOString();
  const updates = [];
  const destinations = {};
  const addedSubcategories = [];
  if (kind === 'quiz') {
    const manifest = readManifest(dataDirectory);
    const { categoriesPath, categories } = readCategories(dataDirectory);
    const categoryByName = new Map(categories.map(category => [category.name.toLowerCase(), category]));
    const filesByPath = new Map();
    const allQuizFiles = new Map();
    for (const [category, filename] of Object.entries(manifest)) {
      const filePath = path.join(dataDirectory, filename);
      if (!allQuizFiles.has(filePath)) {
        allQuizFiles.set(filePath, readArray(filePath, filename));
      }
      if (allQuizFiles.get(filePath).some(record => record.category !== category)) {
        throw new DraftImportError(500, `Quiz file ${filename} contains a record assigned to another category.`);
      }
    }
    for (const record of selected) {
      if (!Object.prototype.hasOwnProperty.call(manifest, record.category)) {
        throw new DraftImportError(422, `Quiz category "${record.category}" has no configured category file.`);
      }
      const category = categoryByName.get(record.category.toLowerCase());
      if (!category) {
        throw new DraftImportError(422, `Quiz category "${record.category}" is not configured in topic_categories.json.`);
      }
    }
    assertNoQuizConflicts(selected, allQuizFiles);
    for (const record of selected) {
      const category = categoryByName.get(record.category.toLowerCase());
      if (!category.subCategories.some(item => item.toLowerCase() === record.subCategory.toLowerCase())) {
        if (category.subCategories.length >= 100) {
          throw new DraftImportError(422, `Category "${category.name}" already has 100 subcategories.`);
        }
        category.subCategories.push(record.subCategory);
        addedSubcategories.push(`${category.name} / ${record.subCategory}`);
      }
      const filePath = path.join(dataDirectory, manifest[record.category]);
      if (!filesByPath.has(filePath)) filesByPath.set(filePath, []);
      filesByPath.get(filePath).push(record);
      destinations[manifest[record.category]] = (destinations[manifest[record.category]] || 0) + 1;
    }
    for (const [filePath, records] of filesByPath) {
      updates.push({ filePath, value: [...allQuizFiles.get(filePath), ...records] });
    }
    if (addedSubcategories.length) {
      updates.push({ filePath: categoriesPath, value: categories });
    }
  } else {
    const sourcePath = sourceFilePath(kind, dataDirectory);
    const existingRecords = readArray(sourcePath, DATASETS[kind].source);
    assertNoConflicts(kind, selected, existingRecords);
    const imported = kind === 'tutorials'
      ? selected.map(record => ({ ...record, published: true, updatedAt: now }))
      : selected;
    updates.push({ filePath: sourcePath, value: [...existingRecords, ...imported] });
    destinations[DATASETS[kind].source] = imported.length;
  }

  const selectedKeys = new Set(selected.map(record => idKey(record.id)));
  const remaining = draftRecords.filter(record => !selectedKeys.has(idKey(record.id)));
  updates.push({ filePath: outputPath, value: remaining });
  const warnings = writeJsonFilesAtomically(updates);
  return {
    dataset: kind,
    imported: selected.length,
    remaining: remaining.length,
    destinations,
    published: kind === 'tutorials' ? selected.length : 0,
    addedSubcategories,
    warnings
  };
}

module.exports = {
  DraftImportError,
  MAX_IMPORT_RECORDS,
  importDrafts,
  listDrafts
};
