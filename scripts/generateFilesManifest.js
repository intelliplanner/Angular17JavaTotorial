const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'assets', 'javaNotesPdf');
const manifestPath = path.join(dir, 'files.json');

try {
  if (!fs.existsSync(dir)) {
    console.error('Directory does not exist:', dir);
    process.exit(0);
  }

  const files = fs.readdirSync(dir).filter(f => /\.pdf$/i.test(f));

  if (fs.existsSync(manifestPath)) {
    fs.unlinkSync(manifestPath);
  }

  fs.writeFileSync(manifestPath, JSON.stringify(files, null, 2), 'utf8');
  console.log('Wrote manifest with', files.length, 'entries to', manifestPath);
} catch (err) {
  console.error('Failed to generate files manifest:', err);
  process.exit(1);
}
