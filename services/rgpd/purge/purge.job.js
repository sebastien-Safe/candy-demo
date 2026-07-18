/**
 * [ candy-e ] — JOB DE PURGE RGPD
 * Fichier : services/rgpd/purge/purge.job.js
 *
 * Applique les règles de services/rgpd/purge/retention.config.js. Chaque
 * règle s'exécute indépendamment (une erreur sur l'une n'empêche pas les
 * autres) et est journalisée. Ne supprime JAMAIS un dossier résident
 * directement : DOSSIER_MEDICAL_ADULTE marque purge_status =
 * 'pending_dpo_approval', la suppression définitive reste une décision
 * humaine hors automatisation (cf. 007_purge_tracking.sql).
 *
 * Utilise `pool.query` (pas req.dbClient) : ce job tourne hors contexte
 * requête HTTP, sans GUC RLS à positionner — comparable à
 * db/client.js:query(), réservé aux opérations sans utilisateur courant.
 */

'use strict';

const { pool } = require('../../../db/client');
const { logAudit } = require('../../audit/audit.service');
const { AUDIT_ACTIONS } = require('../../audit/audit.actions');
const { notifyDpo } = require('../notifications/dpo.notify');

const ACTEUR_SYSTEME = {
  actorEmail: 'system@candy-e.internal',
  actorRole: 'system',
};

async function purgeAuditLogs() {
  const { rowCount } = await pool.query(`
    DELETE FROM public.audit_logs
    WHERE created_at < NOW() - INTERVAL '12 months'
      AND (details->>'linked_to_breach')::boolean IS NOT TRUE
  `);
  return rowCount ?? 0;
}

async function purgeResetTokens() {
  const { rowCount } = await pool.query(`
    UPDATE public.profiles
    SET reset_token_hash = NULL, reset_token_expires_at = NULL
    WHERE reset_token_hash IS NOT NULL
      AND reset_token_expires_at < NOW()
  `);
  return rowCount ?? 0;
}

async function purgeUserAccounts() {
  const { rowCount } = await pool.query(`
    DELETE FROM public.profiles
    WHERE account_closed_at IS NOT NULL
      AND account_closed_at < NOW() - INTERVAL '5 years'
  `);
  return rowCount ?? 0;
}

async function marquerResidentsEnAttenteDpo() {
  const { rows } = await pool.query(`
    UPDATE public.residents
    SET purge_scheduled_at = NOW(), purge_status = 'pending_dpo_approval'
    WHERE discharge_date IS NOT NULL
      AND discharge_date < NOW() - INTERVAL '20 years'
      AND purge_status IS NULL
    RETURNING id, nom, prenom
  `);

  for (const resident of rows) {
    await logAudit({
      ...ACTEUR_SYSTEME,
      action: AUDIT_ACTIONS.PURGE_SCHEDULED,
      resourceType: 'resident',
      resourceId: resident.id,
      resourceLabel: `${resident.nom} ${resident.prenom} (résident #${resident.id})`,
      legalBasis: 'Art. 5(1)(e) RGPD — limitation de la conservation',
    });
  }

  return rows.length;
}

async function executerRegle(rule, fn) {
  const debut = Date.now();
  try {
    const count = await fn();
    return { rule, count, error: null, durationMs: Date.now() - debut };
  } catch (err) {
    console.error(`[candy-e] [purge] échec règle ${rule}`, err.message);
    await logAudit({
      ...ACTEUR_SYSTEME,
      action: AUDIT_ACTIONS.PURGE_ERROR,
      resourceType: 'system',
      resourceLabel: rule,
      metadata: { error: err.message },
      success: false,
      errorMessage: err.message,
      legalBasis: 'Art. 5(1)(e) RGPD',
    });
    return { rule, count: 0, error: err.message, durationMs: Date.now() - debut };
  }
}

async function runPurgeJob() {
  console.log('[candy-e] [purge] démarrage du job de purge RGPD');
  const debut = Date.now();

  const resultats = [
    await executerRegle('AUDIT_LOGS', purgeAuditLogs),
    await executerRegle('RESET_TOKENS', purgeResetTokens),
    await executerRegle('USER_ACCOUNT', purgeUserAccounts),
    await executerRegle('DOSSIER_MEDICAL_ADULTE', marquerResidentsEnAttenteDpo),
  ];

  const dureeMs = Date.now() - debut;
  const succes = resultats.every((r) => !r.error);

  await logAudit({
    ...ACTEUR_SYSTEME,
    action: AUDIT_ACTIONS.PURGE_EXECUTED,
    resourceType: 'system',
    resourceLabel: 'Job de purge automatique RGPD',
    metadata: { resultats, dureeMs },
    success: succes,
    legalBasis: 'Art. 5(1)(e) RGPD — limitation de la conservation',
  });

  console.log('[candy-e] [purge] job terminé', JSON.stringify(resultats));

  const residentsEnAttente = resultats.find((r) => r.rule === 'DOSSIER_MEDICAL_ADULTE');
  if (residentsEnAttente && residentsEnAttente.count > 0) {
    await notifyDpo({
      subject: 'C@NDY-e — Dossiers résidents en attente de purge DPO',
      body: `${residentsEnAttente.count} dossier(s) résident(s) ont atteint leur délai légal de conservation (20 ans après sortie). Validation requise dans le tableau de bord DPO avant suppression définitive.`,
    });
  }

  return resultats;
}

module.exports = { runPurgeJob };
