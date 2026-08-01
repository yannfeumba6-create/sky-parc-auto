import { ecouterVehicules, ecouterHistorique, MODELES_PAR_MARQUE } from "./data.js";

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const GROUPES = ["flux", "dommages", "top10", "ventes"];

let _vehicules = [];
let _historique = [];
const _charts = {}; // { flux: ChartInstance, ventes: ChartInstance, dommages: ChartInstance }

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
    (!marque || v.marque === marque) &&
    (!modele || v.modele === modele) &&
    (!emplacement || v.emplacement === emplacement)
  );
}

// ---------------------------------------------------------------
// KPI
// ---------------------------------------------------------------

function rendreKpis() {
  document.getElementById("kpi-parc").textContent = _vehicules.filter((v) => v.statut === "stock").length;
  document.getElementById("kpi-reserve").textContent = _vehicules.filter((v) => v.statut === "reserve").length;
  document.getElementById("kpi-vendu").textContent = _vehicules.filter((v) => v.statut === "vendu").length;
  document.getElementById("kpi-endommage").textContent = _vehicules.filter((v) => v.statut === "endommage").length;
  const valeur = _vehicules.filter((v) => v.statut === "stock").reduce((s, v) => s + (Number(v.prix) || 0), 0);
  document.getElementById("kpi-valeur-stock").textContent = valeur.toLocaleString("fr-FR") + " F";
}

// ---------------------------------------------------------------
// Évolution entrées / sorties
// ---------------------------------------------------------------

function rendreFlux() {
  const liste = filtrer(_vehicules, "flux");
  const chassisFiltres = new Set(liste.map((v) => v.chassis));
  const now = new Date();
  const entrees = new Array(12).fill(0);
  const sorties = new Array(12).fill(0);
  const labels = [];
  for (let i = 11; i >= 0; i--) labels.push(MOIS[new Date(now.getFullYear(), now.getMonth() - i, 1).getMonth()]);

  _historique.filter((h) => chassisFiltres.has(h.chassis)).forEach((h) => {
    const d = toDate(h.horodatage);
    if (!d) return;
    const diffMois = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (diffMois < 0 || diffMois > 11) return;
    const idx = 11 - diffMois;
    if (h.action === "Entrée en stock") entrees[idx]++;
    if (h.action === "Sortie du parc" || h.statut === "vendu") sorties[idx]++;
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
        { label: "Sorties", data: sorties, backgroundColor: "rgba(192,57,43,.75)", borderRadius: 5 },
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
  const data = marques.map((m) => liste.filter((v) => v.marque === m).length);
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
// Top 10 clients
// ---------------------------------------------------------------

function rendreTop10() {
  const liste = filtrer(_vehicules, "top10");
  const parClient = {};
  liste.filter((v) => v.statut === "vendu" && v.client && v.client.nom).forEach((v) => {
    const nom = v.client.nom.trim();
    parClient[nom] = (parClient[nom] || 0) + 1;
  });
  const top10 = Object.entries(parClient).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const el = document.getElementById("top10-list");
  if (top10.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:20px;color:var(--muted);text-align:center;">Aucune vente enregistrée pour l'instant</div>`;
  } else {
    el.innerHTML = top10.map(([nom, n], i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px;">
        <span><b style="font-family:var(--font-title);color:var(--red);margin-right:8px;">${i + 1}</b>${nom}</span>
        <span class="tag">${n} véhicule${n > 1 ? "s" : ""}</span>
      </div>`).join("");
  }
}

// ---------------------------------------------------------------
// Évolution des ventes
// ---------------------------------------------------------------

function rendreVentes() {
  const liste = filtrer(_vehicules, "ventes");
  const now = new Date();
  const ventesParMois = new Array(12).fill(0);
  liste.filter((v) => v.statut === "vendu" && v.client && v.client.dateAchat).forEach((v) => {
    const d = toDate(v.client.dateAchat);
    if (d && d.getFullYear() === now.getFullYear()) ventesParMois[d.getMonth()]++;
  });
  const tc = couleurTexte();
  const ctx = document.getElementById("chart-ventes").getContext("2d");
  if (_charts.ventes) _charts.ventes.destroy();
  _charts.ventes = new Chart(ctx, {
    type: "line",
    data: {
      labels: MOIS,
      datasets: [{
        label: "Ventes", data: ventesParMois,
        borderColor: "#c0392b", backgroundColor: "rgba(192,57,43,.15)",
        fill: true, tension: 0.35, pointRadius: 3,
      }],
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

function rendreTout() {
  rendreKpis();
  rendreFlux();
  rendreDommages();
  rendreTop10();
  rendreVentes();
  rendreTypes();
  rendreDelai();
}
window.updateCharts = rendreTout;

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
// Délai moyen de vente par marque
// ---------------------------------------------------------------

function rendreDelai() {
  const marques = window.MARQUES || [];
  const moyennes = marques.map((m) => {
    const vendus = _vehicules.filter((v) => v.marque === m && v.statut === "vendu" && v.dateEntree && v.client?.dateAchat);
    if (vendus.length === 0) return 0;
    const total = vendus.reduce((s, v) => {
      const entree = toDate(v.dateEntree);
      const achat = toDate(v.client.dateAchat);
      if (!entree || !achat) return s;
      return s + Math.max(0, Math.round((achat - entree) / (1000 * 60 * 60 * 24)));
    }, 0);
    return Math.round(total / vendus.length);
  });
  const tc = couleurTexte();
  const ctx = document.getElementById("chart-delai").getContext("2d");
  if (_charts.delai) _charts.delai.destroy();
  _charts.delai = new Chart(ctx, {
    type: "bar",
    data: { labels: marques, datasets: [{ label: "Jours", data: moyennes, backgroundColor: "rgba(41,128,185,.75)", borderRadius: 5 }] },
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
    return;
  }

  if (prefix === "top10" && window.html2canvas) {
    const el = document.getElementById("top10-list");
    window.html2canvas(el, { backgroundColor: document.documentElement.getAttribute("data-theme") === "dark" ? "#1b1e23" : "#ffffff" }).then((canvas) => {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `top10_clients_${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast("Image téléchargée");
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  peuplerFiltres();
  ecouterVehicules((liste) => { _vehicules = liste; rendreTout(); });
  ecouterHistorique((liste) => { _historique = liste; rendreTout(); });
});
