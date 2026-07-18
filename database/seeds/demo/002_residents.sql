-- ==============================================================================
-- [ candy-demo ] — SEED DÉMO : résidents fictifs
-- Fichier : database/seeds/demo/002_residents.sql
--
-- 4 résidents entièrement fictifs, is_demo=true. Aucune donnée réelle.
-- Idempotent : ON CONFLICT (id) DO NOTHING.
-- ==============================================================================

INSERT INTO public.residents
    (id, nom, prenom, date_naissance, sexe, situation, profession,
     groupe_sanguin, medecin_id, medecin_nom, allergies, poids, taille,
     tension_sys, tension_dia, spo2, rythme_cardiaque, actif, created_by,
     is_demo, gir)
VALUES
    ('22222222-2222-2222-2222-000000000001', 'Dubois', 'Marguerite', '1935-03-12', 'F', 'Veuve', 'Institutrice retraitée',
     'A+', '11111111-1111-1111-1111-000000000004', 'Dr Julien Moreau', '["pénicilline"]'::jsonb, 58.5, 160,
     135, 82, 96, 72, TRUE, '11111111-1111-1111-1111-000000000003',
     TRUE, 3),

    ('22222222-2222-2222-2222-000000000002', 'Lefort', 'Henri', '1938-07-25', 'M', 'Marié', 'Ancien artisan menuisier',
     'O-', '11111111-1111-1111-1111-000000000004', 'Dr Julien Moreau', '[]'::jsonb, 74.0, 172,
     142, 88, 94, 78, TRUE, '11111111-1111-1111-1111-000000000003',
     TRUE, 4),

    ('22222222-2222-2222-2222-000000000003', 'Rousseau', 'Yvonne', '1930-11-02', 'F', 'Célibataire', 'Ancienne commerçante',
     'B+', '11111111-1111-1111-1111-000000000004', 'Dr Julien Moreau', '["arachides", "iode"]'::jsonb, 52.0, 155,
     128, 76, 97, 68, TRUE, '11111111-1111-1111-1111-000000000003',
     TRUE, 2),

    ('22222222-2222-2222-2222-000000000004', 'Faure', 'Robert', '1933-01-18', 'M', 'Veuf', 'Ancien cheminot',
     'AB+', '11111111-1111-1111-1111-000000000004', 'Dr Julien Moreau', '[]'::jsonb, 68.5, 168,
     150, 90, 93, 80, TRUE, '11111111-1111-1111-1111-000000000003',
     TRUE, 5)
ON CONFLICT (id) DO NOTHING;
