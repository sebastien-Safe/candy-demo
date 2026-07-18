/**
 * [ candy-e ] — SCHEDULER DU JOB DE PURGE RGPD
 * Fichier : services/rgpd/purge/purge.scheduler.js
 *
 * L'état "ai-je déjà tourné aujourd'hui ?" est persisté dans la table
 * purge_runs (007_purge_tracking.sql), pas en mémoire process : un
 * setInterval seul ne survit pas à un redémarrage (déploiement, crash,
 * scaling Clever Cloud) et ne garantit pas l'unicité d'exécution si
 * plusieurs instances tournent en parallèle.
 *
 * Toutes les 30 minutes (et immédiatement au démarrage, pour rattraper un
 * jour manqué après redémarrage), on tente un UPDATE conditionnel sur
 * purge_runs : seule la fenêtre 02:00-23:59 Europe/Paris et "pas encore
 * couru aujourd'hui" satisfont le WHERE. Le verrouillage de ligne Postgres
 * garantit qu'une seule transaction concurrente réussit ce claim — les
 * autres instances voient 0 ligne affectée et passent leur tour.
 */

'use strict';

const { pool } = require('../../../db/client');
const { runPurgeJob } = require('./purge.job');

const INTERVALLE_VERIFICATION_MS = 30 * 60 * 1000;

async function tenterClaimDuJour() {
  const { rows } = await pool.query(`
    UPDATE public.purge_runs
    SET last_run_at = NOW(), last_status = 'running'
    WHERE id = 1
      AND (last_run_at IS NULL OR (last_run_at AT TIME ZONE 'Europe/Paris')::date < (NOW() AT TIME ZONE 'Europe/Paris')::date)
      AND (NOW() AT TIME ZONE 'Europe/Paris')::time >= TIME '02:00'
    RETURNING id
  `);
  return rows.length > 0;
}

async function verifierEtExecuterSiNecessaire() {
  try {
    const gagne = await tenterClaimDuJour();
    if (!gagne) return;

    const resultats = await runPurgeJob();
    const succes = resultats.every((r) => !r.error);

    await pool.query(
      `UPDATE public.purge_runs SET last_status = $1, last_results = $2, updated_at = NOW() WHERE id = 1`,
      [succes ? 'success' : 'partial_error', JSON.stringify(resultats)]
    );
  } catch (err) {
    console.error('[candy-e] [purge] échec critique du scheduler', err.message);
    await pool.query(
      `UPDATE public.purge_runs SET last_status = 'error', updated_at = NOW() WHERE id = 1`
    ).catch(() => {});
  }
}

function schedulePurgeJob() {
  if (process.env.PURGE_JOB_ENABLED === 'false') {
    console.log('[candy-e] [purge] job désactivé (PURGE_JOB_ENABLED=false)');
    return;
  }

  verifierEtExecuterSiNecessaire();
  setInterval(verifierEtExecuterSiNecessaire, INTERVALLE_VERIFICATION_MS);

  console.log('[candy-e] [purge] scheduler démarré (vérification en base toutes les 30 min, fenêtre 02:00 Europe/Paris)');
}

module.exports = { schedulePurgeJob };
