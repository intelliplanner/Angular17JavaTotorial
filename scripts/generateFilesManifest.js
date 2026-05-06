const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'assets', 'json_files');
const filesDir = path.join(__dirname, '..', 'src', 'assets', 'javaNotesPdf');
const manifestPath = path.join(dir, 'files.json');

try {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filesDir)) {
    console.error('PDF directory does not exist:', filesDir);
    process.exit(0);
  }

  // Collect all PDFs
  const files = fs.readdirSync(filesDir).filter(f => /\.pdf$/i.test(f));

  // Sort alphabetically (case-insensitive)
  const sortedFiles = files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  // Write manifest
  fs.writeFileSync(manifestPath, JSON.stringify(sortedFiles, null, 2), 'utf8');
  console.log(`✅ Wrote manifest with ${sortedFiles.length} entries to ${manifestPath}`);
} catch (err) {
  console.error('❌ Failed to generate files manifest:', err);
  process.exit(1);
}
