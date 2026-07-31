import {
  db, vehiculesRef, historiqueRef,
  doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp,
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

export function chassis6(chassis) {
  if (!chassis) return "—";
  const c = String(chassis).trim();
  return c.length > 6 ? c.slice(-6) : c;
}

// Écoute en temps réel (affiche d'abord le cache local instantanément, puis
// se met à jour dès que le serveur répond — beaucoup plus rapide à l'écran
// qu'un chargement à chaque visite de page).
export function ecouterVehicules(callback) {
  const q = query(vehiculesRef, orderBy("dateEntree", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function ecouterHistorique(callback) {
  const q = query(historiqueRef, orderBy("horodatage", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data()));
  });
}

export async function chargerVehicules() {
  const q = query(vehiculesRef, orderBy("dateEntree", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getVehicule(id) {
  const snap = await getDoc(doc(db, "vehicules", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function creerVehicule(donnees) {
  donnees.creeLe = serverTimestamp();
  const ref = await addDoc(vehiculesRef, donnees);
  await enregistrerHistorique("Entrée en stock", { id: ref.id, ...donnees });
  return ref.id;
}

export async function majVehicule(id, donnees) {
  donnees.misAJour = serverTimestamp();
  await updateDoc(doc(db, "vehicules", id), donnees);
  await enregistrerHistorique("Mise à jour", { id, ...donnees });
}

export async function supprimerVehicule(vehicule) {
  await deleteDoc(doc(db, "vehicules", vehicule.id));
  await enregistrerHistorique("Sortie du parc", vehicule);
}

export async function enregistrerHistorique(action, vehicule) {
  await addDoc(historiqueRef, {
    action,
    chassis: vehicule.chassis || "",
    marque: vehicule.marque || "",
    modele: vehicule.modele || "",
    emplacement: vehicule.emplacement || "",
    statut: vehicule.statut || "",
    prix: vehicule.prix || null,
    client: vehicule.client ? vehicule.client.nom || "" : "",
    horodatage: serverTimestamp(),
  });
}

export async function chargerHistorique() {
  const q = query(historiqueRef, orderBy("horodatage", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}
