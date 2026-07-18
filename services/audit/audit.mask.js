/**
 * [ candy-e ] — MASQUAGE DES CHAMPS SENSIBLES DANS LES LOGS D'AUDIT
 * Fichier : services/audit/audit.mask.js
 *
 * Appliqué systématiquement à old_values/new_values avant insertion dans
 * audit_logs (cf. audit.service.js) — aucune donnée de santé en clair ne
 * doit atteindre le journal d'audit. Liste alignée sur les colonnes
 * réellement sensibles du schéma (database/migrations/001_init_schema.sql) :
 * secrets techniques + champs de texte libre clinique (contenu, notes,
 * observations, description...) + numero_secu.
 */

'use strict';

const SENSITIVE_FIELDS = [
  // secrets techniques
  'password', 'password_hash', 'reset_token_hash', 'token', 'secret', 'api_key', 'private_key',
  // identifiants de santé
  'numero_secu',
  // texte libre clinique (consultations.notes, transmissions.contenu,
  // chutes.notes, ordonnances.contenu, traitements.notes,
  // constantes.observations, tournees_soins.transmission,
  // notes_suivi.contenu, soins_pansements.description/materiel/localisation)
  'contenu', 'notes', 'observations', 'description', 'materiel', 'localisation', 'transmission',
];

function maskSensitiveFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f))) {
      result[key] = '[MASQUÉ]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = maskSensitiveFields(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

module.exports = { maskSensitiveFields, SENSITIVE_FIELDS };
