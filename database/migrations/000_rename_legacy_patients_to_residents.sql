-- ==============================================================================
-- [ candy-e ] — RENOMMAGE patients -> residents (environnements pré-existants)
-- Fichier    : database/migrations/000_rename_legacy_patients_to_residents.sql
--
-- 001_init_schema.sql crée le schéma avec la nomenclature residents/resident_id
-- directement (CREATE TABLE) : il ne s'applique donc qu'à une base vierge.
-- Cette migration comble l'écart pour un environnement pré-existant qui
-- contient encore l'ancienne nomenclature (patients/patient_id) — cas de
-- l'addon PostgreSQL Clever Cloud utilisé par ce projet, alimenté à
-- l'origine par une copie de démo antérieure à la réconciliation de la RLS.
--
-- Idempotente : si "residents" existe déjà (base créée directement via
-- 001_init_schema.sql), ce script ne fait rien.
--
-- Portée strictement DDL — aucune ligne n'est lue, modifiée ou supprimée.
-- Postgres résout les FK/index/policies/triggers par OID interne, pas par
-- nom : renommer la table et les colonnes ne casse rien de fonctionnel ; les
-- renommages de contraintes/index/policies ci-dessous sont cosmétiques
-- (cohérence avec le nom des tables), pas correctifs.
-- ==============================================================================

DO $$
BEGIN
  IF to_regclass('public.patients') IS NULL OR to_regclass('public.residents') IS NOT NULL THEN
    RAISE NOTICE 'residents déjà en place (ou patients absente) — rien à faire.';
    RETURN;
  END IF;

  -- Table
  ALTER TABLE public.patients RENAME TO residents;

  -- Colonnes patient_id -> resident_id sur toutes les tables qui référencent residents
  ALTER TABLE public.agenda            RENAME COLUMN patient_id TO resident_id;
  ALTER TABLE public.chutes            RENAME COLUMN patient_id TO resident_id;
  ALTER TABLE public.constantes        RENAME COLUMN patient_id TO resident_id;
  ALTER TABLE public.consultations     RENAME COLUMN patient_id TO resident_id;
  ALTER TABLE public.documents         RENAME COLUMN patient_id TO resident_id;
  ALTER TABLE public.notes_suivi       RENAME COLUMN patient_id TO resident_id;
  ALTER TABLE public.ordonnances       RENAME COLUMN patient_id TO resident_id;
  ALTER TABLE public.soins_pansements  RENAME COLUMN patient_id TO resident_id;
  ALTER TABLE public.tournees_soins    RENAME COLUMN patient_id TO resident_id;
  ALTER TABLE public.traitements       RENAME COLUMN patient_id TO resident_id;
  ALTER TABLE public.transmissions     RENAME COLUMN patient_id TO resident_id;

  -- Contraintes (cosmétique — noms alignés sur la nouvelle nomenclature)
  ALTER TABLE public.residents RENAME CONSTRAINT patients_pkey             TO residents_pkey;
  ALTER TABLE public.residents RENAME CONSTRAINT patients_gir_check        TO residents_gir_check;
  ALTER TABLE public.residents RENAME CONSTRAINT patients_groupe_sanguin_check TO residents_groupe_sanguin_check;
  ALTER TABLE public.residents RENAME CONSTRAINT patients_sexe_check       TO residents_sexe_check;
  ALTER TABLE public.residents RENAME CONSTRAINT patients_created_by_fkey  TO residents_created_by_fkey;
  ALTER TABLE public.residents RENAME CONSTRAINT patients_medecin_id_fkey  TO residents_medecin_id_fkey;

  ALTER TABLE public.agenda           RENAME CONSTRAINT agenda_patient_id_fkey           TO agenda_resident_id_fkey;
  ALTER TABLE public.chutes           RENAME CONSTRAINT chutes_patient_id_fkey           TO chutes_resident_id_fkey;
  ALTER TABLE public.constantes       RENAME CONSTRAINT constantes_patient_id_fkey       TO constantes_resident_id_fkey;
  ALTER TABLE public.consultations    RENAME CONSTRAINT consultations_patient_id_fkey    TO consultations_resident_id_fkey;
  ALTER TABLE public.documents        RENAME CONSTRAINT documents_patient_id_fkey        TO documents_resident_id_fkey;
  ALTER TABLE public.notes_suivi      RENAME CONSTRAINT notes_suivi_patient_id_fkey      TO notes_suivi_resident_id_fkey;
  ALTER TABLE public.ordonnances      RENAME CONSTRAINT ordonnances_patient_id_fkey      TO ordonnances_resident_id_fkey;
  ALTER TABLE public.soins_pansements RENAME CONSTRAINT soins_pansements_patient_id_fkey TO soins_pansements_resident_id_fkey;
  ALTER TABLE public.tournees_soins   RENAME CONSTRAINT tournees_soins_patient_id_fkey   TO tournees_soins_resident_id_fkey;
  ALTER TABLE public.traitements      RENAME CONSTRAINT traitements_patient_id_fkey      TO traitements_resident_id_fkey;
  ALTER TABLE public.transmissions    RENAME CONSTRAINT transmissions_patient_id_fkey    TO transmissions_resident_id_fkey;

  -- Index (cosmétique)
  ALTER INDEX public.idx_traitements_patient   RENAME TO idx_traitements_resident;
  ALTER INDEX public.idx_constantes_patient    RENAME TO idx_constantes_resident;
  ALTER INDEX public.idx_transmissions_patient RENAME TO idx_transmissions_resident;
  ALTER INDEX public.notes_suivi_patient_id_auteur_id_key RENAME TO notes_suivi_resident_id_auteur_id_key;
  ALTER INDEX public.idx_soins_patient         RENAME TO idx_soins_resident;
  ALTER INDEX public.idx_tournees_patient_date RENAME TO idx_tournees_resident_date;

  -- Trigger
  ALTER TRIGGER trg_patients_updated_at ON public.residents RENAME TO trg_residents_updated_at;

  -- Policies RLS (cosmétique — la fonction get_my_profile_role() et les
  -- conditions restent identiques, seul le libellé change)
  ALTER POLICY patients_select ON public.residents RENAME TO residents_select;
  ALTER POLICY patients_insert ON public.residents RENAME TO residents_insert;
  ALTER POLICY patients_update ON public.residents RENAME TO residents_update;
  ALTER POLICY patients_delete ON public.residents RENAME TO residents_delete;

  RAISE NOTICE 'Renommage patients -> residents terminé.';
END $$;
