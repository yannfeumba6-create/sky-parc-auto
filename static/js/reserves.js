import {
  ecouterVehicules, ecouterShowroom, majVehicule, majVehiculeShowroom,
  envoyerVersShowroom, vendreVehicule, chassis6, marqueCorrespond, modeleCorrespond, MODELES_PAR_MARQUE,
} from "./data.js";

let _vehicules = [];
let _showroom = [];
let _liste = []; // fusion, avec un champ "_origine": "parc" | "showroom"

function rafraichirFiltreModeles() {
  const marque = document.getElementById("f-marque").value;
  const modeles = marque ? (MODELES_PAR_MARQUE[marque] || []) : Object.values(MODELES_PAR_MARQUE).flat();
  const sel = document.getElementById("f-modele");
  const valActuelle = sel.value;
  sel.innerHTML = `<option value="">Tous</option>` + modeles.map((m) => `<option value="${m}">${m}</option>`).join("");
  if (modeles.includes(valActuelle)) sel.value = valActuelle;
}

function fusionner() {
  _liste = [
    ..._vehicules.filter((v) => v.statut === "reserve").map((v) => ({ ...v, _origine: "parc" })),
    ..._showroom.filter((v) => v.statut === "reserve").map((v) => ({ ...v, _origine: "showroom" })),
  ];
  rendre();
}

function filtres() {
  const recherche = document.getElementById("f-recherche").value.trim().toLowerCase();
  const marque = document.getElementById("f-marque").value;
  const modele = document.getElementById("f-modele").value;
  return _liste.filter((v) => {
    if (marque && !marqueCorrespond(v.marque, marque)) return false;
    if (modele && !modeleCorrespond(v.marque, v.modele, modele)) return false;
    if (recherche) {
      const cible = `${v.chassis || ""} ${v.modele || ""}`.toLowerCase();
      if (!cible.includes(recherche)) return false;
    }
    return true;
  });
}

function rendre() {
  const liste = filtres();
  document.getElementById("qte-reserves").textContent = liste.length;
  const tbody = document.getElementById("reserves-body");
  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><strong>Aucun véhicule réservé</strong>Ajuste les filtres, ou réserve un véhicule depuis le Stock véhicule parc ou le Stock Showroom.</td></tr>`;
    return;
  }
  tbody.innerHTML = liste.map((v) => `<tr>
    <td class="plate">${esc(chassis6(v.chassis))}</td>
    <td>${esc(v.marque) || "—"}</td>
    <td>${esc(v.modele) || "—"}</td>
    <td>${v._origine === "parc" ? "Parc Broli" : esc((v.destination || "Showroom").replace("Showroom ", "Showroom "))}</td>
    <td>${esc(v.motifReservation) || "—"}</td>
    <td>${esc(v.dateReservation) || "—"}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" data-action="restituer" data-id="${v.id}" data-origine="${v._origine}">Restituer</button>
      ${v._origine === "parc" ? `<button class="btn btn-red btn-sm" data-action="sortir" data-id="${v.id}">Sortir vers showroom</button>` : ""}
      ${v._origine === "showroom" ? `<button class="btn btn-red btn-sm" data-action="vendre" data-id="${v.id}">Vendre</button>` : ""}
    </td>
  </tr>`).join("");
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id, origine } = btn.dataset;
  const v = _liste.find((x) => x.id === id);
  if (!v) return;

  if (action === "restituer") {
    if (!confirm(`Restituer "${v.marque || ""} ${v.modele || ""}" (${chassis6(v.chassis)}) au stock ${origine === "parc" ? "du Parc" : "du Showroom"} ?`)) return;
    if (origine === "parc") await majVehicule(id, { statut: "stock" });
    else await majVehiculeShowroom(id, { statut: "stock" });
    toast("Réservation levée — véhicule remis en stock");
  }

  if (action === "sortir") {
    ouvrirModalSortieReserve(id);
  }

  if (action === "vendre") {
    ouvrirModalVenteReserve(id);
  }
});

// ---------------------------------------------------------------
// Sortie vers showroom (origine Parc)
// ---------------------------------------------------------------

let _sortieCible = null;

function ouvrirModalSortieReserve(id) {
  _sortieCible = id;
  document.getElementById("sr-dateSortie").value = new Date().toISOString().slice(0, 10);
  document.getElementById("sr-destination").value = "";
  document.getElementById("sr-chauffeur").value = "";
  openModal("modal-sortie-reserve");
}

window.confirmerSortieReserve = async function () {
  const dateSortie = document.getElementById("sr-dateSortie").value;
  const destination = document.getElementById("sr-destination").value;
  const chauffeur = document.getElementById("sr-chauffeur").value.trim();
  if (!dateSortie) { toast("La date de sortie est obligatoire", "terr"); return; }
  if (!destination) { toast("La destination est obligatoire", "terr"); return; }
  const v = _liste.find((x) => x.id === _sortieCible);
  if (!v) return;
  await envoyerVersShowroom(v, { dateSortie, destination, chauffeur });
  toast("Véhicule envoyé vers le Showroom (toujours réservé)");
  closeModal("modal-sortie-reserve");
  _sortieCible = null;
};

// ---------------------------------------------------------------
// Vente (origine Showroom)
// ---------------------------------------------------------------

let _venteCible = null;

function ouvrirModalVenteReserve(id) {
  const v = _liste.find((x) => x.id === id);
  if (!v) return;
  _venteCible = id;
  document.getElementById("vr-clientNom").value = "";
  document.getElementById("vr-clientContact").value = "";
  document.getElementById("vr-dateVente").value = new Date().toISOString().slice(0, 10);
  document.getElementById("vr-prix").value = v.prix || "";
  document.getElementById("vr-modePaiement").value = "";
  document.getElementById("vr-vendeur").value = "";
  openModal("modal-vente-reserve");
}

window.confirmerVenteReserve = async function () {
  const clientNom = document.getElementById("vr-clientNom").value.trim();
  const dateVente = document.getElementById("vr-dateVente").value;
  const prix = document.getElementById("vr-prix").value;
  if (!clientNom) { toast("Le nom du client est obligatoire", "terr"); return; }
  if (!dateVente) { toast("La date de vente est obligatoire", "terr"); return; }
  const v = _liste.find((x) => x.id === _venteCible);
  if (!v) return;

  await vendreVehicule(v, {
    client: {
      nom: clientNom,
      contact: document.getElementById("vr-clientContact").value.trim(),
      dateAchat: dateVente,
      modePaiement: document.getElementById("vr-modePaiement").value.trim(),
      vendeur: document.getElementById("vr-vendeur").value.trim(),
    },
    prix: prix ? Number(prix) : null,
    dateVente,
  });
  toast("Véhicule vendu — visible dans Véhicules vendus");
  closeModal("modal-vente-reserve");
  _venteCible = null;
};

["f-recherche", "f-marque", "f-modele"].forEach((id) => {
  document.getElementById(id).addEventListener("input", rendre);
  document.getElementById(id).addEventListener("change", rendre);
});
document.getElementById("f-marque").addEventListener("change", rafraichirFiltreModeles);

document.addEventListener("DOMContentLoaded", () => {
  rafraichirFiltreModeles();
  ecouterVehicules((liste) => { _vehicules = liste; fusionner(); });
  ecouterShowroom((liste) => { _showroom = liste; fusionner(); });
});
