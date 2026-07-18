/**
 * [ candy-e ] — TESTS : routeur d'emails
 * Fichier : services/email/emailRouter.test.js
 *
 * Facteurs et logger entièrement mockés (injectés en 2e argument de
 * sendEmail) — aucun appel réseau ni PostgreSQL réel requis pour `npm test`.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { sendEmail, EmailDeliveryError } = require('./emailRouter');
const { EMAIL_TYPES } = require('./emailTypes');

function fauxLogger() {
  const appels = [];
  return { appels, log: async (entree) => { appels.push(entree); } };
}

test('sendEmail — notification_ps utilise le facteur MSSanté', async () => {
  const facteurMssante = { send: async () => ({ messageId: 'mss-1' }) };
  const facteurClassic = { send: async () => { throw new Error('ne doit jamais être appelé'); } };
  const logger = fauxLogger();

  const resultat = await sendEmail(
    { type: EMAIL_TYPES.NOTIFICATION_PS, to: 'ps@structure.mssante.fr', subject: 'Sujet', body: 'Corps' },
    { facteurMssante, facteurClassic, logger }
  );

  assert.equal(resultat.channel, 'mssante');
  assert.equal(resultat.success, true);
  assert.equal(resultat.messageId, 'mss-1');
  assert.equal(logger.appels[0].status, 'success');
});

test('sendEmail — alerte_technique et usage_metier utilisent le facteur classique', async () => {
  const facteurClassic = { send: async () => ({ messageId: 'classic-1' }) };
  const facteurMssante = { send: async () => { throw new Error('ne doit jamais être appelé'); } };

  for (const type of [EMAIL_TYPES.ALERTE_TECHNIQUE, EMAIL_TYPES.USAGE_METIER]) {
    const logger = fauxLogger();
    const resultat = await sendEmail(
      { type, to: 'interne@candy-e.fr', subject: 'Sujet', body: 'Corps' },
      { facteurClassic, facteurMssante, logger }
    );
    assert.equal(resultat.channel, 'classic');
    assert.equal(resultat.messageId, 'classic-1');
  }
});

test('sendEmail — rgpd_acces et rgpd_violation utilisent le facteur MSSanté', async () => {
  const facteurMssante = { send: async () => ({ messageId: 'mss-rgpd' }) };
  const facteurClassic = { send: async () => { throw new Error('ne doit jamais être appelé'); } };

  for (const type of [EMAIL_TYPES.RGPD_ACCES, EMAIL_TYPES.RGPD_VIOLATION]) {
    const logger = fauxLogger();
    const resultat = await sendEmail(
      { type, to: 'personne@example.fr', subject: 'Sujet', body: 'Corps' },
      { facteurMssante, facteurClassic, logger }
    );
    assert.equal(resultat.channel, 'mssante');
    assert.equal(resultat.messageId, 'mss-rgpd');
  }
});

test('sendEmail — rgpd_violation : un échec MSSanté ne bascule jamais vers le classique', async () => {
  let facteurClassicAppele = false;
  const facteurMssante = { send: async () => { throw new Error('opérateur MSSanté indisponible'); } };
  const facteurClassic = { send: async () => { facteurClassicAppele = true; return { messageId: 'ne-doit-pas-arriver' }; } };
  const logger = fauxLogger();

  await assert.rejects(
    () => sendEmail(
      { type: EMAIL_TYPES.RGPD_VIOLATION, to: 'personne@example.fr', subject: 'Violation', body: 'Corps' },
      { facteurMssante, facteurClassic, logger }
    ),
    EmailDeliveryError
  );

  assert.equal(facteurClassicAppele, false, 'le facteur classique ne doit jamais être appelé après un échec MSSanté');
  assert.equal(logger.appels[0].status, 'error');
  assert.equal(logger.appels[0].channel, 'mssante');
});

test('sendEmail — échec MSSanté : logger.log() est appelé avant que l\'erreur ne remonte', async () => {
  const facteurMssante = { send: async () => { throw new Error('boom'); } };
  const facteurClassic = { send: async () => ({ messageId: 'x' }) };
  const logger = fauxLogger();

  await assert.rejects(() => sendEmail(
    { type: EMAIL_TYPES.NOTIFICATION_PS, to: 'ps@structure.mssante.fr', subject: 'Sujet', body: 'Corps' },
    { facteurMssante, facteurClassic, logger }
  ));

  assert.equal(logger.appels.length, 1);
  assert.equal(logger.appels[0].error, 'boom');
});

test('sendEmail — erreur levée est bien une EmailDeliveryError avec channel/reason', async () => {
  const facteurClassic = { send: async () => { throw new Error('SMTP classique indisponible'); } };
  const facteurMssante = { send: async () => ({ messageId: 'x' }) };
  const logger = fauxLogger();

  try {
    await sendEmail(
      { type: EMAIL_TYPES.ALERTE_TECHNIQUE, to: 'oncall@candy-e.fr', subject: 'Sujet', body: 'Corps' },
      { facteurClassic, facteurMssante, logger }
    );
    assert.fail('devait lever une EmailDeliveryError');
  } catch (err) {
    assert.ok(err instanceof EmailDeliveryError);
    assert.equal(err.channel, 'classic');
    assert.equal(err.reason, 'SMTP classique indisponible');
  }
});
