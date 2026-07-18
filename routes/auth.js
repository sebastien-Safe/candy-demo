/**
 * [ candy-e ] — ROUTES D'AUTHENTIFICATION
 * Fichier : routes/auth.js
 *
 * Monté sur /api/auth, en grande partie SANS middleware d'authentification
 * (login/forgot-password/reset-password sont publiques par nature) — /me
 * et /users appliquent authMiddleware (+ requireRole pour /users)
 * explicitement, puisqu'ils ne passent pas par la chaîne globale
 * app.use('/api', authMiddleware, setUserContext) de server.js (montée
 * après /api/auth). PSC remplacera cette auth JWT en Phase 1.
 *
 * Remplace côté frontend (frontend/src/core/auth.js) : auth.signInWithPassword,
 * auth.signOut, auth.resetPasswordForEmail, auth.setSession, auth.updateUser,
 * la lecture de profil (_syncUserState), et modules/admin/admin.js :
 * auth.admin.createUser.
 */

'use strict';

const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/client');
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { TOKEN_COOKIE, cookieOptions, cookieMaxAgeMs } = require('../config/authCookie');
const { logAudit } = require('../services/audit/audit.service');
const { AUDIT_ACTIONS } = require('../services/audit/audit.actions');
const { sendEmail } = require('../services/email/emailRouter');
const { EMAIL_TYPES } = require('../services/email/emailTypes');

const router = express.Router();

const DUREE_TOKEN_RESET_MS = 60 * 60 * 1000; // 1h

async function journaliserAudit(action, userId) {
  try {
    await pool.query('SELECT public.log_action($1,$2,$3,$4)', [action, 'profiles', userId, null]);
  } catch {
    // best-effort : le journal ne doit jamais bloquer login/logout
  }
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, role, nom, prenom, password_hash, actif FROM public.profiles WHERE email = $1',
      [email]
    );
    const profile = rows[0];

    // Ne jamais préciser si c'est l'e-mail ou le mot de passe qui est faux
    // dans la réponse HTTP — mais on trace l'échec (imputabilité PGSSI-S,
    // détection de bruteforce), absent jusqu'ici.
    if (!profile || !profile.actif || !profile.password_hash) {
      await logAudit({
        actorId: profile?.id,
        actorEmail: email,
        actorRole: profile?.role ?? 'unknown',
        actorIp: req.ip,
        actorUserAgent: req.headers['user-agent'],
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
        resourceType: 'profile',
        resourceId: profile?.id,
        success: false,
        errorMessage: 'Identifiants invalides',
        legalBasis: 'Art. 6(1)(f) RGPD — sécurisation du SI',
      });
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) {
      await logAudit({
        actorId: profile.id,
        actorEmail: email,
        actorRole: profile.role,
        actorIp: req.ip,
        actorUserAgent: req.headers['user-agent'],
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
        resourceType: 'profile',
        resourceId: profile.id,
        success: false,
        errorMessage: 'Identifiants invalides',
        legalBasis: 'Art. 6(1)(f) RGPD — sécurisation du SI',
      });
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const token = jwt.sign(
      { id: profile.id, role: profile.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.cookie(TOKEN_COOKIE, token, { ...cookieOptions(), maxAge: cookieMaxAgeMs() });

    await journaliserAudit('LOGIN', profile.id);

    return res.json({
      user: { id: profile.id, role: profile.role, nom: profile.nom, prenom: profile.prenom },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Déconnexion : JWT stateless, donc simple réponse 200 côté serveur.
// Une révocation réelle (token compromis, déconnexion forcée) nécessiterait
// une blacklist (Redis) ou une rotation de JWT_SECRET — hors périmètre ici.
router.post('/logout', async (req, res) => {
  const token = req.cookies?.[TOKEN_COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      await journaliserAudit('LOGOUT', payload.id);
    } catch {
      // token déjà invalide/expiré : rien à journaliser, la déconnexion reste OK
    }
  }
  res.clearCookie(TOKEN_COOKIE, cookieOptions());
  res.json({ message: 'Déconnecté' });
});

// GET /api/auth/me — remplace _syncUserState (lecture du profil courant)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, role, nom, prenom, specialite, actif FROM public.profiles WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Profil introuvable' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/forgot-password
// Email envoyé via le canal classique (services/email/emailRouter.js —
// EMAIL_TYPES.AUTH_PASSWORD_RESET, absent de MSSANTE_TYPES par construction :
// ce message ne contient qu'un lien/token, jamais de donnée de santé).
// Best-effort : un échec d'envoi ne doit jamais bloquer la réponse HTTP, qui
// ne doit de toute façon jamais révéler si l'email existe ou non.
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email requis' });

  try {
    const { rows } = await pool.query('SELECT id FROM public.profiles WHERE email = $1 AND actif = true', [email]);

    if (rows[0]) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + DUREE_TOKEN_RESET_MS);

      await pool.query(
        'UPDATE public.profiles SET reset_token_hash = $1, reset_token_expires_at = $2 WHERE id = $3',
        [tokenHash, expiresAt, rows[0].id]
      );

      const lien = `${process.env.FRONTEND_URL || ''}/reset-password.html?token=${token}`;

      try {
        await sendEmail({
          type: EMAIL_TYPES.AUTH_PASSWORD_RESET,
          to: email,
          subject: 'Réinitialisation de votre mot de passe C@NDY-e',
          body: `Bonjour,\n\nVous avez demandé la réinitialisation de votre mot de passe C@NDY-e.\n\nLien : ${lien}\n\nCe lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nC@NDY-e — Logiciel de gestion médico-sociale`,
          bodyHtml: `<p>Bonjour,</p><p>Vous avez demandé la réinitialisation de votre mot de passe C@NDY-e.</p><p><a href="${lien}" style="display:inline-block;padding:12px 24px;background:#0f4c8a;color:#fff;border-radius:6px;text-decoration:none;font-family:sans-serif;font-size:14px;">Réinitialiser mon mot de passe</a></p><p style="color:#666;font-size:12px;">Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p><hr style="border:none;border-top:1px solid #eee;margin:24px 0;"><p style="color:#999;font-size:11px;">C@NDY-e — Logiciel de gestion médico-sociale</p>`,
        });
      } catch (emailErr) {
        console.error('[candy-e] [email:auth] échec envoi reset mot de passe', { email, error: emailErr.message });
      }

      await logAudit({
        actorId: rows[0].id,
        actorEmail: email,
        actorRole: 'unknown',
        actorIp: req.ip,
        actorUserAgent: req.headers['user-agent'],
        action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET_REQUEST,
        resourceType: 'profile',
        resourceId: rows[0].id,
        legalBasis: 'Art. 6(1)(f) RGPD — sécurisation du SI',
      });
    }

    // Ne jamais révéler si l'email existe ou non.
    return res.json({ message: 'Si ce compte existe, un email de réinitialisation a été envoyé.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token et newPassword requis' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await pool.query(
      'SELECT id, email, role FROM public.profiles WHERE reset_token_hash = $1 AND reset_token_expires_at > now()',
      [tokenHash]
    );
    if (!rows[0]) {
      return res.status(400).json({ error: 'Lien de réinitialisation invalide ou expiré' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE public.profiles SET password_hash = $1, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = $2',
      [passwordHash, rows[0].id]
    );

    await logAudit({
      actorId: rows[0].id,
      actorEmail: rows[0].email,
      actorRole: rows[0].role,
      actorIp: req.ip,
      actorUserAgent: req.headers['user-agent'],
      action: AUDIT_ACTIONS.AUTH_PASSWORD_CHANGE,
      resourceType: 'profile',
      resourceId: rows[0].id,
      legalBasis: 'Art. 6(1)(f) RGPD — sécurisation du SI',
    });

    return res.json({ message: 'Mot de passe mis à jour.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/users — remplace auth.admin.createUser (modules/admin/admin.js)
// SC.SSI/IAM.92 : la création de compte (donc l'attribution d'un rôle)
// reste exclusive au compte à privilèges super_admin — directeur_etablissement
// ne peut que désactiver un compte existant (cf. routes/profiles.js).
router.post('/users', authMiddleware, requireRole(['super_admin']), async (req, res) => {
  const { email, password, prenom, nom, role, specialite } = req.body || {};
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'email, password et role requis' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO public.profiles (email, password_hash, prenom, nom, role, specialite, actif)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, email, prenom, nom, role, specialite, actif, created_at`,
      [email, passwordHash, prenom || null, nom || null, role, specialite || null]
    );

    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      actorIp: req.ip,
      actorUserAgent: req.headers['user-agent'],
      action: AUDIT_ACTIONS.USER_CREATED,
      resourceType: 'profile',
      resourceId: rows[0].id,
      resourceLabel: `${rows[0].prenom ?? ''} ${rows[0].nom ?? ''} (compte #${rows[0].id})`.trim(),
      newValues: rows[0],
      legalBasis: 'Art. 6(1)(f) RGPD — sécurisation du SI',
    });

    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Cet email existe déjà' });
    }
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
