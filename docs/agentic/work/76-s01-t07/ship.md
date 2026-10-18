# Ship — S01–T07 / #76

**SHIP : candidat qualifié ; dernier commit documentaire et attestation finale en cours.**

## Préconditions et candidat

Execute PASS, Verify PASS, Review indépendante PASS, Goal technique SATISFIED,
aucun Critical/Major ouvert. Voir [Verify](verify.md) et [Review](review.md).
Branche `feat/76-s01-t07`, remote `origin` / `issa-diallo/dossiercle`, base
`135f0eab07f017e9b8a35c704dd1342f53cc2b51`. Le
[manifeste Ship](ship-source-manifest.json) distingue le candidat final du
manifeste historique d’implémentation. Preuves brutes restent privées.

Le mandat utilisateur Ship succède explicitement au mandat d’implémentation
sans commit. La mission s’arrête à READY_FOR_HUMAN ; D57 reste applicable.

## Ajustements de livraison et qualification

Le setup froid écrivait le certificat T07 avec le serial de la CA alors que le
consumer exige `t07-activation-tls/ca.srl`. Alignement du bloc de génération sur
ce chemin propre au client, sans toucher clés/certificats/versions existants.
Test réel privé du bloc exact du setup froid et de deux rechecks : PASS, aucun
changement de clé/certificat/serial après génération. Preuve minimisée et script
conservés dans `.local/ship/`, aucune recréation du worktree local.

CI T07 ajoutée : préparation historique sans activation T07 puis runner complet
T06 → V3 natif entier → V2 entier/T07 → scan secrets. Les trois workflows
historiques exécutent leurs tests PG sans les deux nouveaux fichiers T07 ; ces
fichiers sont tous exécutés dans le job T07 complet après V3, sans skip.
`s01-integration-test.sh --before-activation` sélectionne positivement les
11 fichiers historiques après le schéma13. Son invocation par défaut reste
complète ; les modes inconnus sont refusés avant build/services. Les assertions/manifests T05/T06
restent inchangés. YAML cinq workflows et syntaxe bash PASS.

## Périmètre de PR et atomicité

Une PR pour #76. Dépassement des cibles 1–3 fichiers/100 lignes justifié par le
même octroi indivisible : auth/locks, réservation/audit, transaction centrale,
contrats, clients/handlers privés, reprise, capacités et leurs tests/adaptations
CI doivent être cohérents. Une division permettrait des droits partiels ou des
preuves manquantes. Les artefacts LARGE de préparation et vérification sont
conservés. Un commit logique final prévu après squash ; les commits intermédiaires
éventuels servent à consigner preuves/revue, sans réécrire l’historique publié.

## PR / CI / Lead Tech

Publication et résultats CI à consigner après exécution, aucun PASS CI anticipé.
Lead Tech distinct de l’implementer et des premiers reviewers :
`/root/ship_lead_tech`, lecture seule, modèle/capacité hérités ; High recommandé
pour sécurité, niveau exact non prétendu. Rapport sous `lead-tech-review.md` ;
attestation finale après la dernière tête/CI conservée en session hors diff.

## Déploiement et rollback

Aucune nouvelle migration ni checksum historique changé. Rôles/capacités et
identité synthétique bornés. Aucun credential migration dans l’API. Rollback
futur : bloquer les octrois, drainer par protocole sûr si autorisé et revenir à
un runtime compatible en conservant ACTIVE acquis, audit/outbox/J1, réservations,
bases, clés et versions. Aucun rollback/reset/destruction exécuté.

Suivis non bloquants : LT-M2 pg8 avant montée majeure ; artefacts accidentels
privés/provenance non établie conservés ; mesure nominale locale sans garantie
sous charge. Dix services et ressources synthétiques conservés actifs à l’entrée.

## Gate humain

Pas d’autorisation de fusion, déploiement ou cleanup dans ce mandat. Issue #76
reste ouverte jusqu’à décision humaine applicable et fusion. Verdict attendu :
READY_FOR_HUMAN après CI et ultime attestation Lead Tech, jamais DONE ici.

## Diagnostic CI initial et correction

PR [#77](https://github.com/issa-diallo/dossiercle/pull/77), première tête
`f8104dc4066a3ce7e7482bb61e5538f6919311f7`. Agentic documentation SUCCESS ;
T04/T05/T06/T07 FAIL pendant la préparation historique : le `--exclude` CLI
est ignoré par la configuration de projet Vitest épinglée. Les suites T07 ont
donc démarré avant J1/application et le manifeste T05 froid, avec refus fermés
JOURNAL_UNAVAILABLE/FIXTURE_MANIFEST_EMPTY. Aucun PASS distant revendiqué.

Correction relue par Lead Tech : sélection positive et bornée des 11 fichiers
historiques via `--before-activation`, défaut complet préservé après V3 dans
le job T07. Test réel local **PASS, exit0 : schéma13 puis98 tests/11fichiers**,
zéro suite T07 et aucun skip. La CI froide complète doit encore qualifier la
nouvelle tête. Journaux diagnostiques conservés privés sous `.local/ship/`.
L’ancien `--exclude schema` du mode complet est aussi supplanté par le projet :
les nombres V2 observés13+123 se recoupent, comme déjà précisé dans Verify ;
aucune baisse de couverture pour faire passer la livraison.

## Qualification du journal applicatif à froid

La seconde tête `6321eaa908a2b4ac8605cf51efc9aed3a8eb98a7` passe la
préparation historique. Le run T07 `39160324349` refuse ensuite T06 avec
JOURNAL_UNAVAILABLE : le runner écrivait avant le démarrage du propriétaire
natif du journal applicatif. Le runner démarre désormais explicitement
`identity-coordinator` et attend sa santé avant T06. Son initialisation native
valide le journal existant et ne le réinitialise pas. Aucun reset ni rotation.

Correction relue indépendamment par Lead Tech. Syntaxe bash PASS ; commande
réelle locale PASS sur environnement conservé : dix services, gate IDLE, zéro
incertain. Ce contrôle à chaud ne qualifie pas le démarrage froid ; nouvelle CI
complète exigée. Logs des deux échecs conservés privés dans `.local/ship/`.

## Résultats et handoff de livraison

PR [#77](https://github.com/issa-diallo/dossiercle/pull/77), tête applicative
`a43124fd38494c02b78804bdc7eb527d4265dbbd` : **cinq CI SUCCESS**.
Voir [résultats minimisés](ship-ci-evidence.json) et
[Lead Tech indépendant](lead-tech-review.md) : **PASS_WITH_MINOR**, aucun
Critical/Major ouvert. V3 natif13/13, V2 complet et T07 passent à froid ;
les corrections de certificat, sélection historique et initialisation J1 sont
qualifiées sans retirer de test ni réinitialiser le worktree local.

Fichiers livrés : backend activation et runtime privés, contrats/adapters,
capacités SQL/certificat T07, handlers/outbox/Inngest, fixtures/tests, runners
et cinq workflows ; préparation et preuves LARGE conservées. Inventaire exact :
`git diff --name-only 135f0eab07f017e9b8a35c704dd1342f53cc2b51...HEAD` ;
manifeste Ship pour les58 sources. Logs bruts `.local/ship/` privés.

Le commit documentaire contenant ce rapport doit repasser cinq CI sur sa tête.
L’ultime attestation indépendante sera conservée **hors diff, en session et
dans la description PR**, avec SHA base/tête et liens CI définitifs. Elle fait
foi pour READY_FOR_HUMAN ; ce rapport reste historique, sans auto-attestation.

Setup/méthode locaux recontrôlés PASS. Dix services conservés ; gate IDLE,
zéro exécution incertaine ; partitions T05=22/T06=668/T07=93 exhaustives et
disjointes ;21 ACTIVE qualifiés et anciennes projections réconciliées.
Aucune donnée, ressource, clé, version ou artefact privé supprimé.

Avant Ship complet : ultime attestation après CI finale, décision humaine D57,
puis mandat distinct de fusion/déploiement/cleanup. N3 avant usage réel ; LT-M2
et limites de mesure restent suivis. Aucun blocker technique applicatif ouvert.
