# Audit d'état du dépôt candy-e — 2026-07-17

Audit factuel, lecture seule. Application DUI Médico-social, homologation Ségur vague 2 (couloir MS-DUI). Stack Node.js 20/Express 4/PostgreSQL, frontend vanilla JS, déploiement Clever Cloud HDS.

---

## 1. Migrations SQL

Dossier `database/migrations/`, 14 fichiers, dernière migration en place : **013**.

| N° | Fichier | Objet principal |
|---|---|---|
| 000 | `000_rename_legacy_patients_to_residents.sql` | Renommage `patients` → `residents` pour environnements pré-existants |
| 001 | `001_init_schema.sql` | Schéma initial (introspection du schéma de prod, migration vers PostgreSQL Clever Cloud) |
| 002 | `002_rls_policies.sql` | Politiques RLS réconciliées avec la matrice RBAC frontend |
| 003 | `003_identite_rniv.sql` | Identité résident conforme RNIV (P1.1) |
| 004 | `004_reset_password.sql` | Token de réinitialisation de mot de passe |
| 005 | `005_add_dpo_role.sql` | Ajout du rôle `dpo` |
| 006 | `006_extend_audit_logs.sql` | Extension de `audit_logs` pour le module RGPD |
| 007 | `007_purge_tracking.sql` | Suivi de purge RGPD |
| 008 | `008_role_matrix_migration.sql` | Migration vers la matrice de rôles conforme REM-MS-DUI-Va2 |
| 009 | `009_remove_medecin_demo.sql` | Suppression du rôle `medecin_demo` |
| 010 | `010_create_email_logs.sql` | Journalisation des envois d'email |
| 011 | `011_registre_traitements.sql` | Registre des traitements (Art. 30 RGPD) |
| 012 | `012_breaches_and_requests.sql` | Registre des violations (Art. 33-34) et suivi des demandes de droits (Art. 15-22) |
| 013 | `013_notes_suivi_drop_unique.sql` | Correction du bug `UNIQUE(resident_id, auteur_id)` sur `notes_suivi` |

---

## 2. Structure des fichiers clés

| Fichier / dossier | Présent |
|---|---|
| `config/authCookie.js` | ✅ OUI |
| `middleware/auth.js` | ✅ OUI |
| `middleware/requireRole.js` | ✅ OUI |
| `middleware/setUserContext.js` | ✅ OUI |
| `services/insi/client.js` | ✅ OUI |
| `services/insi/client.test.js` | ✅ OUI |
| `services/rgpd/` | ✅ OUI (contient `notifications/`, `purge/`) |
| `services/email/` | ✅ OUI (contient `emailLogger.js`, `emailLogger.test.js`, `emailRouter.js`, `emailRouter.test.js`, `emailTypes.js`, `smtpBrevo.js`, `smtpClassic.js`, `smtpMssante.js`) |
| `services/mssante/` | ❌ NON — pas de dossier dédié ; la logique MSSanté vit dans `services/email/smtpMssante.js` |
| `routes/auth.js` | ✅ OUI |
| `routes/insi.js` | ✅ OUI |
| `routes/rgpd.js` | ✅ OUI |
| `routes/psc.js` ou route contenant « psc » | ❌ NON — aucun fichier de route dédié PSC |
| `identite/rniv.js` | ✅ OUI |
| `identite/rniv.test.js` | ✅ OUI |
| `docs/` | ✅ OUI — contient `ANS_matrice_roles_EXI_EDC_PSC_102.md`, `RGPD_GOVERNANCE.md`, `segur/audit-convergence-candy-e.md` |
| `.env.example` | ✅ OUI |

**Variables PSC_* / MSSANTE_* dans `.env.example`** :
- `PSC_CLIENT_ID=` et `PSC_CLIENT_SECRET=`, explicitement commentées comme *« Placeholders pour les futurs chantiers Ségur (Phase 1 — non utilisés tant que ces intégrations ne sont pas développées) »*. Pas de `PSC_ISSUER` ni autre variable PSC.
- `SMTP_MSSANTE_HOST`, `SMTP_MSSANTE_PORT`, `SMTP_MSSANTE_USER`, `SMTP_MSSANTE_PASS`, `SMTP_MSSANTE_FROM`, `SMTP_MSSANTE_TLS`, `SMTP_MSSANTE_STARTTLS` — présentes et actives (host pointant sur `smtp.operateur-mssante.fictif`, donc valeurs d'exemple/test).

---

## 3. RLS PostgreSQL

**19 tables** avec `ENABLE ROW LEVEL SECURITY` sur l'ensemble des migrations :

- `002_rls_policies.sql` (14 tables) : `profiles`, `residents`, `consultations`, `ordonnances`, `documents`, `notes_suivi`, `agenda`, `transmissions`, `constantes`, `traitements`, `soins_pansements`, `chutes`, `tournees_soins`, `audit_logs`
- `003_identite_rniv.sql` (1 table) : `identites`
- `011_registre_traitements.sql` (2 tables) : `registre_traitements`, `registre_meta`
- `012_breaches_and_requests.sql` (2 tables) : `data_breaches`, `rgpd_requests`

---

## 4. Tests unitaires

**31 fonctions `test(`** au total, réparties sur **4 fichiers** `*.test.js` :

| Fichier | Nombre de `test(` |
|---|---|
| `identite/rniv.test.js` | 12 |
| `services/insi/client.test.js` | 10 |
| `services/email/emailRouter.test.js` | 6 |
| `services/email/emailLogger.test.js` | 3 |

---

## 5. Authentification PSC (Pro Santé Connect)

- **Routes `/api/auth/psc/*`** : ❌ absentes. Aucune route PSC n'existe dans `routes/auth.js` ni ailleurs. Seules les routes présentes dans `routes/auth.js` sont `POST /login`, `POST /logout`, `GET /me`, `POST /forgot-password`, `POST /reset-password`, `POST /users`.
- Un commentaire en tête de `routes/auth.js` (ligne 10) indique explicitement : *« PSC remplacera cette auth JWT en Phase 1 »* — confirmant que l'auth actuelle est un JWT classique et que PSC est planifié mais **non implémenté**.
- **Variables d'environnement** : `PSC_CLIENT_ID` et `PSC_CLIENT_SECRET` référencées comme placeholders inutilisés (voir §2). Pas de `PSC_ISSUER`.
- **Middleware/service OIDC ou mTLS** : ❌ aucun trouvé. `config/authCookie.js` gère uniquement le cookie JWT httpOnly, pas d'OIDC.

---

## 6. MSSanté / SMTP

- **Service MSSanté** : ✅ présent mais sous forme d'un connecteur SMTP dédié, `services/email/smtpMssante.js` — pas de module `services/mssante/` séparé. Le routage par type de message (`services/email/emailTypes.js`) impose que les notifications PS, accès RGPD et violations RGPD partent obligatoirement par ce facteur MSSanté (contrainte ANS/PSC EXI EDC PSC 102-6, RGPD Art. 33), le reste partant par SMTP classique.
- **Configuration SMTP dans `.env.example`** : ✅ trois facteurs configurés — `SMTP_CLASSIC_*` (MailPace/Clever Cloud), `BREVO_SMTP_*` (Brevo, facteur classique actif en prod selon commentaire, `emailRouter.js` pointe dessus), `SMTP_MSSANTE_*` (opérateur MSSanté, valeurs d'exemple fictives `smtp.operateur-mssante.fictif`).

---

## 7. Rôles RBAC

Définis dans `frontend/src/core/rbac.js` (`middleware/requireRole.js` est un middleware générique paramétrable, ne déclare pas de liste de rôles lui-même).

**10 rôles déclarés** (`ROLES` object) :

1. `super_admin`
2. `directeur_etablissement`
3. `cadre_sante`
4. `medecin`
5. `infirmiere`
6. `aide_soignante`
7. `ash` — **marqué `@deprecated`** dans le code : conservé en base et dans la matrice pour compatibilité, mais plus aucun compte ne doit être créé avec ce rôle (audit des comptes existants pas encore fait, cf. `008_role_matrix_migration.sql`)
8. `intervenant_soins_exterieur`
9. `secretaire`
10. `dpo`

Note : le fichier documente que `admin_crm`/`administrateur` ont été fusionnés dans `super_admin`, que `cadre` a été renommé `cadre_sante`, que `kine`/`psycho`/`ergo` ont été fusionnés dans `intervenant_soins_exterieur`, et que `medecin_demo` a été supprimé (migration 009). La matrice se réclame conforme à REM-MS-DUI-Va2 (février 2026), cf. `docs/ANS_matrice_roles_EXI_EDC_PSC_102.md`.

Si l'on compte `ash` comme rôle actif (déprécié mais toujours fonctionnel en base), on obtient **9 rôles opérationnels + 1 déprécié = 10 déclarés**. Cela correspond au périmètre « matrice 9 rôles » évoqué dans les objectifs du projet, `ash` étant le rôle en cours de sortie.

---

## 8. Résumé de l'état

| Chantier | Statut | Remarque |
|---|---|---|
| Module RGPD | ✅ Présent | `routes/rgpd.js`, `services/rgpd/{notifications,purge}`, registre des traitements (migration 011), registre des violations + demandes de droits (migration 012), `docs/RGPD_GOVERNANCE.md`. |
| Cookie JWT httpOnly | ✅ Présent | `config/authCookie.js` dédié ; cohérent avec le commit récent « Corrige le JWT stocké en localStorage (XSS) : passage en cookie httpOnly ». |
| CORS restreint | ✅ Présent | Cohérent avec les commits récents « Restreint CORS aux origines de confiance en production » et « modif entête CORS » — non vérifié en détail dans cet audit (hors périmètre fichiers demandés). |
| Matrice 9 rôles + RLS | ✅ Présent | 10 rôles déclarés (9 actifs + `ash` déprécié) dans `rbac.js` ; 19 tables sous RLS across 4 migrations. |
| Intégration PSC OIDC | ❌ Absent | Aucune route, aucun middleware OIDC/mTLS. Seuls `PSC_CLIENT_ID`/`PSC_CLIENT_SECRET` existent en placeholders explicitement marqués « non utilisés ». Auth actuelle = JWT classique. |
| Service MSSanté | ✅ Présent | `services/email/smtpMssante.js` + routage obligatoire par type de message ; pas de dossier `services/mssante/` séparé mais fonctionnellement en place, avec config `.env.example` (valeurs fictives). |
| INSi client | ✅ Présent | `services/insi/client.js` + `client.test.js` (10 tests), `routes/insi.js`, `identite/rniv.js` conforme RNIV. |
| Documentation ANS (docs/) | ✅ Présent | `ANS_matrice_roles_EXI_EDC_PSC_102.md`, `RGPD_GOVERNANCE.md`, `segur/audit-convergence-candy-e.md`. |

---

*Audit réalisé en lecture seule le 2026-07-17. Aucun fichier existant n'a été modifié ; seul ce rapport a été créé.*
