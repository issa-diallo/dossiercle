# T04 — secours natif concurrent et protection du coordinateur

Date : 2026-10-13. Findings et preuves conservés, sans PASS natif inventé.

## Finding upstream réel

Sur deux sessions d’authentification natives distinctes du même sujet, deux
soumissions concurrentes du même code/index ont produit deux Code OIDC valides
avec signature vérifiée et acr2. Résultat : `SYNTHETIC_RECOVERY_DOUBLE_ACCEPTED`,
répété. Les commandes historiques directes ont échoué. Le wrapper dédié
`pnpm test:auth:upstream` a été réellement exécuté au checkpoint indiqué
ci-dessous. La cause interne n’est pas démontrée.

Rejeu exact du wrapper le 2026-10-13, avant ajout du scénario faults :
**FAILED, 5/5 cas sélectionnés** avec
`SYNTHETIC_RECOVERY_DOUBLE_ACCEPTED`. Le sélecteur recovery couvrait les cinq
variantes de scénario ; aucun BFF émis dans cette expérience privée.

L’expérience privée tient le sujet sous J1 PENDING et verrou d’autorité ; elle
n’émet aucun cookie BFF ni accès métier. Après l’échec, SQL rollback et J1 courant
ferment la fixture. Aucun ancien facteur/journal n’est restauré.

## Protection publique existante

Le backend autorise un formulaire natif émis une seule fois, pour le client BFF
fixe, avec jar serveur liée au grant. Les mutations distinctes du sujet sont
sérialisées sous verrou d’autorité jusqu’aux effets natifs et à la convergence J1.
Aucun port Keycloak/PI publié. Routes account/admin/token/autres clients fermées.
La configuration héritée de tous les clients est contrôlée, pas seulement celle
des quatre clients provisionnés. realm-management reste un porteur bearer-only
sans parcours navigateur effectif.

Preuves publiques réellement exécutées : deux onglets, ancien formulaire refusé,
deux POST concurrents sur formulaire émis donnent une seule réussite BFF et un
403 ; rejeu 403 ; nouveau grant du même sujet refuse le secours consommé et
accepte le code suivant. Integration native : deux effets natifs distincts sous
withGrant atteignent maxActive1. Sept tests navigateur natifs et attaques : PASS
au checkpoint 2026-10-13 (3.1 min).

La lecture native des clients étendue est PASS7/7 ; les routes supplémentaires
sont couvertes par le rejeu public PASS10/10. La revue source indépendante admet
la classification Minor contenu sous ces protections ; Review finale T00–T04
PASS_WITH_MINOR après browser12/12 et targeted1/1 confirmés. Une propriété composite de l’application
ne signifie jamais « consommation atomique native Keycloak PASS ».
