/**
 * [ candy-e ] — HELPERS PDF COMMUNS (pdfkit)
 * Fichier : services/pdf/pdfBuilder.js
 *
 * Mise en page minimale partagée par les deux générateurs RGPD (export
 * résident, dossier de déclaration CNIL) — pas de template engine, pdfkit
 * suffit pour des documents structurés en sections.
 */

'use strict';

const PDFDocument = require('pdfkit');

function creerDocument({ titre }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.fontSize(18).fillColor('#000').text(titre, { align: 'left' });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('#666').text(`C@NDY-e — généré le ${new Date().toLocaleString('fr-FR')}`);
  doc.fillColor('#000');
  doc.moveDown(1);
  return doc;
}

function section(doc, titre) {
  doc.moveDown(0.8);
  doc.fontSize(13).fillColor('#000').text(titre, { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10);
}

function champ(doc, label, valeur) {
  doc.fontSize(10).fillColor('#000');
  doc.text(`${label} : `, { continued: true, indent: 10 }).fillColor('#333').text(String(valeur ?? '—'));
  doc.fillColor('#000');
}

function liste(doc, items, formatter) {
  if (!items.length) {
    doc.fontSize(9).fillColor('#666').text('Aucune entrée.', { indent: 10 });
    doc.fillColor('#000');
    return;
  }
  items.forEach((item) => {
    doc.fontSize(9).text(`• ${formatter(item)}`, { indent: 10 });
  });
}

module.exports = { creerDocument, section, champ, liste };
