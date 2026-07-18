-- ==============================================================================
-- [ candy-e ] — CORRIGE LE BUG UNIQUE(resident_id, auteur_id) SUR notes_suivi
-- Fichier    : database/migrations/013_notes_suivi_drop_unique.sql
-- Prérequis  : 001_init_schema.sql (création de la contrainte),
--              000_rename_legacy_patients_to_residents.sql (renommage de
--              l'index sous-jacent patient_id → resident_id)
--
-- Bug latent documenté depuis 001_init_schema.sql (conservé tel quel à
-- l'époque, hors périmètre de cette migration-là) : le frontend
-- (modules/patient/patient-record.js) fait un INSERT à chaque nouvelle note
-- de suivi, dans une logique de journal chronologique par résident — la
-- contrainte UNIQUE(resident_id, auteur_id) empêche un même auteur
-- d'écrire une deuxième note sur le même résident, ce qui casse ce cas
-- d'usage normal.
-- ==============================================================================

ALTER TABLE public.notes_suivi
    DROP CONSTRAINT notes_suivi_resident_id_auteur_id_key;
