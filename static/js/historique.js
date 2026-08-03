import { ecouterHistorique, marqueCorrespond } from "./data.js";

let _historique = [];

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
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><strong>Aucun mouvement</strong>Ajuste les filtres.</td></tr>`;
    return;
  }
  tbody.innerHTML = liste.map((h) => {
    const d = toDate(h.horodatage);
    return `<tr>
      <td>${d ? d.toLocaleString("fr-FR") : "—"}</td>
      <td>${esc(h.action) || "—"}</td>
      <td>${esc(h.marque) || ""} ${esc(h.modele) || ""}</td>
      <td class="plate">${esc(h.chassis) || "—"}</td>
      <td>${esc(STATUT_LABEL[h.statut] || h.statut) || "—"}</td>
      <td><b>${esc(h.utilisateur) || "—"}</b></td>
    </tr>`;
  }).join("");
}

["f-recherche", "f-marque", "f-action"].forEach((id) => {
  document.getElementById(id).addEventListener("input", rendre);
  document.getElementById(id).addEventListener("change", rendre);
});

document.addEventListener("DOMContentLoaded", () => {
  ecouterHistorique((liste) => { _historique = liste; rendre(); });
});
