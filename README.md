# SAR Bundle V2 - Guide De L'application

SAR Bundle V2 est une application Shopify personnalisée offrant une expérience avancée de création de lots (bundles) interactifs pour les clients.

## Architecture & Organisation

Voici comment l'application est organisée, fichier par fichier :

### Extensions Shopify

1. **`extensions/sar-bundle-ui/` (Theme App Extension)**
   - **`blocks/bundle_builder.liquid`** : Le point d'entrée Frontend. C'est le bloc que le marchand ajoute via l'éditeur de thème Shopify. Il charge les scripts et CSS pour afficher l'interface d'achat du bundle.
   - **`assets/bundle-builder.js`** : Le cœur de l'application côté client (Storefront). Il gère le changement d'étapes, la sélection des produits, le calcul des règles de prix, le drag-and-drop sur mobile, et l'ajout au panier.
   - **`assets/bundle-builder.css`** : Les styles (adaptés à la charte et compatibles avec différents thèmes) pour le widget côté client.
   - **`snippets/sar-bundle-cart-composition.liquid`** : Un snippet utilisé pour afficher le détail du contenu d'un bundle dans la page panier traditionnelle du thème.

2. **`extensions/sar-bundle-cart-transform/` (Function / Cart Transform)**
   - **`src/cart_transform_run.js`** : La fonction Shopify qui s'exécute quand un bundle est ajouté au panier. Elle regroupe tous les articles liés (options (`_sar_bundle_components`)) sous une ligne parente (le bundle produit) pour simplifier le paiement et permettre une gestion d'inventaire précise.

### Application Serveur (Remix / Node.js)

1. **API et Base de Données (`prisma/`)**
   - **`schema.prisma`** : Le modèle de données. On y trouve `Bundle`, `BundleStep`, `StepProduct`, et `StepRule`. Cela régit la façon dont est construite l'offre.

2. **Fonctions utilitaires (Backend - `app/utils/`)**
   - **`bundle.server.ts`** : Le "cerveau" serveur. Exécute les requêtes Prisma (création, mise à jour, listage des bundles) et effectue la sérialisation JSON des arbres complexes.
   - **`shopify-bundle-product.server.ts`** : Gère la synchronisation entre la base de données de l'application et les produits natifs Shopify (création du produit Bundle qui sert de conteneur, synchro des prix et de la galerie).
   - **`storefront-bundle-enrich.server.ts`** : S'assure que les produits des bundles affichent bien leurs vrais titres/images dans la boutique même si le marchand a mis à jour le produit depuis la création du bundle.
   - **`storefront-design.ts`** : Définit le schéma des designs visuels de la version V2 de l'éditeur (Bannière Hero, Grilles, Barre d'étape, etc.).

3. **Routes (Pages et API d'Admin - `app/routes/`)**
   - **`app._index.tsx`** : Le tableau de bord principal de l'application. Affiche les statistiques des bundles et les actions rapides.
   - **`app.bundles.tsx`** : La liste complète des bundles existants permettant leur gestion (CRUD).
   - **`app.bundle.$id.tsx`** : **Route la plus importante.** Elle sert à créer ou éditer un bundle spécifique. C'est ici que l'on charge les données et que l'on traite la sauvegarde côté serveur. *Un composant "ErrorBoundary" est maintenant inclus ici pour intercepter spécifiquement les crashs et afficher la cause précise à l'écran.*
   - **`apps.sar-bundle.api.bundle.$id.tsx`** (App Proxy) : Le pont de communication sécurisé. Il permet au widget Storefront (côté client) de récupérer depuis la base de données la configuration JSON d'un bundle.

4. **Composants d'interface (Frontend Admin - `app/components/bundle-editor/`)**
   - **`BundleEditorForm.tsx`** : Le conteneur principal du formulaire complexe de création de bundle, regroupant la gestion de l'état global React (`useState`).
   - **`BundleVisualEditor.tsx`** : Sépare l'écran en 2: à gauche la liste des étapes (Sidebar), à droite un aperçu dynamique de l'application (BundleStorefrontPreview).
   - **`SidebarLevel2.tsx`** : L'éditeur d'étapes (ajout de blocs, sélection de produits). Entièrement revu pour être natif à Polaris avec des icônes contextuels, un menu (3 petits points) et une intégration Drag & Drop.
   - **`SidebarLevel3.tsx`** : L'éditeur de paramètres par Bloc (ex: couleurs d'un texte, style spécifique d'une barre de progression 'Cercles dorés').
   - **`BundleStorefrontPreview.tsx`** : L'aperçu simulé. C'est un rendu React similaire à ce qui apparait dans le thème Liquid, permettant au marchand de prévisualiser dynamiquement ses changements. Récemment rendu 100% cliquable et interactif pour accélérer la conception.

---

## Guide d'Utilisation

### Créer un Bundle

1. Allez dans l'application SAR Bundle, onglet "Nouveau Bundle".
2. Dans le panneau latéral, vous commencez par définir les **Étapes** du bundle (Ex: 1. Choix du coffret, 2. Vos 3 produits, 3. Options bonus).
3. Cliquez sur une étape pour en voir le détail.
4. **Ajouter un Bloc** : La mise en page (ex: Image Hero en haut, une barre de progression, un titre).
5. Gérer la **Liste de produits** (permanente) : Cliquez sur le bloc "Liste de produits" depuis le panneau latéral pour choisir les produits Shopify autorisés pour cette étape, changer les quantités requises (Min: 3 / Max: 3 pour forcer un choix précis).

> **Astuce visuelle** : Le panneau interactif à droite vous permet de cliquer n'importe où (sur une image, un texte, ou un point de progression) pour ouvrir immédiatement l'onglet d'édition correspondant à gauche. Le bouton d'ajout de bloc dispose désormais d'un menu déroulant facile à lire.

### Rendre le Bundle visible sur la boutique

Pour afficher le widget d'achat à vos clients :
1. Créez un modèle de produit spécifique dans votre Éditeur de Thème Shopify ou naviguez sur la page du produit *Bundle* généré automatiquement par l'application (son statut doit être "Actif").
2. Dans la section produit de ce thème, supprimez les blocs d'achat habituels (Prix, Sélecteur de variante, Bouton Ajouter au panier).
3. À la place, ajoutez le bloc d'application **"Bundle Builder (V2)"**. Ce bloc prendra tout l'espace disponible et affichera le configurateur par étapes.

### Gérer les Styles

Chaque élément modifiable dispose d'un pinceau "Style". 
Par défaut, le bundle s'adapte à la police et aux couleurs de base de votre thème Shopify grace à l'utilisation des CSS dynamiques (ex: `var(--color-primary)`). Vous n'avez donc dans la plupart des cas rien à coder ! Cependant, des surcharges individuelles restent possibles au clic sur le bloc.

---

*Note de Développement : Un `ErrorBoundary` personnalisé a récemment été ajouté au routeur de produit pour intercepter et afficher clairement d'éventuels plantages (Application Error).*
