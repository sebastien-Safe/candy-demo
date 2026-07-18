-- ==============================================================================
-- [ candy-e ] — SCHÉMA INITIAL POUR MIGRATION VERS POSTGRESQL CLEVER CLOUD
-- Fichier    : database/migrations/001_init_schema.sql
-- Origine    : introspection directe du schéma réellement déployé en
--              production, via accès en lecture seule.
-- Cible      : addon PostgreSQL Clever Cloud (certifié HDS), Postgres nu.
--
-- ADAPTATIONS PAR RAPPORT AU SCHÉMA D'ORIGINE (Clever Cloud n'a ni
-- PostgREST, ni service d'authentification intégré, ni schéma `auth`) :
--
--   1. Les colonnes qui référençaient `auth.users(id)` (gérée par le
--      service d'authentification d'origine) sont repointées vers `public.profiles(id)`, qui devient la
--      table racine d'identité applicative. Concerné : profiles.id
--      (n'est plus une FK, devient une PK autonome), residents.created_by,
--      consultations.created_by, agenda.created_by, documents.uploaded_by,
--      notes_suivi.auteur_id, audit_logs.user_id, transmissions.auteur_id,
--      tournees_soins.saisie_par, soins_pansements.saisie_par,
--      constantes.saisie_par, chutes.saisie_par.
--   2. `handle_new_user()` / le trigger `on_auth_user_created` (sur
--      `auth.users`, création automatique du profil à l'inscription) ne
--      sont PAS recréés ici : ils dépendent de `auth.users`. Tant que la
--      brique d'authentification applicative n'existe pas (cf. Commit 2bis
--      pour un JWT minimal ; remplacement complet prévu par Pro Santé
--      Connect en Phase 1 Ségur), la création de `profiles` devra être
--      gérée explicitement par le futur code d'inscription.
--   3. `get_my_candy_role()` (fonction réelle observée en base) n'est pas
--      portée : elle n'est référencée par aucune policy RLS réelle
--      (probable code mort).
--   4. `log_action()` est adaptée : elle prenait implicitement `auth.uid()`
--      côté origine ; ici elle lit `current_setting('app.current_user_id', true)`
--      (GUC de session posée par l'application — cf. 002_rls_policies.sql).
--   5. `profiles.email` gagne une contrainte UNIQUE (absente du réel observé)
--      — ajout délibéré, pas une transposition fidèle : nécessaire pour la
--      recherche par e-mail du futur login JWT (Commit 2bis). Les 3 profils
--      de démo réels n'ont a priori pas de doublon, mais à vérifier avant
--      d'appliquer cette contrainte sur un futur import de données réelles.
--
-- CONSERVÉ TEL QUEL (comportement réel transposé fidèlement, pas corrigé) :
--   - `notes_suivi` a une contrainte UNIQUE(resident_id, auteur_id) : un
--     deuxième INSERT du même auteur sur le même patient échouera. C'est un
--     bug latent déjà présent en production réelle (le frontend fait un
--     INSERT à chaque note) — transposé fidèlement ici pour ne pas réécrire
--     l'historique de cette migration ; corrigé par
--     013_notes_suivi_drop_unique.sql (DROP CONSTRAINT), à appliquer après
--     celle-ci.
--   - `chutes.resident_id` et `chutes.transmission_id` sont en delete_rule
--     NO ACTION (pas de CASCADE), contrairement aux autres resident_id.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==============================================================================
-- SECTION 1 : profiles — table racine d'identité applicative
-- (remplace la relation à auth.users ; devient autonome)
-- ==============================================================================

CREATE TABLE public.profiles (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT        NOT NULL UNIQUE,
    prenom          TEXT,
    nom             TEXT,
    role            TEXT        NOT NULL DEFAULT 'secretaire'
                                CHECK (role = ANY (ARRAY[
                                    'admin_crm','medecin','secretaire','medecin_demo',
                                    'administrateur','cadre','infirmiere','aide_soignante',
                                    'ash','kine','psycho','ergo'
                                ])),
    specialite      TEXT,
    rpps            TEXT,
    telephone       TEXT,
    cabinet_nom     TEXT,
    cabinet_adresse TEXT,
    cabinet_cp      TEXT,
    cabinet_ville   TEXT,
    actif           BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Colonne absente du schéma d'origine (le service d'authentification
    -- externe gérait les mots de passe hors base applicative, dans le
    -- schéma auth). Ajoutée pour le middleware JWT minimal (cf. middleware/,
    -- routes/auth.js) — pont temporaire avant le remplacement par Pro Santé
    -- Connect en Phase 1. NULL pour les profils de démo tant qu'ils n'ont
    -- pas été réinitialisés manuellement (aucun mot de passe local n'existe
    -- côté source à migrer).
    password_hash   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
    'Table racine d''identité applicative (remplace la dépendance à un schéma auth externe). Le rôle pilote la RLS réconciliée (cf. 002_rls_policies.sql).';

-- ==============================================================================
-- SECTION 2 : residents
-- ==============================================================================

CREATE TABLE public.residents (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nom                 TEXT        NOT NULL,
    prenom              TEXT        NOT NULL,
    date_naissance      DATE,
    sexe                TEXT        CHECK (sexe = ANY (ARRAY['M','F','Autre'])),
    situation           TEXT,
    nb_enfants          INTEGER     DEFAULT 0,
    profession          TEXT,
    telephone           TEXT,
    email               TEXT,
    adresse             TEXT,
    code_postal         TEXT,
    ville               TEXT,
    groupe_sanguin      TEXT        CHECK (groupe_sanguin = ANY (ARRAY['A+','A-','B+','B-','AB+','AB-','O+','O-'])),
    numero_secu         TEXT,
    medecin_id          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    medecin_nom         TEXT,
    allergies           JSONB       DEFAULT '[]'::jsonb,
    poids               NUMERIC,
    taille              INTEGER,
    tension_sys         INTEGER,
    tension_dia         INTEGER,
    spo2                INTEGER,
    rythme_cardiaque    INTEGER,
    actif               BOOLEAN     NOT NULL DEFAULT TRUE,
    created_by          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_demo             BOOLEAN     NOT NULL DEFAULT FALSE,
    gir                 INTEGER     CHECK (gir >= 1 AND gir <= 6)
);

COMMENT ON TABLE public.residents IS
    'Dossier administratif et identité des résidents. is_demo pilote la visibilité pour le rôle medecin_demo (mode démo).';

-- ==============================================================================
-- SECTION 3 : consultations
-- ==============================================================================

CREATE TABLE public.consultations (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id          UUID        NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    medecin_id          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    date_consult        DATE        NOT NULL DEFAULT CURRENT_DATE,
    type_acte           TEXT        NOT NULL DEFAULT 'Consultation'
                                    CHECK (type_acte = ANY (ARRAY['Consultation','Bilan','Spécialiste','Examen','Urgence','Autre'])),
    titre               TEXT        NOT NULL,
    notes               TEXT,
    poids               NUMERIC,
    tension_sys         INTEGER,
    tension_dia         INTEGER,
    spo2                INTEGER,
    rythme_cardiaque    INTEGER,
    created_by          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- SECTION 4 : transmissions
-- ==============================================================================

CREATE TABLE public.transmissions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id  UUID        REFERENCES public.residents(id) ON DELETE CASCADE,
    type        TEXT        NOT NULL DEFAULT 'observation'
                            CHECK (type = ANY (ARRAY['observation','alerte','consigne','information'])),
    priorite    TEXT        NOT NULL DEFAULT 'normale'
                            CHECK (priorite = ANY (ARRAY['normale','urgente','critique'])),
    contenu     TEXT        NOT NULL,
    cible_role  TEXT,
    lu          BOOLEAN     NOT NULL DEFAULT FALSE,
    auteur_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- SECTION 5 : chutes
-- (delete_rule NO ACTION conservé tel quel sur resident_id/transmission_id/saisie_par)
-- ==============================================================================

CREATE TABLE public.chutes (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id                  UUID        NOT NULL REFERENCES public.residents(id),
    date_evenement              DATE        NOT NULL DEFAULT CURRENT_DATE,
    heure_evenement             TIME        NOT NULL DEFAULT CURRENT_TIME,
    lieu                        TEXT        NOT NULL
                                            CHECK (lieu = ANY (ARRAY['chambre_lit','chambre_autre','salle_bain_wc','couloir','refectoire_salon','jardin_exterieur'])),
    activite                    TEXT        CHECK (activite = ANY (ARRAY['transfert','marche_autonome','toilette_soin','lever_nocturne','autre'])),
    temoin                      TEXT        NOT NULL DEFAULT 'non' CHECK (temoin = ANY (ARRAY['non','oui'])),
    facteurs_environnementaux   JSONB       DEFAULT '[]'::jsonb,
    tension_sys                 INTEGER     CHECK (tension_sys >= 40 AND tension_sys <= 300),
    tension_dia                 INTEGER     CHECK (tension_dia >= 20 AND tension_dia <= 200),
    frequence_cardiaque         INTEGER     CHECK (frequence_cardiaque >= 20 AND frequence_cardiaque <= 300),
    saturation_o2                INTEGER     CHECK (saturation_o2 >= 50 AND saturation_o2 <= 100),
    etat_conscience              TEXT        CHECK (etat_conscience = ANY (ARRAY['conscient_alerte','somnolence','perte_connaissance'])),
    lesions                     JSONB       DEFAULT '[]'::jsonb,
    acteurs_prevenus            JSONB       DEFAULT '[]'::jsonb,
    notes                       TEXT,
    transmission_id             UUID        REFERENCES public.transmissions(id),
    saisie_par                  UUID        REFERENCES public.profiles(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chutes IS
    'Déclarations de chute/incident (fiche de liaison EHPAD). Génère une transmission liée à la validation.';

-- ==============================================================================
-- SECTION 6 : documents
-- ==============================================================================

CREATE TABLE public.documents (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id      UUID        NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    consultation_id UUID        REFERENCES public.consultations(id) ON DELETE SET NULL,
    nom             TEXT        NOT NULL,
    type_doc        TEXT        NOT NULL DEFAULT 'autre'
                                CHECK (type_doc = ANY (ARRAY['bilan','radio','compte_rendu','ordonnance','photo','autre'])),
    storage_path    TEXT        NOT NULL,
    taille_bytes    INTEGER,
    mime_type       TEXT,
    uploaded_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.documents IS
    'Métadonnées de documents résident. storage_path pointe vers un stockage objet (équivalent à définir côté Clever Cloud) — aucun fichier binaire n''est géré par cette table.';

-- ==============================================================================
-- SECTION 7 : ordonnances
-- ==============================================================================

CREATE TABLE public.ordonnances (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id      UUID        NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    medecin_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    consultation_id UUID        REFERENCES public.consultations(id) ON DELETE SET NULL,
    reference       TEXT        NOT NULL,
    date_emission   DATE        NOT NULL DEFAULT CURRENT_DATE,
    contenu         TEXT        NOT NULL,
    statut          TEXT        NOT NULL DEFAULT 'active'
                                CHECK (statut = ANY (ARRAY['active','expiree','annulee'])),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- SECTION 8 : traitements
-- ==============================================================================

CREATE TABLE public.traitements (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id      UUID        NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    medicament      TEXT        NOT NULL,
    dci             TEXT,
    dose            TEXT        NOT NULL,
    voie            TEXT        NOT NULL DEFAULT 'orale'
                                CHECK (voie = ANY (ARRAY['orale','IV','SC','IM','cutanee','inhalee','rectale','autre'])),
    frequence       TEXT        NOT NULL,
    date_debut      DATE        NOT NULL DEFAULT CURRENT_DATE,
    date_fin        DATE,
    actif           BOOLEAN     NOT NULL DEFAULT TRUE,
    prescripteur_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- SECTION 9 : constantes
-- ==============================================================================

CREATE TABLE public.constantes (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id              UUID        NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    date_mesure             TIMESTAMPTZ NOT NULL DEFAULT now(),
    tension_sys             INTEGER     CHECK (tension_sys >= 40 AND tension_sys <= 300),
    tension_dia             INTEGER     CHECK (tension_dia >= 20 AND tension_dia <= 200),
    frequence_cardiaque     INTEGER     CHECK (frequence_cardiaque >= 20 AND frequence_cardiaque <= 300),
    saturation_o2           INTEGER     CHECK (saturation_o2 >= 50 AND saturation_o2 <= 100),
    temperature             NUMERIC     CHECK (temperature >= 30.0 AND temperature <= 45.0),
    poids                   NUMERIC,
    glycemie                NUMERIC,
    echelle_douleur         INTEGER     CHECK (echelle_douleur >= 0 AND echelle_douleur <= 10),
    observations            TEXT,
    saisie_par              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- SECTION 10 : agenda
-- ==============================================================================

CREATE TABLE public.agenda (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id      UUID        REFERENCES public.residents(id) ON DELETE CASCADE,
    medecin_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    date_rdv        TIMESTAMPTZ NOT NULL,
    duree_minutes   INTEGER     NOT NULL DEFAULT 30,
    type_rdv        TEXT        NOT NULL DEFAULT 'Consultation'
                                CHECK (type_rdv = ANY (ARRAY['Consultation','Bilan','Spécialiste','Suivi','Autre'])),
    titre           TEXT        NOT NULL,
    notes           TEXT,
    statut          TEXT        NOT NULL DEFAULT 'planifie'
                                CHECK (statut = ANY (ARRAY['planifie','confirme','annule','effectue'])),
    created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- SECTION 11 : tournees_soins
-- ==============================================================================

CREATE TABLE public.tournees_soins (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id              UUID        NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    date_soin               DATE        NOT NULL DEFAULT CURRENT_DATE,
    type_tournee            TEXT        NOT NULL
                                        CHECK (type_tournee = ANY (ARRAY['matinale','dejeuner','sieste','apres_midi','soir','nuit_1','nuit_2'])),
    type_toilette           TEXT        CHECK (type_toilette = ANY (ARRAY['complete_lit','partielle_lit','lavabo','douche','refus'])),
    habillage               BOOLEAN     DEFAULT FALSE,
    prevention_escarres     BOOLEAN     DEFAULT FALSE,
    repas                   TEXT        CHECK (repas = ANY (ARRAY['pris','partiel','refus'])),
    nb_verres_eau           INTEGER     DEFAULT 0,
    collation_prise         TEXT        CHECK (collation_prise = ANY (ARRAY['prise','refus'])),
    mode_elimination        TEXT        CHECK (mode_elimination = ANY (ARRAY['change','toilettes','chaise_percee','bassin'])),
    urines                  TEXT        CHECK (urines = ANY (ARRAY['ok','absentes','saturees','rien'])),
    selles                  TEXT        CHECK (selles = ANY (ARRAY['ok_moulees','absentes','liquides','rien'])),
    protection_type         TEXT        CHECK (protection_type = ANY (ARRAY['pull_up','change_complet','anatomique','alese','nuit'])),
    etat_sommeil            TEXT        CHECK (etat_sommeil = ANY (ARRAY['calme','agite','insomnie'])),
    protection_etat         TEXT        CHECK (protection_etat = ANY (ARRAY['seche','ok','saturee'])),
    transmission            TEXT,
    saisie_par              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- SECTION 12 : notes_suivi
-- ⚠️ UNIQUE(resident_id, auteur_id) conservée telle quelle — voir avertissement
--    en tête de fichier (bug latent transposé fidèlement, corrigé par
--    013_notes_suivi_drop_unique.sql, pas ici pour ne pas réécrire l'historique).
-- ==============================================================================

CREATE TABLE public.notes_suivi (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id  UUID        NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    auteur_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    contenu     TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (resident_id, auteur_id)
);

-- ==============================================================================
-- SECTION 13 : soins_pansements
-- ==============================================================================

CREATE TABLE public.soins_pansements (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id      UUID        NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    type_soin       TEXT        NOT NULL DEFAULT 'plaie'
                                CHECK (type_soin = ANY (ARRAY['plaie','escarre','ulcere','stomie','catheter','drain','autre'])),
    localisation    TEXT,
    description     TEXT        NOT NULL,
    stade           TEXT        CHECK (stade = ANY (ARRAY['I','II','III','IV'])),
    materiel        TEXT,
    date_soin       TIMESTAMPTZ NOT NULL DEFAULT now(),
    prochain_soin   DATE,
    saisie_par      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- SECTION 14 : audit_logs
-- ==============================================================================

CREATE TABLE public.audit_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_role   TEXT,
    action      TEXT        NOT NULL,
    table_name  TEXT,
    record_id   UUID,
    details     JSONB,
    ip_address  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_logs IS
    'Journal d''audit. En réel, uniquement alimenté par des appels explicites à log_action() (LOGIN/LOGOUT) — aucun trigger générique n''existe en production (vérifié par introspection). Ne pas supposer une couverture d''audit plus large que cela.';

-- ==============================================================================
-- SECTION 15 : INDEX (identiques au réel observé)
-- ==============================================================================

CREATE INDEX idx_constantes_resident     ON public.constantes(resident_id, date_mesure DESC);
CREATE INDEX idx_soins_resident          ON public.soins_pansements(resident_id, date_soin DESC);
CREATE INDEX idx_tournees_resident_date  ON public.tournees_soins(resident_id, date_soin DESC);
CREATE INDEX idx_traitements_resident    ON public.traitements(resident_id) WHERE actif = TRUE;
CREATE INDEX idx_transmissions_resident  ON public.transmissions(resident_id, created_at DESC);
CREATE INDEX idx_transmissions_priorite  ON public.transmissions(priorite) WHERE priorite IN ('urgente','critique');

-- ==============================================================================
-- SECTION 16 : FONCTIONS ET TRIGGERS — maintenance updated_at (identiques au réel)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_residents_updated_at
    BEFORE UPDATE ON public.residents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==============================================================================
-- SECTION 17 : FONCTION log_action — adaptée (auth.uid() -> GUC de session)
-- Le mécanisme complet de RLS par GUC de session est défini dans
-- 002_rls_policies.sql ; cette fonction l'utilise déjà par anticipation.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.log_action(
    p_action        TEXT,
    p_table_name    TEXT DEFAULT NULL,
    p_record_id     UUID DEFAULT NULL,
    p_details       JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_user_id UUID := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
    v_role    TEXT := current_setting('app.current_role', true);
BEGIN
    INSERT INTO public.audit_logs (user_id, user_role, action, table_name, record_id, details)
    VALUES (v_user_id, v_role, p_action, p_table_name, p_record_id, p_details);
END;
$$;

COMMENT ON FUNCTION public.log_action IS
    'Équivalent du log_action() d''origine, adapté : lit l''identité depuis les GUC de session app.current_user_id/app.current_role (posées par db/client.js) au lieu de auth.uid().';

-- ==============================================================================
-- FIN — database/migrations/001_init_schema.sql
-- Suite : 002_rls_policies.sql (RLS réconciliée avec rbac.js)
-- ==============================================================================
