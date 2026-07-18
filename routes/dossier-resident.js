/**
 * [ candy-e ] — ROUTES DOSSIER RÉSIDENT (sous-ressources cliniques)
 * Fichier : routes/dossier-resident.js
 *
 * Regroupe les sous-ressources du dossier résident qui suivent toutes le
 * même schéma d'accès (liste filtrée par résident, création, parfois mise
 * à jour) : constantes, consultations, traitements, soins_pansements,
 * notes_suivi, chutes, documents, ordonnances. Fournit l'API REST
 * consommée par modules/patient/patient-record.js, fiche-chute.js,
 * soins.js, traitements.js.
 *
 * Chaque table a sa propre colonne resident_id (renommée depuis patient_id,
 * cf. database/migrations/001_init_schema.sql) — le frontend continue
 * d'envoyer `patientId` (camelCase, historique), traduit ici.
 *
 * Rôles alignés table par table sur database/migrations/002_rls_policies.sql.
 */

'use strict';

const express = require('express');
const requireRole = require('../middleware/requireRole');
const { construireInsert, construireUpdate } = require('../db/sql-builder');
const { AUDIT_ACTIONS } = require('../services/audit/audit.actions');

const ROLES_11 = [
  'super_admin', 'cadre_sante', 'medecin',
  'infirmiere', 'aide_soignante', 'secretaire',
];

/**
 * Fabrique un routeur GET(?patientId=&actif=)/POST/[PATCH] pour une table
 * dont la seule dépendance est resident_id. `colonnesAutorisees` ne doit
 * jamais inclure resident_id ni les colonnes de traçabilité serveur
 * (celles-ci sont ajoutées explicitement par route). `ordre` doit être
 * qualifié avec l'alias `t.` (ex: 't.date_consult DESC') — nécessaire dès
 * qu'une jointure est utilisée (évite une colonne ambiguë avec profiles/
 * residents, ex. `actif` existe sur profiles ET traitements).
 *
 * `joinProfilesSur` (optionnel) : nom de la colonne FK vers profiles (ex.
 * 'medecin_id', 'prescripteur_id') — réplique la relation embarquée
 * PostgREST `profiles(prenom, nom)` attendue par patient-record.js.
 *
 * `patientIdObligatoire` (def. true) : si false, `patientId` devient un
 * filtre optionnel — nécessaire pour une vue transverse (ex. tous les
 * traitements, filtrables par résident ET par `actif`), cf. traitements.js.
 * `embarquerResident` (def. false) : ajoute `patients(nom, prenom)` par
 * LEFT JOIN — utile uniquement pour une vue transverse (sur une vue déjà
 * filtrée par un seul résident, le nom du résident est redondant).
 * `filtresSupplementaires` (def. []) : filtres optionnels `?queryParam=`
 * génériques, ex. `[{ queryParam: 'actif', colonne: 'actif', type: 'boolean' }]`
 * pour traitements, `[{ queryParam: 'type_soin', colonne: 'type_soin', type: 'string' }]`
 * pour soins_pansements.
 *
 * `resourceType`/`actionCreation`/`actionMiseAJour` (optionnels) : quand
 * fournis, POST/PATCH journalisent dans audit_logs via req.audit() (cf.
 * services/audit/audit.service.js) — traçabilité RGPD/PGSSI-S des
 * modifications de données de santé. Le PATCH capture la valeur avant
 * modification (SELECT préalable) pour old_values. Pas de journalisation
 * du GET (liste) — volume disproportionné, la consultation d'un dossier
 * résident est déjà tracée via RESIDENT_VIEWED (routes/patients.js).
 */
function routeurRessourceParResident({
  table,
  ordre,
  colonnesAutorisees,
  rolesLecture,
  rolesEcriture,
  colonneAuteur, // ex: 'saisie_par' | 'auteur_id' | 'created_by' — posée à req.user.id, ou null
  autoriserMiseAJour = true,
  joinProfilesSur = null,
  patientIdObligatoire = true,
  embarquerResident = false,
  filtresSupplementaires = [],
  resourceType = table,
  actionCreation = null,
  actionMiseAJour = null,
}) {
  const routeur = express.Router();

  const jointures = [];
  const colonnesSelect = ['t.*'];
  if (joinProfilesSur) {
    jointures.push(`LEFT JOIN public.profiles p ON p.id = t.${joinProfilesSur}`);
    colonnesSelect.push(`CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object('prenom', p.prenom, 'nom', p.nom) END AS profiles`);
  }
  if (embarquerResident) {
    jointures.push('LEFT JOIN public.residents r ON r.id = t.resident_id');
    colonnesSelect.push(`CASE WHEN r.id IS NULL THEN NULL ELSE json_build_object('nom', r.nom, 'prenom', r.prenom) END AS patients`);
  }
  const fromSql = `FROM public.${table} t ${jointures.join(' ')}`;

  routeur.get('/', requireRole(rolesLecture), async (req, res) => {
    const { patientId } = req.query;
    if (patientIdObligatoire && !patientId) {
      return res.status(400).json({ error: 'patientId requis' });
    }

    const conditions = [];
    const valeurs = [];
    if (patientId) {
      valeurs.push(patientId);
      conditions.push(`t.resident_id = $${valeurs.length}`);
    }
    for (const filtre of filtresSupplementaires) {
      const brut = req.query[filtre.queryParam];
      if (brut === undefined) continue;
      valeurs.push(filtre.type === 'boolean' ? brut === 'true' : brut);
      conditions.push(`t.${filtre.colonne} = $${valeurs.length}`);
    }
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const { rows } = await req.dbClient.query(
        `SELECT ${colonnesSelect.join(', ')} ${fromSql} ${whereSql} ORDER BY ${ordre}`,
        valeurs
      );
      return res.json(rows);
    } catch (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  if (rolesEcriture) {
    routeur.post('/', requireRole(rolesEcriture), async (req, res) => {
      const { patientId, ...reste } = req.body || {};
      if (!patientId) return res.status(400).json({ error: 'patientId requis' });

      const corps = { ...reste, resident_id: patientId };
      const colonnesFinales = [...colonnesAutorisees, 'resident_id'];
      if (colonneAuteur) {
        corps[colonneAuteur] = req.user.id;
        colonnesFinales.push(colonneAuteur);
      }

      try {
        const { sql, valeurs } = construireInsert(table, colonnesFinales, corps);
        const { rows } = await req.dbClient.query(sql, valeurs);
        if (actionCreation) {
          await req.audit({
            action: actionCreation,
            resourceType,
            resourceId: rows[0].id,
            resourceLabel: `${resourceType} #${rows[0].id} (résident #${rows[0].resident_id})`,
            newValues: rows[0],
            legalBasis: 'Art. 9(2)(h) RGPD',
          });
        }
        return res.status(201).json(rows[0]);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    });

    if (autoriserMiseAJour) {
      routeur.patch('/:id', requireRole(rolesEcriture), async (req, res) => {
        try {
          const avant = await req.dbClient.query(`SELECT * FROM public.${table} WHERE id = $1`, [req.params.id]);
          if (!avant.rows[0]) return res.status(404).json({ error: 'Introuvable' });

          const { sql, valeurs } = construireUpdate(table, colonnesAutorisees, req.body, 'id', req.params.id);
          const { rows } = await req.dbClient.query(sql, valeurs);
          if (!rows[0]) return res.status(404).json({ error: 'Introuvable' });
          if (actionMiseAJour) {
            await req.audit({
              action: actionMiseAJour,
              resourceType,
              resourceId: rows[0].id,
              resourceLabel: `${resourceType} #${rows[0].id} (résident #${rows[0].resident_id})`,
              oldValues: avant.rows[0],
              newValues: rows[0],
              legalBasis: 'Art. 9(2)(h) RGPD',
            });
          }
          return res.json(rows[0]);
        } catch (err) {
          return res.status(400).json({ error: err.message });
        }
      });
    }
  }

  return routeur;
}

const router = express.Router();

router.use(
  '/constantes',
  routeurRessourceParResident({
    table: 'constantes',
    ordre: 't.date_mesure DESC',
    colonnesAutorisees: [
      'tension_sys', 'tension_dia', 'frequence_cardiaque', 'saturation_o2',
      'temperature', 'poids', 'glycemie', 'echelle_douleur', 'observations', 'date_mesure',
    ],
    rolesLecture: ['super_admin', 'cadre_sante', 'medecin', 'infirmiere', 'aide_soignante'],
    rolesEcriture: ['super_admin', 'cadre_sante', 'medecin', 'infirmiere', 'aide_soignante'],
    colonneAuteur: 'saisie_par',
    resourceType: 'constante',
    actionCreation: AUDIT_ACTIONS.CONSTANTE_CREATED,
    actionMiseAJour: AUDIT_ACTIONS.CONSTANTE_UPDATED,
  })
);

router.use(
  '/consultations',
  routeurRessourceParResident({
    table: 'consultations',
    ordre: 't.date_consult DESC',
    colonnesAutorisees: ['medecin_id', 'date_consult', 'type_acte', 'titre', 'notes', 'poids', 'tension_sys', 'tension_dia', 'spo2', 'rythme_cardiaque'],
    rolesLecture: ['super_admin', 'directeur_etablissement', 'cadre_sante', 'medecin', 'infirmiere'],
    rolesEcriture: ['super_admin', 'cadre_sante', 'medecin'],
    colonneAuteur: 'created_by',
    joinProfilesSur: 'medecin_id',
    resourceType: 'consultation',
    actionCreation: AUDIT_ACTIONS.CONSULTATION_CREATED,
    actionMiseAJour: AUDIT_ACTIONS.CONSULTATION_UPDATED,
  })
);

router.use(
  '/traitements',
  routeurRessourceParResident({
    table: 'traitements',
    ordre: 't.actif DESC, t.created_at DESC',
    colonnesAutorisees: ['medicament', 'dci', 'dose', 'voie', 'frequence', 'date_debut', 'date_fin', 'actif', 'prescripteur_id', 'notes'],
    rolesLecture: ['super_admin', 'cadre_sante', 'medecin', 'infirmiere'],
    rolesEcriture: ['super_admin', 'cadre_sante', 'medecin'],
    colonneAuteur: null,
    joinProfilesSur: 'prescripteur_id',
    patientIdObligatoire: false,
    embarquerResident: true,
    filtresSupplementaires: [{ queryParam: 'actif', colonne: 'actif', type: 'boolean' }],
    resourceType: 'traitement',
    actionCreation: AUDIT_ACTIONS.TRAITEMENT_CREATED,
    actionMiseAJour: AUDIT_ACTIONS.TRAITEMENT_UPDATED,
  })
);

router.use(
  '/soins_pansements',
  routeurRessourceParResident({
    table: 'soins_pansements',
    ordre: 't.date_soin DESC',
    colonnesAutorisees: ['type_soin', 'localisation', 'description', 'stade', 'materiel', 'date_soin', 'prochain_soin'],
    rolesLecture: ['super_admin', 'cadre_sante', 'medecin', 'infirmiere'],
    rolesEcriture: ['super_admin', 'cadre_sante', 'medecin', 'infirmiere'],
    colonneAuteur: 'saisie_par',
    autoriserMiseAJour: false,
    patientIdObligatoire: false,
    embarquerResident: true,
    filtresSupplementaires: [{ queryParam: 'type_soin', colonne: 'type_soin', type: 'string' }],
    resourceType: 'soin',
    actionCreation: AUDIT_ACTIONS.SOIN_CREATED,
  })
);

router.use(
  '/notes_suivi',
  routeurRessourceParResident({
    table: 'notes_suivi',
    ordre: 't.updated_at DESC',
    colonnesAutorisees: ['contenu'],
    rolesLecture: ROLES_11,
    rolesEcriture: ['super_admin', 'cadre_sante', 'medecin', 'infirmiere', 'aide_soignante'],
    colonneAuteur: 'auteur_id',
    resourceType: 'note_suivi',
    actionCreation: AUDIT_ACTIONS.NOTE_SUIVI_CREATED,
    actionMiseAJour: AUDIT_ACTIONS.NOTE_SUIVI_UPDATED,
  })
);

router.use(
  '/chutes',
  routeurRessourceParResident({
    table: 'chutes',
    ordre: 't.date_evenement DESC, t.heure_evenement DESC',
    colonnesAutorisees: [
      'date_evenement', 'heure_evenement', 'lieu', 'activite', 'temoin', 'facteurs_environnementaux',
      'tension_sys', 'tension_dia', 'frequence_cardiaque', 'saturation_o2', 'etat_conscience',
      'lesions', 'acteurs_prevenus', 'notes', 'transmission_id',
    ],
    rolesLecture: ROLES_11,
    rolesEcriture: ['super_admin', 'cadre_sante', 'medecin', 'infirmiere', 'aide_soignante'],
    colonneAuteur: 'saisie_par',
    resourceType: 'chute',
    actionCreation: AUDIT_ACTIONS.CHUTE_DECLAREE,
    actionMiseAJour: AUDIT_ACTIONS.CHUTE_UPDATED,
  })
);

router.use(
  '/documents',
  routeurRessourceParResident({
    table: 'documents',
    ordre: 't.created_at DESC',
    colonnesAutorisees: [],
    rolesLecture: ROLES_11,
    rolesEcriture: null, // aucune UI d'upload aujourd'hui (cf. rls-transposition.md) — lecture seule ici
    colonneAuteur: null,
  })
);

router.use(
  '/ordonnances',
  routeurRessourceParResident({
    table: 'ordonnances',
    ordre: 't.date_emission DESC',
    colonnesAutorisees: [],
    rolesLecture: ['super_admin', 'cadre_sante', 'medecin', 'infirmiere', 'secretaire'],
    rolesEcriture: null, // aucune UI de création d'ordonnance aujourd'hui
    colonneAuteur: null,
    joinProfilesSur: 'medecin_id',
  })
);

module.exports = router;
