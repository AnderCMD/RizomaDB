---
layout: home
hero:
  name: RizomaDB
  text: Toutes vos bases de données, au même endroit.
  tagline: Un client de bases de données gratuit, open source et sans télémétrie pour VS Code. 24 moteurs, une grille de résultats, sûr par défaut.
  image: { src: /logo.svg, alt: RizomaDB }
  actions:
    - { theme: brand, text: Premiers pas, link: /fr/guides/getting-started }
    - { theme: alt, text: Moteurs, link: /fr/reference/engine-matrix }
    - { theme: alt, text: GitHub, link: "https://github.com/AnderCMD/RizomaDB" }
features:
  - { icon: "🔌", title: "Connectez-vous depuis un écran de logos", details: "Choisissez votre moteur ; l'hôte, le port et l'utilisateur sont déjà remplis. Environnements avec protection, tunnels SSH, proxys et secrets uniquement dans le stockage de secrets de VS Code.", link: /fr/guides/connections }
  - { icon: "▶️", title: "Un bouton Exécuter au-dessus de chaque instruction", details: "Exécuter, Expliquer, Tout exécuter, paramètres, historique avec recherche et notebooks, dans le langage de chaque moteur.", link: /fr/guides/query-editor }
  - { icon: "🗂️", title: "Une grille conçue pour explorer", details: "Triez, filtrez dans les lignes ou dans la base, redimensionnez, masquez, panneau d'enregistrement, copiez en CSV/JSON/Markdown et Charger plus sur tous les moteurs.", link: /fr/guides/results-grid }
  - { icon: "✏️", title: "Modifiez sur place, en sécurité", details: "Double-cliquez sur une cellule. Les changements attendent comme en attente ; relisez le SQL et appliquez-les en une transaction, avec détection des conflits.", link: /fr/guides/editing-data }
  - { icon: "🛡️", title: "Sûr par défaut", details: "Des politiques en couches où la plus stricte l'emporte, un point d'audit unique pour toute écriture, production en lecture seule, masquage de colonnes.", link: /fr/enterprise/policy }
  - { icon: "🌍", title: "Quatre langues", details: "Anglais, espagnol, portugais (Brésil) et français. Changez de langue dans l'extension et suivez le guide intégré qui vous prend par la main.", link: /fr/guides/language-and-settings }
---

::: warning Pré-version
RizomaDB n'est pas encore publié sur une place de marché et la v1.0 n'est pas prête. La [comparaison honnête](/fr/market/honest-comparison) et la [liste d'acceptation](/es/release/v1-checklist) (en espagnol) disent exactement ce qui est et n'est pas vérifié.

**Les services cloud ne sont pas confirmés.** RizomaDB n'a été testé qu'avec des moteurs locaux et des émulateurs officiels, jamais avec un vrai compte cloud (AWS, Google Cloud, MongoDB Atlas, PostgreSQL/MySQL gérés). Testez avec un utilisateur en lecture seule ou une base jetable avant de vous y fier : voir [Cloud et services gérés](/fr/engines/#cloud-et-services-gérés-non-confirmés).

Les textes en portugais et en français ont été écrits avec l'aide d'une IA et n'ont pas encore été relus par des locuteurs natifs.
:::

## Par où commencer
- Si vous débutez : [Premiers pas](/fr/guides/getting-started), puis [Connexions](/fr/guides/connections).
- Si vous venez d'un autre outil : [Migrer vers RizomaDB](/fr/guides/migration) et la [comparaison honnête](/fr/market/honest-comparison).
- Si vous cherchez un moteur : la [matrice des capacités](/fr/reference/engine-matrix) et les [pages des moteurs](/fr/engines/README).
- Si vous allez le déployer pour une équipe : [Politiques](/fr/enterprise/policy), [Déploiement](/fr/enterprise/deployment) et [Conformité](/fr/enterprise/compliance).
- Si quelque chose échoue : [Dépannage](/fr/guides/troubleshooting).
