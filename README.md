# Sky Gestion — Parc Automobile

Même nom, même identité visuelle (couleurs, police Barlow Condensed +
Times New Roman, sidebar bleu nuit, accent rouge) que ton projet Sky
Gestion magasin, adapté à la gestion d'un parc automobile.

## Mise en route

```bash
pip install -r requirements.txt
python app.py
```

Ouvre `http://localhost:5000` → tu tombes sur la page de connexion.
**Mot de passe : 715525**

## Avant de vraiment l'utiliser

1. ~~Config Firebase~~ ✅ déjà intégrée (`sky-parc-auto`) dans `static/js/firebase-config.js`.
2. **Règles Firestore** pour sécuriser les collections `vehicules` et
   `historique` — la règle "allow read, write: if true" utilisée pour
   démarrer est ouverte à tous, à verrouiller une fois l'appli testée.
3. **`SECRET_KEY`** — en production (Railway), définis la variable
   d'environnement `SECRET_KEY` plutôt que la valeur par défaut dans
   `app.py`.

## Important — à propos du fichier que tu as envoyé

Ton zip `skymotor_v10.zip` contient un fichier `serviceAccountKey.json`
avec une **vraie clé privée Firebase** (accès admin complet à ta base
`sky-motors-92342`), ainsi qu'un `.env`. Je ne les ai pas repris dans
ce nouveau projet et je ne les ai pas affichés. Attention en partageant
ce zip ailleurs (mail, drive public...) — cette clé donne un accès total
à ta base de données Sky Gestion magasin. Si tu penses qu'elle a pu
fuiter, tu peux la révoquer et en régénérer une depuis la console
Firebase (Paramètres du projet → Comptes de service).

## Ce qui a été repris de Sky Gestion (identique)

- CSS complet (couleurs, polices, cartes, tableaux, boutons, modals)
- Page de connexion (carte en verre dépoli sur fond bleu nuit, logo,
  slogan "Drive different… Be different")
- Sidebar + topbar + footer avec logos des marques
- `exportCSV`, `SKY_PDF` (impression PDF avec en-tête/pied Sky Motors),
  `toast`, gestion des modals — copiés depuis `base.html`/`style.css`

## Ce qui a été simplifié (volontairement, pas demandé ici)

Le projet magasin a une architecture bien plus lourde que ce qui a été
demandé pour le parc auto : multi-utilisateurs avec rôles, multi-pôles
à la connexion, moteur de synchronisation SQLite local ↔ Firebase
(`local_db.py` / `sync_engine.py`), système de licence
(`license_manager.py`), notifications SMS/FCM. Pour le parc auto tu as
demandé **un seul mot de passe** et **un seul pôle** — j'ai donc gardé
une authentification simple (session Flask) et une lecture/écriture
directe sur Firestore depuis le front, comme un projet plus léger.
Si tu veux un jour le mode hors-ligne avec synchronisation façon
Sky Gestion magasin, on peut le rajouter en s'inspirant de
`local_db.py` et `sync_engine.py`.

## Fonctionnalités

- **Tableau de bord** : véhicules en stock / réservés / vendus /
  endommagés, évolution entrées-sorties (12 derniers mois), top 10
  clients par nombre de véhicules achetés, évolution des ventes sur
  l'année en cours
- **Stock véhicule** : indicateurs par site (Parc Broli, Showroom
  Douala/Yaoundé/Bafoussam, couleurs distinctes), tableau filtrable
  (nom, marque, modèle, emplacement, 6 derniers chiffres du châssis,
  date d'entrée, recherche libre), actions entrer/sortir/
  réserver/vendre/endommager, import CSV/PDF, export CSV/PDF
- **Véhicules vendus** : liste, informations client, dates
  d'entrée/sortie, filtres, export
- **Réservés & Endommagés** : deux onglets ; les véhicules endommagés
  précisent la ou les pièces touchées ; remise en stock possible
- **Équipements** : stock consommable pour préparer les véhicules
  (extincteurs, tapis, chasubles, cric, caisse à outils, ou tout
  équipement ajouté par l'utilisateur), avec gestion par carton
  (ex : carton de 16 extincteurs) + pièces isolées, ajout/retrait de
  stock

## Rebranding

L'application s'appelle maintenant **Sky Gestion Parc** (plus de
logo/texte Jetour sur la page de connexion ni dans le pied de page,
uniquement le logo texte Sky Motors). Jetour reste une marque gérée
dans le stock véhicule.

## Performance

Les pages Stock, Vendus, Réservés/Endommagés et Tableau de bord
écoutent maintenant Firestore en temps réel (`onSnapshot` au lieu
d'un chargement ponctuel) : au premier affichage, les données du
cache local s'affichent instantanément, puis se mettent à jour dès
que le serveur répond — plus besoin de recharger la page après un
ajout/modification. Il n'existe pas de région Firestore en Afrique ;
une latence réseau minimale reste donc normale selon ta connexion,
mais elle ne devrait plus se faire sentir sur l'affichage lui-même.

## Nouveaux filtres

- **Stock véhicule** et **Véhicules vendus** : filtre période
  (Aujourd'hui / Cette semaine / Ce mois / Ce trimestre), en plus des
  filtres marque/modèle/emplacement/recherche existants.
- **Tableau de bord** : chaque graphique (flux entrées-sorties, top
  10 clients, évolution des ventes) a ses propres filtres marque et
  emplacement.

## Modèle de données (collection `vehicules`)

- `chassis`, `immatriculation`, `marque`, `modele`, `type`, `annee`
- `couleurExt`, `couleurInt`
- `emplacement` : Parc Broli | Showroom Douala | Showroom Yaoundé | Showroom Bafoussam
- `statut` : `stock` | `reserve` | `vendu` | `endommage`
- `prix`, `kilometrage`, `dateEntree`, `dateSortie`
- `equipements` : `{ "Extincteur": { present: true, quantite: 1 }, ... }`
- `client` (si vendu) : `nom`, `contact`, `dateAchat`, `modePaiement`, `vendeur`
- `piecesEndommagees` (si endommagé) : texte libre
