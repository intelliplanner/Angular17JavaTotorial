const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { upsertLocalFirebaseUser } = require('./local-user-store');

test('stores Firebase-created credentials as a local password hash and UID mapping', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'local-users-'));
  const filePath = path.join(directory, 'users.json');
  fs.writeFileSync(filePath, JSON.stringify([
    { username: 'admin', role: 'admin', permissions: ['*'], salt: 'old', passwordHash: 'old-hash', firebaseUid: '' }
  ]));

  try {
    const saved = upsertLocalFirebaseUser(filePath, {
      username: 'admin',
      password: 'a-new-local-password',
      role: 'admin',
      permissions: ['*'],
      firebaseUid: 'firebase-admin-uid'
    });
    const users = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const expectedHash = crypto.scryptSync('a-new-local-password', saved.salt, 64).toString('hex');

    assert.equal(users.length, 1);
    assert.equal(users[0].firebaseUid, 'firebase-admin-uid');
    assert.equal(users[0].passwordHash, expectedHash);
    assert.equal('password' in users[0], false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('adds a local credential record for a newly created Firebase user', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'local-users-'));
  const filePath = path.join(directory, 'users.json');
  fs.writeFileSync(filePath, '[]');

  try {
    upsertLocalFirebaseUser(filePath, {
      username: 'new-learner',
      password: 'a-new-local-password',
      role: 'learner',
      permissions: ['home', 'learn', 'practiceQuiz'],
      firebaseUid: 'firebase-learner-uid'
    });

    const users = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(users.length, 1);
    assert.equal(users[0].username, 'new-learner');
    assert.equal(users[0].firebaseUid, 'firebase-learner-uid');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
