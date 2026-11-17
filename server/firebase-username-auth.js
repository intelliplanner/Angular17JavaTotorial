const crypto = require('crypto');

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

class FirebaseUserError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'FirebaseUserError';
    this.status = status;
    this.code = code;
  }
}

function normalizeUsername(username) {
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username.trim())) {
    throw new FirebaseUserError(400, 'INVALID_USERNAME',
      'Use a username of 3-32 letters, numbers, dots, underscores, or hyphens.');
  }
  return username.trim().toLowerCase();
}

function validatePassword(password) {
  if (typeof password !== 'string' ||
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH) {
    throw new FirebaseUserError(400, 'INVALID_PASSWORD',
      `Passwords must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`);
  }
}

function validateLoginPassword(password) {
  if (typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    throw new FirebaseUserError(400, 'INVALID_PASSWORD', 'Enter a valid password.');
  }
}

function createUsernameEmailAlias(normalizedUsername, projectId) {
  const usernameHash = crypto.createHash('sha256').update(normalizedUsername).digest('hex');
  return `user-${usernameHash}@${projectId}.firebaseapp.com`;
}

function createPasswordDigest(password, secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) {
    throw new FirebaseUserError(503, 'PASSWORD_UNIQUENESS_UNAVAILABLE',
      'Password uniqueness is not configured on the server.');
  }
  return crypto.createHmac('sha256', secret).update(password).digest('hex');
}

function createFirebaseUsernameAuth({
  auth,
  firestore,
  projectId,
  apiKey,
  passwordUniquenessSecret,
  fetchImpl = globalThis.fetch
}) {
  async function signIn(username, password) {
    const enteredUsername = typeof username === 'string' ? username.trim() : '';
    const normalizedUsername = normalizeUsername(username);
    validateLoginPassword(password);
    if (!apiKey || typeof fetchImpl !== 'function') {
      throw new FirebaseUserError(503, 'FIREBASE_AUTH_UNAVAILABLE',
        'Firebase username authentication is not configured on the server.');
    }

    const usernameSnapshot = await firestore.collection('usernames').doc(normalizedUsername).get();
    let uid = usernameSnapshot.exists ? usernameSnapshot.get('uid') : '';
    if (typeof uid !== 'string' || !uid) {
      uid = await findProfileUid(firestore, normalizedUsername, enteredUsername);
    }
    if (typeof uid !== 'string' || !uid) {
      throw new FirebaseUserError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
    }

    const profileSnapshot = await firestore.collection('users').doc(uid).get();
    const profile = profileSnapshot.exists ? profileSnapshot.data() : null;
    if (!isFirebaseLoginProfile(profile, normalizedUsername)) {
      throw new FirebaseUserError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
    }

    let firebaseUser;
    try {
      firebaseUser = await auth.getUser(uid);
    } catch {
      throw new FirebaseUserError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
    }
    if (!firebaseUser.email) {
      throw new FirebaseUserError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
    }

    const response = await fetchImpl(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: firebaseUser.email, password, returnSecureToken: true })
      }
    );
    if (!response.ok) {
      throw new FirebaseUserError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
    }
    const result = await response.json();
    if (result.localId !== uid || !result.idToken || !result.refreshToken) {
      throw new FirebaseUserError(401, 'INVALID_CREDENTIALS', 'Invalid username or password.');
    }
    return {
      localId: result.localId,
      idToken: result.idToken,
      refreshToken: result.refreshToken,
      user: {
        username: profile.username,
        role: profile.role,
        permissions: profile.permissions
      }
    };
  }

  async function findProfileUid(firestore, normalizedUsername, enteredUsername) {
    const users = firestore.collection('users');
    for (const [field, value] of [
      ['usernameNormalized', normalizedUsername],
      ['username', enteredUsername]
    ]) {
      const result = await users.where(field, '==', value).limit(2).get();
      if (result.docs.length === 1) return result.docs[0].id;
      if (result.docs.length > 1) return '';
    }
    return '';
  }

  function isFirebaseLoginProfile(profile, normalizedUsername) {
    if (!profile ||
        typeof profile.username !== 'string' ||
        !['admin', 'learner'].includes(profile.role) ||
        !Array.isArray(profile.permissions) ||
        !profile.permissions.every(permission => typeof permission === 'string')) {
      return false;
    }
    try {
      return normalizeUsername(profile.username) === normalizedUsername &&
        (!profile.usernameNormalized || profile.usernameNormalized === normalizedUsername);
    } catch {
      return false;
    }
  }

  async function createUser({ username, password, role }) {
    const normalizedUsername = normalizeUsername(username);
    validatePassword(password);
    if (!['learner', 'admin'].includes(role)) {
      throw new FirebaseUserError(400, 'INVALID_ROLE', 'Choose a valid user role.');
    }

    const digest = createPasswordDigest(password, passwordUniquenessSecret);
    const usernameRef = firestore.collection('usernames').doc(normalizedUsername);
    const passwordRef = firestore.collection('passwordUniqueness').doc(digest);
    const [usernameSnapshot, passwordSnapshot] = await Promise.all([
      usernameRef.get(),
      passwordRef.get()
    ]);
    if (usernameSnapshot.exists) {
      throw new FirebaseUserError(409, 'USERNAME_EXISTS', 'That username is already in use.');
    }
    if (passwordSnapshot.exists) {
      throw new FirebaseUserError(409, 'PASSWORD_EXISTS',
        'That password is already assigned to another newly created user.');
    }

    const permissions = role === 'admin' ? ['*'] : ['home', 'learn', 'practiceQuiz'];
    const publicProfile = { username: username.trim(), role, permissions };
    const email = createUsernameEmailAlias(normalizedUsername, projectId);
    let firebaseUser;
    try {
      firebaseUser = await auth.createUser({
        email,
        password,
        emailVerified: true,
        displayName: username.trim()
      });
    } catch (error) {
      if (error && error.code === 'auth/email-already-exists') {
        throw new FirebaseUserError(409, 'USERNAME_EXISTS', 'That username is already in use.');
      }
      throw error;
    }

    try {
      await firestore.runTransaction(async transaction => {
        const [currentUsername, currentPassword] = await Promise.all([
          transaction.get(usernameRef),
          transaction.get(passwordRef)
        ]);
        if (currentUsername.exists) {
          throw new FirebaseUserError(409, 'USERNAME_EXISTS', 'That username is already in use.');
        }
        if (currentPassword.exists) {
          throw new FirebaseUserError(409, 'PASSWORD_EXISTS',
            'That password is already assigned to another newly created user.');
        }
        transaction.create(usernameRef, {
          uid: firebaseUser.uid,
          username: username.trim(),
          createdAt: new Date().toISOString()
        });
        transaction.create(passwordRef, {
          uid: firebaseUser.uid,
          createdAt: new Date().toISOString()
        });
        transaction.create(firestore.collection('users').doc(firebaseUser.uid), {
          ...publicProfile,
          usernameNormalized: normalizedUsername
        });
      });
    } catch (error) {
      try {
        await auth.deleteUser(firebaseUser.uid);
      } catch (rollbackError) {
        console.error('Could not roll back Firebase Auth user after profile creation failed:', rollbackError);
      }
      throw error;
    }

    return { ...publicProfile, firebaseUid: firebaseUser.uid };
  }

  return { signIn, createUser };
}

module.exports = {
  FirebaseUserError,
  createFirebaseUsernameAuth,
  createPasswordDigest,
  createUsernameEmailAlias,
  normalizeUsername,
  validatePassword
};
