/**
 * [ candy-e ] — ROUTES AGENDA
 * Fichier : routes/agenda.js
 *
 * Remplace modules/agenda/agenda.js (+ variante utilisée par
 * modules/dashboard/dashboard.js) : `.from('agenda')`. La relation
 * embarquée PostgREST `patients(nom, prenom)` est répliquée par un JOIN +
 * json_build_object pour garder la même forme de réponse côté frontend.
 *
 * Rôles alignés sur agenda_select/insert/update/delete
 * (database/migrations/002_rls_policies.sql).
 */

'use strict';

const express = require('express');
const requireRole = require('../middleware/requireRole');
const { construireInsert, construireUpdate } = require('../db/sql-builder');
const { AUDIT_ACTIONS } = require('../services/audit/audit.actions');

const router = express.Router();

const ROLES_LECTURE = [
  'super_admin', 'directeur_etablissement', 'cadre_sante', 'medecin', 'infirmiere',
  'aide_soignante', 'secretaire',
];
const ROLES_ECRITURE = ['super_admin', 'cadre_sante', 'medecin', 'secretaire'];
const ROLES_SUPPRESSION = ['super_admin', 'medecin', 'secretaire'];

const COLONNES_AUTORISEES = [
  'resident_id', 'medecin_id', 'date_rdv', 'duree_minutes', 'type_rdv', 'titre', 'notes', 'statut',
];

const SELECT_AVEC_PATIENT = `
  a.*,
  CASE WHEN r.id IS NULL THEN NULL ELSE json_build_object('nom', r.nom, 'prenom', r.prenom) END AS patients
`;

// GET /api/agenda?date=YYYY-MM-DD  (journée complète, comme _loadAgenda ;
// aussi réutilisé par routes/dashboard.js pour le RDV du jour)
router.get('/', requireRole(ROLES_LECTURE), async (req, res) => {
  const { date } = req.query;

  try {
    if (!date) return res.status(400).json({ error: 'date requis (YYYY-MM-DD)' });

    const { rows } = await req.dbClient.query(
      `SELECT ${SELECT_AVEC_PATIENT} FROM public.agenda a LEFT JOIN public.residents r ON r.id = a.resident_id
       WHERE a.date_rdv >= $1 AND a.date_rdv <= $2 ORDER BY a.date_rdv`,
      [`${date}T00:00:00`, `${date}T23:59:59`]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireRole(ROLES_ECRITURE), async (req, res) => {
  try {
    const corps = { ...req.body, created_by: req.user.id };
    const { sql, valeurs } = construireInsert('agenda', [...COLONNES_AUTORISEES, 'created_by'], corps);
    const { rows } = await req.dbClient.query(sql, valeurs);
    await req.audit({
      action: AUDIT_ACTIONS.AGENDA_CREATED,
      resourceType: 'agenda',
      resourceId: rows[0].id,
      resourceLabel: `rendez-vous #${rows[0].id} (résident #${rows[0].resident_id})`,
      newValues: rows[0],
      legalBasis: 'Art. 9(2)(h) RGPD',
    });
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', requireRole(ROLES_ECRITURE), async (req, res) => {
  try {
    const avant = await req.dbClient.query('SELECT * FROM public.agenda WHERE id = $1', [req.params.id]);
    if (!avant.rows[0]) return res.status(404).json({ error: 'Rendez-vous introuvable' });

    const { sql, valeurs } = construireUpdate('agenda', COLONNES_AUTORISEES, req.body, 'id', req.params.id);
    const { rows } = await req.dbClient.query(sql, valeurs);
    if (!rows[0]) return res.status(404).json({ error: 'Rendez-vous introuvable' });
    await req.audit({
      action: AUDIT_ACTIONS.AGENDA_UPDATED,
      resourceType: 'agenda',
      resourceId: rows[0].id,
      resourceLabel: `rendez-vous #${rows[0].id} (résident #${rows[0].resident_id})`,
      oldValues: avant.rows[0],
      newValues: rows[0],
      legalBasis: 'Art. 9(2)(h) RGPD',
    });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireRole(ROLES_SUPPRESSION), async (req, res) => {
  try {
    const avant = await req.dbClient.query('SELECT * FROM public.agenda WHERE id = $1', [req.params.id]);
    if (!avant.rows[0]) return res.status(404).json({ error: 'Rendez-vous introuvable' });

    const { rowCount } = await req.dbClient.query('DELETE FROM public.agenda WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Rendez-vous introuvable' });
    await req.audit({
      action: AUDIT_ACTIONS.AGENDA_DELETED,
      resourceType: 'agenda',
      resourceId: req.params.id,
      resourceLabel: `rendez-vous #${req.params.id} (résident #${avant.rows[0].resident_id})`,
      oldValues: avant.rows[0],
      legalBasis: 'Art. 9(2)(h) RGPD',
    });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
