-- ==============================================================================
-- [ candy-e ] — MIGRATION MATRICE DE RÔLES CONFORME REM-MS-DUI-Va2
-- Fichier    : database/migrations/008_role_matrix_migration.sql
-- Prérequis  : 001_init_schema.sql, 002_rls_policies.sql, 003_identite_rniv.sql,
--              005_add_dpo_role.sql, 007_purge_tracking.sql
--
-- CONTEXTE : réconciliation de la matrice de rôles avec le référencement
-- Ségur Vague 2 (couloir MS-DUI) — SC.SSI/IAM.91, SC.SSI/IAM.92, EXI EDC
-- PSC 102 (moindre privilège). Cf. docs/ANS_matrice_roles_EXI_EDC_PSC_102.md
-- pour la justification de chaque rôle.
--
-- CHANGEMENTS DE RÔLES :
--   - admin_crm + administrateur  -> super_admin       (fusion, permissions identiques)
--   - cadre                       -> cadre_sante        (renommage + extension L+E
--                                                          ordonnances/traitements/
--                                                          soins_pansements/constantes —
--                                                          décision explicite de la
--                                                          matrice cible, pas un effet
--                                                          de bord du renommage)
--   - kine + psycho + ergo        -> intervenant_soins_exterieur (fusion, nivelée au
--                                                          minimum commun : transmissions
--                                                          L+E uniquement — perte
--                                                          volontaire de consultations/
--                                                          notes/constantes/chutes/agenda)
--   - (nouveau)                   -> directeur_etablissement (lecture résidents/agenda/
--                                                          consultations/transmissions/
--                                                          stats + désactivation de compte
--                                                          + écriture discharge_date via
--                                                          route dédiée uniquement)
--   - medecin, infirmiere, aide_soignante, secretaire, dpo -> INCHANGÉS (contrainte
--     absolue : permissions non modifiées, y compris là où la matrice cible semblait
--     suggérer un retrait — ex. stat.read sur medecin, conservé).
--   - medecin_demo, ash -> conservés tels quels, marqués DEPRECATED (cf. rbac.js) :
--     aucun nouveau compte ne doit être créé avec ces rôles (retirés du <select> de
--     création dans admin.js), mais ni le CHECK constraint ni les policies RLS qui
--     les référencent ne sont touchés ici — suppression physique hors périmètre tant
--     qu'un audit des comptes existants n'a pas été fait.
--
-- LIMITE TECHNIQUE IMPORTANTE (discharge_date, désactivation de compte) :
-- PostgreSQL RLS ne permet pas de restreindre une UPDATE à une seule colonne
-- via USING/WITH CHECK seuls, et cette architecture n'a qu'une connexion DB
-- applicative unique (pas de rôles Postgres distincts permettant des GRANT
-- UPDATE(colonne) par rôle métier). Les policies ci-dessous accordent donc
-- un droit UPDATE au niveau LIGNE à directeur_etablissement sur residents et
-- profiles — la restriction "seule la colonne discharge_date/actif change"
-- est appliquée exclusivement côté application (routes/patients.js:POST
-- /:id/sortie, routes/profiles.js:PATCH), jamais exposée via un PATCH
-- générique à ce rôle. Défense en profondeur incomplète assumée : documentée
-- ici pour un futur audit PASSI plutôt que cachée.
--
-- TRANSACTION : DDL PostgreSQL est déjà transactionnel — toute erreur avant
-- COMMIT annule l'ensemble des changements (BEGIN/COMMIT explicites ci-dessous
-- pour le rendre visible ; un client qui se déconnecte avant COMMIT obtient le
-- même effet qu'un ROLLBACK).
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- SECTION 1 : migration des données existantes
--
-- La contrainte CHECK doit être élargie (ancien + nouveaux rôles réunis)
-- AVANT les UPDATE de renommage, sinon toute ligne existante avec un ancien
-- rôle (ex. admin_crm) fait échouer l'UPDATE vers 'super_admin', qui n'est
-- pas encore une valeur autorisée par l'ancienne contrainte. Une seconde
-- ALTER (fin de section) resserre ensuite la contrainte à sa liste finale.
-- ==============================================================================

ALTER TABLE public.profiles
    DROP CONSTRAINT profiles_role_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role = ANY (ARRAY[
        -- anciens rôles, temporairement encore autorisés le temps des UPDATE
        'admin_crm','administrateur','cadre','kine','psycho','ergo',
        -- nouveaux rôles
        'super_admin','directeur_etablissement','cadre_sante',
        'intervenant_soins_exterieur',
        -- inchangés
        'medecin','infirmiere','aide_soignante','secretaire','dpo',
        -- deprecated, conservés (cf. commentaire d'en-tête)
        'medecin_demo','ash'
    ]));

UPDATE public.profiles SET role = 'super_admin'                 WHERE role IN ('admin_crm', 'administrateur');
UPDATE public.profiles SET role = 'cadre_sante'                 WHERE role = 'cadre';
UPDATE public.profiles SET role = 'intervenant_soins_exterieur' WHERE role IN ('kine', 'psycho', 'ergo');

-- ==============================================================================
-- SECTION 2 : contrainte CHECK resserrée à sa liste finale (anciens rôles
-- retirés — plus aucune ligne ne peut en porter un après les UPDATE ci-dessus)
-- ==============================================================================

ALTER TABLE public.profiles
    DROP CONSTRAINT profiles_role_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role = ANY (ARRAY[
        'super_admin','directeur_etablissement','cadre_sante','medecin',
        'infirmiere','aide_soignante','intervenant_soins_exterieur',
        'secretaire','dpo',
        'medecin_demo','ash'  -- deprecated, conservés (cf. commentaire d'en-tête)
    ]));

COMMENT ON COLUMN public.profiles.role IS
    'Rôle applicatif. Matrice conforme REM-MS-DUI-Va2 depuis 008_role_matrix_migration.sql — cf. docs/ANS_matrice_roles_EXI_EDC_PSC_102.md. medecin_demo/ash deprecated (ne plus créer).';

-- ==============================================================================
-- SECTION 3 : profiles — ajout directeur_etablissement (lecture liste +
-- désactivation), super_admin remplace admin_crm/administrateur partout
-- ==============================================================================

DROP POLICY profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin ON public.profiles
    FOR SELECT USING (get_my_profile_role() = ANY (ARRAY['super_admin','directeur_etablissement']));

DROP POLICY profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles
    FOR UPDATE USING (get_my_profile_role() = 'super_admin')
    WITH CHECK (
        get_my_profile_role() = 'super_admin'
        AND id <> app_current_user_id()
    );

-- Nouvelle policy additive : directeur_etablissement peut modifier une ligne
-- profiles (droit RLS au niveau ligne) — la restriction "uniquement actif,
-- jamais role" est appliquée par routes/profiles.js (cf. limite technique
-- documentée en en-tête de fichier), pas par cette policy.
CREATE POLICY profiles_update_directeur ON public.profiles
    FOR UPDATE USING (get_my_profile_role() = 'directeur_etablissement')
    WITH CHECK (
        get_my_profile_role() = 'directeur_etablissement'
        AND id <> app_current_user_id()
    );

DROP POLICY profiles_insert_admin ON public.profiles;
CREATE POLICY profiles_insert_admin ON public.profiles
    FOR INSERT WITH CHECK (get_my_profile_role() = 'super_admin');

DROP POLICY profiles_delete_admin ON public.profiles;
CREATE POLICY profiles_delete_admin ON public.profiles
    FOR DELETE USING (get_my_profile_role() = 'super_admin');

-- ==============================================================================
-- SECTION 4 : residents — ajout directeur_etablissement (lecture + écriture
-- limitée à discharge_date via route dédiée), cadre_sante, intervenant_soins_exterieur
-- ==============================================================================

DROP POLICY residents_select ON public.residents;
CREATE POLICY residents_select ON public.residents
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','directeur_etablissement','cadre_sante','medecin',
            'infirmiere','aide_soignante','intervenant_soins_exterieur','ash','secretaire'
        ])
        OR (get_my_profile_role() = 'medecin_demo' AND is_demo = true)
    );

DROP POLICY residents_insert ON public.residents;
CREATE POLICY residents_insert ON public.residents
    FOR INSERT WITH CHECK (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere'])
    );

DROP POLICY residents_update ON public.residents;
CREATE POLICY residents_update ON public.residents
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere']));

-- Nouvelle policy additive : cf. limite technique documentée en en-tête —
-- restriction à discharge_date/actif appliquée par routes/patients.js:POST
-- /:id/sortie, jamais par le PATCH générique (directeur_etablissement n'est
-- pas dans ROLES_ECRITURE de patients.js).
CREATE POLICY residents_update_directeur ON public.residents
    FOR UPDATE
    USING (get_my_profile_role() = 'directeur_etablissement')
    WITH CHECK (get_my_profile_role() = 'directeur_etablissement');

DROP POLICY residents_delete ON public.residents;
CREATE POLICY residents_delete ON public.residents
    FOR DELETE USING (get_my_profile_role() = 'super_admin');

-- ==============================================================================
-- SECTION 5 : consultations — ajout directeur_etablissement (lecture),
-- cadre_sante passe en L+E (extension explicite de la matrice cible),
-- intervenant_soins_exterieur perd tout accès (avait L+E via kine/psycho)
-- ==============================================================================

DROP POLICY consultations_select ON public.consultations;
CREATE POLICY consultations_select ON public.consultations
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['super_admin','directeur_etablissement','cadre_sante','medecin','infirmiere'])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = consultations.resident_id AND pt.is_demo = true))
    );

DROP POLICY consultations_insert ON public.consultations;
CREATE POLICY consultations_insert ON public.consultations
    FOR INSERT WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin']));

DROP POLICY consultations_update ON public.consultations;
CREATE POLICY consultations_update ON public.consultations
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin']));

DROP POLICY consultations_delete ON public.consultations;
CREATE POLICY consultations_delete ON public.consultations
    FOR DELETE USING (get_my_profile_role() = ANY (ARRAY['super_admin','medecin']));

-- ==============================================================================
-- SECTION 6 : ordonnances — cadre_sante passe en L+E (extension explicite),
-- secretaire INCHANGÉ (contrainte absolue : ne pas toucher ses permissions,
-- malgré la matrice cible qui suggère santé=non pour ce rôle)
-- ==============================================================================

DROP POLICY ordonnances_select ON public.ordonnances;
CREATE POLICY ordonnances_select ON public.ordonnances
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere','secretaire'])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = ordonnances.resident_id AND pt.is_demo = true))
    );

DROP POLICY ordonnances_insert ON public.ordonnances;
CREATE POLICY ordonnances_insert ON public.ordonnances
    FOR INSERT WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin']));

DROP POLICY ordonnances_update ON public.ordonnances;
CREATE POLICY ordonnances_update ON public.ordonnances
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin']));

-- ==============================================================================
-- SECTION 7 : documents — intervenant_soins_exterieur perd l'accès (matrice
-- cible ne mentionne aucun droit documents pour ce rôle)
-- ==============================================================================

DROP POLICY documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','ash','secretaire'
        ])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = documents.resident_id AND pt.is_demo = true))
    );

DROP POLICY documents_insert ON public.documents;
CREATE POLICY documents_insert ON public.documents
    FOR INSERT WITH CHECK (get_my_profile_role() = 'super_admin');

DROP POLICY documents_update ON public.documents;
CREATE POLICY documents_update ON public.documents
    FOR UPDATE
    USING (get_my_profile_role() = 'super_admin')
    WITH CHECK (get_my_profile_role() = 'super_admin');

DROP POLICY documents_delete ON public.documents;
CREATE POLICY documents_delete ON public.documents
    FOR DELETE USING (get_my_profile_role() = 'super_admin');

-- ==============================================================================
-- SECTION 8 : notes_suivi — intervenant_soins_exterieur perd l'accès
-- ==============================================================================

DROP POLICY notes_select ON public.notes_suivi;
CREATE POLICY notes_select ON public.notes_suivi
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','ash','secretaire'
        ])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = notes_suivi.resident_id AND pt.is_demo = true))
    );

DROP POLICY notes_insert ON public.notes_suivi;
CREATE POLICY notes_insert ON public.notes_suivi
    FOR INSERT WITH CHECK (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere','aide_soignante'])
    );

DROP POLICY notes_update ON public.notes_suivi;
CREATE POLICY notes_update ON public.notes_suivi
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere','aide_soignante']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere','aide_soignante']));

-- ==============================================================================
-- SECTION 9 : agenda — ajout directeur_etablissement (lecture uniquement),
-- intervenant_soins_exterieur perd l'accès
-- ==============================================================================

DROP POLICY agenda_select ON public.agenda;
CREATE POLICY agenda_select ON public.agenda
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','directeur_etablissement','cadre_sante','medecin','infirmiere','aide_soignante','ash','secretaire'
        ])
        OR (get_my_profile_role() = 'medecin_demo' AND (
            resident_id IS NULL
            OR EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = agenda.resident_id AND pt.is_demo = true)
        ))
    );

DROP POLICY agenda_insert ON public.agenda;
CREATE POLICY agenda_insert ON public.agenda
    FOR INSERT WITH CHECK (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','secretaire'])
    );

DROP POLICY agenda_update ON public.agenda;
CREATE POLICY agenda_update ON public.agenda
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','secretaire']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','secretaire']));

DROP POLICY agenda_delete ON public.agenda;
CREATE POLICY agenda_delete ON public.agenda
    FOR DELETE USING (get_my_profile_role() = ANY (ARRAY['super_admin','medecin','secretaire']));

-- ==============================================================================
-- SECTION 10 : transmissions — ajout directeur_etablissement (lecture),
-- intervenant_soins_exterieur CONSERVE son accès (seul module clinique
-- restant pour ce rôle après la fusion)
-- ==============================================================================

DROP POLICY transmissions_select ON public.transmissions;
CREATE POLICY transmissions_select ON public.transmissions
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','directeur_etablissement','cadre_sante','medecin','infirmiere','aide_soignante',
            'intervenant_soins_exterieur','ash','secretaire'
        ])
        OR (get_my_profile_role() = 'medecin_demo' AND (
            resident_id IS NULL
            OR EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = transmissions.resident_id AND pt.is_demo = true)
        ))
    );

DROP POLICY transmissions_insert ON public.transmissions;
CREATE POLICY transmissions_insert ON public.transmissions
    FOR INSERT WITH CHECK (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','intervenant_soins_exterieur'
        ])
    );

DROP POLICY transmissions_update ON public.transmissions;
CREATE POLICY transmissions_update ON public.transmissions
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY[
        'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','intervenant_soins_exterieur'
    ]))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY[
        'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','intervenant_soins_exterieur'
    ]));

-- ==============================================================================
-- SECTION 11 : constantes — cadre_sante passe en L+E (extension explicite),
-- intervenant_soins_exterieur perd l'accès (avait kine/ergo)
-- ==============================================================================

DROP POLICY constantes_select ON public.constantes;
CREATE POLICY constantes_select ON public.constantes
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere','aide_soignante'])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = constantes.resident_id AND pt.is_demo = true))
    );

DROP POLICY constantes_insert ON public.constantes;
CREATE POLICY constantes_insert ON public.constantes
    FOR INSERT WITH CHECK (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere','aide_soignante'])
    );

DROP POLICY constantes_update ON public.constantes;
CREATE POLICY constantes_update ON public.constantes
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere','aide_soignante']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere','aide_soignante']));

-- ==============================================================================
-- SECTION 12 : traitements — cadre_sante passe en L+E (extension explicite,
-- sensible : accès aux prescriptions médicamenteuses)
-- ==============================================================================

DROP POLICY traitements_select ON public.traitements;
CREATE POLICY traitements_select ON public.traitements
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere'])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = traitements.resident_id AND pt.is_demo = true))
    );

DROP POLICY traitements_insert ON public.traitements;
CREATE POLICY traitements_insert ON public.traitements
    FOR INSERT WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin']));

DROP POLICY traitements_update ON public.traitements;
CREATE POLICY traitements_update ON public.traitements
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin']));

DROP POLICY traitements_delete ON public.traitements;
CREATE POLICY traitements_delete ON public.traitements
    FOR DELETE USING (get_my_profile_role() = ANY (ARRAY['super_admin','medecin']));

-- ==============================================================================
-- SECTION 13 : soins_pansements — cadre_sante passe en L+E (extension explicite)
-- ==============================================================================

DROP POLICY soins_select ON public.soins_pansements;
CREATE POLICY soins_select ON public.soins_pansements
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere'])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = soins_pansements.resident_id AND pt.is_demo = true))
    );

DROP POLICY soins_insert ON public.soins_pansements;
CREATE POLICY soins_insert ON public.soins_pansements
    FOR INSERT WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere']));

DROP POLICY soins_update ON public.soins_pansements;
CREATE POLICY soins_update ON public.soins_pansements
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere']));

-- ==============================================================================
-- SECTION 14 : chutes — intervenant_soins_exterieur perd l'accès
-- ==============================================================================

DROP POLICY chutes_select ON public.chutes;
CREATE POLICY chutes_select ON public.chutes
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','ash','secretaire'
        ])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents pt WHERE pt.id = chutes.resident_id AND pt.is_demo = true))
    );

DROP POLICY chutes_insert ON public.chutes;
CREATE POLICY chutes_insert ON public.chutes
    FOR INSERT WITH CHECK (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere','aide_soignante'])
    );

DROP POLICY chutes_update ON public.chutes;
CREATE POLICY chutes_update ON public.chutes
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere','aide_soignante']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere','aide_soignante']));

-- ==============================================================================
-- SECTION 15 : tournees_soins — renommage seul (cadre_sante n'avait que la
-- lecture via `cadre`, inchangé)
-- ==============================================================================

DROP POLICY tournees_select ON public.tournees_soins;
CREATE POLICY tournees_select ON public.tournees_soins
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere','aide_soignante'])
    );

DROP POLICY tournees_insert ON public.tournees_soins;
CREATE POLICY tournees_insert ON public.tournees_soins
    FOR INSERT WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','infirmiere','aide_soignante']));

DROP POLICY tournees_update ON public.tournees_soins;
CREATE POLICY tournees_update ON public.tournees_soins
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','infirmiere','aide_soignante']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','infirmiere','aide_soignante']));

-- ==============================================================================
-- SECTION 16 : identites (RNIV, 003_identite_rniv.sql) — intervenant_soins_exterieur
-- perd l'accès
-- ==============================================================================

DROP POLICY identites_select ON public.identites;
CREATE POLICY identites_select ON public.identites
    FOR SELECT USING (
        get_my_profile_role() = ANY (ARRAY[
            'super_admin','cadre_sante','medecin','infirmiere','aide_soignante','ash','secretaire'
        ])
        OR (get_my_profile_role() = 'medecin_demo'
            AND EXISTS (SELECT 1 FROM public.residents r WHERE r.id = identites.resident_id AND r.is_demo = true))
    );

DROP POLICY identites_insert ON public.identites;
CREATE POLICY identites_insert ON public.identites
    FOR INSERT WITH CHECK (
        get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere'])
    );

DROP POLICY identites_update ON public.identites;
CREATE POLICY identites_update ON public.identites
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','cadre_sante','medecin','infirmiere']));

DROP POLICY identites_delete ON public.identites;
CREATE POLICY identites_delete ON public.identites
    FOR DELETE USING (get_my_profile_role() = 'super_admin');

-- ==============================================================================
-- SECTION 17 : audit_logs — correction incidentale : 'dpo' avait accès via
-- routes/audit.js (requireRole applicatif) depuis 005_add_dpo_role.sql, mais
-- jamais été ajouté à cette policy RLS — écart entre guard applicatif et RLS
-- corrigé ici (le DPO n'a jamais pu lire le journal en pratique malgré le
-- guard qui le laissait passer, faute de ligne renvoyée par la RLS).
-- ==============================================================================

DROP POLICY audit_select_admin ON public.audit_logs;
CREATE POLICY audit_select_admin ON public.audit_logs
    FOR SELECT USING (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']));

COMMIT;

-- ==============================================================================
-- FIN — database/migrations/008_role_matrix_migration.sql
-- ==============================================================================
