import { ecouterVehicules, ecouterShowroom, ecouterHistorique, ecouterArchives, MODELES_PAR_MARQUE, marqueCorrespond, modeleCorrespond } from "./data.js";

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const GROUPES_EMPLACEMENT = ["flux", "dommages"]; // filtres marque / modèle / emplacement
const GROUPES_VILLE = ["ventes", "top"]; // filtres marque / modèle / ville (showroom)

let _vehicules = [];
let _showroom = [];
let _historique = [];
let _archives = []; // = véhicules VENDUS
const _charts = {}; // { flux, ventes, dommages, types }

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
// Filtres — un jeu par graphique (marque / modèle + emplacement OU ville)
// ---------------------------------------------------------------

function peuplerFiltres() {
  const marques = window.MARQUES || [];
  const emplacements = window.EMPLACEMENTS || [];
  const villes = ["Showroom Douala", "Showroom Yaoundé", "Showroom Bafoussam"];

  GROUPES_EMPLACEMENT.forEach((prefix) => {
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

  GROUPES_VILLE.forEach((prefix) => {
    const selMarque = document.getElementById(`${prefix}-marque`);
    const selModele = document.getElementById(`${prefix}-modele`);
    const selVille = document.getElementById(`${prefix}-ville`);
    selMarque.innerHTML = `<option value="">Toutes marques</option>` + marques.map((m) => `<option value="${m}">${m}</option>`).join("");
    selVille.innerHTML = `<option value="">Toutes villes</option>` + villes.map((v) => `<option value="${v}">${v.replace("Showroom ", "")}</option>`).join("");
    rafraichirModeles(prefix);
    selMarque.addEventListener("change", () => { rafraichirModeles(prefix); rendreTout(); });
    selModele.addEventListener("change", rendreTout);
    selVille.addEventListener("change", rendreTout);
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

// Comme filtrer(), mais avec "ville" (destination showroom) plutôt
// qu'"emplacement" — à utiliser pour tout ce qui concerne les ventes
// (les ventes se font toujours depuis un showroom, jamais du parc).
function filtrerVille(liste, prefix) {
  const marque = document.getElementById(`${prefix}-marque`).value;
  const modele = document.getElementById(`${prefix}-modele`).value;
  const ville = document.getElementById(`${prefix}-ville`).value;
  return liste.filter((v) =>
    (!marque || marqueCorrespond(v.marque, marque)) &&
    (!modele || modeleCorrespond(v.marque, v.modele, modele)) &&
    (!ville || v.destination === ville)
  );
}

// ---------------------------------------------------------------
// KPI — se mettent à jour automatiquement car alimentés par les
// écoutes temps réel (onSnapshot) de vehicules / showroom / archives.
// ---------------------------------------------------------------

function rendreKpis() {
  document.getElementById("kpi-parc").textContent = _vehicules.filter((v) => v.statut === "stock" || v.statut === "reserve").length;
  document.getElementById("kpi-showroom").textContent = _showroom.length;
  document.getElementById("kpi-showroom-douala").textContent = _showroom.filter((v) => v.destination === "Showroom Douala").length;
  document.getElementById("kpi-showroom-yaounde").textContent = _showroom.filter((v) => v.destination === "Showroom Yaoundé").length;
  document.getElementById("kpi-showroom-bafoussam").textContent = _showroom.filter((v) => v.destination === "Showroom Bafoussam").length;
  document.getElementById("kpi-reserve").textContent =
    _vehicules.filter((v) => v.statut === "reserve").length + _showroom.filter((v) => v.statut === "reserve").length;
  document.getElementById("kpi-endommage").textContent = _vehicules.filter((v) => ["endommage", "prise_en_charge", "repare"].includes(v.statut)).length;
  document.getElementById("kpi-vendu").textContent = _archives.length;
  const valeur =
    _vehicules.filter((v) => v.statut !== "endommage").reduce((s, v) => s + (Number(v.prix) || 0), 0) +
    _showroom.filter((v) => v.statut !== "endommage").reduce((s, v) => s + (Number(v.prix) || 0), 0);
  document.getElementById("kpi-valeur-stock").textContent = valeur.toLocaleString("fr-FR") + " F";
}

// ---------------------------------------------------------------
// Évolution entrées / sorties du parc
// ---------------------------------------------------------------

// Le nombre d'entrées/sorties par mois est calculé à partir des DATES
// SAISIES sur les fiches (dateEntree) et des dates de sortie vers le
// showroom (dateSortie, saisie obligatoirement à la sortie du parc),
// pas de la date réelle à laquelle l'action a été enregistrée dans l'appli.
function rendreFlux() {
  const liste = filtrer(_vehicules, "flux");
  const enShowroom = filtrer(_showroom, "flux");
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
  enShowroom.forEach((v) => {
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
        { label: "Entrées au parc", data: entrees, backgroundColor: "rgba(39,174,96,.75)", borderRadius: 5 },
        { label: "Sorties vers showroom", data: sorties, backgroundColor: "rgba(192,57,43,.75)", borderRadius: 5 },
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
// Évolution des ventes sur l'année
// ---------------------------------------------------------------

function dateVenteDe(v) {
  return v.dateVente || v.client?.dateAchat || null;
}

function rendreVentes() {
  const liste = filtrerVille(_archives, "ventes");
  const now = new Date();
  const ventesParMois = new Array(12).fill(0);
  liste.forEach((v) => {
    const d = toDate(dateVenteDe(v));
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

// ---------------------------------------------------------------
// Classement des meilleurs clients (sur l'année en cours)
// ---------------------------------------------------------------

function rendreTopClients() {
  const now = new Date();
  const liste = filtrerVille(_archives, "top").filter((v) => {
    const d = toDate(dateVenteDe(v));
    return d && d.getFullYear() === now.getFullYear();
  });
  const parClient = {};
  liste.filter((v) => v.client && v.client.nom).forEach((v) => {
    const nom = v.client.nom.trim();
    if (!parClient[nom]) parClient[nom] = { n: 0, total: 0, contact: v.client.contact || "" };
    parClient[nom].n++;
    parClient[nom].total += Number(v.prix) || 0;
  });
  const classement = Object.entries(parClient).sort((a, b) => b[1].n - a[1].n).slice(0, 10);

  const el = document.getElementById("top-clients-list");
  if (classement.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:20px;color:var(--muted);text-align:center;">Aucune vente enregistrée cette année (avec les filtres actuels)</div>`;
    return;
  }
  el.innerHTML = classement.map(([nom, info], i) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px;">
      <span><b style="font-family:var(--font-title);color:var(--red);margin-right:8px;">${i + 1}</b>${esc(nom)}${info.contact ? ` — ${esc(info.contact)}` : ""}</span>
      <span class="tag badge-vendu">${info.n} véhicule${info.n > 1 ? "s" : ""} · ${info.total.toLocaleString("fr-FR")} F</span>
    </div>`).join("");
}

// ---------------------------------------------------------------
// Véhicules endommagés par marque
// ---------------------------------------------------------------

function rendreDommages() {
  const liste = filtrer(_vehicules, "dommages").filter((v) => ["endommage", "prise_en_charge", "repare"].includes(v.statut));
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
    return;
  }

  if (prefix === "top" && window.html2canvas) {
    const el = document.getElementById("top-clients-list");
    window.html2canvas(el, { backgroundColor: document.documentElement.getAttribute("data-theme") === "dark" ? "#1b1e23" : "#ffffff" }).then((canvas) => {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `top_clients_${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast("Image téléchargée");
    });
  }
});

function rendreTout() {
  rendreKpis();
  rendreFlux();
  rendreVentes();
  rendreTopClients();
  rendreDommages();
  rendreTypes();
}
window.updateCharts = rendreTout;

document.addEventListener("DOMContentLoaded", () => {
  peuplerFiltres();
  ecouterVehicules((liste) => { _vehicules = liste; rendreTout(); });
  ecouterShowroom((liste) => { _showroom = liste; rendreTout(); });
  ecouterHistorique((liste) => { _historique = liste; rendreTout(); });
  ecouterArchives((liste) => { _archives = liste; rendreTout(); });
});
