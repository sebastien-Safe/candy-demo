/**
 * [ candy-e ] — EXPORT PDF DU DOSSIER RÉSIDENT (Art. 15/20 RGPD)
 * Fichier : services/pdf/residentExport.pdf.js
 *
 * Livrable réel pour le droit d'accès/portabilité — pas qu'un suivi de
 * demande (contrairement à l'effacement, cf. rgpd_requests, volontairement
 * limité au statut pour l'instant).
 */

'use strict';

const { creerDocument, section, champ, liste } = require('./pdfBuilder');

function genererExportResident({ resident, consultations, traitements, transmissions, notes, chutes }) {
  const doc = creerDocument({ titre: `Export des données — ${resident.nom} ${resident.prenom}` });

  section(doc, 'Identité et informations administratives');
  champ(doc, 'Nom', resident.nom);
  champ(doc, 'Prénom', resident.prenom);
  champ(doc, 'Date de naissance', resident.date_naissance);
  champ(doc, 'Sexe', resident.sexe);
  champ(doc, 'Adresse', [resident.adresse, resident.code_postal, resident.ville].filter(Boolean).join(', '));
  champ(doc, 'Téléphone', resident.telephone);
  champ(doc, 'Groupe sanguin', resident.groupe_sanguin);
  champ(doc, 'GIR', resident.gir);

  section(doc, `Consultations (${consultations.length})`);
  liste(doc, consultations, (c) => `${c.date_consult} — ${c.type_acte} — ${c.titre}`);

  section(doc, `Traitements (${traitements.length})`);
  liste(doc, traitements, (t) => `${t.medicament} — ${t.dose} — ${t.frequence} (${t.actif ? 'actif' : 'arrêté'})`);

  section(doc, `Transmissions (${transmissions.length})`);
  liste(doc, transmissions, (t) => `${new Date(t.created_at).toLocaleDateString('fr-FR')} — ${t.type} — ${t.contenu}`);

  section(doc, `Notes de suivi (${notes.length})`);
  liste(doc, notes, (n) => `${new Date(n.updated_at).toLocaleDateString('fr-FR')} — ${n.contenu ?? '—'}`);

  section(doc, `Chutes déclarées (${chutes.length})`);
  liste(doc, chutes, (c) => `${c.date_evenement} — ${c.lieu}`);

  return doc;
}

module.exports = { genererExportResident };
