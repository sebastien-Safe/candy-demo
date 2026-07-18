/**
 * [ candy-e ] — CLIENT POSTGRESQL (Clever Cloud)
 * Fichier : db/client.js
 *
 * Couche d'abstraction pour l'accès aux données via requêtes SQL
 * directes (SELECT/INSERT/UPDATE/DELETE). Strictement CRUD — ne gère
 * aucune authentification (cf.
 * middleware/auth.js pour la vérification de session, ajoutée séparément).
 *
 * Ce module est destiné à être utilisé côté serveur (server.js et futurs
 * routeurs /api/*), jamais depuis le navigateur : `pg` ne peut pas tourner
 * dans un contexte client.
 */

const { Pool } = require('pg');

const connectionString = process.env.POSTGRESQL_ADDON_URI || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    '[candy-e] Aucune chaîne de connexion PostgreSQL trouvée. ' +
    'Définissez POSTGRESQL_ADDON_URI (Clever Cloud) ou DATABASE_URL dans .env.'
  );
}

const pool = new Pool({ connectionString });

/**
 * Exécute une requête simple (hors contexte RLS utilisateur).
 * À réserver aux opérations qui n'ont pas besoin de RLS (santé du service,
 * scripts de migration/vérification).
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Exécute `fn(client)` dans une transaction où les GUC de session
 * app.current_user_id / app.current_role sont positionnées, pour que les
 * policies RLS réconciliées (cf. database/migrations/002_rls_policies.sql)
 * s'appliquent comme prévu.
 *
 * `userId`/`role` doivent provenir d'une identité déjà vérifiée (JWT valide,
 * cf. middleware/auth.js) — cette fonction ne vérifie rien elle-même : elle
 * fait confiance aux valeurs qu'on lui passe.
 *
 * @param {string|null} userId - UUID de l'utilisateur courant (ou null si inconnu)
 * @param {string} role - rôle métier (doit correspondre aux valeurs de profiles.role)
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
async function withUserContext(userId, role, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId ?? '']);
    await client.query('SELECT set_config($1, $2, true)', ['app.current_role', role ?? '']);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withUserContext };
