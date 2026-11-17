const crypto = require('crypto');

const BOOTSTRAP_SESSION_PERMISSION = 'firebaseUserSetup';
const BOOTSTRAP_LEASE_MS = 10 * 60 * 1000;

class FirebaseBootstrapError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'FirebaseBootstrapError';
    this.status = status;
    this.code = code;
  }
}

function isBootstrapSession(session) {
  return !!session &&
    session.role === 'firebaseBootstrap' &&
    Array.isArray(session.permissions) &&
    session.permissions.length === 1 &&
    session.permissions[0] === BOOTSTRAP_SESSION_PERMISSION;
}

async function assertBootstrapAvailable(firestore, environment = process.env) {
  if (environment.FIREBASE_BOOTSTRAP_ENABLED !== 'true') {
    throw new FirebaseBootstrapError(403, 'BOOTSTRAP_DISABLED',
      'One-time Firebase setup login is disabled on the server.');
  }

  const bootstrapRef = firestore.collection('system').doc('firebaseBootstrap');
  const [adminSnapshot, bootstrapSnapshot] = await Promise.all([
    firestore.collection('users').where('role', '==', 'admin').limit(1).get(),
    bootstrapRef.get()
  ]);
  if (!adminSnapshot.empty || (bootstrapSnapshot.exists && bootstrapSnapshot.get('status') === 'complete')) {
    throw new FirebaseBootstrapError(409, 'BOOTSTRAP_COMPLETE',
      'Initial Firebase administrator setup has already been completed.');
  }
}

async function claimBootstrap(firestore, environment = process.env, now = Date.now()) {
  if (environment.FIREBASE_BOOTSTRAP_ENABLED !== 'true') {
    throw new FirebaseBootstrapError(403, 'BOOTSTRAP_DISABLED',
      'One-time Firebase setup login is disabled on the server.');
  }

  const claimId = crypto.randomBytes(16).toString('hex');
  const bootstrapRef = firestore.collection('system').doc('firebaseBootstrap');
  await firestore.runTransaction(async transaction => {
    const [adminSnapshot, bootstrapSnapshot] = await Promise.all([
      transaction.get(firestore.collection('users').where('role', '==', 'admin').limit(1)),
      transaction.get(bootstrapRef)
    ]);
    if (!adminSnapshot.empty || (bootstrapSnapshot.exists &&
        bootstrapSnapshot.get('status') === 'complete')) {
      throw new FirebaseBootstrapError(409, 'BOOTSTRAP_COMPLETE',
        'Initial Firebase administrator setup has already been completed.');
    }

    const leaseExpiresAt = bootstrapSnapshot.exists
      ? bootstrapSnapshot.get('leaseExpiresAt')
      : 0;
    if (bootstrapSnapshot.exists && typeof leaseExpiresAt === 'number' && leaseExpiresAt > now) {
      throw new FirebaseBootstrapError(409, 'BOOTSTRAP_IN_PROGRESS',
        'Initial Firebase administrator setup is already in progress.');
    }

    transaction.set(bootstrapRef, {
      status: 'creating',
      claimId,
      leaseExpiresAt: now + BOOTSTRAP_LEASE_MS
    });
  });
  return { bootstrapRef, claimId };
}

async function completeBootstrap(firestore, claim) {
  await firestore.runTransaction(async transaction => {
    const snapshot = await transaction.get(claim.bootstrapRef);
    if (!snapshot.exists || snapshot.get('claimId') !== claim.claimId) {
      throw new FirebaseBootstrapError(409, 'BOOTSTRAP_CLAIM_LOST',
        'Initial Firebase administrator setup could not be completed. Please sign in and retry.');
    }
    transaction.set(claim.bootstrapRef, {
      status: 'complete',
      completedAt: new Date().toISOString()
    });
  });
}

async function releaseBootstrap(firestore, claim) {
  await firestore.runTransaction(async transaction => {
    const snapshot = await transaction.get(claim.bootstrapRef);
    if (snapshot.exists && snapshot.get('claimId') === claim.claimId) {
      transaction.delete(claim.bootstrapRef);
    }
  });
}

module.exports = {
  BOOTSTRAP_SESSION_PERMISSION,
  FirebaseBootstrapError,
  assertBootstrapAvailable,
  claimBootstrap,
  completeBootstrap,
  isBootstrapSession,
  releaseBootstrap
};
