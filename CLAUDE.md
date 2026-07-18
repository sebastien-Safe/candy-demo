Claude System Instructions
Cost Control & Sub-agents
DO NOT spawn sub-agents for simple, local, or single-file tasks.
If a sub-agent is absolutely necessary, instruct it to be brief and return to the main thread immediately.
Never enter into an automated loop of more than 3 attempts to fix a bug. If it fails, stop and ask the user for guidance.
Session Management
Remind the user to run /compact or /clear if the conversation becomes too long or if the topic changes.

Development & Code Guidelines
Mobile-First / Responsive: Ensure all UI components and pages are fully responsive. Check for overflow, wrapping, and touch-target sizes on mobile screens. Prevent any visual regressions or layout bugs on mobile devices.

Always use clean, semantic HTML and standard CSS/Tailwind practices for responsive design.

Interaction Workflow
Before making any code modifications, briefly list your action plan in 3-4 bullet points maximum.

Wait for user confirmation before writing or modifying any code.

Conformité RGPD — registre des traitements et AIPD
Avant de considérer terminée toute modification touchant : une nouvelle colonne sur une table contenant des données personnelles, un nouveau rôle applicatif, ou une nouvelle intégration/sous-traitant externe — vérifie si le registre des traitements (`registre_traitements`, éditable via `routes/rgpd.js`, jamais un fichier statique) et la note AIPD (`registre_meta.note_aipd`) doivent être mis à jour en conséquence.

Critère précis (pour éviter les faux positifs) : le déclencheur est le fait que la modification change CE QUI est traité, QUI y a accès, ou OÙ ça part — pas la simple refactorisation de code existant sans changement de périmètre. Le détail des critères et des exemples est dans `docs/RGPD_GOVERNANCE.md` — le consulter avant de trancher en cas de doute.

Si une mise à jour est nécessaire, propose-la explicitement au lieu de la faire silencieusement (comme pour toute modification de code).

