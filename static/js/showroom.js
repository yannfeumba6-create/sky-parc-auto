import {
  ecouterShowroom, majVehiculeShowroom, remettreAuParc, supprimerVehiculeShowroomDefinitivement, vendreVehicule,
  chassis6, STATUT_LABEL, STATUT_BADGE, MODELES_PAR_MARQUE, marqueCorrespond, modeleCorrespond,
} from "./data.js";

let _showroom = [];
const _selection = new Set();

function rafraichirFiltreModeles() {
  const marque = document.getElementById("f-marque").value;
  const modeles = marque ? (MODELES_PAR_MARQUE[marque] || []) : Object.values(MODELES_PAR_MARQUE).flat();
  const sel = document.getElementById("f-modele");
  const valActuelle = sel.value;
  sel.innerHTML = `<option value="">Tous</option>` + modeles.map((m) => `<option value="${m}">${m}</option>`).join("");
  if (modeles.includes(valActuelle)) sel.value = valActuelle;
}

function filtres() {
  const recherche = document.getElementById("f-recherche").value.trim().toLowerCase();
  const marque = document.getElementById("f-marque").value;
  const modele = document.getElementById("f-modele").value;
  const ville = document.getElementById("f-ville").value;
  const statut = document.getElementById("f-statut").value;
  return _showroom.filter((v) => {
    if (v.statut === "reserve") return false; // déplacé vers Véhicules réservés
    if (marque && !marqueCorrespond(v.marque, marque)) return false;
    if (modele && !modeleCorrespond(v.marque, v.modele, modele)) return false;
    if (ville && v.destination !== ville) return false;
    if (statut && v.statut !== statut) return false;
    if (recherche) {
      const cible = `${v.chassis || ""} ${v.modele || ""} ${chassis6(v.chassis)}`.toLowerCase();
      if (!cible.includes(recherche)) return false;
    }
    return true;
  });
}

// Quantité par showroom, en tenant compte des filtres marque/modèle actifs
// (mais pas du filtre ville, puisque l'indicateur EST la répartition par
// ville — sinon un filtre ville masquerait les deux autres compteurs).
function rendreIndicateurs() {
  const marque = document.getElementById("f-marque").value;
  const modele = document.getElementById("f-modele").value;
  const base = _showroom.filter((v) =>
    (!marque || marqueCorrespond(v.marque, marque)) &&
    (!modele || modeleCorrespond(v.marque, v.modele, modele))
  );
  const villes = { "Showroom Douala": "site-douala", "Showroom Yaoundé": "site-yaounde", "Showroom Bafoussam": "site-bafoussam" };
  Object.entries(villes).forEach(([ville, elId]) => {
    document.getElementById(elId).textContent = base.filter((v) => v.destination === ville).length;
  });
}

function rendre() {
  const liste = filtres();
  const tbody = document.getElementById("showroom-body");
  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-state"><strong>Aucun véhicule en showroom</strong>Ajuste les filtres, ou envoie un véhicule depuis le Stock véhicule parc.</td></tr>`;
  } else {
    tbody.innerHTML = liste.map((v) => {
      const badge = STATUT_BADGE[v.statut] || "badge-stock";
      const label = STATUT_LABEL[v.statut] || v.statut;
      const coche = _selection.has(v.id) ? "checked" : "";
      return `<tr>
        <td><input type="checkbox" class="select-ligne" data-id="${v.id}" ${coche}></td>
        <td class="plate">${esc(chassis6(v.chassis))}</td>
        <td>${esc(v.marque) || "—"}</td>
        <td>${esc(v.modele) || "—"}</td>
        <td>${esc((v.destination || "").replace("Showroom ", ""))}</td>
        <td><span class="tag ${badge}">${esc(label)}</span></td>
        <td>${esc(v.dateEntree) || "—"}</td>
        <td>${esc(v.dateSortie) || "—"}</td>
        <td>${esc(v.chauffeurSortie) || "—"}</td>
        <td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td>
        <td style="white-space:nowrap;">
          ${v.statut === "stock" ? `<button class="btn btn-ghost btn-sm" data-action="reserver" data-id="${v.id}">Réserver</button>` : ""}
          ${v.statut === "reserve" ? `<button class="btn btn-ghost btn-sm" data-action="lever-reserve" data-id="${v.id}">Lever réserv.</button>` : ""}
          <button class="btn btn-red btn-sm" data-action="vendre" data-id="${v.id}">Vendre</button>
          <button class="btn btn-ghost btn-sm" data-action="remettre-parc" data-id="${v.id}">Remettre au parc</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red);" data-action="supprimer" data-id="${v.id}">🗑</button>
        </td>
      </tr>`;
    }).join("");
  }
  rendreIndicateurs();
  rendreBarreSelection();
}

function rendreBarreSelection() {
  const barre = document.getElementById("barre-selection");
  const n = _selection.size;
  document.getElementById("nb-selection").textContent = n;
  barre.style.display = n > 0 ? "block" : "none";
  const selectAll = document.getElementById("select-all");
  const visibles = filtres().map((v) => v.id);
  selectAll.checked = visibles.length > 0 && visibles.every((id) => _selection.has(id));
}

document.addEventListener("change", (e) => {
  if (e.target.id === "select-all") {
    const visibles = filtres().map((v) => v.id);
    if (e.target.checked) visibles.forEach((id) => _selection.add(id));
    else visibles.forEach((id) => _selection.delete(id));
    rendre();
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
  rendre();
};

window.supprimerSelectionShowroom = async function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  if (!confirm(`Supprimer définitivement ${ids.length} véhicule(s) sélectionné(s) du Showroom ? Cette action est irréversible.`)) return;
  let n = 0;
  for (const id of ids) {
    const v = _showroom.find((x) => x.id === id);
    if (v) { await supprimerVehiculeShowroomDefinitivement(v); n++; }
  }
  toast(`${n} véhicule(s) supprimé(s)`);
  _selection.clear();
};

// ---------------------------------------------------------------
// Modification en masse
// ---------------------------------------------------------------

window.ouvrirModifMasseShowroom = function () {
  document.getElementById("mms-statut").value = "";
  document.getElementById("mms-destination").value = "";
  document.getElementById("mms-prix").value = "";
  openModal("modal-modif-masse-showroom");
};

window.confirmerModifMasseShowroom = async function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  const statut = document.getElementById("mms-statut").value;
  const destination = document.getElementById("mms-destination").value;
  const prix = document.getElementById("mms-prix").value;
  const donnees = {};
  if (statut) donnees.statut = statut;
  if (destination) donnees.destination = destination;
  if (prix !== "") donnees.prix = Number(prix);
  if (Object.keys(donnees).length === 0) { toast("Renseigne au moins un champ à modifier", "terr"); return; }
  if (!confirm(`Appliquer ces modifications à ${ids.length} véhicule(s) sélectionné(s) ?`)) return;
  for (const id of ids) await majVehiculeShowroom(id, { ...donnees });
  toast(`${ids.length} véhicule(s) modifié(s)`);
  closeModal("modal-modif-masse-showroom");
  _selection.clear();
};

// ---------------------------------------------------------------
// Vente d'un véhicule
// ---------------------------------------------------------------

let _venteCible = null;

function ouvrirModalVente(id) {
  const v = _showroom.find((x) => x.id === id);
  if (!v) return;
  _venteCible = id;
  document.getElementById("vente-modal-title").textContent = `VENTE — ${v.marque || ""} ${v.modele || ""} (${chassis6(v.chassis)})`;
  document.getElementById("ve-clientNom").value = "";
  document.getElementById("ve-clientContact").value = "";
  document.getElementById("ve-dateVente").value = new Date().toISOString().slice(0, 10);
  document.getElementById("ve-prix").value = v.prix || "";
  document.getElementById("ve-modePaiement").value = "";
  document.getElementById("ve-vendeur").value = "";
  openModal("modal-vente");
}

window.confirmerVente = async function (bouton) { return executerUneFois("vente-showroom", async () => {
  const clientNom = document.getElementById("ve-clientNom").value.trim();
  const dateVente = document.getElementById("ve-dateVente").value;
  const prix = document.getElementById("ve-prix").value;
  if (!clientNom) { toast("Le nom du client est obligatoire", "terr"); return; }
  if (!dateVente) { toast("La date de vente est obligatoire", "terr"); return; }
  const v = _showroom.find((x) => x.id === _venteCible);
  if (!v) return;

  await vendreVehicule(v, {
    client: {
      nom: clientNom,
      contact: document.getElementById("ve-clientContact").value.trim(),
      dateAchat: dateVente,
      modePaiement: document.getElementById("ve-modePaiement").value.trim(),
      vendeur: document.getElementById("ve-vendeur").value.trim(),
    },
    prix: prix ? Number(prix) : null,
    dateVente,
  });
  toast("Véhicule vendu — visible dans Véhicules vendus");
  closeModal("modal-vente");
  _venteCible = null;
}, bouton); };

// ---------------------------------------------------------------
// Vente en masse — un même client pour toute la sélection
// ---------------------------------------------------------------

window.ouvrirModalVenteMasse = function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  document.getElementById("vente-masse-titre").textContent = `VENTE DE LA SÉLECTION — ${ids.length} véhicule(s)`;
  document.getElementById("vm-clientNom").value = "";
  document.getElementById("vm-clientContact").value = "";
  document.getElementById("vm-dateVente").value = new Date().toISOString().slice(0, 10);
  document.getElementById("vm-prix").value = "";
  document.getElementById("vm-modePaiement").value = "";
  document.getElementById("vm-vendeur").value = "";
  openModal("modal-vente-masse");
};

window.confirmerVenteMasse = async function (bouton) { return executerUneFois("vente-masse-showroom", async () => {
  const ids = [..._selection];
  if (ids.length === 0) return;
  const clientNom = document.getElementById("vm-clientNom").value.trim();
  const dateVente = document.getElementById("vm-dateVente").value;
  const prix = document.getElementById("vm-prix").value;
  if (!clientNom) { toast("Le nom du client est obligatoire", "terr"); return; }
  if (!dateVente) { toast("La date de vente est obligatoire", "terr"); return; }

  const client = {
    nom: clientNom,
    contact: document.getElementById("vm-clientContact").value.trim(),
    dateAchat: dateVente,
    modePaiement: document.getElementById("vm-modePaiement").value.trim(),
    vendeur: document.getElementById("vm-vendeur").value.trim(),
  };

  let n = 0;
  for (const id of ids) {
    const v = _showroom.find((x) => x.id === id);
    if (!v) continue;
    await vendreVehicule(v, { client, prix: prix ? Number(prix) : null, dateVente });
    n++;
  }
  toast(`${n} véhicule(s) vendu(s) — visibles dans Véhicules vendus`);
  closeModal("modal-vente-masse");
  _selection.clear();
}, bouton); };

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  const v = _showroom.find((x) => x.id === id);
  if (!v) return;

  if (action === "reserver") {
    const motif = prompt("Motif de la réservation (raison pour laquelle ce véhicule est réservé) :");
    if (motif === null) return;
    if (!motif.trim()) { toast("Le motif de la réservation est obligatoire", "terr"); return; }
    await majVehiculeShowroom(id, { statut: "reserve", motifReservation: motif.trim(), dateReservation: new Date().toISOString().slice(0, 10) });
    toast("Véhicule réservé — visible dans Véhicules réservés");
  }
  if (action === "lever-reserve") {
    await majVehiculeShowroom(id, { statut: "stock" });
    toast("Réservation levée");
  }
  if (action === "vendre") {
    ouvrirModalVente(id);
  }
  if (action === "remettre-parc") {
    if (!confirm(`Remettre "${v.marque || ""} ${v.modele || ""}" (${chassis6(v.chassis)}) au Stock véhicule parc ?`)) return;
    await remettreAuParc(v);
    toast("Véhicule remis au Stock véhicule parc");
  }
  if (action === "supprimer") {
    if (!confirm(`Supprimer définitivement "${v.marque || ""} ${v.modele || ""}" (${chassis6(v.chassis)}) ? Cette action est irréversible.`)) return;
    await supprimerVehiculeShowroomDefinitivement(v);
    toast("Véhicule supprimé");
  }
});

const rendreDebounced = debounce(rendre);
["f-recherche", "f-marque", "f-modele", "f-ville", "f-statut"].forEach((id) => {
  document.getElementById(id).addEventListener("input", id === "f-recherche" ? rendreDebounced : rendre);
  document.getElementById(id).addEventListener("change", rendre);
});
document.getElementById("f-marque").addEventListener("change", rafraichirFiltreModeles);

// ---------------------------------------------------------------
// Export CSV / PDF
// ---------------------------------------------------------------

window.exporterCSV = function () {
  const liste = filtres();
  if (liste.length === 0) { toast("Aucun véhicule à exporter", "tinfo"); return; }
  const headers = ["Châssis", "Marque", "Modèle", "Ville", "Statut", "Date d'entrée parc", "Arrivée showroom", "Prix"];
  const rows = liste.map((v) => [v.chassis, v.marque, v.modele, v.destination, STATUT_LABEL[v.statut] || v.statut, v.dateEntree, v.dateSortie, v.prix]);
  exportCSV(`stock_showroom_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
};

window.exporterPDF = function () {
  const liste = filtres();
  const rows = liste.map((v) => `<tr><td>${esc(chassis6(v.chassis))}</td><td>${esc(v.marque) || "—"}</td><td>${esc(v.modele) || "—"}</td><td>${esc(v.destination) || "—"}</td><td>${esc(STATUT_LABEL[v.statut] || v.statut)}</td><td>${esc(v.dateSortie) || "—"}</td><td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td></tr>`).join("");
  document.getElementById("pdf-content").innerHTML = `
    <div class="kpi-row"><div class="kpi-box"><div class="kpi-val">${liste.length}</div><div class="kpi-lbl">Véhicules en showroom</div></div></div>
    <table><thead><tr><th>Châssis</th><th>Marque</th><th>Modèle</th><th>Ville</th><th>Statut</th><th>Arrivée</th><th>Prix</th></tr></thead><tbody>${rows}</tbody></table>`;
  printPDF("pdf-content", "Stock Showroom");
};

document.addEventListener("DOMContentLoaded", () => {
  rafraichirFiltreModeles();
  ecouterShowroom((liste) => { _showroom = liste; rendre(); });
});
