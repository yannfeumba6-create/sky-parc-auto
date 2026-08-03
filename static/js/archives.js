import { ecouterArchives, restaurerArchive, supprimerArchive, chassis6, STATUT_LABEL, marqueCorrespond } from "./data.js";

let _archives = [];
const _selection = new Set();

function filtres() {
  const recherche = document.getElementById("f-recherche").value.trim().toLowerCase();
  const marque = document.getElementById("f-marque").value;
  return _archives.filter((v) => {
    if (marque && !marqueCorrespond(v.marque, marque)) return false;
    if (recherche) {
      const cible = `${v.chassis || ""} ${v.modele || ""} ${v.client?.nom || ""}`.toLowerCase();
      if (!cible.includes(recherche)) return false;
    }
    return true;
  });
}

function rendre() {
  const liste = filtres();
  const tbody = document.getElementById("archives-body");
  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state"><strong>Aucun véhicule archivé</strong></td></tr>`;
    rendreBarreSelection();
    return;
  }
  tbody.innerHTML = liste.map((v) => {
    const d = v.sortiLe?.toDate ? v.sortiLe.toDate() : null;
    const coche = _selection.has(v.id) ? "checked" : "";
    return `<tr>
      <td><input type="checkbox" class="select-ligne" data-id="${v.id}" ${coche}></td>
      <td class="plate">${esc(chassis6(v.chassis))}</td>
      <td>${esc(v.marque) || "—"}</td>
      <td>${esc(v.modele) || "—"}</td>
      <td>${esc(STATUT_LABEL[v.statut] || v.statut) || "—"}</td>
      <td>${esc(v.client?.nom) || "—"}</td>
      <td>${d ? d.toLocaleString("fr-FR") : "—"}</td>
      <td><b>${esc(v.sortiPar) || "—"}</b></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" data-restaurer="${v.id}">Restaurer en stock</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red);" data-supprimer="${v.id}">🗑</button>
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

window.supprimerSelectionArchives = async function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  if (!confirm(`Supprimer définitivement ${ids.length} fiche(s) archivée(s) ? Cette action est irréversible.`)) return;
  for (const id of ids) {
    await supprimerArchive(id);
  }
  toast(`${ids.length} fiche(s) supprimée(s)`);
  _selection.clear();
};

document.addEventListener("click", async (e) => {
  const restBtn = e.target.closest("[data-restaurer]");
  if (restBtn) {
    const v = _archives.find((x) => x.id === restBtn.dataset.restaurer);
    if (!v) return;
    if (!confirm(`Restaurer "${v.marque || ""} ${v.modele || ""}" (${chassis6(v.chassis)}) dans le Stock véhicule ?`)) return;
    await restaurerArchive(v);
    toast("Véhicule restauré dans le Stock véhicule");
    return;
  }
  const delBtn = e.target.closest("[data-supprimer]");
  if (delBtn) {
    const v = _archives.find((x) => x.id === delBtn.dataset.supprimer);
    if (!v) return;
    if (!confirm(`Supprimer définitivement "${v.marque || ""} ${v.modele || ""}" (${chassis6(v.chassis)}) ? Cette action est irréversible.`)) return;
    await supprimerArchive(v.id);
    toast("Fiche supprimée");
  }
});

["f-recherche", "f-marque"].forEach((id) => {
  document.getElementById(id).addEventListener("input", rendre);
  document.getElementById(id).addEventListener("change", rendre);
});

document.addEventListener("DOMContentLoaded", () => {
  ecouterArchives((liste) => { _archives = liste; rendre(); });
});
