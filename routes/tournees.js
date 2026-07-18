/**
 * [ candy-e ] — ROUTES TOURNÉES DE SOINS
 * Fichier : routes/tournees.js
 *
 * Remplace modules/tournee/tournee.js : `.from('tournees_soins')`.
 *
 * Rôles alignés sur tournees_select/insert/update
 * (database/migrations/002_rls_policies.sql — pas de DELETE, comme en réel).
 */

'use strict';

const express = require('express');
const requireRole = require('../middleware/requireRole');
const { construireInsert, construireUpdate } = require('../db/sql-builder');
const { AUDIT_ACTIONS } = require('../services/audit/audit.actions');

const router = express.Router();

const ROLES_LECTURE = ['super_admin', 'cadre_sante', 'medecin', 'infirmiere', 'aide_soignante'];
const ROLES_ECRITURE = ['super_admin', 'infirmiere', 'aide_soignante'];

const COLONNES_AUTORISEES = [
  'resident_id', 'date_soin', 'type_tournee', 'type_toilette', 'habillage', 'prevention_escarres',
  'repas', 'nb_verres_eau', 'collation_prise', 'mode_elimination', 'urines', 'selles',
  'protection_type', 'etat_sommeil', 'protection_etat', 'transmission',
];

// GET /api/tournees_soins?patientId=&date=YYYY-MM-DD
router.get('/', requireRole(ROLES_LECTURE), async (req, res) => {
  const { patientId, date } = req.query;
  if (!patientId || !date) {
    return res.status(400).json({ error: 'patientId et date requis' });
  }
  try {
    const { rows } = await req.dbClient.query(
      'SELECT * FROM public.tournees_soins WHERE resident_id = $1 AND date_soin = $2',
      [patientId, date]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', requireRole(ROLES_ECRITURE), async (req, res) => {
  try {
    const corps = { ...req.body, saisie_par: req.user.id };
    const { sql, valeurs } = construireInsert('tournees_soins', [...COLONNES_AUTORISEES, 'saisie_par'], corps);
    const { rows } = await req.dbClient.query(sql, valeurs);
    await req.audit({
      action: AUDIT_ACTIONS.TOURNEE_CREATED,
      resourceType: 'tournee_soin',
      resourceId: rows[0].id,
      resourceLabel: `tournée #${rows[0].id} (résident #${rows[0].resident_id})`,
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
    const avant = await req.dbClient.query('SELECT * FROM public.tournees_soins WHERE id = $1', [req.params.id]);
    if (!avant.rows[0]) return res.status(404).json({ error: 'Introuvable' });

    const { sql, valeurs } = construireUpdate('tournees_soins', COLONNES_AUTORISEES, req.body, 'id', req.params.id);
    const { rows } = await req.dbClient.query(sql, valeurs);
    if (!rows[0]) return res.status(404).json({ error: 'Introuvable' });
    await req.audit({
      action: AUDIT_ACTIONS.TOURNEE_UPDATED,
      resourceType: 'tournee_soin',
      resourceId: rows[0].id,
      resourceLabel: `tournée #${rows[0].id} (résident #${rows[0].resident_id})`,
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
