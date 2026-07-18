# Gouvernance RGPD — quand mettre à jour le registre et l'AIPD

Ce document s'adresse à **quiconque modifie le code de candy-e** — développeur humain ou agent (Claude Code inclus, cf. `CLAUDE.md`). Il fixe un critère précis pour décider si une modification doit s'accompagner d'une mise à jour du registre des traitements ou de la note AIPD, afin d'éviter deux écueils symétriques : oublier une mise à jour nécessaire (faux négatif), ou déclencher la procédure pour un changement qui n'en a pas besoin (faux positif, qui use la vigilance de tout le monde à force de fausses alertes).

## Où vivent ces deux documents

- **Registre des traitements** : table `registre_traitements` en base — jamais un fichier statique versionné en Git (décision explicite, cf. `database/migrations/011_registre_traitements.sql`). Édité via le dashboard DPO (`#rgpd` → onglet Registre) ou directement via `PATCH /api/rgpd/registre/:code`.
- **Note AIPD** : `registre_meta.note_aipd`, même table, éditable via `PATCH /api/rgpd/registre-note`. C'est un rappel/pointeur, pas l'AIPD elle-même (qui reste un document d'analyse à part, tenu par le DPO) — mais il doit refléter fidèlement si l'AIPD est à jour ou en attente de révision.

## Le critère : QUOI / QUI / OÙ

Une modification déclenche l'obligation de vérifier le registre et l'AIPD si elle change au moins un des trois :

- **QUOI** est traité — une nouvelle catégorie de donnée personnelle apparaît (nouvelle colonne sur une table contenant des données personnelles : résidents, profils, identités, consultations, ordonnances, traitements, notes, transmissions, chutes, constantes, soins, documents, tournées, agenda).
- **QUI** y a accès — un nouveau rôle applicatif est créé, ou le périmètre d'accès d'un rôle existant change significativement (cf. `database/migrations/008_role_matrix_migration.sql` pour l'exemple de référence : chaque rôle de la matrice cible correspond à une ligne "destinataires" ou "personnes concernées" du registre).
- **OÙ** ça part — une nouvelle intégration externe ou un nouveau sous-traitant apparaît (nouveau fournisseur SMTP, nouvelle API tierce, nouveau service d'hébergement, nouvel outil d'analytics...). À vérifier aussi : tout ce qui pourrait faire sortir une donnée de l'UE.

**Ne déclenche PAS l'obligation** (pour éviter les faux positifs) :
- Refactorisation de code sans changement de colonne, de rôle ou d'intégration.
- Correction de bug qui ne change pas la nature du traitement.
- Changement purement visuel/UX côté frontend.
- Modification d'un outil interne qui ne touche jamais une donnée personnelle (script de build, config CI...).

## Exemples concrets tirés de ce dépôt

| Modification passée | Registre à jour ? | Ce qui a changé |
|---|---|---|
| Ajout du rôle `dpo` (migration 005) | Oui | Nouveau "QUI" — nouvelle ligne de destinataire potentiel dans T03 |
| Fusion `admin_crm`+`administrateur` → `super_admin` (migration 008) | Non | Renommage sans changement de périmètre d'accès réel (permissions strictement identiques) |
| Ajout de `residents.discharge_date` (migration 007) | Oui | Nouveau "QUOI" — nouvelle donnée traitée (date de sortie), pertinente pour T01 (durée de conservation) |
| Ajout du service email double-canal MSSanté/SMTP classique | Oui | Nouveau "OÙ" — un nouveau sous-traitant technique (opérateur MSSanté, fournisseur SMTP classique) doit apparaître dans les entrées concernées |
| Correction du bug d'ordre CHECK/UPDATE dans la migration 008 | Non | Pur correctif technique, aucun changement de périmètre |

## Comment faire la mise à jour concrètement

1. Identifier quelle(s) entrée(s) du registre sont concernées (T01-T05 existantes, ou nouvelle entrée si le traitement est vraiment nouveau — pas seulement une variante d'un traitement existant).
2. Mettre à jour les champs pertinents (`categories_donnees`, `destinataires`, `sous_traitants`, `duree_conservation`, `transferts_hors_ue`...) via le dashboard DPO ou `PATCH /api/rgpd/registre/:code`.
3. Si le changement est significatif (nouveau traitement à risque, changement de volume ou de sensibilité des données, nouvelle technologie) : mettre à jour `note_aipd` pour signaler qu'une révision de l'AIPD est nécessaire, via `PATCH /api/rgpd/registre-note`.
4. Toute mise à jour est automatiquement journalisée dans `audit_logs` (action `REGISTRE_UPDATED`) — pas besoin de la tracer ailleurs.

## En cas de doute

Le critère QUOI/QUI/OÙ ne couvre pas tous les cas de figure. En cas d'ambiguïté, la bonne pratique est de signaler explicitement le doute plutôt que de trancher silencieusement dans un sens ou dans l'autre — que ce soit un développeur qui pose la question en revue de code, ou un agent qui la pose à l'utilisateur avant de continuer.
