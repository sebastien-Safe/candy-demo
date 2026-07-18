-- ==============================================================================
-- [ candy-e ] — SUIVI DE PURGE RGPD
-- Fichier    : database/migrations/007_purge_tracking.sql
-- Prérequis  : 001_init_schema.sql
--
-- Ajoute les colonnes nécessaires au job de purge automatique
-- (services/rgpd/purge/) — absentes du schéma actuel :
--   - residents.discharge_date : date de sortie/décès, déclenche le compte
--     à rebours de conservation légale (20 ans, Art. R. 1112-7 CSP). Doit
--     être renseignée par un futur écran/route dédié (hors périmètre de
--     cette migration) — sans cette date, un résident n'est jamais éligible
--     à la purge, ce qui est le comportement sûr par défaut.
--   - residents.purge_status / purge_scheduled_at : le job de purge ne
--     supprime jamais un dossier résident lui-même — il marque
--     'pending_dpo_approval' une fois le délai légal atteint ; la
--     suppression définitive reste une décision humaine (DPO), hors
--     automatisation.
--   - profiles.account_closed_at : date de fin de relation contractuelle,
--     déclenche le délai de conservation de 5 ans avant suppression du
--     compte.
--
-- Table purge_runs : état persisté (et non en mémoire process) du
-- scheduler — un scheduler basé uniquement sur setInterval ne survit pas à
-- un redémarrage (déploiement, crash, scaling Clever Cloud) et ne permet
-- pas de garantir qu'une seule instance exécute le job un jour donné. Une
-- ligne singleton (id fixe = 1) sert de verrou optimiste : le scheduler
-- (services/rgpd/purge/purge.scheduler.js) tente un UPDATE conditionnel
-- ("ai-je déjà tourné aujourd'hui ?") — seule une transaction concurrente
-- gagne la course, les autres voient 0 ligne affectée.
-- ==============================================================================

ALTER TABLE public.residents
    ADD COLUMN discharge_date     DATE,
    ADD COLUMN purge_status       TEXT CHECK (purge_status = ANY (ARRAY['pending_dpo_approval','approved','rejected'])),
    ADD COLUMN purge_scheduled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.residents.discharge_date IS
    'Date de sortie/décès du résident. NULL tant que le résident est pris en charge — déclenche le délai de conservation légale de 20 ans une fois renseignée (Art. R. 1112-7 CSP).';
COMMENT ON COLUMN public.residents.purge_status IS
    'NULL = non éligible à la purge. pending_dpo_approval = délai légal atteint (20 ans après discharge_date), validation DPO requise avant suppression définitive. approved/rejected = décision DPO (processus manuel).';

ALTER TABLE public.profiles
    ADD COLUMN account_closed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.account_closed_at IS
    'Date de fin de la relation contractuelle. NULL tant que le compte est actif — déclenche le délai de conservation de 5 ans avant suppression définitive du compte.';

CREATE TABLE public.purge_runs (
    id           SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_run_at  TIMESTAMPTZ,
    last_status  TEXT        CHECK (last_status = ANY (ARRAY['running','success','partial_error','error'])),
    last_results JSONB,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.purge_runs IS
    'Ligne singleton (id=1) : état persisté du job de purge RGPD, lu/écrit par services/rgpd/purge/purge.scheduler.js pour garantir une exécution quotidienne fiable (survit aux redémarrages, évite les doubles exécutions en cas de scaling horizontal). Alimente aussi le futur tableau de bord DPO.';

INSERT INTO public.purge_runs (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
