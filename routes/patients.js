/**
 * [ candy-e ] — ROUTES RÉSIDENTS (patients)
 * Fichier : routes/patients.js
 *
 * Fournit une API REST classique pour la ressource résidents, appelée
 * par le frontend. Le chemin d'URL reste `/api/patients`
 * (diff minimal côté frontend) alors que la table réelle est
 * `public.residents` (renommée — cf. database/migrations/001_init_schema.sql) :
 * la traduction se fait uniquement ici.
 *
 * Rôles alignés sur residents_select/insert/update/delete
 * (database/migrations/002_rls_policies.sql) — la RLS reste la garde-fou
 * de fond ; requireRole() donne un 403 explicite plutôt qu'un résultat
 * vide/une écriture silencieusement filtrée.
 */

'use strict';

const express = require('express');
const requireRole = require('../middleware/requireRole');
const { construireInsert, construireUpdate } = require('../db/sql-builder');
const { AUDIT_ACTIONS } = require('../services/audit/audit.actions');

const router = express.Router();

const ROLES_LECTURE = [
  'super_admin', 'directeur_etablissement', 'cadre_sante', 'medecin',
  'infirmiere', 'aide_soignante', 'intervenant_soins_exterieur', 'secretaire',
];
const ROLES_ECRITURE = ['super_admin', 'cadre_sante', 'medecin', 'infirmiere'];
const ROLES_SUPPRESSION = ['super_admin'];
// discharge_date.write uniquement — jamais patient.write générique (cf.
// route POST /:id/sortie ci-dessous, seule voie d'accès pour ce rôle).
const ROLES_SORTIE = ['super_admin', 'directeur_etablissement'];

function labelResident(resident) {
  if (!resident) return undefined;
  return `${resident.nom ?? ''} ${resident.prenom ?? ''} (résident #${resident.id})`.trim();
}

const COLONNES_AUTORISEES = [
  'nom', 'prenom', 'date_naissance', 'sexe', 'situation', 'nb_enfants', 'profession',
  'telephone', 'email', 'adresse', 'code_postal', 'ville', 'groupe_sanguin', 'numero_secu',
  'medecin_id', 'medecin_nom', 'allergies', 'poids', 'taille', 'tension_sys', 'tension_dia',
  'spo2', 'rythme_cardiaque', 'actif', 'gir',
];

// GET /api/patients?actif=true&fields=id,nom,prenom
router.get('/', requireRole(ROLES_LECTURE), async (req, res) => {
  const { actif, fields } = req.query;
  const colonnes = fields
    ? fields.split(',').map((c) => c.trim()).filter((c) => c === 'id' || COLONNES_AUTORISEES.includes(c)).join(', ') || 'id'
    : '*';

  const conditions = [];
  const valeurs = [];
  if (actif !== undefined) {
    conditions.push(`actif = $${valeurs.length + 1}`);
    valeurs.push(actif === 'true');
  }
  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await req.dbClient.query(
      `SELECT ${colonnes} FROM public.residents ${whereSql} ORDER BY nom`,
      valeurs
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/patients/:id
router.get('/:id', requireRole(ROLES_LECTURE), async (req, res) => {
  try {
    const { rows } = await req.dbClient.query('SELECT * FROM public.residents WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Résident introuvable' });
    await req.audit({
      action: AUDIT_ACTIONS.RESIDENT_VIEWED,
      resourceType: 'resident',
      resourceId: rows[0].id,
      resourceLabel: labelResident(rows[0]),
      legalBasis: 'Art. 9(2)(h) RGPD',
    });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/patients
router.post('/', requireRole(ROLES_ECRITURE), async (req, res) => {
  try {
    // created_by vient toujours du JWT vérifié, jamais du corps client
    // (écrase silencieusement toute valeur envoyée par l'appelant).
    const corps = { ...req.body, created_by: req.user.id };
    const { sql, valeurs } = construireInsert('residents', [...COLONNES_AUTORISEES, 'created_by'], corps);
    const { rows } = await req.dbClient.query(sql, valeurs);
    await req.audit({
      action: AUDIT_ACTIONS.RESIDENT_CREATED,
      resourceType: 'resident',
      resourceId: rows[0].id,
      resourceLabel: labelResident(rows[0]),
      newValues: rows[0],
      legalBasis: 'Art. 9(2)(h) RGPD',
    });
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// PATCH /api/patients/:id
router.patch('/:id', requireRole(ROLES_ECRITURE), async (req, res) => {
  try {
    const avant = await req.dbClient.query('SELECT * FROM public.residents WHERE id = $1', [req.params.id]);
    if (!avant.rows[0]) return res.status(404).json({ error: 'Résident introuvable' });

    const { sql, valeurs } = construireUpdate('residents', COLONNES_AUTORISEES, req.body, 'id', req.params.id);
    const { rows } = await req.dbClient.query(sql, valeurs);
    await req.audit({
      action: AUDIT_ACTIONS.RESIDENT_UPDATED,
      resourceType: 'resident',
      resourceId: rows[0].id,
      resourceLabel: labelResident(rows[0]),
      oldValues: avant.rows[0],
      newValues: rows[0],
      legalBasis: 'Art. 9(2)(h) RGPD',
    });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/patients/:id/sortie — déclare la sortie/le décès d'un résident.
// Route dédiée, jamais le PATCH générique : c'est la seule voie qui pose
// discharge_date, et directeur_etablissement n'a accès qu'à celle-ci (il
// n'est pas dans ROLES_ECRITURE, donc pas d'accès au PATCH générique).
// Déclenche le compte à rebours de conservation légale de 20 ans (cf.
// services/rgpd/purge/retention.config.js).
router.post('/:id/sortie', requireRole(ROLES_SORTIE), async (req, res) => {
  const dischargeDate = req.body?.discharge_date;
  if (!dischargeDate || Number.isNaN(Date.parse(dischargeDate))) {
    return res.status(400).json({ error: 'discharge_date requis (date valide)' });
  }
  if (new Date(dischargeDate) > new Date()) {
    return res.status(400).json({ error: 'discharge_date ne peut pas être dans le futur' });
  }

  try {
    const avant = await req.dbClient.query('SELECT * FROM public.residents WHERE id = $1', [req.params.id]);
    if (!avant.rows[0]) return res.status(404).json({ error: 'Résident introuvable' });

    const { rows } = await req.dbClient.query(
      'UPDATE public.residents SET discharge_date = $1, actif = false WHERE id = $2 RETURNING *',
      [dischargeDate, req.params.id]
    );

    await req.audit({
      action: AUDIT_ACTIONS.RESIDENT_ARCHIVED,
      resourceType: 'resident',
      resourceId: rows[0].id,
      resourceLabel: labelResident(rows[0]),
      oldValues: avant.rows[0],
      newValues: rows[0],
      legalBasis: 'Art. R. 1112-7 CSP — déclenche le délai de conservation légale de 20 ans',
    });

    return res.json(rows[0]);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// DELETE /api/patients/:id — suppression physique réservée admin (le frontend
// n'a pas de bouton de suppression aujourd'hui, cf. rls-transposition.md).
router.delete('/:id', requireRole(ROLES_SUPPRESSION), async (req, res) => {
  try {
    const avant = await req.dbClient.query('SELECT * FROM public.residents WHERE id = $1', [req.params.id]);
    if (!avant.rows[0]) return res.status(404).json({ error: 'Résident introuvable' });

    const { rowCount } = await req.dbClient.query('DELETE FROM public.residents WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Résident introuvable' });
    await req.audit({
      action: AUDIT_ACTIONS.RESIDENT_DELETED,
      resourceType: 'resident',
      resourceId: req.params.id,
      resourceLabel: labelResident(avant.rows[0]),
      oldValues: avant.rows[0],
      legalBasis: 'Art. 17 RGPD',
    });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
