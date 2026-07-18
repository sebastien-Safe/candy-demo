/**
 * [ candy-e ] — MIDDLEWARE DE CONTRÔLE DE RÔLE
 * Fichier : middleware/requireRole.js
 *
 * À chaîner APRÈS middleware/auth.js (qui pose req.user = { id, role }).
 * Premier consommateur : routes/insi.js — réutilisable par les futures
 * routes qui doivent restreindre l'accès à un sous-ensemble de rôles.
 */

function requireRole(rolesAutorises) {
  return function (req, res, next) {
    if (!req.user || !rolesAutorises.includes(req.user.role)) {
      return res.status(403).json({ error: 'Rôle non autorisé pour cette opération' });
    }
    return next();
  };
}

module.exports = requireRole;
