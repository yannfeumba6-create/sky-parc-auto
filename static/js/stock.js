import {
  ecouterVehicules, creerVehicule, majVehicule, getVehicule, supprimerVehicule,
  enregistrerHistorique, chassis6, STATUT_LABEL, STATUT_BADGE, MODELES_PAR_MARQUE,
} from "./data.js";

let _vehicules = [];

window.onMarqueChange = function () {
  const marque = document.getElementById("v-marque").value;
  const sel = document.getElementById("v-modele");
  const modeles = MODELES_PAR_MARQUE[marque] || [];
  sel.innerHTML = modeles.map((m) => `<option value="${m}">${m}</option>`).join("");
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

function ligneTableau(v) {
  const badge = STATUT_BADGE[v.statut] || "badge-stock";
  const label = STATUT_LABEL[v.statut] || v.statut;
  return `
    <tr data-id="${v.id}">
      <td class="plate">${chassis6(v.chassis)}</td>
      <td>${v.marque || "—"}</td>
      <td>${v.modele || "—"}</td>
      <td>${v.type || "—"}</td>
      <td>${v.emplacement || "—"}</td>
      <td style="font-size:12px;">Ext : ${v.couleurExt || "—"}<br>Int : ${v.couleurInt || "—"}</td>
      <td>${v.annee || "—"}</td>
      <td><span class="tag ${badge}">${label}</span></td>
      <td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td>
      <td>${v.dateEntree || "—"}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" data-action="modifier" data-id="${v.id}">✎</button>
        ${v.statut === "stock" ? `<button class="btn btn-ghost btn-sm" data-action="reserver" data-id="${v.id}">Réserver</button>` : ""}
        ${v.statut !== "vendu" ? `<button class="btn btn-ghost btn-sm" data-action="vendre" data-id="${v.id}">Vendre</button>` : ""}
        ${v.statut !== "endommage" ? `<button class="btn btn-ghost btn-sm" data-action="endommager" data-id="${v.id}">Endommager</button>` : ""}
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
    if (!confirm("Confirmer la sortie de ce véhicule du parc ?")) return;
    const v = _vehicules.find((x) => x.id === id);
    await supprimerVehicule(v);
    toast("Véhicule sorti du parc");
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

window.exporterPDF = function () {
  const liste = vehiculesFiltres();
  const rows = liste.map((v) => `<tr><td>${chassis6(v.chassis)}</td><td>${v.marque || "—"}</td><td>${v.modele || "—"}</td><td>${v.emplacement || "—"}</td><td>${v.annee || "—"}</td><td>${STATUT_LABEL[v.statut] || v.statut}</td><td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td></tr>`).join("");
  document.getElementById("pdf-content").innerHTML = `
    <div class="kpi-row"><div class="kpi-box"><div class="kpi-val">${liste.length}</div><div class="kpi-lbl">Véhicules</div></div></div>
    <table><thead><tr><th>Châssis</th><th>Marque</th><th>Modèle</th><th>Emplacement</th><th>Année</th><th>Statut</th><th>Prix</th></tr></thead><tbody>${rows}</tbody></table>`;
  printPDF("pdf-content", "Inventaire Stock Véhicule");
};

// ---------------------------------------------------------------
// Import CSV / PDF
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

window.importerFichier = async function () {
  const fileInput = document.getElementById("import-file");
  const status = document.getElementById("import-status");
  const file = fileInput.files[0];
  if (!file) { toast("Choisis un fichier", "terr"); return; }
  const ext = file.name.split(".").pop().toLowerCase();

  let lignes = [];
  try {
    if (ext === "csv") {
      status.textContent = "Lecture du CSV…";
      lignes = parseCSV(await file.text());
    } else if (ext === "pdf") {
      status.textContent = "Lecture du PDF (extraction basique — CSV recommandé pour un import fiable)…";
      lignes = await extraireLignesPDF(file);
    } else {
      toast("Format non supporté", "terr");
      return;
    }
  } catch (e) {
    toast("Erreur de lecture du fichier : " + e.message, "terr");
    return;
  }

  if (lignes.length < 2) { toast("Aucune donnée exploitable trouvée", "terr"); return; }

  // On suppose la première ligne = en-têtes : Châssis, Marque, Modèle, Type, Emplacement, Année, Prix, Date d'entrée
  const donnees = lignes.slice(1).filter((l) => l.length && l[0]);
  status.textContent = `Import de ${donnees.length} véhicule(s)…`;

  let n = 0;
  for (const l of donnees) {
    const [chassis, marque, modele, type, emplacement, annee, prix, dateEntree] = l;
    if (!chassis) continue;
    await creerVehicule({
      chassis: chassis.trim(),
      marque: (marque || "").trim(),
      modele: (modele || "").trim(),
      type: (type || "").trim(),
      emplacement: (emplacement || "").trim(),
      annee: Number(annee) || null,
      prix: Number(prix) || null,
      dateEntree: (dateEntree || "").trim() || new Date().toISOString().slice(0, 10),
      statut: "stock",
      equipements: {},
    });
    n++;
  }

  toast(`${n} véhicule(s) importé(s)`);
  closeModal("modal-import");
  fileInput.value = "";
  status.textContent = "";
};

document.addEventListener("DOMContentLoaded", () => {
  demarrerEcoute();
  rafraichirListeCouleurs();
  onMarqueChange();
  rafraichirFiltreModeles();
});
