-- ==============================================================================
-- [ candy-e ] — REGISTRE DES TRAITEMENTS (Art. 30 RGPD)
-- Fichier    : database/migrations/011_registre_traitements.sql
-- Prérequis  : 001_init_schema.sql, 008_role_matrix_migration.sql
--
-- Décision explicite : le registre n'est PAS un fichier statique versionné
-- en Git (contrairement à ce que suggérait le prompt initial) — c'est une
-- ressource en base, éditable depuis le dashboard DPO (routes/rgpd.js),
-- pour qu'il reste à jour au fil du projet plutôt que figé à la date d'un
-- commit. registre_meta.note_aipd porte le même principe pour l'analyse
-- d'impact (AIPD) : un rappel visible qu'elle doit être révisée au fur et à
-- mesure de l'avancement du projet, pas rédigée une fois pour toutes.
-- ==============================================================================

CREATE TABLE public.registre_traitements (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code                    TEXT        NOT NULL UNIQUE,
    nom                     TEXT        NOT NULL,
    finalite                TEXT        NOT NULL,
    base_legale             TEXT        NOT NULL,
    categories_donnees      TEXT[]      NOT NULL DEFAULT '{}',
    personnes_concernees    TEXT[]      NOT NULL DEFAULT '{}',
    destinataires           TEXT[]      NOT NULL DEFAULT '{}',
    sous_traitants          TEXT[]      NOT NULL DEFAULT '{}',
    duree_conservation      TEXT        NOT NULL,
    transferts_hors_ue      TEXT        NOT NULL DEFAULT 'Aucun',
    mesures_securite        TEXT        NOT NULL,
    responsable_traitement  TEXT        NOT NULL,
    dpo_contact             TEXT        NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.registre_traitements IS
    'Registre des traitements Art. 30 RGPD — édité depuis le dashboard DPO (routes/rgpd.js), jamais un fichier statique. Toute modification est journalisée dans audit_logs (REGISTRE_UPDATED).';

CREATE TRIGGER trg_registre_traitements_updated_at
    BEFORE UPDATE ON public.registre_traitements
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Ligne singleton (même pattern que purge_runs, 007_purge_tracking.sql) :
-- note libre affichée en tête du registre dans le dashboard DPO.
CREATE TABLE public.registre_meta (
    id          SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    note_aipd   TEXT        NOT NULL DEFAULT
        'L''analyse d''impact relative à la protection des données (AIPD) doit être mise à jour au fur et à mesure de l''avancement du projet — elle n''est pas figée à sa rédaction initiale. Toute évolution significative des traitements (nouveau module, nouveau sous-traitant, nouvelle finalité) doit déclencher sa révision.',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TRIGGER trg_registre_meta_updated_at
    BEFORE UPDATE ON public.registre_meta
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.registre_meta (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- RLS — lecture et édition réservées à dpo/super_admin, même périmètre que
-- routes/rgpd.js (defense in depth, cf. le principe déjà appliqué sur les
-- autres tables du dépôt).
-- ==============================================================================

ALTER TABLE public.registre_traitements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registre_meta        ENABLE ROW LEVEL SECURITY;

CREATE POLICY registre_traitements_select ON public.registre_traitements
    FOR SELECT USING (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']));

CREATE POLICY registre_traitements_update ON public.registre_traitements
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']));

CREATE POLICY registre_meta_select ON public.registre_meta
    FOR SELECT USING (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']));

CREATE POLICY registre_meta_update ON public.registre_meta
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']));

-- ==============================================================================
-- Contenu initial — 5 traitements identifiés, adaptés au dépôt réel :
-- dpo_contact confirmé (dpo@safe-digitalisation.fr), "Direction EHPAD"
-- remplacé par le rôle réel directeur_etablissement (008_role_matrix_migration.sql).
-- ==============================================================================

INSERT INTO public.registre_traitements (
    code, nom, finalite, base_legale, categories_donnees, personnes_concernees,
    destinataires, sous_traitants, duree_conservation, transferts_hors_ue,
    mesures_securite, responsable_traitement, dpo_contact
) VALUES
(
    'T01',
    'Gestion du dossier usager EHPAD',
    'Prise en charge médico-sociale des résidents, coordination pluridisciplinaire, traçabilité des soins',
    'Art. 9(2)(h) RGPD — soins de santé + secret professionnel (Art. L. 1110-4 CSP)',
    ARRAY['Identité civile (INS)', 'Données de santé', 'Données sociales', 'Données administratives'],
    ARRAY['Résidents EHPAD'],
    ARRAY['Équipe soignante EHPAD', 'Médecin coordonnateur', 'Direction d''établissement (directeur_etablissement)', 'Sur réquisition : autorités judiciaires'],
    ARRAY['Clever Cloud (HDS)', 'CNDA (INSi)'],
    '20 ans après la dernière prise en charge (Art. R. 1112-7 CSP)',
    'Aucun',
    'Hébergement HDS certifié, chiffrement au repos et en transit, RLS multi-tenant, journalisation complète, JWT + refresh rotation',
    'EHPAD cliente (sous-traitant : S@FE SASU)',
    'dpo@safe-digitalisation.fr'
),
(
    'T02',
    'Authentification et gestion des accès professionnels',
    'Contrôle d''accès à la plateforme, imputabilité des actions, sécurité des SI',
    'Art. 6(1)(f) RGPD — intérêt légitime (sécurisation du SI de santé)',
    ARRAY['Identité professionnelle', 'Identifiants RPPS/ADELI', 'Logs de connexion', 'Adresse email', 'IP'],
    ARRAY['Professionnels de santé', 'Personnel administratif EHPAD', 'Administrateurs S@FE'],
    ARRAY['S@FE SASU (DPO/admin)', 'Direction d''établissement (directeur_etablissement)'],
    ARRAY['Clever Cloud (HDS)'],
    '5 ans après clôture du compte (Art. CNIL recommandation)',
    'Aucun',
    'JWT signé, rotation refresh token, politique MDP (IAM.92), timeout inactivité, anti-bruteforce',
    'S@FE SASU',
    'dpo@safe-digitalisation.fr'
),
(
    'T03',
    'Journalisation et traçabilité (imputabilité PGSSI-S)',
    'Traçabilité des accès aux données de santé, détection d''incidents, conformité PGSSI-S et REM IAM.91',
    'Art. 6(1)(c) RGPD — obligation légale (PGSSI-S référentiel imputabilité v1.0)',
    ARRAY['Identifiant utilisateur', 'Action effectuée', 'Horodatage', 'IP', 'Ressource accédée'],
    ARRAY['Professionnels utilisant C@NDY-e'],
    ARRAY['DPO S@FE', 'Direction d''établissement (directeur_etablissement) sur demande', 'Autorités en cas de violation'],
    ARRAY['Clever Cloud (HDS)'],
    '12 mois (36 mois si lié à une violation — Art. 33 RGPD)',
    'Aucun',
    'Table immuable (REVOKE UPDATE/DELETE), index optimisés, accès restreint rôle DPO',
    'S@FE SASU',
    'dpo@safe-digitalisation.fr'
),
(
    'T04',
    'Transmission INS/INSi',
    'Qualification de l''identité nationale de santé des résidents via le téléservice INSi (CNDA)',
    'Art. 9(2)(h) RGPD + Référentiel national d''identitovigilance (RNIV)',
    ARRAY['Nom de naissance', 'Prénom', 'Date de naissance', 'Lieu de naissance', 'Sexe', 'NIR (matricule INS)'],
    ARRAY['Résidents EHPAD'],
    ARRAY['CNDA (Caisse Nationale de l''Assurance Maladie — téléservice INSi)'],
    ARRAY['CNDA (contrat d''accès INSi)'],
    '20 ans (partie du dossier médical)',
    'Aucun',
    'Appel SOAP mutualisé + certificat client CNDA, INS stockée chiffrée, accès restreint',
    'EHPAD cliente (sous-traitant : S@FE SASU)',
    'dpo@safe-digitalisation.fr'
),
(
    'T05',
    'Gestion des violations de données (Art. 33-34)',
    'Documentation, notification CNIL et personnes concernées en cas de violation de données',
    'Art. 6(1)(c) RGPD — obligation légale (Art. 33 RGPD)',
    ARRAY['Nature de la violation', 'Données affectées', 'Personnes concernées', 'Mesures prises'],
    ARRAY['Toutes personnes dont les données sont affectées'],
    ARRAY['CNIL', 'Personnes concernées (si risque élevé)', 'CERT Santé'],
    ARRAY[]::TEXT[],
    '36 mois (Art. 33(5) RGPD)',
    'Aucun',
    'Registre des violations chiffré, accès DPO uniquement',
    'S@FE SASU',
    'dpo@safe-digitalisation.fr'
);

-- ==============================================================================
-- FIN — database/migrations/011_registre_traitements.sql
-- ==============================================================================
