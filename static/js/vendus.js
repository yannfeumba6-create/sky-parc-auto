import { ecouterArchives, annulerVente, supprimerArchive, majArchive, corrigerFichesMalClasseesVendus, chassis6, marqueCorrespond } from "./data.js";

let _vendus = [];
const _selection = new Set();

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

function dateVenteDe(v) {
  return v.dateVente || v.client?.dateAchat || null;
}

function filtres() {
  const recherche = document.getElementById("f-recherche").value.trim().toLowerCase();
  const marque = document.getElementById("f-marque").value;
  const ville = document.getElementById("f-ville").value;
  const periode = document.getElementById("f-periode").value;
  const annee = document.getElementById("f-annee").value;
  return _vendus.filter((v) => {
    if (marque && !marqueCorrespond(v.marque, marque)) return false;
    if (ville && v.destination !== ville) return false;
    if (!dansPeriode(dateVenteDe(v), periode)) return false;
    if (annee) {
      const d = new Date(dateVenteDe(v));
      if (isNaN(d) || String(d.getFullYear()) !== String(annee)) return false;
    }
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
  const clients = Object.entries(parClient).sort((a, b) => b[1].n - a[1].n);

  const el = document.getElementById("clients-liste");
  if (clients.length === 0) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px;">Aucune vente enregistrée (avec les filtres actuels).</div>`;
    return;
  }
  el.innerHTML = clients.map(([nom, info]) => `
    <div class="client-row" data-client="${esc(nom)}" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;cursor:pointer;">
      <span><b>${esc(nom)}</b> — ${esc(info.contact) || "—"}</span>
      <span class="tag badge-vendu">${info.n} véhicule${info.n > 1 ? "s" : ""} · ${info.total.toLocaleString("fr-FR")} F</span>
    </div>`).join("");
}

function rendre() {
  const liste = filtres();
  const tbody = document.getElementById("vendus-body");
  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-state"><strong>Aucun véhicule vendu</strong>Ajuste les filtres.</td></tr>`;
  } else {
    tbody.innerHTML = liste.map((v) => {
      const coche = _selection.has(v.id) ? "checked" : "";
      return `<tr>
        <td><input type="checkbox" class="select-ligne" data-id="${v.id}" ${coche}></td>
        <td class="plate">${esc(chassis6(v.chassis))}</td>
        <td>${esc(v.marque) || "—"}</td>
        <td>${esc(v.modele) || "—"}</td>
        <td>${esc((v.destination || "").replace("Showroom ", "")) || "—"}</td>
        <td>${esc(v.client?.nom) || "—"}</td>
        <td>${esc(v.client?.contact) || "—"}</td>
        <td>${esc(v.dateEntree) || "—"}</td>
        <td>${esc(dateVenteDe(v)) || "—"}</td>
        <td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost btn-sm" data-facture="${v.id}">🧾 Facture</button>
          <button class="btn btn-ghost btn-sm" data-annuler="${v.id}">Annuler la vente</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red);" data-supprimer="${v.id}">🗑</button>
        </td>
      </tr>`;
    }).join("");
  }
  rendreClients();
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

window.supprimerSelectionVendus = async function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  if (!confirm(`Supprimer définitivement ${ids.length} fiche(s) de vente sélectionnée(s) ? Cette action est irréversible.`)) return;
  for (const id of ids) await supprimerArchive(id);
  toast(`${ids.length} fiche(s) supprimée(s)`);
  _selection.clear();
};

// ---------------------------------------------------------------
// Modification en masse — n'applique que les champs renseignés
// ---------------------------------------------------------------

window.ouvrirModifMasseVendus = function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  document.getElementById("mmv-titre").textContent = `MODIFIER LA SÉLECTION — ${ids.length} véhicule(s) vendu(s)`;
  document.getElementById("mmv-vendeur").value = "";
  document.getElementById("mmv-modePaiement").value = "";
  openModal("modal-modif-masse-vendus");
};

window.confirmerModifMasseVendus = async function () {
  const ids = [..._selection];
  if (ids.length === 0) return;
  const vendeur = document.getElementById("mmv-vendeur").value.trim();
  const modePaiement = document.getElementById("mmv-modePaiement").value.trim();

  if (!vendeur && !modePaiement) { toast("Renseigne au moins un champ à modifier", "terr"); return; }
  if (!confirm(`Appliquer ces modifications à ${ids.length} véhicule(s) sélectionné(s) ?`)) return;

  for (const id of ids) {
    const v = _vendus.find((x) => x.id === id);
    if (!v) continue;
    const client = { ...(v.client || {}) };
    if (vendeur) client.vendeur = vendeur;
    if (modePaiement) client.modePaiement = modePaiement;
    await majArchive(id, { client });
  }
  toast(`${ids.length} fiche(s) modifiée(s)`);
  closeModal("modal-modif-masse-vendus");
  _selection.clear();
};

document.addEventListener("click", (e) => {
  const row = e.target.closest("[data-client]");
  if (row) {
    document.getElementById("f-recherche").value = row.dataset.client;
    rendre();
    document.getElementById("vendus-body").scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

document.addEventListener("click", async (e) => {
  const factureBtn = e.target.closest("[data-facture]");
  if (factureBtn) {
    const v = _vendus.find((x) => x.id === factureBtn.dataset.facture);
    if (!v) return;
    const corps = `
      <table>
        <tbody>
          <tr><td style="font-weight:700;width:35%;">Châssis</td><td>${esc(v.chassis) || "—"}</td></tr>
          <tr><td style="font-weight:700;">Marque / Modèle</td><td>${esc(v.marque) || "—"} ${esc(v.modele) || "—"}</td></tr>
          <tr><td style="font-weight:700;">Showroom</td><td>${esc(v.destination) || "—"}</td></tr>
          <tr><td style="font-weight:700;">Prix de vente</td><td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " FCFA" : "—"}</td></tr>
          <tr><td style="font-weight:700;">Client</td><td>${esc(v.client?.nom) || "—"}</td></tr>
          <tr><td style="font-weight:700;">Contact client</td><td>${esc(v.client?.contact) || "—"}</td></tr>
          <tr><td style="font-weight:700;">Date de vente</td><td>${esc(dateVenteDe(v)) || "—"}</td></tr>
          <tr><td style="font-weight:700;">Mode de paiement</td><td>${esc(v.client?.modePaiement) || "—"}</td></tr>
          <tr><td style="font-weight:700;">Vendeur / agent</td><td>${esc(v.client?.vendeur) || "—"}</td></tr>
        </tbody>
      </table>`;
    document.getElementById("pdf-content").innerHTML = corps;
    printPDF("pdf-content", `Facture — ${chassis6(v.chassis)}`);
    return;
  }

  const annulerBtn = e.target.closest("[data-annuler]");
  if (annulerBtn) {
    const v = _vendus.find((x) => x.id === annulerBtn.dataset.annuler);
    if (!v) return;
    if (!confirm(`Annuler la vente de "${v.marque || ""} ${v.modele || ""}" (${chassis6(v.chassis)}) ? Le véhicule repartira dans le Stock Showroom.`)) return;
    await annulerVente(v);
    toast("Vente annulée — véhicule remis en Stock Showroom");
    return;
  }

  const supprBtn = e.target.closest("[data-supprimer]");
  if (supprBtn) {
    const v = _vendus.find((x) => x.id === supprBtn.dataset.supprimer);
    if (!v) return;
    if (!confirm(`Supprimer définitivement la fiche de vente de "${v.marque || ""} ${v.modele || ""}" (${chassis6(v.chassis)}) ? Cette action est irréversible.`)) return;
    await supprimerArchive(v.id);
    toast("Fiche supprimée");
  }
});

["f-recherche", "f-marque", "f-ville", "f-periode", "f-annee"].forEach((id) => {
  document.getElementById(id).addEventListener("input", rendre);
  document.getElementById(id).addEventListener("change", rendre);
});

window.exporterCSV = function () {
  const liste = filtres();
  if (liste.length === 0) { toast("Aucun véhicule à exporter", "tinfo"); return; }
  const headers = ["Châssis", "Marque", "Modèle", "Ville", "Client", "Contact", "Date entrée", "Date de vente", "Prix"];
  const rows = liste.map((v) => [v.chassis, v.marque, v.modele, v.destination, v.client?.nom, v.client?.contact, v.dateEntree, dateVenteDe(v), v.prix]);
  exportCSV(`vehicules_vendus_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
};

window.exporterPDF = function () {
  const liste = filtres();
  const rows = liste.map((v) => `<tr><td>${esc(chassis6(v.chassis))}</td><td>${esc(v.marque) || "—"}</td><td>${esc(v.modele) || "—"}</td><td>${esc(v.client?.nom) || "—"}</td><td>${esc(v.dateEntree) || "—"}</td><td>${esc(dateVenteDe(v)) || "—"}</td><td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td></tr>`).join("");
  document.getElementById("pdf-content").innerHTML = `<table><thead><tr><th>Châssis</th><th>Marque</th><th>Modèle</th><th>Client</th><th>Entrée</th><th>Vente</th><th>Prix</th></tr></thead><tbody>${rows}</tbody></table>`;
  printPDF("pdf-content", "Véhicules Vendus");
};

window.corrigerFichesMalClassees = async function () {
  if (!confirm("Vérifier toutes les fiches de « Véhicules vendus » et renvoyer automatiquement vers le Stock Showroom celles qui n'ont pas d'informations de vente complètes (client, prix, date) ? Utile pour corriger les véhicules envoyés en showroom avant la mise à jour.")) return;
  const n = await corrigerFichesMalClasseesVendus();
  if (n === 0) toast("Aucune fiche à corriger — tout est correct");
  else toast(`${n} fiche(s) renvoyée(s) vers le Stock Showroom`);
};

document.addEventListener("DOMContentLoaded", () => {
  ecouterArchives((liste) => { _vendus = liste; rendre(); });
});
