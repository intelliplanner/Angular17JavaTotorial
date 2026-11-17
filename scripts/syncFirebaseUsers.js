const fs = require('fs');
const path = require('path');
const { applicationDefault, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { syncFirebaseUserProfiles } = require('../server/firebase-user-profile-sync');

const usersFilePath = path.join(__dirname, '..', 'data', 'users.json');
const projectId = process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT;

async function main() {
  if (!projectId) {
    throw new Error('Set FIREBASE_PROJECT_ID to the Firebase project receiving user profiles.');
  }

  const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
  const app = initializeApp({
    credential: applicationDefault(),
    projectId
  }, 'user-profile-sync');
  const firestore = getFirestore(app);
  const result = await syncFirebaseUserProfiles(firestore, users);
  console.log(`Synced ${result.synced} of ${result.total} user profile(s) and username index entries. Credential fields were excluded.`);
}

main().catch(error => {
  console.error('Could not sync Firebase user profiles:', error.message);
  process.exitCode = 1;
});
