import { ecouterArchives, restaurerArchive, chassis6, STATUT_LABEL } from "./data.js";

let _archives = [];

function filtres() {
  const recherche = document.getElementById("f-recherche").value.trim().toLowerCase();
  const marque = document.getElementById("f-marque").value;
  return _archives.filter((v) => {
    if (marque && v.marque !== marque) return false;
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
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><strong>Aucun véhicule archivé</strong></td></tr>`;
    return;
  }
  tbody.innerHTML = liste.map((v) => {
    const d = v.sortiLe?.toDate ? v.sortiLe.toDate() : null;
    return `<tr>
      <td class="plate">${esc(chassis6(v.chassis))}</td>
      <td>${esc(v.marque) || "—"}</td>
      <td>${esc(v.modele) || "—"}</td>
      <td>${esc(STATUT_LABEL[v.statut] || v.statut) || "—"}</td>
      <td>${esc(v.client?.nom) || "—"}</td>
      <td>${d ? d.toLocaleString("fr-FR") : "—"}</td>
      <td><b>${esc(v.sortiPar) || "—"}</b></td>
      <td><button class="btn btn-ghost btn-sm" data-restaurer="${v.id}">Restaurer en stock</button></td>
    </tr>`;
  }).join("");
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-restaurer]");
  if (!btn) return;
  const v = _archives.find((x) => x.id === btn.dataset.restaurer);
  if (!v) return;
  if (!confirm(`Restaurer "${v.marque || ""} ${v.modele || ""}" (${chassis6(v.chassis)}) dans le Stock véhicule ?`)) return;
  await restaurerArchive(v);
  toast("Véhicule restauré dans le Stock véhicule");
});

["f-recherche", "f-marque"].forEach((id) => {
  document.getElementById(id).addEventListener("input", rendre);
  document.getElementById(id).addEventListener("change", rendre);
});

document.addEventListener("DOMContentLoaded", () => {
  ecouterArchives((liste) => { _archives = liste; rendre(); });
});
