# Goal de livraison T04

Mandat utilisateur : « fini T04 puis une fois mergé tu t'arretes ».
Cette instruction autorise la livraison Git/PR/merge de T04 après ses gates ;
elle remplace l’interdiction initiale sur cette portée uniquement. T05 reste hors mission.
Mode LARGE. Un écrivain /root dans worktrees/s01-espace-isole ; revue indépendante.

Critères : parcours natif password/TOTP/secours, preuves LOA2/J1/session et matrice
V3 complète ; tests réels reproductibles ; reviewer et Lead Tech indépendants ;
CI de la tête observée PASS ; commit/PR/merge traçables ; arrêt après merge.
T00–T03 sont les dépendances non commitées nécessaires au livrable T04, à qualifier
avec la livraison ; aucun AC d’activation S01 ni état DONE ne sera déduit de T04.

État de livraison : ACTIVE jusqu’au merge observé. Le Goal technique avant Ship
est suivi séparément dans [t04-technical-goal.md](t04-technical-goal.md) ; il
ne remplace ni CI, ni Lead Tech, ni la preuve de fusion. Blocages précédents repris : pont required-actions/J1 et refus TOTP.
L’unification des origines natives/callback vers localhost fixe est une correction
minimale de configuration : Design/ADR imposent une origine/issuer connue, sans
exiger la séparation 127/localhost. Source UI/API fournisseur inchangée.
Le trafic navigateur Keycloak passe par le coordinateur ; aucun chemin direct
ne peut modifier credentials sans grant lié sujet et barrière J1 sous verrou.
