-- ==============================================================================
-- [ candy-e ] — EXTENSION DE audit_logs POUR LE MODULE RGPD
-- Fichier    : database/migrations/006_extend_audit_logs.sql
-- Prérequis  : 001_init_schema.sql (table audit_logs), 005_add_dpo_role.sql
--
-- La table audit_logs existante (001_init_schema.sql) est conservée telle
-- quelle (user_id, user_role, action, table_name, record_id, details,
-- ip_address, created_at) — pas de recréation, pour ne pas casser
-- routes/audit.js ni la fonction log_action(). On ajoute uniquement les
-- colonnes nécessaires à la couverture RGPD étendue (masquage avant/après,
-- résultat de l'action, corrélation, base légale) :
--
--   - actor_email / actor_user_agent : dénormalisés pour résister à la
--     suppression du profil (actor_id référence déjà profiles.id ON DELETE
--     SET NULL — sans dénormalisation, l'auteur d'une action ancienne
--     deviendrait introuvable après suppression de compte).
--   - resource_label : libellé lisible pour le DPO (ex. "Dupont Marie —
--     résident #123"), table_name/record_id existants jouent déjà le rôle
--     de resource_type/resource_id.
--   - old_values / new_values : valeurs avant/après, masquées côté
--     application (cf. futur services/audit/audit.mask.js) avant insertion.
--   - success / error_message : les tentatives échouées doivent aussi être
--     tracées (ex. accès refusé, échec d'export).
--   - request_id : corrélation avec les logs applicatifs Clever Cloud.
--   - legal_basis : base légale RGPD de l'action journalisée.
--
-- IMMUTABILITÉ : REVOKE UPDATE/DELETE FROM PUBLIC. Un utilisateur applicatif
-- connecté avec un rôle Postgres non-propriétaire de la table ne peut donc
-- plus modifier ni supprimer une ligne — seul le rôle propriétaire
-- (migrations) le peut, pour la purge légale (cf. futur purge.job.js).
-- ==============================================================================

ALTER TABLE public.audit_logs
    ADD COLUMN actor_email      TEXT,
    ADD COLUMN actor_user_agent TEXT,
    ADD COLUMN resource_label   TEXT,
    ADD COLUMN old_values       JSONB,
    ADD COLUMN new_values       JSONB,
    ADD COLUMN success          BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN error_message    TEXT,
    ADD COLUMN request_id       TEXT,
    ADD COLUMN legal_basis      TEXT;

COMMENT ON COLUMN public.audit_logs.actor_email IS
    'Email de l''auteur, dénormalisé pour rester lisible même si profiles.id référencé est supprimé (ON DELETE SET NULL sur user_id).';
COMMENT ON COLUMN public.audit_logs.resource_label IS
    'Libellé lisible de la ressource concernée, pour affichage dans le tableau de bord DPO (ex. "Dupont Marie — résident #123").';
COMMENT ON COLUMN public.audit_logs.old_values IS
    'Valeur avant action, champs sensibles masqués côté application avant insertion — ne jamais insérer de donnée de santé en clair ici.';
COMMENT ON COLUMN public.audit_logs.new_values IS
    'Valeur après action, mêmes règles de masquage que old_values.';
COMMENT ON COLUMN public.audit_logs.legal_basis IS
    'Base légale RGPD de l''action journalisée (ex. "Art. 9(2)(h) RGPD").';

CREATE INDEX idx_audit_logs_action  ON public.audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

REVOKE UPDATE, DELETE ON public.audit_logs FROM PUBLIC;

COMMENT ON TABLE public.audit_logs IS
    'Journal d''audit. Étendu en 006_extend_audit_logs.sql pour le module RGPD (masquage avant/après, succès/échec, base légale). UPDATE/DELETE révoqués de PUBLIC : la table n''est modifiable que par son propriétaire (migrations), notamment pour la purge légale à 12 mois (36 si linked_to_breach).';
