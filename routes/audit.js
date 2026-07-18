/**
 * [ candy-e ] — ROUTES JOURNAL D'AUDIT
 * Fichier : routes/audit.js
 *
 * Remplace modules/admin/admin.js : `.from('audit_logs')`. Lecture seule,
 * réservée aux admins et au DPO (aucune policy INSERT applicative n'existe —
 * seule log_action() peut écrire).
 */

'use strict';

const express = require('express');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.use(requireRole(['super_admin', 'dpo']));

router.get('/', async (req, res) => {
  try {
    const { rows } = await req.dbClient.query(
      `SELECT id, action, table_name, user_role, details, created_at
       FROM public.audit_logs ORDER BY created_at DESC LIMIT 50`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
