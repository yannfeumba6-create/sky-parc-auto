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
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, session, jsonify

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change-moi-en-production")

APP_PASSWORD = "715525"

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
        if pwd == APP_PASSWORD:
            session["auth"] = True
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
        active_page="equipements",
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


@app.route("/manifest.json")
def manifest():
    return app.send_static_file("manifest.json")


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
