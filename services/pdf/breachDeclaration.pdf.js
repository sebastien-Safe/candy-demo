/**
 * [ candy-e ] — DOSSIER DE DÉCLARATION CNIL (Art. 33 RGPD)
 * Fichier : services/pdf/breachDeclaration.pdf.js
 *
 * Aucune API publique documentée de télédéclaration CNIL n'est connue de ce
 * dépôt (contrairement à INSi, qui a un vrai téléservice intégré) — ce PDF
 * est un dossier pré-rempli que le DPO dépose lui-même sur le site de la
 * CNIL, pas un appel automatisé vers un service tiers non vérifié.
 */

'use strict';

const { creerDocument, section, champ } = require('./pdfBuilder');

function genererDeclarationCnil(breach) {
  const doc = creerDocument({ titre: 'Dossier de déclaration de violation de données — Art. 33 RGPD' });

  section(doc, 'Nature de la violation');
  doc.fontSize(10).text(breach.nature || '—');

  section(doc, 'Informations générales');
  champ(doc, 'Date de déclaration', new Date(breach.declared_at).toLocaleString('fr-FR'));
  champ(
    doc,
    'Période concernée',
    [breach.periode_debut, breach.periode_fin]
      .filter(Boolean)
      .map((d) => new Date(d).toLocaleDateString('fr-FR'))
      .join(' au ') || '—'
  );
  champ(doc, 'Catégories de données concernées', (breach.categories_donnees || []).join(', '));
  champ(doc, 'Volume de personnes estimé', breach.volume_personnes_estime);
  champ(doc, 'Statut', breach.statut);

  section(doc, 'Conséquences probables');
  doc.fontSize(10).text(breach.consequences_probables || '—');

  section(doc, 'Mesures prises ou proposées');
  doc.fontSize(10).text(breach.mesures_prises || '—');

  section(doc, 'Contact DPO');
  doc.fontSize(10).text(process.env.DPO_EMAIL || '—');

  return doc;
}

module.exports = { genererDeclarationCnil };
