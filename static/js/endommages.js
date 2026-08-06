import { ecouterVehicules, majVehicule, supprimerVehiculeDefinitivement, chassis6, STATUT_LABEL, STATUT_BADGE, marqueCorrespond } from "./data.js";

let _tous = [];
const _selection = new Set();

const CLASSE_LIGNE = {
  endommage: "ligne-endommage",
  prise_en_charge: "ligne-prise-en-charge",
  repare: "ligne-repare",
};

function filtreCommun(liste) {
  const recherche = document.getElementById("f-recherche").value.trim().toLowerCase();
  const marque = document.getElementById("f-marque").value;
  const emplacement = document.getElementById("f-emplacement").value;
  const statut = document.getElementById("f-statut").value;
  return liste.filter((v) => {
    if (marque && !marqueCorrespond(v.marque, marque)) return false;
    if (emplacement && v.emplacement !== emplacement) return false;
    if (statut && v.statut !== statut) return false;
    if (recherche) {
      const cible = `${v.chassis || ""} ${v.modele || ""} ${chassis6(v.chassis)}`.toLowerCase();
      if (!cible.includes(recherche)) return false;
    }
    return true;
  });
}

function tousEndommages() {
  return _tous.filter((v) => ["endommage", "prise_en_charge", "repare"].includes(v.statut));
}

function endommagesFiltres() {
  return filtreCommun(tousEndommages());
}

function rendreKpis() {
  const base = filtreCommun(tousEndommages());
  document.getElementById("qte-endommages").textContent = base.filter((v) => v.statut === "endommage").length;
  document.getElementById("qte-prise-en-charge").textContent = base.filter((v) => v.statut === "prise_en_charge").length;
  document.getElementById("qte-repares").textContent = base.filter((v) => v.statut === "repare").length;
}

function rendre() {
  const liste = endommagesFiltres();
  const tbody = document.getElementById("endommage-body");
  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-state"><strong>Aucun véhicule endommagé</strong></td></tr>`;
  } else {
    tbody.innerHTML = liste.map((v) => {
      const coche = _selection.has(v.id) ? "checked" : "";
      const badge = STATUT_BADGE[v.statut] || "badge-endommage";
      const label = STATUT_LABEL[v.statut] || v.statut;
      const medias = [];
      if (v.photoDommageURL) medias.push(`<a href="${v.photoDommageURL}" target="_blank" rel="noopener">📷 Photo</a>`);
      if (v.videoDommageURL) medias.push(`<a href="${v.videoDommageURL}" target="_blank" rel="noopener">🎥 Vidéo</a>`);
      const pecInfo = v.compagnieReparation
        ? `<div>${esc(v.compagnieReparation)}</div><div style="color:var(--muted);">Chauffeur : ${esc(v.chauffeurTransfert) || "—"}</div><div style="color:var(--muted);">${v.heureSortiePriseEnCharge ? new Date(v.heureSortiePriseEnCharge).toLocaleString("fr-FR") : ""}</div>`
        : "—";
      return `
      <tr class="${CLASSE_LIGNE[v.statut] || ""}">
        <td><input type="checkbox" class="select-ligne" data-id="${v.id}" ${coche}></td>
        <td class="plate">${esc(chassis6(v.chassis))}</td><td>${esc(v.marque) || "—"}</td><td>${esc(v.modele) || "—"}</td>
        <td>${esc(v.emplacement) || "—"}</td>
        <td><span class="tag ${badge}">${esc(label)}</span></td>
        <td style="max-width:220px;white-space:normal;">${esc(v.piecesEndommagees) || "—"}</td>
        <td>${esc(v.dateConstat) || "—"}</td>
        <td>${medias.length ? medias.join(" · ") : "—"}</td>
        <td>${pecInfo}</td>
        <td style="white-space:nowrap;">
          ${v.statut === "endommage" ? `<button class="btn btn-ghost btn-sm" data-action="prise-en-charge" data-id="${v.id}">Prise en charge</button>` : ""}
          ${v.statut === "prise_en_charge" ? `<button class="btn btn-ghost btn-sm" style="color:var(--green);" data-action="confirmer-reparation" data-id="${v.id}">Confirmer réparation</button>` : ""}
          ${v.statut === "repare" ? `<button class="btn btn-ghost btn-sm" style="color:var(--green);" data-action="remettre-stock" data-id="${v.id}">Remettre en stock</button>` : ""}
          <button class="btn btn-ghost btn-sm" style="color:var(--red);" data-action="supprimer" data-id="${v.id}">🗑</button>
        </td>
      </tr>`;
    }).join("");
  }
  rendreKpis();
  rendreBarreSelection();
}

function rendreBarreSelection() {
  const barre = document.getElementById("barre-selection");
  const n = _selection.size;
  document.getElementById("nb-selection").textContent = n;
  barre.style.display = n > 0 ? "block" : "none";
  const selectAll = document.getElementById("select-all");
  const visibles = endommagesFiltres().map((v) => v.id);
  selectAll.checked = visibles.length > 0 && visibles.every((id) => _selection.has(id));
}

document.addEventListener("change", (e) => {
  if (e.target.id === "select-all") {
    const visibles = endommagesFiltres().map((v) => v.id);
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

window.supprimerSelectionEndommages = async function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  if (!confirm(`Supprimer définitivement ${ids.length} véhicule(s) sélectionné(s) ? Cette action est irréversible.`)) return;
  let n = 0;
  for (const id of ids) {
    const v = _tous.find((x) => x.id === id);
    if (v) { await supprimerVehiculeDefinitivement(v); n++; }
  }
  toast(`${n} véhicule(s) supprimé(s)`);
  _selection.clear();
};

// ---------------------------------------------------------------
// Modification en masse
// ---------------------------------------------------------------

window.ouvrirModifMasseEndommages = function () {
  document.getElementById("mme-statut").value = "";
  openModal("modal-modif-masse-endommages");
};

window.confirmerModifMasseEndommages = async function () {
  const ids = [..._selection];
  const statut = document.getElementById("mme-statut").value;
  if (!statut) { toast("Choisis un état à appliquer", "terr"); return; }
  if (!confirm(`Appliquer ce changement d'état à ${ids.length} véhicule(s) sélectionné(s) ?`)) return;
  for (const id of ids) await majVehicule(id, { statut });
  toast(`${ids.length} véhicule(s) modifié(s)`);
  closeModal("modal-modif-masse-endommages");
  _selection.clear();
};

// ---------------------------------------------------------------
// Prise en charge (réparation)
// ---------------------------------------------------------------

let _pecCible = null;

function ouvrirModalPriseEnCharge(id) {
  const v = _tous.find((x) => x.id === id);
  if (!v) return;
  _pecCible = id;
  document.getElementById("pec-titre").textContent = `PRISE EN CHARGE — ${v.marque || ""} ${v.modele || ""} (${chassis6(v.chassis)})`;
  document.getElementById("pec-heureSortie").value = new Date().toISOString().slice(0, 16);
  document.getElementById("pec-compagnie").value = "";
  document.getElementById("pec-chauffeur").value = "";
  openModal("modal-prise-en-charge");
}

window.confirmerPriseEnCharge = async function () {
  const heureSortie = document.getElementById("pec-heureSortie").value;
  const compagnie = document.getElementById("pec-compagnie").value.trim();
  const chauffeur = document.getElementById("pec-chauffeur").value.trim();
  if (!heureSortie) { toast("L'heure de sortie est obligatoire", "terr"); return; }
  if (!compagnie) { toast("La compagnie de réparation est obligatoire", "terr"); return; }
  if (!chauffeur) { toast("Le chauffeur en charge du transfert est obligatoire", "terr"); return; }

  await majVehicule(_pecCible, {
    statut: "prise_en_charge",
    heureSortiePriseEnCharge: heureSortie,
    compagnieReparation: compagnie,
    chauffeurTransfert: chauffeur,
  });
  toast("Véhicule en prise en charge — passage en orange");
  closeModal("modal-prise-en-charge");
  _pecCible = null;
};

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  const v = _tous.find((x) => x.id === id);
  if (!v) return;

  if (action === "prise-en-charge") ouvrirModalPriseEnCharge(id);

  if (action === "confirmer-reparation") {
    if (!confirm(`Confirmer que "${v.marque || ""} ${v.modele || ""}" (${chassis6(v.chassis)}) a été réparé ? Il passera en vert.`)) return;
    await majVehicule(id, { statut: "repare" });
    toast("Réparation confirmée — passage en vert");
  }

  if (action === "remettre-stock") {
    await majVehicule(id, { statut: "stock" });
    toast("Véhicule remis en Stock véhicule parc");
  }

  if (action === "supprimer") {
    if (!confirm(`Supprimer définitivement "${v.marque || ""} ${v.modele || ""}" (${chassis6(v.chassis)}) ? Cette action est irréversible.`)) return;
    await supprimerVehiculeDefinitivement(v);
    toast("Véhicule supprimé");
  }
});

["f-recherche", "f-marque", "f-emplacement", "f-statut"].forEach((id) => {
  document.getElementById(id).addEventListener("input", rendre);
  document.getElementById(id).addEventListener("change", rendre);
});

document.addEventListener("DOMContentLoaded", () => {
  ecouterVehicules((liste) => {
    _tous = liste;
    rendre();
  });
});
