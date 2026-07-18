# Audit technique C@NDY-e — Auto-évaluation Convergence ANS

## Date d'audit : 2026-07-12
## Version analysée : commit `e3b6504` (2026-07-11), branche `master`

Ce document est produit par analyse statique exhaustive du code source du dépôt `candy-e-clever` (backend Node.js/Express, base PostgreSQL, frontend JS vanilla). Il ne remplace pas un audit d'environnement de production : tout ce qui dépend de la configuration réelle (certificats INSi, opérateur MSSanté réel, console Clever Cloud) est marqué ❓.

---

## Résumé exécutif

| Critère | État actuel | Niveau Convergence estimé | Manques principaux |
|---|---|---|---|
| INS / INSi | 🔶 Partiel | Cadre RNIV complet, connexion CNDA non opérationnelle | Certificat CNDA non configuré, pas de vérification COG contre référentiel officiel, pas de signature WS-Security |
| Pro Santé Connect (PSC/e-CPS) | 🔴 Non implémenté | Aucun | Aucun flux OIDC ; JWT interne "pont temporaire" documenté comme tel |
| MSSanté | 🔶 Partiel | Routage conforme, opérateur fictif | Aucun opérateur MSSanté réel raccordé, aucun annuaire MSSanté, pas de CDA en pièce jointe |
| DMP / Mon espace santé | 🔴 Non implémenté | Aucun | Aucun appel API, aucun consentement, aucun CDA destiné au DMP |
| Documents CDA (CI-SIS) | 🔴 Non implémenté | Aucun | Aucun générateur CDA, aucun volet CI-SIS |
| Hébergement HDS | 🔶 Vérifiable partiellement / ❓ pour le contrat | Déploiement Clever Cloud confirmé | Contrat HDS lui-même hors périmètre code ; pas de séparation physique santé/autre |
| IAM.92 — Politique mot de passe | 🔴 Non implémenté | — | Aucune règle de complexité, pas d'expiration, pas de verrouillage, pas d'historique |
| IE.58 — Timeout inactivité | 🔴 Non conforme | — | JWT à durée fixe (8h par défaut), pas de timeout d'inactivité 2h, pas de refresh token |
| IAM.91 — Traces d'audit | 🔶 Bon niveau | — | Table immuable et rétention conformes ; couverture non exhaustive (listes non tracées) |
| IE.56/57 — Vérification email | 🔴 Non implémenté | — | Aucun envoi de confirmation, aucun statut email_verified |
| IE.38 — Déconnexion explicite | 🔶 Partiel | — | Logout applicatif OK, pas d'invalidation serveur du JWT (pas de blacklist) |
| GEN.11 — Bonnes pratiques dev | 🔶 Partiel | — | Pas de PSSI formalisé, pas de CI/pipeline d'audit npm visible |
| GEN.21 — Sauvegardes | ❓ | — | Rien dans le dépôt (géré côté console Clever Cloud, hors code) |
| Headers HTTP sécurité | 🔴 Non implémenté (sauf CORS) | — | Aucun helmet/CSP/HSTS/X-Frame-Options ; X-Powered-By non masqué |
| RPPS / FINESS | 🔴 Non implémenté | — | Champ `rpps` déclaratif seul, aucun appel annuaire, aucun FINESS établissement |
| SIDOBA / FHIR | 🔴 Non implémenté | — | Aucune trace dans le code |

---

## 1. INS / INSi

### Implémenté
- **Table dédiée `public.identites`** (1-1 avec `residents`) — [database/migrations/003_identite_rniv.sql](../../database/migrations/003_identite_rniv.sql) : `nom_naissance`, `premier_prenom_naissance`, `liste_prenoms`, `date_naissance`, `sexe`, `code_insee_lieu_naissance` (COG), `matricule_ins` (NIR/NIA, contrainte regex 15 chiffres), `oid_ins`, `statut_identite` (CHECK `PROVISOIRE|RECUPEREE|VALIDEE|QUALIFIEE`), `identite_fictive`, `identite_douteuse`, `date_qualification`, `justificatif_type`.
- **Règles métier RNIV** dans [identite/rniv.js](../../identite/rniv.js) : module pur sans dépendance DB. Implémente le cycle PROVISOIRE → RECUPEREE/VALIDEE → QUALIFIEE (`deriverStatut`), la rétrogradation automatique en PROVISOIRE sur modification d'un trait strict (`mettreAJourTraitsStricts`), l'interdiction de saisie manuelle du matricule INS (seule `recupererDepuisINSi` peut le poser), le marquage identité fictive/douteuse.
- **Client INSi** dans [services/insi/client.js](../../services/insi/client.js) et [services/insi/envelopes.js](../../services/insi/envelopes.js) : appel SOAP (enveloppes construites manuellement, `fast-xml-parser` pour l'analyse des réponses), authentification par **TLS mutuelle** (certificat logiciel CNDA au format PKCS#12), retry borné (3 tentatives) uniquement sur erreurs techniques/réseau, timeout 10s.
- **Endpoints applicatifs** [routes/insi.js](../../routes/insi.js) : `POST /api/insi/recuperer` (recherche par traits), `POST /api/insi/verifier` (vérification traits+matricule connu). Restreints aux rôles `super_admin, cadre_sante, medecin, infirmiere`.
- **Journalisation** : chaque appel INSi journalisé via `log_action()` — le module sépare structurellement `identite` (sensible, jamais loggée) et `audit` (sans PII), cf. `services/insi/envelopes.js:analyserReponse`.
- **RLS** dédiée sur `identites` (migration 003, resserrée en 008/009).

### Manquant
- **Aucune signature XML WS-Security** — décision documentée comme volontaire (TLS mutuelle jugée suffisante) mais à réévaluer si le cahier des charges CNDA l'exige (commentaire explicite en tête de `services/insi/client.js`).
- **Configuration CNDA absente** : `INSI_CERT_PATH`, `INSI_CERT_PASSWORD`, `INSI_ENDPOINT`, `LPS_NOM`, `LPS_VERSION`, `LPS_NIL` sont vides dans `.env.example` — sans ces valeurs, `chargerConfig()` retourne `null` et tout appel renvoie `ERREUR_TECHNIQUE` (comportement sûr par défaut, mais l'intégration réelle avec le téléservice CNDA/INSi n'est **pas opérationnelle** en l'état).
- **Pas de vérification du COG** (code officiel géographique du lieu de naissance) contre un référentiel officiel — seule une contrainte de forme (`^[0-9A-Z]{5}$`) existe en base, aucune table de référence COG n'est chargée.
- **Aucun environnement cible explicite** (test CNDA vs. production) codé en dur — dépend entièrement de la valeur de `INSI_ENDPOINT` fournie à l'exécution (non renseignée dans le dépôt).

### Fichiers concernés
- `database/migrations/003_identite_rniv.sql`
- `identite/rniv.js`, `identite/rniv.test.js`
- `services/insi/client.js`, `services/insi/envelopes.js`, `services/insi/client.test.js`, `services/insi/__fixtures__/`
- `routes/insi.js`

---

## 2. Pro Santé Connect (PSC / e-CPS)

### Implémenté
Rien. Aucun flux OIDC, aucun endpoint `/callback` ou `/logout` PSC, aucune gestion de `client_id`/`client_secret`, aucun scope, aucune gestion de `sub`/`SubjectNameID`.

### Manquant — tout
- L'authentification actuelle est un **JWT interne classique** (email + mot de passe, `bcryptjs`, cf. section Sécurité) explicitement documenté à plusieurs endroits comme un **pont temporaire** :
  - `server.js:59` : « PSC remplacera cette auth JWT en Phase 1. »
  - `routes/auth.js:10` : même mention.
  - `config/authCookie.js:11` : « À repasser en Lax si un domaine tiers doit un jour appeler l'API (webhook Brevo, **callback OIDC PSC en Phase 1**). »
- `.env.example` contient des placeholders **non utilisés dans le code** : `PSC_CLIENT_ID=`, `PSC_CLIENT_SECRET=` (aucune référence à ces variables dans aucun fichier `.js` du dépôt — vérifié par recherche).
- Aucun environnement (intégration/production) n'est ciblé puisqu'aucun appel n'existe.

### Fichiers concernés
- Aucun fichier d'implémentation. Références documentaires uniquement : `server.js:59`, `routes/auth.js:10`, `config/authCookie.js:11`, `.env.example`.

---

## 3. MSSanté

### Implémenté
- **Client SMTP dédié MSSanté** : [services/email/smtpMssante.js](../../services/email/smtpMssante.js) — via `nodemailer`, TLS avec `rejectUnauthorized: true` imposé (jamais de certificat non vérifié sur ce canal), headers de traçabilité `X-Canal: MSSante` / `X-Motif`.
- **Routage strict à double canal** : [services/email/emailRouter.js](../../services/email/emailRouter.js) + [services/email/emailTypes.js](../../services/email/emailTypes.js) — `MSSANTE_TYPES = [notification_ps, rgpd_acces, rgpd_violation]` **doivent** transiter par MSSanté (contrainte citée : EXI EDC PSC 102-6). En cas d'échec du canal MSSanté : **aucune bascule silencieuse** vers le SMTP classique — une `EmailDeliveryError` explicite est levée.
- **Journalisation systématique** de chaque tentative (succès/échec) : table `email_logs` ([database/migrations/010_create_email_logs.sql](../../database/migrations/010_create_email_logs.sql)) via [services/email/emailLogger.js](../../services/email/emailLogger.js).
- Utilisé concrètement pour la notification de violation de données RGPD (`routes/rgpd.js: POST /breaches/:id/notify-affected`).

### Manquant
- **Aucun opérateur MSSanté réel raccordé** — les paramètres `.env.example` sont explicitement fictifs : `SMTP_MSSANTE_HOST=smtp.operateur-mssante.fictif`, `SMTP_MSSANTE_USER=candy-e@structure.mssante.fr`. Le code fonctionne, mais rien ne prouve qu'un opérateur MSSanté agréé soit référencé — commentaire du code : « paramètres d'opérateur fictifs tant qu'un vrai opérateur n'est pas référencé ».
- **Aucun client IMAP** — envoi uniquement (pas de réception de messages MSSanté entrants).
- **Aucun appel à l'annuaire MSSanté** (recherche de BAL destinataires).
- **Aucun document CDA envoyé** — les emails MSSanté sont du texte/HTML simple (`body`/`bodyHtml`), jamais de pièce jointe CDA structurée.

### Fichiers concernés
- `services/email/smtpMssante.js`, `services/email/emailRouter.js`, `services/email/emailTypes.js`, `services/email/emailLogger.js`, `services/email/emailLogger.test.js`, `services/email/emailRouter.test.js`
- `database/migrations/010_create_email_logs.sql`
- `.env.example` (section `SMTP_MSSANTE_*`)

---

## 4. DMP / Mon espace santé

### Implémenté
Rien.

### Manquant — tout
- Aucun appel aux API DMP (consultation, alimentation, suppression).
- Aucune gestion de consentement patient à l'alimentation/consultation DMP (aucune colonne, aucune table de consentement dans le schéma).
- Aucun document CDA destiné au DMP (cf. section 5, aucun générateur CDA n'existe).
- Seule référence trouvée dans tout le dépôt : un commentaire dans `services/audit/audit.actions.js:14` listant explicitement ce qui **n'est pas couvert** : « pas de DMP/MSSanté/2FA/api_key/ehpad, absents du périmètre actuel » (MSSanté y est listé par erreur de commentaire — il est en fait implémenté, cf. section 3 — mais DMP est bien absent).

### Fichiers concernés
Aucun.

---

## 5. Documents CDA (CI-SIS)

### Implémenté
Rien.

### Manquant — tout
- Aucun générateur de document CDA R2 (N1 ou N3).
- Aucun volet CI-SIS (DLU, VSM, cahier de liaison, note de vaccination...).
- Aucune bibliothèque ou template CDA. `fast-xml-parser` est présent en dépendance mais utilisé **uniquement** pour l'analyse des réponses SOAP INSi ([services/insi/envelopes.js](../../services/insi/envelopes.js)), pas pour du CDA.
- Aucun namespace XML ni OID CI-SIS.
- **ViaTrajectoire explicitement documenté comme hors périmètre** : [docs/ANS_matrice_roles_EXI_EDC_PSC_102.md:9](../ANS_matrice_roles_EXI_EDC_PSC_102.md) — « aucune table, route ni intégration ViaTrajectoire n'existe dans ce dépôt à ce jour ».
- Les seuls documents PDF générés par l'application ([services/pdf/residentExport.pdf.js](../../services/pdf/residentExport.pdf.js), [services/pdf/breachDeclaration.pdf.js](../../services/pdf/breachDeclaration.pdf.js), via `pdfkit`) sont des **exports RGPD** (droit d'accès/portabilité, déclaration CNIL) — pas des documents de santé structurés CI-SIS.

### Fichiers concernés
Aucun pour le CDA/CI-SIS. Pour les PDF (hors périmètre CDA) : `services/pdf/residentExport.pdf.js`, `services/pdf/breachDeclaration.pdf.js`, `services/pdf/pdfBuilder.js`.

---

## 6. Hébergement HDS

### Implémenté / vérifiable
- **Déploiement Clever Cloud confirmé** : [.clever.json](../../.clever.json) présent à la racine (`app_id`, `org_id`, URLs de déploiement git Clever Cloud, nom d'app « C@NDY-e »).
- **Connexion PostgreSQL** via `POSTGRESQL_ADDON_URI` (variable injectée automatiquement par l'addon Clever Cloud PostgreSQL), avec repli dev sur `DATABASE_URL` — cf. [db/client.js:17](../../db/client.js), [.env.example](../../.env.example).
- Le registre des traitements ([database/migrations/011_registre_traitements.sql](../../database/migrations/011_registre_traitements.sql)) déclare explicitement, pour le traitement T01 : sous-traitant « **Clever Cloud (HDS)** », mesure de sécurité « Hébergement HDS certifié, chiffrement au repos et en transit ». C'est une **déclaration** dans le registre RGPD, pas une preuve technique vérifiable dans le code.

### Manquant / non déterminable depuis le code
- **Aucune séparation physique** entre données de santé et autres données : tout est dans le même schéma PostgreSQL `public`, sur la même instance — la séparation est **logique uniquement**, assurée par RLS (Row-Level Security) par rôle applicatif, pas par isolement de base ou de schéma dédié aux données de santé.
- Le **contrat HDS lui-même** (certificat de l'hébergeur, périmètre contractuel) n'est **pas un artefact de code** — impossible à vérifier ici.
- Pas de fichier `clevercloud/` (scripts de build spécifiques) au-delà de `.clever.json` (métadonnées CLI uniquement).

### Fichiers concernés
- `.clever.json`
- `db/client.js`
- `.env.example` (`POSTGRESQL_ADDON_URI`)
- `database/migrations/011_registre_traitements.sql` (déclaration registre, traitement T01)

### Statut : 🔶 Déploiement Clever Cloud vérifié dans le code / ❓ Certification HDS et périmètre contractuel non vérifiables sans accès à la console/aux contrats.

---

## 7. Sécurité (exigences REM SSI)

### IAM.92 — Politique mot de passe : 🔴 Non implémenté

- **Hachage** : `bcryptjs`, coût 10, correctement utilisé — [routes/auth.js:220](../../routes/auth.js), `:255`.
- **Complexité** : **aucune règle serveur**. `POST /api/auth/reset-password` et `POST /api/auth/users` acceptent `newPassword`/`password` sans aucune validation de longueur ou de complexité avant `bcrypt.hash()`. Le seul indice trouvé est un placeholder HTML côté frontend, **purement cosmétique** : `frontend/src/modules/admin/admin.js:138` — `placeholder="Min. 6 caractères"` (non enforced, ni côté client via `frontend/src/utils/validators.js`, ni côté serveur).
- **Expiration** : aucune colonne `password_expires_at`/équivalent sur `profiles`, aucun mécanisme.
- **Blocage après tentatives échouées** : aucun compteur, aucun verrouillage de compte. Les échecs de connexion sont journalisés (`AUTH_LOGIN_FAILURE` dans `audit_logs`, cf. `routes/auth.js:59-77`) mais **rien n'exploite ce journal pour bloquer** un compte ou une IP après N échecs. Le commentaire `routes/auth.js:61` le reconnaît explicitement : « détection de bruteforce, absent jusqu'ici ».
- **Historique mots de passe** : aucune table/colonne ne conserve les anciens hash — aucune vérification de non-réutilisation possible.

### IE.58 — Timeout inactivité : 🔴 Non conforme (2h requis)

- **Durée de session JWT** : `JWT_EXPIRES_IN` (défaut `8h`), signé dans `routes/auth.js:97-101`, appliqué au cookie httpOnly via [config/authCookie.js](../../config/authCookie.js) (`cookieMaxAgeMs()`).
- C'est une **expiration absolue fixe** (8h dès la connexion), **pas un timeout d'inactivité glissant**. Aucune remise à zéro du minuteur sur activité, aucun mécanisme de déconnexion automatique après une période d'inactivité de 2h comme l'exige IE.58.
- **Refresh token** : absent. `routes/auth.js:116-117` documente explicitement l'absence de mécanisme de révocation/rotation : « Une révocation réelle (token compromis, déconnexion forcée) nécessiterait une blacklist (Redis) ou une rotation de JWT_SECRET — hors périmètre ici. »

### IAM.91 — Traces d'audit : 🔶 Bon niveau, couverture non exhaustive

- **Table** : `public.audit_logs` (création [001_init_schema.sql](../../database/migrations/001_init_schema.sql), étendue [006_extend_audit_logs.sql](../../database/migrations/006_extend_audit_logs.sql)) — colonnes : `user_id, user_role, actor_email, actor_user_agent, action, table_name, record_id, resource_label, old_values, new_values, details, success, error_message, request_id, legal_basis, ip_address, created_at`.
- **Événements tracés** (référentiel [services/audit/audit.actions.js](../../services/audit/audit.actions.js)) : connexion/déconnexion (`LOGIN`, `LOGIN_FAILURE`, `LOGOUT`), changement de mot de passe, création/modification/suppression/changement de rôle/activation-désactivation de compte, CRUD sur résidents et toutes les sous-ressources cliniques (consultations, ordonnances, traitements, transmissions, notes, soins, chutes, tournées, agenda), opérations INSi, actions RGPD (registre, demandes, purge, violations).
- **Immuabilité** : `REVOKE UPDATE, DELETE ON public.audit_logs FROM PUBLIC` — [006_extend_audit_logs.sql:58](../../database/migrations/006_extend_audit_logs.sql). ✅ Conforme.
- **Masquage des données sensibles** avant écriture : [services/audit/audit.mask.js](../../services/audit/audit.mask.js) — champs `password*, token, secret, api_key, numero_secu`, et champs de texte libre clinique (`contenu, notes, observations, description, materiel, localisation, transmission`) systématiquement remplacés par `[MASQUÉ]`.
- **Durée de conservation** : 12 mois par défaut, 36 mois si `linked_to_breach=true` — [services/rgpd/purge/retention.config.js](../../services/rgpd/purge/retention.config.js), appliqué par [services/rgpd/purge/purge.job.js:purgeAuditLogs](../../services/rgpd/purge/purge.job.js). ✅ Conforme PGSSI-S.
- **Lacune identifiée** : le commentaire de `001_init_schema.sql:384` précise « aucun trigger générique n'existe en production » — la couverture dépend d'appels explicites dans chaque route. Les listes (GET de sous-ressources cliniques dans `routes/dossier-resident.js`) ne sont **pas journalisées** (commentaire explicite `routes/dossier-resident.js:60` : « Pas de journalisation du GET (liste) — volume disproportionné »). Seule la consultation d'un dossier résident individuel (`GET /api/patients/:id`) est tracée (`RESIDENT_VIEWED`).

### IE.56 / IE.57 — Vérification email : 🔴 Non implémenté

- Aucun envoi d'email de confirmation à la création de compte : `POST /api/auth/users` ([routes/auth.js:248](../../routes/auth.js)) crée directement le profil `actif: true` sans étape de vérification.
- Aucune colonne `email_verified`/`confirmed_at` sur `profiles`.
- Aucune route de confirmation d'email.

### IE.38 — Déconnexion explicite : 🔶 Partiel

- **Route** : `POST /api/auth/logout` ([routes/auth.js:118-130](../../routes/auth.js)) — efface le cookie httpOnly et journalise `LOGOUT`.
- **Invalidation côté serveur** : **absente**. Le JWT est stateless — le commentaire du code le dit explicitement (`routes/auth.js:115-117`) : pas de blacklist Redis, pas de rotation de secret. Un token intercepté avant l'appel à `/logout` reste valide jusqu'à son expiration naturelle (max 8h), même après déconnexion applicative.

### GEN.11 — Bonnes pratiques dev : 🔶 Partiel

- Pas de fichier PSSI/guide de sécurité dev dédié trouvé. En revanche, gouvernance documentée : [docs/RGPD_GOVERNANCE.md](../RGPD_GOVERNANCE.md) (critère de déclenchement des mises à jour registre/AIPD), [docs/ANS_matrice_roles_EXI_EDC_PSC_102.md](../ANS_matrice_roles_EXI_EDC_PSC_102.md) (matrice de rôles justifiée point par point), et `CLAUDE.md` (instructions opérationnelles pour les agents/développeurs, incluant un rappel RGPD automatique).
- **Dépendances** : `package-lock.json` présent (verrouillage des versions) ✅. Aucun fichier de CI (`.github/workflows` absent) n'exécute `npm audit` ou équivalent — pas de preuve d'audit de dépendances automatisé.

### GEN.21 — Sauvegardes : ❓

- Aucune procédure de sauvegarde documentée dans le dépôt. La configuration de backup PostgreSQL Clever Cloud se gère typiquement via la console Clever Cloud (hors code source) — **impossible à déterminer sans accès à l'environnement de production**.

### Headers HTTP de sécurité : 🔴 Non implémenté (sauf CORS)

- **Aucun middleware `helmet`** (absent de `package.json`).
- Recherche exhaustive dans le code (`grep` sur tous les `.js`) : **aucune occurrence** de `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`, `Referrer-Policy`.
- **`X-Powered-By`** : non désactivé — `app.disable('x-powered-by')` absent de [server.js](../../server.js) ; Express envoie donc cet en-tête par défaut, révélant la technologie serveur.
- **CORS** ([server.js:37-42](../../server.js)) : restreint à `FRONTEND_URL` en production (`NODE_ENV === 'production'`), ouvert à toute origine en développement. `credentials: false`. C'est le seul point de sécurité HTTP réellement implémenté (cf. commit récent `e3b6504` « Restreint CORS aux origines de confiance en production »).

### Fichiers concernés (section 7)
- `routes/auth.js`, `middleware/auth.js`, `middleware/requireRole.js`, `middleware/setUserContext.js`, `config/authCookie.js`
- `services/audit/audit.service.js`, `services/audit/audit.actions.js`, `services/audit/audit.mask.js`
- `database/migrations/001_init_schema.sql`, `006_extend_audit_logs.sql`, `004_reset_password.sql`
- `services/rgpd/purge/purge.job.js`, `services/rgpd/purge/retention.config.js`
- `server.js`

---

## 8. RPPS / FINESS (annuaires)

### Implémenté
- Colonne `profiles.rpps TEXT` ([001_init_schema.sql:71](../../database/migrations/001_init_schema.sql)) — champ **déclaratif libre**, éditable via `routes/profiles.js` (`COLONNES_AUTORISEES` inclut `rpps`), sans format imposé ni vérification.
- Mention dans le registre RGPD ([011_registre_traitements.sql:114](../../database/migrations/011_registre_traitements.sql)) : « Identifiants RPPS/ADELI » cités comme catégorie de donnée traitée pour T02 (authentification professionnelle) — déclaratif uniquement.

### Manquant
- **Aucun appel à l'annuaire RPPS** ni à l'API Annuaire Santé (aucune requête HTTP sortante vers un service d'annuaire trouvée dans le code).
- **Aucun code FINESS d'établissement** référencé nulle part dans le schéma ou le code (aucune colonne `finess`).
- Aucune vérification de cohérence entre le RPPS saisi et une source officielle.

### Fichiers concernés
- `database/migrations/001_init_schema.sql` (colonne `rpps`)
- `routes/profiles.js` (édition du champ)
- `database/migrations/011_registre_traitements.sql` (mention déclarative)

---

## 9. SIDOBA / API FHIR

### Implémenté
Rien.

### Manquant — tout
- Aucun endpoint ni client FHIR (R4 ou autre version).
- Aucune référence à l'API SIDOBA (CNSA).
- Aucune ressource FHIR définie (`Patient`, `Practitioner`, `Organization`...).
- Recherche exhaustive (`grep -rni "fhir\|sidoba"`) sur l'ensemble du dépôt (hors `node_modules`) : **zéro résultat**.

### Fichiers concernés
Aucun.

---

## 10. Architecture générale

### Stack technique
- **Runtime** : Node.js ≥ 20 (`package.json:engines`).
- **Framework serveur** : Express 4.19.2.
- **Base de données** : PostgreSQL, accès via `pg` 8.11.5 — **pas d'ORM**, requêtes SQL directes + petit constructeur de requêtes maison ([db/sql-builder.js](../../db/sql-builder.js)).
- **Authentification** : `jsonwebtoken` 9.0.2 (JWT), `bcryptjs` 2.4.3 (hachage mots de passe), `cookie-parser` 1.4.7 (cookie httpOnly).
- **Email** : `nodemailer` 9.0.3 (SMTP classique + MSSanté), `@getbrevo/brevo` 6.0.2 (API REST Brevo en production).
- **XML/SOAP** : `fast-xml-parser` 5.9.3 (réponses INSi uniquement).
- **PDF** : `pdfkit` 0.19.1 (exports RGPD).
- **Autres** : `cors` 2.8.5, `dotenv` 16.4.5, `ms` 2.1.3.
- **Dev** : `nodemon` 3.1.4. Tests : `node --test` natif (pas de framework tiers), fichiers `*.test.js` colocalisés (`identite/`, `services/insi/`, `services/email/`).
- **Hébergement** : Clever Cloud (`.clever.json`), addon PostgreSQL.
- **Frontend** : JavaScript vanilla (aucun framework, pas de bundler visible), routage par hash (`frontend/src/core/router.js`), servi statiquement par Express (`app.use(express.static(...))`, [server.js:55](../../server.js)).

### Modèle de données — tables PostgreSQL

| Table | Rôle | Colonnes principales |
|---|---|---|
| `profiles` | Identité applicative des professionnels | id, email, prenom, nom, role, specialite, rpps, telephone, actif, password_hash, reset_token_hash/expires_at, account_closed_at |
| `residents` | Dossier administratif résident | id, nom, prenom, date_naissance, sexe, groupe_sanguin, numero_secu, medecin_id, allergies, constantes ponctuelles, gir, is_demo, discharge_date, purge_status, purge_scheduled_at |
| `identites` | Identité RNIV/INS (1-1 residents) | traits stricts, matricule_ins, oid_ins, statut_identite, justificatif_type |
| `consultations` | Consultations médicales | resident_id, medecin_id, date_consult, type_acte, notes, constantes |
| `transmissions` | Transmissions d'équipe | resident_id, type, priorite, contenu, cible_role, lu, auteur_id |
| `chutes` | Déclarations de chute | resident_id, lieu, activite, constantes, lesions, acteurs_prevenus |
| `documents` | Métadonnées documents | resident_id, nom, type_doc, storage_path, mime_type |
| `ordonnances` | Ordonnances | resident_id, medecin_id, reference, contenu, statut |
| `traitements` | Prescriptions médicamenteuses | resident_id, medicament, dci, dose, voie, frequence, actif, prescripteur_id |
| `constantes` | Constantes vitales | resident_id, tension, fréquence cardiaque, SpO2, température, glycémie |
| `agenda` | Rendez-vous | resident_id, medecin_id, date_rdv, type_rdv, statut |
| `tournees_soins` | Tournées de soins (toilette, repas, élimination...) | resident_id, type_tournee, saisie_par |
| `notes_suivi` | Notes de suivi libres | resident_id, auteur_id, contenu |
| `soins_pansements` | Soins de plaies/pansements | resident_id, type_soin, stade, materiel |
| `audit_logs` | Journal d'audit (immuable) | user_id, action, table_name, old/new_values, success, legal_basis, created_at |
| `email_logs` | Journal d'envoi email | email_type, channel (mssante/classic), status, message_id |
| `registre_traitements` | Registre Art. 30 RGPD | code, finalite, base_legale, categories_donnees, destinataires, sous_traitants, duree_conservation |
| `registre_meta` | Note AIPD (singleton) | note_aipd, updated_at, updated_by |
| `data_breaches` | Registre violations Art. 33-34 | nature, categories_donnees, statut, notification_cnil_le |
| `rgpd_requests` | Demandes d'exercice de droits Art. 15-22 | type, resident_id, statut, date_echeance |
| `purge_runs` | État du job de purge (singleton) | last_run_at, last_status, last_results |

### Variables d'environnement attendues (sans valeurs)
`POSTGRESQL_ADDON_URI` / `DATABASE_URL`, `PORT`, `NODE_ENV`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, `PSC_CLIENT_ID`, `PSC_CLIENT_SECRET` (non utilisées dans le code), `INSI_CERT_PATH`, `INSI_CERT_PASSWORD`, `INSI_ENDPOINT`, `LPS_NOM`, `LPS_VERSION`, `LPS_NIL`, `DPO_EMAIL`, `PURGE_JOB_ENABLED`, `SMTP_CLASSIC_HOST/PORT/USER/PASS/FROM/TLS` (non câblé par défaut), `BREVO_SMTP_HOST/PORT/USER/PASS`, `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `SMTP_MSSANTE_HOST/PORT/USER/PASS/FROM/TLS/STARTTLS`.

### Routes API (complètes)
- **Auth** (`/api/auth`, publiques sauf mention) : `POST /login`, `POST /logout`, `GET /me` (auth), `POST /forgot-password`, `POST /reset-password`, `POST /users` (auth + `super_admin`)
- **INSi** (`/api/insi`, rôles restreints) : `POST /recuperer`, `POST /verifier`
- **Patients/résidents** (`/api/patients`) : `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `POST /:id/sortie`, `DELETE /:id`
- **Profils** (`/api/profiles`) : `GET /`, `PATCH /:id`, `DELETE /:id`
- **Dossier résident — sous-ressources** (`/api/constantes`, `/api/consultations`, `/api/traitements`, `/api/soins_pansements`, `/api/notes_suivi`, `/api/chutes`, `/api/documents`, `/api/ordonnances`) : `GET /` (+ filtres), `POST /` (sauf documents/ordonnances, lecture seule), `PATCH /:id` (sauf soins_pansements/documents/ordonnances)
- **Agenda** (`/api/agenda`) : `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`
- **Transmissions** (`/api/transmissions`) : `GET /`, `POST /`, `PATCH /:id`
- **Tournées** (`/api/tournees_soins`) : `GET /`, `POST /`, `PATCH /:id`
- **Stats** (`/api/stats`) : `GET /`
- **Dashboard** (`/api/dashboard`) : `GET /`
- **Audit** (`/api/audit_logs`) : `GET /` (rôles `super_admin, dpo`)
- **RGPD** (`/api/rgpd`, rôles `super_admin, dpo`) : `GET /dashboard`, `GET /registre`, `PATCH /registre/:code`, `PATCH /registre-note`, `GET /purge/pending`, `POST /purge/:residentId/approve`, `POST /purge/:residentId/reject`, `GET /requests`, `POST /requests`, `PATCH /requests/:id`, `GET /requests/:id/export`, `GET /breaches`, `POST /breaches`, `POST /breaches/:id/link-audit`, `GET /breaches/:id/cnil-pdf`, `POST /breaches/:id/notify-affected`, `POST /violation`
- **Santé** : `GET /health` (public, non protégé)

### Middlewares actifs (server.js)
1. `cors` (origine restreinte en production, cf. section 7)
2. `express.json()`
3. `cookie-parser`
4. `authMiddleware` (vérification JWT, monté sur `/api` sauf `/api/auth`)
5. `setUserContext` (positionne les GUC de session RLS `app.current_user_id`/`app.current_role`, ouvre une transaction par requête, attache `req.dbClient`)
6. `auditMiddleware` (attache `req.audit()`)
7. `requireRole(...)` par route (contrôle de rôle applicatif, en plus des policies RLS PostgreSQL — défense en profondeur)

Aucun middleware de rate-limiting, aucun helmet.

### Frontend
- Vanilla JS, pas de framework (pas de React/Vue/Angular dans `package.json`, aucun bundler détecté).
- **Pages statiques** : `frontend/public/login.html`, `forgot-password.html`, `reset-password.html`, `index.html` (shell SPA).
- **Core** : `src/core/api.js` (client HTTP), `auth.js`, `rbac.js` (matrice de permissions, miroir frontend de la RLS backend), `router.js` (routage par hash), `state.js`.
- **Modules métier** : `admin`, `agenda`, `dashboard`, `patient` (fiche-chute, fiche-liaison, gir-calculator, patient-list, patient-record), `rgpd`, `soins`, `stats`, `tournee`, `traitements`, `transmissions`.
- **Styles** : système de tokens CSS (`tokens.css`), thèmes clair/sombre (`themes/light.css`, `dark.css`), composants (`badge`, `button`, `card`, `form`, `modal`, `table`, `toast`).

---

## Annexe — Liste complète des tables

`profiles`, `residents`, `identites`, `consultations`, `transmissions`, `chutes`, `documents`, `ordonnances`, `traitements`, `constantes`, `agenda`, `tournees_soins`, `notes_suivi`, `soins_pansements`, `audit_logs`, `email_logs`, `registre_traitements`, `registre_meta`, `data_breaches`, `rgpd_requests`, `purge_runs`

(21 tables applicatives, migrations `000` à `013` dans `database/migrations/`)

## Annexe — Liste complète des routes API

Voir section 10 « Routes API (complètes) » ci-dessus — reprend l'intégralité des routeurs montés dans `server.js`.

## Annexe — Variables d'environnement

Voir section 10 « Variables d'environnement attendues » ci-dessus — extraites de `.env.example`, sans valeurs.
