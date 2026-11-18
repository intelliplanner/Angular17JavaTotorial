const crypto = require('crypto');

async function verifyFirebaseAdminConnection(firestore) {
  const reference = firestore.collection('connectionChecks').doc(crypto.randomUUID());
  await reference.create({ checkedAt: new Date().toISOString() });
  await reference.delete();
}

module.exports = { verifyFirebaseAdminConnection };
