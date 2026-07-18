/**
 * [ candy-e ] — ENDPOINTS INSi (récupération et vérification d'identité)
 * Fichier : routes/insi.js
 *
 * Monté sur /api/insi, derrière authMiddleware + setUserContext (cf.
 * server.js), qui attache req.dbClient (connexion RLS déjà scoped sur
 * l'utilisateur courant, transaction commitée en fin de requête — cf.
 * middleware/setUserContext.js) ; et requireRole (rôles autorisés à
 * écrire l'identité d'un résident, alignés sur
 * identites_insert/residents_insert en RLS — cf.
 * database/migrations/003_identite_rniv.sql — pas de permission inventée).
 *
 * Traduit les réponses du téléservice INSi (services/insi/client.js) en
 * transitions de statut RNIV (identite/rniv.js), persiste, puis journalise
 * via log_action() — jamais de trait d'identité ni de matricule INS en
 * clair dans les logs (cf. services/insi/envelopes.js:analyserReponse, qui
 * sépare structurellement `identite` sensible et `audit` sans PII : seul
 * `audit` est journalisé ici, jamais `resultat.identite`).
 */

'use strict';

const express = require('express');
const requireRole = require('../middleware/requireRole');
const insiClient = require('../services/insi/client');
const { recupererDepuisINSi, signalerIdentiteDouteuse, ErreurRNIV } = require('../identite/rniv');

const router = express.Router();

const ROLES_AUTORISES = ['super_admin', 'cadre_sante', 'medecin', 'infirmiere'];

router.use(requireRole(ROLES_AUTORISES));

function formaterDate(valeur) {
  if (valeur instanceof Date) return valeur.toISOString().slice(0, 10);
  return valeur;
}

function traitsDepuisIdentite(identite) {
  return {
    nomNaissance: identite.nom_naissance,
    premierPrenomNaissance: identite.premier_prenom_naissance,
    listePrenoms: identite.liste_prenoms || [],
    dateNaissance: formaterDate(identite.date_naissance),
    sexe: identite.sexe,
    codeInseeLieuNaissance: identite.code_insee_lieu_naissance,
  };
}

async function chargerIdentite(client, residentId) {
  const { rows } = await client.query('SELECT * FROM public.identites WHERE resident_id = $1', [residentId]);
  return rows[0] || null;
}

async function journaliser(client, { residentId, operation, resultat, dureeMs }) {
  await client.query('SELECT public.log_action($1,$2,$3,$4)', [
    `INSI_${operation.toUpperCase()}`,
    'identites',
    residentId,
    JSON.stringify({ operation, resultat: resultat.type, ...resultat.audit, dureeMs }),
  ]);
}

router.post('/recuperer', async (req, res) => {
  const { residentId } = req.body || {};
  if (!residentId) {
    return res.status(400).json({ error: 'residentId requis' });
  }

  try {
    const identiteActuelle = await chargerIdentite(req.dbClient, residentId);
    if (!identiteActuelle) {
      return res.status(404).json({ error: 'Identité non initialisée pour ce résident' });
    }

    const debut = Date.now();
    const resultat = await insiClient.rechercherIdentite(traitsDepuisIdentite(identiteActuelle));
    const dureeMs = Date.now() - debut;

    let statutHttp;
    let corps;
    let identiteMaj = null;

    switch (resultat.type) {
      case 'IDENTITE_UNIQUE':
        identiteMaj = recupererDepuisINSi(identiteActuelle, {
          matriculeIns: resultat.identite.matriculeIns,
          oidIns: resultat.identite.oidIns,
        });
        statutHttp = 200;
        corps = { statutIdentite: identiteMaj.statut_identite };
        break;
      case 'PLUSIEURS_IDENTITES':
        statutHttp = 409;
        corps = { error: 'Plusieurs identités possibles côté INSi — traits supplémentaires requis' };
        break;
      case 'AUCUNE_IDENTITE':
        statutHttp = 404;
        corps = { error: 'Aucune identité trouvée côté INSi' };
        break;
      default:
        statutHttp = 502;
        corps = { error: 'Erreur technique INSi' };
    }

    if (identiteMaj) {
      await req.dbClient.query(
        `UPDATE public.identites
           SET matricule_ins = $1, oid_ins = $2, statut_identite = $3, date_qualification = $4
         WHERE resident_id = $5`,
        [identiteMaj.matricule_ins, identiteMaj.oid_ins, identiteMaj.statut_identite, identiteMaj.date_qualification, residentId]
      );
    }

    await journaliser(req.dbClient, { residentId, operation: 'recherche', resultat, dureeMs });

    return res.status(statutHttp).json(corps);
  } catch (err) {
    if (err instanceof ErreurRNIV) {
      return res.status(422).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/verifier', async (req, res) => {
  const { residentId } = req.body || {};
  if (!residentId) {
    return res.status(400).json({ error: 'residentId requis' });
  }

  try {
    const identiteActuelle = await chargerIdentite(req.dbClient, residentId);
    if (!identiteActuelle) {
      return res.status(404).json({ error: 'Identité non initialisée pour ce résident' });
    }
    if (!identiteActuelle.matricule_ins || !identiteActuelle.oid_ins) {
      return res.status(400).json({ error: 'Aucun matricule INS enregistré pour ce résident — rien à vérifier' });
    }

    const debut = Date.now();
    const resultat = await insiClient.verifierIdentite(traitsDepuisIdentite(identiteActuelle), {
      matriculeIns: identiteActuelle.matricule_ins,
      oidIns: identiteActuelle.oid_ins,
    });
    const dureeMs = Date.now() - debut;

    let statutHttp = 200;
    let corps = { statut: 'OK' };

    if (resultat.type === 'VERIFICATION_KO') {
      const identiteMaj = signalerIdentiteDouteuse(identiteActuelle);
      await req.dbClient.query(
        `UPDATE public.identites
           SET identite_douteuse = $1, statut_identite = $2, matricule_ins = $3,
               oid_ins = $4, justificatif_type = $5, date_qualification = $6
         WHERE resident_id = $7`,
        [
          identiteMaj.identite_douteuse,
          identiteMaj.statut_identite,
          identiteMaj.matricule_ins,
          identiteMaj.oid_ins,
          identiteMaj.justificatif_type,
          identiteMaj.date_qualification,
          residentId,
        ]
      );
      corps = { statut: 'KO', statutIdentite: identiteMaj.statut_identite };
    } else if (resultat.type !== 'VERIFICATION_OK') {
      statutHttp = 502;
      corps = { error: 'Erreur technique INSi' };
    }

    await journaliser(req.dbClient, { residentId, operation: 'verification', resultat, dureeMs });

    return res.status(statutHttp).json(corps);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
