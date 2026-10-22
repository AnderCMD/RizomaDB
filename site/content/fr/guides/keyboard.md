# Utiliser RizomaDB au clavier

RizomaDB est conçu pour s'utiliser sans souris. Si vous trouvez quelque chose qui en exige une, c'est un bug : merci de le signaler.

## Se déplacer
- **Tab / Maj+Tab** se déplacent entre les contrôles de chaque écran (Nouvelle connexion, Paramètres, Historique, le guide, la grille de résultats, le concepteur de tables, le diagramme ER et la visionneuse de plans). Chaque écran est un seul groupe d'arrêts de tabulation ; lors d'un test de 40 appuis sur Tab sur l'écran Historique, le focus ne s'est jamais bloqué.
- Un anneau visible indique toujours où vous êtes. Les boutons qui n'ont qu'une icône ont un nom lu par les lecteurs d'écran et une info-bulle qui apparaît aussi quand le bouton reçoit le focus du clavier.
- Dans les listes qui se comportent comme une arborescence (le plan d'exécution, l'explorateur), Tab entre une fois dans la liste et les **flèches** se déplacent à l'intérieur.

## Dans l'éditeur
| Touches | Ce que ça fait |
|---|---|
| Ctrl/⌘ + Entrée | Exécute l'instruction sous le curseur |
| Ctrl/⌘ + Maj + Entrée | Exécute la sélection |

## Dans la grille de résultats
Les touches pour se déplacer entre les cellules, sélectionner des lignes, modifier, annuler et copier sont dans [La grille de résultats](results-grid.md). Le bouton clavier de la barre de la grille les affiche dans l'application.

## Comment cela a été vérifié
- Un audit automatique (`test/a11y/keyboard.js`) s'exécute sur chaque écran avec les thèmes clair et sombre : tout contrôle qui peut recevoir le focus a un nom et un anneau de focus visible, il n'y a pas de `tabindex` positif et rien qui ressemble à un élément cliquable n'est hors de l'ordre de tabulation. Il a trouvé un vrai problème (les zones de recherche ne changeaient que de 1 px de bordure au focus), maintenant corrigé. axe-core ne signale aucune violation sur les mêmes écrans.
- Le responsable du projet a parcouru les écrans avec un lecteur d'écran sur macOS, Windows et Linux sans trouver de problème.
- Non fait : un audit d'accessibilité indépendant. Si quelque chose est difficile à atteindre au clavier, ouvrez un issue.
