-- ==============================================================================
-- [ candy-e ] — IDENTITÉ RÉSIDENT CONFORME RNIV (P1.1)
-- Fichier    : database/migrations/003_identite_rniv.sql
-- Prérequis  : 001_init_schema.sql, 002_rls_policies.sql
--
-- Le RNIV (Référentiel National d'Identitovigilance) impose que chaque
-- résident dispose d'une identité dont le niveau de confiance est tracé.
-- Table dédiée (1-1 avec public.residents) plutôt que des colonnes ajoutées
-- directement sur residents : isole les traits stricts et le cycle de vie
-- INSi/justificatif du dossier administratif existant.
--
-- Les règles métier qui gouvernent les transitions de statut (rétrogradation
-- sur modification d'un trait strict, interdiction de saisie manuelle du
-- matricule INS, etc.) sont implémentées côté application dans
-- identite/rniv.js. Les CHECK ci-dessous ne sont qu'un filet de sécurité en
-- base — ils empêchent un état incohérent d'être persisté, mais ne portent
-- pas la logique de transition elle-même.
-- ==============================================================================

CREATE TABLE public.identites (
    resident_id                 UUID        PRIMARY KEY REFERENCES public.residents(id) ON DELETE CASCADE,

    -- Traits stricts (cf. identite/rniv.js:TRAITS_STRICTS) — toute
    -- modification de l'un d'eux rétrograde le statut en 'PROVISOIRE'.
    nom_naissance               TEXT        NOT NULL,
    premier_prenom_naissance    TEXT        NOT NULL,
    liste_prenoms                TEXT[]      NOT NULL DEFAULT '{}',
    date_naissance               DATE        NOT NULL,
    sexe                         CHAR(1)     NOT NULL CHECK (sexe = ANY (ARRAY['M','F','I'])),
    code_insee_lieu_naissance    TEXT        CHECK (code_insee_lieu_naissance ~ '^[0-9A-Z]{5}$'),

    -- Récupération INSi — ne jamais alimenter matricule_ins/oid_ins depuis
    -- une saisie manuelle (cf. identite/rniv.js:recupererDepuisINSi, seule
    -- fonction autorisée à les poser).
    matricule_ins                TEXT        UNIQUE CHECK (matricule_ins ~ '^[0-9]{15}$'),
    oid_ins                      TEXT,       -- OID du téléservice INSi (NIR/NIA) — pas de valeur imposée en base

    -- Cycle de vie de la qualification
    statut_identite               TEXT        NOT NULL DEFAULT 'PROVISOIRE'
                                            CHECK (statut_identite = ANY (ARRAY['PROVISOIRE','RECUPEREE','VALIDEE','QUALIFIEE'])),
    identite_fictive              BOOLEAN     NOT NULL DEFAULT FALSE,
    identite_douteuse             BOOLEAN     NOT NULL DEFAULT FALSE,
    date_qualification            TIMESTAMPTZ,
    justificatif_type             TEXT        CHECK (justificatif_type = ANY (ARRAY['CNI','passeport','titre_sejour','permis_conduire'])),

    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Une identité fictive ou signalée douteuse ne peut jamais être qualifiée
    -- (ni même récupérée/validée) : ces deux drapeaux forcent 'PROVISOIRE'.
    CONSTRAINT chk_fictive_jamais_qualifiee
        CHECK (NOT identite_fictive OR statut_identite = 'PROVISOIRE'),
    CONSTRAINT chk_douteuse_jamais_qualifiee
        CHECK (NOT identite_douteuse OR statut_identite = 'PROVISOIRE'),

    -- QUALIFIEE = RECUPEREE (INSi OK) ET VALIDEE (justificatif fort) en même temps.
    CONSTRAINT chk_recuperee_requiert_ins
        CHECK (statut_identite NOT IN ('RECUPEREE','QUALIFIEE') OR (matricule_ins IS NOT NULL AND oid_ins IS NOT NULL)),
    CONSTRAINT chk_validee_requiert_justificatif
        CHECK (statut_identite NOT IN ('VALIDEE','QUALIFIEE') OR justificatif_type IS NOT NULL),
    CONSTRAINT chk_qualifiee_requiert_date
        CHECK (statut_identite <> 'QUALIFIEE' OR date_qualification IS NOT NULL)
);

COMMENT ON TABLE public.identites IS
    'Identité RNIV du résident (1-1 avec residents). Statut de qualification et traits stricts INS — cf. identite/rniv.js pour les règles de transition.';
COMMENT ON COLUMN public.identites.matricule_ins IS
    'Matricule INS (NIR ou NIA), 15 chiffres. Ne jamais saisir manuellement — uniquement renseigné via identite/rniv.js:recupererDepuisINSi (retour du téléservice INSi).';
COMMENT ON COLUMN public.identites.statut_identite IS
    'PROVISOIRE (défaut) -> RECUPEREE (INSi) / VALIDEE (justificatif fort) -> QUALIFIEE (les deux réunis). Toute modification d''un trait strict rétrograde en PROVISOIRE.';

CREATE TRIGGER trg_identites_updated_at
    BEFORE UPDATE ON public.identites
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_identites_statut ON public.identites(statut_identite);

-- ==============================================================================
-- RLS — mêmes rôles que residents_select/insert/update/delete
-- (patient.read / patient.write dans rbac.js — pas de granularité plus fine
-- que le niveau module aujourd'hui).
-- ==============================================================================

ALTER TABLE public.identites ENABLE ROW LEVEL SECURITY;

CREATE POLICY identites_select ON public.identites
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'admin_crm','administrateur','cadre','medecin',
            'infirmiere','aide_soignante','kine','psycho','ergo','ash','secretaire'
        ])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents r WHERE r.id = identites.resident_id AND r.is_demo = true))
    );

CREATE POLICY identites_insert ON public.identites
    FOR INSERT WITH CHECK (
        get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','infirmiere'])
    );

CREATE POLICY identites_update ON public.identites
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','infirmiere']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','infirmiere']));

CREATE POLICY identites_delete ON public.identites
    FOR DELETE USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur']));

-- ==============================================================================
-- FIN — database/migrations/003_identite_rniv.sql
-- Suite : identite/rniv.js (règles métier)
-- ==============================================================================
