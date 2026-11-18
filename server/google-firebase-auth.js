class GoogleFirebaseAuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'GoogleFirebaseAuthError';
    this.status = status;
    this.code = code;
  }
}

async function signInGoogleUserWithFirebase({
  auth,
  firestore,
  apiKey,
  credential,
  identity,
  requestUri,
  fetchImpl = globalThis.fetch
}) {
  const firebaseResponse = await fetchImpl(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `id_token=${encodeURIComponent(credential)}&providerId=google.com`,
        requestUri: requestUri || 'http://localhost',
        returnIdpCredential: true,
        returnSecureToken: true
      })
    }
  );
  if (!firebaseResponse.ok) {
    throw new GoogleFirebaseAuthError(503, 'FIREBASE_GOOGLE_SIGN_IN_FAILED',
      'Firebase could not complete Google sign-in. Check that the Google provider is enabled.');
  }

  const firebaseIdentity = await firebaseResponse.json();
  if (typeof firebaseIdentity.localId !== 'string' ||
      typeof firebaseIdentity.idToken !== 'string' ||
      typeof firebaseIdentity.refreshToken !== 'string') {
    throw new GoogleFirebaseAuthError(503, 'FIREBASE_GOOGLE_SIGN_IN_FAILED',
      'Firebase returned an incomplete Google sign-in response.');
  }

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(firebaseIdentity.idToken);
  } catch {
    throw new GoogleFirebaseAuthError(503, 'FIREBASE_GOOGLE_SIGN_IN_FAILED',
      'Firebase returned an invalid Google sign-in token.');
  }
  if (decodedToken.uid !== firebaseIdentity.localId ||
      decodedToken.email !== identity.email) {
    throw new GoogleFirebaseAuthError(401, 'FIREBASE_GOOGLE_IDENTITY_MISMATCH',
      'The Google and Firebase account identities do not match.');
  }

  const firebaseUser = await auth.getUser(decodedToken.uid);
  if (firebaseUser.disabled ||
      !firebaseUser.providerData.some(provider =>
        provider.providerId === 'google.com' && provider.uid === identity.sub)) {
    throw new GoogleFirebaseAuthError(403, 'FIREBASE_GOOGLE_ACCOUNT_INVALID',
      'The Firebase account is disabled or is not linked to this Google account.');
  }

  const userRef = firestore.collection('users').doc(firebaseUser.uid);
  let profile;
  await firestore.runTransaction(async transaction => {
    const snapshot = await transaction.get(userRef);
    const existing = snapshot.exists ? snapshot.data() : {};
    const learnerPermissions = ['home', 'learn', 'practiceQuiz'];
    const role = ['admin', 'learner'].includes(existing.role) ? existing.role : 'learner';
    const permissions = role === 'admin' && Array.isArray(existing.permissions) &&
      existing.permissions.every(permission => typeof permission === 'string')
      ? existing.permissions
      : learnerPermissions;
    profile = {
      uid: firebaseUser.uid,
      displayName: identity.name || firebaseUser.displayName || '',
      email: identity.email,
      username: existing.username || identity.email,
      role,
      permissions,
      updatedAt: new Date().toISOString()
    };
    transaction.set(userRef, profile, { merge: true });
  });

  return {
    profile,
    idToken: firebaseIdentity.idToken,
    refreshToken: firebaseIdentity.refreshToken
  };
}

module.exports = {
  GoogleFirebaseAuthError,
  signInGoogleUserWithFirebase
};
