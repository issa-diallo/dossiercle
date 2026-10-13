# Revue indépendante Plan — S01

## Révision et indépendance

2026-10-11, reviewer `/root/s01_reviewer`, distinct auteur `/root`, lecture seule.
Modèle hérité, effort/coût non observables. Pas de PR/CI/Execute/Verify runtime.
Research/Design, Plan, S01/R01–R05, Architecture/OTP et dépôt réel confrontés.

## Révision 1 — CHANGES_REQUIRED

Critical 0 ; Major 1 ; Minor 1.

**S01-P-01 — Major :** fenêtre CREATE DATABASE→REVOKE où PUBLIC peut permettre
CONNECT aux anciens rôles A vers B. ACL template non héritées, CONNECT contrôlé
à la connexion selon documentation primaire [PG17 privilèges](https://www.postgresql.org/docs/17/ddl-priv.html)
et [CREATE DATABASE](https://www.postgresql.org/docs/17/sql-createdatabase.html).
Correction minimale : créer ALLOW_CONNECTIONS false ; retirer PUBLIC CONNECT/TEMP
et accorder migration depuis DB maintenance ; ouvrir ensuite, grant runtime
après schéma/ACL. Test pause CREATE→REVOKE avec concurrence A→B et reprise/crash.

**S01-P-02 — Minor :** LOA2/`acr=2` fixé T04 à synchroniser en Design, issuer/client
attendus et preuve native+epoch, refus si insuffisante.

Autres contrôles conformes : quatre AC, J1/transactions, bootstrap S01 sans S02,
migrations/API, chemins futurs explicites, commandes futures et Node24, suites
réelles/fixtures synthétiques, B05/B06 hors scope, pas nouveau service métier.

## Corrections auteur

Design et Plan synchronisés : bases fermées dès CREATE, ACL avant ouverture,
crash/reprise fermés et test concurrence exact ; Design BFF explicite LOA2/acr2,
provenance attendue et aucune autorisation sur le claim seul. Sources PG17
vérifiées par auteur, recherche ciblée seulement, aucun runtime PG.

## Révision 2 — PASS

Retour indépendant : **Design PASS revue3 et Plan PASS revue2**. S01-P-01/P-02
fermés : base fermée dès création/ACL avant ouverture/test pause A→B et reprises,
LOA2/acr2 synchronisé avec issuer/client, preuve native et J1, jamais claim seul.
Critical0, Major0, Minor0 ouverts.

Les huit contrôles demandés sont satisfaits documentairement :
1. Research/Design/Plan cohérents et quatre AC couverts.
2. Isolation backend/PG/J1 et permissions courantes prévues.
3. Migrations/transactions/API réalisables, pas atomicité distribuée fictive.
4. Chemins nouveaux et commandes futures explicités, fixtures reproductibles.
5. Tests auth/validation/concurrence/crash/lecture-écriture inter-agences définis.
6. B05/B06 hors tâches et non bloquants pour espace vide.
7. Aucun arbitrage indispensable repoussé à Execute ; N2/N3 restent preuves futures.
8. Pas de service métier supplémentaire ni complexité étrangère au socle V1 acquis.

Aucun test runtime exécuté. PASS de préparation seulement ; prochaine étape
Worktree Setup→Execute sous mandat compatible, pas dans cette mission.
