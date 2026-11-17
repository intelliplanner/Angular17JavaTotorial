const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BOOTSTRAP_SESSION_PERMISSION,
  FirebaseBootstrapError,
  assertBootstrapAvailable,
  isBootstrapSession
} = require('./firebase-bootstrap');

function createFirestore({ hasAdmin = false, bootstrapState = null } = {}) {
  const bootstrapRef = {
    get: async () => ({
      exists: !!bootstrapState,
      get: key => bootstrapState && bootstrapState[key]
    })
  };
  const usersCollection = {
    where: () => ({
      limit: () => ({
        get: async () => ({ empty: !hasAdmin })
      })
    })
  };
  return {
    collection: name => name === 'users' ? usersCollection : { doc: () => bootstrapRef }
  };
}

test('allows bootstrap only when enabled and no Firebase admin exists', async () => {
  await assertBootstrapAvailable(createFirestore(), { FIREBASE_BOOTSTRAP_ENABLED: 'true' });
});

test('rejects bootstrap when disabled or an administrator already exists', async () => {
  await assert.rejects(
    assertBootstrapAvailable(createFirestore(), {}),
    error => error instanceof FirebaseBootstrapError && error.status === 403
  );
  await assert.rejects(
    assertBootstrapAvailable(createFirestore({ hasAdmin: true }), { FIREBASE_BOOTSTRAP_ENABLED: 'true' }),
    error => error instanceof FirebaseBootstrapError && error.status === 409
  );
});

test('rejects bootstrap after its completion marker has been written', async () => {
  await assert.rejects(
    assertBootstrapAvailable(createFirestore({ bootstrapState: { status: 'complete' } }),
      { FIREBASE_BOOTSTRAP_ENABLED: 'true' }),
    error => error instanceof FirebaseBootstrapError && error.status === 409
  );
});

test('rejects bootstrap sessions with any permission beyond setup', () => {
  assert.equal(isBootstrapSession({
    role: 'firebaseBootstrap',
    permissions: [BOOTSTRAP_SESSION_PERMISSION]
  }), true);
  assert.equal(isBootstrapSession({
    role: 'firebaseBootstrap',
    permissions: [BOOTSTRAP_SESSION_PERMISSION, '*']
  }), false);
});
