const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FirebaseUserProfileSyncError,
  buildFirebaseUserProfiles,
  syncFirebaseUserProfiles
} = require('./firebase-user-profile-sync');

function createFirestore() {
  const documents = new Map();
  function reference(collection, id) {
    return { key: `${collection}/${id}` };
  }
  return {
    documents,
    collection: collection => ({ doc: id => reference(collection, id) }),
    runTransaction: async callback => {
      const writes = [];
      await callback({
        get: async ref => {
          const value = documents.get(ref.key);
          return { exists: value !== undefined, get: key => value && value[key] };
        },
        set: (ref, value) => writes.push([ref.key, value])
      });
      writes.forEach(([key, value]) => documents.set(key, value));
    }
  };
}

test('builds sanitized profiles without credentials or Firebase IDs', () => {
  const profiles = buildFirebaseUserProfiles([{
    username: 'Admin',
    role: 'admin',
    permissions: ['*'],
    firebaseUid: 'firebase-admin-uid',
    passwordHash: 'secret-hash',
    salt: 'secret-salt'
  }]);

  assert.deepEqual(profiles[0].profile, {
    username: 'Admin',
    usernameNormalized: 'admin',
    role: 'admin',
    permissions: ['*']
  });
  assert.equal('passwordHash' in profiles[0].profile, false);
  assert.equal('salt' in profiles[0].profile, false);
  assert.equal('firebaseUid' in profiles[0].profile, false);
});

test('rejects users without UIDs and case-insensitive duplicate usernames', () => {
  assert.throws(() => buildFirebaseUserProfiles([{
    username: 'admin',
    role: 'admin',
    permissions: ['*'],
    firebaseUid: ''
  }]), error => error instanceof FirebaseUserProfileSyncError && error.code === 'INVALID_USER_RECORD');

  assert.throws(() => buildFirebaseUserProfiles([
    { username: 'admin', role: 'admin', permissions: ['*'], firebaseUid: 'uid-1' },
    { username: 'ADMIN', role: 'admin', permissions: ['*'], firebaseUid: 'uid-2' }
  ]), error => error instanceof FirebaseUserProfileSyncError && error.code === 'DUPLICATE_USERNAME');
});

test('syncs sanitized user profiles and username indexes', async () => {
  const firestore = createFirestore();
  const result = await syncFirebaseUserProfiles(firestore, [{
    username: 'learner',
    role: 'learner',
    permissions: ['home', 'learn'],
    firebaseUid: 'firebase-learner-uid',
    passwordHash: 'must-not-sync',
    salt: 'must-not-sync'
  }]);

  assert.deepEqual(result, { total: 1, synced: 1 });
  assert.equal(firestore.documents.get('users/firebase-learner-uid').username, 'learner');
  assert.equal(firestore.documents.get('usernames/learner').uid, 'firebase-learner-uid');
  assert.equal('passwordHash' in firestore.documents.get('users/firebase-learner-uid'), false);
});
