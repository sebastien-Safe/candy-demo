/**
 * [ candy-e ] — POINT D'ENTRÉE UNIQUE D'ENVOI D'EMAIL
 * Fichier : services/email/emailRouter.js
 *
 * Règle de routage : un type d'email listé dans MSSANTE_TYPES (notifications
 * PS, RGPD_ACCES, RGPD_VIOLATION — cf. services/email/emailTypes.js) part
 * obligatoirement par le facteur MSSanté (contrainte ANS/PSC EXI EDC PSC
 * 102-6 ; RGPD Art. 33 pour les violations de données). Tout autre type part
 * par le facteur SMTP classique. En cas d'échec du canal MSSanté, AUCUNE
 * bascule silencieuse vers le classique : une EmailDeliveryError explicite
 * est levée après journalisation. Chaque tentative (succès ET échec) est
 * journalisée via emailLogger avant de retourner ou de lever.
 */

'use strict';

const { requiertCanalMssante } = require('./emailTypes');
const smtpClassicDefaut = require('./smtpBrevo');
const smtpMssanteDefaut = require('./smtpMssante');
const emailLoggerDefaut = require('./emailLogger');

class EmailDeliveryError extends Error {
  constructor(channel, reason) {
    super(`Échec d'envoi email (canal ${channel}): ${reason}`);
    this.name = 'EmailDeliveryError';
    this.channel = channel;
    this.reason = reason;
  }
}

/**
 * @param {object} options
 * @param {string} options.type - une valeur de EMAIL_TYPES
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.body
 * @param {string} [options.bodyHtml]
 * @param {object} [options.meta]
 * @param {object} [dependances] - injectable pour les tests
 * @param {{send: Function}} [dependances.facteurClassic]
 * @param {{send: Function}} [dependances.facteurMssante]
 * @param {{log: Function}} [dependances.logger]
 * @returns {Promise<{ success: boolean, channel: 'mssante'|'classic', messageId: string }>}
 */
async function sendEmail(options, dependances = {}) {
  const {
    facteurClassic = smtpClassicDefaut,
    facteurMssante = smtpMssanteDefaut,
    logger = emailLoggerDefaut,
  } = dependances;

  const { type, to, subject, body, bodyHtml, meta } = options;
  const channel = requiertCanalMssante(type) ? 'mssante' : 'classic';

  let messageId = null;
  let status = 'error';
  let errorMessage = null;
  let erreurALever = null;

  try {
    const facteur = channel === 'mssante' ? facteurMssante : facteurClassic;
    const resultat = await facteur.send({ to, subject, body, bodyHtml, type });
    messageId = resultat.messageId;
    status = 'success';
  } catch (err) {
    errorMessage = err.message;
    // Jamais de bascule silencieuse vers le classique en cas d'échec MSSanté.
    erreurALever = new EmailDeliveryError(channel, err.message);
  } finally {
    await logger.log({ type, channel, to, subject, status, messageId, error: errorMessage, meta });
  }

  if (erreurALever) {
    throw erreurALever;
  }

  return { success: true, channel, messageId };
}

module.exports = { sendEmail, EmailDeliveryError };
