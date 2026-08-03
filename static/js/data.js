import {
  db, vehiculesRef, historiqueRef, equipementsRef, arrivagesRef, archivesRef, authPrete,
  doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, writeBatch, query, where, orderBy, onSnapshot, serverTimestamp,
} from "./firebase-config.js";

export const STATUT_LABEL = { stock: "En stock", reserve: "Réservé", vendu: "Vendu", endommage: "Endommagé" };
export const STATUT_BADGE = { stock: "badge-stock", reserve: "badge-reserve", vendu: "badge-vendu", endommage: "badge-endommage" };

// Modèles par marque (repris du projet Sky Gestion magasin) — partagé
// entre le formulaire véhicule, les filtres Stock et le Tableau de bord.
export const MODELES_PAR_MARQUE = {
  "Jetour": ["X90 Plus", "X90 Plus 4x4", "X70 Plus", "Dashing", "Dashing 4x4", "T1", "T2", "G700", "X50 M", "X50 Auto"],
  "JMC": ["Vigus", "Grand Avenue"],
  "Soueast": ["S06", "S07", "S09"],
  "Howo Sinotruk": ["Howo TX380"],
};

// Familles de modèles ayant plusieurs variantes de boîte de vitesses
// (Manuelle / Automatique) que les fournisseurs ne précisent JAMAIS sur
// leurs documents d'arrivage — seule la réception physique du véhicule
// permet de savoir laquelle c'est. Le nom de famille (ex. "X50") est donc
// un modèle valide à l'arrivage, en attendant d'être précisé à l'entrée
// en stock.
export const FAMILLES_MODELES = {
  "Jetour": { "X50": ["X50 M", "X50 Auto"] },
};

function pliAccentsCasse(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Version "compacte" : en plus de la casse et des accents, ignore tous les
// espaces, tirets et autres séparateurs. Nécessaire car un fournisseur peut
// écrire "JETOUR", "Je tour", "jetour " ou "X 50" tout aussi bien que
// "Jetour" / "X50" — seules les lettres et chiffres comptent pour la
// reconnaissance, la police ou la mise en forme du fichier n'a aucune
// importance.
function compact(s) {
  return pliAccentsCasse(s).replace(/[^a-z0-9]/g, "");
}

// Ramène une marque écrite librement (import CSV/PDF/Excel, casse ou
// espacement quelconque — ex. "jetour", "JETOUR ", "Je Tour") vers
// l'orthographe exacte utilisée partout ailleurs dans l'appli. Indispensable
// pour que les filtres (qui comparent une chaîne exacte) retrouvent les
// véhicules importés — sinon la marque s'affiche correctement mais aucun
// filtre ne la retrouve jamais.
export function normaliserMarque(brute) {
  const n = compact(brute);
  const marque = Object.keys(MODELES_PAR_MARQUE).find((m) => compact(m) === n);
  return marque || String(brute || "").trim();
}

// Modèles à proposer pour un ARRIVAGE : les familles à variantes de boîte
// sont réduites à leur nom générique (ex. "X50" au lieu de "X50 M"/"X50
// Auto") puisque la variante n'est pas connue à ce stade.
export function modelesArrivageDisponibles(marque) {
  const tousLesModeles = MODELES_PAR_MARQUE[marque] || [];
  const familles = FAMILLES_MODELES[marque] || {};
  const variantesAExclure = new Set(Object.values(familles).flat());
  const modeles = tousLesModeles.filter((m) => !variantesAExclure.has(m));
  return [...Object.keys(familles), ...modeles];
}

// Un modèle "générique" est le nom de famille sans variante de boîte
// précisée (ex. "X50") — valide pour un arrivage, mais pas pour une fiche
// de Stock qui doit connaître la variante exacte.
export function estModeleGenerique(marque, modele) {
  return !!(FAMILLES_MODELES[marque] && FAMILLES_MODELES[marque][modele]);
}

// Ramène un texte de modèle libre (import) vers l'orthographe reconnue.
// `precis = false` (Arrivages) : une famille à variantes (ex. "X50 Confort",
// "X50 Luxe Auto"…) est ramenée à son nom générique ("X50"), quoi qu'il y
// ait écrit après.
// `precis = true` (Stock) : on tente de deviner la variante exacte à partir
// de mots-clés ("auto", "manuel"…) présents dans le texte ; si aucun indice
// n'est trouvé, le nom générique est renvoyé tel quel (la ligne sera alors
// signalée incomplète dans l'aperçu, à corriger à la main).
export function normaliserModele(marque, modeleBrut, precis) {
  const brut = compact(modeleBrut);
  if (!brut) return String(modeleBrut || "").trim();

  const tousLesModeles = MODELES_PAR_MARQUE[marque] || [];
  const exact = tousLesModeles.find((m) => compact(m) === brut);
  if (exact) return exact;

  const familles = FAMILLES_MODELES[marque] || {};
  for (const [base, variantes] of Object.entries(familles)) {
    const baseKey = compact(base);
    // Le texte contient le nom de base (ex. "x50"), quoi qu'il y ait écrit
    // autour (Confort, Luxury, Premium…) et quel que soit l'espacement.
    if (brut.includes(baseKey)) {
      if (!precis) return base; // Arrivage : on garde le nom générique
      // Stock : on tente de deviner la variante à partir de mots-clés
      // présents dans le texte (ex. "auto", "manuel"…) ; sinon le nom
      // générique est renvoyé tel quel — la ligne sera alors marquée
      // incomplète dans l'aperçu, à préciser à la main.
      const auto = variantes.find((v) => /auto/i.test(v));
      const manuel = variantes.find((v) => /manuel/i.test(v) || /\bm\b/i.test(v));
      if (auto && brut.includes("auto")) return auto;
      if (manuel && (brut.includes("manuel") || /(^|[^a-z0-9])m($|[^a-z0-9])/i.test(pliAccentsCasse(modeleBrut)))) return manuel;
      return base;
    }
  }

  const partiel = tousLesModeles.find((m) => brut.includes(compact(m)));
  if (partiel) return partiel;

  return String(modeleBrut || "").trim();
}

// À utiliser dans TOUS les filtres de l'appli (Arrivages, Stock, Réservés,
// Vendus, Archives, Historique, Tableau de bord) à la place d'une simple
// comparaison "===". Insensible à la casse/espaces/accents, ET regroupe
// automatiquement les variantes d'une même famille (ex. "X50 Luxury", "X50
// Comfort", "X50 M", "X50 Auto"…) sous le même filtre "X50" — y compris pour
// des véhicules déjà enregistrés avant la normalisation à l'import.
export function marqueCorrespond(marqueVehicule, marqueFiltre) {
  if (!marqueFiltre) return true;
  return normaliserMarque(marqueVehicule) === normaliserMarque(marqueFiltre);
}

export function modeleCorrespond(marqueVehicule, modeleVehicule, modeleFiltre) {
  if (!modeleFiltre) return true;
  const marque = normaliserMarque(marqueVehicule);
  return normaliserModele(marque, modeleVehicule, false) === normaliserModele(marque, modeleFiltre, false);
}

export function chassis6(chassis) {
  if (!chassis) return "—";
  const c = String(chassis).trim();
  return c.length > 6 ? c.slice(-6) : c;
}

// Type de véhicule déduit automatiquement de la marque, quand c'est fiable.
// Howo Sinotruk regroupe camions ET camionnettes : impossible à déduire,
// l'utilisateur doit choisir lui-même dans ce cas (retourne null).
export function typeAutomatique(marque) {
  if (marque === "Jetour" || marque === "Soueast") return "SUV";
  if (marque === "JMC") return "Pick-up";
  return null;
}

// Écoute en temps réel (affiche d'abord le cache local instantanément, puis
// se met à jour dès que le serveur répond — beaucoup plus rapide à l'écran
// qu'un chargement à chaque visite de page).
export async function ecouterVehicules(callback) {
  await authPrete;
  const q = query(vehiculesRef, orderBy("dateEntree", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function chargerVehicules() {
  await authPrete;
  const q = query(vehiculesRef, orderBy("dateEntree", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getVehicule(id) {
  await authPrete;
  const snap = await getDoc(doc(db, "vehicules", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Un châssis (VIN) est normalisé en majuscules sans espaces superflus, pour
// que la détection de doublon soit fiable qu'il soit saisi à la main ou
// importé (évite qu'un "vf1..." et un "VF1..." soient vus comme différents).
export function normaliserChassis(c) {
  return (c || "").trim().toUpperCase();
}

export async function chassisExisteDeja(chassis, excludeId) {
  await authPrete;
  if (!chassis) return false;
  const q = query(vehiculesRef, where("chassis", "==", normaliserChassis(chassis)));
  const snap = await getDocs(q);
  return snap.docs.some((d) => d.id !== excludeId);
}

export async function creerVehicule(donnees) {
  await authPrete;
  if (donnees.chassis) donnees.chassis = normaliserChassis(donnees.chassis);
  donnees.creeLe = serverTimestamp();
  donnees.creePar = window.UTILISATEUR || "";
  donnees.equipementsAppliques = donnees.equipements || {};
  const ref = await addDoc(vehiculesRef, donnees);
  await enregistrerHistorique("Entrée en stock", { id: ref.id, ...donnees });
  await ajusterStockEquipements({}, donnees.equipements);
  await retirerArrivageParChassis(donnees.chassis);
  return ref.id;
}

// Si un véhicule portant ce châssis existe encore dans la pré-liste
// "Prochain arrivage", le retire automatiquement — que le véhicule ait été
// saisi directement dans Stock, importé en masse, ou fait entrer depuis
// la pré-liste elle-même.
export async function retirerArrivageParChassis(chassis) {
  await authPrete;
  if (!chassis) return;
  const q = query(arrivagesRef, where("chassis", "==", normaliserChassis(chassis)));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await deleteDoc(doc(db, "prochains_arrivages", d.id));
  }
}

// Ajuste le stock d'équipements (collection equipements_stock) selon la
// différence entre l'ancien et le nouvel état de la checklist équipements
// d'un véhicule — fonctionne aussi bien à la création (ancien = {}) qu'à
// la modification (un équipement décoché rend son stock, un nouveau coché
// ou une quantité augmentée le décompte). Prévient si le stock devient
// insuffisant (quantité demandée supérieure à ce qui est disponible).
export async function ajusterStockEquipements(ancien, nouveau) {
  await authPrete;
  const noms = new Set([...Object.keys(ancien || {}), ...Object.keys(nouveau || {})]);
  if (noms.size === 0) return;
  const snap = await getDocs(equipementsRef);
  const stockDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const insuffisants = [];
  for (const nom of noms) {
    const avant = (ancien && ancien[nom] && ancien[nom].present) ? (ancien[nom].quantite || 0) : 0;
    const apres = (nouveau && nouveau[nom] && nouveau[nom].present) ? (nouveau[nom].quantite || 0) : 0;
    const delta = apres - avant; // positif = consomme plus de stock, négatif = en rend
    if (delta === 0) continue;
    const match = stockDocs.find((s) => (s.nom || "").toLowerCase() === nom.toLowerCase());
    if (match) {
      const brut = (match.stockPieces || 0) - delta;
      if (delta > 0 && brut < 0) insuffisants.push(nom);
      const nouveauStock = Math.max(0, brut);
      await updateDoc(doc(db, "equipements_stock", match.id), { stockPieces: nouveauStock });
    } else if (delta > 0) {
      insuffisants.push(nom);
    }
  }
  if (insuffisants.length > 0 && typeof toast === "function") {
    toast(`Stock insuffisant pour : ${insuffisants.join(", ")}`, "terr");
  }
}

export async function majVehicule(id, donnees) {
  await authPrete;
  if (donnees.chassis) donnees.chassis = normaliserChassis(donnees.chassis);
  const existant = await getDoc(doc(db, "vehicules", id));
  const donneesActuelles = existant.exists() ? existant.data() : {};
  const ancienEquip = donneesActuelles.equipementsAppliques || {};
  const ancienStatut = donneesActuelles.statut;

  donnees.misAJour = serverTimestamp();
  donnees.misAJourPar = window.UTILISATEUR || "";
  if (donnees.equipements) {
    await ajusterStockEquipements(ancienEquip, donnees.equipements);
    donnees.equipementsAppliques = donnees.equipements;
  }
  await updateDoc(doc(db, "vehicules", id), donnees);

  // Transaction importante = le statut a réellement changé (vente,
  // réservation, mise en dommage, remise en stock). Une simple
  // correction de champ sans changement de statut n'est pas
  // journalisée, pour ne garder que l'essentiel dans l'historique.
  if (donnees.statut && donnees.statut !== ancienStatut) {
    const libelle = LIBELLE_PAR_STATUT[donnees.statut] || "Mise à jour";
    await enregistrerHistorique(libelle, { id, ...donneesActuelles, ...donnees });
  }
}

// Sortie définitive d'un véhicule du parc : on ne supprime jamais
// l'information, on l'archive dans vehicules_archives (avec toutes ses
// infos + qui l'a sorti et quand) avant de le retirer du stock actif.
export async function supprimerVehicule(vehicule) {
  await authPrete;
  await ajusterStockEquipements(vehicule.equipementsAppliques || vehicule.equipements || {}, {});
  const { id, ...donnees } = vehicule;
  await addDoc(archivesRef, {
    ...donnees,
    sortiLe: serverTimestamp(),
    sortiPar: window.UTILISATEUR || "",
  });
  await deleteDoc(doc(db, "vehicules", id));
  await enregistrerHistorique("Sortie du parc", vehicule);
}

export async function ecouterArchives(callback) {
  await authPrete;
  const q = query(archivesRef, orderBy("sortiLe", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// Remet un véhicule archivé de nouveau dans le stock actif.
export async function restaurerArchive(archive) {
  await authPrete;
  const { id, sortiLe, sortiPar, ...donnees } = archive;
  await creerVehicule(donnees);
  await deleteDoc(doc(db, "vehicules_archives", id));
}

// ---------------------------------------------------------------
// Historique — partagé entre tous les utilisateurs via Firestore.
// Seules les transactions importantes sont journalisées (entrée en
// stock, vente, réservation, mise en dommage, remise en stock,
// sortie du parc) ; une simple correction de champ (prix, couleur,
// immatriculation…) sans changement de statut n'est pas obligatoire
// dans l'historique et n'est donc pas enregistrée.
// ---------------------------------------------------------------

const LIBELLE_PAR_STATUT = {
  vendu: "Vente",
  reserve: "Réservation",
  endommage: "Mise en dommage",
  stock: "Remise en stock",
};

export async function enregistrerHistorique(action, vehicule) {
  await authPrete;
  await addDoc(historiqueRef, {
    action,
    chassis: vehicule.chassis || "",
    marque: vehicule.marque || "",
    modele: vehicule.modele || "",
    emplacement: vehicule.emplacement || "",
    statut: vehicule.statut || "",
    prix: vehicule.prix || null,
    client: vehicule.client ? vehicule.client.nom || "" : "",
    utilisateur: window.UTILISATEUR || "",
    horodatage: serverTimestamp(),
  });
}

export async function ecouterHistorique(callback) {
  await authPrete;
  const q = query(historiqueRef, orderBy("horodatage", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data()));
  });
}

export async function chargerHistorique() {
  await authPrete;
  const q = query(historiqueRef, orderBy("horodatage", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

// ---------------------------------------------------------------
// Prochain arrivage — pré-liste des véhicules pas encore en stock
// ---------------------------------------------------------------

export async function ecouterArrivages(callback) {
  await authPrete;
  const q = query(arrivagesRef, orderBy("dateArriveePrevue", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function getArrivage(id) {
  await authPrete;
  const snap = await getDoc(doc(db, "prochains_arrivages", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function creerArrivage(donnees) {
  await authPrete;
  if (donnees.chassis) donnees.chassis = normaliserChassis(donnees.chassis);
  donnees.creeLe = serverTimestamp();
  donnees.creePar = window.UTILISATEUR || "";
  await addDoc(arrivagesRef, donnees);
}

export async function majArrivage(id, donnees) {
  await authPrete;
  if (donnees.chassis) donnees.chassis = normaliserChassis(donnees.chassis);
  donnees.misAJour = serverTimestamp();
  await updateDoc(doc(db, "prochains_arrivages", id), donnees);
}

export async function supprimerArrivage(id) {
  await authPrete;
  await deleteDoc(doc(db, "prochains_arrivages", id));
}

export async function arrivageChassisExisteDeja(chassis, excludeId) {
  await authPrete;
  if (!chassis) return false;
  const q = query(arrivagesRef, where("chassis", "==", normaliserChassis(chassis)));
  const snap = await getDocs(q);
  return snap.docs.some((d) => d.id !== excludeId);
}

// ---------------------------------------------------------------
// Import groupé (CSV / Excel / PDF) — optimisé pour de gros volumes.
//
// L'ancienne version faisait 2 requêtes Firestore PAR LIGNE (vérif
// doublon dans "vehicules" + dans "prochains_arrivages"), soit plus
// de 300 allers-retours réseau pour 150 lignes -> import qui semblait
// figé pendant de longues minutes.
//
// Ici, on récupère UNE SEULE FOIS la liste des châssis déjà connus
// (stock + arrivages), puis on écrit tout en un lot groupé (writeBatch),
// avec un seul commit réseau par tranche de 450 lignes (limite Firestore
// = 500 opérations par batch).
// ---------------------------------------------------------------

export async function chassisConnusExistants() {
  await authPrete;
  const [vehSnap, arrSnap] = await Promise.all([getDocs(vehiculesRef), getDocs(arrivagesRef)]);
  const set = new Set();
  vehSnap.docs.forEach((d) => { const c = normaliserChassis(d.data().chassis); if (c) set.add(c); });
  arrSnap.docs.forEach((d) => { const c = normaliserChassis(d.data().chassis); if (c) set.add(c); });
  return set;
}

export async function importerArrivagesEnMasse(donneesLignes, onProgress) {
  await authPrete;
  const existants = await chassisConnusExistants();
  const vuDansFichier = new Set();
  let n = 0, ignorees = 0, doublons = 0;
  const utilisateur = window.UTILISATEUR || "";
  const total = donneesLignes.length;

  let batch = writeBatch(db);
  let compteur = 0;

  const flush = async () => {
    if (compteur > 0) {
      await batch.commit();
      batch = writeBatch(db);
      compteur = 0;
    }
  };

  for (let i = 0; i < donneesLignes.length; i++) {
    const donnees = donneesLignes[i];
    const chassisKey = normaliserChassis(donnees.chassis);

    if (!chassisKey || !donnees.marque || !donnees.modele || !donnees.couleurExt || !donnees.couleurInt) {
      ignorees++;
    } else if (existants.has(chassisKey) || vuDansFichier.has(chassisKey)) {
      doublons++;
    } else {
      vuDansFichier.add(chassisKey);
      const ref = doc(arrivagesRef);
      batch.set(ref, { ...donnees, chassis: chassisKey, creeLe: serverTimestamp(), creePar: utilisateur });
      n++;
      compteur++;
      if (compteur >= 450) await flush();
    }

    if (onProgress && (i % 10 === 0 || i === total - 1)) onProgress(i + 1, total);
  }
  await flush();

  return { n, ignorees, doublons };
}

// Import groupé pour la page Stock véhicule — même principe que pour les
// arrivages : une seule lecture des châssis + pré-liste arrivages existants,
// puis toutes les écritures (véhicule + entrée d'historique + retrait éventuel
// de la pré-liste arrivage) regroupées en batch. Les équipements ne sont pas
// gérés à l'import (toujours vides), donc pas d'ajustement de stock équipements
// nécessaire ici.
export async function importerVehiculesEnMasse(donneesLignes, onProgress) {
  await authPrete;
  const [vehSnap, arrSnap] = await Promise.all([getDocs(vehiculesRef), getDocs(arrivagesRef)]);
  const existants = new Set();
  vehSnap.docs.forEach((d) => { const c = normaliserChassis(d.data().chassis); if (c) existants.add(c); });
  const arrivageIdParChassis = new Map();
  arrSnap.docs.forEach((d) => { const c = normaliserChassis(d.data().chassis); if (c) arrivageIdParChassis.set(c, d.id); });

  const vuDansFichier = new Set();
  let n = 0, ignorees = 0, doublons = 0;
  const utilisateur = window.UTILISATEUR || "";
  const total = donneesLignes.length;

  let batch = writeBatch(db);
  let compteur = 0;
  const flush = async () => {
    if (compteur > 0) {
      await batch.commit();
      batch = writeBatch(db);
      compteur = 0;
    }
  };

  for (let i = 0; i < donneesLignes.length; i++) {
    const donnees = donneesLignes[i];
    const chassisKey = normaliserChassis(donnees.chassis);

    if (!chassisKey || !donnees.marque || !donnees.modele || !donnees.couleurExt || !donnees.couleurInt || !donnees.dateEntree) {
      ignorees++;
    } else if (existants.has(chassisKey) || vuDansFichier.has(chassisKey)) {
      doublons++;
    } else {
      vuDansFichier.add(chassisKey);
      const ref = doc(vehiculesRef);
      batch.set(ref, {
        ...donnees, chassis: chassisKey, statut: "stock", equipements: {}, equipementsAppliques: {},
        creeLe: serverTimestamp(), creePar: utilisateur,
      });
      batch.set(doc(historiqueRef), {
        action: "Entrée en stock", chassis: chassisKey, marque: donnees.marque || "", modele: donnees.modele || "",
        emplacement: donnees.emplacement || "", statut: "stock", prix: donnees.prix || null, client: "",
        utilisateur, horodatage: serverTimestamp(),
      });
      let operations = 2;
      const arrivageId = arrivageIdParChassis.get(chassisKey);
      if (arrivageId) { batch.delete(doc(db, "prochains_arrivages", arrivageId)); operations = 3; }

      n++;
      compteur += operations;
      if (compteur >= 400) await flush();
    }

    if (onProgress && (i % 10 === 0 || i === total - 1)) onProgress(i + 1, total);
  }
  await flush();

  return { n, ignorees, doublons };
}

// Fait entrer un véhicule du prochain arrivage directement dans le stock :
// crée le véhicule (avec la vraie date d'entrée donnée par l'utilisateur)
// puis retire l'entrée de la pré-liste.
export async function entrerArrivageEnStock(arrivage, dateEntreeReelle) {
  await authPrete;
  const { id, dateArriveePrevue, ...donnees } = arrivage;
  donnees.dateEntree = dateEntreeReelle;
  donnees.statut = "stock";
  await creerVehicule(donnees);
  await supprimerArrivage(id);
}
