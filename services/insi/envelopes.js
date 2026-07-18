/**
 * [ candy-e ] — ENVELOPPES SOAP INSi
 * Fichier : services/insi/envelopes.js
 *
 * Construction des enveloppes SOAP (recherche/vérification) et
 * classification des réponses, séparé du transport (cf. client.js) pour
 * être testable sans réseau ni certificat.
 *
 * ⚠️ À CONFIRMER avec le WSDL/cahier des charges CNDA réel avant tout appel
 * en environnement de test CNDA. Le WSDL/XSD INSi et le cahier de recette
 * ne sont pas disponibles dans ce dépôt à la date d'écriture — les
 * constantes ci-dessous (namespaces, noms d'éléments, SOAPAction) sont une
 * structure plausible, non vérifiée contre la spécification officielle.
 * Un seul point à corriger le jour où le vrai WSDL est disponible.
 */

const { XMLParser } = require('fast-xml-parser');

const NS_SOAP = 'http://schemas.xmlsoap.org/soap/envelope/';
const NS_INSI = 'urn:insi:teleservice:1.0'; // À CONFIRMER
const SOAP_ACTION_RECHERCHE = 'urn:insi:teleservice:1.0#RechercherIdentite'; // À CONFIRMER
const SOAP_ACTION_VERIFICATION = 'urn:insi:teleservice:1.0#VerifierIdentite'; // À CONFIRMER

class ErreurInsi extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurInsi';
  }
}

const xmlParser = new XMLParser({ removeNSPrefix: true });

function echapperXml(valeur) {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function validerTraits(traits) {
  const obligatoires = ['nomNaissance', 'premierPrenomNaissance', 'dateNaissance', 'sexe'];
  const manquants = obligatoires.filter((champ) => !traits || !traits[champ]);
  if (manquants.length > 0) {
    throw new ErreurInsi(`Trait(s) manquant(s) pour l'appel INSi : ${manquants.join(', ')}`);
  }
}

function blocLps(configLps) {
  return `<ins:ContexteLPS>
      <ins:LpsNom>${echapperXml(configLps.nom)}</ins:LpsNom>
      <ins:LpsVersion>${echapperXml(configLps.version)}</ins:LpsVersion>
      <ins:LpsNil>${echapperXml(configLps.nil)}</ins:LpsNil>
    </ins:ContexteLPS>`;
}

function blocTraits(traits) {
  const prenoms = (traits.listePrenoms || [])
    .map((prenom) => `<ins:Prenom>${echapperXml(prenom)}</ins:Prenom>`)
    .join('');
  const lieu = traits.codeInseeLieuNaissance
    ? `<ins:LieuNaissance>${echapperXml(traits.codeInseeLieuNaissance)}</ins:LieuNaissance>`
    : '';

  return `<ins:Identite>
      <ins:NomNaissance>${echapperXml(traits.nomNaissance)}</ins:NomNaissance>
      <ins:PremierPrenom>${echapperXml(traits.premierPrenomNaissance)}</ins:PremierPrenom>
      ${prenoms}
      <ins:DateNaissance>${echapperXml(traits.dateNaissance)}</ins:DateNaissance>
      <ins:Sexe>${echapperXml(traits.sexe)}</ins:Sexe>
      ${lieu}
    </ins:Identite>`;
}

function construireEnveloppeRecherche(traits, configLps) {
  validerTraits(traits);
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${NS_SOAP}" xmlns:ins="${NS_INSI}">
  <soap:Header>
    ${blocLps(configLps)}
  </soap:Header>
  <soap:Body>
    <ins:RechercherIdentite>
      ${blocTraits(traits)}
    </ins:RechercherIdentite>
  </soap:Body>
</soap:Envelope>`;
}

function construireEnveloppeVerification(traits, { matriculeIns, oidIns }, configLps) {
  validerTraits(traits);
  if (!matriculeIns || !oidIns) {
    throw new ErreurInsi('matriculeIns et oidIns requis pour une vérification INSi');
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${NS_SOAP}" xmlns:ins="${NS_INSI}">
  <soap:Header>
    ${blocLps(configLps)}
  </soap:Header>
  <soap:Body>
    <ins:VerifierIdentite>
      <ins:MatriculeIns>${echapperXml(matriculeIns)}</ins:MatriculeIns>
      <ins:OidIns>${echapperXml(oidIns)}</ins:OidIns>
      ${blocTraits(traits)}
    </ins:VerifierIdentite>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Parse et classifie une réponse SOAP. Contrat volontairement strict :
 * `identite` ne porte des données sensibles (matricule, traits) que pour
 * IDENTITE_UNIQUE ; `audit` ne contient jamais ni trait ni matricule — un
 * appelant qui journalise `audit` ne peut pas y trouver de PII par
 * construction (cf. exigence de non-fuite dans l'audit trail).
 */
function analyserReponse(xmlTexte, operation) {
  let parsed;
  try {
    parsed = xmlParser.parse(xmlTexte);
  } catch (err) {
    return { type: 'ERREUR_TECHNIQUE', identite: null, audit: { raison: 'reponse_xml_invalide' } };
  }

  const body = parsed?.Envelope?.Body;
  if (!body) {
    return { type: 'ERREUR_TECHNIQUE', identite: null, audit: { raison: 'reponse_sans_body' } };
  }

  if (body.Fault) {
    return {
      type: 'ERREUR_TECHNIQUE',
      identite: null,
      audit: { raison: 'soap_fault', codeRetour: body.Fault.faultcode ?? null },
    };
  }

  if (operation === 'recherche') {
    const reponse = body.RechercherIdentiteResponse;
    if (!reponse) {
      return { type: 'ERREUR_TECHNIQUE', identite: null, audit: { raison: 'reponse_inattendue' } };
    }

    const nombreResultats = Number(reponse.NombreResultats ?? 0);
    const audit = { codeRetour: reponse.CodeRetour ?? null, nombreResultats };

    if (nombreResultats === 0) {
      return { type: 'AUCUNE_IDENTITE', identite: null, audit };
    }
    if (nombreResultats > 1) {
      return { type: 'PLUSIEURS_IDENTITES', identite: null, audit };
    }

    const bloc = Array.isArray(reponse.Identite) ? reponse.Identite[0] : reponse.Identite;
    return {
      type: 'IDENTITE_UNIQUE',
      identite: {
        matriculeIns: String(bloc.MatriculeIns),
        oidIns: String(bloc.OidIns),
        traits: {
          nomNaissance: bloc.NomNaissance,
          premierPrenomNaissance: bloc.PremierPrenom,
          sexe: bloc.Sexe,
          dateNaissance: bloc.DateNaissance,
        },
      },
      audit,
    };
  }

  if (operation === 'verification') {
    const reponse = body.VerifierIdentiteResponse;
    if (!reponse) {
      return { type: 'ERREUR_TECHNIQUE', identite: null, audit: { raison: 'reponse_inattendue' } };
    }

    const audit = { codeRetour: reponse.CodeRetour ?? null };
    const concordance = String(reponse.Concordance).toLowerCase() === 'true';
    return { type: concordance ? 'VERIFICATION_OK' : 'VERIFICATION_KO', identite: null, audit };
  }

  return { type: 'ERREUR_TECHNIQUE', identite: null, audit: { raison: 'operation_inconnue' } };
}

module.exports = {
  NS_INSI,
  SOAP_ACTION_RECHERCHE,
  SOAP_ACTION_VERIFICATION,
  ErreurInsi,
  construireEnveloppeRecherche,
  construireEnveloppeVerification,
  analyserReponse,
};
