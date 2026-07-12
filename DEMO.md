# Démo — candy-e & C@NDY

**URL** : https://sebastien-safe.github.io/candy-demo/
**Mot de passe** (les deux modes) : `candy-demo`

## candy-e — Établissements EHPAD / SSR

Système d'information de santé pour les établissements médico-sociaux (EHPAD, soins de
suite et de réadaptation). Couvre les tournées de soins 24h, les transmissions
d'équipe, le suivi des traitements, les constantes vitales, l'agenda et le dossier
patient complet (GIR, pathologies, chutes, documents). Interface pensée pour une
utilisation par le personnel soignant (IDE, aide-soignant·e, cadre de santé, médecin
référent). Dans cette démo, la persona est un·e cadre de santé avec accès à
l'ensemble des modules, y compris statistiques et administration.

## C@NDY — Professions médicales libérales

Logiciel de gestion de cabinet médical pour les professions libérales (médecins,
infirmiers, secrétariat). Couvre le dossier patient, les ordonnances et la sécurité
médicamenteuse, l'agenda de consultations et les notes de suivi. Dans cette démo, la
persona est un·e médecin avec accès complet aux dossiers patients.

## Ce que la démo montre

- L'ensemble des écrans et modules de chaque application, avec des données 100%
  fictives (résidents/patients, transmissions, traitements, agenda, statistiques).
- La navigation complète entre modules, la consultation de dossiers, l'ajout de
  notes/transmissions (les modifications restent en mémoire le temps de la session
  du navigateur, sans jamais être persistées ni envoyées à un serveur).

## Ce que la démo ne montre pas

- Aucune connexion réseau réelle : les deux variantes fonctionnent entièrement en
  local dans le navigateur (aucun appel à Supabase ni à une API backend).
- Pas de gestion de comptes réels, pas de rôles multiples avancés (un seul profil
  démo par application), pas de fonctionnalités liées à l'authentification réelle
  (mot de passe oublié, réinitialisation) — ces pages redirigent simplement vers
  l'application.
- Aucune donnée réelle de patient, d'établissement ou de professionnel de santé.
