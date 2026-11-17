const { normalizeUsername } = require('./firebase-username-auth');

class FirebaseUserProfileSyncError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'FirebaseUserProfileSyncError';
    this.status = status;
    this.code = code;
  }
}

function buildFirebaseUserProfiles(users) {
  if (!Array.isArray(users)) {
    throw new FirebaseUserProfileSyncError(400, 'INVALID_USER_FILE',
      'The server-side user file must contain a JSON array.');
  }

  const profiles = users.map(user => {
    if (!user || typeof user !== 'object' ||
        typeof user.firebaseUid !== 'string' ||
        !/^[A-Za-z0-9_-]+$/.test(user.firebaseUid) ||
        typeof user.username !== 'string' ||
        typeof user.role !== 'string' ||
        !Array.isArray(user.permissions) ||
        !user.permissions.every(permission => typeof permission === 'string')) {
      throw new FirebaseUserProfileSyncError(400, 'INVALID_USER_RECORD',
        'Every user must have a Firebase UID, username, role, and string permissions.');
    }

    let usernameNormalized;
    try {
      usernameNormalized = normalizeUsername(user.username);
    } catch {
      throw new FirebaseUserProfileSyncError(400, 'INVALID_USERNAME',
        'Every user must have a valid username.');
    }

    return {
      uid: user.firebaseUid,
      username: user.username,
      usernameNormalized,
      profile: {
        username: user.username,
        usernameNormalized,
        role: user.role,
        permissions: user.permissions
      }
    };
  });

  if (new Set(profiles.map(profile => profile.uid)).size !== profiles.length) {
    throw new FirebaseUserProfileSyncError(400, 'DUPLICATE_FIREBASE_UID',
      'Firebase UIDs in the user file must be unique.');
  }
  if (new Set(profiles.map(profile => profile.usernameNormalized)).size !== profiles.length) {
    throw new FirebaseUserProfileSyncError(400, 'DUPLICATE_USERNAME',
      'Usernames in the user file must be unique, ignoring case.');
  }
  return profiles;
}

async function syncFirebaseUserProfiles(firestore, users) {
  const profiles = buildFirebaseUserProfiles(users);
  for (const { uid, username, usernameNormalized, profile } of profiles) {
    const usernameRef = firestore.collection('usernames').doc(usernameNormalized);
    await firestore.runTransaction(async transaction => {
      const usernameSnapshot = await transaction.get(usernameRef);
      if (usernameSnapshot.exists && usernameSnapshot.get('uid') !== uid) {
        throw new FirebaseUserProfileSyncError(409, 'USERNAME_CONFLICT',
          `The username "${username}" is already assigned to a different Firebase UID.`);
      }
      transaction.set(firestore.collection('users').doc(uid), profile, { merge: true });
      transaction.set(usernameRef, { uid, username });
    });
  }

  return { total: profiles.length, synced: profiles.length };
}

module.exports = {
  FirebaseUserProfileSyncError,
  buildFirebaseUserProfiles,
  syncFirebaseUserProfiles
};
