const fs = require('fs');
const path = require('path');

const assetsDirectory = path.join(__dirname, '..', 'src', 'assets');
const manifestPath = path.join(assetsDirectory, 'data', 'json-sync-manifest.json');

function findJsonFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findJsonFiles(fullPath);
    if (entry.isFile() &&
        /\.json$/i.test(entry.name) &&
        entry.name.toLowerCase() !== 'users.json' &&
        fullPath !== manifestPath) {
      return [path.relative(assetsDirectory, fullPath).split(path.sep).join('/')];
    }
    return [];
  });
}

const files = findJsonFiles(assetsDirectory)
  .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));

fs.writeFileSync(manifestPath, `${JSON.stringify(files, null, 2)}\n`, 'utf8');
console.log(`Wrote JSON sync manifest with ${files.length} files.`);
