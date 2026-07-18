-- ==============================================================================
-- [ candy-e ] — SUPPRESSION DU RÔLE medecin_demo
-- Fichier    : database/migrations/009_remove_medecin_demo.sql
-- Prérequis  : 008_role_matrix_migration.sql
--
-- medecin_demo avait été conservé DEPRECATED (pas supprimé) en 008, en
-- attendant une décision explicite. Ce fichier la met en œuvre :
--   1. Garde-fou : bloque toute exécution si des comptes medecin_demo
--      existent encore — on ne supprime jamais un rôle silencieusement sous
--      des comptes actifs (cf. contrainte absolue de la matrice de rôles).
--   2. Retire 'medecin_demo' de la contrainte CHECK sur profiles.role.
--   3. Retire les 12 branches RLS conditionnelles
--      "OR (get_my_profile_role() = 'medecin_demo' AND ...)" — c'était le
--      seul consommateur de residents.is_demo, qui devient une colonne
--      dormante (non supprimée ici : suppression de colonne hors périmètre
--      d'une migration de rôles, décision séparée si besoin).
--
-- 'ash' reste DEPRECATED mais conservé (cf. 008) — non concerné ici.
-- ==============================================================================

BEGIN;

-- ── Garde-fou ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.profiles WHERE role = 'medecin_demo';
    IF v_count > 0 THEN
        RAISE EXCEPTION
            'Migration bloquée : % compte(s) medecin_demo existent encore en base. Réassigner ou supprimer ces comptes avant d''exécuter cette migration.',
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
        'secretaire','dpo',
        'ash'  -- deprecated, conservé (cf. 008_role_matrix_migration.sql)
    ]));

COMMENT ON COLUMN public.profiles.role IS
    'Rôle applicatif. Matrice conforme REM-MS-DUI-Va2 — cf. docs/ANS_matrice_roles_EXI_EDC_PSC_102.md. medecin_demo supprimé (009). ash deprecated (ne plus créer).';

COMMENT ON COLUMN public.residents.is_demo IS
    'Colonne dormante depuis 009_remove_medecin_demo.sql : son seul consommateur (les policies RLS conditionnelles du rôle medecin_demo) a été retiré. Conservée par prudence (pas de suppression de colonne dans une migration de rôles) — à réévaluer séparément.';

-- ── Policies RLS : retrait de la branche medecin_demo ────────────────────

DROP POLICY residents_select ON public.residents;
CREATE POLICY residents_select ON public.residents
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','directeur_etablissement','cadre_sante','medecin',
            'infirmiere','aide_soignante','intervenant_soins_exterieur','ash','secretaire'
        ])
    );

DROP POLICY consultations_select ON public.consultations;
CREATE POLICY consultations_select ON public.consultations
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['super_admin','directeur_etablissement','cadre_sante','medecin','infirmiere'])
    );

DROP POLICY ordonnances_select ON public.ordonnances;
CREATE POLICY ordonnances_select ON public.ordonnances
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere','secretaire'])
    );

DROP POLICY documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','ash','secretaire'
        ])
    );

DROP POLICY notes_select ON public.notes_suivi;
CREATE POLICY notes_select ON public.notes_suivi
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','ash','secretaire'
        ])
    );

DROP POLICY agenda_select ON public.agenda;
CREATE POLICY agenda_select ON public.agenda
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','directeur_etablissement','cadre_sante','medecin','infirmiere','aide_soignante','ash','secretaire'
        ])
    );

DROP POLICY transmissions_select ON public.transmissions;
CREATE POLICY transmissions_select ON public.transmissions
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','directeur_etablissement','cadre_sante','medecin','infirmiere','aide_soignante',
            'intervenant_soins_exterieur','ash','secretaire'
        ])
    );

DROP POLICY constantes_select ON public.constantes;
CREATE POLICY constantes_select ON public.constantes
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere','aide_soignante'])
    );

DROP POLICY traitements_select ON public.traitements;
CREATE POLICY traitements_select ON public.traitements
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere'])
    );

DROP POLICY soins_select ON public.soins_pansements;
CREATE POLICY soins_select ON public.soins_pansements
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere'])
    );

DROP POLICY chutes_select ON public.chutes;
CREATE POLICY chutes_select ON public.chutes
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','ash','secretaire'
        ])
    );

DROP POLICY identites_select ON public.identites;
CREATE POLICY identites_select ON public.identites
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','ash','secretaire'
        ])
    );

COMMIT;

-- ==============================================================================
-- FIN — database/migrations/009_remove_medecin_demo.sql
-- ==============================================================================
