# SAR Bundle — Guide Complet

SAR Bundle est une application Shopify permettant de créer des **bundles interactifs à étapes** directement sur la page produit. Les clients composent leur bundle en sélectionnant des produits étape par étape, avec un total dynamique, des options supplémentaires (upsell), et un ajout au panier en une seule ligne.

---

## Table des Matières

1. [Architecture du Projet](#1-architecture-du-projet)
2. [Installation & Déploiement](#2-installation--déploiement)
3. [Créer un Bundle](#3-créer-un-bundle)
4. [Configurer les Étapes](#4-configurer-les-étapes)
5. [Modes de Prix](#5-modes-de-prix)
6. [Blocs Visuels (Design)](#6-blocs-visuels-design)
7. [Styles Globaux](#7-styles-globaux)
8. [Ajouter le Bloc au Thème Shopify](#8-ajouter-le-bloc-au-thème-shopify)
9. [Compatibilité Thèmes — Sélecteur de Prix](#9-compatibilité-thèmes--sélecteur-de-prix)
10. [Architecture Technique](#10-architecture-technique)
11. [Dépannage](#11-dépannage)

---

## 1. Architecture du Projet

```
SAR Bundle V2/
├── app/                              # Application Remix (Admin Shopify)
│   ├── routes/
│   │   ├── app._index.tsx            # Dashboard principal
│   │   ├── app.bundles.tsx           # Liste des bundles
│   │   ├── app.bundle.$id.tsx        # Éditeur de bundle (create/edit)
│   │   └── apps.sar-bundle.api.bundle.$id.tsx  # App Proxy (API storefront)
│   ├── components/bundle-editor/
│   │   ├── BundleVisualEditor.tsx    # Éditeur visuel principal (split view)
│   │   ├── BundleStorefrontPreview.tsx # Prévisualisation React temps réel
│   │   ├── SidebarLevel2.tsx         # Gestionnaire d'étapes et de blocs
│   │   └── SidebarLevel3.tsx         # Paramètres détaillés par bloc
│   └── utils/
│       ├── bundle.server.ts          # CRUD bundles (Prisma)
│       ├── bundle-form.client.ts     # State du formulaire admin
│       ├── storefront-design.ts      # Schéma des blocs visuels
│       └── storefront-bundle-enrich.server.ts  # Enrichissement prix/images
│
├── extensions/sar-bundle-ui/         # Theme App Extension (Storefront)
│   ├── blocks/bundle_builder.liquid  # Bloc thème (point d'entrée)
│   ├── assets/bundle-builder.js      # Moteur JS storefront (vanilla JS)
│   ├── assets/bundle-builder.css     # Styles storefront
│   └── assets/bundle-shared-ui.css  # Styles communs admin + storefront
│
├── extensions/sar-bundle-cart-transform/  # Shopify Function
│   └── src/cart_transform_run.js     # Regroupe les articles du bundle au checkout
│
└── prisma/
    └── schema.prisma                 # Modèle de données (Bundle, Step, Product…)
```

---

## 2. Installation & Déploiement

### Prérequis

- Node.js ≥ 18
- Compte Shopify Partners
- CLI Shopify installée : `npm install -g @shopify/cli`

### Étapes

```bash
# 1. Cloner le dépôt
git clone https://github.com/SARx613/SAR-Bundle.git
cd "SAR Bundle V2"

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env
# Remplir SHOPIFY_API_KEY, SHOPIFY_API_SECRET, DATABASE_URL dans .env

# 4. Initialiser la base de données
npx prisma migrate deploy

# 5. Lancer en développement
npm run dev

# 6. Déployer l'extension thème
shopify app deploy
```

---

## 3. Créer un Bundle

1. Dans l'admin Shopify, allez dans **Apps → SAR Bundle**
2. Cliquez sur **"Nouveau Bundle"**
3. Remplissez les informations de base :
   - **Nom** : nom du bundle (sera aussi le nom du produit Shopify créé)
   - **URL** : slug de l'URL produit (auto-généré à partir du nom)
   - **SEO** : titre et description pour le référencement
4. Choisissez le **Mode de Prix** (voir section 5)
5. Cliquez **Enregistrer** → un produit Shopify est créé automatiquement

> **Important :** Le produit Shopify créé automatiquement sert de "conteneur" pour le bundle. Ne le supprimez pas. Son prix est géré dynamiquement par l'app.

---

## 4. Configurer les Étapes

Chaque bundle est composé d'**étapes** (steps). Une étape = une page du configurateur.

### Ajouter une étape

1. Dans l'éditeur, cliquez **"+ Ajouter une étape"** dans la sidebar gauche
2. Donnez-lui un nom (ex : "Choisissez votre base", "Ajoutez vos 3 produits")
3. Cliquez sur l'étape pour l'éditer

### Ajouter des produits à une étape

1. Sélectionnez l'étape dans la sidebar
2. Onglet **"Paramètres"** → Section **"Produits"**
3. Cliquez **"Ajouter des produits"** → le Resource Picker Shopify s'ouvre
4. Sélectionnez les variantes souhaitées
5. Pour chaque produit, vous pouvez définir une quantité min/max

### Règles de validation

Dans l'onglet Paramètres de l'étape, section **"Règles"** :
- `TOTAL_ITEM_COUNT EQ 3` → l'étape est valide seulement si 3 articles au total
- `DISTINCT_VARIANT_COUNT GTE 2` → au moins 2 produits différents
- `BUNDLE_PRICE GTE 50` → le total doit dépasser 50 €

### Étape finale

Cochez **"Étape finale"** sur la dernière étape. C'est sur cette étape que les propriétés de ligne (champs texte, cases à cocher) s'affichent avant l'ajout au panier.

---

## 5. Modes de Prix

Choisissez le mode dans les paramètres généraux du bundle :

### 🔹 Boîte Standard (STANDARD)
**Somme des prix des articles + remise globale optionnelle**

- Le prix total = somme des prix unitaires Shopify × quantités sélectionnées
- Vous pouvez appliquer une remise en `%` ou en montant fixe (`FIXED_AMOUNT`)
- Le prix affiché sur la page fait évolue en temps réel à chaque sélection
- Exemple : 3 produits à 10 € + remise 10 % → **27,00 €** affiché

### 🔹 Prix Fixe de la Boîte (FIXED_PRICE_BOX)
**Le bundle entier coûte un prix fixe, quelle que soit la sélection**

- Définissez un **Prix fixe** (ex : 49,90 €)
- Définissez un **Nombre d'articles** requis (ex : 5 articles)
- Le prix ne change pas selon les produits choisis
- Les prix individuels des produits sont masqués dans la liste
- Les Options Supplémentaires (upsell) s'ajoutent PAR-DESSUS ce prix fixe

### 🔹 Remises par Paliers (TIERED)
**Remise progressive selon la quantité ou la valeur du panier**

- Définissez des paliers : ex. 1-2 articles → 0%, 3-5 articles → 10%, 6+ articles → 20%
- La remise s'adapte automatiquement en fonction du contenu du bundle
- Basé sur `ITEM_COUNT` (nombre d'articles) ou `CART_VALUE` (valeur totale)

---

## 6. Blocs Visuels (Design)

Dans l'onglet **"Design"** de l'éditeur, vous ajoutez et organisez des blocs visuels :

| Bloc | Description |
|---|---|
| **Barre d'étape** | Navigation visuelle entre les étapes (cercles numérotés ou avec images) |
| **Liste de produits** | Grille des produits sélectionnables (cl assique ou superposition) |
| **Titre** | Titre `h1`–`h6` stylisable |
| **Texte** | Paragraphe de description |
| **Image** | Image libre avec alignement |
| **Héro** | Bannière grande image + titre + sous-titre |
| **Split** | Mise en page image + texte côte à côte |
| **Spacer** | Espace vertical ajustable |
| **Options supplémentaires** | Upsell : cases à cocher pour options payantes en plus |

Chaque bloc a un onglet **"Style"** pour personnaliser couleurs, tailles, polices, etc.

### Barre d'étape — Options de style
- Couleur active / complétée / inactive des cercles
- Couleur des lignes de connexion
- Couleur des labels
- Taille de police
- Affichage ou masquage des lignes de connexion

### Liste de produits — Options
- **Colonnes** : 2, 3 ou 4 (desktop) / 1 ou 2 (mobile)
- **Layout** : `Classique` (image + titre + bouton) ou `Superposition` (bouton par-dessus l'image)
- **Couleur des titres** des produits
- **Couleur des prix** des produits
- **Couleur / survol du bouton "Ajouter"**

### Options supplémentaires (Upsell)
- Chaque option a un **titre**, une **description courte**, une **image**, un **prix** et une **URL variante Shopify**
- Mode `multiple` : plusieurs options cochables simultanément
- Mode `unique` : une seule option à la fois (radio)
- Chaque option cochée s'ajoute au total du bundle
- Les variantes upsell sélectionnées sont ajoutées au panier avec le bundle

---

## 7. Styles Globaux

Dans la sidebar, section **"Styles Globaux"** (accessible depuis le niveau 1) :

| Paramètre | Effet |
|---|---|
| Couleur des bordures | Bordure du widget entier |
| Arrière-plan | Fond du widget |
| **Arrière-plan du total** | Fond de la bande "Total du pack" |
| **Bordure du total** | Bordure de la bande "Total du pack" |
| **Texte du total** | Couleur du texte dans la bande total |
| **Fond — Suivant / Ajouter au panier** | Bouton de navigation principal |
| **Texte — Suivant / Ajouter au panier** | Texte du bouton principal |
| **Fond survol — Suivant / Ajouter** | Couleur du bouton au survol |
| **Fond — Précédent** | Bouton de navigation secondaire |
| **Texte & bordure — Précédent** | Couleur du bouton secondaire |
| Épaisseur de la bordure | En pixels |
| Rayon des coins | Arrondi général du widget |

---

## 8. Ajouter le Bloc au Thème Shopify

### Étapes dans l'éditeur de thème Shopify

1. Allez dans **Boutique en ligne → Thèmes → Personnaliser**
2. Naviguez sur la **page produit** du bundle (utilisez l'URL du produit créé par l'app)
3. Dans la colonne gauche, trouvez la section **"Informations sur le produit"**
4. **Masquez ou supprimez** les blocs natifs Shopify : Prix, Sélecteur de variante, Bouton d'achat (ils seront remplacés par le widget)
5. Cliquez **"Ajouter un bloc"** → choisissez **"SAR Bundle Builder"**
6. Configurez les options du bloc (voir ci-dessous)
7. **Enregistrez** le thème

### Options du bloc dans l'éditeur de thème

| Option | Description |
|---|---|
| Couleur principale | Bouton "Ajouter", indicateurs de sélection |
| Couleur des bordures | Bordure du widget (valeur par défaut) |
| Arrière-plan | Fond du widget |
| Couleur du texte | Texte général du widget |
| **Sélecteur CSS du prix** | *(voir section 9)* |
| Épaisseur de la bordure | 0–6 px |
| Rayon des coins | 0–32 px |

> **Note :** Les couleurs définies dans le bloc Liquid sont les valeurs par défaut. Les couleurs configurées dans l'éditeur visuel SAR (Styles Globaux, blocs) les surchargent.

---

## 9. Compatibilité Thèmes — Sélecteur de Prix

Le widget SAR Bundle met à jour **dynamiquement le prix affiché par votre thème** (hors du widget) à chaque sélection du client. Il cible automatiquement les sélecteurs CSS des thèmes les plus populaires :

| Thèmes supportés nativement | Sélecteur CSS ciblé |
|---|---|
| **Dawn**, Sense, Studio, Craft, Ride | `.price-item--sale`, `.price__regular .price-item--regular` |
| **Debut**, Brooklyn, Narrative, Boundless | `[data-product-price]` |
| Impulse, Pipeline, Broadcast | `.product__price` |
| Minimal, Simple, Supply | `.product-single__price` |

### Mon thème n'est pas dans la liste ?

Si le prix du thème ne se met pas à jour automatiquement :

1. **Inspecter l'élément prix** dans votre navigateur (clic droit → Inspecter)
2. Notez la **classe CSS** de l'élément qui affiche le prix (ex : `.mon-theme__price`)
3. Dans l'éditeur de thème Shopify → bloc **SAR Bundle Builder**
4. Trouvez le champ **"Sélecteur CSS du prix (optionnel)"**
5. Saisissez votre sélecteur (ex : `.mon-theme__price`) — séparez-en plusieurs par une virgule
6. Enregistrez → le prix se met maintenant à jour en temps réel

**Exemple pour plusieurs sélecteurs :**
```
.product__price-value, .price-amount
```

> Ce champ est prioritaire : vos sélecteurs sont testés en premier, avant les sélecteurs natifs.

---

## 10. Architecture Technique

### Flux de données

```
[Admin Shopify]
      │
      ▼
[app.bundle.$id.tsx] ──Prisma──▶ [Base de données]
      │
      │ (sauvegarde JSON storefrontDesign + steps + products)
      ▼
[App Proxy: /apps/sar-bundle/api/bundle/:ref]
      │
      │ (retourne le bundle enrichi avec prix/images Shopify API)
      ▼
[bundle-builder.js] ──fetch /variants/:id.js──▶ [Storefront Shopify]
      │
      │ (construit le DOM, gère les sélections, calcule le total)
      ▼
[Page panier] ←── [POST /cart/add avec _sar_bundle_components]
      │
      ▼
[Cart Transform Function] → regroupe les articles sous le produit bundle parent
```

### Variables CSS dynamiques

Les styles sont injectés via des variables CSS sur le root element `.sar-bundle` :

| Variable | Source |
|---|---|
| `--sar-color-primary` | Config globale `colorPrimary` |
| `--sar-color-border` | Config globale `colorBorder` |
| `--sar-total-bg` | Styles globaux `totalBg` |
| `--sar-total-text-color` | Styles globaux `totalTextColor` |
| `--sar-btn-primary-bg` | Styles globaux `btnPrimaryBg` |
| `--sar-btn-primary-color` | Styles globaux `btnPrimaryColor` |
| `--sar-stepbar-active-bg` | Style du bloc Barre d'étape `activeBg` |
| `--sar-product-title-color` | Style du bloc Liste de produits `titleColor` |
| `--sar-product-price-color` | Style du bloc Liste de produits `priceColor` |

---

## 11. Dépannage

### Le prix de la page produit ne se met pas à jour

→ Votre thème utilise un sélecteur CSS non couvert nativement. Suivez la procédure de la **section 9** pour ajouter votre sélecteur personnalisé.

### "Cart error" lors de l'ajout au panier

Causes possibles :
- Une option supplémentaire (upsell) a un **variant GID invalide** → vérifiez que l'URL du produit upsell est correcte dans l'éditeur
- Le produit bundle est **archivé ou brouillon** sur Shopify → passez-le en "Actif"
- La **variante par défaut** du produit bundle n'existeplus

### Le bundle n'apparaît pas sur la page produit

Vérifiez que :
1. Le produit a le metafield `custom.sar_bundle_id` renseigné avec l'UID du bundle
2. Le metafield `custom.sar_bundle_active` est `true`
3. Le bloc "SAR Bundle Builder" est bien ajouté dans l'éditeur de thème

### Les prix s'affichent à "0,00 €"

→ L'enrichissement des prix depuis l'API Shopify a échoué. Vérifiez que les variantes des produits du bundle existent toujours sur Shopify (produit non supprimé).

### Le total n'inclut pas les options supplémentaires (upsell) en mode Prix Fixe

→ Ce comportement est normal et voulu : le prix fixe est la base, les upsells s'y **ajoutent par-dessus**. Vérifiez que le champ "Prix" de l'option upsell est bien renseigné dans l'éditeur.

---

*Dernière mise à jour : Avril 2026*
