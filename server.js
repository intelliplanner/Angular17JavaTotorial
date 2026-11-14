// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const app = express();

const googleClientId = process.env.GOOGLE_CLIENT_ID ||
  '1061518124608-cvv5gk26kq5hps6677h66dt0u7ndbt4q.apps.googleusercontent.com';
function getSessionSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    return '';
  }

  const secretDirectory = path.join(
    process.env.LOCALAPPDATA || os.homedir(),
    'IntelliPlanner'
  );
  const secretPath = path.join(secretDirectory, 'session-secret');
  fs.mkdirSync(secretDirectory, { recursive: true, mode: 0o700 });

  try {
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const generatedSecret = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(secretPath, generatedSecret, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return generatedSecret;
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
    return fs.readFileSync(secretPath, 'utf8').trim();
  }
}

const sessionSecret = getSessionSecret();
const usersFilePath = path.join(__dirname, 'data', 'users.json');
const allowedOrigins = new Set([
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://192.168.1.10:4200',
  'https://intelliplanner.github.io',
  ...(process.env.FRONTEND_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean)
]);
const secureCookies = process.env.COOKIE_SECURE === 'true';
const cookieSameSite = secureCookies ? 'None' : 'Lax';
const pendingGoogleNonces = new Map();

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(bodyParser.json());

function signAuthToken(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifyAuthToken(token) {
  if (!sessionSecret || typeof token !== 'string') {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = crypto.createHmac('sha256', sessionSecret).update(encodedPayload).digest();
  let actualSignature;
  try {
    actualSignature = Buffer.from(providedSignature, 'base64url');
  } catch {
    return null;
  }
  if (actualSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(actualSignature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

function readCookie(request, name) {
  const cookieHeader = request.headers.cookie || '';
  const cookie = cookieHeader.split(';').map(value => value.trim())
    .find(value => value.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : '';
}

function setCookie(response, name, value, options = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path || '/'}`,
    'HttpOnly',
    `SameSite=${cookieSameSite}`,
    `Max-Age=${options.maxAge || 0}`
  ];
  if (secureCookies) {
    parts.push('Secure');
  }
  response.append('Set-Cookie', parts.join('; '));
}

function authUnavailable(response) {
  if (!googleClientId || !sessionSecret || sessionSecret.length < 32) {
    response.status(503).json({
      message: 'Google authentication is unavailable. Configure GOOGLE_CLIENT_ID and a SESSION_SECRET of at least 32 characters.'
    });
    return true;
  }
  return false;
}

function requirePermission(permission) {
  return (request, response, next) => {
    const session = verifyAuthToken(readCookie(request, 'app_session'));
    if (!session) {
      response.status(401).json({ message: 'Please sign in to access this resource.' });
      return;
    }

    const permissions = Array.isArray(session.permissions) ? session.permissions : [];
    if (!permissions.includes('*') && !permissions.includes(permission)) {
      response.status(403).json({ message: 'You do not have permission to access this resource.' });
      return;
    }
    next();
  };
}

app.post('/auth/login', (request, response) => {
  response.set('Cache-Control', 'no-store');
  if (!sessionSecret || sessionSecret.length < 32) {
    response.status(503).json({ message: 'Authentication is unavailable. Configure a SESSION_SECRET of at least 32 characters.' });
    return;
  }

  const { username, password } = request.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' ||
      username.length > 128 || password.length > 128) {
    response.status(400).json({ message: 'Enter a valid username and password.' });
    return;
  }

  let users;
  try {
    users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
  } catch (error) {
    console.error('Could not read the RBAC user configuration:', error);
    response.status(500).json({ message: 'Authentication user configuration could not be loaded.' });
    return;
  }
  if (!Array.isArray(users)) {
    response.status(500).json({ message: 'Authentication user configuration must be a JSON array.' });
    return;
  }

  const normalizedUsername = username.trim().toLowerCase();
  const user = users.find(entry => entry && typeof entry.username === 'string' &&
    entry.username.toLowerCase() === normalizedUsername);
  const salt = user && typeof user.salt === 'string' ? user.salt : 'unknown-user-salt';
  const storedHash = user && typeof user.passwordHash === 'string'
    ? Buffer.from(user.passwordHash, 'hex')
    : Buffer.alloc(64);
  const providedHash = crypto.scryptSync(password, salt, 64);
  const validHash = storedHash.length === providedHash.length &&
    crypto.timingSafeEqual(storedHash, providedHash);

  if (!user || !validHash || typeof user.role !== 'string' ||
      !Array.isArray(user.permissions) ||
      !user.permissions.every(permission => typeof permission === 'string')) {
    response.status(401).json({ message: 'Invalid username or password.' });
    return;
  }

  const publicUser = {
    username: user.username,
    role: user.role,
    permissions: user.permissions
  };
  const sessionToken = signAuthToken({
    ...publicUser,
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60
  });
  setCookie(response, 'app_session', sessionToken, { maxAge: 8 * 60 * 60 });
  response.json({ authenticated: true, user: publicUser });
});

app.get('/auth/google/nonce', (request, response) => {
  response.set('Cache-Control', 'no-store');
  if (authUnavailable(response)) {
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  for (const [pendingNonce, expiresAt] of pendingGoogleNonces) {
    if (expiresAt <= now) {
      pendingGoogleNonces.delete(pendingNonce);
    }
  }

  const nonce = crypto.randomBytes(32).toString('hex');
  pendingGoogleNonces.set(nonce, now + 300);
  response.json({ nonce });
});

app.post('/auth/google/verify', async (request, response) => {
  response.set('Cache-Control', 'no-store');
  if (authUnavailable(response)) {
    return;
  }

  const { credential, nonce } = request.body || {};
  const expiresAt = typeof nonce === 'string' ? pendingGoogleNonces.get(nonce) : undefined;
  if (typeof credential !== 'string' || typeof nonce !== 'string' ||
      !expiresAt || expiresAt <= Math.floor(Date.now() / 1000)) {
    if (typeof nonce === 'string') {
      pendingGoogleNonces.delete(nonce);
    }
    response.status(401).json({ message: 'Google sign-in expired or could not be verified. Please try again.' });
    return;
  }
  pendingGoogleNonces.delete(nonce);

  try {
    const tokenInfoUrl = new URL('https://oauth2.googleapis.com/tokeninfo');
    tokenInfoUrl.searchParams.set('id_token', credential);
    const googleResponse = await fetch(tokenInfoUrl);
    if (!googleResponse.ok) {
      response.status(401).json({ message: 'Google could not verify this sign-in. Please try again.' });
      return;
    }

    const identity = await googleResponse.json();
    const tokenExpiry = Number(identity.exp);
    const validIssuer = identity.iss === 'accounts.google.com' ||
      identity.iss === 'https://accounts.google.com';
    const validEmail = identity.email_verified === true || identity.email_verified === 'true';
    if (identity.aud !== googleClientId || !validIssuer ||
        !Number.isFinite(tokenExpiry) || tokenExpiry <= Math.floor(Date.now() / 1000) ||
        identity.nonce !== nonce || !identity.sub || !validEmail) {
      response.status(401).json({ message: 'Google sign-in could not be verified. Please try again.' });
      return;
    }

    const sessionToken = signAuthToken({
      sub: identity.sub,
      email: identity.email,
      name: identity.name || '',
      username: identity.email,
      role: 'learner',
      permissions: ['home', 'learn', 'practiceQuiz'],
      exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60
    });
    setCookie(response, 'app_session', sessionToken, { maxAge: 8 * 60 * 60 });
    response.json({
      authenticated: true,
      user: {
        username: identity.email,
        email: identity.email,
        name: identity.name || '',
        role: 'learner',
        permissions: ['home', 'learn', 'practiceQuiz']
      }
    });
  } catch (error) {
    console.error('Google sign-in verification failed:', error);
    response.status(502).json({ message: 'Could not reach Google to verify sign-in. Please try again.' });
  }
});

app.get('/auth/session', (request, response) => {
  const session = verifyAuthToken(readCookie(request, 'app_session'));
  if (!session) {
    response.status(401).json({ authenticated: false });
    return;
  }
  response.json({
    authenticated: true,
    user: {
      username: session.username,
      email: session.email,
      name: session.name,
      role: session.role,
      permissions: session.permissions
    }
  });
});

app.post('/auth/logout', (request, response) => {
  setCookie(response, 'app_session', '', { maxAge: 0 });
  response.status(204).end();
});

// Serve static files from src/assets directory
app.use('/assets', express.static(path.join(__dirname, 'src', 'assets')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Java Compiler Server is running', port: 9090 });
});

// Get available Java versions
app.get('/java-versions', (req, res) => {
  try {
    const javaDir = 'D:\\Software_Installed_Dir\\java';
    const fs = require('fs');

    if (!fs.existsSync(javaDir)) {
      return res.json([]);
    }

    const items = fs.readdirSync(javaDir, { withFileTypes: true });
    const versions = items
      .filter(item => item.isDirectory())
      .map(item => {
        const folderName = item.name;
        let label = folderName;

        // Create readable labels
        if (folderName.includes('jdk1.8')) {
          label = `Java 8 (${folderName})`;
        } else if (folderName.includes('jdk-21')) {
          label = `Java 21 (${folderName})`;
        } else if (folderName.includes('jdk-17')) {
          label = `Java 17 (${folderName})`;
        } else if (folderName.includes('jdk-11')) {
          label = `Java 11 (${folderName})`;
        }

        return {
          label: label,
          value: folderName,
          path: `${javaDir}\\${folderName}`
        };
      });

    res.json(versions);
  } catch (error) {
    console.error('Error reading Java versions:', error);
    res.status(500).json({ error: 'Failed to read Java versions' });
  }
});

app.post('/compile', requirePermission('admin'), (req, res) => {
  try {
    const code = req.body.code;
    const javaPath = req.body.javaPath || 'D:\\Software_Installed_Dir\\java\\jdk1.8.0_192';

    if (!code || code.trim().length === 0) {
      return res.status(400).json({ output: 'Error: No code provided' });
    }

    // Extract class name from the code (look for "class ClassName")
    const classMatch = code.match(/class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : 'UserProgram';

    const filePath = path.join(__dirname, `${className}.java`);

    fs.writeFileSync(filePath, code);

    // Use the selected Java version path
    const javacPath = path.join(javaPath, 'bin', 'javac.exe');
    const javaExePath = path.join(javaPath, 'bin', 'java.exe');

    // Use proper Windows command with quoted paths
    const compileCmd = `"${javacPath}" "${filePath}"`;
    const runCmd = `"${javaExePath}" ${className}`;

    exec(`${compileCmd} && ${runCmd}`, { cwd: __dirname }, (error, stdout, stderr) => {
      // Clean up the generated files
      try {
        fs.unlinkSync(filePath);
        const classFile = path.join(__dirname, `${className}.class`);
        if (fs.existsSync(classFile)) {
          fs.unlinkSync(classFile);
        }
      } catch (e) {
        // Ignore cleanup errors
      }

      if (error) {
        console.log('Compilation error:', error);
        console.log('stderr:', stderr);
        res.json({ output: stderr || error.message });
      } else {
        res.json({ output: stdout });
      }
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ output: 'Server Error: ' + error.message });
  }
});

app.post('/saveProgram', requirePermission('admin'), (req, res) => {
  const { fileName, code } = req.body;

  if (!fileName || !code) {
    return res.status(400).json({ message: 'Missing fileName or code' });
  }

  // Save into Angular assets folder
  const filePath = path.join(__dirname, 'src', 'assets/JavaPrograms', fileName);

  fs.writeFile(filePath, code, (err) => {
    if (err) {
      console.error('Error saving program:', err);
      return res.status(500).json({ message: 'Failed to save program' });
    }
    res.json({ message: `Program saved as ${fileName} in assets/JavaPrograms folder` });
  });
});

// Get list of saved programs
app.get('/getSavedPrograms', requirePermission('admin'), (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const programsDir = 'src\\assets\\JavaPrograms';
  
  try {
    const files = fs.readdirSync(programsDir)
      .filter(file => file.endsWith('.java'));
    res.json({ files: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Load a specific program
app.get('/loadProgram', requirePermission('admin'), (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const fileName = req.query.fileName;
  const filePath = path.join(__dirname, 'src', 'assets', 'JavaPrograms', fileName);
  
  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    res.json({ code: code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ----------------------------- PDF Upload + Categorization -----------------------------
const multer = require('multer');
const pdfDir = path.join(__dirname, 'src', 'assets', 'javaNotesPdf');
const categoryFile = path.join(__dirname,'src', 'assets', 'json_files','categorized_topic.json');

// Ensure javaNotesPdf folder exists
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, pdfDir),
  filename: (req, file, cb) => cb(null,"uploaded_" + file.originalname)
});

const upload = multer({ storage });

// Serve uploaded PDFs statically
app.use('/javaNotesPdf', express.static(pdfDir));

// Upload + categorize endpoint
app.post('/uploadPdf', requirePermission('admin'), upload.single('pdfFile'), (req, res) => {
  const { category } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    // Update categorized_topic.json
    let data = {};
    if (fs.existsSync(categoryFile)) {
      data = JSON.parse(fs.readFileSync(categoryFile, 'utf-8'));
    }

    if (category) {
      if (!data[category]) {
        data[category] = [];
      }
      if (!data[category].includes(req.file.filename)) {
        data[category].push(req.file.filename);
      }
    }

    fs.writeFileSync(categoryFile, JSON.stringify(data, null, 2), 'utf-8');

    res.json({
      message: `PDF ${req.file.filename} uploaded successfully!`,
      file: req.file.filename,
      category: category || null,
      url: `/javaNotesPdf/${req.file.filename}`
    });
  } catch (err) {
    console.error('Error saving PDF:', err);
    res.status(500).json({ message: 'Failed to save PDF' });
  }
});

// ----------------------------- Convert categorized_topic.json to route_mapping.json for one time only-----------------------------
// const inputPath = path.join(__dirname, 'src', 'assets', 'json_files', 'categorized_topic.json');
// const outputPath = path.join(__dirname, 'src', 'assets', 'json_files', 'route_mapping.json');

// try {
//   const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
//   const result = [];

//   // Sort categories alphabetically
//   Object.keys(data)
//     .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
//     .forEach(category => {
//       // Sort files alphabetically inside each category
//       data[category].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
//       data[category].forEach(file => {
//         result.push({
//           routeMap: category,
//           notesCategory: category,
//           fileName: file
//           // urlMapping: `/assets/javaNotesPdf/${file}` // optional direct link
//         });
//       });
//     });

//   fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
//   console.log(`✅ Converted JSON written to ${outputPath}`);
// } catch (err) {
//   console.error('❌ Failed to convert JSON:', err);
// }
// End Convert categorized_topic.json to route_mapping.json 



// ----------------------------- Save Interview Q&A -----------------------------
const qaFilePath = path.join(__dirname, 'src', 'assets', 'json_files', 'interview_question_answer.json');
const tutorialsFilePath = path.join(__dirname, 'src', 'assets', 'data', 'tutorials.json');
const interviewQaFilePath = path.join(__dirname, 'src', 'assets', 'data', 'questions-and-answers.json');
const learningVideosFilePath = path.join(__dirname, 'src', 'assets', 'data', 'learning-videos.json');
const quizCategoriesFilePath = path.join(__dirname, 'src', 'assets', 'data', 'topic_categories.json');
const quizQuestionManifestPath = path.join(__dirname, 'src', 'assets', 'data', 'question-files.json');

function readContentList(filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(value)) {
    throw new Error(`Expected a JSON array in ${path.basename(filePath)}.`);
  }
  return value;
}

function writeContentList(filePath, items) {
  fs.writeFileSync(filePath, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
}

function readQuizCategories() {
  const categories = JSON.parse(fs.readFileSync(quizCategoriesFilePath, 'utf8'));
  if (!Array.isArray(categories) ||
      categories.some(category => !category || typeof category.name !== 'string' || !category.name.trim() ||
        !Array.isArray(category.subCategories) ||
        category.subCategories.some(subcategory => typeof subcategory !== 'string' || !subcategory.trim()) ||
        new Set(category.subCategories.map(subcategory => subcategory.toLowerCase())).size !== category.subCategories.length) ||
      new Set(categories.map(category => category.name.toLowerCase())).size !== categories.length) {
    throw new Error('The topic categories file must contain uniquely named categories with valid subcategory lists.');
  }
  return categories;
}

function writeQuizCategories(categories) {
  fs.writeFileSync(quizCategoriesFilePath, `${JSON.stringify(categories, null, 2)}\n`, 'utf8');
}

function normalizeQuizCategory(payload, existing = {}) {
  if (!payload || typeof payload.name !== 'string' || !payload.name.trim() || payload.name.trim().length > 80) {
    return { error: 'Category name is required and must be no longer than 80 characters.' };
  }
  if (!Array.isArray(payload.subCategories) || payload.subCategories.length > 100 ||
      payload.subCategories.some(name => typeof name !== 'string' || !name.trim() || name.trim().length > 100)) {
    return { error: 'Subcategories must be a list of non-empty names no longer than 100 characters.' };
  }
  const subCategories = payload.subCategories.map(name => name.trim());
  if (new Set(subCategories.map(name => name.toLowerCase())).size !== subCategories.length) {
    return { error: 'Subcategory names must be unique within a category.' };
  }
  return {
    value: {
      name: payload.name.trim(),
      subCategories,
      icon: typeof payload.icon === 'string' && payload.icon.trim()
        ? payload.icon.trim()
        : existing.icon || 'fa-solid fa-layer-group',
      description: typeof payload.description === 'string' && payload.description.trim()
        ? payload.description.trim()
        : existing.description || `${payload.name.trim()} learning resources`,
      color: typeof payload.color === 'string' && /^#[\da-f]{6}$/i.test(payload.color)
        ? payload.color
        : existing.color || '#5264ae'
    }
  };
}

function findCategoryContentReferences(categoryName) {
  const manifest = JSON.parse(fs.readFileSync(quizQuestionManifestPath, 'utf8'));
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('The quiz question manifest has an invalid format.');
  }
  const references = [];
  for (const [category, filename] of Object.entries(manifest)) {
    if (typeof filename !== 'string' || !/^[a-z0-9-]+\.json$/i.test(filename)) {
      throw new Error(`Invalid quiz question file entry for category "${category}".`);
    }
    const questions = JSON.parse(fs.readFileSync(
      path.join(__dirname, 'src', 'assets', 'data', filename),
      'utf8'
    ));
    if (!Array.isArray(questions)) {
      throw new Error(`Quiz question file "${filename}" must contain a JSON array.`);
    }
    for (const question of questions) {
      if (question && question.category === categoryName) {
        references.push({ category, subCategory: question.subCategory });
      }
    }
  }

  for (const filePath of [tutorialsFilePath, interviewQaFilePath, learningVideosFilePath]) {
    for (const item of readContentList(filePath)) {
      if (item && item.category === categoryName) {
        references.push({ category: item.category, subCategory: item.subCategory });
      }
    }
  }
  return references;
}

app.get('/api/categories', (request, response) => {
  try {
    response.set('Cache-Control', 'no-store');
    response.json(readQuizCategories());
  } catch (error) {
    console.error('Error reading quiz categories:', error);
    response.status(500).json({ message: 'Could not load quiz categories.' });
  }
});

app.post('/api/categories', requirePermission('admin'), (request, response) => {
  const result = normalizeQuizCategory(request.body || {});
  if (result.error) return response.status(400).json({ message: result.error });
  try {
    const categories = readQuizCategories();
    if (categories.some(category => category.name.toLowerCase() === result.value.name.toLowerCase())) {
      return response.status(409).json({ message: 'A category with that name already exists.' });
    }
    categories.push(result.value);
    writeQuizCategories(categories);
    response.status(201).json(categories);
  } catch (error) {
    console.error('Error creating quiz category:', error);
    response.status(500).json({ message: 'Could not save quiz categories.' });
  }
});

app.put('/api/categories/:name', requirePermission('admin'), (request, response) => {
  try {
    const categories = readQuizCategories();
    const index = categories.findIndex(category => category.name === request.params.name);
    if (index < 0) return response.status(404).json({ message: 'Category not found.' });
    const result = normalizeQuizCategory(request.body || {}, categories[index]);
    if (result.error) return response.status(400).json({ message: result.error });
    if (categories.some((category, categoryIndex) =>
      categoryIndex !== index && category.name.toLowerCase() === result.value.name.toLowerCase()
    )) {
      return response.status(409).json({ message: 'A category with that name already exists.' });
    }

    const references = findCategoryContentReferences(request.params.name);
    if (result.value.name !== request.params.name && references.length) {
      return response.status(409).json({ message: 'This category is used by quiz questions and cannot be renamed.' });
    }
    const retainedSubcategories = new Set(result.value.subCategories);
    if (references.some(reference => !retainedSubcategories.has(reference.subCategory))) {
      return response.status(409).json({ message: 'A subcategory used by quiz questions cannot be removed or renamed.' });
    }

    categories[index] = result.value;
    writeQuizCategories(categories);
    response.json(categories);
  } catch (error) {
    console.error('Error updating quiz category:', error);
    response.status(500).json({ message: 'Could not update quiz categories.' });
  }
});

app.delete('/api/categories/:name', requirePermission('admin'), (request, response) => {
  try {
    const categories = readQuizCategories();
    const index = categories.findIndex(category => category.name === request.params.name);
    if (index < 0) return response.status(404).json({ message: 'Category not found.' });
    if (findCategoryContentReferences(request.params.name).length) {
      return response.status(409).json({ message: 'This category is used by quiz questions and cannot be deleted.' });
    }
    categories.splice(index, 1);
    writeQuizCategories(categories);
    response.json(categories);
  } catch (error) {
    console.error('Error deleting quiz category:', error);
    response.status(500).json({ message: 'Could not delete quiz category.' });
  }
});

function normalizeTags(value) {
  return Array.isArray(value)
    ? value.filter(tag => typeof tag === 'string').map(tag => tag.trim()).filter(Boolean).slice(0, 20)
    : [];
}

function validateContentText(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    return `${label} is required and must be no longer than ${maximum} characters.`;
  }
  return '';
}

function normalizeTutorial(payload, previous = {}) {
  const tutorial = { ...previous, ...payload };
  for (const [field, maximum] of Object.entries({
    title: 180, category: 80, subCategory: 100, description: 400, content: 50000
  })) {
    const error = validateContentText(tutorial[field], field, maximum);
    if (error) return { error };
  }
  if (!['Beginner', 'Intermediate', 'Advanced'].includes(tutorial.difficulty)) {
    return { error: 'difficulty must be Beginner, Intermediate, or Advanced.' };
  }
  return {
    value: {
      ...tutorial,
      title: tutorial.title.trim(),
      category: tutorial.category.trim(),
      subCategory: tutorial.subCategory.trim(),
      description: tutorial.description.trim(),
      content: tutorial.content.trim(),
      difficulty: tutorial.difficulty,
      tags: normalizeTags(tutorial.tags),
      published: tutorial.published === true,
      author: typeof tutorial.author === 'string' && tutorial.author.trim()
        ? tutorial.author.trim().slice(0, 100)
        : 'Tech Interview Hub'
    }
  };
}

function normalizeInterviewQuestion(payload, previous = {}) {
  const question = { ...previous, ...payload };
  for (const [field, maximum] of Object.entries({
    category: 80, subCategory: 100, question: 1000, answer: 20000
  })) {
    const error = validateContentText(question[field], field, maximum);
    if (error) return { error };
  }
  if (!['Beginner', 'Intermediate', 'Advanced'].includes(question.difficulty)) {
    return { error: 'difficulty must be Beginner, Intermediate, or Advanced.' };
  }
  return {
    value: {
      ...question,
      category: question.category.trim(),
      subCategory: question.subCategory.trim(),
      question: question.question.trim(),
      answer: question.answer.trim(),
      tags: normalizeTags(question.tags),
      likeCount: Number.isInteger(question.likeCount) && question.likeCount >= 0 ? question.likeCount : 0,
      dislikeCount: Number.isInteger(question.dislikeCount) && question.dislikeCount >= 0 ? question.dislikeCount : 0,
      viewCount: Number.isInteger(question.viewCount) && question.viewCount >= 0 ? question.viewCount : 0
    }
  };
}

app.get('/api/tutorials', (request, response) => {
  try {
    response.set('Cache-Control', 'no-store');
    response.json(readContentList(tutorialsFilePath).filter(tutorial => tutorial.published === true));
  } catch (error) {
    console.error('Error reading tutorials:', error);
    response.status(500).json({ message: 'Could not load tutorials.' });
  }
});

app.get('/api/admin/tutorials', requirePermission('admin'), (request, response) => {
  try {
    response.set('Cache-Control', 'no-store');
    response.json(readContentList(tutorialsFilePath));
  } catch (error) {
    console.error('Error reading tutorials for administration:', error);
    response.status(500).json({ message: 'Could not load tutorials.' });
  }
});

app.post('/api/tutorials', requirePermission('admin'), (request, response) => {
  const result = normalizeTutorial(request.body || {});
  if (result.error) return response.status(400).json({ message: result.error });
  try {
    const tutorials = readContentList(tutorialsFilePath);
    const tutorial = {
      ...result.value,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    tutorials.unshift(tutorial);
    writeContentList(tutorialsFilePath, tutorials);
    response.status(201).json(tutorial);
  } catch (error) {
    console.error('Error creating tutorial:', error);
    response.status(500).json({ message: 'Could not create tutorial.' });
  }
});

app.put('/api/tutorials/:id', requirePermission('admin'), (request, response) => {
  try {
    const tutorials = readContentList(tutorialsFilePath);
    const index = tutorials.findIndex(tutorial => tutorial.id === request.params.id);
    if (index < 0) return response.status(404).json({ message: 'Tutorial not found.' });
    const result = normalizeTutorial(request.body || {}, tutorials[index]);
    if (result.error) return response.status(400).json({ message: result.error });
    tutorials[index] = { ...result.value, id: tutorials[index].id, createdAt: tutorials[index].createdAt, updatedAt: new Date().toISOString() };
    writeContentList(tutorialsFilePath, tutorials);
    response.json(tutorials[index]);
  } catch (error) {
    console.error('Error updating tutorial:', error);
    response.status(500).json({ message: 'Could not update tutorial.' });
  }
});

app.delete('/api/tutorials/:id', requirePermission('admin'), (request, response) => {
  try {
    const tutorials = readContentList(tutorialsFilePath);
    const remaining = tutorials.filter(tutorial => tutorial.id !== request.params.id);
    if (remaining.length === tutorials.length) return response.status(404).json({ message: 'Tutorial not found.' });
    writeContentList(tutorialsFilePath, remaining);
    response.status(204).end();
  } catch (error) {
    console.error('Error deleting tutorial:', error);
    response.status(500).json({ message: 'Could not delete tutorial.' });
  }
});

app.get('/api/questions', (request, response) => {
  try {
    response.set('Cache-Control', 'no-store');
    response.json(readContentList(interviewQaFilePath));
  } catch (error) {
    console.error('Error reading interview Q&A:', error);
    response.status(500).json({ message: 'Could not load interview questions.' });
  }
});

app.post('/api/questions', requirePermission('admin'), (request, response) => {
  const result = normalizeInterviewQuestion(request.body || {});
  if (result.error) return response.status(400).json({ message: result.error });
  try {
    const questions = readContentList(interviewQaFilePath);
    const question = { ...result.value, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    questions.unshift(question);
    writeContentList(interviewQaFilePath, questions);
    response.status(201).json(question);
  } catch (error) {
    console.error('Error creating interview question:', error);
    response.status(500).json({ message: 'Could not create interview question.' });
  }
});

app.put('/api/questions/:id', requirePermission('admin'), (request, response) => {
  try {
    const questions = readContentList(interviewQaFilePath);
    const index = questions.findIndex(question => question.id === request.params.id);
    if (index < 0) return response.status(404).json({ message: 'Question not found.' });
    const result = normalizeInterviewQuestion(request.body || {}, questions[index]);
    if (result.error) return response.status(400).json({ message: result.error });
    questions[index] = { ...result.value, id: questions[index].id, createdAt: questions[index].createdAt };
    writeContentList(interviewQaFilePath, questions);
    response.json(questions[index]);
  } catch (error) {
    console.error('Error updating interview question:', error);
    response.status(500).json({ message: 'Could not update interview question.' });
  }
});

app.delete('/api/questions/:id', requirePermission('admin'), (request, response) => {
  try {
    const questions = readContentList(interviewQaFilePath);
    const remaining = questions.filter(question => question.id !== request.params.id);
    if (remaining.length === questions.length) return response.status(404).json({ message: 'Question not found.' });
    writeContentList(interviewQaFilePath, remaining);
    response.status(204).end();
  } catch (error) {
    console.error('Error deleting interview question:', error);
    response.status(500).json({ message: 'Could not delete interview question.' });
  }
});

// Ensure file exists
if (!fs.existsSync(qaFilePath)) {
  fs.writeFileSync(qaFilePath, '[]', 'utf-8');
}

// Save Question API
app.post('/saveQuestion', requirePermission('admin'), (req, res) => {
  const newQ = req.body;

  fs.readFile(qaFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading interview_question_answer.json:', err);
      return res.status(500).send('Error reading file');
    }

    let questions = [];
    if (data && data.trim().length > 0) {
      try {
        questions = JSON.parse(data);
      } catch (parseErr) {
        console.error('Error parsing interview_question_answer.json:', parseErr);
        return res.status(500).send('Error parsing file');
      }
    }

    questions.push(newQ);

    fs.writeFile(qaFilePath, JSON.stringify(questions, null, 2), 'utf-8', (err) => {
      if (err) {
        console.error('Error writing interview_question_answer.json:', err);
        return res.status(500).send('Error writing file');
      }
      res.json({ message: 'Question saved successfully!', total: questions.length });
    });
  });
});

// Get all Interview Q&A
app.get('/getQuestions', requirePermission('admin'), (req, res) => {
  try {
    const data = fs.readFileSync(qaFilePath, 'utf-8');
    const questions = JSON.parse(data || '[]');
    res.json(questions);
  } catch (err) {
    console.error('Error reading interview_question_answer.json:', err);
    res.status(500).json({ error: 'Failed to read questions' });
  }
});

// Save multiple questions at once
// Save multiple questions at once
app.post('/saveQuestionsBatch', requirePermission('admin'), (req, res) => {
  const newQuestions = req.body;

  fs.readFile(qaFilePath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Error reading file');

    let questions = [];
    if (data && data.trim().length > 0) {
      questions = JSON.parse(data);
    }

    let nextId = questions.length > 0 ? Math.max(...questions.map(q => q.id || 0)) + 1 : 1;

    // Assign IDs sequentially
    newQuestions.forEach(q => {
      q.id = nextId++;
      questions.push(q);
    });

    fs.writeFile(qaFilePath, JSON.stringify(questions, null, 2), 'utf8', (err) => {
      if (err) return res.status(500).send('Error writing file');
      res.json({ message: 'Questions saved successfully!', total: questions.length });
    });
  });
});


// ----------------------------- Update Interview Q&A by ID -----------------------------
app.put('/updateQuestion/:id', requirePermission('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const updatedQuestion = req.body;

  try {
    const data = fs.readFileSync(qaFilePath, 'utf8');
    const questions = JSON.parse(data || '[]');

    const index = questions.findIndex(q => q.id === id);
    if (index === -1) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Merge existing with updated payload
    questions[index] = { ...questions[index], ...updatedQuestion };

    fs.writeFileSync(qaFilePath, JSON.stringify(questions, null, 2), 'utf8');
    res.json({ message: 'Question updated successfully', question: questions[index] });
  } catch (err) {
    console.error('Error updating question:', err);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// ----------------------------- Delete Interview Q&A by ID -----------------------------
app.delete('/deleteQuestion/:id', requirePermission('admin'), (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const data = fs.readFileSync(qaFilePath, 'utf8');
    const questions = JSON.parse(data || '[]');

    const newData = questions.filter(q => q.id !== id);

    fs.writeFileSync(qaFilePath, JSON.stringify(newData, null, 2), 'utf8');
    res.json({ message: 'Deleted successfully', total: newData.length });
  } catch (err) {
    console.error('Error deleting question:', err);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Start the server

const PORT = Number(process.env.PORT) || 9090;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Java Compiler Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`📍Server running at http://192.168.1.10:${PORT}`);
  console.log(`✅ CORS enabled for Angular frontend\n`);

});
