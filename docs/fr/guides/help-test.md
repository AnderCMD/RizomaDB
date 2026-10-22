# Aidez à tester RizomaDB

RizomaDB a été testé avec des moteurs locaux, des conteneurs et des émulateurs officiels, par une seule personne. Il n'a **pas** été testé avec de vrais comptes cloud ni par beaucoup de gens sur beaucoup de systèmes, et c'est là que les bugs ont le plus de chances de se cacher. Si vous pouvez essayer l'un des points suivants, un court rapport est précieux, **que cela fonctionne ou non**.

## Ce qui est le plus utile
1. **Cloud et services gérés** : Amazon DynamoDB sur AWS, Google Cloud Firestore, MongoDB Atlas et PostgreSQL/MySQL gérés (RDS, Aurora, Cloud SQL, Azure Database, Neon, Supabase, PlanetScale). Voir [Cloud et services gérés](../engines/README.md#cloud-et-services-gérés-non-confirmés).
2. **Autres systèmes d'exploitation et lecteurs d'écran** : Windows et Linux avec NVDA, JAWS ou Orca ; un parcours au clavier seul des écrans ([Utiliser le clavier](keyboard.md)).
3. **Vos propres bases de données** : tables plus grandes, types de colonnes étranges, réseaux lents, tunnels SSH et proxys.
4. **Traductions** : les locuteurs natifs du portugais (Brésil) et du français peuvent relire les textes ([CONTRIBUTING.fr.md](https://github.com/AnderCMD/RizomaDB/blob/main/CONTRIBUTING.fr.md#relire-une-traduction)).

## Comment tester en sécurité
- Utilisez un **utilisateur en lecture seule** ou une base jetable. Activez d'abord l'interrupteur de lecture seule de la connexion.
- Parcourez les étapes du formulaire de rapport : se connecter, explorer, exécuter une requête, charger plus, trier et filtrer. Ne modifiez des données que dans une table que vous pouvez perdre.
- RizomaDB n'envoie rien nulle part : il n'y a pas de télémétrie. Un rapport n'existe que si vous l'écrivez.

## Comment signaler
Ouvrez un issue **Test report** sur GitHub (le formulaire liste les étapes à cocher). Indiquez le moteur et la version, où il tourne, votre système, ce qui a fonctionné et, en cas d'échec, le message exact. **Ne collez jamais de mots de passe, jetons, clés ni données privées.** Le canal de sortie *RizomaDB policy* et la barre d'état montrent ce qui a bloqué une action.

Un rapport qui dit « ça marche » est aussi utile qu'un bug : c'est le seul moyen pour qu'un service passe de « non confirmé » à « testé ».
