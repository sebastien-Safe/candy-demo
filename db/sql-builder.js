/**
 * [ candy-e ] — CONSTRUCTION SQL DYNAMIQUE (INSERT/UPDATE), PARAMÉTRÉE
 * Fichier : db/sql-builder.js
 *
 * Les routes /api/* acceptent un corps JSON dont les clés correspondent aux
 * colonnes de la table (héritage du style PostgREST côté frontend). On ne
 * peut jamais interpoler les clés
 * du corps de requête directement dans du SQL : chaque appelant fournit une
 * allowlist explicite des colonnes réellement modifiables (colonnesAutorisees) ;
 * toute autre clé du corps est silencieusement ignorée, jamais transmise au SQL.
 */

function construireInsert(table, colonnesAutorisees, corps, colonnesRetour = '*') {
  const cles = Object.keys(corps || {}).filter((c) => colonnesAutorisees.includes(c));
  if (cles.length === 0) {
    throw new Error(`Aucune colonne valide à insérer dans ${table}`);
  }
  const placeholders = cles.map((_, i) => `$${i + 1}`);
  const valeurs = cles.map((c) => corps[c]);
  const sql = `INSERT INTO public.${table} (${cles.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING ${colonnesRetour}`;
  return { sql, valeurs };
}

function construireUpdate(table, colonnesAutorisees, corps, idColonne, idValeur, colonnesRetour = '*') {
  const cles = Object.keys(corps || {}).filter((c) => colonnesAutorisees.includes(c));
  if (cles.length === 0) {
    throw new Error(`Aucune colonne valide à modifier dans ${table}`);
  }
  const assignations = cles.map((c, i) => `${c} = $${i + 1}`);
  const valeurs = cles.map((c) => corps[c]);
  valeurs.push(idValeur);
  const sql = `UPDATE public.${table} SET ${assignations.join(', ')} WHERE ${idColonne} = $${valeurs.length} RETURNING ${colonnesRetour}`;
  return { sql, valeurs };
}

module.exports = { construireInsert, construireUpdate };
