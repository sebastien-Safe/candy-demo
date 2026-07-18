/**
 * [ candy-e ] — JOURNALISATION DES ENVOIS D'EMAIL
 * Fichier : services/email/emailLogger.js
 *
 * Écrit dans database/migrations/010_create_email_logs.sql. Chaque tentative
 * d'envoi (succès ET échec) doit être tracée — traçabilité ANS/PSC pour le
 * canal MSSanté, preuve de notification pour le RGPD (Art. 33). Ne lève
 * jamais d'erreur : un défaut d'écriture du log ne doit pas faire échouer
 * l'envoi d'email lui-même (même principe que services/audit/audit.service.js).
 *
 * `query` n'est requis (db/client.js) qu'au premier appel réel de log(),
 * jamais au chargement du module — permet d'importer ce module sans
 * connexion PostgreSQL configurée, et d'injecter un mock dans les tests.
 */

'use strict';

let queryReel;
function obtenirQuery() {
  if (!queryReel) {
    ({ query: queryReel } = require('../../db/client'));
  }
  return queryReel;
}

/**
 * @param {object} entry
 * @param {string} entry.type - une valeur de EMAIL_TYPES
 * @param {string} entry.channel - 'mssante' | 'classic'
 * @param {string} entry.to
 * @param {string} [entry.subject]
 * @param {string} entry.status - 'success' | 'error'
 * @param {string} [entry.messageId]
 * @param {string} [entry.error]
 * @param {object} [entry.meta]
 * @param {Function} [query] - injectable pour les tests (défaut : db/client.js query())
 */
async function log({ type, channel, to, subject, status, messageId, error, meta }, query = obtenirQuery()) {
  try {
    await query(
      `INSERT INTO public.email_logs (
        email_type, channel, recipient, subject, status, message_id, error_message, meta
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        type,
        channel,
        to,
        subject ?? null,
        status,
        messageId ?? null,
        error ?? null,
        meta ? JSON.stringify(meta) : null,
      ]
    );
  } catch (err) {
    // Ne jamais faire échouer l'envoi à cause du log.
    console.error('[candy-e] [email] échec d\'écriture du log — envoi non tracé', {
      type,
      channel,
      status,
      error: err.message,
    });
  }
}

module.exports = { log };
