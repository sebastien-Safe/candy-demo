/**
 * [ candy-e ] — SERVEUR NODE.JS (Clever Cloud)
 * Fichier : server.js
 *
 * Serveur Express minimal. Ne remplace pas encore le frontend statique
 * (frontend/, non touché) — prépare la brique serveur nécessaire pour
 * qu'un futur appel depuis le navigateur puisse atteindre PostgreSQL
 * (impossible en direct : `pg` ne tourne pas côté client).
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const authMiddleware = require('./middleware/auth');
const setUserContext = require('./middleware/setUserContext');
const { auditMiddleware } = require('./services/audit/audit.service');
const authRoutes = require('./routes/auth');
const insiRoutes = require('./routes/insi');
const patientsRoutes = require('./routes/patients');
const profilesRoutes = require('./routes/profiles');
const dossierResidentRoutes = require('./routes/dossier-resident');
const agendaRoutes = require('./routes/agenda');
const transmissionsRoutes = require('./routes/transmissions');
const tourneesRoutes = require('./routes/tournees');
const statsRoutes = require('./routes/stats');
const dashboardRoutes = require('./routes/dashboard');
const auditRoutes = require('./routes/audit');
const rgpdRoutes = require('./routes/rgpd');
const { schedulePurgeJob } = require('./services/rgpd/purge/purge.scheduler');

const app = express();

app.disable('x-powered-by');

app.use(helmet({
  // HSTS : forcer HTTPS pendant 1 an, sous-domaines inclus
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  // Empêcher le chargement dans une iframe (clickjacking)
  frameguard: { action: 'deny' },
  // Empêcher le MIME sniffing
  noSniff: true,
  // Referrer minimal
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Désactiver la détection XSS IE (obsolète mais inoffensif)
  xssFilter: true,
  // Content-Security-Policy adapté à une app SaaS santé sans CDN externe
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : true,
  credentials: false,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'candy-e', version: '0.1.0' });
});

// Frontend statique (frontend/public/login.html, index.html, assets…).
// Racine = frontend/ (et non frontend/public) car les pages référencent
// des chemins relatifs remontant vers frontend/src (ex: ../src/styles/main.css),
// comme en local avec `npx serve` lancé depuis frontend/. frontend/index.html
// gère déjà la redirection de '/' vers '/public/login.html'.
app.use(express.static(path.join(__dirname, 'frontend')));

// /api/auth est public (login/logout) — monté AVANT le middleware de
// protection ci-dessous, donc jamais soumis à authMiddleware/setUserContext.
// PSC remplacera cette auth JWT en Phase 1.
app.use('/api/auth', authRoutes);

// Toute route /api/* montée APRÈS cette ligne est protégée : JWT vérifié
// (authMiddleware) puis GUC RLS positionnés (setUserContext), qui attache
// req.dbClient pour la durée de la requête ; auditMiddleware attache
// ensuite req.audit(), utilisable par les routes pour journaliser dans
// audit_logs (cf. services/audit/audit.service.js).
app.use('/api', authMiddleware, setUserContext, auditMiddleware);

app.use('/api/insi', insiRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api', dossierResidentRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/transmissions', transmissionsRoutes);
app.use('/api/tournees_soins', tourneesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit_logs', auditRoutes);
app.use('/api/rgpd', rgpdRoutes);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`[candy-e] Serveur démarré sur le port ${PORT}`);
  schedulePurgeJob();
});

module.exports = app;
