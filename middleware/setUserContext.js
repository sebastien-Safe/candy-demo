/**
 * [ candy-e ] — MIDDLEWARE DE CONTEXTE UTILISATEUR (RLS)
 * Fichier : middleware/setUserContext.js
 *
 * À chaîner APRÈS middleware/auth.js (qui pose req.user). Ouvre une
 * connexion dédiée du pool pg, positionne les GUC de session
 * app.current_user_id / app.current_role attendus par les policies RLS
 * réconciliées, et attache le client à req.dbClient pour que le routeur
 * l'utilise dans la même transaction.
 *
 * Simplification assumée pour ce middleware minimal : la transaction est
 * validée (COMMIT) à la fin de la réponse quel que soit son statut HTTP ;
 * un rollback explicite en cas d'erreur métier reste à la charge de chaque
 * route (req.dbClient.query('ROLLBACK') avant de renvoyer une erreur), et
 * n'est pas géré automatiquement ici.
 */

const { pool } = require('../db/client');

async function setUserContext(req, res, next) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', req.user?.id ?? '']);
    await client.query('SELECT set_config($1, $2, true)', ['app.current_role', req.user?.role ?? '']);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    return next(err);
  }

  req.dbClient = client;

  res.on('finish', () => {
    client.query('COMMIT')
      .catch(() => client.query('ROLLBACK').catch(() => {}))
      .finally(() => client.release());
  });

  return next();
}

module.exports = setUserContext;
