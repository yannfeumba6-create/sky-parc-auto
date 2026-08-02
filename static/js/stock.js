import {
  ecouterVehicules, creerVehicule, majVehicule, getVehicule, supprimerVehicule,
  enregistrerHistorique, chargerHistorique, chassis6, chassisExisteDeja, typeAutomatique, STATUT_LABEL, STATUT_BADGE, MODELES_PAR_MARQUE,
  importerVehiculesEnMasse,
} from "./data.js";

let _vehicules = [];

window.onMarqueChange = function () {
  const marque = document.getElementById("v-marque").value;
  const sel = document.getElementById("v-modele");
  const modeles = MODELES_PAR_MARQUE[marque] || [];
  sel.innerHTML = modeles.map((m) => `<option value="${m}">${m}</option>`).join("");
  const typeAuto = typeAutomatique(marque);
  if (typeAuto) document.getElementById("v-type").value = typeAuto;
};

// ---------------------------------------------------------------
// Mémoire des couleurs déjà saisies — autocomplétion (datalist)
// ---------------------------------------------------------------
const CLE_COULEURS = "sg_couleurs_connues";

function couleursConnues() {
  try { return JSON.parse(localStorage.getItem(CLE_COULEURS)) || []; } catch { return []; }
}

function memoriserCouleur(nom) {
  if (!nom) return;
  const c = couleursConnues();
  if (!c.includes(nom)) {
    c.push(nom);
    localStorage.setItem(CLE_COULEURS, JSON.stringify(c));
    rafraichirListeCouleurs();
  }
}

function rafraichirListeCouleurs() {
  const dl = document.getElementById("liste-couleurs");
  if (!dl) return;
  dl.innerHTML = couleursConnues().map((c) => `<option value="${c}"></option>`).join("");
}

const SITE_KEYS = {
  "Parc Broli": "site-broli",
  "Showroom Douala": "site-douala",
  "Showroom Yaoundé": "site-yaounde",
  "Showroom Bafoussam": "site-bafoussam",
};

function rendreTout() {
  rendreIndicateurs();
  rendreTableau();
}

function demarrerEcoute() {
  ecouterVehicules((liste) => {
    _vehicules = liste;
    rendreTout();
  });
}

function rendreIndicateurs() {
  Object.entries(SITE_KEYS).forEach(([site, id]) => {
    const n = _vehicules.filter((v) => v.emplacement === site).length;
    const el = document.getElementById(id);
    if (el) el.textContent = n;
  });
}

function dansPeriode(dateStr, periode) {
  if (!periode) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  const now = new Date();
  const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (periode === "jour") return d >= debutJour;
  if (periode === "semaine") {
    const jourSemaine = (now.getDay() + 6) % 7; // lundi = 0
    const debutSemaine = new Date(debutJour); debutSemaine.setDate(debutJour.getDate() - jourSemaine);
    return d >= debutSemaine;
  }
  if (periode === "mois") {
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    return d >= debutMois;
  }
  if (periode === "trimestre") {
    const debutTrimestre = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    return d >= debutTrimestre;
  }
  return true;
}

function vehiculesFiltres() {
  const recherche = document.getElementById("f-recherche").value.trim().toLowerCase();
  const marque = document.getElementById("f-marque").value;
  const modele = document.getElementById("f-modele").value;
  const emplacement = document.getElementById("f-emplacement").value;
  const date = document.getElementById("f-date").value;
  const periode = document.getElementById("f-periode").value;

  return _vehicules.filter((v) => {
    if (marque && v.marque !== marque) return false;
    if (modele && v.modele !== modele) return false;
    if (emplacement && v.emplacement !== emplacement) return false;
    if (date && v.dateEntree !== date) return false;
    if (!dansPeriode(v.dateEntree, periode)) return false;
    if (recherche) {
      const cible = `${v.chassis || ""} ${v.modele || ""} ${v.immatriculation || ""} ${chassis6(v.chassis)}`.toLowerCase();
      if (!cible.includes(recherche)) return false;
    }
    return true;
  });
}

function rafraichirFiltreModeles() {
  const marque = document.getElementById("f-marque").value;
  const modeles = marque ? (MODELES_PAR_MARQUE[marque] || []) : Object.values(MODELES_PAR_MARQUE).flat();
  const sel = document.getElementById("f-modele");
  const valActuelle = sel.value;
  sel.innerHTML = `<option value="">Tous</option>` + modeles.map((m) => `<option value="${m}">${m}</option>`).join("");
  if (modeles.includes(valActuelle)) sel.value = valActuelle;
}

function joursDepuis(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
}

function ligneTableau(v) {
  const badge = STATUT_BADGE[v.statut] || "badge-stock";
  const label = STATUT_LABEL[v.statut] || v.statut;
  const jours = joursDepuis(v.dateEntree);
  const critique = v.statut === "stock" && jours !== null && jours >= 60;
  return `
    <tr data-id="${v.id}">
      <td class="plate">${esc(chassis6(v.chassis))}</td>
      <td>${esc(v.marque) || "—"}</td>
      <td>${esc(v.modele) || "—"}</td>
      <td>${esc(v.type) || "—"}</td>
      <td>${esc(v.emplacement) || "—"}</td>
      <td style="font-size:12px;">Ext : ${esc(v.couleurExt) || "—"}<br>Int : ${esc(v.couleurInt) || "—"}</td>
      <td>${esc(v.annee) || "—"}</td>
      <td><span class="tag ${badge}">${esc(label)}</span>${critique ? `<br><span class="tag badge-endommage" style="margin-top:4px;display:inline-block;" title="En stock depuis ${jours} jours">⚠ ${jours}j</span>` : ""}</td>
      <td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td>
      <td>${esc(v.dateEntree) || "—"}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" data-action="modifier" data-id="${v.id}">✎</button>
        ${v.statut === "stock" ? `<button class="btn btn-ghost btn-sm" data-action="reserver" data-id="${v.id}">Réserver</button>` : ""}
        ${v.statut !== "vendu" ? `<button class="btn btn-ghost btn-sm" data-action="vendre" data-id="${v.id}">Vendre</button>` : ""}
        ${v.statut !== "endommage" ? `<button class="btn btn-ghost btn-sm" data-action="endommager" data-id="${v.id}">Endommager</button>` : ""}
        <button class="btn btn-ghost btn-sm" data-action="historique" data-id="${v.id}">🕒</button>
        <button class="btn btn-ghost btn-sm" data-action="sortir" data-id="${v.id}">Sortie</button>
      </td>
    </tr>`;
}

function rendreTableau() {
  const tbody = document.getElementById("stock-body");
  const liste = vehiculesFiltres();
  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-state"><strong>Aucun véhicule</strong>Ajuste les filtres ou ajoute un véhicule.</td></tr>`;
    return;
  }
  tbody.innerHTML = liste.map(ligneTableau).join("");
}

["f-recherche", "f-marque", "f-modele", "f-emplacement", "f-date", "f-periode"].forEach((id) => {
  document.getElementById(id).addEventListener("input", rendreTableau);
  document.getElementById(id).addEventListener("change", rendreTableau);
});
document.getElementById("f-marque").addEventListener("change", rafraichirFiltreModeles);

// ---------------------------------------------------------------
// Modal véhicule — ouverture / pré-remplissage / sauvegarde
// ---------------------------------------------------------------

window.onStatutChange = function () {
  const statut = document.getElementById("v-statut").value;
  document.getElementById("section-client").style.display = statut === "vendu" ? "block" : "none";
  document.getElementById("section-dommages").style.display = statut === "endommage" ? "block" : "none";
  document.getElementById("g-dateSortie").style.display = (statut === "vendu") ? "flex" : "none";
};

function viderFormulaire() {
  document.getElementById("form-vehicule").reset();
  document.getElementById("v-id").value = "";
  document.querySelectorAll("[data-equip]").forEach((cb) => (cb.checked = false));
  onMarqueChange();
  onStatutChange();
}

window.openNouveauVehicule = function () {
  viderFormulaire();
  document.getElementById("modal-vehicule-title").textContent = "NOUVEAU VÉHICULE";
  document.getElementById("v-dateEntree").value = new Date().toISOString().slice(0, 10);
  openModal("modal-vehicule");
};

async function ouvrirEdition(id, statutForce) {
  const v = await getVehicule(id);
  if (!v) return;
  viderFormulaire();
  document.getElementById("modal-vehicule-title").textContent = "MODIFIER LE VÉHICULE";
  document.getElementById("v-id").value = v.id;
  const set = (elId, val) => { const el = document.getElementById(elId); if (el && val !== undefined && val !== null) el.value = val; };
  set("v-chassis", v.chassis); set("v-immatriculation", v.immatriculation);
  set("v-marque", v.marque); onMarqueChange(); set("v-modele", v.modele); set("v-type", v.type);
  set("v-annee", v.annee); set("v-couleurExt", v.couleurExt); set("v-couleurInt", v.couleurInt);
  set("v-emplacement", v.emplacement); set("v-statut", statutForce || v.statut);
  set("v-prix", v.prix); set("v-kilometrage", v.kilometrage);
  set("v-dateEntree", v.dateEntree); set("v-dateSortie", v.dateSortie);
  if (v.client) {
    set("v-clientNom", v.client.nom); set("v-clientContact", v.client.contact);
    set("v-dateAchat", v.client.dateAchat); set("v-modePaiement", v.client.modePaiement); set("v-vendeur", v.client.vendeur);
  }
  if (v.piecesEndommagees) document.getElementById("v-pieces-endommagees").value = v.piecesEndommagees;
  if (v.equipements) {
    Object.entries(v.equipements).forEach(([nom, info]) => {
      const cb = document.querySelector(`[data-equip="${nom}"]`);
      const qty = document.querySelector(`[data-equip-qty="${nom}"]`);
      if (cb) cb.checked = !!info.present;
      if (qty && info.quantite !== undefined) qty.value = info.quantite;
    });
  }
  onStatutChange();
  openModal("modal-vehicule");
}

function lireEquipements() {
  const equipements = {};
  document.querySelectorAll("[data-equip]").forEach((cb) => {
    const nom = cb.dataset.equip;
    const qtyEl = document.querySelector(`[data-equip-qty="${nom}"]`);
    equipements[nom] = { present: cb.checked, quantite: qtyEl ? Number(qtyEl.value) || 0 : 0 };
  });
  return equipements;
}

window.enregistrerVehicule = async function () {
  const id = document.getElementById("v-id").value;
  const statut = document.getElementById("v-statut").value;

  const donnees = {
    chassis: document.getElementById("v-chassis").value.trim(),
    immatriculation: document.getElementById("v-immatriculation").value.trim(),
    marque: document.getElementById("v-marque").value,
    modele: document.getElementById("v-modele").value.trim(),
    type: document.getElementById("v-type").value,
    annee: Number(document.getElementById("v-annee").value) || null,
    couleurExt: document.getElementById("v-couleurExt").value,
    couleurInt: document.getElementById("v-couleurInt").value,
    emplacement: document.getElementById("v-emplacement").value,
    statut,
    prix: Number(document.getElementById("v-prix").value) || null,
    kilometrage: Number(document.getElementById("v-kilometrage").value) || null,
    dateEntree: document.getElementById("v-dateEntree").value || null,
    dateSortie: document.getElementById("v-dateSortie").value || null,
    equipements: lireEquipements(),
  };

  if (!donnees.chassis || !donnees.modele) { toast("Châssis et modèle sont requis", "terr"); return; }

  if (await chassisExisteDeja(donnees.chassis, id)) {
    toast("Ce châssis existe déjà dans le parc", "terr");
    return;
  }

  if (statut === "vendu") {
    donnees.client = {
      nom: document.getElementById("v-clientNom").value.trim(),
      contact: document.getElementById("v-clientContact").value.trim(),
      dateAchat: document.getElementById("v-dateAchat").value || null,
      modePaiement: document.getElementById("v-modePaiement").value.trim(),
      vendeur: document.getElementById("v-vendeur").value.trim(),
    };
  }
  if (statut === "endommage") {
    donnees.piecesEndommagees = document.getElementById("v-pieces-endommagees").value.trim();
  }

  memoriserCouleur(donnees.couleurExt);
  memoriserCouleur(donnees.couleurInt);

  if (id) await majVehicule(id, donnees);
  else await creerVehicule(donnees);

  toast("Véhicule enregistré");
  closeModal("modal-vehicule");
};

// ---------------------------------------------------------------
// Actions rapides depuis le tableau
// ---------------------------------------------------------------

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;

  if (action === "modifier") return ouvrirEdition(id);
  if (action === "vendre") return ouvrirEdition(id, "vendu");
  if (action === "reserver") {
    await majVehicule(id, { statut: "reserve" });
    toast("Véhicule réservé");
  }
  if (action === "endommager") {
    const pieces = prompt("Quelles pièces / parties sont endommagées ?");
    if (pieces === null) return;
    await majVehicule(id, { statut: "endommage", piecesEndommagees: pieces });
    toast("Véhicule marqué endommagé");
  }
  if (action === "sortir") {
    if (!confirm("Confirmer la sortie de ce véhicule du parc ? Il sera archivé (consultable dans Véhicules archivés) et retiré du Stock véhicule.")) return;
    const v = _vehicules.find((x) => x.id === id);
    await supprimerVehicule(v);
    toast("Véhicule sorti du parc");
  }
  if (action === "historique") {
    const v = _vehicules.find((x) => x.id === id);
    const tout = await chargerHistorique();
    const lignes = tout.filter((h) => h.chassis === v.chassis);
    const corps = document.getElementById("historique-vehicule-body");
    corps.innerHTML = lignes.length === 0
      ? `<tr><td colspan="4" class="empty-state">Aucun historique pour ce véhicule</td></tr>`
      : lignes.map((h) => {
          const d = h.horodatage?.toDate ? h.horodatage.toDate() : null;
          return `<tr><td>${d ? d.toLocaleString("fr-FR") : "—"}</td><td>${esc(h.action)}</td><td>${esc(STATUT_LABEL[h.statut] || h.statut) || "—"}</td><td><b>${esc(h.utilisateur) || "—"}</b></td></tr>`;
        }).join("");
    document.getElementById("historique-vehicule-titre").textContent = `Historique — ${v.marque || ""} ${v.modele || ""} (${chassis6(v.chassis)})`;
    openModal("modal-historique-vehicule");
  }
});

// ---------------------------------------------------------------
// Export CSV / PDF
// ---------------------------------------------------------------

window.exporterCSV = function () {
  const liste = vehiculesFiltres();
  if (liste.length === 0) { toast("Aucun véhicule à exporter", "tinfo"); return; }
  const headers = ["Châssis", "Marque", "Modèle", "Type", "Emplacement", "Année", "Statut", "Prix", "Date entrée"];
  const rows = liste.map((v) => [v.chassis, v.marque, v.modele, v.type, v.emplacement, v.annee, STATUT_LABEL[v.statut] || v.statut, v.prix, v.dateEntree]);
  exportCSV(`stock_parc_broli_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
};

window.exporterTouteLaBase = function () {
  if (_vehicules.length === 0) { toast("Aucun véhicule dans la base", "tinfo"); return; }
  const headers = ["Châssis", "Immatriculation", "Marque", "Modèle", "Type", "Emplacement", "Année", "Couleur ext.", "Couleur int.", "Statut", "Prix", "Kilométrage", "Date entrée", "Client", "Contact client", "Date achat"];
  const rows = _vehicules.map((v) => [v.chassis, v.immatriculation, v.marque, v.modele, v.type, v.emplacement, v.annee, v.couleurExt, v.couleurInt, STATUT_LABEL[v.statut] || v.statut, v.prix, v.kilometrage, v.dateEntree, v.client?.nom, v.client?.contact, v.client?.dateAchat]);
  exportCSV(`base_complete_parc_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
};

window.exporterPDF = function () {
  const liste = vehiculesFiltres();
  const rows = liste.map((v) => `<tr><td>${esc(chassis6(v.chassis))}</td><td>${esc(v.marque) || "—"}</td><td>${esc(v.modele) || "—"}</td><td>${esc(v.emplacement) || "—"}</td><td>${esc(v.annee) || "—"}</td><td>${esc(STATUT_LABEL[v.statut] || v.statut)}</td><td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td></tr>`).join("");
  document.getElementById("pdf-content").innerHTML = `
    <div class="kpi-row"><div class="kpi-box"><div class="kpi-val">${liste.length}</div><div class="kpi-lbl">Véhicules</div></div></div>
    <table><thead><tr><th>Châssis</th><th>Marque</th><th>Modèle</th><th>Emplacement</th><th>Année</th><th>Statut</th><th>Prix</th></tr></thead><tbody>${rows}</tbody></table>`;
  printPDF("pdf-content", "Inventaire Stock Véhicule");
};

// ---------------------------------------------------------------
// Import CSV / Excel / PDF — lecture, reconnaissance automatique des
// colonnes, aperçu avant validation, puis import groupé.
// ---------------------------------------------------------------

function parseCSV(text) {
  const lignes = text.split(/\r?\n/).filter((l) => l.trim());
  const sep = lignes[0].includes(";") ? ";" : ",";
  return lignes.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")));
}

let _pdfjsLoaded = false;
async function loadPDFJS() {
  if (_pdfjsLoaded) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  _pdfjsLoaded = true;
}

let _xlsxLoaded = false;
async function loadXLSX() {
  if (_xlsxLoaded) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  _xlsxLoaded = true;
}

async function extraireLignesPDF(file) {
  await loadPDFJS();
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  const lignes = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const contenu = await page.getTextContent();
    let ligneCourante = [];
    let dernierY = null;
    contenu.items.forEach((item) => {
      const y = Math.round(item.transform[5]);
      if (dernierY !== null && Math.abs(y - dernierY) > 4) {
        if (ligneCourante.length) lignes.push(ligneCourante.join(" ").split(/\s{2,}/).filter(Boolean));
        ligneCourante = [];
      }
      ligneCourante.push(item.str);
      dernierY = y;
    });
    if (ligneCourante.length) lignes.push(ligneCourante.join(" ").split(/\s{2,}/).filter(Boolean));
  }
  return lignes;
}

async function extraireLignesExcel(file) {
  await loadXLSX();
  const buf = await file.arrayBuffer();
  const classeur = window.XLSX.read(buf, { type: "array", cellDates: false });
  const feuille = classeur.Sheets[classeur.SheetNames[0]];
  return window.XLSX.utils.sheet_to_json(feuille, { header: 1, raw: false, defval: "" })
    .map((l) => l.map((c) => String(c ?? "").trim()))
    .filter((l) => l.some((c) => c));
}

// Reconnaissance automatique des colonnes par leur intitulé (accents, casse
// et ordre ignorés) — évite d'imposer un ordre de colonnes strict.
const ALIAS_COLONNES = {
  chassis: ["chassis", "châssis", "vin", "numero de chassis", "n chassis"],
  marque: ["marque"],
  modele: ["modele", "modèle"],
  couleurExt: ["couleur exterieure", "couleur exterieur", "couleur ext", "exterior color"],
  couleurInt: ["couleur interieure", "couleur interieur", "couleur int", "interior color"],
  dateEntree: ["date d entree", "date entree", "date entree en stock", "date d entree en stock"],
  type: ["type"],
  emplacement: ["emplacement", "emplacement prevu", "site"],
  annee: ["annee", "année"],
  prix: ["prix", "prix prevu", "prix fcfa"],
};

function normaliser(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function detecterColonnes(entete) {
  const mapping = {};
  entete.forEach((brut, idx) => {
    const n = normaliser(brut);
    for (const [champ, alias] of Object.entries(ALIAS_COLONNES)) {
      if (mapping[champ] !== undefined) continue;
      if (alias.some((a) => n === a || n.includes(a))) mapping[champ] = idx;
    }
  });
  return mapping;
}

function normaliserDate(v) {
  const s = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s;
}

function lignesVersDonnees(lignes) {
  if (lignes.length < 2) return { donnees: [], colonnesReconnues: false };
  const mapping = detecterColonnes(lignes[0]);
  const colonnesReconnues = mapping.chassis !== undefined && mapping.modele !== undefined && mapping.dateEntree !== undefined;

  const get = (l, champ, idxFallback) => {
    const idx = colonnesReconnues ? mapping[champ] : idxFallback;
    return idx === undefined ? "" : (l[idx] || "").trim();
  };

  const donnees = lignes.slice(1).filter((l) => l.length && l.some((c) => c)).map((l) => {
    const marque = get(l, "marque", 1);
    return {
      chassis: get(l, "chassis", 0),
      marque,
      modele: get(l, "modele", 2),
      couleurExt: get(l, "couleurExt", 3),
      couleurInt: get(l, "couleurInt", 4),
      dateEntree: normaliserDate(get(l, "dateEntree", 5)),
      type: get(l, "type", 6) || typeAutomatique(marque) || "",
      emplacement: get(l, "emplacement", 7),
      annee: Number(get(l, "annee", 8)) || null,
      prix: Number(get(l, "prix", 9)) || null,
      statut: "stock",
      equipements: {},
    };
  });
  return { donnees, colonnesReconnues };
}

// ---------------------------------------------------------------
// État de la modale d'import + interactions (glisser-déposer, coller)
// ---------------------------------------------------------------

let _importDonnees = [];

function resetModalImport() {
  _importDonnees = [];
  const fileInput = document.getElementById("import-file");
  if (fileInput) fileInput.value = "";
  const nomFichier = document.getElementById("import-filename");
  if (nomFichier) nomFichier.textContent = "";
  const status = document.getElementById("import-status");
  if (status) status.textContent = "";
  const previewWrap = document.getElementById("import-preview-wrap");
  if (previewWrap) previewWrap.style.display = "none";
  const progressWrap = document.getElementById("import-progress-wrap");
  if (progressWrap) progressWrap.style.display = "none";
  const bar = document.getElementById("import-progress-bar");
  if (bar) bar.style.width = "0%";
  const btn = document.getElementById("btn-importer");
  if (btn) { btn.disabled = true; btn.textContent = "Importer"; }
  const drop = document.getElementById("import-drop");
  if (drop) drop.classList.remove("dragover");
}

window.ouvrirModalImport = function () {
  resetModalImport();
  openModal("modal-import");
};

window.fermerModalImport = function () {
  closeModal("modal-import");
  resetModalImport();
};

async function traiterFichierImport(file) {
  const status = document.getElementById("import-status");
  const nomFichier = document.getElementById("import-filename");
  const btn = document.getElementById("btn-importer");
  if (!file) return;
  nomFichier.textContent = file.name;
  btn.disabled = true;
  const ext = file.name.split(".").pop().toLowerCase();

  let lignes = [];
  try {
    if (ext === "csv") {
      status.textContent = "Lecture du CSV…";
      lignes = parseCSV(await file.text());
    } else if (ext === "xlsx" || ext === "xls") {
      status.textContent = "Lecture du fichier Excel…";
      lignes = await extraireLignesExcel(file);
    } else if (ext === "pdf") {
      status.textContent = "Lecture du PDF (extraction basique — CSV/Excel recommandé pour un import fiable)…";
      lignes = await extraireLignesPDF(file);
    } else {
      toast("Format non supporté (CSV, Excel ou PDF uniquement)", "terr");
      status.textContent = "";
      return;
    }
  } catch (e) {
    toast("Erreur de lecture du fichier : " + e.message, "terr");
    status.textContent = "";
    return;
  }

  if (lignes.length < 2) { toast("Aucune donnée exploitable trouvée dans ce fichier", "terr"); status.textContent = ""; return; }

  const { donnees, colonnesReconnues } = lignesVersDonnees(lignes);
  const valides = donnees.filter((d) => d.chassis && d.modele && d.couleurExt && d.couleurInt && d.dateEntree);
  _importDonnees = donnees;

  afficherApercu(donnees, colonnesReconnues);
  status.textContent = `${donnees.length} ligne(s) détectée(s), dont ${valides.length} avec tous les champs obligatoires${colonnesReconnues ? " — colonnes reconnues automatiquement" : " — colonnes lues par position (entête non reconnue)"}.`;
  btn.disabled = donnees.length === 0;
}

function afficherApercu(donnees, colonnesReconnues) {
  const wrap = document.getElementById("import-preview-wrap");
  const head = document.getElementById("import-preview-head");
  const body = document.getElementById("import-preview-body");
  const count = document.getElementById("import-preview-count");
  if (!wrap) return;

  const colonnes = [
    ["chassis", "Châssis"], ["marque", "Marque"], ["modele", "Modèle"],
    ["couleurExt", "Coul. ext"], ["couleurInt", "Coul. int"], ["dateEntree", "Date d'entrée"],
    ["type", "Type"], ["emplacement", "Emplacement"], ["annee", "Année"], ["prix", "Prix"],
  ];
  head.innerHTML = `<tr>${colonnes.map(([, lbl]) => `<th>${lbl}</th>`).join("")}</tr>`;
  body.innerHTML = donnees.slice(0, 20).map((d) => {
    const manquant = !d.chassis || !d.modele || !d.couleurExt || !d.couleurInt || !d.dateEntree;
    return `<tr style="${manquant ? "color:var(--red);" : ""}">${colonnes.map(([champ]) => `<td>${esc(d[champ]) || "—"}</td>`).join("")}</tr>`;
  }).join("");
  count.textContent = donnees.length;
  wrap.style.display = "block";
  if (donnees.length > 20) {
    body.innerHTML += `<tr><td colspan="${colonnes.length}" style="text-align:center;color:var(--muted);">… et ${donnees.length - 20} ligne(s) de plus</td></tr>`;
  }
}

window.importerFichier = async function () {
  const status = document.getElementById("import-status");
  const btn = document.getElementById("btn-importer");
  const progressWrap = document.getElementById("import-progress-wrap");
  const bar = document.getElementById("import-progress-bar");

  if (!_importDonnees.length) { toast("Choisis d'abord un fichier", "terr"); return; }

  btn.disabled = true;
  btn.textContent = "Import en cours…";
  progressWrap.style.display = "block";
  bar.style.width = "0%";
  status.textContent = "Vérification des doublons…";

  try {
    const { n, ignorees, doublons } = await importerVehiculesEnMasse(_importDonnees, (fait, total) => {
      const pct = Math.round((fait / total) * 100);
      bar.style.width = pct + "%";
      status.textContent = `Import en cours… ${fait}/${total}`;
    });

    const details = [];
    if (ignorees) details.push(`${ignorees} ligne(s) ignorée(s) (champs obligatoires manquants)`);
    if (doublons) details.push(`${doublons} châssis déjà existant(s)`);
    toast(`${n} véhicule(s) importé(s)${details.length ? ", " + details.join(", ") : ""}`);
    window.fermerModalImport();
  } catch (e) {
    toast("Erreur pendant l'import : " + e.message, "terr");
    btn.disabled = false;
    btn.textContent = "Importer";
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  if (q) document.getElementById("f-recherche").value = q;
  demarrerEcoute();
  rafraichirListeCouleurs();
  onMarqueChange();
  rafraichirFiltreModeles();

  const fileInput = document.getElementById("import-file");
  if (fileInput) fileInput.addEventListener("change", () => traiterFichierImport(fileInput.files[0]));

  const drop = document.getElementById("import-drop");
  if (drop) {
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("dragover"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("dragover"); }));
    drop.addEventListener("drop", (e) => {
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) traiterFichierImport(f);
    });
  }

  document.addEventListener("paste", (e) => {
    const modal = document.getElementById("modal-import");
    if (!modal || !modal.classList.contains("open")) return;
    const f = Array.from(e.clipboardData?.files || [])[0];
    if (f) { e.preventDefault(); traiterFichierImport(f); }
  });
});
