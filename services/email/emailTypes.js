/**
 * [ candy-e ] — TYPES D'EMAIL ET RÈGLES DE ROUTAGE
 * Fichier : services/email/emailTypes.js
 *
 * MSSANTE_TYPES fixe la liste des types d'email qui DOIVENT transiter par le
 * canal MSSanté (notifications PS : contrainte ANS/PSC EXI EDC PSC 102-6 ;
 * communications RGPD : Art. 33 RGPD sur les violations de données et le
 * droit d'accès) — tout type absent de cette liste part par le SMTP
 * classique (services/email/smtpClassic.js).
 */

'use strict';

const EMAIL_TYPES = {
  NOTIFICATION_PS: 'notification_ps',
  ALERTE_TECHNIQUE: 'alerte_technique',
  USAGE_METIER: 'usage_metier',
  RGPD_ACCES: 'rgpd_acces',
  RGPD_VIOLATION: 'rgpd_violation',
  AUTH_PASSWORD_RESET: 'auth_password_reset',
};

const MSSANTE_TYPES = [
  EMAIL_TYPES.NOTIFICATION_PS,
  EMAIL_TYPES.RGPD_ACCES,
  EMAIL_TYPES.RGPD_VIOLATION,
];

function requiertCanalMssante(type) {
  return MSSANTE_TYPES.includes(type);
}

module.exports = { EMAIL_TYPES, MSSANTE_TYPES, requiertCanalMssante };
