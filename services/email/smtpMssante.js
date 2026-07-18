/**
 * [ candy-e ] — FACTEUR SMTP MSSANTÉ
 * Fichier : services/email/smtpMssante.js
 *
 * Contrainte ANS/PSC (EXI EDC PSC 102-6) : les notifications aux
 * professionnels de santé et les communications RGPD (Art. 33) doivent
 * transiter par un opérateur MSSanté agréé, jamais par un SMTP classique.
 * Paramètres d'opérateur fictifs tant qu'un vrai opérateur MSSanté n'est pas
 * référencé (cf. .env.example) — le contrat d'interface ne change pas.
 *
 * Warning au boot (jamais d'erreur fatale) si la config MSSanté est absente :
 * le canal classique doit rester opérationnel indépendamment. Config lue À
 * L'APPEL dans send() (jamais au chargement du module) pour rester
 * importable sans appel réseau.
 */

'use strict';

const nodemailer = require('nodemailer');

const MSSANTE_ENV_VARS = [
  'SMTP_MSSANTE_HOST',
  'SMTP_MSSANTE_PORT',
  'SMTP_MSSANTE_USER',
  'SMTP_MSSANTE_PASS',
  'SMTP_MSSANTE_FROM',
];

const varsManquantes = MSSANTE_ENV_VARS.filter((nom) => !process.env[nom]);
if (varsManquantes.length > 0) {
  console.warn(
    `[candy-e] [email:mssante] configuration MSSanté incomplète (${varsManquantes.join(', ')}) — ` +
    'les envois MSSanté échoueront tant que ces variables ne sont pas renseignées. Le canal classique reste opérationnel.'
  );
}

function chargerConfig() {
  const {
    SMTP_MSSANTE_HOST,
    SMTP_MSSANTE_PORT,
    SMTP_MSSANTE_USER,
    SMTP_MSSANTE_PASS,
    SMTP_MSSANTE_FROM,
    SMTP_MSSANTE_STARTTLS,
  } = process.env;

  if (!SMTP_MSSANTE_HOST || !SMTP_MSSANTE_USER || !SMTP_MSSANTE_PASS || !SMTP_MSSANTE_FROM) {
    throw new Error('[candy-e] [email:mssante] configuration SMTP MSSanté incomplète (SMTP_MSSANTE_*).');
  }

  return {
    host: SMTP_MSSANTE_HOST,
    port: Number(SMTP_MSSANTE_PORT) || 587,
    requireTLS: SMTP_MSSANTE_STARTTLS !== 'false',
    auth: { user: SMTP_MSSANTE_USER, pass: SMTP_MSSANTE_PASS },
    from: SMTP_MSSANTE_FROM,
  };
}

/**
 * @param {object} options
 * @param {string} options.to
 * @param {string} [options.from]
 * @param {string} options.subject
 * @param {string} options.body
 * @param {string} [options.bodyHtml]
 * @param {string} [options.type] - une valeur de EMAIL_TYPES, tracée dans le header X-Motif
 * @param {Function} [creerTransport] - injectable pour les tests (défaut : nodemailer.createTransport)
 * @returns {Promise<{ messageId: string }>}
 */
async function send({ to, from, subject, body, bodyHtml, type }, creerTransport = nodemailer.createTransport) {
  const config = chargerConfig();
  const transporteur = creerTransport({
    host: config.host,
    port: config.port,
    requireTLS: config.requireTLS,
    auth: config.auth,
    // Contrainte ANS/PSC : jamais de certificat non vérifié sur le canal MSSanté.
    tls: { rejectUnauthorized: true },
  });

  const info = await transporteur.sendMail({
    from: from || config.from,
    to,
    subject,
    text: body,
    html: bodyHtml,
    headers: {
      // Traçabilité ANS : canal utilisé et motif de l'envoi.
      'X-Canal': 'MSSante',
      'X-Motif': type || '',
    },
  });

  return { messageId: info.messageId };
}

module.exports = { send, chargerConfig };
