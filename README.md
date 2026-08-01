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
- `creePar`, `misAJourPar` : nom saisi à la connexion

## Connexion — nom + mot de passe

Le login demande maintenant un **nom** en plus du mot de passe (`715525`
reste le même pour tout le monde). Le nom n'est pas un vrai compte
utilisateur — c'est uniquement pour savoir qui a fait quoi (voir
ci-dessous). Le champ mot de passe est vidé à chaque affichage de la
page (`autocomplete="new-password"` + remise à zéro au retour
arrière du navigateur) pour qu'il ne reste jamais pré-rempli.

⚠️ **Important sur la sécurité** : ce nom+mot de passe protège l'accès
à l'interface Flask, mais **ne sécurise pas Firestore lui-même** —
les règles Firestore restent le seul rempart pour la base de
données. Une vraie séparation par utilisateur (avec des permissions
différentes par personne) demanderait d'intégrer Firebase
Authentication, ce qui est un chantier à part si tu le souhaites un
jour.

## Traçabilité des actions

Chaque action (entrée en stock, modification, sortie, vente,
réservation, mise en dommage) enregistre maintenant le nom saisi à
la connexion. C'est visible :
- Sur la nouvelle page **Historique** (nouveau lien dans le menu),
  avec filtres marque/action/recherche
- Sur le bouton 🕒 de chaque ligne du Stock véhicule (historique
  propre à ce véhicule)

## Autres améliorations apportées

- **Doublons de châssis bloqués** — impossible d'enregistrer deux
  fois le même châssis
- **Immatriculation et prix obligatoires** dans le formulaire véhicule
- **Alerte stock critique** — badge ⚠ sur un véhicule "en stock"
  depuis 60 jours ou plus
- **Export intégral** de toute la base (bouton dédié sur Stock,
  distinct des exports filtrés)
- **Recherche globale** dans la barre du haut (sur toutes les pages)
  — tape et Entrée, ça t'amène sur Stock avec le résultat déjà filtré
- **Facture individuelle en PDF** pour un véhicule vendu (bouton
  🧾 sur la page Véhicules vendus)
- **Lien Équipements ↔ Stock véhicule** — le stock d'équipements se
  met à jour automatiquement à la création ET à la modification d'un
  véhicule (un équipement décoché rend le stock, un équipement coché
  ou une quantité augmentée le décompte) ; la sortie définitive d'un
  véhicule du parc restitue aussi son stock d'équipements
- **Équipements en carton ET/OU en unité** — un même équipement peut
  avoir du stock en cartons complets et en unités isolées à la fois
  (ex : 1 carton + 3 unités). La création d'un équipement propose une
  liste déroulante des équipements de base (+ "Autre" en texte libre)
  et un choix "vendu en carton" / "vendu à l'unité". Ajouter/utiliser
  du stock se fait aussi en cartons + unités isolées, plus besoin de
  convertir à la main.
- **Import CSV/PDF plus permissif** — seuls châssis, modèle, couleur
  extérieure, couleur intérieure et date d'entrée sont obligatoires ;
  le reste (type, emplacement, année, prix) est optionnel. Les lignes
  incomplètes ou en doublon de châssis sont ignorées et comptées.
- **Type de véhicule déduit automatiquement** — Jetour et Soueast →
  SUV, JMC → Pick-up (à la création du véhicule et à l'import si la
  colonne Type est vide). Howo Sinotruk n'est pas déduit automatiquement
  (camion ou camionnette) : à choisir soi-même.
- **Tableau de bord enrichi** : valeur totale du stock, répartition
  par type de véhicule (camembert), délai moyen de vente par marque,
  graphique des véhicules endommagés par marque — tous les
  graphiques ont des filtres marque/modèle/emplacement et un bouton
  de téléchargement en image (PNG)
- **Nouveau sous-volet "Prochain arrivage"** : pré-liste des
  véhicules pas encore livrés à l'entreprise, avec exactement la
  même logique que Stock véhicule (mêmes champs véhicule complets,
  mêmes filtres marque/modèle/emplacement/date/période, import et
  export CSV/PDF). Bouton "Entrer en stock" : demande la vraie date
  d'entrée, puis fait basculer automatiquement le véhicule dans le
  Stock véhicule et le retire de la pré-liste. Collection Firestore
  séparée : `prochains_arrivages`.
- **Retrait automatique de la pré-liste** — si un véhicule est ajouté
  directement dans Stock véhicule (manuellement ou par import
  CSV/PDF) alors qu'il existait déjà dans "Prochain arrivage" (même
  châssis), il est automatiquement retiré de la pré-liste.
- **Sélection multiple sur Prochain arrivage** — case à cocher par
  ligne (+ "tout sélectionner"), une barre apparaît avec le nombre de
  véhicules sélectionnés et un champ date unique : "Entrer la
  sélection en stock" fait entrer tous les véhicules cochés avec la
  même date d'entrée en une seule action.

## Dernières modifications

- **Doublons de châssis bloqués dans les deux sens** entre Stock
  véhicule et Prochain arrivage (avant : uniquement Stock → Arrivage).
- **Alerte stock d'équipements insuffisant** — un message d'erreur
  s'affiche si un véhicule est équipé avec plus de pièces qu'il n'en
  reste en stock (le stock est quand même plafonné à 0, jamais négatif).
- **Véhicules archivés au lieu de supprimés** — la "Sortie du parc"
  n'efface plus rien : le véhicule est déplacé dans une nouvelle
  page **Véhicules archivés** (nouveau lien dans le menu), avec
  toutes ses infos, qui l'a sorti et quand. Bouton "Restaurer en
  stock" pour annuler une sortie faite par erreur.
- **Historique partagé, limité aux transactions importantes** — le
  journal des actions (page Historique) est de nouveau écrit sur
  Firestore et donc partagé entre tous les utilisateurs/appareils.
  Seules les transactions importantes y figurent : entrée en stock,
  vente, réservation, mise en dommage, remise en stock, sortie du
  parc. Une simple correction de champ (prix, couleur,
  immatriculation…) sans changement de statut n'y est pas
  enregistrée — elle n'est pas jugée obligatoire dans l'historique.
- **Clients multi-véhicules** — sur Véhicules vendus, une carte
  "Clients" liste maintenant chaque client ayant acheté **plusieurs**
  véhicules (nombre + montant total), cliquable pour filtrer
  instantanément le tableau sur ce client.
