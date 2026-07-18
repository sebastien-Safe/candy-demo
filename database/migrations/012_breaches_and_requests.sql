-- ==============================================================================
-- [ candy-e ] — REGISTRE DES VIOLATIONS (Art. 33-34) ET SUIVI DES DEMANDES
-- DE DROITS (Art. 15-22)
-- Fichier    : database/migrations/012_breaches_and_requests.sql
-- Prérequis  : 001_init_schema.sql, 006_extend_audit_logs.sql, 008_role_matrix_migration.sql
--
-- data_breaches.audit_logs_linked_count : nombre d'entrées audit_logs
-- marquées linked_to_breach=true lors de la déclaration (cf. routes/rgpd.js)
-- — ce marquage fait passer leur délai de conservation de 12 à 36 mois
-- (cf. services/rgpd/purge/purge.job.js, déjà écrit pour vérifier ce flag).
--
-- rgpd_requests.date_echeance : calculée à 1 mois par défaut (Art. 12(3)
-- RGPD), à ajuster manuellement si le délai est prolongé (dossier complexe).
-- ==============================================================================

CREATE TABLE public.data_breaches (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    declared_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    declared_by                 UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    nature                      TEXT        NOT NULL,
    categories_donnees          TEXT[]      NOT NULL DEFAULT '{}',
    volume_personnes_estime     INTEGER,
    consequences_probables      TEXT,
    mesures_prises              TEXT,
    statut                      TEXT        NOT NULL DEFAULT 'en_cours'
                                            CHECK (statut = ANY (ARRAY['en_cours','notifiee_cnil','cloturee'])),
    periode_debut                TIMESTAMPTZ,
    periode_fin                  TIMESTAMPTZ,
    audit_logs_linked_count     INTEGER     NOT NULL DEFAULT 0,
    notification_cnil_le         TIMESTAMPTZ,
    personnes_notifiees_le       TIMESTAMPTZ,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.data_breaches IS
    'Registre des violations de données (Art. 33-34 RGPD), édité depuis le dashboard DPO. Le lien vers audit_logs (linked_to_breach) est appliqué par routes/rgpd.js sur la période periode_debut/periode_fin, jamais automatique.';

CREATE TRIGGER trg_data_breaches_updated_at
    BEFORE UPDATE ON public.data_breaches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.rgpd_requests (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    type              TEXT        NOT NULL
                                  CHECK (type = ANY (ARRAY['acces','rectification','effacement','portabilite','opposition','limitation'])),
    resident_id       UUID        REFERENCES public.residents(id) ON DELETE SET NULL,
    demandeur_nom     TEXT        NOT NULL,
    demandeur_email   TEXT,
    description       TEXT,
    statut            TEXT        NOT NULL DEFAULT 'recue'
                                  CHECK (statut = ANY (ARRAY['recue','en_cours','traitee','rejetee'])),
    date_reception    TIMESTAMPTZ NOT NULL DEFAULT now(),
    date_echeance     TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 month'),
    date_traitement   TIMESTAMPTZ,
    traite_par        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    reponse           TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rgpd_requests IS
    'Suivi des demandes d''exercice de droits (Art. 15-22 RGPD). date_echeance par défaut à 1 mois (Art. 12(3)) — à ajuster manuellement si prolongation pour dossier complexe. L''effacement (type=effacement) n''est aujourd''hui suivi qu''au statut, sans mécanisme d''anonymisation automatique (limite assumée, cf. discussion produit — à construire séparément).';

CREATE TRIGGER trg_rgpd_requests_updated_at
    BEFORE UPDATE ON public.rgpd_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_rgpd_requests_statut ON public.rgpd_requests(statut, date_echeance);
CREATE INDEX idx_rgpd_requests_resident ON public.rgpd_requests(resident_id);

-- ==============================================================================
-- RLS — même périmètre que le reste du module RGPD : dpo/super_admin.
-- ==============================================================================

ALTER TABLE public.data_breaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rgpd_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY data_breaches_select ON public.data_breaches
    FOR SELECT USING (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']));
CREATE POLICY data_breaches_insert ON public.data_breaches
    FOR INSERT WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']));
CREATE POLICY data_breaches_update ON public.data_breaches
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']));

CREATE POLICY rgpd_requests_select ON public.rgpd_requests
    FOR SELECT USING (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']));
CREATE POLICY rgpd_requests_insert ON public.rgpd_requests
    FOR INSERT WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']));
CREATE POLICY rgpd_requests_update ON public.rgpd_requests
    FOR UPDATE
    USING (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']))
    WITH CHECK (get_my_profile_role() = ANY (ARRAY['super_admin','dpo']));

-- ==============================================================================
-- FIN — database/migrations/012_breaches_and_requests.sql
-- ==============================================================================
