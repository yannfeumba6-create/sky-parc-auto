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

function rendreClients() {
  const liste = filtres();
  const parClient = {};
  liste.filter((v) => v.client && v.client.nom).forEach((v) => {
    const nom = v.client.nom.trim();
    if (!parClient[nom]) parClient[nom] = { n: 0, total: 0, contact: v.client.contact || "" };
    parClient[nom].n++;
    parClient[nom].total += Number(v.prix) || 0;
  });
  const clients = Object.entries(parClient)
    .filter(([, info]) => info.n > 1) // met en avant les clients avec plusieurs véhicules
    .sort((a, b) => b[1].n - a[1].n);

  const el = document.getElementById("clients-liste");
  if (clients.length === 0) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px;">Aucun client n'a encore acheté plusieurs véhicules (avec les filtres actuels).</div>`;
    return;
  }
  el.innerHTML = clients.map(([nom, info]) => `
    <div class="client-row" data-client="${nom}" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;cursor:pointer;">
      <span><b>${nom}</b> — ${info.contact || "—"}</span>
      <span class="tag badge-vendu">${info.n} véhicules · ${info.total.toLocaleString("fr-FR")} F</span>
    </div>`).join("");
}

document.addEventListener("click", (e) => {
  const row = e.target.closest("[data-client]");
  if (!row) return;
  document.getElementById("f-recherche").value = row.dataset.client;
  rendre();
  document.getElementById("vendus-body").scrollIntoView({ behavior: "smooth", block: "start" });
});

function rendre() {
  const liste = filtres();
  const tbody = document.getElementById("vendus-body");
  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state"><strong>Aucun véhicule vendu</strong>Ajuste les filtres.</td></tr>`;
  } else {
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
        <td><button class="btn btn-ghost btn-sm" data-facture="${v.id}">🧾 Facture</button></td>
      </tr>`).join("");
  }
  rendreClients();
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-facture]");
  if (!btn) return;
  const v = _vendus.find((x) => x.id === btn.dataset.facture);
  if (!v) return;
  const corps = `
    <table>
      <tbody>
        <tr><td style="font-weight:700;width:35%;">Châssis</td><td>${v.chassis || "—"}</td></tr>
        <tr><td style="font-weight:700;">Immatriculation</td><td>${v.immatriculation || "—"}</td></tr>
        <tr><td style="font-weight:700;">Marque / Modèle</td><td>${v.marque || "—"} ${v.modele || "—"}</td></tr>
        <tr><td style="font-weight:700;">Type</td><td>${v.type || "—"}</td></tr>
        <tr><td style="font-weight:700;">Couleur extérieure / intérieure</td><td>${v.couleurExt || "—"} / ${v.couleurInt || "—"}</td></tr>
        <tr><td style="font-weight:700;">Année</td><td>${v.annee || "—"}</td></tr>
        <tr><td style="font-weight:700;">Prix de vente</td><td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " FCFA" : "—"}</td></tr>
        <tr><td style="font-weight:700;">Client</td><td>${v.client?.nom || "—"}</td></tr>
        <tr><td style="font-weight:700;">Contact client</td><td>${v.client?.contact || "—"}</td></tr>
        <tr><td style="font-weight:700;">Date d'achat</td><td>${v.client?.dateAchat || "—"}</td></tr>
        <tr><td style="font-weight:700;">Mode de paiement</td><td>${v.client?.modePaiement || "—"}</td></tr>
        <tr><td style="font-weight:700;">Vendeur / agent</td><td>${v.client?.vendeur || "—"}</td></tr>
      </tbody>
    </table>`;
  document.getElementById("pdf-content").innerHTML = corps;
  printPDF("pdf-content", `Facture — ${chassis6(v.chassis)}`);
});

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
