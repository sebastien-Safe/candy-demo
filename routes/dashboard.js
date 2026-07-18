/**
 * [ candy-e ] — ROUTES TABLEAU DE BORD
 * Fichier : routes/dashboard.js
 *
 * Remplace modules/dashboard/dashboard.js : 4 comptages + 3 listes
 * récentes (RDV du jour, dernières notes de suivi, dernières
 * consultations), chacune avec la relation embarquée patients(nom,prenom)
 * répliquée par JOIN + json_build_object. Regroupées en un seul aller-
 * retour (même logique que routes/stats.js).
 */

'use strict';

const express = require('express');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

const ROLES_LECTURE = [
  'super_admin', 'directeur_etablissement', 'cadre_sante', 'medecin', 'infirmiere',
  'aide_soignante', 'secretaire',
];

const PATIENT_EMBARQUE = "CASE WHEN r.id IS NULL THEN NULL ELSE json_build_object('nom', r.nom, 'prenom', r.prenom) END AS patients";

router.get('/', requireRole(ROLES_LECTURE), async (req, res) => {
  const aujourdHui = new Date().toISOString().slice(0, 10);

  try {
    const [
      patientsActifs,
      totalConsultations,
      agendaPlanifie,
      ordonnancesActives,
      agendaDuJour,
      notesRecentes,
      consultationsRecentes,
    ] = await Promise.all([
      req.dbClient.query("SELECT count(*)::int AS n FROM public.residents WHERE actif = true"),
      req.dbClient.query('SELECT count(*)::int AS n FROM public.consultations'),
      req.dbClient.query("SELECT count(*)::int AS n FROM public.agenda WHERE statut = 'planifie'"),
      req.dbClient.query("SELECT count(*)::int AS n FROM public.ordonnances WHERE statut = 'active'"),
      req.dbClient.query(
        `SELECT a.*, ${PATIENT_EMBARQUE} FROM public.agenda a LEFT JOIN public.residents r ON r.id = a.resident_id
         WHERE a.date_rdv >= $1 AND a.date_rdv <= $2 ORDER BY a.date_rdv`,
        [`${aujourdHui}T00:00:00`, `${aujourdHui}T23:59:59`]
      ),
      req.dbClient.query(
        `SELECT n.id, n.contenu, n.updated_at, ${PATIENT_EMBARQUE}
         FROM public.notes_suivi n LEFT JOIN public.residents r ON r.id = n.resident_id
         ORDER BY n.updated_at DESC LIMIT 5`
      ),
      req.dbClient.query(
        `SELECT c.id, c.date_consult, c.type_acte, c.titre, c.notes, ${PATIENT_EMBARQUE}
         FROM public.consultations c LEFT JOIN public.residents r ON r.id = c.resident_id
         ORDER BY c.date_consult DESC LIMIT 5`
      ),
    ]);

    return res.json({
      compteurs: {
        patientsActifs: patientsActifs.rows[0].n,
        totalConsultations: totalConsultations.rows[0].n,
        agendaPlanifie: agendaPlanifie.rows[0].n,
        ordonnancesActives: ordonnancesActives.rows[0].n,
      },
      agendaDuJour: agendaDuJour.rows,
      notesRecentes: notesRecentes.rows,
      consultationsRecentes: consultationsRecentes.rows,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
