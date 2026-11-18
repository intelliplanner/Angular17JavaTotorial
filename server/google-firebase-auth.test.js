const test = require('node:test');
const assert = require('node:assert/strict');
const { signInGoogleUserWithFirebase } = require('./google-firebase-auth');

function createFirestore(existingProfile) {
  const documents = new Map();
  if (existingProfile) documents.set('users/firebase-uid', existingProfile);
  return {
    documents,
    collection: collection => ({
      doc: id => ({ key: `${collection}/${id}` })
    }),
    runTransaction: async callback => callback({
      get: async reference => {
        const data = documents.get(reference.key);
        return { exists: data !== undefined, data: () => data };
      },
      set: (reference, value, options) => {
        const previous = documents.get(reference.key) || {};
        documents.set(reference.key, options && options.merge
          ? { ...previous, ...value }
          : value);
      }
    })
  };
}

function createAuth() {
  return {
    verifyIdToken: async () => ({ uid: 'firebase-uid', email: 'person@example.com' }),
    getUser: async () => ({
      uid: 'firebase-uid',
      disabled: false,
      providerData: [{ providerId: 'google.com', uid: 'google-uid' }]
    })
  };
}

function createFetch() {
  return async (url, options) => {
    assert.match(url, /accounts:signInWithIdp\?key=web-api-key$/);
    const body = JSON.parse(options.body);
    assert.equal(body.postBody, 'id_token=google-token&providerId=google.com');
    assert.equal(body.returnSecureToken, true);
    return {
      ok: true,
      json: async () => ({
        localId: 'firebase-uid',
        idToken: 'firebase-token',
        refreshToken: 'firebase-refresh-token'
      })
    };
  };
}

test('creates a Firebase UID profile for a verified Google user', async () => {
  const firestore = createFirestore();
  const result = await signInGoogleUserWithFirebase({
    auth: createAuth(),
    firestore,
    apiKey: 'web-api-key',
    credential: 'google-token',
    identity: { sub: 'google-uid', email: 'person@example.com', name: 'Person Example' },
    fetchImpl: createFetch()
  });

  const { profile } = result;
  assert.equal(profile.uid, 'firebase-uid');
  assert.equal(profile.displayName, 'Person Example');
  assert.equal(profile.email, 'person@example.com');
  assert.equal(profile.username, 'person@example.com');
  assert.equal(profile.role, 'learner');
  assert.deepEqual(profile.permissions, ['home', 'learn', 'practiceQuiz']);
  assert.equal(result.idToken, 'firebase-token');
  assert.equal(result.refreshToken, 'firebase-refresh-token');
  assert.deepEqual(firestore.documents.get('users/firebase-uid'), profile);
});

test('preserves an existing profile role and permissions when refreshing Google details', async () => {
  const firestore = createFirestore({
    role: 'admin',
    permissions: ['*'],
    username: 'admin'
  });
  const { profile } = await signInGoogleUserWithFirebase({
    auth: createAuth(),
    firestore,
    apiKey: 'web-api-key',
    credential: 'google-token',
    identity: { sub: 'google-uid', email: 'person@example.com', name: 'Updated Name' },
    fetchImpl: createFetch()
  });

  assert.equal(profile.role, 'admin');
  assert.deepEqual(profile.permissions, ['*']);
  assert.equal(firestore.documents.get('users/firebase-uid').username, 'admin');
  assert.equal(profile.displayName, 'Updated Name');
});

test('does not preserve administrator permissions on a learner profile', async () => {
  const firestore = createFirestore({ role: 'learner', permissions: ['*'] });
  const { profile } = await signInGoogleUserWithFirebase({
    auth: createAuth(),
    firestore,
    apiKey: 'web-api-key',
    credential: 'google-token',
    identity: { sub: 'google-uid', email: 'person@example.com' },
    fetchImpl: createFetch()
  });

  assert.equal(profile.role, 'learner');
  assert.deepEqual(profile.permissions, ['home', 'learn', 'practiceQuiz']);
});
