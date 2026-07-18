/**
 * [ candy-e ] — FICHE DE LIAISON (transfert hospitalier)
 * Génère une synthèse imprimable d'une page : identité, urgence
 * (allergies, groupe sanguin, médecin traitant), traitements actifs,
 * dernières constantes, dernière transmission.
 */

import { api } from '../../core/api.js';
import { formatDate, formatDateTime, calcAge } from '../../utils/date.js';
import { formatNomComplet, orDash, formatNIR, formatTel } from '../../utils/format.js';

const VOIE_LABELS = { orale: 'orale', IV: 'IV', SC: 'SC', IM: 'IM', cutanee: 'cutanée', inhalee: 'inhalée', rectale: 'rectale', autre: '' };

export async function printFicheLiaison(patientId) {
  // Ouverture de la fenêtre AVANT les appels asynchrones : certains navigateurs
  // (Safari notamment) bloquent le popup s'il n'est plus rattaché de façon
  // synchrone au clic de l'utilisateur.
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) {
    alert('Veuillez autoriser les fenêtres pop-up pour imprimer la fiche de liaison.');
    return;
  }
  win.document.write('<p style="font-family:sans-serif;padding:2rem;color:#555;">Génération de la fiche de liaison…</p>');

  let patient;
  try {
    patient = await api.get(`/patients/${patientId}`);
  } catch {
    win.document.body.innerHTML = '<p style="font-family:sans-serif;padding:2rem;color:#b3261e;">Impossible de générer la fiche de liaison : patient introuvable.</p>';
    return;
  }

  const [traitements, constantes, transmissions] = await Promise.all([
    api.get(`/traitements?patientId=${patientId}`),
    api.get(`/constantes?patientId=${patientId}`),
    api.get(`/transmissions?patientId=${patientId}&limit=1`),
  ]);

  const traitementsActifs = (traitements ?? [])
    .filter(t => t.actif)
    .sort((a, b) => new Date(b.date_debut) - new Date(a.date_debut));
  const html = _buildFicheHtml(patient, traitementsActifs, (constantes ?? []).slice(0, 3), transmissions?.[0] ?? null);

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}

function _buildFicheHtml(p, traitements, constantes, derniereTransmission) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>Fiche de liaison — ${formatNomComplet(p.nom, p.prenom)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 12px; line-height: 1.4; margin: 0; padding: 0 4mm; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: #555; font-size: 11px; margin-bottom: 14px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 12px; }
  .field b { display: inline-block; min-width: 130px; color: #555; font-weight: 600; }
  .urgence { border: 2px solid #b3261e; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; }
  .urgence h2 { font-size: 13px; margin: 0 0 8px; color: #b3261e; }
  .urgence .field b { color: #7a1a15; }
  section { margin-bottom: 16px; }
  section h2 { font-size: 13px; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #eee; font-size: 11.5px; }
  th { color: #555; font-weight: 600; }
  .empty { color: #888; font-style: italic; }
  .transmission { border-left: 3px solid #555; padding: 6px 10px; background: #f5f5f5; }
  footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #ccc; font-size: 10px; color: #888; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>

  <button class="no-print" onclick="window.print()" style="float:right;margin:10px 0;padding:6px 14px;">🖨️ Imprimer</button>
  <h1>Fiche de liaison — Transfert</h1>
  <div class="sub">${formatNomComplet(p.nom, p.prenom)} · Née le ${formatDate(p.date_naissance)} (${calcAge(p.date_naissance)} ans) · Document généré le ${formatDateTime(new Date())}</div>

  <div class="urgence">
    <h2>⚠️ Informations essentielles</h2>
    <div class="grid">
      <div class="field"><b>Allergies</b> ${Array.isArray(p.allergies) && p.allergies.length ? p.allergies.join(', ') : 'Aucune allergie connue'}</div>
      <div class="field"><b>Groupe sanguin</b> ${orDash(p.groupe_sanguin)}</div>
      <div class="field"><b>Médecin traitant</b> ${orDash(p.medecin_nom)}</div>
      <div class="field"><b>N° Sécurité sociale</b> ${p.numero_secu ? formatNIR(p.numero_secu) : '—'}</div>
    </div>
  </div>

  <section>
    <h2>Identité</h2>
    <div class="grid">
      <div class="field"><b>Nom</b> ${(p.nom ?? '').toUpperCase()}</div>
      <div class="field"><b>Prénom</b> ${orDash(p.prenom)}</div>
      <div class="field"><b>Sexe</b> ${orDash(p.sexe)}</div>
      <div class="field"><b>Adresse</b> ${p.adresse ? `${p.adresse}, ${p.code_postal ?? ''} ${p.ville ?? ''}`.trim() : '—'}</div>
      <div class="field"><b>Téléphone</b> ${p.telephone ? formatTel(p.telephone) : '—'}</div>
      <div class="field"><b>GIR</b> ${orDash(p.gir)}</div>
    </div>
  </section>

  <section>
    <h2>Traitements en cours</h2>
    ${!traitements.length ? '<p class="empty">Aucun traitement actif renseigné.</p>' : `
    <table>
      <thead><tr><th>Médicament</th><th>Dose</th><th>Fréquence</th><th>Voie</th><th>Depuis le</th></tr></thead>
      <tbody>
        ${traitements.map(t => `
          <tr>
            <td>${t.medicament}${t.dci ? ` (${t.dci})` : ''}</td>
            <td>${orDash(t.dose)}</td>
            <td>${orDash(t.frequence)}</td>
            <td>${VOIE_LABELS[t.voie] ?? orDash(t.voie)}</td>
            <td>${formatDate(t.date_debut)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`}
  </section>

  <section>
    <h2>Dernières constantes</h2>
    ${!constantes.length ? '<p class="empty">Aucune constante enregistrée.</p>' : `
    <table>
      <thead><tr><th>Date</th><th>TA</th><th>FC</th><th>SpO₂</th><th>Temp.</th><th>Poids</th><th>Glycémie</th><th>Douleur</th></tr></thead>
      <tbody>
        ${constantes.map(c => `
          <tr>
            <td>${formatDateTime(c.date_mesure)}</td>
            <td>${c.tension_sys && c.tension_dia ? `${c.tension_sys}/${c.tension_dia}` : '—'}</td>
            <td>${orDash(c.frequence_cardiaque)}</td>
            <td>${c.saturation_o2 != null ? `${c.saturation_o2}%` : '—'}</td>
            <td>${c.temperature != null ? `${c.temperature}°C` : '—'}</td>
            <td>${c.poids != null ? `${c.poids} kg` : '—'}</td>
            <td>${orDash(c.glycemie)}</td>
            <td>${c.echelle_douleur != null ? `${c.echelle_douleur}/10` : '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`}
  </section>

  <section>
    <h2>Dernière transmission</h2>
    ${!derniereTransmission
      ? '<p class="empty">Aucune transmission enregistrée.</p>'
      : `<div class="transmission">
          <div style="font-size:10.5px;color:#666;margin-bottom:4px;">${formatDateTime(derniereTransmission.created_at)} · ${derniereTransmission.priorite}</div>
          ${derniereTransmission.contenu}
        </div>`}
  </section>

  <footer>Document généré par candy-e le ${formatDateTime(new Date())} — à remettre à l'équipe soignante lors du transfert. Ne remplace pas le dossier médical complet.</footer>

</body>
</html>`;
}
