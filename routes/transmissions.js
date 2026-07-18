/**
 * [ candy-e ] — ROUTES TRANSMISSIONS
 * Fichier : routes/transmissions.js
 *
 * Remplace modules/transmissions/transmissions.js (+ variante embarquée
 * utilisée par modules/dashboard/dashboard.js) et l'insert transmission
 * déclenché depuis modules/tournee/tournee.js.
 *
 * Rôles alignés sur transmissions_select/insert/update
 * (database/migrations/002_rls_policies.sql — pas de DELETE, comme en réel).
 */

'use strict';

const express = require('express');
const requireRole = require('../middleware/requireRole');
const { construireInsert } = require('../db/sql-builder');
const { AUDIT_ACTIONS } = require('../services/audit/audit.actions');

const router = express.Router();

const ROLES_LECTURE = [
  'super_admin', 'directeur_etablissement', 'cadre_sante', 'medecin', 'infirmiere',
  'aide_soignante', 'intervenant_soins_exterieur', 'secretaire',
];
const ROLES_ECRITURE = [
  'super_admin', 'cadre_sante', 'medecin', 'infirmiere', 'aide_soignante', 'intervenant_soins_exterieur',
];

const COLONNES_AUTORISEES = ['resident_id', 'type', 'priorite', 'contenu', 'cible_role'];

// GET /api/transmissions?patientId=&priorite=&type=&nonLus=true&limit=60
// GET /api/transmissions?recent=5 (variante dashboard, non lues uniquement)
router.get('/', requireRole(ROLES_LECTURE), async (req, res) => {
  const { patientId, priorite, type, nonLus, recent } = req.query;

  const conditions = [];
  const valeurs = [];
  const ajouter = (clause, valeur) => {
    valeurs.push(valeur);
    conditions.push(clause.replace('?', `$${valeurs.length}`));
  };

  if (patientId) ajouter('resident_id = ?', patientId);
  if (priorite) ajouter('priorite = ?', priorite);
  if (type) ajouter('type = ?', type);
  if (nonLus === 'true' || recent !== undefined) ajouter('lu = ?', false);

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limite = Number(recent || req.query.limit || 60) || 60;

  try {
    const { rows } = await req.dbClient.query(
      `SELECT t.*, CASE WHEN r.id IS NULL THEN NULL ELSE json_build_object('nom', r.nom, 'prenom', r.prenom) END AS patients
       FROM public.transmissions t LEFT JOIN public.residents r ON r.id = t.resident_id
       ${whereSql} ORDER BY t.created_at DESC LIMIT ${limite}`,
      valeurs
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireRole(ROLES_ECRITURE), async (req, res) => {
  try {
    const corps = { ...req.body, auteur_id: req.user.id };
    const { sql, valeurs } = construireInsert('transmissions', [...COLONNES_AUTORISEES, 'auteur_id'], corps);
    const { rows } = await req.dbClient.query(sql, valeurs);
    await req.audit({
      action: AUDIT_ACTIONS.TRANSMISSION_CREATED,
      resourceType: 'transmission',
      resourceId: rows[0].id,
      resourceLabel: `transmission #${rows[0].id} (résident #${rows[0].resident_id})`,
      newValues: rows[0],
      legalBasis: 'Art. 9(2)(h) RGPD',
    });
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// PATCH /api/transmissions/:id — usage principal : marquer lue ({ lu: true })
router.patch('/:id', requireRole(ROLES_ECRITURE), async (req, res) => {
  try {
    const avant = await req.dbClient.query('SELECT * FROM public.transmissions WHERE id = $1', [req.params.id]);
    if (!avant.rows[0]) return res.status(404).json({ error: 'Transmission introuvable' });

    const { lu } = req.body || {};
    const { rows } = await req.dbClient.query(
      'UPDATE public.transmissions SET lu = COALESCE($1, lu) WHERE id = $2 RETURNING *',
      [typeof lu === 'boolean' ? lu : null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Transmission introuvable' });
    await req.audit({
      action: AUDIT_ACTIONS.TRANSMISSION_UPDATED,
      resourceType: 'transmission',
      resourceId: rows[0].id,
      resourceLabel: `transmission #${rows[0].id} (résident #${rows[0].resident_id})`,
      oldValues: avant.rows[0],
      newValues: rows[0],
      legalBasis: 'Art. 9(2)(h) RGPD',
    });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
