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
      exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60
    });
    setCookie(response, 'app_session', sessionToken, { maxAge: 8 * 60 * 60 });
    response.json({
      authenticated: true,
      user: { email: identity.email, name: identity.name || '' }
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
    user: { email: session.email, name: session.name }
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

app.post('/compile', (req, res) => {
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

app.post('/saveProgram', (req, res) => {
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
app.get('/getSavedPrograms', (req, res) => {
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
app.get('/loadProgram', (req, res) => {
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
app.post('/uploadPdf', upload.single('pdfFile'), (req, res) => {
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

// Ensure file exists
if (!fs.existsSync(qaFilePath)) {
  fs.writeFileSync(qaFilePath, '[]', 'utf-8');
}

// Save Question API
app.post('/saveQuestion', (req, res) => {
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
app.get('/getQuestions', (req, res) => {
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
app.post('/saveQuestionsBatch', (req, res) => {
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
app.put('/updateQuestion/:id', (req, res) => {
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
app.delete('/deleteQuestion/:id', (req, res) => {
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
