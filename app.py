"""
SKY GESTION — Gestion de Parc Automobile
Même identité visuelle et logique que Sky Gestion (magasin), adaptée
au parc automobile : Flask sert les pages, Firestore (client-side)
porte toute la donnée véhicules/historique.

Authentification simplifiée : un seul mot de passe pour tout le monde
(pas de multi-pôles, pas de multi-utilisateurs comme sur le projet
magasin — ce n'est pas ce qui a été demandé ici).
"""

import os
import json
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, session, jsonify

import firebase_admin
from firebase_admin import credentials as fb_credentials, auth as fb_auth

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change-moi-en-production")

APP_PASSWORD = "715525"

# ---------------------------------------------------------------------------
# Firebase Admin — sert uniquement à délivrer un jeton d'authentification
# Firebase au navigateur une fois le mot de passe validé. Sans ça, Firestore
# voit chaque requête comme anonyme et la refuse ("Missing or insufficient
# permissions") dès que les règles de sécurité exigent une authentification.
#
# Nécessite la variable d'environnement FIREBASE_SERVICE_ACCOUNT_JSON,
# contenant le JSON complet de la clé de compte de service Firebase
# (Console Firebase → Paramètres du projet → Comptes de service →
# Générer une nouvelle clé privée → copier tout le contenu du fichier
# .json téléchargé dans cette variable d'environnement).
# ---------------------------------------------------------------------------

_firebase_admin_app = None


def _get_firebase_admin_app():
    global _firebase_admin_app
    if _firebase_admin_app is not None:
        return _firebase_admin_app
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if not raw:
        return None
    try:
        cred = fb_credentials.Certificate(json.loads(raw))
        _firebase_admin_app = firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f"[Firebase Admin] Échec d'initialisation : {e}")
        _firebase_admin_app = None
    return _firebase_admin_app

# ---------------------------------------------------------------------------
# Référentiels
# ---------------------------------------------------------------------------

MARQUES = ["Jetour", "JMC", "Soueast", "Howo Sinotruk"]
TYPES_VEHICULE = ["Pick-up", "SUV", "Camion", "Camionnette", "Berline", "Citadine"]
EMPLACEMENTS = ["Parc Broli", "Showroom Douala", "Showroom Yaoundé", "Showroom Bafoussam"]
STATUTS = ["stock", "reserve", "vendu", "endommage"]

EQUIPEMENTS_REFERENCE = [
    "Boîte à pharmacie",
    "Triangle de signalisation",
    "Gilet de sécurité",
    "Extincteur",
    "Tapis de sol",
    "Roue de secours",
    "Cric",
    "Clé de roue",
    "Câbles de démarrage",
]

# Équipements de base pour la préparation des véhicules (stock consommable,
# distinct de la checklist par véhicule) — conditionnement par carton.
EQUIPEMENTS_STOCK_BASE = [
    {"nom": "Extincteur", "piecesParCarton": 16},
    {"nom": "Tapis", "piecesParCarton": 5},
    {"nom": "Chasuble", "piecesParCarton": 10},
    {"nom": "Cric", "piecesParCarton": 1},
    {"nom": "Caisse à outils", "piecesParCarton": 1},
]


# ---------------------------------------------------------------------------
# Auth — mot de passe unique
# ---------------------------------------------------------------------------

def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("auth"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return wrapper


@app.route("/login", methods=["GET", "POST"])
def login():
    error = False
    if request.method == "POST":
        pwd = request.form.get("password", "").strip()
        nom = request.form.get("nom", "").strip()
        if pwd == APP_PASSWORD and nom:
            session["auth"] = True
            session["nom"] = nom
            return redirect(url_for("dashboard"))
        error = True
    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
def racine():
    return redirect(url_for("dashboard")) if session.get("auth") else redirect(url_for("login"))


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

@app.route("/dashboard")
@login_required
def dashboard():
    return render_template(
        "dashboard.html",
        marques=MARQUES,
        emplacements=EMPLACEMENTS,
        types_vehicule=TYPES_VEHICULE,
        active_page="dashboard",
    )


@app.route("/stock")
@login_required
def stock():
    return render_template(
        "stock.html",
        marques=MARQUES,
        types_vehicule=TYPES_VEHICULE,
        emplacements=EMPLACEMENTS,
        equipements=EQUIPEMENTS_REFERENCE,
        active_page="stock",
    )


@app.route("/vendus")
@login_required
def vendus():
    return render_template(
        "vendus.html",
        marques=MARQUES,
        emplacements=EMPLACEMENTS,
        active_page="vendus",
    )


@app.route("/reserves")
@login_required
def reserves():
    return render_template(
        "reserves.html",
        marques=MARQUES,
        emplacements=EMPLACEMENTS,
        active_page="reserves",
    )


@app.route("/equipements")
@login_required
def equipements():
    return render_template(
        "equipements.html",
        equipements_base=EQUIPEMENTS_STOCK_BASE,
        equipements_reference=EQUIPEMENTS_REFERENCE,
        active_page="equipements",
    )


@app.route("/historique")
@login_required
def historique():
    return render_template(
        "historique.html",
        marques=MARQUES,
        emplacements=EMPLACEMENTS,
        active_page="historique",
    )


@app.route("/arrivages")
@login_required
def arrivages():
    return render_template(
        "arrivages.html",
        marques=MARQUES,
        types_vehicule=TYPES_VEHICULE,
        emplacements=EMPLACEMENTS,
        equipements=EQUIPEMENTS_REFERENCE,
        active_page="arrivages",
    )


@app.route("/archives")
@login_required
def archives():
    return render_template(
        "archives.html",
        marques=MARQUES,
        active_page="archives",
    )


# ---------------------------------------------------------------------------
# Petite API de référence (les véhicules restent dans Firestore)
# ---------------------------------------------------------------------------

@app.route("/api/referentiels")
@login_required
def referentiels():
    return jsonify({
        "marques": MARQUES,
        "types_vehicule": TYPES_VEHICULE,
        "emplacements": EMPLACEMENTS,
        "statuts": STATUTS,
        "equipements": EQUIPEMENTS_REFERENCE,
    })


@app.route("/api/firebase-token")
@login_required
def firebase_token():
    fb_app = _get_firebase_admin_app()
    if fb_app is None:
        return jsonify({
            "error": "Firebase Admin non configuré côté serveur : la variable "
                     "d'environnement FIREBASE_SERVICE_ACCOUNT_JSON est manquante ou invalide."
        }), 500

    nom = session.get("nom") or "utilisateur"
    uid = "sky-parc-" + ("".join(c for c in nom.lower() if c.isalnum()) or "utilisateur")
    try:
        token = fb_auth.create_custom_token(uid)
        if isinstance(token, bytes):
            token = token.decode("utf-8")
    except Exception as e:
        return jsonify({"error": f"Échec de génération du jeton Firebase : {e}"}), 500

    return jsonify({"token": token})


@app.route("/manifest.json")
def manifest():
    return app.send_static_file("manifest.json")


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
