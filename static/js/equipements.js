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

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  const equip = _equipements.find((x) => x.id === id);
  if (!equip) return;

  if (action === "ajouter") {
    const val = prompt(`Combien de pièces de "${equip.nom}" ajouter au stock ?\n(1 carton = ${equip.piecesParCarton || 1} pièce(s) — entre directement en pièces)`, equip.piecesParCarton || 1);
    if (val === null) return;
    const n = Number(val);
    if (!n || n <= 0) { toast("Quantité invalide", "terr"); return; }
    await updateDoc(doc(db, "equipements_stock", id), { stockPieces: (equip.stockPieces || 0) + n });
    toast("Stock mis à jour");
    charger();
  }

  if (action === "retirer") {
    const val = prompt(`Combien de pièces de "${equip.nom}" retirer/utiliser ?`, 1);
    if (val === null) return;
    const n = Number(val);
    if (!n || n <= 0) { toast("Quantité invalide", "terr"); return; }
    const nouveauStock = Math.max(0, (equip.stockPieces || 0) - n);
    await updateDoc(doc(db, "equipements_stock", id), { stockPieces: nouveauStock });
    toast("Stock mis à jour");
    charger();
  }

  if (action === "supprimer") {
    if (!confirm(`Supprimer "${equip.nom}" du stock d'équipements ?`)) return;
    await deleteDoc(doc(db, "equipements_stock", id));
    toast("Équipement supprimé");
    charger();
  }
});

window.creerEquipement = async function () {
  const nom = document.getElementById("ne-nom").value.trim();
  const parCarton = Number(document.getElementById("ne-parcarton").value) || 1;
  const stock = Number(document.getElementById("ne-stock").value) || 0;
  if (!nom) { toast("Le nom est requis", "terr"); return; }
  await addDoc(equipementsRef, { nom, piecesParCarton: parCarton, stockPieces: stock });
  toast("Équipement créé");
  closeModal("modal-equip");
  document.getElementById("ne-nom").value = "";
  document.getElementById("ne-parcarton").value = 1;
  document.getElementById("ne-stock").value = 0;
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

document.addEventListener("DOMContentLoaded", charger);
