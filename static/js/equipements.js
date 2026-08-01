import {
  db, equipementsRef,
  doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy,
} from "./firebase-config.js";

let _equipements = [];

async function charger() {
  const q = query(equipementsRef, orderBy("nom"));
  const snap = await getDocs(q);
  _equipements = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rendre();
}

function rendre() {
  const tbody = document.getElementById("equip-body");
  if (_equipements.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><strong>Aucun équipement en stock</strong>Ajoute un équipement ou charge les équipements de base.</td></tr>`;
    return;
  }
  tbody.innerHTML = _equipements.map((e) => {
    const ppc = e.piecesParCarton || 1;
    const cartons = Math.floor((e.stockPieces || 0) / ppc);
    const reste = (e.stockPieces || 0) % ppc;
    return `
      <tr>
        <td><b>${e.nom}</b></td>
        <td>${ppc > 1 ? `Carton de ${ppc}` : "À l'unité"}</td>
        <td>${cartons}</td>
        <td>${reste}</td>
        <td>${e.stockPieces || 0}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost btn-sm" data-action="ajouter" data-id="${e.id}">+ Ajouter</button>
          <button class="btn btn-ghost btn-sm" data-action="retirer" data-id="${e.id}">− Utiliser</button>
          <button class="btn btn-ghost btn-sm" data-action="supprimer" data-id="${e.id}">Supprimer</button>
        </td>
      </tr>`;
  }).join("");
}

// ---------------------------------------------------------------
// Formulaire Nouvel équipement
// ---------------------------------------------------------------

window.onNomEquipChange = function () {
  const val = document.getElementById("ne-nom-select").value;
  document.getElementById("ne-nom-libre-groupe").style.display = val === "__autre__" ? "block" : "none";
};

window.onConditionnementChange = function () {
  const carton = document.getElementById("ne-conditionnement").value === "carton";
  document.getElementById("ne-parcarton-groupe").style.display = carton ? "block" : "none";
  document.getElementById("ne-cartons-groupe").style.display = carton ? "block" : "none";
  if (!carton) document.getElementById("ne-cartons").value = 0;
};

window.creerEquipement = async function () {
  const selectVal = document.getElementById("ne-nom-select").value;
  const nom = selectVal === "__autre__" ? document.getElementById("ne-nom-libre").value.trim() : selectVal;
  if (!nom) { toast("Le nom est requis", "terr"); return; }

  const carton = document.getElementById("ne-conditionnement").value === "carton";
  const parCarton = carton ? (Number(document.getElementById("ne-parcarton").value) || 1) : 1;
  const cartons = carton ? (Number(document.getElementById("ne-cartons").value) || 0) : 0;
  const unites = Number(document.getElementById("ne-unites").value) || 0;
  const stockPieces = cartons * parCarton + unites;

  await addDoc(equipementsRef, { nom, piecesParCarton: parCarton, stockPieces });
  toast("Équipement créé");
  closeModal("modal-equip");
  document.getElementById("ne-nom-libre").value = "";
  document.getElementById("ne-cartons").value = 0;
  document.getElementById("ne-unites").value = 0;
  charger();
};

window.chargerBase = async function () {
  if (!confirm("Ajouter les équipements de base (Extincteur, Tapis, Chasuble, Cric, Caisse à outils) avec un stock à 0 ?")) return;
  for (const e of window.EQUIPEMENTS_BASE || []) {
    const existe = _equipements.some((x) => x.nom.toLowerCase() === e.nom.toLowerCase());
    if (!existe) await addDoc(equipementsRef, { nom: e.nom, piecesParCarton: e.piecesParCarton, stockPieces: 0 });
  }
  toast("Équipements de base ajoutés");
  charger();
};

// ---------------------------------------------------------------
// Ajouter / retirer du stock — en cartons + unités isolées
// ---------------------------------------------------------------

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  const equip = _equipements.find((x) => x.id === id);
  if (!equip) return;

  if (action === "ajouter" || action === "retirer") {
    document.getElementById("se-id").value = id;
    document.getElementById("se-sens").value = action;
    document.getElementById("se-cartons").value = 0;
    document.getElementById("se-unites").value = 0;
    document.getElementById("modal-stock-equip-titre").textContent =
      (action === "ajouter" ? "AJOUTER — " : "UTILISER — ") + equip.nom;
    openModal("modal-stock-equip");
  }

  if (action === "supprimer") {
    if (!confirm(`Supprimer "${equip.nom}" du stock d'équipements ?`)) return;
    deleteDoc(doc(db, "equipements_stock", id)).then(() => { toast("Équipement supprimé"); charger(); });
  }
});

window.validerMouvementStock = async function () {
  const id = document.getElementById("se-id").value;
  const sens = document.getElementById("se-sens").value;
  const equip = _equipements.find((x) => x.id === id);
  if (!equip) return;

  const ppc = equip.piecesParCarton || 1;
  const cartons = Number(document.getElementById("se-cartons").value) || 0;
  const unites = Number(document.getElementById("se-unites").value) || 0;
  const pieces = cartons * ppc + unites;

  if (pieces <= 0) { toast("Indique une quantité", "terr"); return; }

  const nouveauStock = sens === "ajouter"
    ? (equip.stockPieces || 0) + pieces
    : Math.max(0, (equip.stockPieces || 0) - pieces);

  await updateDoc(doc(db, "equipements_stock", id), { stockPieces: nouveauStock });
  toast("Stock mis à jour");
  closeModal("modal-stock-equip");
  charger();
};

document.addEventListener("DOMContentLoaded", charger);
