# Langue et paramètres

## L'écran des paramètres
**RizomaDB : Ouvrir les paramètres** (l'engrenage dans la vue des connexions) affiche chaque paramètre comme une carte avec un bouton de réinitialisation par carte, une zone de recherche et **Tout réinitialiser**. Les modifications sont enregistrées dans vos paramètres utilisateur au fur et à mesure. La liste complète avec les valeurs par défaut est dans la [Référence des paramètres](../reference/settings.md) ; les groupes intéressants sont :

| Groupe | Ce que vous pouvez changer |
|---|---|
| Langue | La langue de l'extension (voir ci-dessous) |
| Résultats | Où s'ouvrent les résultats (moitié basse, zone entière, à côté) |
| Environnements | Environnements supplémentaires et leur protection |
| Requêtes | Lignes par page, nombre maximal de lignes, délai d'expiration |
| Éditeur de requêtes | Lentilles d'exécution et surlignage de l'instruction |
| Modification | Enregistrer chaque modification immédiatement |
| Arborescence des connexions | Regrouper les connexions par type de moteur |
| Sécurité | Confirmations, production en lecture seule |
| Historique, Audit, MCP, IA | Rétention et ce qui est enregistré, le serveur MCP en lecture seule optionnel, l'assistant d'IA optionnel |

## Langue
RizomaDB parle **anglais, espagnol, portugais (Brésil) et français**. Par défaut, il suit la langue d'affichage de VS Code. Pour ne changer que l'extension, définissez `rizomadb.language` sur `en`, `es`, `pt` ou `fr` ; les écrans déjà ouverts gardent l'ancienne langue jusqu'à leur réouverture.

Les noms des commandes, des paramètres et les titres des vues sont fournis à VS Code par son propre mécanisme, donc ils suivent toujours la langue **de VS Code**. L'écran des paramètres a un bouton qui ouvre le sélecteur de langue de VS Code. Les messages d'un serveur de base de données (par exemple une erreur de syntaxe) sont affichés tels que le serveur les a écrits ; les messages que RizomaDB écrit lui-même sont traduits. Le texte espagnol est relu par le mainteneur ; les traductions portugaise et française ont été écrites avec l'aide d'une IA et **n'ont pas** été relues par des locuteurs natifs, donc les corrections de formulation sont les bienvenues.

## Le guide
**RizomaDB : Ouvrir le guide** ouvre une visite pas à pas avec des boutons qui réalisent chaque étape pour vous. Il apparaît aussi une fois, la première fois que l'extension s'exécute. Il existe un parcours *Premiers pas* équivalent dans la page d'accueil de VS Code.
