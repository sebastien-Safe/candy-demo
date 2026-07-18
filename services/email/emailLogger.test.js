/**
 * [ candy-e ] — TESTS : journalisation des envois d'email
 * Fichier : services/email/emailLogger.test.js
 *
 * `query` (db/client.js) est injecté en 2e argument de log() — aucune
 * connexion PostgreSQL réelle requise pour `npm test`.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { log } = require('./emailLogger');

test('log — insère une entrée de succès avec les bons paramètres', async () => {
  const appels = [];
  const query = async (sql, params) => { appels.push({ sql, params }); return { rows: [] }; };

  await log(
    { type: 'notification_ps', channel: 'mssante', to: 'ps@structure.mssante.fr', subject: 'Sujet', status: 'success', messageId: 'mss-1', meta: { userId: '42' } },
    query
  );

  assert.equal(appels.length, 1);
  assert.match(appels[0].sql, /INSERT INTO public\.email_logs/);
  const [type, channel, to, subject, status, messageId, error, meta] = appels[0].params;
  assert.equal(type, 'notification_ps');
  assert.equal(channel, 'mssante');
  assert.equal(to, 'ps@structure.mssante.fr');
  assert.equal(subject, 'Sujet');
  assert.equal(status, 'success');
  assert.equal(messageId, 'mss-1');
  assert.equal(error, null);
  assert.equal(meta, JSON.stringify({ userId: '42' }));
});

test('log — insère une entrée d\'échec avec error_message renseigné', async () => {
  const appels = [];
  const query = async (sql, params) => { appels.push({ sql, params }); return { rows: [] }; };

  await log(
    { type: 'rgpd_violation', channel: 'mssante', to: 'personne@example.fr', subject: 'Violation', status: 'error', error: 'opérateur MSSanté indisponible' },
    query
  );

  const [, , , , status, messageId, error] = appels[0].params;
  assert.equal(status, 'error');
  assert.equal(messageId, null);
  assert.equal(error, 'opérateur MSSanté indisponible');
});

test('log — un échec d\'INSERT ne lève jamais d\'erreur (console.error seulement)', async () => {
  const query = async () => { throw new Error('connexion PostgreSQL perdue'); };
  const erreursConsole = [];
  const originalConsoleError = console.error;
  console.error = (...args) => erreursConsole.push(args);

  try {
    await assert.doesNotReject(() => log(
      { type: 'usage_metier', channel: 'classic', to: 'interne@candy-e.fr', status: 'success', messageId: 'x' },
      query
    ));
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(erreursConsole.length, 1);
});
