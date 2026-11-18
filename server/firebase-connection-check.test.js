const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyFirebaseAdminConnection } = require('./firebase-connection-check');

test('verifies Admin SDK writes and removes its temporary connection record', async () => {
  const operations = [];
  const firestore = {
    collection: collection => ({
      doc: id => ({
        create: async data => operations.push(['create', collection, id, data]),
        delete: async () => operations.push(['delete', collection, id])
      })
    })
  };

  await verifyFirebaseAdminConnection(firestore);

  assert.equal(operations.length, 2);
  assert.equal(operations[0][0], 'create');
  assert.equal(operations[1][0], 'delete');
  assert.equal(operations[0][1], 'connectionChecks');
  assert.equal(operations[0][2], operations[1][2]);
});
