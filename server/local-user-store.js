const crypto = require('crypto');
const fs = require('fs');

function upsertLocalFirebaseUser(usersFilePath, { username, password, role, permissions, firebaseUid }) {
  if (typeof username !== 'string' || typeof password !== 'string' ||
      typeof role !== 'string' || !Array.isArray(permissions) ||
      !permissions.every(permission => typeof permission === 'string') ||
      typeof firebaseUid !== 'string' || !/^[A-Za-z0-9_-]+$/.test(firebaseUid)) {
    throw new Error('A valid Firebase account and local credential record are required.');
  }

  const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
  if (!Array.isArray(users)) {
    throw new Error('The local user file must contain a JSON array.');
  }

  const normalizedUsername = username.trim().toLowerCase();
  const matchingIndexes = [];
  users.forEach((user, index) => {
    if (user && typeof user.username === 'string' &&
        user.username.trim().toLowerCase() === normalizedUsername) {
      matchingIndexes.push(index);
    }
  });
  if (matchingIndexes.length > 1) {
    throw new Error('The local user file contains duplicate usernames.');
  }
  if (users.some((user, index) => index !== matchingIndexes[0] && user &&
      user.firebaseUid === firebaseUid)) {
    throw new Error('That Firebase UID is already linked to another local user.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const localUser = {
    ...(matchingIndexes.length ? users[matchingIndexes[0]] : {}),
    username: username.trim(),
    role,
    permissions,
    salt,
    passwordHash: crypto.scryptSync(password, salt, 64).toString('hex'),
    firebaseUid
  };
  if (matchingIndexes.length) {
    users[matchingIndexes[0]] = localUser;
  } else {
    users.push(localUser);
  }

  const temporaryPath = `${usersFilePath}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(users, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600
    });
    fs.renameSync(temporaryPath, usersFilePath);
  } catch (error) {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    throw error;
  }
  return localUser;
}

module.exports = { upsertLocalFirebaseUser };
