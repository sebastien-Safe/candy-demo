-- ==============================================================================
-- [ candy-e ] — SUPPRESSION DU RÔLE ash
-- Fichier    : database/migrations/014_remove_ash_role.sql
-- Prérequis  : 008_role_matrix_migration.sql, 009_remove_medecin_demo.sql
--
-- ash avait été conservé DEPRECATED (pas supprimé) en 008, en attendant un
-- audit des comptes existants. Cet audit (2026-07-17) a confirmé 0 compte
-- avec role = 'ash' en base. Ce fichier met en œuvre la clôture :
--   1. Garde-fou : bloque toute exécution si des comptes ash existent
--      encore — on ne supprime jamais un rôle silencieusement sous des
--      comptes actifs (cf. contrainte absolue de la matrice de rôles,
--      même principe que 009_remove_medecin_demo.sql).
--   2. Retire 'ash' de la contrainte CHECK sur profiles.role.
--   3. Retire 'ash' des 7 policies RLS SELECT qui le référencent encore
--      (residents, documents, notes_suivi, agenda, transmissions, chutes,
--      identites) — liste vérifiée en interrogeant pg_policies en
--      production, pas reconstituée depuis l'historique des migrations.
-- ==============================================================================

BEGIN;

-- ── Garde-fou ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.profiles WHERE role = 'ash';
    IF v_count > 0 THEN
        RAISE EXCEPTION
            'Migration bloquée : % compte(s) ash existent encore en base. Réassigner ou supprimer ces comptes avant d''exécuter cette migration.',
            v_count;
    END IF;
END $$;

-- ── Contrainte CHECK ──────────────────────────────────────────────────────
ALTER TABLE public.profiles
    DROP CONSTRAINT profiles_role_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role = ANY (ARRAY[
        'super_admin','directeur_etablissement','cadre_sante','medecin',
        'infirmiere','aide_soignante','intervenant_soins_exterieur',
        'secretaire','dpo'
    ]));

COMMENT ON COLUMN public.profiles.role IS
    'Rôle applicatif. Matrice conforme REM-MS-DUI-Va2 — cf. docs/ANS_matrice_roles_EXI_EDC_PSC_102.md. medecin_demo supprimé (009). ash supprimé (014).';

-- ── Policies RLS : retrait de la branche ash ──────────────────────────────

DROP POLICY residents_select ON public.residents;
CREATE POLICY residents_select ON public.residents
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','directeur_etablissement','cadre_sante','medecin',
            'infirmiere','aide_soignante','intervenant_soins_exterieur','secretaire'
        ])
    );

DROP POLICY documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','secretaire'
        ])
    );

DROP POLICY notes_select ON public.notes_suivi;
CREATE POLICY notes_select ON public.notes_suivi
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','secretaire'
        ])
    );

DROP POLICY agenda_select ON public.agenda;
CREATE POLICY agenda_select ON public.agenda
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','directeur_etablissement','cadre_sante','medecin','infirmiere','aide_soignante','secretaire'
        ])
    );

DROP POLICY transmissions_select ON public.transmissions;
CREATE POLICY transmissions_select ON public.transmissions
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','directeur_etablissement','cadre_sante','medecin','infirmiere','aide_soignante',
            'intervenant_soins_exterieur','secretaire'
        ])
    );

DROP POLICY chutes_select ON public.chutes;
CREATE POLICY chutes_select ON public.chutes
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','secretaire'
        ])
    );

DROP POLICY identites_select ON public.identites;
CREATE POLICY identites_select ON public.identites
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','secretaire'
        ])
    );

COMMIT;

-- ==============================================================================
-- FIN — database/migrations/014_remove_ash_role.sql
-- ==============================================================================
