// ---------------------------------------------------------------
// Config Firebase — remplace ces valeurs par celles de ta console
// Firebase (nouveau projet dédié au parc auto, ou projet existant).
// ---------------------------------------------------------------

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithCustomToken,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBp6ooHJy2mZRonNtiKHdZJSR2FENUld-E",
  authDomain: "sky-parc-auto.firebaseapp.com",
  projectId: "sky-parc-auto",
  storageBucket: "sky-parc-auto.firebasestorage.app",
  messagingSenderId: "796899158528",
  appId: "1:796899158528:web:23a978613c67009b99c6e5",
};

const app = initializeApp(firebaseConfig);
const authInstance = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
});
const storage = getStorage(app);

// Envoie un fichier (photo ou vidéo de constat de dommage) vers Firebase
// Storage et renvoie son URL de téléchargement, à enregistrer dans le
// document Firestore du véhicule.
export async function televerserFichier(chemin, fichier) {
  const r = storageRef(storage, chemin);
  await uploadBytes(r, fichier);
  return getDownloadURL(r);
}

export const vehiculesRef = collection(db, "vehicules");
export const historiqueRef = collection(db, "historique");
export const equipementsRef = collection(db, "equipements_stock");
export const arrivagesRef = collection(db, "prochains_arrivages");
export const archivesRef = collection(db, "vehicules_archives");
export const showroomRef = collection(db, "vehicules_showroom");

// ---------------------------------------------------------------
// Connexion à Firebase — le mot de passe est déjà vérifié côté serveur
// Flask (session cookie). Une fois connecté à l'appli, on récupère auprès
// du serveur un jeton Firebase (voir /api/firebase-token dans app.py) et on
// s'en sert pour authentifier le navigateur auprès de Firestore. Sans ça,
// les règles de sécurité Firestore refusent tout ("Missing or insufficient
// permissions"), car elles ne peuvent pas savoir que le mot de passe a été
// saisi correctement côté Flask.
//
// `authPrete` est une promesse que chaque fonction de data.js attend avant
// de toucher Firestore, pour ne jamais tenter une requête avant la fin de
// cette connexion.
// ---------------------------------------------------------------

let _resoudreAuthPrete;
export const authPrete = new Promise((resolve) => { _resoudreAuthPrete = resolve; });
export let erreurAuthFirebase = null;

async function connecterFirebase() {
  try {
    const res = await fetch("/api/firebase-token");
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) {
      erreurAuthFirebase = data.error || `Erreur serveur (${res.status})`;
      console.error("Connexion Firebase impossible :", erreurAuthFirebase);
      return;
    }
    await signInWithCustomToken(authInstance, data.token);
  } catch (e) {
    erreurAuthFirebase = e.message;
    console.error("Connexion Firebase impossible :", e);
  } finally {
    _resoudreAuthPrete();
    if (erreurAuthFirebase && typeof window.toast === "function") {
      window.toast(
        "Connexion à la base de données impossible : " + erreurAuthFirebase,
        "terr"
      );
    }
  }
}
connecterFirebase();

export {
  doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, writeBatch, query, where, orderBy, onSnapshot, serverTimestamp,
};
