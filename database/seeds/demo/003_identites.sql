-- ==============================================================================
-- [ candy-demo ] — SEED DÉMO : identités RNIV (une par résident)
-- Fichier : database/seeds/demo/003_identites.sql
--
-- Statuts volontairement variés pour illustrer le cycle de vie RNIV complet :
-- PROVISOIRE -> RECUPEREE (INSi) -> VALIDEE (justificatif) -> QUALIFIEE.
-- Numéros INS et codes INSEE entièrement fictifs.
--
-- Note : identite_fictive reste FALSE ici (résidents.is_demo=true suffit à
-- marquer ces lignes comme démo) — identite_fictive a un sens clinique
-- distinct (identité non recoupée à une vraie personne, ex. patient inconscient
-- admis en urgence) et sa contrainte CHECK impose statut_identite='PROVISOIRE'
-- si elle est vraie, ce qui empêcherait de montrer les 4 statuts ci-dessous.
-- ==============================================================================

-- Marguerite Dubois — cycle complet, identité qualifiée
INSERT INTO public.identites
    (resident_id, nom_naissance, premier_prenom_naissance, liste_prenoms,
     date_naissance, sexe, code_insee_lieu_naissance, matricule_ins, oid_ins,
     statut_identite, justificatif_type, date_qualification)
VALUES
    ('22222222-2222-2222-2222-000000000001', 'Dubois', 'Marguerite', ARRAY['Marguerite','Jeanne'],
     '1935-03-12', 'F', '75101', '235037512345678', '1.2.250.1.213.1.4.8',
     'QUALIFIEE', 'CNI', now() - interval '30 days')
ON CONFLICT (resident_id) DO NOTHING;

-- Henri Lefort — justificatif fourni, pas encore de récupération INSi
INSERT INTO public.identites
    (resident_id, nom_naissance, premier_prenom_naissance, liste_prenoms,
     date_naissance, sexe, code_insee_lieu_naissance,
     statut_identite, justificatif_type)
VALUES
    ('22222222-2222-2222-2222-000000000002', 'Lefort', 'Henri', ARRAY['Henri','Marcel'],
     '1938-07-25', 'M', '69123',
     'VALIDEE', 'passeport')
ON CONFLICT (resident_id) DO NOTHING;

-- Yvonne Rousseau — état initial, rien de fait encore
INSERT INTO public.identites
    (resident_id, nom_naissance, premier_prenom_naissance, liste_prenoms,
     date_naissance, sexe, code_insee_lieu_naissance,
     statut_identite)
VALUES
    ('22222222-2222-2222-2222-000000000003', 'Rousseau', 'Yvonne', ARRAY['Yvonne'],
     '1930-11-02', 'F', '13055',
     'PROVISOIRE')
ON CONFLICT (resident_id) DO NOTHING;

-- Robert Faure — INS récupéré via INSi, justificatif pas encore fourni
INSERT INTO public.identites
    (resident_id, nom_naissance, premier_prenom_naissance, liste_prenoms,
     date_naissance, sexe, code_insee_lieu_naissance, matricule_ins, oid_ins,
     statut_identite)
VALUES
    ('22222222-2222-2222-2222-000000000004', 'Faure', 'Robert', ARRAY['Robert','Louis'],
     '1933-01-18', 'M', '59350', '133011933987654', '1.2.250.1.213.1.4.8',
     'RECUPEREE')
ON CONFLICT (resident_id) DO NOTHING;
