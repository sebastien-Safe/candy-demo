# Matrice des rôles — candy-e

Document destiné à l'insertion dans le dossier de conformité PSC, section **EXI EDC PSC 102 — Contrôle 2** (principe de moindre privilège), dans le cadre du référencement Ségur Vague 2, couloir médico-social MS-DUI (REM-MS-DUI-Va2).

Source technique : `frontend/src/core/rbac.js` (permissions applicatives), `database/migrations/008_role_matrix_migration.sql` (policies RLS PostgreSQL — defense in depth), `routes/*.js` (guards `requireRole()`).

## Périmètre non couvert

**ViaTrajectoire (SC.CDA/VT.13) est hors périmètre** : aucune table, route ni intégration ViaTrajectoire n'existe dans ce dépôt à ce jour. La séparation données de soin / données administratives qu'exige SC.CDA/VT.13 pour les données d'évaluation ViaTrajectoire n'a donc pas d'objet applicable pour l'instant — elle devra être réévaluée lors de l'intégration de ce téléservice.

## Tableau de synthèse

| Slug | Type de compte | Niveau de privilège | Accès données de santé | Périmètre données de santé | Justification moindre privilège | Référence REMMS/EDC |
|---|---|---|---|---|---|---|
| `super_admin` | Compte à privilège | Administrateur technique | Non | — | Compte à privilèges strictement séparé des comptes métier — seul rôle habilité à créer un compte ou modifier un rôle ; aucun accès direct aux données cliniques hors administration système | SC.SSI/IAM.92, EXI EDC PSC 102 |
| `directeur_etablissement` | Compte utilisateur | Direction | Oui — lecture seule (+ écriture limitée à `discharge_date`) | résidents, consultations, transmissions, agenda (lecture) ; statistiques | Pilotage et archivage : lecture seule sur les données cliniques nécessaires au reporting ; écriture strictement limitée à la date de sortie via une route dédiée (jamais un accès générique) ; peut désactiver un compte mais jamais en créer ni en changer le rôle (SC.SSI/IAM.92) | MS.RPT/CD.03, MS.RPT/RAMA.01, SC.SSI/IAM.92 |
| `cadre_sante` | Compte utilisateur | Encadrement soignant | Oui — lecture + écriture | ordonnances, traitements, soins_pansements, consultations, transmissions, constantes, notes de suivi, chutes, agenda | Rôle de coordination clinique nécessitant une vision et une capacité d'action complètes sur le dossier de soins ; ne gère plus les comptes utilisateurs (retiré de ce rôle pour respecter la séparation comptes à privilèges / comptes métier) | SC.SSI/IAM.92, SC.SSI/IE.33 |
| `medecin` | Compte utilisateur | Soignant | Oui — lecture + écriture | ordonnances, traitements, soins_pansements, consultations, transmissions, constantes, notes de suivi, chutes, agenda | Accès complet au circuit de soins conforme à la profession réglementée — seul rôle, avec `cadre_sante`, habilité à prescrire | SC.SSI/IE.33 |
| `infirmiere` | Compte utilisateur | Soignant | Oui — lecture + écriture partielle | soins_pansements (L+E), transmissions (L+E), constantes (L+E), notes (L+E), chutes (L+E), tournées (L+E) ; ordonnances/traitements/consultations en lecture seule | Périmètre limité au rôle infirmier : exécution et suivi des soins, hors circuit de prescription | SC.SSI/IE.33 |
| `aide_soignante` | Compte utilisateur | Soignant | Oui — écriture limitée | transmissions, constantes, notes, chutes, tournées (L+E) ; aucun accès ordonnances/traitements/consultations/soins_pansements | Accompagnement quotidien sans circuit médicament ni acte médical — accès clinique volontairement restreint | SC.SSI/IE.33 |
| `intervenant_soins_exterieur` | Compte utilisateur | Soignant externe | Oui — écriture limitée | transmissions (L+E) uniquement | Intervenant libéral externe (kinésithérapeute, psychologue, ergothérapeute) — fusion de trois rôles nivelée au strict minimum commun ; perte volontaire de l'accès consultations/notes/constantes/chutes/agenda que certains de ces profils détenaient individuellement avant fusion, au bénéfice du moindre privilège | SC.SSI/IE.33, EXI EDC PSC 102 |
| `secretaire` | Compte utilisateur | Administratif | Accès résiduel non réévalué (lecture ordonnances héritée) | agenda (L+E), ordonnances (lecture) | Gestion administrative (agenda, dossiers) — permissions conservées à l'identique sur décision explicite, non réévaluées dans cette migration | MS.CDM/VT.01 |
| `dpo` | Compte utilisateur | RGPD | Non | — | Scopé RGPD uniquement (journal d'audit, registre des traitements, purge, droits des personnes) — aucun accès aux données de soin | SC.SSI/GEN.02.BIS |
| `medecin_demo` *(déprécié)* | Compte de démonstration | Soignant (démo) | Oui — lecture seule, résidents `is_demo=true` uniquement | résidents fictifs uniquement | Conservé en base pour compatibilité, retiré du formulaire de création de compte — ne doit plus être attribué à un nouveau compte ; audit des comptes existants requis avant suppression définitive | Point d'attention audit PASSI |

## Rôles fusionnés / supprimés

| Ancien slug | Devenir |
|---|---|
| `admin_crm`, `administrateur` | Fusionnés → `super_admin` (permissions strictement identiques en réel, aucune perte) |
| `cadre` | Renommé → `cadre_sante`, **avec extension** de lecture seule vers lecture+écriture sur ordonnances/traitements/soins_pansements/constantes (décision explicite, pas un effet de bord du renommage) |
| `kine`, `psycho`, `ergo` | Fusionnés → `intervenant_soins_exterieur`, nivelés au minimum commun (transmissions L+E) — **perte** volontaire d'accès par rapport à certains de ces rôles pris individuellement |
| `ash` | **Supprimé** (`014_remove_ash_role.sql`, clôture 2026-07-17) — audit préalable : 0 compte avec `role = 'ash'` en base, suppression directe sans réassignation |

## Séparation comptes à privilèges / comptes métier (SC.SSI/IAM.92)

Seul `super_admin` peut créer un compte ou modifier un rôle. `directeur_etablissement`, bien qu'ayant un accès en lecture large, ne peut que désactiver un compte existant (`actif → false`), jamais le créer, le réactiver, ni changer son rôle — appliqué à la fois côté route (`routes/profiles.js`, `routes/auth.js`) et côté RLS (`database/migrations/008_role_matrix_migration.sql`).

## Limite technique documentée

PostgreSQL RLS ne permet pas nativement de restreindre une écriture à une seule colonne. L'accès en écriture de `directeur_etablissement` sur `residents.discharge_date` et de `directeur_etablissement` sur `profiles.actif` est donc accordé au niveau ligne par les policies RLS, la restriction à la colonne précise étant appliquée exclusivement côté application (`routes/patients.js:POST /:id/sortie`, `routes/profiles.js:PATCH`) — ce rôle n'a jamais accès aux routes génériques de modification. Documenté ici pour audit PASSI plutôt que laissé implicite.
