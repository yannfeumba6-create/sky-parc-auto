import {
  ecouterArrivages, creerArrivage, majArrivage, getArrivage, supprimerArrivage,
  entrerArrivageEnStock, arrivageChassisExisteDeja, chassis6, typeAutomatique, estTypeCamion, couleursValides, MODELES_PAR_MARQUE,
  importerArrivagesEnMasse, normaliserMarque, normaliserModele, modelesArrivageDisponibles, estModeleGenerique, FAMILLES_MODELES,
  marqueCorrespond, modeleCorrespond, normaliserDateTexte, ecouterVehicules, ecouterShowroom,
} from "./data.js";

let _arrivages = [];
let _vehiculesParc = [];
let _showroomListe = [];
const _selection = new Set();

window.onMarqueChange = function () {
  const marque = document.getElementById("v-marque").value;
  const sel = document.getElementById("v-modele");
  const modeles = modelesArrivageDisponibles(marque);
  sel.innerHTML = modeles.map((m) => `<option value="${m}">${m}</option>`).join("");
  const typeAuto = typeAutomatique(marque);
  if (typeAuto) document.getElementById("v-type").value = typeAuto;
  onTypeChange();
};

// Camion / camionnette n'ont qu'une seule "couleur de cabine" ; les autres
// types gardent couleur extérieure + intérieure séparées (voir stock.js).
window.onTypeChange = function () {
  const type = document.getElementById("v-type").value;
  const camion = estTypeCamion(type);
  document.getElementById("v-couleurExt-wrap").style.display = camion ? "none" : "";
  document.getElementById("v-couleurInt-wrap").style.display = camion ? "none" : "";
  document.getElementById("v-couleurCabine-wrap").style.display = camion ? "" : "none";
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

function rendreTout() {
  rendreIndicateurs();
  rendreTableau();
}

function demarrerEcoute() {
  ecouterArrivages((liste) => {
    _arrivages = liste;
    rendreTout();
  });
  // Le Parc et les 3 Showrooms sont sourcés depuis les vraies collections
  // en temps réel (pas depuis le champ "emplacement prévu" de l'arrivage,
  // qui n'a plus vraiment de sens : un véhicule qui arrive va toujours
  // d'abord au Parc Broli — voir entrerArrivageEnStock).
  ecouterVehicules((liste) => { _vehiculesParc = liste; rendreIndicateurs(); });
  ecouterShowroom((liste) => { _showroomListe = liste; rendreIndicateurs(); });
}

// Aperçu de la répartition ACTUELLE du parc (indépendant des arrivages —
// tient compte des filtres marque/modèle de cette page).
function rendreIndicateurs() {
  const marque = document.getElementById("f-marque").value;
  const modele = document.getElementById("f-modele").value;
  const correspond = (v) =>
    (!marque || marqueCorrespond(v.marque, marque)) &&
    (!modele || modeleCorrespond(v.marque, v.modele, modele));

  const baseArrivages = _arrivages.filter(correspond);
  document.getElementById("qte-attendue").textContent = baseArrivages.length;

  const auParc = _vehiculesParc.filter((v) => (v.statut === "stock" || v.statut === "reserve") && correspond(v));
  const enShowroom = _showroomListe.filter(correspond);

  document.getElementById("site-broli").textContent = auParc.length;
  document.getElementById("site-douala").textContent = enShowroom.filter((v) => v.destination === "Showroom Douala").length;
  document.getElementById("site-yaounde").textContent = enShowroom.filter((v) => v.destination === "Showroom Yaoundé").length;
  document.getElementById("site-bafoussam").textContent = enShowroom.filter((v) => v.destination === "Showroom Bafoussam").length;
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
    if (marque && !marqueCorrespond(v.marque, marque)) return false;
    if (modele && !modeleCorrespond(v.marque, v.modele, modele)) return false;
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
  const modeles = marque ? modelesArrivageDisponibles(marque) : Object.keys(MODELES_PAR_MARQUE).flatMap(modelesArrivageDisponibles);
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
      <td class="plate">${esc(chassis6(v.chassis))}</td>
      <td>${esc(v.marque) || "—"}</td>
      <td>${esc(v.modele) || "—"}</td>
      <td>${esc(v.type) || "—"}</td>
      <td>${esc(v.emplacement) || "—"}</td>
      <td style="font-size:12px;">${v.type && estTypeCamion(v.type) ? `Cabine : ${esc(v.couleurCabine) || "—"}` : `Ext : ${esc(v.couleurExt) || "—"}<br>Int : ${esc(v.couleurInt) || "—"}`}</td>
      <td>${esc(v.annee) || "—"}</td>
      <td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td>
      <td>${esc(v.dateArriveePrevue) || "—"}</td>
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
["f-marque", "f-modele"].forEach((id) => {
  document.getElementById(id).addEventListener("input", rendreIndicateurs);
  document.getElementById(id).addEventListener("change", rendreIndicateurs);
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

window.supprimerSelectionArrivages = async function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  if (!confirm(`Supprimer définitivement ${ids.length} arrivage(s) sélectionné(s) ? Cette action est irréversible.`)) return;
  for (const id of ids) {
    await supprimerArrivage(id);
  }
  toast(`${ids.length} arrivage(s) supprimé(s)`);
  _selection.clear();
  rendreTableau();
};

// ---------------------------------------------------------------
// Modification en masse — n'applique que les champs renseignés
// ---------------------------------------------------------------

window.ouvrirModifMasseArrivages = function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  document.getElementById("mma-titre").textContent = `MODIFIER LA SÉLECTION — ${ids.length} arrivage(s)`;
  document.getElementById("mma-marque").value = "";
  document.getElementById("mma-emplacement").value = "";
  document.getElementById("mma-date").value = "";
  openModal("modal-modif-masse-arrivages");
};

window.confirmerModifMasseArrivages = async function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  const marque = document.getElementById("mma-marque").value;
  const emplacement = document.getElementById("mma-emplacement").value;
  const date = document.getElementById("mma-date").value;

  const donnees = {};
  if (marque) donnees.marque = marque;
  if (emplacement) donnees.emplacement = emplacement;
  if (date) donnees.dateArriveePrevue = date;

  if (Object.keys(donnees).length === 0) { toast("Renseigne au moins un champ à modifier", "terr"); return; }
  if (!confirm(`Appliquer ces modifications à ${ids.length} arrivage(s) sélectionné(s) ?`)) return;

  for (const id of ids) {
    await majArrivage(id, { ...donnees });
  }
  toast(`${ids.length} arrivage(s) modifié(s)`);
  closeModal("modal-modif-masse-arrivages");
  _selection.clear();
  rendreTableau();
};

// ---------------------------------------------------------------
// Entrée en stock — demande la date réelle, et si le modèle de l'arrivage
// est générique (ex. "X50", sans boîte précisée), impose de choisir la
// variante exacte (Manuelle/Auto) vérifiée à la réception physique du
// véhicule, avant de créer la fiche de Stock.
// ---------------------------------------------------------------

let _resoudreEntreeStock = null;

function ouvrirModalEntreeStock(v) {
  return new Promise((resolve) => {
    document.getElementById("es-vehicule-info").textContent = `${v.marque || ""} ${v.modele || ""} — Châssis ${chassis6(v.chassis)}`;
    document.getElementById("es-date").value = new Date().toISOString().slice(0, 10);

    const generique = estModeleGenerique(v.marque, v.modele);
    const wrap = document.getElementById("es-modele-wrap");
    const sel = document.getElementById("es-modele-final");
    if (generique) {
      const variantes = (FAMILLES_MODELES[v.marque] || {})[v.modele] || [];
      sel.innerHTML = `<option value="">— Choisir —</option>` + variantes.map((m) => `<option value="${m}">${m}</option>`).join("");
      wrap.style.display = "block";
    } else {
      wrap.style.display = "none";
    }

    _resoudreEntreeStock = resolve;
    openModal("modal-entree-stock");
  });
}

window.validerEntreeStock = function () {
  const date = document.getElementById("es-date").value;
  if (!date) { toast("Choisis une date d'entrée", "terr"); return; }

  const wrap = document.getElementById("es-modele-wrap");
  let modeleFinal = null;
  if (wrap.style.display !== "none") {
    modeleFinal = document.getElementById("es-modele-final").value;
    if (!modeleFinal) { toast("Choisis le modèle exact (Manuelle ou Auto) vérifié à la réception", "terr"); return; }
  }

  closeModal("modal-entree-stock");
  const resolve = _resoudreEntreeStock;
  _resoudreEntreeStock = null;
  if (resolve) resolve({ date, modeleFinal });
};

window.annulerEntreeStock = function () {
  closeModal("modal-entree-stock");
  const resolve = _resoudreEntreeStock;
  _resoudreEntreeStock = null;
  if (resolve) resolve(null);
};

window.entrerSelectionEnStock = async function () {
  const date = document.getElementById("date-entree-groupee").value;
  if (!date) { toast("Choisis une date d'entrée", "terr"); return; }
  const ids = [..._selection];
  if (ids.length === 0) return;

  let nOk = 0, nAnnules = 0, nDoublons = 0;
  for (const id of ids) {
    const v = _arrivages.find((x) => x.id === id);
    if (!v) continue;
    try {
      if (estModeleGenerique(v.marque, v.modele)) {
        // Boîte à préciser au cas par cas — on ne peut pas deviner pour tout
        // le lot en une fois, une petite fenêtre s'ouvre pour ce véhicule.
        const resultat = await ouvrirModalEntreeStock(v);
        if (!resultat) { nAnnules++; continue; }
        await entrerArrivageEnStock({ ...v, modele: resultat.modeleFinal }, resultat.date);
      } else {
        await entrerArrivageEnStock(v, date);
      }
      nOk++;
    } catch (e) {
      nDoublons++;
    }
  }
  let msg = `${nOk} véhicule(s) entré(s) en stock`;
  if (nAnnules) msg += `, ${nAnnules} laissé(s) en attente (variante non précisée)`;
  if (nDoublons) msg += `, ${nDoublons} refusé(s) (châssis en double ailleurs dans l'appli)`;
  toast(msg, nDoublons ? "terr" : "tok");
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
  set("v-couleurCabine", v.couleurCabine);
  set("v-emplacement", v.emplacement);
  set("v-prix", v.prix); set("v-kilometrage", v.kilometrage);
  set("v-dateArriveePrevue", v.dateArriveePrevue);
  onTypeChange();
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
  const type = document.getElementById("v-type").value;
  const camion = estTypeCamion(type);

  const donnees = {
    chassis: document.getElementById("v-chassis").value.trim(),
    immatriculation: document.getElementById("v-immatriculation").value.trim(),
    marque: document.getElementById("v-marque").value,
    modele: document.getElementById("v-modele").value.trim(),
    type,
    annee: Number(document.getElementById("v-annee").value) || null,
    couleurExt: camion ? "" : document.getElementById("v-couleurExt").value,
    couleurInt: camion ? "" : document.getElementById("v-couleurInt").value,
    couleurCabine: camion ? document.getElementById("v-couleurCabine").value : "",
    emplacement: document.getElementById("v-emplacement").value,
    prix: Number(document.getElementById("v-prix").value) || null,
    kilometrage: Number(document.getElementById("v-kilometrage").value) || null,
    dateArriveePrevue: document.getElementById("v-dateArriveePrevue").value || null,
    equipements: lireEquipements(),
  };

  if (!donnees.chassis || !donnees.marque || !donnees.modele || !donnees.dateArriveePrevue) {
    toast("Châssis, marque, modèle et date d'arrivée prévue sont requis", "terr");
    return;
  }
  if (!couleursValides(donnees)) {
    toast(camion ? "La couleur de cabine est requise" : "Les couleurs extérieure et intérieure sont requises", "terr");
    return;
  }
  if (await arrivageChassisExisteDeja(donnees.chassis, id)) {
    toast("Ce châssis existe déjà quelque part dans l'application (Stock parc, Prochain arrivage, Stock Showroom ou Véhicules vendus)", "terr");
    return;
  }

  memoriserCouleur(donnees.couleurExt);
  memoriserCouleur(donnees.couleurInt);
  memoriserCouleur(donnees.couleurCabine);

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
    const resultat = await ouvrirModalEntreeStock(v);
    if (!resultat) return;
    const arrivageAEnvoyer = resultat.modeleFinal ? { ...v, modele: resultat.modeleFinal } : v;
    try {
      await entrerArrivageEnStock(arrivageAEnvoyer, resultat.date);
      toast("Véhicule entré dans le Stock véhicule");
    } catch (e) {
      toast(e.message, "terr");
    }
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
  const rows = liste.map((v) => `<tr><td>${esc(chassis6(v.chassis))}</td><td>${esc(v.marque) || "—"}</td><td>${esc(v.modele) || "—"}</td><td>${esc(v.emplacement) || "—"}</td><td>${esc(v.annee) || "—"}</td><td>${esc(v.dateArriveePrevue) || "—"}</td><td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td></tr>`).join("");
  document.getElementById("pdf-content").innerHTML = `
    <div class="kpi-row"><div class="kpi-box"><div class="kpi-val">${liste.length}</div><div class="kpi-lbl">Arrivages prévus</div></div></div>
    <table><thead><tr><th>Châssis</th><th>Marque</th><th>Modèle</th><th>Emplacement</th><th>Année</th><th>Arrivée prévue</th><th>Prix</th></tr></thead><tbody>${rows}</tbody></table>`;
  printPDF("pdf-content", "Prochain Arrivage");
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

// Reconnaissance automatique des colonnes par leur intitulé (accents,
// casse et ordre ignorés) — évite d'imposer un ordre de colonnes strict.
// ---------------------------------------------------------------
// Reconnaissance des colonnes — deux passes :
//  1) Par intitulé d'en-tête (si le fichier a une ligne d'en-tête lisible)
//  2) Par CONTENU : on regarde ce qu'il y a réellement dans chaque colonne
//     (un châssis ressemble à un VIN, une marque correspond à la liste des
//     marques connues, un modèle à la liste des modèles de cette marque,
//     une date à un format de date, etc.) — utile pour les PDF où le texte
//     extrait n'a pas d'en-tête exploitable, ou dont l'ordre des colonnes
//     ne correspond pas à ce qu'on attendait.
// Dans tous les cas, la correspondance devinée reste modifiable à la main
// via les listes déroulantes affichées au-dessus de l'aperçu, et chaque
// valeur de l'aperçu est éditable individuellement avant l'import.
// ---------------------------------------------------------------

const CHAMP_DATE = "dateArriveePrevue";
const CHAMPS_IMPORT = [
  { cle: "", label: "— Ignorer —" },
  { cle: "chassis", label: "Châssis" },
  { cle: "marque", label: "Marque" },
  { cle: "modele", label: "Modèle" },
  { cle: "type", label: "Type" },
  { cle: "couleurExt", label: "Couleur ext." },
  { cle: "couleurInt", label: "Couleur int." },
  { cle: "couleurCabine", label: "Couleur cabine" },
  { cle: "couleurUnique", label: "Couleur (ext./cabine selon le type)" },
  { cle: "emplacement", label: "Emplacement" },
  { cle: CHAMP_DATE, label: "Arrivée prévue" },
  { cle: "annee", label: "Année" },
  { cle: "prix", label: "Prix" },
];

const ALIAS_COLONNES = {
  chassis: ["chassis", "châssis", "vin", "numero de chassis", "n chassis"],
  marque: ["marque"],
  modele: ["modele", "modèle"],
  couleurExt: ["couleur exterieure", "couleur exterieur", "couleur ext", "exterior color"],
  couleurInt: ["couleur interieure", "couleur interieur", "couleur int", "interior color"],
  couleurCabine: ["couleur cabine", "couleur de cabine", "couleur de la cabine", "couleur cab", "cabin color"],
  [CHAMP_DATE]: ["date d arrivee prevue", "date arrivee prevue", "date d arrivee", "date arrivee", "date prevue"],
  type: ["type"],
  emplacement: ["emplacement", "emplacement prevu", "site"],
  annee: ["annee", "année"],
  prix: ["prix", "prix prevu", "prix fcfa"],
};

// Mots-clés de couleurs courantes (carrosserie automobile), utilisés pour
// reconnaître une colonne "couleur" par son CONTENU quand l'en-tête seul
// ne suffit pas — voir stock.js pour le détail des commentaires (logique
// identique).
const MOTS_COULEUR = [
  "blanc", "blanche", "noir", "noire", "gris", "grise", "argent", "argente", "argentee",
  "rouge", "bleu", "bleue", "vert", "verte", "jaune", "orange", "marron", "beige",
  "dore", "doree", "bordeaux", "violet", "violette", "rose", "cuivre", "chrome",
  "ivoire", "creme", "bronze", "metallise", "metallisee", "perle", "nacre", "kaki", "turquoise",
];

function normaliser(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const estCouleur = (v) => {
  const n = normaliser(v);
  return MOTS_COULEUR.some((m) => n.includes(m));
};

function detecterColonnesParEntete(entete) {
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

// Convertit une date texte libre (import) en YYYY-MM-DD, avec vraie
// validation de calendrier — voir normaliserDateTexte dans data.js.
function normaliserDate(v) {
  return normaliserDateTexte(v);
}

function optionsDe(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return [];
  return Array.from(sel.options).map((o) => o.value).filter(Boolean);
}

// Devine la correspondance colonne → champ en se basant sur le CONTENU des
// cellules (indépendant de tout intitulé d'en-tête). Retourne un tableau
// mappingParColonne[indexColonne] = "chassis" | "marque" | … | "" .
function detecterColonnesParContenu(lignes) {
  const nbCol = Math.max(...lignes.map((l) => l.length));
  const echantillon = lignes.slice(0, 30);
  const marques = optionsDe("v-marque");
  const types = optionsDe("v-type");
  const emplacements = optionsDe("v-emplacement");
  const modelesTous = Object.values(MODELES_PAR_MARQUE).flat().map((m) => m.toLowerCase());

  const estVIN = (v) => /^[a-z0-9]{9,18}$/i.test(v) && /[0-9]/.test(v) && /[a-z]/i.test(v);
  const estDate = (v) => /^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(v);
  const estAnnee = (v) => /^(19|20)\d{2}$/.test(v);
  const estNombre = (v) => /^\d+([.,]\d+)?$/.test(v.replace(/\s/g, ""));

  const scores = [];
  for (let c = 0; c < nbCol; c++) {
    const valeurs = echantillon.map((l) => (l[c] || "").trim()).filter(Boolean);
    if (valeurs.length === 0) continue;
    const frac = (fn) => valeurs.filter((v) => fn(v)).length / valeurs.length;
    const fracListe = (liste) => valeurs.filter((v) => liste.some((ref) => ref.toLowerCase() === v.toLowerCase())).length / valeurs.length;

    scores.push({ col: c, champ: "chassis", score: frac(estVIN) });
    scores.push({ col: c, champ: "marque", score: fracListe(marques) });
    scores.push({ col: c, champ: "modele", score: valeurs.filter((v) => modelesTous.includes(v.toLowerCase())).length / valeurs.length });
    scores.push({ col: c, champ: "type", score: fracListe(types) });
    scores.push({ col: c, champ: "emplacement", score: fracListe(emplacements) });
    scores.push({ col: c, champ: CHAMP_DATE, score: frac(estDate) });
    scores.push({ col: c, champ: "annee", score: frac(estAnnee) });
    scores.push({ col: c, champ: "prix", score: frac((v) => estNombre(v) && !estAnnee(v) && Number(v.replace(/\s/g, "")) >= 1000) });
  }

  // Assignation gloutonne : on prend les meilleurs scores en premier, une
  // colonne et un champ ne peuvent être utilisés qu'une seule fois.
  scores.sort((a, b) => b.score - a.score);
  const mappingParColonne = new Array(nbCol).fill("");
  const champsPris = new Set();
  for (const s of scores) {
    if (s.score < 0.6) break;
    if (mappingParColonne[s.col] || champsPris.has(s.champ)) continue;
    mappingParColonne[s.col] = s.champ;
    champsPris.add(s.champ);
  }

  // Colonnes couleur restantes, reconnues par leur CONTENU (mots-clés
  // couleur), pas simplement "colonne de texte non attribuée" — évite
  // d'absorber par erreur une colonne sans rapport (immatriculation…).
  const colonnesCouleur = [];
  for (let c = 0; c < nbCol; c++) {
    if (mappingParColonne[c]) continue;
    const valeurs = echantillon.map((l) => (l[c] || "").trim()).filter(Boolean);
    if (valeurs.length === 0) continue;
    const scoreCouleur = valeurs.filter(estCouleur).length / valeurs.length;
    if (scoreCouleur >= 0.5) colonnesCouleur.push(c);
  }
  if (colonnesCouleur.length >= 2) {
    mappingParColonne[colonnesCouleur[0]] = "couleurExt";
    mappingParColonne[colonnesCouleur[1]] = "couleurInt";
  } else if (colonnesCouleur.length === 1) {
    // Une seule colonne couleur : son sens dépend du TYPE de chaque ligne
    // (cabine pour camion/camionnette, sinon extérieure) — résolu ligne
    // par ligne dans construireDonnees().
    mappingParColonne[colonnesCouleur[0]] = "couleurUnique";
  }

  return mappingParColonne;
}

// Construit les objets "donnees" utilisables pour l'import à partir des
// lignes brutes du fichier et d'une correspondance colonne → champ.
function construireDonnees(lignesDonnees, mappingParColonne) {
  return lignesDonnees.filter((l) => l.length && l.some((c) => c)).map((l) => {
    const val = (champ) => {
      const idx = mappingParColonne.indexOf(champ);
      return idx === -1 ? "" : (l[idx] || "").trim();
    };
    const marque = normaliserMarque(val("marque"));
    const type = val("type") || typeAutomatique(marque) || "";
    const camion = estTypeCamion(type);
    const couleurUnique = val("couleurUnique");
    return {
      chassis: val("chassis"),
      marque,
      modele: normaliserModele(marque, val("modele"), false),
      couleurExt: camion ? "" : (val("couleurExt") || (couleurUnique ? couleurUnique : "")),
      couleurInt: camion ? "" : val("couleurInt"),
      couleurCabine: camion ? (val("couleurCabine") || couleurUnique) : "",
      [CHAMP_DATE]: normaliserDate(val(CHAMP_DATE)),
      type,
      emplacement: val("emplacement"),
      annee: Number(val("annee")) || null,
      prix: Number(val("prix")) || null,
      equipements: {},
    };
  });
}

// ---------------------------------------------------------------
// État de la modale d'import + interactions (glisser-déposer, coller)
// ---------------------------------------------------------------

let _lignesBrutes = [];      // toutes les lignes du fichier telles que lues
let _ligneEnteteExiste = false; // la 1re ligne est-elle une en-tête à exclure des données ?
let _mappingParColonne = []; // mappingParColonne[indexColonne] = champ ("" = ignorer)
let _importDonnees = [];     // dérivé de _lignesBrutes + _mappingParColonne, avec les corrections manuelles

function resetModalImport() {
  _lignesBrutes = [];
  _ligneEnteteExiste = false;
  _mappingParColonne = [];
  _importDonnees = [];
  const fileInput = document.getElementById("import-file");
  if (fileInput) fileInput.value = "";
  const nomFichier = document.getElementById("import-filename");
  if (nomFichier) nomFichier.textContent = "";
  const status = document.getElementById("import-status");
  if (status) status.textContent = "";
  const mappingWrap = document.getElementById("import-mapping-wrap");
  if (mappingWrap) { mappingWrap.style.display = "none"; mappingWrap.innerHTML = ""; }
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

  if (lignes.length < 1) { toast("Aucune donnée exploitable trouvée dans ce fichier", "terr"); status.textContent = ""; return; }

  _lignesBrutes = lignes;
  const mappingEntete = detecterColonnesParEntete(lignes[0] || []);
  // On considère qu'il y a une vraie ligne d'en-tête si au moins 2 champs
  // ont été reconnus par leur intitulé (sinon, l'en-tête n'est probablement
  // pas exploitable — cas fréquent avec un PDF — et on la traite comme une
  // ligne de données, en devinant tout par le contenu).
  _ligneEnteteExiste = Object.keys(mappingEntete).length >= 2;

  if (_ligneEnteteExiste) {
    const nbCol = Math.max(...lignes.map((l) => l.length));
    _mappingParColonne = new Array(nbCol).fill("");
    Object.entries(mappingEntete).forEach(([champ, idx]) => { _mappingParColonne[idx] = champ; });
  } else {
    _mappingParColonne = detecterColonnesParContenu(lignes);
  }

  recalculerEtAfficher();
  btn.disabled = _importDonnees.length === 0;
}

function lignesDonneesActuelles() {
  return _ligneEnteteExiste ? _lignesBrutes.slice(1) : _lignesBrutes;
}

function recalculerEtAfficher() {
  _importDonnees = construireDonnees(lignesDonneesActuelles(), _mappingParColonne);
  afficherMapping();
  afficherChampsManquants();
  afficherApercu();
  const valides = _importDonnees.filter(estLigneValide);
  const status = document.getElementById("import-status");
  status.textContent = `${_importDonnees.length} ligne(s) détectée(s), dont ${valides.length} avec tous les champs obligatoires. Vérifie la correspondance des colonnes ci-dessous et corrige au besoin.`;
  const btn = document.getElementById("btn-importer");
  if (btn) btn.disabled = _importDonnees.length === 0;
}

// Champs à choix contrôlé (une liste connue de valeurs valides) pour
// lesquels on peut proposer un remplissage groupé plutôt que de faire
// taper chaque ligne une par une.
const CHAMPS_CONTROLES = [
  { cle: "marque", label: "Marque", options: () => optionsDe("v-marque") },
  { cle: "type", label: "Type", options: () => optionsDe("v-type") },
  { cle: "emplacement", label: "Emplacement", options: () => optionsDe("v-emplacement") },
];

function afficherChampsManquants() {
  const wrap = document.getElementById("import-manquants-wrap");
  if (!wrap) return;

  const blocs = CHAMPS_CONTROLES.map((c) => {
    const nManquants = _importDonnees.filter((d) => d.chassis && !d[c.cle]).length;
    return nManquants > 0 ? { ...c, nManquants, options: c.options() } : null;
  }).filter(Boolean);

  if (blocs.length === 0) { wrap.style.display = "none"; wrap.innerHTML = ""; return; }

  wrap.innerHTML = `
    <div class="section-lbl">Informations manquantes détectées</div>
    <div class="info-box" style="margin-bottom:8px;">Certaines colonnes sont absentes du fichier ou vides sur plusieurs lignes. Choisis une valeur pour les remplir toutes d'un coup — tu pourras encore corriger ligne par ligne dans l'aperçu ci-dessous.</div>
    <div class="import-manquants-grid">
      ${blocs.map((b) => `
        <div class="import-manquant-item">
          <label>${b.label} <span style="color:var(--muted);">(${b.nManquants} ligne${b.nManquants > 1 ? "s" : ""} sans valeur)</span></label>
          <div style="display:flex;gap:8px;">
            <select id="manquant-${b.cle}" style="flex:1;">
              <option value="">— Choisir —</option>
              ${b.options.map((o) => `<option value="${o}">${o}</option>`).join("")}
            </select>
            <button type="button" class="btn btn-ghost btn-sm" data-appliquer-manquant="${b.cle}">Appliquer à toutes</button>
          </div>
        </div>`).join("")}
    </div>`;
  wrap.style.display = "block";

  wrap.querySelectorAll("[data-appliquer-manquant]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const champ = btn.dataset.appliquerManquant;
      const val = document.getElementById(`manquant-${champ}`).value;
      if (!val) { toast("Choisis d'abord une valeur", "terr"); return; }
      _importDonnees.forEach((d) => { if (d.chassis && !d[champ]) d[champ] = val; });
      afficherApercu();
      afficherChampsManquants();
      const valides = _importDonnees.filter(estLigneValide);
      document.getElementById("import-status").textContent = `${_importDonnees.length} ligne(s), dont ${valides.length} avec tous les champs obligatoires.`;
      const btnImporter = document.getElementById("btn-importer");
      if (btnImporter) btnImporter.disabled = _importDonnees.length === 0;
    });
  });
}

function estLigneValide(d) {
  return !!(d.chassis && d.marque && d.modele && couleursValides(d));
}

// Affiche, au-dessus de l'aperçu, une liste déroulante par colonne du
// fichier source pour que l'utilisateur puisse corriger lui-même la
// correspondance si la détection automatique (en-tête ou contenu) s'est
// trompée — cas typique d'un PDF avec une colonne "N°" inattendue qui
// décale tout le reste.
function afficherMapping() {
  const wrap = document.getElementById("import-mapping-wrap");
  if (!wrap) return;
  const ligneRef = _lignesBrutes[_ligneEnteteExiste ? 0 : 0] || [];
  const ligneExemple = lignesDonneesActuelles()[0] || [];

  wrap.innerHTML = `
    <div class="section-lbl">Correspondance des colonnes du fichier</div>
    <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin:4px 0 10px;">
      <input type="checkbox" id="import-entete-toggle" ${_ligneEnteteExiste ? "checked" : ""}>
      La première ligne du fichier est un en-tête (à exclure des données)
    </label>
    <div class="import-mapping-grid">
      ${_mappingParColonne.map((champ, idx) => `
        <div class="import-mapping-col">
          <div class="import-mapping-exemple" title="Exemple de contenu de cette colonne">${esc((ligneExemple[idx] || "—").toString().slice(0, 22))}</div>
          <select data-col="${idx}" class="import-mapping-select">
            ${CHAMPS_IMPORT.map((c) => `<option value="${c.cle}" ${c.cle === champ ? "selected" : ""}>${c.label}</option>`).join("")}
          </select>
        </div>`).join("")}
    </div>`;
  wrap.style.display = "block";

  document.getElementById("import-entete-toggle").addEventListener("change", (e) => {
    _ligneEnteteExiste = e.target.checked;
    recalculerEtAfficher();
  });
  wrap.querySelectorAll(".import-mapping-select").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const idx = Number(e.target.dataset.col);
      const champ = e.target.value;
      // Un champ ne peut être utilisé que sur une seule colonne à la fois.
      if (champ) _mappingParColonne = _mappingParColonne.map((c, i) => (i !== idx && c === champ ? "" : c));
      _mappingParColonne[idx] = champ;
      recalculerEtAfficher();
    });
  });
}

const COLONNES_APERCU = [
  ["chassis", "Châssis"], ["marque", "Marque"], ["modele", "Modèle"],
  ["couleurExt", "Coul. ext"], ["couleurInt", "Coul. int"], ["couleurCabine", "Coul. cabine"], [CHAMP_DATE, "Arrivée prévue"],
  ["type", "Type"], ["emplacement", "Emplacement"], ["annee", "Année"], ["prix", "Prix"],
];

// Aperçu ÉDITABLE : chaque cellule est un champ de saisie relié directement
// à _importDonnees, pour corriger une valeur mal extraite (OCR/PDF, colonne
// mal reconnue…) sans devoir d'abord importer puis rouvrir chaque fiche.
function afficherApercu() {
  const wrap = document.getElementById("import-preview-wrap");
  const head = document.getElementById("import-preview-head");
  const body = document.getElementById("import-preview-body");
  const count = document.getElementById("import-preview-count");
  if (!wrap) return;

  const optionsParChamp = {
    marque: optionsDe("v-marque"),
    type: optionsDe("v-type"),
    emplacement: optionsDe("v-emplacement"),
  };

  const LIMITE = 40;
  head.innerHTML = `<tr>${COLONNES_APERCU.map(([, lbl]) => `<th>${lbl}</th>`).join("")}</tr>`;
  body.innerHTML = _importDonnees.slice(0, LIMITE).map((d, i) => {
    const manquant = !estLigneValide(d);
    return `<tr data-ligne="${i}" class="${manquant ? "ligne-incomplete" : ""}">${COLONNES_APERCU.map(([champ]) => {
      if (optionsParChamp[champ]) {
        const valeur = d[champ] ?? "";
        return `<td><select class="import-cell" data-ligne="${i}" data-champ="${champ}">
          <option value="">—</option>
          ${optionsParChamp[champ].map((o) => `<option value="${o}" ${o === valeur ? "selected" : ""}>${o}</option>`).join("")}
        </select></td>`;
      }
      return `<td><input type="text" class="import-cell" data-ligne="${i}" data-champ="${champ}" value="${esc(d[champ] ?? "")}"></td>`;
    }).join("")}</tr>`;
  }).join("");
  count.textContent = _importDonnees.length;
  wrap.style.display = "block";
  if (_importDonnees.length > LIMITE) {
    body.innerHTML += `<tr><td colspan="${COLONNES_APERCU.length}" style="text-align:center;color:var(--muted);">… et ${_importDonnees.length - LIMITE} ligne(s) de plus (import intégral quand même)</td></tr>`;
  }

  body.querySelectorAll(".import-cell").forEach((input) => {
    input.addEventListener("change", (e) => {
      const i = Number(e.target.dataset.ligne);
      const champ = e.target.dataset.champ;
      let v = e.target.value.trim();
      if (champ === "annee" || champ === "prix") v = Number(v) || null;
      if (champ === CHAMP_DATE) v = normaliserDate(v);
      _importDonnees[i][champ] = v;

      const ligne = e.target.closest("tr");
      ligne.classList.toggle("ligne-incomplete", !estLigneValide(_importDonnees[i]));
      const valides = _importDonnees.filter(estLigneValide);
      document.getElementById("import-status").textContent =
        `${_importDonnees.length} ligne(s), dont ${valides.length} avec tous les champs obligatoires.`;
      afficherChampsManquants();
    });
  });
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
    const { n, ignorees, doublons } = await importerArrivagesEnMasse(_importDonnees, (fait, total) => {
      const pct = Math.round((fait / total) * 100);
      bar.style.width = pct + "%";
      status.textContent = `Import en cours… ${fait}/${total}`;
    });

    const details = [];
    if (ignorees) details.push(`${ignorees} ligne(s) ignorée(s) (champs obligatoires manquants)`);
    if (doublons) details.push(`${doublons} châssis déjà existant(s)`);
    toast(`${n} arrivage(s) importé(s)${details.length ? ", " + details.join(", ") : ""}`);
    window.fermerModalImport();
  } catch (e) {
    toast("Erreur pendant l'import : " + e.message, "terr");
    btn.disabled = false;
    btn.textContent = "Importer";
  }
};

document.addEventListener("DOMContentLoaded", () => {
  demarrerEcoute();
  rafraichirListeCouleurs();
  onMarqueChange();
  rafraichirFiltreModeles();
  document.getElementById("date-entree-groupee").value = new Date().toISOString().slice(0, 10);

  // Sélection classique via le champ fichier
  const fileInput = document.getElementById("import-file");
  if (fileInput) fileInput.addEventListener("change", () => traiterFichierImport(fileInput.files[0]));

  // Glisser-déposer
  const drop = document.getElementById("import-drop");
  if (drop) {
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("dragover"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("dragover"); }));
    drop.addEventListener("drop", (e) => {
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) traiterFichierImport(f);
    });
  }

  // Coller directement un fichier (Ctrl+V) pendant que la modale est ouverte
  document.addEventListener("paste", (e) => {
    const modal = document.getElementById("modal-import");
    if (!modal || !modal.classList.contains("open")) return;
    const f = Array.from(e.clipboardData?.files || [])[0];
    if (f) { e.preventDefault(); traiterFichierImport(f); }
  });
});
