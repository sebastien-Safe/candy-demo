/**
 * [ candy-e ] — DOSSIERS DE TEST INSi (PLACEHOLDER)
 * Fichier : services/insi/__fixtures__/dossiers-test.js
 *
 * ⚠️ Le cahier de recette CNDA (dossiers de test officiels) n'est pas
 * disponible dans ce dépôt à la date d'écriture. Les dossiers ci-dessous
 * sont des SUBSTITUTS couvrant les mêmes cas (identité unique, aucune
 * identité, identités multiples, erreur technique, vérification OK/KO) —
 * à remplacer directement par les vrais dossiers du cahier de recette le
 * jour venu, la forme (traits + xmlReponse + resultatAttendu) reste la même.
 */

const TRAITS_BASE = {
  nomNaissance: 'DUPONT',
  premierPrenomNaissance: 'Marie',
  listePrenoms: ['Marie', 'Jeanne'],
  dateNaissance: '1952-03-12',
  sexe: 'F',
  codeInseeLieuNaissance: '69003',
};

function enveloppeRechercheReponse({ codeRetour, nombreResultats, identites }) {
  const blocsIdentite = (identites || [])
    .map(
      (id) => `<ins:Identite>
        <ins:MatriculeIns>${id.matriculeIns}</ins:MatriculeIns>
        <ins:OidIns>${id.oidIns}</ins:OidIns>
        <ins:NomNaissance>${id.nomNaissance}</ins:NomNaissance>
        <ins:PremierPrenom>${id.premierPrenomNaissance}</ins:PremierPrenom>
        <ins:Sexe>${id.sexe}</ins:Sexe>
        <ins:DateNaissance>${id.dateNaissance}</ins:DateNaissance>
      </ins:Identite>`
    )
    .join('');

  return `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <ins:RechercherIdentiteResponse xmlns:ins="urn:insi:teleservice:1.0">
        <ins:CodeRetour>${codeRetour}</ins:CodeRetour>
        <ins:NombreResultats>${nombreResultats}</ins:NombreResultats>
        ${blocsIdentite}
      </ins:RechercherIdentiteResponse>
    </soap:Body>
  </soap:Envelope>`;
}

function enveloppeVerificationReponse({ codeRetour, concordance }) {
  return `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <ins:VerifierIdentiteResponse xmlns:ins="urn:insi:teleservice:1.0">
        <ins:CodeRetour>${codeRetour}</ins:CodeRetour>
        <ins:Concordance>${concordance}</ins:Concordance>
      </ins:VerifierIdentiteResponse>
    </soap:Body>
  </soap:Envelope>`;
}

function enveloppeFault() {
  return `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
      <soap:Fault>
        <faultcode>soap:Server</faultcode>
        <faultstring>Service indisponible</faultstring>
      </soap:Fault>
    </soap:Body>
  </soap:Envelope>`;
}

const DOSSIERS_RECHERCHE = [
  {
    nom: 'identite_unique',
    traits: TRAITS_BASE,
    xmlReponse: enveloppeRechercheReponse({
      codeRetour: 0,
      nombreResultats: 1,
      identites: [{ matriculeIns: '269032812345678', oidIns: '1.2.250.1.213.1.4.8', ...TRAITS_BASE }],
    }),
    resultatAttendu: 'IDENTITE_UNIQUE',
  },
  {
    nom: 'aucune_identite',
    traits: { ...TRAITS_BASE, nomNaissance: 'INTROUVABLE' },
    xmlReponse: enveloppeRechercheReponse({ codeRetour: 1, nombreResultats: 0 }),
    resultatAttendu: 'AUCUNE_IDENTITE',
  },
  {
    nom: 'plusieurs_identites',
    traits: { ...TRAITS_BASE, nomNaissance: 'MARTIN' },
    xmlReponse: enveloppeRechercheReponse({
      codeRetour: 0,
      nombreResultats: 2,
      identites: [
        { matriculeIns: '111111111111111', oidIns: '1.2.250.1.213.1.4.8', ...TRAITS_BASE, nomNaissance: 'MARTIN' },
        { matriculeIns: '222222222222222', oidIns: '1.2.250.1.213.1.4.8', ...TRAITS_BASE, nomNaissance: 'MARTIN' },
      ],
    }),
    resultatAttendu: 'PLUSIEURS_IDENTITES',
  },
  {
    nom: 'erreur_technique',
    traits: TRAITS_BASE,
    xmlReponse: enveloppeFault(),
    resultatAttendu: 'ERREUR_TECHNIQUE',
  },
];

const DOSSIERS_VERIFICATION = [
  {
    nom: 'verification_ok',
    traits: TRAITS_BASE,
    matriculeIns: '269032812345678',
    oidIns: '1.2.250.1.213.1.4.8',
    xmlReponse: enveloppeVerificationReponse({ codeRetour: 0, concordance: true }),
    resultatAttendu: 'VERIFICATION_OK',
  },
  {
    nom: 'verification_ko',
    traits: TRAITS_BASE,
    matriculeIns: '269032812345678',
    oidIns: '1.2.250.1.213.1.4.8',
    xmlReponse: enveloppeVerificationReponse({ codeRetour: 0, concordance: false }),
    resultatAttendu: 'VERIFICATION_KO',
  },
];

module.exports = { TRAITS_BASE, DOSSIERS_RECHERCHE, DOSSIERS_VERIFICATION };
