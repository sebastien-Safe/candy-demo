/**
 * [ candy-e ] — CLIENT INSi (environnement de test CNDA)
 * Fichier : services/insi/client.js
 *
 * API publique : rechercherIdentite(traits), verifierIdentite(traits, {matriculeIns, oidIns}).
 * Authentification par TLS mutuelle (certificat logiciel CNDA, bundle
 * PKCS#12) — pas de signature XML additionnelle (cf. plan P1.x, décision
 * validée : le mécanisme réel connu du téléservice INSi est la TLS
 * mutuelle ; une signature XML WS-Security serait un chantier séparé si le
 * cahier des charges CNDA l'exige).
 *
 * Config lue À L'APPEL (jamais au chargement du module, pour ne pas faire
 * planter le serveur si INSi n'est pas encore configuré) : INSI_CERT_PATH,
 * INSI_CERT_PASSWORD, INSI_ENDPOINT, LPS_NOM, LPS_VERSION, LPS_NIL. Config
 * absente/illisible => résultat ERREUR_TECHNIQUE (contrat uniforme, pas
 * d'exception pour un cas opérationnel attendu).
 *
 * Retry borné (MAX_TENTATIVES) uniquement sur erreurs techniques/réseau —
 * jamais sur une réponse fonctionnelle (aucune identité / identités
 * multiples), qui n'est pas une erreur à réessayer.
 */

'use strict';

const fs = require('fs');
const https = require('https');
const {
  ErreurInsi,
  SOAP_ACTION_RECHERCHE,
  SOAP_ACTION_VERIFICATION,
  construireEnveloppeRecherche,
  construireEnveloppeVerification,
  analyserReponse,
} = require('./envelopes');

const MAX_TENTATIVES = 3;
const DELAI_BASE_MS = 200;
const TIMEOUT_MS = 10_000;

function chargerConfig() {
  const { INSI_CERT_PATH, INSI_CERT_PASSWORD, INSI_ENDPOINT, LPS_NOM, LPS_VERSION, LPS_NIL } = process.env;

  if (!INSI_CERT_PATH || !INSI_CERT_PASSWORD || !INSI_ENDPOINT || !LPS_NOM || !LPS_VERSION || !LPS_NIL) {
    return null;
  }

  let pfx;
  try {
    pfx = fs.readFileSync(INSI_CERT_PATH);
  } catch (err) {
    return null;
  }

  return {
    endpoint: INSI_ENDPOINT,
    agent: new https.Agent({ pfx, passphrase: INSI_CERT_PASSWORD, keepAlive: false }),
    lps: { nom: LPS_NOM, version: LPS_VERSION, nil: LPS_NIL },
  };
}

function attendre(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function estErreurTechniqueRetryable(err) {
  const codesReseau = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN'];
  if (err && codesReseau.includes(err.code)) return true;
  if (err && typeof err.statusHttp === 'number' && err.statusHttp >= 500) return true;
  return false;
}

/**
 * Requête HTTPS (POST, TLS mutuelle via config.agent). Isolée pour être
 * injectable dans les tests (paramètre `effectuerRequete` de
 * rechercherIdentite/verifierIdentite) — évite de mocker le module
 * `https` global.
 */
function effectuerRequeteHttp(config, soapAction, enveloppe) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.endpoint);
    const requete = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        agent: config.agent,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: soapAction,
          'Content-Length': Buffer.byteLength(enveloppe),
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let corps = '';
        res.on('data', (chunk) => {
          corps += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 500) {
            const err = new Error(`Erreur HTTP ${res.statusCode}`);
            err.statusHttp = res.statusCode;
            reject(err);
            return;
          }
          resolve(corps);
        });
      }
    );

    requete.on('timeout', () => requete.destroy(new Error('Timeout INSi')));
    requete.on('error', reject);
    requete.write(enveloppe);
    requete.end();
  });
}

async function appelerAvecRetry(config, soapAction, enveloppe, operation, effectuerRequete) {
  let derniereErreur;

  for (let tentative = 1; tentative <= MAX_TENTATIVES; tentative += 1) {
    try {
      const xmlReponse = await effectuerRequete(config, soapAction, enveloppe);
      const resultat = analyserReponse(xmlReponse, operation);
      return { ...resultat, audit: { ...resultat.audit, tentatives: tentative } };
    } catch (err) {
      derniereErreur = err;
      if (!estErreurTechniqueRetryable(err) || tentative === MAX_TENTATIVES) {
        break;
      }
      await attendre(DELAI_BASE_MS * tentative);
    }
  }

  return {
    type: 'ERREUR_TECHNIQUE',
    identite: null,
    audit: { raison: derniereErreur ? derniereErreur.message : 'erreur_inconnue', tentatives: MAX_TENTATIVES },
  };
}

/**
 * Recherche par traits -> matricule INS + OID + traits INSi (ou aucune
 * identité, ou plusieurs échos à ne jamais résoudre automatiquement).
 */
async function rechercherIdentite(traits, { effectuerRequete = effectuerRequeteHttp } = {}) {
  const config = chargerConfig();
  if (!config) {
    return { type: 'ERREUR_TECHNIQUE', identite: null, audit: { raison: 'configuration_insi_incomplete' } };
  }

  const enveloppe = construireEnveloppeRecherche(traits, config.lps);
  return appelerAvecRetry(config, SOAP_ACTION_RECHERCHE, enveloppe, 'recherche', effectuerRequete);
}

/**
 * Vérification (traits + matricule déjà connu) -> résultat OK/KO.
 */
async function verifierIdentite(traits, { matriculeIns, oidIns }, { effectuerRequete = effectuerRequeteHttp } = {}) {
  const config = chargerConfig();
  if (!config) {
    return { type: 'ERREUR_TECHNIQUE', identite: null, audit: { raison: 'configuration_insi_incomplete' } };
  }

  const enveloppe = construireEnveloppeVerification(traits, { matriculeIns, oidIns }, config.lps);
  return appelerAvecRetry(config, SOAP_ACTION_VERIFICATION, enveloppe, 'verification', effectuerRequete);
}

module.exports = {
  ErreurInsi,
  rechercherIdentite,
  verifierIdentite,
  MAX_TENTATIVES,
  // Exportés uniquement pour les tests (config/transport par défaut).
  _chargerConfig: chargerConfig,
  _effectuerRequeteHttp: effectuerRequeteHttp,
};
