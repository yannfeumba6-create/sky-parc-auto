import { ecouterVehicules, majVehicule, supprimerVehiculeDefinitivement, chassis6, marqueCorrespond } from "./data.js";

let _tous = [];
const _selection = new Set();

function filtreCommun(liste) {
  const recherche = document.getElementById("f-recherche").value.trim().toLowerCase();
  const marque = document.getElementById("f-marque").value;
  const emplacement = document.getElementById("f-emplacement").value;
  return liste.filter((v) => {
    if (marque && !marqueCorrespond(v.marque, marque)) return false;
    if (emplacement && v.emplacement !== emplacement) return false;
    if (recherche) {
      const cible = `${v.chassis || ""} ${v.modele || ""}`.toLowerCase();
      if (!cible.includes(recherche)) return false;
    }
    return true;
  });
}

function endommagesFiltres() {
  return filtreCommun(_tous.filter((v) => v.statut === "endommage"));
}

function rendre() {
  const endommages = endommagesFiltres();

  const eBody = document.getElementById("endommage-body");
  eBody.innerHTML = endommages.length === 0
    ? `<tr><td colspan="7" class="empty-state"><strong>Aucun véhicule endommagé</strong></td></tr>`
    : endommages.map((v) => {
        const coche = _selection.has(v.id) ? "checked" : "";
        return `
      <tr>
        <td><input type="checkbox" class="select-ligne" data-id="${v.id}" ${coche}></td>
        <td class="plate">${esc(chassis6(v.chassis))}</td><td>${esc(v.marque) || "—"}</td><td>${esc(v.modele) || "—"}</td>
        <td>${esc(v.emplacement) || "—"}</td><td>${esc(v.piecesEndommagees) || "—"}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost btn-sm" data-action="remettre-stock" data-id="${v.id}">Remettre en stock</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red);" data-action="supprimer" data-id="${v.id}">🗑</button>
        </td>
      </tr>`;
      }).join("");

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

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;

  if (action === "remettre-stock") {
    await majVehicule(id, { statut: "stock" });
    toast("Véhicule remis en stock");
  }
  if (action === "supprimer") {
    const v = _tous.find((x) => x.id === id);
    if (!v) return;
    if (!confirm(`Supprimer définitivement "${v.marque || ""} ${v.modele || ""}" (${chassis6(v.chassis)}) ? Cette action est irréversible.`)) return;
    await supprimerVehiculeDefinitivement(v);
    toast("Véhicule supprimé");
  }
});

["f-recherche", "f-marque", "f-emplacement"].forEach((id) => {
  document.getElementById(id).addEventListener("input", rendre);
  document.getElementById(id).addEventListener("change", rendre);
});

document.addEventListener("DOMContentLoaded", () => {
  ecouterVehicules((liste) => {
    _tous = liste;
    rendre();
  });
});
