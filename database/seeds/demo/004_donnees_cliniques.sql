-- ==============================================================================
-- [ candy-demo ] — SEED DÉMO : données cliniques associées aux résidents fictifs
-- Fichier : database/seeds/demo/004_donnees_cliniques.sql
--
-- Consultations, constantes, traitements, transmissions, agenda, tournées de
-- soins, notes de suivi, chutes, ordonnances, soins/pansements — un
-- échantillon par résident pour que la démo soit visuellement complète.
-- Idempotent : chaque INSERT porte un id fixe + ON CONFLICT DO NOTHING.
-- ==============================================================================

-- --- Consultations ---
INSERT INTO public.consultations (id, resident_id, medecin_id, date_consult, type_acte, titre, notes, created_by)
VALUES
    ('33333333-0001-0000-0000-000000000001', '22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000004',
     CURRENT_DATE - 5, 'Consultation', 'Suivi mensuel', 'RAS, état stable.', '11111111-1111-1111-1111-000000000004'),
    ('33333333-0001-0000-0000-000000000002', '22222222-2222-2222-2222-000000000002', '11111111-1111-1111-1111-000000000004',
     CURRENT_DATE - 12, 'Bilan', 'Bilan gériatrique annuel', 'Prescription kiné renouvelée.', '11111111-1111-1111-1111-000000000004'),
    ('33333333-0001-0000-0000-000000000003', '22222222-2222-2222-2222-000000000004', '11111111-1111-1111-1111-000000000004',
     CURRENT_DATE - 2, 'Urgence', 'Suite chute', 'Contusion sans gravité, surveillance.', '11111111-1111-1111-1111-000000000004')
ON CONFLICT (id) DO NOTHING;

-- --- Constantes ---
INSERT INTO public.constantes (id, resident_id, date_mesure, tension_sys, tension_dia, frequence_cardiaque, saturation_o2, temperature, poids, echelle_douleur, saisie_par)
VALUES
    ('33333333-0002-0000-0000-000000000001', '22222222-2222-2222-2222-000000000001', now() - interval '1 day', 135, 82, 72, 96, 36.7, 58.5, 1, '11111111-1111-1111-1111-000000000005'),
    ('33333333-0002-0000-0000-000000000002', '22222222-2222-2222-2222-000000000002', now() - interval '1 day', 142, 88, 78, 94, 37.0, 74.0, 2, '11111111-1111-1111-1111-000000000005'),
    ('33333333-0002-0000-0000-000000000003', '22222222-2222-2222-2222-000000000003', now() - interval '2 days', 128, 76, 68, 97, 36.5, 52.0, 0, '11111111-1111-1111-1111-000000000005'),
    ('33333333-0002-0000-0000-000000000004', '22222222-2222-2222-2222-000000000004', now() - interval '1 day', 150, 90, 80, 93, 37.2, 68.5, 3, '11111111-1111-1111-1111-000000000005')
ON CONFLICT (id) DO NOTHING;

-- --- Traitements ---
INSERT INTO public.traitements (id, resident_id, medicament, dci, dose, voie, frequence, date_debut, prescripteur_id, notes)
VALUES
    ('33333333-0003-0000-0000-000000000001', '22222222-2222-2222-2222-000000000001', 'Doliprane', 'Paracétamol', '1000mg', 'orale', '3x/jour si douleur', CURRENT_DATE - 30, '11111111-1111-1111-1111-000000000004', NULL),
    ('33333333-0003-0000-0000-000000000002', '22222222-2222-2222-2222-000000000002', 'Kardegic', 'Acétylsalicylate de lysine', '75mg', 'orale', '1x/jour', CURRENT_DATE - 90, '11111111-1111-1111-1111-000000000004', 'Prévention cardiovasculaire'),
    ('33333333-0003-0000-0000-000000000003', '22222222-2222-2222-2222-000000000004', 'Lasilix', 'Furosémide', '20mg', 'orale', '1x/jour le matin', CURRENT_DATE - 15, '11111111-1111-1111-1111-000000000004', NULL)
ON CONFLICT (id) DO NOTHING;

-- --- Transmissions ---
INSERT INTO public.transmissions (id, resident_id, type, priorite, contenu, auteur_id)
VALUES
    ('33333333-0004-0000-0000-000000000001', '22222222-2222-2222-2222-000000000001', 'observation', 'normale', 'Bon appétit ce midi, moral stable.', '11111111-1111-1111-1111-000000000006'),
    ('33333333-0004-0000-0000-000000000002', '22222222-2222-2222-2222-000000000004', 'alerte', 'urgente', 'Chute dans la chambre ce matin, cf. fiche de liaison associée.', '11111111-1111-1111-1111-000000000006'),
    ('33333333-0004-0000-0000-000000000003', '22222222-2222-2222-2222-000000000003', 'consigne', 'normale', 'Penser à vérifier la prochaine commande de protections.', '11111111-1111-1111-1111-000000000005')
ON CONFLICT (id) DO NOTHING;

-- --- Agenda ---
INSERT INTO public.agenda (id, resident_id, medecin_id, date_rdv, duree_minutes, type_rdv, titre, statut, created_by)
VALUES
    ('33333333-0005-0000-0000-000000000001', '22222222-2222-2222-2222-000000000002', '11111111-1111-1111-1111-000000000004',
     now() + interval '3 days', 30, 'Suivi', 'Contrôle post-bilan', 'planifie', '11111111-1111-1111-1111-000000000008'),
    ('33333333-0005-0000-0000-000000000002', '22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000004',
     now() + interval '10 days', 30, 'Consultation', 'Suivi mensuel', 'planifie', '11111111-1111-1111-1111-000000000008')
ON CONFLICT (id) DO NOTHING;

-- --- Tournées de soins ---
INSERT INTO public.tournees_soins (id, resident_id, date_soin, type_tournee, type_toilette, habillage, repas, mode_elimination, urines, selles, etat_sommeil, saisie_par)
VALUES
    ('33333333-0006-0000-0000-000000000001', '22222222-2222-2222-2222-000000000001', CURRENT_DATE, 'matinale', 'complete_lit', TRUE, 'pris', 'toilettes', 'ok', 'ok_moulees', 'calme', '11111111-1111-1111-1111-000000000006'),
    ('33333333-0006-0000-0000-000000000002', '22222222-2222-2222-2222-000000000002', CURRENT_DATE, 'matinale', 'douche', TRUE, 'partiel', 'toilettes', 'ok', 'absentes', 'agite', '11111111-1111-1111-1111-000000000006')
ON CONFLICT (id) DO NOTHING;

-- --- Notes de suivi (1 seule par couple résident/auteur, contrainte UNIQUE) ---
INSERT INTO public.notes_suivi (id, resident_id, auteur_id, contenu)
VALUES
    ('33333333-0007-0000-0000-000000000001', '22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000005', 'Résidente très sociable, participe activement aux animations.'),
    ('33333333-0007-0000-0000-000000000002', '22222222-2222-2222-2222-000000000004', '11111111-1111-1111-1111-000000000006', 'Vigilance chute à maintenir, déambulateur toujours à proximité.')
ON CONFLICT (id) DO NOTHING;

-- --- Chutes ---
INSERT INTO public.chutes (id, resident_id, date_evenement, heure_evenement, lieu, activite, temoin, etat_conscience, notes, saisie_par)
VALUES
    ('33333333-0008-0000-0000-000000000001', '22222222-2222-2222-2222-000000000004', CURRENT_DATE - 2, '08:30', 'chambre_lit', 'lever_nocturne', 'non', 'conscient_alerte', 'Chute sans témoin, résident retrouvé au sol au réveil de l''équipe.', '11111111-1111-1111-1111-000000000006')
ON CONFLICT (id) DO NOTHING;

-- --- Ordonnances ---
INSERT INTO public.ordonnances (id, resident_id, medecin_id, reference, contenu, statut)
VALUES
    ('33333333-0009-0000-0000-000000000001', '22222222-2222-2222-2222-000000000002', '11111111-1111-1111-1111-000000000004',
     'ORD-DEMO-0001', 'Kinésithérapie 2x/semaine, rééducation à la marche.', 'active')
ON CONFLICT (id) DO NOTHING;

-- --- Soins/pansements ---
INSERT INTO public.soins_pansements (id, resident_id, type_soin, localisation, description, stade, saisie_par)
VALUES
    ('33333333-0010-0000-0000-000000000001', '22222222-2222-2222-2222-000000000003', 'escarre', 'Talon droit', 'Surveillance et pansement hydrocolloïde.', 'II', '11111111-1111-1111-1111-000000000005')
ON CONFLICT (id) DO NOTHING;
