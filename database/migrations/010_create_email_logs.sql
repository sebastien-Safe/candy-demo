-- ==============================================================================
-- [ candy-e ] — JOURNALISATION DES ENVOIS D'EMAIL
-- Fichier    : database/migrations/010_create_email_logs.sql
-- Prérequis  : 001_init_schema.sql (extension pgcrypto déjà activée)
--
-- Trace chaque tentative d'envoi (succès ET échec) réalisée par
-- services/email/emailRouter.js — traçabilité ANS/PSC pour le canal MSSanté
-- (EXI EDC PSC 102-6) et preuve de notification pour le RGPD (Art. 33 :
-- déclaration de violation de données, réponse à une demande d'accès).
-- ==============================================================================

CREATE TABLE public.email_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    email_type      VARCHAR(50) NOT NULL,
    channel         VARCHAR(20) NOT NULL CHECK (channel = ANY (ARRAY['mssante', 'classic'])),
    recipient       VARCHAR(255) NOT NULL,
    subject         VARCHAR(500),
    status          VARCHAR(20) NOT NULL CHECK (status = ANY (ARRAY['success', 'error'])),
    message_id      VARCHAR(255),
    error_message   TEXT,
    meta            JSONB
);

CREATE INDEX idx_email_logs_type ON public.email_logs(email_type);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at);

COMMENT ON TABLE public.email_logs IS
    'Journal de tous les envois d''email (succès et échec) via services/email/emailRouter.js. channel distingue le facteur MSSanté (obligatoire pour notification_ps/rgpd_acces/rgpd_violation) du facteur SMTP classique.';
COMMENT ON COLUMN public.email_logs.email_type IS
    'Valeur de EMAIL_TYPES (services/email/emailTypes.js) : notification_ps, alerte_technique, usage_metier, rgpd_acces, rgpd_violation.';
COMMENT ON COLUMN public.email_logs.error_message IS
    'Message d''erreur applicatif (jamais les identifiants SMTP) en cas de status = error.';

-- ==============================================================================
-- FIN — database/migrations/010_create_email_logs.sql
-- ==============================================================================
