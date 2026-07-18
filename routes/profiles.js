/**
 * [ candy-e ] — ROUTES PROFILS (personnel)
 * Fichier : routes/profiles.js
 *
 * Remplace modules/admin/admin.js : `.from('profiles')` (liste, activer/
 * désactiver) et `rpc('delete_user_by_id', ...)` (aucune fonction SQL de ce
 * nom n'existe dans database/migrations/ — implémentée ici comme logique de
 * route, pas comme fonction Postgres). La création de compte
 * (`auth.admin.createUser`) est traitée dans routes/auth.js (POST /users),
 * pas ici — elle touche à la fois profiles et le hachage du mot de passe.
 *
 * Rôles alignés sur database/migrations/008_role_matrix_migration.sql :
 * super_admin (CRUD complet) et directeur_etablissement (lecture +
 * désactivation uniquement — SC.SSI/IAM.92, cf. commentaire ci-dessous).
 * La policy update_admin interdit déjà en base la modification de son
 * propre rôle par un admin ; on refuse aussi ici la suppression de son
 * propre compte (défense en profondeur, message clair plutôt qu'un 403
 * RLS opaque).
 */

'use strict';

const express = require('express');
const requireRole = require('../middleware/requireRole');
const { construireUpdate } = require('../db/sql-builder');
const { AUDIT_ACTIONS } = require('../services/audit/audit.actions');

const router = express.Router();

// SC.SSI/IAM.92 : les comptes à privilèges (super_admin) doivent être
// clairement séparés des comptes métier. Création de compte et changement
// de rôle restent exclusifs à super_admin ; directeur_etablissement peut
// seulement consulter la liste et désactiver un compte (départ d'un
// salarié) — jamais en créer, ni changer un rôle, ni réactiver.
const ROLES_LECTURE = ['super_admin', 'directeur_etablissement'];
const ROLES_SUPPRESSION = ['super_admin'];
const COLONNES_AUTORISEES = [
  'prenom', 'nom', 'role', 'specialite', 'rpps', 'telephone',
  'cabinet_nom', 'cabinet_adresse', 'cabinet_cp', 'cabinet_ville', 'actif',
];

function labelProfil(profil) {
  return `${profil.prenom ?? ''} ${profil.nom ?? ''} (compte #${profil.id})`.trim();
}

// GET /api/profiles
router.get('/', requireRole(ROLES_LECTURE), async (req, res) => {
  try {
    const { rows } = await req.dbClient.query(
      `SELECT id, email, prenom, nom, role, specialite, actif, created_at
       FROM public.profiles ORDER BY created_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/profiles/:id
router.patch('/:id', requireRole(ROLES_LECTURE), async (req, res) => {
  if (req.params.id === req.user.id && 'role' in (req.body || {})) {
    return res.status(403).json({ error: 'Impossible de modifier son propre rôle' });
  }

  const corpsKeys = Object.keys(req.body || {});
  if (req.user.role === 'directeur_etablissement' && (corpsKeys.length !== 1 || corpsKeys[0] !== 'actif' || req.body.actif !== false)) {
    return res.status(403).json({
      error: 'La direction d\'établissement ne peut que désactiver un compte (actif: false), pas le modifier ni le réactiver',
    });
  }

  try {
    const avant = await req.dbClient.query('SELECT * FROM public.profiles WHERE id = $1', [req.params.id]);
    if (!avant.rows[0]) return res.status(404).json({ error: 'Profil introuvable' });

    const { sql, valeurs } = construireUpdate('profiles', COLONNES_AUTORISEES, req.body, 'id', req.params.id);
    const { rows } = await req.dbClient.query(sql, valeurs);
    if (!rows[0]) return res.status(404).json({ error: 'Profil introuvable' });

    let action = AUDIT_ACTIONS.USER_UPDATED;
    if ('role' in req.body && avant.rows[0].role !== rows[0].role) {
      action = AUDIT_ACTIONS.USER_ROLE_CHANGED;
    } else if ('actif' in req.body && avant.rows[0].actif !== rows[0].actif) {
      action = rows[0].actif ? AUDIT_ACTIONS.USER_ACTIVATED : AUDIT_ACTIONS.USER_DEACTIVATED;
    }

    await req.audit({
      action,
      resourceType: 'profile',
      resourceId: rows[0].id,
      resourceLabel: labelProfil(rows[0]),
      oldValues: avant.rows[0],
      newValues: rows[0],
      legalBasis: 'Art. 6(1)(f) RGPD — intérêt légitime (sécurisation du SI)',
    });

    return res.json(rows[0]);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// DELETE /api/profiles/:id
router.delete('/:id', requireRole(ROLES_SUPPRESSION), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(403).json({ error: 'Impossible de supprimer son propre compte' });
  }

  try {
    const avant = await req.dbClient.query('SELECT * FROM public.profiles WHERE id = $1', [req.params.id]);
    if (!avant.rows[0]) return res.status(404).json({ error: 'Profil introuvable' });

    const { rowCount } = await req.dbClient.query('DELETE FROM public.profiles WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Profil introuvable' });

    await req.audit({
      action: AUDIT_ACTIONS.USER_DELETED,
      resourceType: 'profile',
      resourceId: req.params.id,
      resourceLabel: labelProfil(avant.rows[0]),
      oldValues: avant.rows[0],
      legalBasis: 'Art. 6(1)(f) RGPD — intérêt légitime (sécurisation du SI)',
    });

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
