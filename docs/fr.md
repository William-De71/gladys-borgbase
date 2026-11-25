# BorgBase

## Présentation

Cette intégration surveille dans Gladys les dépôts de sauvegarde d’un compte **BorgBase** (hébergement distant pour BorgBackup et restic) : la taille de chaque dépôt, son quota, le temps écoulé depuis sa dernière sauvegarde et l’espace utilisé par le compte. Elle vous prévient, par vos scènes, quand une sauvegarde n’arrive plus ou qu’un quota se remplit. Elle lit l’API GraphQL officielle de BorgBase avec un jeton d’API **Read Only**, et ne modifie rien sur votre compte.

Chaque dépôt devient un appareil, le compte aussi. Les déclencheurs de scène réagissent à une nouvelle sauvegarde, à une sauvegarde en retard, à la reprise des sauvegardes et à un quota qui atteint 80, 90 ou 100 %.

Transport : cloud. Seul `api.borgbase.com` est contacté, toutes les 15 minutes par défaut ; vos sauvegardes ne passent jamais par Gladys.

BorgBase est un service de BorgBase Ltd. Cette intégration n’est pas affiliée à BorgBase.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Un compte BorgBase avec au moins un dépôt.
- Un jeton d’API : sur borgbase.com, ouvrez **Account → API**, créez un jeton avec la permission **Read Only** (suffisante, et la plus sûre), donnez-lui une date d’expiration si vous le souhaitez, puis copiez-le.

## Configuration

| Champ                     | Rôle                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Jeton d’API               | Le jeton Read Only.                                                                                                           |
| En retard après (heures)  | Pour les dépôts sans surveillance BorgBase : 26 par défaut (une sauvegarde par jour). Un dépôt surveillé utilise ses X jours. |
| Intervalle de lecture (s) | De 300 à 3 600 secondes, 900 par défaut ; c’est aussi le délai de réaction des déclencheurs de scène.                         |
| Langue des textes         | Noms des appareils, résumés et sorties des scènes ; automatique par défaut.                                                   |

Enregistrez, puis appuyez sur **Tester la connexion** : elle indique combien de dépôts ont été lus et combien ont une sauvegarde en retard.

Un dépôt est **en retard** quand il n’a reçu aucune nouvelle sauvegarde depuis plus longtemps que son délai : la **surveillance** du dépôt sur BorgBase (**Edit repository → Monitoring : X jours**) si elle est active, sinon le champ **En retard après**. Un dépôt jamais écrit compte depuis sa création.

## Utilisation

### Appareils

Dans **Découverte**, créez les appareils voulus :

- **Compte BorgBase <e-mail>** : espace utilisé (Go), limite de stockage utilisée (%), dépôts, sauvegardes en retard.
- **BorgBase <dépôt>** : taille du dépôt (Go), quota utilisé (%, seulement si le dépôt a un quota), temps depuis la dernière sauvegarde (heures).

Gladys garde leur historique : comparez « Temps depuis la dernière sauvegarde » à n’importe quel délai dans une condition de scène, ou tracez la taille dans un graphique. Une valeur que BorgBase ne donne pas est omise, jamais mise à 0.

### Déclencheurs de scène

Tous filtrent par appareil (laissez vide pour tous) :

- **Nouvelle sauvegarde** : un dépôt a été écrit. BorgBase donne l’heure de la dernière écriture : un nettoyage (prune) ou un compactage compte aussi.
- **Sauvegarde en retard** : un dépôt n’a reçu aucune nouvelle sauvegarde dans son délai (variables `hours_since_backup`, `threshold_hours`).
- **Sauvegardes reprises** : un dépôt en retard a de nouveau reçu une sauvegarde.
- **Seuil de quota atteint** : un dépôt (de son quota) ou le compte (de sa limite de stockage) atteint 80, 90 ou 100 % ; filtres sur le seuil et la portée.

Chaque événement donne l’appareil, le nom du dépôt, sa taille et une phrase `summary`. La première lecture après un démarrage, un nouveau jeton ou un nouveau délai sert de référence : rien ne se déclenche.

Exemples :

- Quand **Sauvegarde en retard** se déclenche → envoyer le `summary` sur votre téléphone.
- Quand **Seuil de quota atteint** à 90 % pour le compte → envoyer un message pour penser à l’offre.
- Chaque lundi à 9 h → **Lire le compte**, puis envoyer son `summary`.

### Actions de scène

- **Lire un dépôt** donne son état (`ok`, `overdue`, `never`), sa taille, son quota, les heures depuis la dernière sauvegarde et une phrase `summary`. Un nombre inconnu vaut -1.
- **Lire le compte** donne l’offre, l’espace utilisé, la limite de stockage, les dépôts en retard et une phrase `summary`.

### Widgets

![Le widget BorgBase avec la jauge de stockage, trois tuiles et les dépôts à surveiller, le widget des dépôts de sauvegarde avec un badge par dépôt, et le widget d’espace avec l’historique de la taille d’un dépôt (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-borgbase/main/docs/assets/widgets.fr.png)

- **BorgBase** : limite de stockage utilisée, espace utilisé, dépôts, sauvegardes en retard, les dépôts à surveiller (en retard, quota à 90 % ou plus) et un lien vers BorgBase.
- **Dépôts de sauvegarde** : chaque dépôt avec sa taille, son quota, sa dernière sauvegarde et un badge ; à surveiller d’abord, par nom, ou les plus gros d’abord.
- **Espace BorgBase** : l’historique de la taille d’un dépôt, ou de tout le compte. C’est l’historique que garde Gladys : créez d’abord l’appareil.

## Dépannage

- **« BorgBase refuse le jeton d’API »** : le jeton est faux, expiré ou supprimé : créez-en un nouveau dans **Account → API**.
- **« Le jeton ne peut pas lire le compte »** : le jeton ne lit que les dépôts ; l’appareil du compte et la limite de stockage sont omis.
- **« BorgBase demande de ralentir »** : augmentez l’intervalle de lecture.
- **Une sauvegarde passe en retard trop tôt** : vérifiez la **surveillance** du dépôt sur BorgBase, ou augmentez **En retard après**.
- Signalez un problème avec les versions de Gladys et de l’intégration et ses journaux ; ne collez jamais votre jeton.
