-- ==============================================================================
-- [ candy-e ] — RLS RÉCONCILIÉE AVEC LA MATRICE rbac.js (frontend)
-- Fichier    : database/migrations/002_rls_policies.sql
-- Prérequis  : 001_init_schema.sql
--
-- CONTEXTE : les ~90 policies RLS réelles observées sur le projet source
-- ne correspondent PAS à la matrice de permissions à 12 rôles de
-- frontend/src/core/rbac.js. Sur patients/consultations/ordonnances/
-- documents/notes_suivi/agenda, seuls medecin/secretaire/admin_crm/
-- medecin_demo avaient des policies (les 8 autres rôles n'avaient AUCUN
-- accès serveur). Sur traitements/transmissions/soins_pansements/
-- constantes/chutes/tournees_soins, c'était l'inverse : ouvert à TOUT rôle
-- authentifié sans distinction. Décision validée avec l'utilisateur :
-- réconcilier avec rbac.js plutôt que transposer tel quel. Ce fichier
-- n'implémente que la version réconciliée.
--
-- MÉCANISME DE REMPLACEMENT DE auth.uid()/auth.role() (Clever Cloud n'a pas
-- de schéma `auth`) : GUC de session posées par l'application avant chaque
-- requête (cf. Commit 2bis, middleware/setUserContext.js) :
--   SELECT set_config('app.current_user_id', '<uuid>', true);
--   SELECT set_config('app.current_role',    '<role>', true);
-- get_my_profile_role() est réutilisée telle quelle en nom (déjà utilisée
-- par log_action() dans 001_init_schema.sql) mais son corps change : elle
-- lit désormais le GUC de session au lieu d'interroger profiles+auth.uid().
--
-- LIMITE STRUCTURELLE COMMUNE À TOUTES LES POLICIES CI-DESSOUS : rbac.js
-- n'a jamais eu de notion d'affectation patient/soignant (aucune table de
-- liaison "tel professionnel suit tel patient" n'existe dans le code réel).
-- Les policies réconciliées restent donc au niveau du module (qui a le
-- droit de lire/écrire quel type de donnée), pas au niveau du patient
-- individuel. Ce n'est pas une régression : c'est le même niveau de
-- granularité que l'intention actuelle de rbac.js.
-- ==============================================================================

-- ==============================================================================
-- SECTION 1 : fonctions de résolution d'identité (remplacent auth.uid()/auth.role())
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_my_profile_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT current_setting('app.current_role', true);
$$;

COMMENT ON FUNCTION public.get_my_profile_role() IS
    'Remplace la version d''origine (SELECT role FROM profiles WHERE id = auth.uid()) : lit le GUC de session app.current_role, posé par middleware/setUserContext.js après vérification du JWT.';

CREATE OR REPLACE FUNCTION public.app_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

COMMENT ON FUNCTION public.app_current_user_id() IS
    'Équivalent de auth.uid() : lit le GUC de session app.current_user_id.';

-- ==============================================================================
-- SECTION 2 : activation RLS (ENABLE sans FORCE, comme en réel — nécessaire
-- pour que log_action(), SECURITY DEFINER et propriétaire de la table,
-- continue de contourner la RLS pour écrire dans audit_logs)
-- ==============================================================================

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordonnances       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes_suivi       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transmissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constantes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traitements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soins_pansements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chutes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournees_soins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs        ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- SECTION 3 : profiles
-- ⚠️ CORRIGE DEUX ÉCARTS RÉELS : (a) profiles_update_own réel n'a AUCUN
--    WITH CHECK -> un utilisateur peut aujourd'hui changer son propre rôle
--    (auto-élévation de privilège, faille active) ; (b) profiles_insert_any
--    réel est WITH CHECK(true) -> insertion profil libre pour tout
--    authentifié (écart déjà identifié et corrigé ci-dessous).
-- ==============================================================================

CREATE POLICY profiles_select_self ON public.profiles
    FOR SELECT USING (id = app_current_user_id());

CREATE POLICY profiles_select_admin ON public.profiles
    FOR SELECT USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur']));

CREATE POLICY profiles_update_self ON public.profiles
    FOR UPDATE USING (id = app_current_user_id())
    WITH CHECK (
        id = app_current_user_id()
        AND role = (SELECT role FROM public.profiles WHERE id = app_current_user_id())
    );

CREATE POLICY profiles_update_admin ON public.profiles
    FOR UPDATE USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur']))
    WITH CHECK (
        get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur'])
        AND id <> app_current_user_id()
    );

-- Remplace profiles_insert_any (WITH CHECK true) : seul un admin peut créer un profil.
-- NB : tant que routes/auth.js (Commit 2bis) n'expose pas de route de création
-- de compte, cette policy est nécessaire mais pas suffisante — il faudra un futur
-- endpoint POST /api/auth/users réservé admin_crm/administrateur (hors
-- périmètre de cette tâche).
CREATE POLICY profiles_insert_admin ON public.profiles
    FOR INSERT WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur']));

CREATE POLICY profiles_delete_admin ON public.profiles
    FOR DELETE USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur']));

-- ==============================================================================
-- SECTION 4 : residents (patient.read / patient.write dans rbac.js)
-- ⚠️ Réconciliation AJOUTE l'accès en lecture aux 8 rôles qui n'avaient
--    aucune policy réelle (cadre, infirmiere, aide_soignante, kine, psycho,
--    ergo, ash, administrateur). Réconciliation RETIRE l'écriture et la
--    suppression physique à secretaire (avait insert/update en réel, mais
--    rbac.js ne lui donne pas patient.write) et RETIRE la suppression au
--    rôle medecin (delete resserré à admin_crm/administrateur uniquement).
-- ==============================================================================

CREATE POLICY residents_select ON public.residents
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'admin_crm','administrateur','cadre','medecin',
            'infirmiere','aide_soignante','kine','psycho','ergo','ash','secretaire'
        ])
        OR (get_my_profile_role() = 'medecin_demo' AND is_demo = true)
    );

CREATE POLICY residents_insert ON public.residents
    FOR INSERT WITH CHECK (
        get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','infirmiere'])
    );

CREATE POLICY residents_update ON public.residents
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','infirmiere']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','infirmiere']));

CREATE POLICY residents_delete ON public.residents
    FOR DELETE USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur']));

-- ==============================================================================
-- SECTION 5 : consultations (consultation.read / consultation.write)
-- ==============================================================================

CREATE POLICY consultations_select ON public.consultations
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','infirmiere','kine','psycho'])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = consultations.resident_id AND pt.is_demo = true))
    );

CREATE POLICY consultations_insert ON public.consultations
    FOR INSERT WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin','kine','psycho']));

CREATE POLICY consultations_update ON public.consultations
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin','kine','psycho']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin','kine','psycho']));

CREATE POLICY consultations_delete ON public.consultations
    FOR DELETE USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin']));

-- ==============================================================================
-- SECTION 6 : ordonnances (ordonnance.read / ordonnance.write)
-- ⚠️ Réconciliation AJOUTE la lecture pour cadre/infirmiere/secretaire
--    (rbac.js leur donne ordonnance.read, le réel ne l'accordait qu'à medecin).
-- ==============================================================================

CREATE POLICY ordonnances_select ON public.ordonnances
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','infirmiere','secretaire'])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = ordonnances.resident_id AND pt.is_demo = true))
    );

CREATE POLICY ordonnances_insert ON public.ordonnances
    FOR INSERT WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin']));

CREATE POLICY ordonnances_update ON public.ordonnances
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin']));

-- Pas de policy DELETE : comme en réel, personne ne peut supprimer une ordonnance.

-- ==============================================================================
-- SECTION 7 : documents
-- ⚠️ rbac.js n'a AUCUNE permission dédiée aux documents (l'onglet utilise
--    patient.read). Choix par défaut (jugement, pas une transposition) :
--    lecture alignée sur patient.read ; écriture réservée aux admins tant
--    qu'aucune intention métier n'est exprimée côté frontend (cohérent avec
--    l'audit précédent : aucune UI d'upload n'existe aujourd'hui).
-- ==============================================================================

CREATE POLICY documents_select ON public.documents
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'admin_crm','administrateur','cadre','medecin',
            'infirmiere','aide_soignante','kine','psycho','ergo','ash','secretaire'
        ])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = documents.resident_id AND pt.is_demo = true))
    );

CREATE POLICY documents_insert ON public.documents
    FOR INSERT WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur']));

CREATE POLICY documents_update ON public.documents
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur']));

CREATE POLICY documents_delete ON public.documents
    FOR DELETE USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur']));

-- ==============================================================================
-- SECTION 8 : notes_suivi (note.read / note.write)
-- ⚠️ Réconciliation majeure : le réel donnait l'écriture à secretaire et
--    medecin_demo (que rbac.js EXCLUT), et NE la donnait PAS à
--    aide_soignante/infirmiere/cadre/kine/psycho/ergo (que rbac.js INCLUT).
-- ==============================================================================

CREATE POLICY notes_select ON public.notes_suivi
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante',
            'kine','psycho','ergo','ash','secretaire'
        ])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = notes_suivi.resident_id AND pt.is_demo = true))
    );

CREATE POLICY notes_insert ON public.notes_suivi
    FOR INSERT WITH CHECK (
        get_my_profile_role() = ANY (ARRAY[
            'admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante','kine','psycho','ergo'
        ])
    );

CREATE POLICY notes_update ON public.notes_suivi
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY[
        'admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante','kine','psycho','ergo'
    ]))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY[
        'admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante','kine','psycho','ergo'
    ]));

-- ==============================================================================
-- SECTION 9 : agenda (agenda.read / agenda.write)
-- ==============================================================================

CREATE POLICY agenda_select ON public.agenda
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante',
            'kine','psycho','ergo','ash','secretaire'
        ])
        OR (get_my_profile_role() = 'medecin_demo' AND (
            resident_id IS NULL
            OR EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = agenda.resident_id AND pt.is_demo = true)
        ))
    );

CREATE POLICY agenda_insert ON public.agenda
    FOR INSERT WITH CHECK (
        get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','kine','psycho','secretaire'])
    );

CREATE POLICY agenda_update ON public.agenda
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','kine','psycho','secretaire']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','kine','psycho','secretaire']));

CREATE POLICY agenda_delete ON public.agenda
    FOR DELETE USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin','secretaire']));

-- ==============================================================================
-- SECTION 10 : transmissions (transmission.read / transmission.write)
-- ⚠️ Le réel était grand ouvert ("authenticated" sans distinction) y compris
--    pour medecin_demo, qui pouvait donc lire des transmissions de patients
--    RÉELS (pas seulement démo) — écart de confidentialité corrigé ici.
-- ==============================================================================

CREATE POLICY transmissions_select ON public.transmissions
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante',
            'kine','psycho','ergo','ash','secretaire'
        ])
        OR (get_my_profile_role() = 'medecin_demo' AND (
            resident_id IS NULL
            OR EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = transmissions.resident_id AND pt.is_demo = true)
        ))
    );

CREATE POLICY transmissions_insert ON public.transmissions
    FOR INSERT WITH CHECK (
        get_my_profile_role() = ANY (ARRAY[
            'admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante','kine','psycho','ergo'
        ])
    );

CREATE POLICY transmissions_update ON public.transmissions
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY[
        'admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante','kine','psycho','ergo'
    ]))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY[
        'admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante','kine','psycho','ergo'
    ]));

-- Pas de policy DELETE : comme en réel, personne ne peut supprimer une transmission.

-- ==============================================================================
-- SECTION 11 : constantes (constante.read / constante.write)
-- ==============================================================================

CREATE POLICY constantes_select ON public.constantes
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante','kine','ergo'])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = constantes.resident_id AND pt.is_demo = true))
    );

CREATE POLICY constantes_insert ON public.constantes
    FOR INSERT WITH CHECK (
        get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin','infirmiere','aide_soignante','kine','ergo'])
    );

CREATE POLICY constantes_update ON public.constantes
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin','infirmiere','aide_soignante','kine','ergo']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin','infirmiere','aide_soignante','kine','ergo']));

-- Pas de policy DELETE : comme en réel, personne ne peut supprimer une constante.

-- ==============================================================================
-- SECTION 12 : traitements (traitement.read / traitement.write)
-- ⚠️ Réconciliation MAJEURE, sensible patient : le réel permettait à TOUT
--    rôle authentifié de lire, créer, modifier ET SUPPRIMER une prescription
--    médicamenteuse (traitements_delete réel = "authenticated" sans aucune
--    restriction de rôle). rbac.js réserve la prescription au médecin.
-- ==============================================================================

CREATE POLICY traitements_select ON public.traitements
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','infirmiere'])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = traitements.resident_id AND pt.is_demo = true))
    );

CREATE POLICY traitements_insert ON public.traitements
    FOR INSERT WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin']));

CREATE POLICY traitements_update ON public.traitements
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin']));

CREATE POLICY traitements_delete ON public.traitements
    FOR DELETE USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin']));

-- ==============================================================================
-- SECTION 13 : soins_pansements (soin.read / soin.write)
-- ==============================================================================

CREATE POLICY soins_select ON public.soins_pansements
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','infirmiere'])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = soins_pansements.resident_id AND pt.is_demo = true))
    );

CREATE POLICY soins_insert ON public.soins_pansements
    FOR INSERT WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin','infirmiere']));

CREATE POLICY soins_update ON public.soins_pansements
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin','infirmiere']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','medecin','infirmiere']));

-- Pas de policy DELETE : comme en réel, personne ne peut supprimer un soin.

-- ==============================================================================
-- SECTION 14 : chutes (chute.read / chute.write)
-- ==============================================================================

CREATE POLICY chutes_select ON public.chutes
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante',
            'kine','psycho','ergo','ash','secretaire'
        ])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = chutes.resident_id AND pt.is_demo = true))
    );

CREATE POLICY chutes_insert ON public.chutes
    FOR INSERT WITH CHECK (
        get_my_profile_role() = ANY (ARRAY[
            'admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante','kine','psycho','ergo'
        ])
    );

CREATE POLICY chutes_update ON public.chutes
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY[
        'admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante','kine','psycho','ergo'
    ]))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY[
        'admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante','kine','psycho','ergo'
    ]));

-- Pas de policy DELETE : comme en réel, personne ne peut supprimer une chute déclarée.

-- ==============================================================================
-- SECTION 15 : tournees_soins (tournee.read / tournee.write)
-- ⚠️ Réconciliation majeure : le réel était grand ouvert à tout authentifié
--    (y compris kine/psycho/ergo/ash/secretaire/medecin_demo, qui n'ont
--    AUCUN accès tournée dans rbac.js).
-- ==============================================================================

CREATE POLICY tournees_select ON public.tournees_soins
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','cadre','medecin','infirmiere','aide_soignante'])
    );

CREATE POLICY tournees_insert ON public.tournees_soins
    FOR INSERT WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','infirmiere','aide_soignante']));

CREATE POLICY tournees_update ON public.tournees_soins
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','infirmiere','aide_soignante']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur','infirmiere','aide_soignante']));

-- Pas de policy DELETE : comme en réel, personne ne peut supprimer une tournée.

-- ==============================================================================
-- SECTION 16 : audit_logs
-- ⚠️ CORRIGE l'écart réel le plus grave : audit_insert réel est
--    WITH CHECK(true) pour tout authentifié -> falsification possible du
--    journal d'audit (écart déjà identifié et corrigé ci-dessous). Ici, AUCUNE
--    policy INSERT n'est créée pour un rôle applicatif : seule log_action()
--    (SECURITY DEFINER, propriétaire de la table donc hors RLS puisque la
--    table n'est pas FORCE) peut écrire.
-- ==============================================================================

CREATE POLICY audit_select_admin ON public.audit_logs
    FOR SELECT USING (get_my_profile_role() = ANY (ARRAY['admin_crm','administrateur']));

-- ==============================================================================
-- FIN — database/migrations/002_rls_policies.sql
-- ==============================================================================
