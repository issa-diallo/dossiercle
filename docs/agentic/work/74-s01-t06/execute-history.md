# Execute — #74 / S01 T06

## État

**IN_PROGRESS** — Worktree Setup PASS, 2026-10-16. Une revue indépendante a bloqué
le premier delta DDL (3 Major) ; les corrections ont reçu PASS statique. Les tests
PG ciblés valident création/replay, isolation, checkpoint failure et fencing par
owner migration. Le profil T06 reste arrêté ; aucune saga n’a créé une agence.

## Incréments

| Incrément | État | Fichiers / preuve |
|---|---|---|
| 0a bootstrap identité, capacités et mounts | PASS | [setup-0a.md](setup-0a.md), [setup-review.md](setup-review.md) |
| 0b setup froid et environnement retenu | PASS | [environment.md](environment.md), [setup-review.md](setup-review.md) |
| 1 schéma central, locks et capacités | IN_PROGRESS | 0004 appliquée après ingress fermé ; checksum `5397766a…ceffb4`. Domaine, repository, grants et intégration PG ciblée passent ; exécution métier encore absente |
| 2 coffre versionné et DDL agence | IN_PROGRESS | Store immuable, primitives DDL/fencing et tests PG ciblés passent ; aucun handler ne les orchestre encore |
| 3 routeur/pools/contextes | IN_PROGRESS | Routeur et tests unitaires ajoutés ; aucune intégration API/service de contexte |
| 4 saga/fencing/réconciliation | NOT STARTED | Le repository fournit des primitives ; saga exécutable et processus reconciler absents |
| 5 Inngest/outbox/wakeups | NOT STARTED | Handler/serveur T06 et réconciliation wakeup absents |
| 6 admission/backpressure/compatibilité | IN_PROGRESS | Admission T05 et garde-fou partiels ; capacité/backlog et preuves HTTP concurrentes à compléter |
| 7 environnements, fixtures, CI/docs | IN_PROGRESS | bootstrap/contrôle Compose et suite ciblée présents ; state-check T06, fixtures exhaustives et workflow CI absents |

## Preuves et écarts

Preuves acquises : builds packages, typecheck complet et lint PASS ; tests unitaires
coffre/routeur/domaine 7/7 et contrats provisioning 2/2 PASS ; intégration DDL
agency-provisioner 2/2 PASS avec deux bases (création/replay, ACL business/public, panne checkpoint,
fencing vérifié et reprise) ; capacités PG 4/4 PASS ; migration0004 relue au checksum
`5397766a…ceffb4`. Deux essais de fencing antérieurs ont échoué sur privilèges
owner, corrigés puis retestés PASS. Les AC complets, saga/processus/Inngest, Verify,
Review indépendante de l’ensemble, CI, Goal et Lead Tech restent non PASS.

Les deux premiers appels0b ont échoué avant le démarrage selon le rapport Setup ;
le troisième setup complet est PASS. Détails sans logs privés dans
[environment.md](environment.md).


Revue indépendante statique post-correction : **PASS, Critical0/Major0**. Build packages
et typecheck passent. Test PG : chemin heureux/replay et checkpoint-failure passent ;
le fencing via owner migration utilise un membership SET temporaire ensuite révoqué
et relu.


Preuves ciblées exécutées séquentiellement après revues statiques indépendantes :
`pnpm build:packages`; `pnpm typecheck`; `pnpm lint`; `vitest` provisioning integration
2/2, capabilities integration 4/4, unit domain/secrets/router 7/7 et contracts 2/2.
Migration/grants centraux idempotents : `node scripts/s01-control-migrate.mjs`, checksum
`5397766a1c5df8b52167e3c6a26cbc2940b134b41b0e40c289c37befefceffb4`.

Commande reproductible ciblée ajoutée : `pnpm test:provisioning` (Setup check, builds,
migration/grants idempotents, intégrations PG, unités, contrats et secret scan).
La suite native `pnpm test:auth` (13 scénarios, un worker) a terminé en échec :
5 scénarios en échec. Deux erreurs fonctionnelles sont `NATIVE_ISSUER_DISCOVERY_FAILED`
et `NATIVE_FAULT_JOURNAL_UNCLASSIFIED` ; trois parcours ont expiré sur navigation
vers localhost. Ces causes restent à attribuer ; le gate auth n’est pas PASS.

### Reprise et delta0005 — 2026-10-16

Application additive0005 après arrêt et vérification des conteneurs identifiés
ingress/identity-coordinator ; absence provisioner/orchestrator confirmée. Chaîne
0001–0005 checksum `e5d7928caaa1b6f9d145c1102f5119321defcc1cf385fe8356272c9dc7b4632a`.
Aucun SQL0001–0004, ledger existant, J1 ou fixture supprimé. Revue statique ciblée
PASS précède cette application. Première saga réelle PG PASS : agence READY,
opération READY/SUCCEEDED, six effets confirmés, ADMIN PENDING et activated_at NULL,
exécution CLOSED/gate IDLE ; replay conservateur ignoré sans nouvelle ressource.
Les premiers essais de start ont échoué avant commit/effet car le membership
provisioner→control_audit n'existait pas dans l'environnement retenu. Le bootstrap
host ajoute seulement cette absence exacte et refuse dérive. Fixtures conservées
et classées explicitement T06 ; les fixtures T05 restent protégées.
