import { ecouterVehicules, majVehicule, chassis6 } from "./data.js";

let _tous = [];

window.switchTab = function (tab) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.getElementById("pane-reserve").classList.toggle("active", tab === "reserve");
  document.getElementById("pane-endommage").classList.toggle("active", tab === "endommage");
};

function filtreCommun(liste) {
  const recherche = document.getElementById("f-recherche").value.trim().toLowerCase();
  const marque = document.getElementById("f-marque").value;
  const emplacement = document.getElementById("f-emplacement").value;
  return liste.filter((v) => {
    if (marque && v.marque !== marque) return false;
    if (emplacement && v.emplacement !== emplacement) return false;
    if (recherche) {
      const cible = `${v.chassis || ""} ${v.modele || ""}`.toLowerCase();
      if (!cible.includes(recherche)) return false;
    }
    return true;
  });
}

function rendre() {
  const reserves = filtreCommun(_tous.filter((v) => v.statut === "reserve"));
  const endommages = filtreCommun(_tous.filter((v) => v.statut === "endommage"));

  const rBody = document.getElementById("reserve-body");
  rBody.innerHTML = reserves.length === 0
    ? `<tr><td colspan="7" class="empty-state"><strong>Aucun véhicule réservé</strong></td></tr>`
    : reserves.map((v) => `
      <tr>
        <td class="plate">${chassis6(v.chassis)}</td><td>${v.marque || "—"}</td><td>${v.modele || "—"}</td>
        <td>${v.emplacement || "—"}</td><td>${v.prix ? Number(v.prix).toLocaleString("fr-FR") + " F" : "—"}</td>
        <td>${v.dateEntree || "—"}</td>
        <td><button class="btn btn-ghost btn-sm" data-action="remettre-stock" data-id="${v.id}">Remettre en stock</button></td>
      </tr>`).join("");

  const eBody = document.getElementById("endommage-body");
  eBody.innerHTML = endommages.length === 0
    ? `<tr><td colspan="6" class="empty-state"><strong>Aucun véhicule endommagé</strong></td></tr>`
    : endommages.map((v) => `
      <tr>
        <td class="plate">${chassis6(v.chassis)}</td><td>${v.marque || "—"}</td><td>${v.modele || "—"}</td>
        <td>${v.emplacement || "—"}</td><td>${v.piecesEndommagees || "—"}</td>
        <td><button class="btn btn-ghost btn-sm" data-action="remettre-stock" data-id="${v.id}">Remettre en stock</button></td>
      </tr>`).join("");
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action='remettre-stock']");
  if (!btn) return;
  await majVehicule(btn.dataset.id, { statut: "stock" });
  toast("Véhicule remis en stock");
});

["f-recherche", "f-marque", "f-emplacement"].forEach((id) => {
  document.getElementById(id).addEventListener("input", rendre);
  document.getElementById(id).addEventListener("change", rendre);
});

document.addEventListener("DOMContentLoaded", () => {
  ecouterVehicules((liste) => {
    _tous = liste;
    rendre();
  });
});
