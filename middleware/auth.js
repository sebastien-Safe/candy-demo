/**
 * [ candy-e ] — MIDDLEWARE D'AUTHENTIFICATION JWT
 * Fichier : middleware/auth.js
 *
 * Brique minimale et temporaire : rend actives les policies RLS
 * réconciliées (cf. database/migrations/002_rls_policies.sql), qui sinon
 * resteraient inertes faute d'identité vérifiée. Pro Santé Connect
 * remplacera cette authentification en Phase 1 du chantier Ségur.
 *
 * Vérifie le JWT transmis via le cookie httpOnly `candy_token` (posé par
 * POST /api/auth/login, cf. routes/auth.js) et attache `req.user = { id,
 * role }` en cas de succès.
 */

const jwt = require('jsonwebtoken');
const { TOKEN_COOKIE } = require('../config/authCookie');

function authMiddleware(req, res, next) {
  const token = req.cookies?.[TOKEN_COOKIE];

  if (!token) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
}

module.exports = authMiddleware;
