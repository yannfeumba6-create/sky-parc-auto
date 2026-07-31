import { ecouterVehicules, chassis6 } from "./data.js";

let _vendus = [];

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

function filtres() {
  const recherche = document.getElementById("f-recherche").value.trim().toLowerCase();
  const marque = document.getElementById("f-marque").value;
  const emplacement = document.getElementById("f-emplacement").value;
  const periode = document.getElementById("f-periode").value;
  return _vendus.filter((v) => {
    if (marque && v.marque !== marque) return false;
    if (emplacement && v.emplacement !== emplacement) return false;
    if (!dansPeriode(v.client?.dateAchat, periode)) return false;
    if (recherche) {
      const cible = `${v.chassis || ""} ${v.modele || ""} ${v.client?.nom || ""}`.toLowerCase();
      if (!cible.includes(recherche)) return false;
    }
    return true;
  });
}

function rendre() {
  const liste = filtres();
  const tbody = document.getElementById("vendus-body");
  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><strong>Aucun véhicule vendu</strong>Ajuste les filtres.</td></tr>`;
    return;
  }
  tbody.innerHTML = liste.map((v) => `
    <tr>
      <td class="plate">${chassis6(v.chassis)}</td>
      <td>${v.marque || "—"}</td>
      <td>${v.modele || "—"}</td>
      <td>${v.client?.nom || "—"}</td>
      <td>${v.client?.contact || "—"}</td>
      <td>${v.dateEntree || "—"}</td>
      <td>${v.client?.dateAchat || v.dateSortie || "—"}</td>
      <td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td>
    </tr>`).join("");
}

["f-recherche", "f-marque", "f-emplacement", "f-periode"].forEach((id) => {
  document.getElementById(id).addEventListener("input", rendre);
  document.getElementById(id).addEventListener("change", rendre);
});

window.exporterCSV = function () {
  const liste = filtres();
  if (liste.length === 0) { toast("Aucun véhicule à exporter", "tinfo"); return; }
  const headers = ["Châssis", "Marque", "Modèle", "Client", "Contact", "Date entrée", "Date achat", "Prix"];
  const rows = liste.map((v) => [v.chassis, v.marque, v.modele, v.client?.nom, v.client?.contact, v.dateEntree, v.client?.dateAchat, v.prix]);
  exportCSV(`vehicules_vendus_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
};

window.exporterPDF = function () {
  const liste = filtres();
  const rows = liste.map((v) => `<tr><td>${chassis6(v.chassis)}</td><td>${v.marque || "—"}</td><td>${v.modele || "—"}</td><td>${v.client?.nom || "—"}</td><td>${v.dateEntree || "—"}</td><td>${v.client?.dateAchat || "—"}</td><td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td></tr>`).join("");
  document.getElementById("pdf-content").innerHTML = `<table><thead><tr><th>Châssis</th><th>Marque</th><th>Modèle</th><th>Client</th><th>Entrée</th><th>Achat</th><th>Prix</th></tr></thead><tbody>${rows}</tbody></table>`;
  printPDF("pdf-content", "Véhicules Vendus");
};

document.addEventListener("DOMContentLoaded", () => {
  ecouterVehicules((tous) => {
    _vendus = tous.filter((v) => v.statut === "vendu");
    rendre();
  });
});
