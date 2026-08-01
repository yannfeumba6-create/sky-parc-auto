import {
  ecouterArrivages, creerArrivage, majArrivage, getArrivage, supprimerArrivage,
  entrerArrivageEnStock, arrivageChassisExisteDeja, chassisExisteDeja, chassis6, typeAutomatique, MODELES_PAR_MARQUE,
} from "./data.js";

let _arrivages = [];
const _selection = new Set();

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
  ecouterArrivages((liste) => {
    _arrivages = liste;
    rendreTout();
  });
}

function rendreIndicateurs() {
  Object.entries(SITE_KEYS).forEach(([site, id]) => {
    const n = _arrivages.filter((v) => v.emplacement === site).length;
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
    const jourSemaine = (now.getDay() + 6) % 7;
    const debutSemaine = new Date(debutJour); debutSemaine.setDate(debutJour.getDate() - jourSemaine);
    return d >= debutSemaine;
  }
  if (periode === "mois") return d >= new Date(now.getFullYear(), now.getMonth(), 1);
  if (periode === "trimestre") return d >= new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  return true;
}

function arrivagesFiltres() {
  const recherche = document.getElementById("f-recherche").value.trim().toLowerCase();
  const marque = document.getElementById("f-marque").value;
  const modele = document.getElementById("f-modele").value;
  const emplacement = document.getElementById("f-emplacement").value;
  const date = document.getElementById("f-date").value;
  const periode = document.getElementById("f-periode").value;

  return _arrivages.filter((v) => {
    if (marque && v.marque !== marque) return false;
    if (modele && v.modele !== modele) return false;
    if (emplacement && v.emplacement !== emplacement) return false;
    if (date && v.dateArriveePrevue !== date) return false;
    if (!dansPeriode(v.dateArriveePrevue, periode)) return false;
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
  const coche = _selection.has(v.id) ? "checked" : "";
  return `
    <tr data-id="${v.id}">
      <td><input type="checkbox" class="select-ligne" data-id="${v.id}" ${coche}></td>
      <td class="plate">${chassis6(v.chassis)}</td>
      <td>${v.marque || "—"}</td>
      <td>${v.modele || "—"}</td>
      <td>${v.type || "—"}</td>
      <td>${v.emplacement || "—"}</td>
      <td style="font-size:12px;">Ext : ${v.couleurExt || "—"}<br>Int : ${v.couleurInt || "—"}</td>
      <td>${v.annee || "—"}</td>
      <td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td>
      <td>${v.dateArriveePrevue || "—"}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" data-action="modifier" data-id="${v.id}">✎</button>
        <button class="btn btn-red btn-sm" data-action="entrer" data-id="${v.id}">Entrer en stock</button>
        <button class="btn btn-ghost btn-sm" data-action="supprimer" data-id="${v.id}">Supprimer</button>
      </td>
    </tr>`;
}

function rendreTableau() {
  const tbody = document.getElementById("arrivage-body");
  const liste = arrivagesFiltres();
  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-state"><strong>Aucun arrivage prévu</strong>Ajuste les filtres ou ajoute un arrivage.</td></tr>`;
  } else {
    tbody.innerHTML = liste.map(ligneTableau).join("");
  }
  rendreBarreSelection();
}

["f-recherche", "f-marque", "f-modele", "f-emplacement", "f-date", "f-periode"].forEach((id) => {
  document.getElementById(id).addEventListener("input", rendreTableau);
  document.getElementById(id).addEventListener("change", rendreTableau);
});
document.getElementById("f-marque").addEventListener("change", rafraichirFiltreModeles);

// ---------------------------------------------------------------
// Sélection multiple — entrer plusieurs véhicules en stock d'un coup
// ---------------------------------------------------------------

function rendreBarreSelection() {
  const barre = document.getElementById("barre-selection");
  const n = _selection.size;
  document.getElementById("nb-selection").textContent = n;
  barre.style.display = n > 0 ? "block" : "none";
  const selectAll = document.getElementById("select-all");
  const visibles = arrivagesFiltres().map((v) => v.id);
  selectAll.checked = visibles.length > 0 && visibles.every((id) => _selection.has(id));
}

document.addEventListener("change", (e) => {
  if (e.target.id === "select-all") {
    const visibles = arrivagesFiltres().map((v) => v.id);
    if (e.target.checked) visibles.forEach((id) => _selection.add(id));
    else visibles.forEach((id) => _selection.delete(id));
    rendreTableau();
    return;
  }
  if (e.target.classList.contains("select-ligne")) {
    const id = e.target.dataset.id;
    if (e.target.checked) _selection.add(id);
    else _selection.delete(id);
    rendreBarreSelection();
  }
});

window.viderSelection = function () {
  _selection.clear();
  rendreTableau();
};

window.entrerSelectionEnStock = async function () {
  const date = document.getElementById("date-entree-groupee").value;
  if (!date) { toast("Choisis une date d'entrée", "terr"); return; }
  const ids = [..._selection];
  if (ids.length === 0) return;
  for (const id of ids) {
    const v = _arrivages.find((x) => x.id === id);
    if (v) await entrerArrivageEnStock(v, date);
  }
  toast(`${ids.length} véhicule(s) entré(s) en stock`);
  _selection.clear();
};

// ---------------------------------------------------------------
// Modal arrivage — ouverture / pré-remplissage / sauvegarde
// ---------------------------------------------------------------

function viderFormulaire() {
  document.getElementById("form-arrivage").reset();
  document.getElementById("v-id").value = "";
  document.querySelectorAll("[data-equip]").forEach((cb) => (cb.checked = false));
  onMarqueChange();
}

window.openNouvelArrivage = function () {
  viderFormulaire();
  document.getElementById("modal-arrivage-title").textContent = "NOUVEL ARRIVAGE";
  openModal("modal-arrivage");
};

async function ouvrirEdition(id) {
  const v = await getArrivage(id);
  if (!v) return;
  viderFormulaire();
  document.getElementById("modal-arrivage-title").textContent = "MODIFIER L'ARRIVAGE";
  document.getElementById("v-id").value = v.id;
  const set = (elId, val) => { const el = document.getElementById(elId); if (el && val !== undefined && val !== null) el.value = val; };
  set("v-chassis", v.chassis); set("v-immatriculation", v.immatriculation);
  set("v-marque", v.marque); onMarqueChange(); set("v-modele", v.modele); set("v-type", v.type);
  set("v-annee", v.annee); set("v-couleurExt", v.couleurExt); set("v-couleurInt", v.couleurInt);
  set("v-emplacement", v.emplacement);
  set("v-prix", v.prix); set("v-kilometrage", v.kilometrage);
  set("v-dateArriveePrevue", v.dateArriveePrevue);
  if (v.equipements) {
    Object.entries(v.equipements).forEach(([nom, info]) => {
      const cb = document.querySelector(`[data-equip="${nom}"]`);
      const qty = document.querySelector(`[data-equip-qty="${nom}"]`);
      if (cb) cb.checked = !!info.present;
      if (qty && info.quantite !== undefined) qty.value = info.quantite;
    });
  }
  openModal("modal-arrivage");
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

window.enregistrerArrivage = async function () {
  const id = document.getElementById("v-id").value;

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
    prix: Number(document.getElementById("v-prix").value) || null,
    kilometrage: Number(document.getElementById("v-kilometrage").value) || null,
    dateArriveePrevue: document.getElementById("v-dateArriveePrevue").value || null,
    equipements: lireEquipements(),
  };

  if (!donnees.chassis || !donnees.modele || !donnees.couleurExt || !donnees.couleurInt || !donnees.dateArriveePrevue) {
    toast("Châssis, modèle, couleurs et date d'arrivée prévue sont requis", "terr");
    return;
  }
  if (await arrivageChassisExisteDeja(donnees.chassis, id)) {
    toast("Ce châssis existe déjà dans les arrivages", "terr");
    return;
  }
  if (await chassisExisteDeja(donnees.chassis)) {
    toast("Ce châssis est déjà présent dans le Stock véhicule", "terr");
    return;
  }

  memoriserCouleur(donnees.couleurExt);
  memoriserCouleur(donnees.couleurInt);

  if (id) await majArrivage(id, donnees);
  else await creerArrivage(donnees);

  toast("Arrivage enregistré");
  closeModal("modal-arrivage");
};

// ---------------------------------------------------------------
// Actions rapides depuis le tableau
// ---------------------------------------------------------------

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;

  if (action === "modifier") return ouvrirEdition(id);

  if (action === "entrer") {
    const v = _arrivages.find((x) => x.id === id);
    if (!v) return;
    const date = prompt("Date d'entrée réelle dans le stock (AAAA-MM-JJ) :", new Date().toISOString().slice(0, 10));
    if (date === null) return;
    await entrerArrivageEnStock(v, date.trim() || new Date().toISOString().slice(0, 10));
    toast("Véhicule entré dans le Stock véhicule");
  }

  if (action === "supprimer") {
    if (!confirm("Supprimer cet arrivage de la pré-liste ?")) return;
    await supprimerArrivage(id);
    toast("Arrivage supprimé");
  }
});

// ---------------------------------------------------------------
// Export CSV / PDF
// ---------------------------------------------------------------

window.exporterCSV = function () {
  const liste = arrivagesFiltres();
  if (liste.length === 0) { toast("Aucun arrivage à exporter", "tinfo"); return; }
  const headers = ["Châssis", "Marque", "Modèle", "Type", "Emplacement prévu", "Année", "Prix prévu", "Date arrivée prévue"];
  const rows = liste.map((v) => [v.chassis, v.marque, v.modele, v.type, v.emplacement, v.annee, v.prix, v.dateArriveePrevue]);
  exportCSV(`prochain_arrivage_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
};

window.exporterPDF = function () {
  const liste = arrivagesFiltres();
  const rows = liste.map((v) => `<tr><td>${chassis6(v.chassis)}</td><td>${v.marque || "—"}</td><td>${v.modele || "—"}</td><td>${v.emplacement || "—"}</td><td>${v.annee || "—"}</td><td>${v.dateArriveePrevue || "—"}</td><td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td></tr>`).join("");
  document.getElementById("pdf-content").innerHTML = `
    <div class="kpi-row"><div class="kpi-box"><div class="kpi-val">${liste.length}</div><div class="kpi-lbl">Arrivages prévus</div></div></div>
    <table><thead><tr><th>Châssis</th><th>Marque</th><th>Modèle</th><th>Emplacement</th><th>Année</th><th>Arrivée prévue</th><th>Prix</th></tr></thead><tbody>${rows}</tbody></table>`;
  printPDF("pdf-content", "Prochain Arrivage");
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

  const lignesDonnees = lignes.slice(1).filter((l) => l.length && l[0]);
  status.textContent = `Import de ${lignesDonnees.length} ligne(s)…`;

  let n = 0, ignorees = 0;
  for (const l of lignesDonnees) {
    const [chassis, marque, modele, couleurExt, couleurInt, dateArriveePrevue, type, emplacement, annee, prix] = l;

    if (!chassis || !modele || !couleurExt || !couleurInt || !dateArriveePrevue) { ignorees++; continue; }
    if (await arrivageChassisExisteDeja(chassis.trim())) { ignorees++; continue; }
    if (await chassisExisteDeja(chassis.trim())) { ignorees++; continue; }

    const marqueTrim = (marque || "").trim();
    await creerArrivage({
      chassis: chassis.trim(),
      marque: marqueTrim,
      modele: modele.trim(),
      couleurExt: couleurExt.trim(),
      couleurInt: couleurInt.trim(),
      dateArriveePrevue: dateArriveePrevue.trim(),
      type: (type || "").trim() || typeAutomatique(marqueTrim) || "",
      emplacement: (emplacement || "").trim(),
      annee: Number(annee) || null,
      prix: Number(prix) || null,
      equipements: {},
    });
    n++;
  }

  toast(`${n} arrivage(s) importé(s)${ignorees ? `, ${ignorees} ligne(s) ignorée(s) (champs obligatoires manquants ou châssis en double)` : ""}`);
  closeModal("modal-import");
  fileInput.value = "";
  status.textContent = "";
};

document.addEventListener("DOMContentLoaded", () => {
  demarrerEcoute();
  rafraichirListeCouleurs();
  onMarqueChange();
  rafraichirFiltreModeles();
  document.getElementById("date-entree-groupee").value = new Date().toISOString().slice(0, 10);
});
