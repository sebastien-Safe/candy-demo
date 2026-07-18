/**
 * [ candy-e ] — ROUTES STATISTIQUES
 * Fichier : routes/stats.js
 *
 * Remplace modules/stats/stats.js : les 3 requêtes en Promise.all
 * (patients, consultations du mois, transmissions non lues) sont
 * regroupées en un seul aller-retour — la logique de calcul des stats
 * reste dans le module frontend, inchangée (seule la couche d'accès aux
 * données bouge).
 *
 * NB : le frontend actuel sélectionne des colonnes `urgence`/`lue` sur
 * transmissions qui n'existent pas dans le schéma réel (priorite/lu, cf.
 * database/migrations/001_init_schema.sql) — bug latent côté frontend,
 * corrigé au passage lors du remplacement de l'appel (étape 3).
 */

'use strict';

const express = require('express');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

const ROLES_LECTURE = [
  'super_admin', 'directeur_etablissement', 'cadre_sante', 'medecin', 'infirmiere',
  'aide_soignante', 'secretaire',
];

function debutDuMoisISO() {
  const maintenant = new Date();
  return new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

router.get('/', requireRole(ROLES_LECTURE), async (req, res) => {
  try {
    const [patients, consultations, transmissions] = await Promise.all([
      req.dbClient.query('SELECT id, actif, gir FROM public.residents'),
      req.dbClient.query(
        'SELECT id, date_consult, type_acte FROM public.consultations WHERE date_consult >= $1',
        [debutDuMoisISO()]
      ),
      req.dbClient.query('SELECT id, priorite, lu FROM public.transmissions WHERE lu = false'),
    ]);

    return res.json({
      patients: patients.rows,
      consultations: consultations.rows,
      transmissions: transmissions.rows,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
