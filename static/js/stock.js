import {
  ecouterVehicules, creerVehicule, majVehicule, getVehicule, envoyerVersShowroom, supprimerVehiculeDefinitivement,
  enregistrerHistorique, chargerHistorique, chassis6, chassisExisteDeja, typeAutomatique, STATUT_LABEL, STATUT_BADGE, MODELES_PAR_MARQUE,
  importerVehiculesEnMasse, normaliserMarque, normaliserModele, estModeleGenerique, marqueCorrespond, modeleCorrespond, normaliserDateTexte,
  televerserFichier,
} from "./data.js";

let _vehicules = [];
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

// N'affiche que la quantité de véhicules PRÉSENTS DANS LE PARC — donc en
// tenant compte des filtres actifs (marque, modèle, emplacement…) et en
// excluant les véhicules endommagés / en prise en charge / réparés (ils
// sont sortis de ce volet, direction Endommagés, jusqu'à confirmation de
// la réparation et remise en stock manuelle).
function rendreIndicateurs() {
  const el = document.getElementById("qte-parc-filtree");
  if (el) el.textContent = vehiculesFiltres().length;
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
    if (["endommage", "prise_en_charge", "repare"].includes(v.statut)) return false;
    if (marque && !marqueCorrespond(v.marque, marque)) return false;
    if (modele && !modeleCorrespond(v.marque, v.modele, modele)) return false;
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
  const coche = _selection.has(v.id) ? "checked" : "";
  return `
    <tr data-id="${v.id}">
      <td><input type="checkbox" class="select-ligne" data-id="${v.id}" ${coche}></td>
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
        ${v.statut === "reserve" ? `<button class="btn btn-ghost btn-sm" data-action="lever-reserve" data-id="${v.id}">Lever réservation</button>` : ""}
        ${v.statut !== "endommage" ? `<button class="btn btn-ghost btn-sm" data-action="endommager" data-id="${v.id}">Endommager</button>` : ""}
        <button class="btn btn-ghost btn-sm" data-action="historique" data-id="${v.id}">🕒</button>
        <button class="btn btn-ghost btn-sm" data-action="sortir" data-id="${v.id}">Sortie vers showroom</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red);" data-action="supprimer" data-id="${v.id}">🗑</button>
      </td>
    </tr>`;
}

function rendreTableau() {
  const tbody = document.getElementById("stock-body");
  const liste = vehiculesFiltres();
  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="empty-state"><strong>Aucun véhicule</strong>Ajuste les filtres ou ajoute un véhicule.</td></tr>`;
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
// Sélection multiple — actions groupées sur plusieurs véhicules
// ---------------------------------------------------------------

function rendreBarreSelection() {
  const barre = document.getElementById("barre-selection");
  const n = _selection.size;
  document.getElementById("nb-selection").textContent = n;
  barre.style.display = n > 0 ? "block" : "none";
  const selectAll = document.getElementById("select-all");
  const visibles = vehiculesFiltres().map((v) => v.id);
  selectAll.checked = visibles.length > 0 && visibles.every((id) => _selection.has(id));
}

document.addEventListener("change", (e) => {
  if (e.target.id === "select-all") {
    const visibles = vehiculesFiltres().map((v) => v.id);
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

window.exporterSelectionCSV = function () {
  const liste = _vehicules.filter((v) => _selection.has(v.id));
  if (liste.length === 0) { toast("Aucun véhicule sélectionné", "tinfo"); return; }
  const headers = ["Châssis", "Marque", "Modèle", "Type", "Emplacement", "Année", "Statut", "Prix", "Date entrée"];
  const rows = liste.map((v) => [v.chassis, v.marque, v.modele, v.type, v.emplacement, v.annee, STATUT_LABEL[v.statut] || v.statut, v.prix, v.dateEntree]);
  exportCSV(`selection_stock_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
};

window.sortirSelectionDuParc = function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  ouvrirModalSortieBulk(ids);
};

window.supprimerSelectionVehicules = async function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  if (!confirm(`Supprimer définitivement ${ids.length} véhicule(s) sélectionné(s) ? Cette action est irréversible et ne passe pas par le Showroom.`)) return;
  let n = 0;
  for (const id of ids) {
    const v = _vehicules.find((x) => x.id === id);
    if (v) { await supprimerVehiculeDefinitivement(v); n++; }
  }
  toast(`${n} véhicule(s) supprimé(s)`);
  _selection.clear();
};

// ---------------------------------------------------------------
// Modification en masse — n'applique que les champs renseignés
// ---------------------------------------------------------------

window.ouvrirModifMasse = function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  document.getElementById("modif-masse-titre").textContent = `MODIFIER LA SÉLECTION — ${ids.length} véhicule(s)`;
  document.getElementById("mm-statut").value = "";
  document.getElementById("mm-emplacement").value = "";
  document.getElementById("mm-prix").value = "";
  openModal("modal-modif-masse");
};

window.confirmerModifMasse = async function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  const statut = document.getElementById("mm-statut").value;
  const emplacement = document.getElementById("mm-emplacement").value;
  const prix = document.getElementById("mm-prix").value;

  const donnees = {};
  if (statut) donnees.statut = statut;
  if (emplacement) donnees.emplacement = emplacement;
  if (prix !== "") donnees.prix = Number(prix);

  if (Object.keys(donnees).length === 0) { toast("Renseigne au moins un champ à modifier", "terr"); return; }
  if (!confirm(`Appliquer ces modifications à ${ids.length} véhicule(s) sélectionné(s) ?`)) return;

  for (const id of ids) {
    await majVehicule(id, { ...donnees });
  }
  toast(`${ids.length} véhicule(s) modifié(s)`);
  closeModal("modal-modif-masse");
  _selection.clear();
};

// ---------------------------------------------------------------
// Modal véhicule — ouverture / pré-remplissage / sauvegarde
// ---------------------------------------------------------------

window.onStatutChange = function () {
  // Le statut "endommage" ne se règle plus ici : voir Signaler un dommage.
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
  set("v-dateEntree", v.dateEntree);
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
    equipements: lireEquipements(),
  };

  if (!donnees.chassis || !donnees.modele) { toast("Châssis et modèle sont requis", "terr"); return; }

  if (await chassisExisteDeja(donnees.chassis, id)) {
    toast("Ce châssis existe déjà dans le parc", "terr");
    return;
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
  if (action === "reserver") {
    await majVehicule(id, { statut: "reserve" });
    toast("Véhicule réservé (client a déjà acheté mais le véhicule reste au parc)");
  }
  if (action === "lever-reserve") {
    await majVehicule(id, { statut: "stock" });
    toast("Réservation levée");
  }
  if (action === "endommager") {
    ouvrirModalDommage(id);
  }
  if (action === "sortir") {
    ouvrirModalSortie(id);
  }
  if (action === "supprimer") {
    const v = _vehicules.find((x) => x.id === id);
    if (!v) return;
    if (!confirm(`Supprimer définitivement "${v.marque || ""} ${v.modele || ""}" (${chassis6(v.chassis)}) ? Cette action est irréversible et ne passe pas par le Showroom.`)) return;
    await supprimerVehiculeDefinitivement(v);
    toast("Véhicule supprimé");
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
// Sortie de véhicule vers un showroom — date de sortie, destination et
// matériel présent obligatoires. Le véhicule n'est jamais supprimé, il
// est transféré vers le Stock Showroom (envoyerVersShowroom), où il
// reste vendable.
// ---------------------------------------------------------------

let _sortieCible = null; // { type: "single", id } ou { type: "bulk", ids: [...] }

function remplirEquipGridSortie(vehicule) {
  const grid = document.getElementById("s-equip-grid");
  const equipActuels = vehicule.equipements || {};
  const noms = Array.from(document.querySelectorAll("#equip-grid [data-equip]")).map((cb) => cb.dataset.equip);
  grid.innerHTML = noms.map((nom) => {
    const info = equipActuels[nom] || {};
    const present = !!info.present;
    const qty = info.quantite !== undefined ? info.quantite : 1;
    return `
      <label class="equip-item" style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" data-s-equip="${esc(nom)}" ${present ? "checked" : ""}> ${esc(nom)}
        <input type="number" min="0" value="${esc(qty)}" data-s-equip-qty="${esc(nom)}" style="width:50px;margin-left:auto;">
      </label>`;
  }).join("");
}

function lireEquipementsSortie() {
  const equipements = {};
  document.querySelectorAll("#s-equip-grid [data-s-equip]").forEach((cb) => {
    const nom = cb.dataset.sEquip;
    const qtyEl = document.querySelector(`#s-equip-grid [data-s-equip-qty="${nom}"]`);
    equipements[nom] = { present: cb.checked, quantite: qtyEl ? Number(qtyEl.value) || 0 : 0 };
  });
  return equipements;
}

function ouvrirModalSortie(id) {
  const v = _vehicules.find((x) => x.id === id);
  if (!v) return;
  _sortieCible = { type: "single", id };
  document.getElementById("sortie-modal-title").textContent = `SORTIE VERS SHOWROOM — ${v.marque || ""} ${v.modele || ""} (${chassis6(v.chassis)})`;
  document.getElementById("s-dateSortie").value = new Date().toISOString().slice(0, 10);
  document.getElementById("s-destination").value = "";
  document.getElementById("s-chauffeur").value = "";
  document.getElementById("s-equip-wrap").style.display = "block";
  remplirEquipGridSortie(v);
  openModal("modal-sortie");
}

function ouvrirModalSortieBulk(ids) {
  _sortieCible = { type: "bulk", ids };
  document.getElementById("sortie-modal-title").textContent = `SORTIE VERS SHOWROOM — ${ids.length} véhicule(s) sélectionné(s)`;
  document.getElementById("s-dateSortie").value = new Date().toISOString().slice(0, 10);
  document.getElementById("s-destination").value = "";
  document.getElementById("s-chauffeur").value = "";
  document.getElementById("s-equip-wrap").style.display = "none";
  openModal("modal-sortie");
}

window.confirmerSortie = async function () {
  const dateSortie = document.getElementById("s-dateSortie").value;
  const destination = document.getElementById("s-destination").value;
  const chauffeur = document.getElementById("s-chauffeur").value.trim();
  if (!dateSortie) { toast("La date de sortie est obligatoire", "terr"); return; }
  if (!destination) { toast("La destination est obligatoire", "terr"); return; }
  if (!chauffeur) { toast("Le nom du chauffeur est obligatoire", "terr"); return; }
  if (!_sortieCible) return;

  if (_sortieCible.type === "single") {
    const v = _vehicules.find((x) => x.id === _sortieCible.id);
    if (!v) return;
    const equipements = lireEquipementsSortie();
    await envoyerVersShowroom(v, { dateSortie, destination, chauffeur, equipements });
    toast("Véhicule envoyé vers le Showroom");
  } else {
    let n = 0;
    for (const id of _sortieCible.ids) {
      const v = _vehicules.find((x) => x.id === id);
      if (v) { await envoyerVersShowroom(v, { dateSortie, destination, chauffeur }); n++; }
    }
    toast(`${n} véhicule(s) envoyé(s) vers le Showroom`);
    _selection.clear();
  }

  closeModal("modal-sortie");
  _sortieCible = null;
};

// ---------------------------------------------------------------
// Signaler un dommage — constat obligatoire, date obligatoire, photo et
// vidéo (30 s max) facultatives. Une fois signalé, le véhicule quitte
// immédiatement ce volet (Stock véhicule parc) pour le sous-volet
// Endommagés, où il apparaît en ROUGE.
// ---------------------------------------------------------------

let _dommageCible = null;

// Vérifie la durée d'une vidéo côté navigateur avant tout envoi.
function dureeVideo(fichier) {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
    v.onerror = () => { URL.revokeObjectURL(v.src); reject(new Error("Vidéo illisible")); };
    v.src = URL.createObjectURL(fichier);
  });
}

function ouvrirModalDommage(id) {
  const v = _vehicules.find((x) => x.id === id);
  if (!v) return;
  _dommageCible = id;
  document.getElementById("dommage-modal-titre").textContent = `SIGNALER UN DOMMAGE — ${v.marque || ""} ${v.modele || ""} (${chassis6(v.chassis)})`;
  document.getElementById("d-constat").value = "";
  document.getElementById("d-dateConstat").value = new Date().toISOString().slice(0, 10);
  document.getElementById("d-photo").value = "";
  document.getElementById("d-video").value = "";
  document.getElementById("d-upload-statut").textContent = "";
  openModal("modal-dommage");
}

window.confirmerDommage = async function () {
  const v = _vehicules.find((x) => x.id === _dommageCible);
  if (!v) return;
  const constat = document.getElementById("d-constat").value.trim();
  const dateConstat = document.getElementById("d-dateConstat").value;
  if (!constat) { toast("Le constat est obligatoire", "terr"); return; }
  if (!dateConstat) { toast("La date du constat est obligatoire", "terr"); return; }

  const photo = document.getElementById("d-photo").files[0];
  const video = document.getElementById("d-video").files[0];
  const statutEl = document.getElementById("d-upload-statut");
  const btn = document.getElementById("d-btn-confirmer");

  if (video) {
    try {
      const duree = await dureeVideo(video);
      if (duree > 30.5) { toast("La vidéo dépasse 30 secondes — raccourcis-la avant de l'envoyer", "terr"); return; }
    } catch {
      toast("Impossible de lire cette vidéo", "terr");
      return;
    }
  }

  btn.disabled = true;
  const donnees = {
    statut: "endommage",
    piecesEndommagees: constat,
    dateConstat,
  };

  try {
    if (photo) {
      statutEl.textContent = "Envoi de la photo…";
      donnees.photoDommageURL = await televerserFichier(`dommages/${v.id}/${Date.now()}_${photo.name}`, photo);
    }
    if (video) {
      statutEl.textContent = "Envoi de la vidéo…";
      donnees.videoDommageURL = await televerserFichier(`dommages/${v.id}/${Date.now()}_${video.name}`, video);
    }
  } catch (e) {
    btn.disabled = false;
    statutEl.textContent = "";
    toast("Échec de l'envoi du fichier : " + e.message, "terr");
    return;
  }

  await majVehicule(v.id, donnees);
  btn.disabled = false;
  toast("Dommage signalé — véhicule transféré vers Endommagés");
  closeModal("modal-dommage");
  _dommageCible = null;
};

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
// ---------------------------------------------------------------
// Reconnaissance des colonnes — deux passes (par en-tête puis par contenu),
// avec correspondance modifiable à la main et aperçu éditable ligne par
// ligne. Voir arrivages.js pour le détail des commentaires (logique
// identique, adaptée au champ "Date d'entrée" au lieu de "Arrivée prévue").
// ---------------------------------------------------------------

const CHAMP_DATE = "dateEntree";
const CHAMPS_IMPORT = [
  { cle: "", label: "— Ignorer —" },
  { cle: "chassis", label: "Châssis" },
  { cle: "marque", label: "Marque" },
  { cle: "modele", label: "Modèle" },
  { cle: "type", label: "Type" },
  { cle: "couleurExt", label: "Couleur ext." },
  { cle: "couleurInt", label: "Couleur int." },
  { cle: "emplacement", label: "Emplacement" },
  { cle: CHAMP_DATE, label: "Date d'entrée" },
  { cle: "annee", label: "Année" },
  { cle: "prix", label: "Prix" },
];

const ALIAS_COLONNES = {
  chassis: ["chassis", "châssis", "vin", "numero de chassis", "n chassis"],
  marque: ["marque"],
  modele: ["modele", "modèle"],
  couleurExt: ["couleur exterieure", "couleur exterieur", "couleur ext", "exterior color"],
  couleurInt: ["couleur interieure", "couleur interieur", "couleur int", "interior color"],
  [CHAMP_DATE]: ["date d entree", "date entree", "date entree en stock", "date d entree en stock"],
  type: ["type"],
  emplacement: ["emplacement", "emplacement prevu", "site"],
  annee: ["annee", "année"],
  prix: ["prix", "prix prevu", "prix fcfa"],
};

function normaliser(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

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

function normaliserDate(v) {
  return normaliserDateTexte(v);
}

function optionsDe(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return [];
  return Array.from(sel.options).map((o) => o.value).filter(Boolean);
}

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

  scores.sort((a, b) => b.score - a.score);
  const mappingParColonne = new Array(nbCol).fill("");
  const champsPris = new Set();
  for (const s of scores) {
    if (s.score < 0.6) break;
    if (mappingParColonne[s.col] || champsPris.has(s.champ)) continue;
    mappingParColonne[s.col] = s.champ;
    champsPris.add(s.champ);
  }

  const champsCouleur = ["couleurExt", "couleurInt"];
  for (let c = 0; c < nbCol && champsCouleur.length; c++) {
    if (mappingParColonne[c]) continue;
    const valeurs = echantillon.map((l) => (l[c] || "").trim()).filter(Boolean);
    if (valeurs.length === 0) continue;
    const toutNumerique = valeurs.every((v) => estNombre(v));
    if (toutNumerique) continue;
    mappingParColonne[c] = champsCouleur.shift();
  }

  return mappingParColonne;
}

function construireDonnees(lignesDonnees, mappingParColonne) {
  return lignesDonnees.filter((l) => l.length && l.some((c) => c)).map((l) => {
    const val = (champ) => {
      const idx = mappingParColonne.indexOf(champ);
      return idx === -1 ? "" : (l[idx] || "").trim();
    };
    const marque = normaliserMarque(val("marque"));
    return {
      chassis: val("chassis"),
      marque,
      modele: normaliserModele(marque, val("modele"), true),
      couleurExt: val("couleurExt"),
      couleurInt: val("couleurInt"),
      [CHAMP_DATE]: normaliserDate(val(CHAMP_DATE)),
      type: val("type") || typeAutomatique(marque) || "",
      emplacement: val("emplacement"),
      annee: Number(val("annee")) || null,
      prix: Number(val("prix")) || null,
      statut: "stock",
      equipements: {},
    };
  });
}

// ---------------------------------------------------------------
// État de la modale d'import + interactions (glisser-déposer, coller)
// ---------------------------------------------------------------

let _lignesBrutes = [];
let _ligneEnteteExiste = false;
let _mappingParColonne = [];
let _importDonnees = [];

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
  return !!(d.chassis && d.marque && d.modele && d.couleurExt && d.couleurInt && d[CHAMP_DATE] && !estModeleGenerique(d.marque, d.modele));
}

function afficherMapping() {
  const wrap = document.getElementById("import-mapping-wrap");
  if (!wrap) return;
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
      if (champ) _mappingParColonne = _mappingParColonne.map((c, i) => (i !== idx && c === champ ? "" : c));
      _mappingParColonne[idx] = champ;
      recalculerEtAfficher();
    });
  });
}

const COLONNES_APERCU = [
  ["chassis", "Châssis"], ["marque", "Marque"], ["modele", "Modèle"],
  ["couleurExt", "Coul. ext"], ["couleurInt", "Coul. int"], [CHAMP_DATE, "Date d'entrée"],
  ["type", "Type"], ["emplacement", "Emplacement"], ["annee", "Année"], ["prix", "Prix"],
];

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
