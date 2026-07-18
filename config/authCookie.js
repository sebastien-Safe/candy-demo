/**
 * [ candy-e ] — OPTIONS DU COOKIE DE SESSION JWT
 * Fichier : config/authCookie.js
 *
 * Centralisé pour que la pose (login) et la suppression (logout) du cookie
 * utilisent exactement les mêmes options : sinon le navigateur ne reconnaît
 * pas le cookie à supprimer et il reste actif jusqu'à expiration.
 *
 * SameSite=Strict tant que l'app reste same-origin (frontend servi par ce
 * même serveur Express). À repasser en Lax si un domaine tiers doit un jour
 * appeler l'API (webhook Brevo, callback OIDC PSC en Phase 1).
 */

'use strict';

const ms = require('ms');

const TOKEN_COOKIE = 'candy_token';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };
}

function cookieMaxAgeMs() {
  return ms(process.env.JWT_EXPIRES_IN || '8h');
}

module.exports = { TOKEN_COOKIE, cookieOptions, cookieMaxAgeMs };
