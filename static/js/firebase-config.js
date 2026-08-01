// ---------------------------------------------------------------
// Config Firebase — remplace ces valeurs par celles de ta console
// Firebase (nouveau projet dédié au parc auto, ou projet existant).
// ---------------------------------------------------------------

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
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
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBp6ooHJy2mZRonNtiKHdZJSR2FENUld-E",
  authDomain: "sky-parc-auto.firebaseapp.com",
  projectId: "sky-parc-auto",
  storageBucket: "sky-parc-auto.firebasestorage.app",
  messagingSenderId: "796899158528",
  appId: "1:796899158528:web:23a978613c67009b99c6e5",
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
});

export const vehiculesRef = collection(db, "vehicules");
export const historiqueRef = collection(db, "historique");
export const equipementsRef = collection(db, "equipements_stock");
export const arrivagesRef = collection(db, "prochains_arrivages");
export const archivesRef = collection(db, "vehicules_archives");

export {
  doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp,
};
