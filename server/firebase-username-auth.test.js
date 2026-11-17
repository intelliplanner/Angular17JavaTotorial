const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FirebaseUserError,
  createFirebaseUsernameAuth,
  createPasswordDigest,
  createUsernameEmailAlias,
  normalizeUsername
} = require('./firebase-username-auth');

function createFirestore() {
  const documents = new Map();
  function reference(collection, id) {
    const key = `${collection}/${id}`;
    return {
      key,
      get: async () => snapshot(documents.get(key)),
      set: async value => documents.set(key, value),
      data: () => documents.get(key)
    };
  }
  const firestore = {
    collection: collection => ({
      doc: id => reference(collection, id),
      where: (field, operator, value) => ({
        limit: count => ({
          get: async () => {
            const docs = [...documents.entries()]
              .filter(([key, data]) =>
                key.startsWith(`${collection}/`) && data[field] === value)
              .slice(0, count)
              .map(([key, data]) => ({
                id: key.slice(collection.length + 1),
                data: () => data
              }));
            return { docs };
          }
        })
      })
    }),
    runTransaction: async callback => {
      const writes = [];
      const transaction = {
        get: async ref => snapshot(documents.get(ref.key)),
        create: (ref, value) => writes.push([ref.key, value])
      };
      await callback(transaction);
      for (const [key, value] of writes) documents.set(key, value);
    }
  };
  return { firestore, documents, reference };
}

function snapshot(value) {
  return {
    exists: value !== undefined,
    get: key => value && value[key],
    data: () => value
  };
}

test('normalizes usernames consistently and rejects unsafe aliases', () => {
  assert.equal(normalizeUsername('  Admin_User '), 'admin_user');
  assert.throws(() => normalizeUsername('ab'), error =>
    error instanceof FirebaseUserError && error.status === 400);
});

test('uses a deterministic, non-revealing Firebase email alias', () => {
  const alias = createUsernameEmailAlias('admin', 'sample-project');
  assert.equal(alias, createUsernameEmailAlias('admin', 'sample-project'));
  assert.match(alias, /^user-[a-f0-9]{64}@sample-project\.firebaseapp\.com$/);
  assert.equal(alias.includes('admin'), false);
});

test('stores only a keyed digest for new-user password uniqueness', () => {
  const secret = 'a-secure-several-words-secret-value-1234';
  const first = createPasswordDigest('a-unique-password', secret);
  assert.equal(first, createPasswordDigest('a-unique-password', secret));
  assert.notEqual(first, createPasswordDigest('a-unique-password', 'a-different-secure-key-for-testing-123456'));
  assert.throws(() => createPasswordDigest('password', 'short'), error =>
    error instanceof FirebaseUserError && error.status === 503);
});

test('creates a Firebase user with unique username and password indexes', async () => {
  const { firestore, documents } = createFirestore();
  const auth = {
    createUser: async details => ({ uid: details.displayName.toLowerCase() }),
    deleteUser: async () => undefined
  };
  const service = createFirebaseUsernameAuth({
    auth,
    firestore,
    projectId: 'sample-project',
    apiKey: 'test-key',
    passwordUniquenessSecret: 'a sufficiently long server secret'
  });

  const created = await service.createUser({
    username: 'New_User',
    password: 'a-unique-password',
    role: 'learner'
  });

  assert.deepEqual(created, {
    username: 'New_User',
    role: 'learner',
    permissions: ['home', 'learn', 'practiceQuiz'],
    firebaseUid: 'new_user'
  });
  assert.equal(documents.get('usernames/new_user').uid, 'new_user');
  assert.equal(documents.get('users/new_user').usernameNormalized, 'new_user');
  assert.equal(documents.get('users/new_user').password, undefined);
  assert.equal(documents.size, 3);
});

test('rejects duplicate usernames and passwords for panel-created users', async () => {
  const { firestore } = createFirestore();
  let nextUid = 0;
  const auth = {
    createUser: async () => ({ uid: `uid-${++nextUid}` }),
    deleteUser: async () => undefined
  };
  const service = createFirebaseUsernameAuth({
    auth,
    firestore,
    projectId: 'sample-project',
    apiKey: 'test-key',
    passwordUniquenessSecret: 'a sufficiently long server secret'
  });
  await service.createUser({ username: 'learner', password: 'first-unique-password', role: 'learner' });

  await assert.rejects(
    service.createUser({ username: 'LEARNER', password: 'another-unique-password', role: 'learner' }),
    error => error instanceof FirebaseUserError && error.code === 'USERNAME_EXISTS'
  );
  await assert.rejects(
    service.createUser({ username: 'second-user', password: 'first-unique-password', role: 'learner' }),
    error => error instanceof FirebaseUserError && error.code === 'PASSWORD_EXISTS'
  );
});

test('resolves username from its profile and delegates password verification to Firebase Authentication', async () => {
  const { firestore, reference } = createFirestore();
  await reference('users', 'uid-1').set({
    username: 'Learner',
    usernameNormalized: 'learner',
    role: 'learner',
    permissions: ['home', 'learn']
  });
  const auth = { getUser: async () => ({ uid: 'uid-1', email: 'generated-alias@example.test' }) };
  let authRequest;
  const service = createFirebaseUsernameAuth({
    auth,
    firestore,
    projectId: 'sample-project',
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      authRequest = { url, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({ localId: 'uid-1', idToken: 'id-token', refreshToken: 'refresh-token' })
      };
    }
  });

  const result = await service.signIn('Learner', 'existing-password');

  assert.deepEqual(result, {
    localId: 'uid-1',
    idToken: 'id-token',
    refreshToken: 'refresh-token',
    user: { username: 'Learner', role: 'learner', permissions: ['home', 'learn'] }
  });
  assert.match(authRequest.url, /accounts:signInWithPassword\?key=test-key$/);
  assert.deepEqual(authRequest.body, {
    email: 'generated-alias@example.test',
    password: 'existing-password',
    returnSecureToken: true
  });
});
