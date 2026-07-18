/**
 * [ candy-e ] — FACTEUR SMTP CLASSIQUE (MailPace / Clever Cloud)
 * Fichier : services/email/smtpClassic.js
 *
 * Utilisé pour les types hors périmètre MSSanté (alertes techniques, usages
 * métier internes — cf. services/email/emailTypes.js). Config lue À L'APPEL
 * (jamais au chargement du module) pour que le module reste importable sans
 * effet de bord tant qu'aucun envoi n'est déclenché.
 */

'use strict';

const nodemailer = require('nodemailer');

function chargerConfig() {
  const {
    SMTP_CLASSIC_HOST,
    SMTP_CLASSIC_PORT,
    SMTP_CLASSIC_USER,
    SMTP_CLASSIC_PASS,
    SMTP_CLASSIC_FROM,
    SMTP_CLASSIC_TLS,
  } = process.env;

  if (!SMTP_CLASSIC_HOST || !SMTP_CLASSIC_USER || !SMTP_CLASSIC_PASS || !SMTP_CLASSIC_FROM) {
    throw new Error('[candy-e] [email:classic] configuration SMTP classique incomplète (SMTP_CLASSIC_*).');
  }

  return {
    host: SMTP_CLASSIC_HOST,
    port: Number(SMTP_CLASSIC_PORT) || 465,
    secure: SMTP_CLASSIC_TLS !== 'false',
    auth: { user: SMTP_CLASSIC_USER, pass: SMTP_CLASSIC_PASS },
    from: SMTP_CLASSIC_FROM,
  };
}

/**
 * @param {object} options
 * @param {string} options.to
 * @param {string} [options.from]
 * @param {string} options.subject
 * @param {string} options.body
 * @param {string} [options.bodyHtml]
 * @param {Function} [creerTransport] - injectable pour les tests (défaut : nodemailer.createTransport)
 * @returns {Promise<{ messageId: string }>}
 */
async function send({ to, from, subject, body, bodyHtml }, creerTransport = nodemailer.createTransport) {
  const config = chargerConfig();
  const transporteur = creerTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  const info = await transporteur.sendMail({
    from: from || config.from,
    to,
    subject,
    text: body,
    html: bodyHtml,
  });

  return { messageId: info.messageId };
}

module.exports = { send, chargerConfig };
