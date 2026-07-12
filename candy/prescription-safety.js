// ================================================================
// C@NDY — Moteur de sécurité médicamenteuse (démo)
// Appelé depuis : patient-4, medicaments.html
// ================================================================

const DEMO_MEDICATIONS = [
  { id:'m01', nom:'Ramipril 5mg',         dci:'ramipril',                       classe:'IEC',                  ci:['angioedeme','grossesse'],                                              interactions:['potassium','lithium','AINS'],               surveillance:['fonction_renale','kaliemie'] },
  { id:'m02', nom:'Amlodipine 5mg',        dci:'amlodipine',                     classe:'ICC',                  ci:[],                                                                      interactions:['simvastatine_haute_dose'],                  surveillance:['tension'] },
  { id:'m03', nom:'Bisoprolol 5mg',        dci:'bisoprolol',                     classe:'bêta-bloquant',        ci:['asthme','bradycardie'],                                                interactions:['verapamil','diltiazem'],                    surveillance:['frequence_cardiaque'] },
  { id:'m04', nom:'Furosémide 40mg',       dci:'furosemide',                     classe:'diurétique',           ci:[],                                                                      interactions:['lithium','AINS','aminosides'],               surveillance:['kaliemie','natremie'] },
  { id:'m05', nom:'Metformine 1000mg',     dci:'metformine',                     classe:'biguanide',            ci:['insuffisance_renale_severe','produit_contraste_iode'],                  interactions:['alcool','contraste_iode'],                  surveillance:['fonction_renale','glycemie'] },
  { id:'m06', nom:'Sitagliptine 100mg',    dci:'sitagliptine',                   classe:'gliptine',             ci:[],                                                                      interactions:[],                                           surveillance:['fonction_renale'] },
  { id:'m07', nom:'Insuline Lispro',       dci:'insuline_lispro',                classe:'insuline',             ci:[],                                                                      interactions:['beta_bloquant','alcool'],                    surveillance:['glycemie'] },
  { id:'m08', nom:'Amoxicilline 1g',       dci:'amoxicilline',                   classe:'pénicilline',          ci:['allergie_penicilline'],                                                 interactions:['methotrexate','anticoagulants'],             surveillance:[] },
  { id:'m09', nom:'Augmentin 1g',          dci:'amoxicilline_acide_clavulanique',classe:'pénicilline',          ci:['allergie_penicilline','allergie_amoxicilline'],                         interactions:[],                                           surveillance:[] },
  { id:'m10', nom:'Azithromycine 500mg',   dci:'azithromycine',                  classe:'macrolide',            ci:[],                                                                      interactions:['amiodarone','anticoagulants_oraux'],         surveillance:['intervalle_qt'] },
  { id:'m11', nom:'Ciprofloxacine 500mg',  dci:'ciprofloxacine',                 classe:'fluoroquinolone',      ci:['epilepsie'],                                                            interactions:['AINS','anticoagulants','theophylline'],      surveillance:['tendon'] },
  { id:'m12', nom:'Paracétamol 1g',        dci:'paracetamol',                    classe:'antalgique',           ci:['insuffisance_hepatique_severe'],                                        interactions:['alcool'],                                   surveillance:[] },
  { id:'m13', nom:'Ibuprofène 400mg',      dci:'ibuprofene',                     classe:'AINS',                 ci:['insuffisance_renale','ulcere','grossesse_3e_trim'],                      interactions:['ramipril','furosemide','aspirine','lithium'], surveillance:['tension','fonction_renale'] },
  { id:'m14', nom:'Tramadol 50mg',         dci:'tramadol',                       classe:'opioïde faible',       ci:['epilepsie_non_controlee'],                                              interactions:['ISRS','IMAO','antidepresseurs'],             surveillance:['conscience','respiration'] },
  { id:'m15', nom:'Atorvastatin 20mg',     dci:'atorvastatin',                   classe:'statine',              ci:['insuffisance_hepatique','grossesse'],                                   interactions:['fibrates','ciclosporine','macrolide'],       surveillance:['CPK','transaminases'] },
  { id:'m16', nom:'Rivaroxaban 20mg',      dci:'rivaroxaban',                    classe:'anticoagulant',        ci:['saignement_actif'],                                                     interactions:['AINS','aspirine','azithromycine'],           surveillance:['saignement','fonction_renale'] },
  { id:'m17', nom:'Levothyrox 75µg',       dci:'levothyroxine',                  classe:'hormone thyroïdienne', ci:[],                                                                      interactions:['calcium','fer','antiacides'],                surveillance:['TSH'] },
  { id:'m18', nom:'Oméprazole 20mg',       dci:'omeprazole',                     classe:'IPP',                  ci:[],                                                                      interactions:['clopidogrel','methotrexate'],                surveillance:[] },
  { id:'m19', nom:'Alprazolam 0.25mg',     dci:'alprazolam',                     classe:'benzodiazépine',       ci:['insuffisance_respiratoire','apnee_sommeil'],                             interactions:['alcool','opioides','antihistaminiques'],     surveillance:['somnolence','dependance'] },
  { id:'m20', nom:'Prednisolone 20mg',     dci:'prednisolone',                   classe:'corticoïde',           ci:['infection_non_traitee'],                                                interactions:['AINS','anticoagulants','diuretiques'],       surveillance:['glycemie','tension','osteoporose'] },
];

const DEMO_PATIENT_PROFILES = {
  'patient-4': {
    allergies:   ['allergie_penicilline'],
    conditions:  ['diabete_t2','hta','hypercholesterolemie'],
    traitements: ['metformine','ramipril','atorvastatin'],
    grossesse:   false,
  },
  'patient-1': {
    allergies:   ['allergie_penicilline','allergie_aspirine'],
    conditions:  ['hta'],
    traitements: ['amlodipine','bisoprolol'],
    grossesse:   false,
  },
  'patient-2': { allergies:[], conditions:['lombalgie_chronique'], traitements:['paracetamol'], grossesse:false },
  'patient-3': { allergies:[], conditions:[], traitements:[], grossesse:false },
  'patient-5': { allergies:[], conditions:[], traitements:[], grossesse:false },
};

function checkPrescriptionSafety(query, patientId) {
  patientId = patientId || DEMO_PATIENT_ID;
  const profile = DEMO_PATIENT_PROFILES[patientId] || { allergies:[], conditions:[], traitements:[], grossesse:false };
  const q = (query || '').toLowerCase().trim();
  const med = DEMO_MEDICATIONS.find(m =>
    m.dci.toLowerCase().includes(q) ||
    m.nom.toLowerCase().includes(q) ||
    q.includes(m.dci.toLowerCase()) ||
    q.includes(m.nom.toLowerCase().split(' ')[0])
  );
  if (!med) return { level: null, message: '', canPrescribe: true };

  const alerts = [];

  const critiques = med.ci.filter(ci => {
    if (profile.allergies.includes(ci)) return true;
    if (ci === 'grossesse' && profile.grossesse) return true;
    if (profile.conditions.includes(ci)) return true;
    return false;
  });
  if (critiques.length) {
    return {
      level: 'critique',
      message: `🔴 CONTRE-INDICATION CRITIQUE — ${critiques.map(c=>c.replace(/_/g,' ')).join(', ')}. Prescription impossible.`,
      canPrescribe: false,
      med,
    };
  }

  const interactions = med.interactions.filter(i =>
    profile.traitements.some(t => t.replace(/_/g,'').includes(i.replace(/_/g,'')) || i.replace(/_/g,'').includes(t.replace(/_/g,'')))
  );
  if (interactions.length) {
    alerts.push({
      level: 'majeure',
      message: `🟠 INTERACTION MAJEURE avec traitement en cours — ${interactions.map(i=>i.replace(/_/g,' ')).join(', ')}. Confirmation requise.`,
    });
  }

  if (med.surveillance.length) {
    alerts.push({
      level: 'surveillance',
      message: `🟡 Surveillance recommandée — ${med.surveillance.map(s=>s.replace(/_/g,' ')).join(', ')}.`,
    });
  }

  if (!alerts.length) return { level: null, message: '✅ Aucune alerte pour ce patient.', canPrescribe: true, med };
  const worst = alerts.find(a => a.level === 'majeure') || alerts[0];
  return { ...worst, canPrescribe: true, allAlerts: alerts, med };
}

function findMedication(query) {
  query = (query || '').toLowerCase().trim();
  if (!query) return [];
  return DEMO_MEDICATIONS.filter(m =>
    m.nom.toLowerCase().includes(query) ||
    m.dci.toLowerCase().includes(query) ||
    m.classe.toLowerCase().includes(query)
  );
}
