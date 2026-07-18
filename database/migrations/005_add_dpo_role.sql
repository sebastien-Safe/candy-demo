-- ==============================================================================
-- [ candy-e ] — AJOUT DU RÔLE DPO
-- Fichier    : database/migrations/005_add_dpo_role.sql
-- Prérequis  : 001_init_schema.sql
--
-- Ajoute 'dpo' à la liste des rôles autorisés sur profiles.role, pour le
-- module RGPD (registre des traitements, purge, droits des personnes,
-- tableau de bord). Le rôle DPO n'a accès à aucune donnée de soin : ses
-- permissions sont scoped aux routes RGPD (cf. routes/rgpd.js, à venir) et
-- à la lecture du journal d'audit (routes/audit.js).
--
-- Postgres ne permet pas d'ALTER un CHECK existant : on le supprime et on
-- le recrée avec la valeur ajoutée. Le nom de contrainte utilisé
-- (profiles_role_check) est celui généré automatiquement par Postgres pour
-- un CHECK inline sans nom explicite sur la colonne role.
-- ==============================================================================

ALTER TABLE public.profiles
    DROP CONSTRAINT profiles_role_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role = ANY (ARRAY[
        'admin_crm','medecin','secretaire','medecin_demo',
        'administrateur','cadre','infirmiere','aide_soignante',
        'ash','kine','psycho','ergo','dpo'
    ]));

COMMENT ON COLUMN public.profiles.role IS
    'Rôle applicatif. ''dpo'' ajouté en 005_add_dpo_role.sql pour le module RGPD — aucun accès aux données de soin, accès réservé aux routes RGPD et au journal d''audit.';
