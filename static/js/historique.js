import { ecouterHistorique, supprimerHistorique, marqueCorrespond } from "./data.js";

let _historique = [];
const _selection = new Set();

function toDate(v) {
  if (!v) return null;
  if (v.toDate) return v.toDate();
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function filtres() {
  const recherche = document.getElementById("f-recherche").value.trim().toLowerCase();
  const marque = document.getElementById("f-marque").value;
  const action = document.getElementById("f-action").value;
  return _historique.filter((h) => {
    if (marque && !marqueCorrespond(h.marque, marque)) return false;
    if (action && h.action !== action) return false;
    if (recherche) {
      const cible = `${h.chassis || ""} ${h.modele || ""} ${h.utilisateur || ""}`.toLowerCase();
      if (!cible.includes(recherche)) return false;
    }
    return true;
  });
}

const STATUT_LABEL = { stock: "En stock", reserve: "Réservé", vendu: "Vendu", endommage: "Endommagé" };

function rendre() {
  const liste = filtres();
  const tbody = document.getElementById("historique-body");
  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><strong>Aucun mouvement</strong>Ajuste les filtres.</td></tr>`;
    rendreBarreSelection();
    return;
  }
  tbody.innerHTML = liste.map((h) => {
    const d = toDate(h.horodatage);
    const coche = _selection.has(h.id) ? "checked" : "";
    return `<tr>
      <td><input type="checkbox" class="select-ligne" data-id="${h.id}" ${coche}></td>
      <td>${d ? d.toLocaleString("fr-FR") : "—"}</td>
      <td>${esc(h.action) || "—"}</td>
      <td>${esc(h.marque) || ""} ${esc(h.modele) || ""}</td>
      <td class="plate">${esc(h.chassis) || "—"}</td>
      <td>${esc(STATUT_LABEL[h.statut] || h.statut) || "—"}</td>
      <td><b>${esc(h.utilisateur) || "—"}</b></td>
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
  const visibles = filtres().map((h) => h.id);
  selectAll.checked = visibles.length > 0 && visibles.every((id) => _selection.has(id));
}

document.addEventListener("change", (e) => {
  if (e.target.id === "select-all") {
    const visibles = filtres().map((h) => h.id);
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

window.supprimerSelectionHistorique = async function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  const mdp = prompt(`Suppression de ${ids.length} ligne(s) d'historique — entrer le mot de passe pour confirmer :`);
  if (mdp === null) return;
  if (mdp !== "2026") { toast("Mot de passe incorrect", "terr"); return; }
  if (!confirm(`Confirmer la suppression définitive de ${ids.length} ligne(s) d'historique ? Cette action est irréversible.`)) return;
  for (const id of ids) {
    await supprimerHistorique(id);
  }
  toast(`${ids.length} ligne(s) supprimée(s)`);
  _selection.clear();
};

["f-recherche", "f-marque", "f-action"].forEach((id) => {
  document.getElementById(id).addEventListener("input", rendre);
  document.getElementById(id).addEventListener("change", rendre);
});

// ---------------------------------------------------------------
// Export CSV / Excel / PDF
// ---------------------------------------------------------------

window.exporterCSV = function () {
  const liste = filtres();
  if (liste.length === 0) { toast("Aucune ligne à exporter", "tinfo"); return; }
  const headers = ["Date", "Action", "Marque", "Modèle", "Châssis", "Statut", "Effectué par"];
  const rows = liste.map((h) => {
    const d = toDate(h.horodatage);
    return [d ? d.toLocaleString("fr-FR") : "", h.action, h.marque, h.modele, h.chassis, STATUT_LABEL[h.statut] || h.statut, h.utilisateur];
  });
  exportCSV(`historique_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
};

window.exporterPDF = function () {
  const liste = filtres();
  const rows = liste.map((h) => {
    const d = toDate(h.horodatage);
    return `<tr><td>${d ? d.toLocaleString("fr-FR") : "—"}</td><td>${esc(h.action) || "—"}</td><td>${esc(h.marque) || ""} ${esc(h.modele) || ""}</td><td>${esc(h.chassis) || "—"}</td><td>${esc(STATUT_LABEL[h.statut] || h.statut) || "—"}</td><td><b>${esc(h.utilisateur) || "—"}</b></td></tr>`;
  }).join("");
  document.getElementById("pdf-content").innerHTML = `<table><thead><tr><th>Date</th><th>Action</th><th>Véhicule</th><th>Châssis</th><th>Statut</th><th>Effectué par</th></tr></thead><tbody>${rows}</tbody></table>`;
  printPDF("pdf-content", "Historique");
};

document.addEventListener("DOMContentLoaded", () => {
  ecouterHistorique((liste) => { _historique = liste; rendre(); });
});
