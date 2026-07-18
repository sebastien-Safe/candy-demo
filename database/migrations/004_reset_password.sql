-- ==============================================================================
-- [ candy-e ] — TOKEN DE RÉINITIALISATION DE MOT DE PASSE
-- Fichier    : database/migrations/004_reset_password.sql
-- Prérequis  : 001_init_schema.sql
--
-- Remplace le flux du service d'authentification externe d'origine
-- (resetPasswordForEmail / setSession / updateUser) — cf. routes/auth.js
-- (POST /forgot-password, POST /reset-password). Le token est stocké
-- haché (jamais en clair) et à usage unique, avec expiration courte.
--
-- ⚠️ L'ENVOI RÉEL DE L'EMAIL N'EST PAS IMPLÉMENTÉ (aucun service SMTP dans
-- ce dépôt) — routes/auth.js journalise le lien de réinitialisation côté
-- serveur en attendant un choix de fournisseur.
-- ==============================================================================

ALTER TABLE public.profiles
    ADD COLUMN reset_token_hash       TEXT,
    ADD COLUMN reset_token_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.reset_token_hash IS
    'SHA-256 du token de réinitialisation envoyé par email (jamais stocké en clair). NULL une fois utilisé/expiré.';
COMMENT ON COLUMN public.profiles.reset_token_expires_at IS
    'Expiration du token de réinitialisation (courte durée, ex. 1h).';
