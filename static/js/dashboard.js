import { ecouterVehicules, ecouterHistorique, ecouterArchives, MODELES_PAR_MARQUE, marqueCorrespond, modeleCorrespond } from "./data.js";

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const GROUPES = ["flux", "dommages"];

let _vehicules = [];
let _historique = [];
let _archives = [];
const _charts = {}; // { flux: ChartInstance, dommages: ChartInstance, types: ChartInstance }

function couleurTexte() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "#ccc" : "#555";
}

function toDate(v) {
  if (!v) return null;
  if (v.toDate) return v.toDate();
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

// ---------------------------------------------------------------
// Filtres (marque / modèle / emplacement) — un jeu par graphique
// ---------------------------------------------------------------

function peuplerFiltres() {
  const marques = window.MARQUES || [];
  const emplacements = window.EMPLACEMENTS || [];

  GROUPES.forEach((prefix) => {
    const selMarque = document.getElementById(`${prefix}-marque`);
    const selModele = document.getElementById(`${prefix}-modele`);
    const selEmpl = document.getElementById(`${prefix}-emplacement`);

    selMarque.innerHTML = `<option value="">Toutes marques</option>` + marques.map((m) => `<option value="${m}">${m}</option>`).join("");
    selEmpl.innerHTML = `<option value="">Tous emplacements</option>` + emplacements.map((e) => `<option value="${e}">${e}</option>`).join("");
    rafraichirModeles(prefix);

    selMarque.addEventListener("change", () => { rafraichirModeles(prefix); rendreTout(); });
    selModele.addEventListener("change", rendreTout);
    selEmpl.addEventListener("change", rendreTout);
  });
}

function rafraichirModeles(prefix) {
  const marque = document.getElementById(`${prefix}-marque`).value;
  const modeles = marque ? (MODELES_PAR_MARQUE[marque] || []) : Object.values(MODELES_PAR_MARQUE).flat();
  const sel = document.getElementById(`${prefix}-modele`);
  const valActuelle = sel.value;
  sel.innerHTML = `<option value="">Tous modèles</option>` + modeles.map((m) => `<option value="${m}">${m}</option>`).join("");
  if (modeles.includes(valActuelle)) sel.value = valActuelle;
}

function filtrer(liste, prefix) {
  const marque = document.getElementById(`${prefix}-marque`).value;
  const modele = document.getElementById(`${prefix}-modele`).value;
  const emplacement = document.getElementById(`${prefix}-emplacement`).value;
  return liste.filter((v) =>
    (!marque || marqueCorrespond(v.marque, marque)) &&
    (!modele || modeleCorrespond(v.marque, v.modele, modele)) &&
    (!emplacement || v.emplacement === emplacement)
  );
}

// ---------------------------------------------------------------
// KPI
// ---------------------------------------------------------------

function rendreKpis() {
  document.getElementById("kpi-parc").textContent = _vehicules.filter((v) => v.statut === "stock").length;
  document.getElementById("kpi-endommage").textContent = _vehicules.filter((v) => v.statut === "endommage").length;
  const valeur = _vehicules.filter((v) => v.statut === "stock").reduce((s, v) => s + (Number(v.prix) || 0), 0);
  document.getElementById("kpi-valeur-stock").textContent = valeur.toLocaleString("fr-FR") + " F";
}

// ---------------------------------------------------------------
// Évolution entrées / sorties
// ---------------------------------------------------------------

// Le nombre d'entrées/sorties par mois est calculé à partir des DATES
// SAISIES sur les fiches (dateEntree) et des dates de sortie du parc
// (dateSortie, saisie obligatoirement lors de la sortie d'un véhicule),
// pas de la date réelle à laquelle l'action a été enregistrée dans l'appli.
function rendreFlux() {
  const liste = filtrer(_vehicules, "flux");
  const archives = filtrer(_archives, "flux");
  const now = new Date();
  const entrees = new Array(12).fill(0);
  const sorties = new Array(12).fill(0);
  const labels = [];
  for (let i = 11; i >= 0; i--) labels.push(MOIS[new Date(now.getFullYear(), now.getMonth() - i, 1).getMonth()]);

  const indexMois = (dateStr) => {
    const d = toDate(dateStr);
    if (!d) return -1;
    const diffMois = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    return (diffMois < 0 || diffMois > 11) ? -1 : 11 - diffMois;
  };

  liste.forEach((v) => {
    const idxEntree = indexMois(v.dateEntree);
    if (idxEntree !== -1) entrees[idxEntree]++;
  });
  archives.forEach((v) => {
    const idxSortie = indexMois(v.dateSortie);
    if (idxSortie !== -1) sorties[idxSortie]++;
  });

  const tc = couleurTexte();
  const ctx = document.getElementById("chart-flux").getContext("2d");
  if (_charts.flux) _charts.flux.destroy();
  _charts.flux = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Entrées", data: entrees, backgroundColor: "rgba(39,174,96,.75)", borderRadius: 5 },
        { label: "Sorties du parc", data: sorties, backgroundColor: "rgba(192,57,43,.75)", borderRadius: 5 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: tc, font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: tc, font: { size: 9 } } },
        y: { ticks: { color: tc, font: { size: 9 }, precision: 0 }, beginAtZero: true },
      },
    },
  });
}

// ---------------------------------------------------------------
// Véhicules endommagés par marque
// ---------------------------------------------------------------

function rendreDommages() {
  const liste = filtrer(_vehicules, "dommages").filter((v) => v.statut === "endommage");
  const marques = window.MARQUES || [];
  const data = marques.map((m) => liste.filter((v) => marqueCorrespond(v.marque, m)).length);
  const tc = couleurTexte();
  const ctx = document.getElementById("chart-dommages").getContext("2d");
  if (_charts.dommages) _charts.dommages.destroy();
  _charts.dommages = new Chart(ctx, {
    type: "bar",
    data: {
      labels: marques,
      datasets: [{ label: "Véhicules endommagés", data, backgroundColor: "rgba(192,57,43,.75)", borderRadius: 5 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: tc, font: { size: 9 } } },
        y: { ticks: { color: tc, font: { size: 9 }, precision: 0 }, beginAtZero: true },
      },
    },
  });
}

// ---------------------------------------------------------------
// Répartition du parc par type
// ---------------------------------------------------------------

function rendreTypes() {
  const types = window.TYPES_VEHICULE || [];
  const data = types.map((t) => _vehicules.filter((v) => v.type === t).length);
  const tc = couleurTexte();
  const couleurs = ["#c0392b", "#2980b9", "#27ae60", "#8e44ad", "#d35400", "#16a085"];
  const ctx = document.getElementById("chart-types").getContext("2d");
  if (_charts.types) _charts.types.destroy();
  _charts.types = new Chart(ctx, {
    type: "pie",
    data: { labels: types, datasets: [{ data, backgroundColor: couleurs }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: tc, font: { size: 9 } } } },
    },
  });
}

// ---------------------------------------------------------------
// Téléchargement des graphiques en image
// ---------------------------------------------------------------

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-download]");
  if (!btn) return;
  const prefix = btn.dataset.download;

  if (_charts[prefix]) {
    const url = _charts[prefix].toBase64Image("image/png", 1);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prefix}_${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast("Graphique téléchargé");
  }
});

function rendreTout() {
  rendreKpis();
  rendreFlux();
  rendreDommages();
  rendreTypes();
}
window.updateCharts = rendreTout;

document.addEventListener("DOMContentLoaded", () => {
  peuplerFiltres();
  ecouterVehicules((liste) => { _vehicules = liste; rendreTout(); });
  ecouterHistorique((liste) => { _historique = liste; rendreTout(); });
  ecouterArchives((liste) => { _archives = liste; rendreTout(); });
});
