/**
 * [ candy-e ] — ROUTES RGPD
 * Fichier : routes/rgpd.js
 *
 * Exemple d'utilisation de services/email/emailRouter.js pour une
 * déclaration de violation de données (RGPD Art. 33) : le type
 * RGPD_VIOLATION force le canal MSSanté (cf. emailTypes.js) — un échec
 * d'envoi renvoie une erreur explicite, jamais une bascule silencieuse vers
 * le SMTP classique.
 */

'use strict';

const express = require('express');
const requireRole = require('../middleware/requireRole');
const { sendEmail, EmailDeliveryError } = require('../services/email/emailRouter');
const { EMAIL_TYPES } = require('../services/email/emailTypes');
const { AUDIT_ACTIONS } = require('../services/audit/audit.actions');
const { genererExportResident } = require('../services/pdf/residentExport.pdf');
const { genererDeclarationCnil } = require('../services/pdf/breachDeclaration.pdf');

const ACTION_PAR_TYPE_DEMANDE = {
  acces: AUDIT_ACTIONS.RGPD_ACCESS_REQUEST,
  rectification: AUDIT_ACTIONS.RGPD_RECTIFICATION_REQUEST,
  effacement: AUDIT_ACTIONS.RGPD_ERASURE_REQUEST,
  portabilite: AUDIT_ACTIONS.RGPD_PORTABILITY_REQUEST,
  // opposition/limitation n'ont pas d'action dédiée dans le référentiel
  // existant — le type exact reste tracé dans metadata.
  opposition: AUDIT_ACTIONS.RGPD_ACCESS_REQUEST,
  limitation: AUDIT_ACTIONS.RGPD_ACCESS_REQUEST,
};

const router = express.Router();

router.use(requireRole(['super_admin', 'dpo']));

const COLONNES_REGISTRE = [
  'nom', 'finalite', 'base_legale', 'categories_donnees', 'personnes_concernees',
  'destinataires', 'sous_traitants', 'duree_conservation', 'transferts_hors_ue',
  'mesures_securite', 'responsable_traitement', 'dpo_contact',
];

// GET /api/rgpd/dashboard — vue d'ensemble : remplace le simple
// console.log de dpo.notify.js par un signal visible en continu dans l'UI
// plutôt qu'un événement ponctuel perdu dans les logs serveur.
router.get('/dashboard', async (req, res) => {
  try {
    const [purgeRun, pending, auditStats, breaches, requests, registre] = await Promise.all([
      req.dbClient.query('SELECT * FROM public.purge_runs WHERE id = 1'),
      req.dbClient.query(
        `SELECT id, nom, prenom, discharge_date, purge_scheduled_at
         FROM public.residents WHERE purge_status = 'pending_dpo_approval' ORDER BY purge_scheduled_at`
      ),
      req.dbClient.query(
        `SELECT
           count(*)::int AS total,
           count(*) FILTER (WHERE success = false)::int AS echecs,
           count(DISTINCT user_id)::int AS acteurs_uniques
         FROM public.audit_logs WHERE created_at > NOW() - INTERVAL '30 days'`
      ),
      req.dbClient.query(`SELECT * FROM public.data_breaches WHERE statut <> 'cloturee' ORDER BY declared_at DESC`),
      req.dbClient.query(
        `SELECT
           count(*) FILTER (WHERE statut NOT IN ('traitee','rejetee'))::int AS ouvertes,
           count(*) FILTER (WHERE statut NOT IN ('traitee','rejetee') AND date_echeance < NOW())::int AS en_retard
         FROM public.rgpd_requests`
      ),
      req.dbClient.query(
        `SELECT (SELECT count(*) FROM public.registre_traitements)::int AS nb_traitements,
                (SELECT max(updated_at) FROM public.registre_traitements) AS derniere_maj`
      ),
    ]);

    return res.json({
      purge: {
        lastRun: purgeRun.rows[0] ?? null,
        pendingApprovals: pending.rows,
      },
      auditStats30j: auditStats.rows[0],
      breachesOuvertes: breaches.rows,
      requests: requests.rows[0],
      registre: registre.rows[0],
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/rgpd/registre — registre des traitements (Art. 30), jamais un
// fichier statique : lu en base pour rester à jour au fil du projet.
router.get('/registre', async (req, res) => {
  try {
    const [traitements, meta] = await Promise.all([
      req.dbClient.query('SELECT * FROM public.registre_traitements ORDER BY code'),
      req.dbClient.query('SELECT note_aipd, updated_at FROM public.registre_meta WHERE id = 1'),
    ]);
    return res.json({ traitements: traitements.rows, noteAipd: meta.rows[0] ?? null });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/rgpd/registre/:code — édition d'une entrée du registre.
router.patch('/registre/:code', async (req, res) => {
  try {
    const avant = await req.dbClient.query('SELECT * FROM public.registre_traitements WHERE code = $1', [req.params.code]);
    if (!avant.rows[0]) return res.status(404).json({ error: 'Traitement introuvable' });

    const cles = Object.keys(req.body || {}).filter((c) => COLONNES_REGISTRE.includes(c));
    if (cles.length === 0) return res.status(400).json({ error: 'Aucune colonne valide à modifier' });

    const assignations = cles.map((c, i) => `${c} = $${i + 1}`);
    const valeurs = cles.map((c) => req.body[c]);
    valeurs.push(req.user.id, req.params.code);

    const { rows } = await req.dbClient.query(
      `UPDATE public.registre_traitements SET ${assignations.join(', ')}, updated_by = $${valeurs.length - 1}
       WHERE code = $${valeurs.length} RETURNING *`,
      valeurs
    );

    await req.audit({
      action: AUDIT_ACTIONS.REGISTRE_UPDATED,
      resourceType: 'registre_traitement',
      resourceId: rows[0].id,
      resourceLabel: `${rows[0].code} — ${rows[0].nom}`,
      oldValues: avant.rows[0],
      newValues: rows[0],
      legalBasis: 'Art. 30 RGPD',
    });

    return res.json(rows[0]);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ── File d'attente de purge (dossiers résidents en attente, Art. 5(1)(e)) ──

// GET /api/rgpd/purge/pending
router.get('/purge/pending', async (req, res) => {
  try {
    const { rows } = await req.dbClient.query(
      `SELECT id, nom, prenom, discharge_date, purge_scheduled_at
       FROM public.residents WHERE purge_status = 'pending_dpo_approval'
       ORDER BY purge_scheduled_at`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/rgpd/purge/:residentId/approve — suppression définitive et
// irréversible du dossier résident. Garde-fous : (1) re-vérification
// serveur du délai légal (jamais confiance dans purge_status seul), (2)
// jeton de confirmation explicite envoyé par le modal deux-clics du
// frontend — ce n'est pas juste une confirmation UI cosmétique, le serveur
// refuse sans lui. chutes.resident_id n'a pas de CASCADE (contrairement aux
// autres tables, cf. 001_init_schema.sql) : supprimé explicitement avant
// residents dans la même transaction.
router.post('/purge/:residentId/approve', async (req, res) => {
  if (req.body?.confirmation !== 'SUPPRESSION_DEFINITIVE') {
    return res.status(400).json({ error: 'Confirmation explicite requise (confirmation: "SUPPRESSION_DEFINITIVE")' });
  }

  try {
    const avant = await req.dbClient.query(
      `SELECT * FROM public.residents
       WHERE id = $1 AND purge_status = 'pending_dpo_approval'
         AND discharge_date IS NOT NULL AND discharge_date < NOW() - INTERVAL '20 years'`,
      [req.params.residentId]
    );
    if (!avant.rows[0]) {
      return res.status(400).json({ error: 'Dossier introuvable, non éligible, ou délai légal de 20 ans non encore atteint' });
    }

    await req.dbClient.query('DELETE FROM public.chutes WHERE resident_id = $1', [req.params.residentId]);
    await req.dbClient.query('DELETE FROM public.residents WHERE id = $1', [req.params.residentId]);

    await req.audit({
      action: AUDIT_ACTIONS.RESIDENT_PURGE_APPROVED,
      resourceType: 'resident',
      resourceId: req.params.residentId,
      resourceLabel: `${avant.rows[0].nom} ${avant.rows[0].prenom} (résident #${req.params.residentId})`,
      oldValues: avant.rows[0],
      legalBasis: 'Art. 5(1)(e) RGPD — limitation de la conservation, délai légal de 20 ans atteint',
    });

    return res.status(204).send();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/rgpd/purge/:residentId/reject — le dossier reste en base,
// purge_status passe à 'rejected' (statut terminal — le job de purge ne le
// reproposera pas automatiquement, cf. purge.job.js:marquerResidentsEnAttenteDpo
// dont le WHERE exige purge_status IS NULL). Reconsidération = intervention
// manuelle en base, volontairement pas automatisée.
router.post('/purge/:residentId/reject', async (req, res) => {
  try {
    const { rows } = await req.dbClient.query(
      `UPDATE public.residents SET purge_status = 'rejected'
       WHERE id = $1 AND purge_status = 'pending_dpo_approval' RETURNING *`,
      [req.params.residentId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Dossier introuvable ou non en attente' });

    await req.audit({
      action: AUDIT_ACTIONS.RESIDENT_PURGE_REJECTED,
      resourceType: 'resident',
      resourceId: rows[0].id,
      resourceLabel: `${rows[0].nom} ${rows[0].prenom} (résident #${rows[0].id})`,
      newValues: rows[0],
      legalBasis: 'Art. 5(1)(e) RGPD',
    });

    return res.json(rows[0]);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ── Demandes d'exercice de droits (Art. 15-22) ──────────────────────────────

// GET /api/rgpd/requests?statut=
router.get('/requests', async (req, res) => {
  const { statut } = req.query;
  try {
    const { rows } = statut
      ? await req.dbClient.query('SELECT * FROM public.rgpd_requests WHERE statut = $1 ORDER BY date_echeance', [statut])
      : await req.dbClient.query('SELECT * FROM public.rgpd_requests ORDER BY date_echeance');
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/rgpd/requests
router.post('/requests', async (req, res) => {
  const { type, residentId, demandeurNom, demandeurEmail, description } = req.body || {};
  if (!type || !demandeurNom || !ACTION_PAR_TYPE_DEMANDE[type]) {
    return res.status(400).json({ error: 'type (acces|rectification|effacement|portabilite|opposition|limitation) et demandeurNom requis' });
  }

  try {
    const { rows } = await req.dbClient.query(
      `INSERT INTO public.rgpd_requests (type, resident_id, demandeur_nom, demandeur_email, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [type, residentId ?? null, demandeurNom, demandeurEmail ?? null, description ?? null]
    );

    await req.audit({
      action: ACTION_PAR_TYPE_DEMANDE[type],
      resourceType: 'rgpd_request',
      resourceId: rows[0].id,
      resourceLabel: `Demande ${type} — ${demandeurNom}`,
      newValues: rows[0],
      metadata: { type },
      legalBasis: 'Art. 12-22 RGPD',
    });

    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// PATCH /api/rgpd/requests/:id — changement de statut / réponse.
router.patch('/requests/:id', async (req, res) => {
  const { statut, reponse } = req.body || {};
  const STATUTS_VALIDES = ['recue', 'en_cours', 'traitee', 'rejetee'];
  if (statut && !STATUTS_VALIDES.includes(statut)) {
    return res.status(400).json({ error: `statut invalide (${STATUTS_VALIDES.join(', ')})` });
  }

  try {
    const avant = await req.dbClient.query('SELECT * FROM public.rgpd_requests WHERE id = $1', [req.params.id]);
    if (!avant.rows[0]) return res.status(404).json({ error: 'Demande introuvable' });

    const traiteA = statut && statut !== 'recue' ? new Date() : avant.rows[0].date_traitement;
    const { rows } = await req.dbClient.query(
      `UPDATE public.rgpd_requests
       SET statut = COALESCE($1, statut), reponse = COALESCE($2, reponse),
           date_traitement = $3, traite_par = $4
       WHERE id = $5 RETURNING *`,
      [statut ?? null, reponse ?? null, traiteA, req.user.id, req.params.id]
    );

    await req.audit({
      action: AUDIT_ACTIONS.REGISTRE_UPDATED,
      resourceType: 'rgpd_request',
      resourceId: rows[0].id,
      resourceLabel: `Demande ${rows[0].type} — ${rows[0].demandeur_nom}`,
      oldValues: avant.rows[0],
      newValues: rows[0],
      legalBasis: 'Art. 12-22 RGPD',
    });

    return res.json(rows[0]);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/rgpd/requests/:id/export — livrable PDF réel pour les demandes
// d'accès/portabilité liées à un résident (cf. discussion produit : seul
// l'export est construit pour de vrai, l'effacement reste un suivi de
// statut, l'anonymisation technique est un chantier séparé).
router.get('/requests/:id/export', async (req, res) => {
  try {
    const demande = await req.dbClient.query('SELECT * FROM public.rgpd_requests WHERE id = $1', [req.params.id]);
    if (!demande.rows[0]) return res.status(404).json({ error: 'Demande introuvable' });
    if (!['acces', 'portabilite'].includes(demande.rows[0].type)) {
      return res.status(400).json({ error: 'Export PDF disponible uniquement pour les demandes acces/portabilite' });
    }
    if (!demande.rows[0].resident_id) {
      return res.status(400).json({ error: 'Demande non liée à un résident' });
    }

    const residentId = demande.rows[0].resident_id;
    const [resident, consultations, traitements, transmissions, notes, chutes] = await Promise.all([
      req.dbClient.query('SELECT * FROM public.residents WHERE id = $1', [residentId]),
      req.dbClient.query('SELECT * FROM public.consultations WHERE resident_id = $1 ORDER BY date_consult DESC', [residentId]),
      req.dbClient.query('SELECT * FROM public.traitements WHERE resident_id = $1 ORDER BY date_debut DESC', [residentId]),
      req.dbClient.query('SELECT * FROM public.transmissions WHERE resident_id = $1 ORDER BY created_at DESC', [residentId]),
      req.dbClient.query('SELECT * FROM public.notes_suivi WHERE resident_id = $1 ORDER BY updated_at DESC', [residentId]),
      req.dbClient.query('SELECT * FROM public.chutes WHERE resident_id = $1 ORDER BY date_evenement DESC', [residentId]),
    ]);
    if (!resident.rows[0]) return res.status(404).json({ error: 'Résident introuvable' });

    const doc = genererExportResident({
      resident: resident.rows[0],
      consultations: consultations.rows,
      traitements: traitements.rows,
      transmissions: transmissions.rows,
      notes: notes.rows,
      chutes: chutes.rows,
    });

    await req.audit({
      action: AUDIT_ACTIONS.RGPD_EXPORT_GENERATED,
      resourceType: 'resident',
      resourceId: residentId,
      resourceLabel: `Export ${demande.rows[0].type} — ${resident.rows[0].nom} ${resident.rows[0].prenom}`,
      metadata: { rgpdRequestId: demande.rows[0].id },
      legalBasis: 'Art. 15/20 RGPD',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="export-${residentId}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── Registre des violations (Art. 33-34) ────────────────────────────────────

// GET /api/rgpd/breaches
router.get('/breaches', async (req, res) => {
  try {
    const { rows } = await req.dbClient.query('SELECT * FROM public.data_breaches ORDER BY declared_at DESC');
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/rgpd/breaches — déclaration initiale.
router.post('/breaches', async (req, res) => {
  const { nature, categoriesDonnees, volumePersonnesEstime, consequencesProbables, mesuresPrises, periodeDebut, periodeFin } = req.body || {};
  if (!nature) return res.status(400).json({ error: 'nature requise' });

  try {
    const { rows } = await req.dbClient.query(
      `INSERT INTO public.data_breaches (
        declared_by, nature, categories_donnees, volume_personnes_estime,
        consequences_probables, mesures_prises, periode_debut, periode_fin
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.user.id, nature, categoriesDonnees ?? [], volumePersonnesEstime ?? null,
        consequencesProbables ?? null, mesuresPrises ?? null, periodeDebut ?? null, periodeFin ?? null,
      ]
    );

    await req.audit({
      action: AUDIT_ACTIONS.RGPD_BREACH_DECLARED,
      resourceType: 'data_breach',
      resourceId: rows[0].id,
      resourceLabel: `Violation déclarée — ${nature}`,
      newValues: rows[0],
      legalBasis: 'Art. 33 RGPD',
    });

    return res.status(201).json(rows[0]);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/rgpd/breaches/:id/link-audit — marque linked_to_breach=true sur
// les entrées audit_logs de la période déclarée, ce qui porte leur délai de
// conservation de 12 à 36 mois (cf. purge.job.js, qui vérifie déjà ce flag).
router.post('/breaches/:id/link-audit', async (req, res) => {
  try {
    const breach = await req.dbClient.query('SELECT * FROM public.data_breaches WHERE id = $1', [req.params.id]);
    if (!breach.rows[0]) return res.status(404).json({ error: 'Violation introuvable' });
    if (!breach.rows[0].periode_debut || !breach.rows[0].periode_fin) {
      return res.status(400).json({ error: 'periode_debut et periode_fin doivent être renseignées avant de lier des entrées d\'audit' });
    }

    const { resourceType } = req.body || {};
    const { rowCount } = await req.dbClient.query(
      `UPDATE public.audit_logs
       SET details = COALESCE(details, '{}'::jsonb) || '{"linked_to_breach": true}'::jsonb
       WHERE created_at BETWEEN $1 AND $2
         AND ($3::text IS NULL OR table_name = $3)`,
      [breach.rows[0].periode_debut, breach.rows[0].periode_fin, resourceType ?? null]
    );

    const { rows } = await req.dbClient.query(
      'UPDATE public.data_breaches SET audit_logs_linked_count = audit_logs_linked_count + $1 WHERE id = $2 RETURNING *',
      [rowCount, req.params.id]
    );

    await req.audit({
      action: AUDIT_ACTIONS.REGISTRE_UPDATED,
      resourceType: 'data_breach',
      resourceId: rows[0].id,
      resourceLabel: `Liaison audit_logs — ${rows[0].nature}`,
      metadata: { entriesLinked: rowCount, periodeDebut: breach.rows[0].periode_debut, periodeFin: breach.rows[0].periode_fin },
      legalBasis: 'Art. 33 RGPD',
    });

    return res.json({ ...rows[0], entriesLinkedThisCall: rowCount });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/rgpd/breaches/:id/cnil-pdf — dossier pré-rempli pour dépôt
// manuel sur le portail CNIL (aucune API publique connue pour un envoi
// automatisé, cf. discussion produit).
router.get('/breaches/:id/cnil-pdf', async (req, res) => {
  try {
    const breach = await req.dbClient.query('SELECT * FROM public.data_breaches WHERE id = $1', [req.params.id]);
    if (!breach.rows[0]) return res.status(404).json({ error: 'Violation introuvable' });

    const doc = genererDeclarationCnil(breach.rows[0]);

    await req.dbClient.query(
      `UPDATE public.data_breaches SET statut = 'notifiee_cnil', notification_cnil_le = COALESCE(notification_cnil_le, NOW()) WHERE id = $1`,
      [req.params.id]
    );

    await req.audit({
      action: AUDIT_ACTIONS.RGPD_BREACH_DECLARED,
      resourceType: 'data_breach',
      resourceId: breach.rows[0].id,
      resourceLabel: `Dossier CNIL généré — ${breach.rows[0].nature}`,
      metadata: { document: 'cnil-pdf' },
      legalBasis: 'Art. 33 RGPD',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="declaration-cnil-${req.params.id}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/rgpd/breaches/:id/notify-affected — notifie par email (canal
// MSSanté obligatoire, cf. emailTypes.js) les résidents choisis
// explicitement par le DPO (jamais une liste dérivée automatiquement) —
// chaque tentative est déjà journalisée par services/email/emailLogger.js ;
// un échec sur un destinataire ne bloque pas les autres.
router.post('/breaches/:id/notify-affected', async (req, res) => {
  const { residentIds, message } = req.body || {};
  if (!Array.isArray(residentIds) || residentIds.length === 0) {
    return res.status(400).json({ error: 'residentIds requis (liste non vide)' });
  }

  try {
    const breach = await req.dbClient.query('SELECT * FROM public.data_breaches WHERE id = $1', [req.params.id]);
    if (!breach.rows[0]) return res.status(404).json({ error: 'Violation introuvable' });

    const { rows: residents } = await req.dbClient.query(
      'SELECT id, nom, prenom, email FROM public.residents WHERE id = ANY($1::uuid[])',
      [residentIds]
    );

    const resultats = [];
    for (const resident of residents) {
      if (!resident.email) {
        resultats.push({ residentId: resident.id, success: false, reason: 'Aucune adresse email au dossier' });
        continue;
      }
      try {
        await sendEmail({
          type: EMAIL_TYPES.RGPD_VIOLATION,
          to: resident.email,
          subject: 'Information relative à une violation de données vous concernant',
          body: message || `Nous vous informons d'une violation de données susceptible de vous concerner. Contact DPO : ${process.env.DPO_EMAIL || ''}`,
          meta: { breachId: req.params.id, residentId: resident.id },
        });
        resultats.push({ residentId: resident.id, success: true });
      } catch (err) {
        resultats.push({ residentId: resident.id, success: false, reason: err.message });
      }
    }

    const auMoinsUnSucces = resultats.some((r) => r.success);
    if (auMoinsUnSucces) {
      await req.dbClient.query(
        'UPDATE public.data_breaches SET personnes_notifiees_le = COALESCE(personnes_notifiees_le, NOW()) WHERE id = $1',
        [req.params.id]
      );
    }

    await req.audit({
      action: AUDIT_ACTIONS.RGPD_BREACH_DECLARED,
      resourceType: 'data_breach',
      resourceId: req.params.id,
      resourceLabel: `Notification des personnes concernées — ${breach.rows[0].nature}`,
      metadata: { resultats },
      legalBasis: 'Art. 34 RGPD',
    });

    return res.json({ resultats });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/rgpd/registre-note — édition de la note AIPD (rappel : doit
// être mise à jour au fil du projet, pas figée à sa rédaction initiale).
router.patch('/registre-note', async (req, res) => {
  const { note_aipd: noteAipd } = req.body || {};
  if (!noteAipd || typeof noteAipd !== 'string') {
    return res.status(400).json({ error: 'note_aipd requis (texte)' });
  }

  try {
    const avant = await req.dbClient.query('SELECT * FROM public.registre_meta WHERE id = 1');

    const { rows } = await req.dbClient.query(
      'UPDATE public.registre_meta SET note_aipd = $1, updated_by = $2 WHERE id = 1 RETURNING *',
      [noteAipd, req.user.id]
    );

    await req.audit({
      action: AUDIT_ACTIONS.REGISTRE_UPDATED,
      resourceType: 'registre_note_aipd',
      resourceLabel: 'Note AIPD du registre des traitements',
      oldValues: avant.rows[0],
      newValues: rows[0],
      legalBasis: 'Art. 30 RGPD',
    });

    return res.json(rows[0]);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/violation', async (req, res) => {
  try {
    const result = await sendEmail({
      type: EMAIL_TYPES.RGPD_VIOLATION,
      to: req.body.destinataire,
      subject: 'Déclaration de violation de données',
      body: req.body.message,
      meta: { userId: req.user.id, reportedAt: new Date().toISOString() },
    });
    return res.json(result);
  } catch (err) {
    if (err instanceof EmailDeliveryError) {
      return res.status(502).json({ error: 'Échec d\'envoi', channel: err.channel });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
