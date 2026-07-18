-- ==============================================================================
-- [ candy-demo ] — SEED DÉMO : un compte par rôle (9 rôles)
-- Fichier : database/seeds/demo/001_profiles_9_roles.sql
--
-- Identités entièrement fictives (aucune donnée réelle). Mot de passe commun
-- aux 9 comptes pour faciliter la démo : DemoCandy2026!
-- Idempotent : ON CONFLICT (id) DO NOTHING, rejouable sans effet de bord.
--
-- Réservé au dépôt candy-demo — ne jamais appliquer sur la base de
-- production (aucune donnée résident/personnel réelle autorisée).
-- ==============================================================================

INSERT INTO public.profiles
    (id, email, prenom, nom, role, specialite, rpps, telephone,
     cabinet_nom, actif, password_hash, created_at, updated_at)
VALUES
    ('11111111-1111-1111-1111-000000000001', 'super.admin@demo.candy-e.fr', 'Alexandre', 'Dupuis', 'super_admin',
     NULL, NULL, '0600000001', 'EHPAD Démo Les Tilleuls', TRUE,
     '$2a$10$UUCdxqaFaWGlHwi3Q814veXXNEuPKmGodqHNEoac3zsDRoxiIOzxe', now(), now()),

    ('11111111-1111-1111-1111-000000000002', 'directeur@demo.candy-e.fr', 'Isabelle', 'Fontaine', 'directeur_etablissement',
     NULL, NULL, '0600000002', 'EHPAD Démo Les Tilleuls', TRUE,
     '$2a$10$UUCdxqaFaWGlHwi3Q814veXXNEuPKmGodqHNEoac3zsDRoxiIOzxe', now(), now()),

    ('11111111-1111-1111-1111-000000000003', 'cadre.sante@demo.candy-e.fr', 'Nathalie', 'Girard', 'cadre_sante',
     NULL, NULL, '0600000003', 'EHPAD Démo Les Tilleuls', TRUE,
     '$2a$10$UUCdxqaFaWGlHwi3Q814veXXNEuPKmGodqHNEoac3zsDRoxiIOzxe', now(), now()),

    ('11111111-1111-1111-1111-000000000004', 'medecin@demo.candy-e.fr', 'Julien', 'Moreau', 'medecin',
     'Gériatrie', '99999999999', '0600000004', 'EHPAD Démo Les Tilleuls', TRUE,
     '$2a$10$UUCdxqaFaWGlHwi3Q814veXXNEuPKmGodqHNEoac3zsDRoxiIOzxe', now(), now()),

    ('11111111-1111-1111-1111-000000000005', 'infirmiere@demo.candy-e.fr', 'Camille', 'Lefevre', 'infirmiere',
     NULL, NULL, '0600000005', 'EHPAD Démo Les Tilleuls', TRUE,
     '$2a$10$UUCdxqaFaWGlHwi3Q814veXXNEuPKmGodqHNEoac3zsDRoxiIOzxe', now(), now()),

    ('11111111-1111-1111-1111-000000000006', 'aide.soignante@demo.candy-e.fr', 'Sophie', 'Bernard', 'aide_soignante',
     NULL, NULL, '0600000006', 'EHPAD Démo Les Tilleuls', TRUE,
     '$2a$10$UUCdxqaFaWGlHwi3Q814veXXNEuPKmGodqHNEoac3zsDRoxiIOzxe', now(), now()),

    ('11111111-1111-1111-1111-000000000007', 'kine@demo.candy-e.fr', 'Marc', 'Petit', 'intervenant_soins_exterieur',
     'Kinésithérapeute', NULL, '0600000007', 'Cabinet libéral démo', TRUE,
     '$2a$10$UUCdxqaFaWGlHwi3Q814veXXNEuPKmGodqHNEoac3zsDRoxiIOzxe', now(), now()),

    ('11111111-1111-1111-1111-000000000008', 'secretaire@demo.candy-e.fr', 'Laura', 'Simon', 'secretaire',
     NULL, NULL, '0600000008', 'EHPAD Démo Les Tilleuls', TRUE,
     '$2a$10$UUCdxqaFaWGlHwi3Q814veXXNEuPKmGodqHNEoac3zsDRoxiIOzxe', now(), now()),

    ('11111111-1111-1111-1111-000000000009', 'dpo@demo.candy-e.fr', 'Thomas', 'Rousseau', 'dpo',
     NULL, NULL, '0600000009', 'EHPAD Démo Les Tilleuls', TRUE,
     '$2a$10$UUCdxqaFaWGlHwi3Q814veXXNEuPKmGodqHNEoac3zsDRoxiIOzxe', now(), now())
ON CONFLICT (id) DO NOTHING;
