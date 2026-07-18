/**
 * [ candy-e ] — FACTEUR BREVO (canal classique)
 * Fichier : services/email/smtpBrevo.js
 *
 * Fournisseur du canal classique (cf. services/email/emailRouter.js) — utilisé
 * pour les types hors périmètre MSSanté (services/email/emailTypes.js).
 * Ne doit JAMAIS recevoir un type listé dans MSSANTE_TYPES : cette garantie
 * est portée par emailRouter.js, pas par ce fichier.
 *
 * Double mode : SMTP en dev/staging (BREVO_SMTP_*), API REST Brevo en
 * production (BREVO_API_KEY) — cf. .env.example. Config lue À L'APPEL
 * (jamais au chargement du module), même principe que smtpClassic.js.
 */

'use strict';

const nodemailer = require('nodemailer');
const { BrevoClient } = require('@getbrevo/brevo');

function chargerExpediteur() {
  const { EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME } = process.env;
  if (!EMAIL_FROM_ADDRESS) {
    throw new Error('[candy-e] [email:brevo] EMAIL_FROM_ADDRESS manquant.');
  }
  return { email: EMAIL_FROM_ADDRESS, name: EMAIL_FROM_NAME || 'C@NDY-e' };
}

async function sendViaSmtp({ to, subject, body, bodyHtml }, creerTransport) {
  const { BREVO_SMTP_HOST, BREVO_SMTP_PORT, BREVO_SMTP_USER, BREVO_SMTP_PASS } = process.env;
  if (!BREVO_SMTP_USER || !BREVO_SMTP_PASS) {
    throw new Error('[candy-e] [email:brevo] configuration SMTP incomplète (BREVO_SMTP_USER/BREVO_SMTP_PASS).');
  }

  const expediteur = chargerExpediteur();
  const transporteur = creerTransport({
    host: BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
    port: Number(BREVO_SMTP_PORT) || 587,
    secure: false,
    requireTLS: true,
    auth: { user: BREVO_SMTP_USER, pass: BREVO_SMTP_PASS },
  });

  const info = await transporteur.sendMail({
    from: `"${expediteur.name}" <${expediteur.email}>`,
    to,
    subject,
    text: body,
    html: bodyHtml,
  });

  return { messageId: info.messageId };
}

async function sendViaApi({ to, subject, body, bodyHtml }) {
  const { BREVO_API_KEY } = process.env;
  if (!BREVO_API_KEY) {
    throw new Error('[candy-e] [email:brevo] configuration API incomplète (BREVO_API_KEY).');
  }

  const expediteur = chargerExpediteur();
  const client = new BrevoClient({ apiKey: BREVO_API_KEY });

  const resultat = await client.transactionalEmails.sendTransacEmail({
    sender: expediteur,
    to: [{ email: to }],
    subject,
    textContent: body,
    htmlContent: bodyHtml,
  });

  return { messageId: resultat?.messageId || null };
}

/**
 * @param {object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.body
 * @param {string} [options.bodyHtml]
 * @param {Function} [creerTransport] - injectable pour les tests (mode SMTP uniquement)
 * @returns {Promise<{ messageId: string }>}
 */
async function send({ to, subject, body, bodyHtml }, creerTransport = nodemailer.createTransport) {
  if (process.env.NODE_ENV === 'production') {
    return sendViaApi({ to, subject, body, bodyHtml });
  }
  return sendViaSmtp({ to, subject, body, bodyHtml }, creerTransport);
}

module.exports = { send };
