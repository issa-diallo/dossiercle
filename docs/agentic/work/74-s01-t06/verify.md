# Verify — #74 / S01 T06

## Verdict courant

**PASS local technique** — preuves réelles et sorties intégrales maintenant
accessibles à la Review. Le rejeu historique124 et le runner T06 complet ont terminé
code0, logs0600 et receipts avec SHA-256 vérifiés. Le test moteur inclut désormais
STOP/inspect/assertion dans le try/finally garantissant CONT, validé par ce rejeu.
Toutes les commandes globales ci-dessous ont terminé avec code0, sans skip.
Review indépendante globale PASS_WITH_MINOR, Critical0/Major0 ; Goal technique
SATISFIED. CI de PR et Lead Tech restent à obtenir dans Ship.
Les artefacts privés, credentials et logs bruts restent hors Git.

## Requalification native après première CI

La première tête publiée `531bcedf9502bb6fbe56696bdc31ea1dcc55e28a` a échoué
sur la même assertion J1 dans les trois workflows applicatifs : le coordinateur
avait bien terminé `false 1`, mais le statut navigateur n'était pas503. Les logs
CI ne conservaient pas sa valeur ; aucune réponse applicative ouverte n'en est
déduite. Le test distingue maintenant transport navigateur0/HTTP503 et impose
un503 indépendant sur une connexion TLS neuve, CA vérifiée, sans retry. J1 reste
absent ; après restauration, navigateur et connexion TLS neuve doivent répondre200.

Rejeu réel `bash scripts/s01-auth-test.sh -g 'native refresh/faults'` : PASS,
code0. Log privé `.local/evidence/t06-journal-fault-recheck.log`, empreinte SHA-256
`07cc16b17b21f79458aa3b566c0ee41139b41d94af0167d1d561e04a74b401ab`.
L'observation conservée démontre navigateur0/TLS503, startup fermé et J1 absent,
puis nouveau MFA et logout confirmés. Typecheck des tests et lint passent.
La revue indépendante ciblée accepte le contrat fermé ; aucun scénario, retry
ou timeout n'est retiré. La CI complète de la tête corrigée reste obligatoire.

Le setup T05 de `ec20648` a ensuite constaté Inngest exited1, sans log applicatif
conservé : sa cause interne ne peut pas être affirmée. Le diagnostic a identifié
un défaut certain de readiness : `pg_isready` sans host utilise le socket Unix,
que le serveur PostgreSQL temporaire peut ouvrir pendant initSQL. Le contenu de
l'entrypoint de notre image17.9 épinglée confirme `listen_addresses=''` pour cette
phase, puis traitement des initfiles et arrêt avant serveur final. La
[source officielle](https://raw.githubusercontent.com/docker-library/postgres/master/17/bookworm/docker-entrypoint.sh)
confirme cet ordre. Le healthcheck exige désormais TCP127.0.0.1, sans changement
de pin, délai, retry ou reset. Revue indépendante ciblée PASS statique ; les trois
bootstraps froids de la nouvelle tête devront vérifier le résultat en CI.

## Matrice des AC

| AC | Preuve exécutée | État courant |
|---|---|---|
| 1 | Schéma/capacités, saga READY avec six effets confirmés, ADMIN PENDING, marqueur version1, configuration false | Ciblé PASS |
| 2 | PREPARE rollback/process, refs/empreintes/OID stables dans14 cuts, refus homonymes DB/rôle sans mutation | Ciblé PASS |
| 3 | STOP hôte observé T, perte session centrale, seconde opération sans attempt, CONT ancien émetteur fermé, arrêt/backends/inspection/preuve puis reprise | Process14/14 PASS |
| 4 | CREATE fermé→COMMENT→REVOKE→open→migration : CONNECT runtime réellement refusé à chaque frontière ; ACL et SET memberships relus | Process et primitives PG PASS |
| 5 | Deux vraies DB, canari business, CONNECT A→B/control/KC/PI/Inngest/postgres/template1 refusés ; substitutions contexte/secret/pool/locator | Isolation PG1/1 PASS |
| 6 | Coffres0400 immuables, perte des deux fichiers sans régénération, v1 conservée, binding/version étrangers et ledger divergent refusés, rotationv2 drain PID | Primitives5/5 et isolation ciblées PASS |
| 7 | Deux connexions, troisième acquisition≈2s refusée, SQL≈5s, idle>60s, budget observé≤80 ; HTTP99→100 concurrent, replay/conflict et refus sans refresh/J1/consommation | PASS, plafond global4 réel inclus |
| 8 | Inngest natif signé/mTLS ; publication avant SQLack perdu, même event ; SDK tué avant ack callback, même run persisté StepErrored→durable-attempt StepCompleted et ressources identiques ; wakeups3 rounds/reprise | PASS, moteur3/3 et wakeup1/1 au runner global |
| 9 | Audit local refusé ou connexion perdue après INSERT interdit READY ; fencing/reprise produit un seul audit ; GET READY no-store/sans refresh, flags false et ADMIN PENDING | Audit2/2 et HTTP2/2 PASS |
| 10 | Build/tests globaux,13 natifs, scan/états/contrôles, review finale/Goal technique puis CI et Lead Tech durant Ship | Vérifications locales PASS ; livraison Ship en attente |

## Commandes et résultats ciblés

Toutes les suites PG/process/transport sont séquentielles, services T06 drainés
avant les suites hors moteur. La commande reproductible CI est `pnpm test:provisioning`.
Elle reconstruit API+packages, exécute les huit suites explicitement, s'arrête au
premier échec, conserve l'inventaire en finally et arrête les émetteurs sans ouvrir
un gate incertain.

| Commande | Résultat acquis |
|---|---|
| `pnpm exec vitest run --project provisioning --bail=1 apps/api/test/t06-process.integration.spec.ts` |14/14,188,23s avant ajout des deux fautes audit |
| Même fichier avec `-t 'actual local'` |2/2,25,99s ;14 autres non sélectionnés |
| `… apps/api/test/t06-engine.integration.spec.ts` |3/3,66,90s |
| `… apps/api/test/tenant-isolation.integration.spec.ts` |1/1,71,92s avant delta plafond global4 |
| `… apps/api/test/t06-admission.integration.spec.ts` |2/2,28,35s après intentions SQL/HTTP |
| `… packages/adapters/test/agency-provisioner.integration.spec.ts` |5/5,2,96s |
| `… apps/api/test/provisioning.integration.spec.ts` |3/3,1,73s, incluant factory humain central |
| `pnpm exec vitest run --project integration --bail=1 packages/adapters/test/schema.integration.spec.ts` |13/13,1,38s |
| `pnpm exec vitest run --project unit --bail=1 packages/adapters/test/fixture-manifests.spec.ts` |4/4 |
| `python3 scripts/s01-t06-secret-scan-test.py` |12/12 canaris détectés, scan final sans match |

La preuve historique utilise `git show b18cd38` exact (TypeScript et SQL0001–3),
transpilation privée sans modification de logique, fixture dédiée
`s01_schema_v4_central`. Ancien `migrate()` refuse le checksum nouveau ; ledger et
fingerprint inchangés. `assertControlProvisioningSchema()` refuse un ledger de
fixture non préparé sous transaction rollbackée. C'est la garde utilisée au startup,
pas une prétendue exécution complète de startup contre l'ancien runtime.

Le premier passage global s'est arrêté au lint sur deux imports inutilisés et un
alias de this. Corrections mécaniques effectuées ; aucune suite ultérieure de cet
appel n'est comptée PASS. L'ancien rapport auth5 échecs est historique : défaut de
nettoyage du pool au startup J1 et course de restauration corrigés. Le vrai rejeu
séquentiel des13 scénarios natifs a terminé PASS, code0, en9,4 minutes. Le premier
passage intégration avait deux échecs d'enrollment car les services conservés après
migration étaient arrêtés ; après démarrage identifié et healthwait, la suite
historique entière124/124 a été rejouée et passée.

## Vérification globale finale

| Commande / contrôle | Résultat réel |
|---|---|
| `pnpm build` après formatage | PASS code0, typecheck/lint/API/web |
| `pnpm test:unit` après formatage |105/105,15 fichiers,1,14s, code0 |
| `pnpm test:contracts` après formatage |23/23,3 fichiers,0,51s, code0 |
| `pnpm test:integration` |124/124 historiques, code0, aucun skip |
| `pnpm test:provisioning` |35 PG/process/moteur +18 unités ciblées +2 contrats =55 tests, code0 ;12 canaris détectés |
| `pnpm test:auth` |13/13 natifs,9,4min, wrapper/capture code0 |
| `s01-owner-key-test.py` / readiness / healthcheck |21 /6 /7 cas PASS, code0 |
| `s01-t06-environment-check-test.py` |14 cas PASS, code0 |
| `s01-worktree-identity-test.py` / privacy |24 /29 réels +5 UID simulés PASS, code0 |
| `s01-t06-environment-check.py infra/local/compose.yaml` |Mounts capacités read-only PASS, code0 |
| `s01-t05-state-check.mjs` |20 agences, toutes PROVISIONING/ACCEPTED/PENDING, aucun locator ni ACTIVE/READY |
| `s01-t06-state-check.mjs` |627 tuples :163 READY,458 FAILED,6 PENDING ; ACTIVE0/ADMIN actif0 ; union exhaustive et disjointe |
| `s01-secret-scan.py --worktree` |541 fichiers,2463 représentations privées, aucun match après rapport final |
| `agentic-check.sh` / `git diff --check` |PASS code0 ; contrôle répété après docs |

Les huit suites du runner sont : primitives5, capacités4, saga/factory3, wakeup1,
admission/statut2, isolation/pools1, process/fencing/audit16, moteur/mTLS3.
Le premier runner avait fini avec T05=13/T06=513 ; le navigateur natif puis le
rejeu historique ont créé d’autres T05, tous contrôlés sans locator. Le rejeu
capturé finit avec T05=20/T06=627, union centrale exhaustive et disjointe. Toutes les suites mutables ont été séquentielles.
Le profil émetteur T06 est arrêté : orchestrator/provisioner exited0. Inngest et
l'environnement natif conservés sont healthy ; aucun worker T06 ni test n'est actif.

Le formatage mécanique final concerne41 nouveaux modules uniquement. La
[preuve AST](evidence/format-ast.json) compare les arbres avant/après, nœuds et textes
identiques ; seul le flag de contexte interne TypeScript `AwaitContext` est exclu.
Les sources historiques et migrations SQL sont exclues. Build, unités et contrats
ont été repassés après formatage ; les preuves PG/process/navigateur précédentes
restent applicables sans modification sémantique. Les sauvegardes/logs restent privés. Le correctif ultérieur du try/finally du test
moteur est un delta explicite après cette preuve de formatage ; le runner complet
a été rejoué pour ce delta (aucun changement du runtime).

## Gates restant avant arrêt de mission

[Review indépendante finale](review.md) PASS_WITH_MINOR, Critical0/Major0 ;
Goal technique SATISFIED.
La CI sur tête de PR et Lead Tech indépendant restent obligatoires dans Ship avant
READY_FOR_HUMAN. Aucune fusion, déploiement ou cleanup ne découle de Verify PASS.

## Limite de qualification synthétique

Conformément à Design §9, les launchers livrés sont `syntheticOnly` : provisioner,
dispatcher et scanner exigent le manifeste privé T06. Une création HTTP absente de
ce manifeste n'est donc pas consommée automatiquement par ce profil. La résolution
des tuples, de leur source et de l'autorité est centrale ; l'allowlist ajoute une
restriction obligatoire dans le wiring actuel. Aucun runtime hors fixtures ni
wiring nonsynthétique n'est qualifié par ces preuves. Cette limite ne promet pas
un déploiement ou une activation et protège les fixtures T05 conservées. Le reviewer
a retiré le finding initial sur ce point après arbitrage du Design, sans changement
de code ni consommation globale des anciennes agences.

## Revue globale et capture vérifiable

La première revue globale ne relève aucun Critical/Major code, mais avait bloqué
son attestation sur l'accès aux sorties détaillées35T06/124historiques. Les sorties
n'ont pas été reconstruites : les deux commandes ont été rejouées séquentiellement.

| Preuve intégrale privée0600 | Résultat / empreinte SHA-256 |
|---|---|
| `.local/evidence/t06-review-integration.log` |124/124, code0 ; `4cd2aea5703508edbe9e881d1cc7ffc3ee7f51f1f25554cd8c873d7ebf1afa7b` |
| `.local/evidence/t06-review-provisioning.log` |35+18+2, code0 ; `8a234142abcfaff48c399c7412924af49902882383c657b0546b08b13bd1a698` |
| `.local/evidence/t06-native13.log` |13/13, code0 ; `41551e02cc4ab58425b3a63ca8952d6f69e727f6be9bd298df3f902b15e38b69` |

Les deux premiers ont un receipt JSON voisin (commande/exitCode/hash/synthèse).
Le rejeu courant confirme isolation74,96s, process16/16 en228,42s et moteur3/3
en55,16s. Le correctif STOP/CONT a passé et son lint ciblé est PASS.
La Review finale a vérifié ces receipts et prononcé PASS_WITH_MINOR ; recheck
documentaire clos, seul Minor pg suivi avant montée majeure.

Un DeprecationWarning pg8 est observé au test de saturation : plusieurs appels
queryVerification simultanés relisent l'autorité et les locks sur l'unique
PoolClient central. Le driver les sérialise et avertit de la suppression de cette
file implicite en pg9. La chaîne est test isolation lignes109/126 →
ProvisioningAttempt.verificationContext.check → ProvisioningSession.verify. Le
chemin normal émet une vérification à la fois ; les connexions tenant distinctes
restent bornées. Pas de stack --trace-deprecation dans le log : attribution basée
sur la source et sa localisation dans la suite, aucun changement de pin proposé.
