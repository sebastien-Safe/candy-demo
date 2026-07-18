/**
 * [ candy-e ] — NOTIFICATION DPO
 * Fichier : services/rgpd/notifications/dpo.notify.js
 *
 * Aucun service SMTP n'est configuré dans ce dépôt (même limitation que
 * routes/auth.js pour le lien de réinitialisation de mot de passe) — la
 * notification est journalisée côté serveur en attendant un choix de
 * fournisseur transactionnel. DPO_EMAIL (cf. .env.example) est déjà lu ici
 * pour que le branchement d'un vrai envoi n'ait qu'à remplacer le
 * console.log par un appel SMTP, sans toucher aux appelants.
 */

'use strict';

async function notifyDpo({ subject, body }) {
  const destinataire = process.env.DPO_EMAIL || '(DPO_EMAIL non configuré)';
  console.log(`[candy-e] [TODO email DPO -> ${destinataire}] ${subject}\n${body}`);
}

module.exports = { notifyDpo };
