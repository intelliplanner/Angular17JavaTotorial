// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(bodyParser.json());

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

const PORT = 9090;
app.listen(PORT,'0.0.0.0', () => {
  console.log(`\n🚀 Java Compiler Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`📍Server running at http://192.168.1.10:${PORT}`);
  console.log(`✅ CORS enabled for Angular frontend\n`);

});