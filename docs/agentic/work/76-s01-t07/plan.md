# Plan — #76 / S01–T07 Confirmation d’activation, état et reprise

## Statut et résultat attendu

`PLAN: PASS` — Research/Design et leurs revues [PASS](research-review.md),
[PASS](design-review.md). LARGE, complexité Élevée : octroi ADMIN, J1,
révocation, deux DB, reprise et isolation. Préparation seulement ; zéro Execute.

L’implementer doit livrer confirmation explicite ACTIVE atomique, GET sûr et
retry/replay sans octroi partiel. Les choix du [Design](design.md) sont obligatoires.
T06 livré/V3 PASS documentés dans Research. Aucun fait invalidant Architecture ;
pas de nouvel ADR, aucun changement de schéma prévu (T02 seulement).

## Critères d’acceptation T07 et preuves futures

| ID / rattachement S01 | Critère observable | Preuves à produire lors de Verify |
|---|---|---|
| A1 / AC1 | READY/SUCCEEDED, six confirmations et bindings courants, session forte autorisée, J1 convergé sans révocation ; prepared local exact avant publication | PG réel nominal ; capture SQL minimisée avant/après ; `activated_at`, ADMIN/state/versions cohérents ; pas d’accès métier avant commit |
| A2 / AC1–2 | Membership, agency, opération, audit activated, outbox et idem atomiques ; aucun succès si l’un échoue | Injections avant/après chaque écriture/commit, crash processus et redémarrage ; visibilité par seconde connexion ; zéro publication partielle |
| A3 / AC2 | Perte réponse locale réconciliée par eventId unique ; perte réponse centrale retrouvée par GET/replay ; double appels/clés sans doublon | Même prepared/activated/event/corrélation ; ancienne If-Match acceptée seulement pour replay autorisé ; nouvelle mutation obsolète409 |
| A4 / AC1–3 | J1 deny/PENDING ou échec lecture bloque malgré ancien SQL CONFIRMED/ACTIVE ; session expired/revoked/changement compte bloque avant commit | Course révocation/activation et faute J1→PG ; expiration pendant I/O local ; changements natifs/backchannel ; aucun octroi après deny |
| A5 / AC3–4 | GET/POST/retry propres onboarding/ADMIN ; anonyme401, standard/habilité propre403, A→B404 sans données | Matrice deux DB/agences, tous scopes/rôles ; substitutions route/body/outbox/réservation/secret/contextes et canaris PG |
| A6 / AC4 | Vue minimisée, no-store, polling sans refresh/activité ; READY jamais présenté ACTIVE, flags calculés serveur | Contrats HTTP/DTO/OpenAPI ; tests absence champ SQL/secret/error brut ; compteurs idle/refresh inchangés GET |
| A7 / AC2–4 | Retry certain seulement FAILED retryable/attempt<4/gate IDLE, admission100 ; même opération/DB/secret ; scanner T06 reprend après crash | PG/processus/moteur réel, duplicate/ack perdu, scheduler concurrent ; aucun reset attempt/generation ni event inconnu accepté |
| A8 / AC1–2 | Projection activated local idempotente, dette après panne visible et rattrapable depuis outbox/étapes moteur | Inngest signé/mTLS natifs, échec DB locale après ACTIVE et restart ; une confirmation locale, pas de seconde activation |
| A9 / AC1–4 | IA/modules/mail false, aucun fournisseur contacté ; socle T04–T06 conservé | V3 treize parcours natifs, suites existantes PG/provisioning, scan secrets/canaris ; manifests de fixtures exhaustifs/disjoints |

Les tests d’implémentation ne sont pas exécutés dans cette préparation. Les
contrôles du seul setup autorisé seront consignés séparément. V5 UI complet appartient
à T08 ; le backend T07 doit fournir tous les états/contrats consommables par T08.

## Ordre d’exécution futur

### 0. Qualifier Worktree Setup du socle, avant Execute produit

Le worktree Git dédié est créé à la base fusionnée `135f0ea`. L’allowlist actuelle
exclut76 : constat à corriger dans le périmètre outillage du Worktree Setup
explicitement autorisé. Ce travail ne crée aucun comportement applicatif T07.

Setup0a : ajouter seulement le couple `76-s01-t07` / `feat/76-s01-t07` à
`scripts/s01-worktree-identity-check.py:ALLOWED`, actualiser la liste des couples
dans README ; tester avec la suite identité existante qui itère ALLOWED,
vérifier whitespace et obtenir revue indépendante du delta avant --synthetic.
Aucune permission générique, emprunt d’identité ou protection supprimée.

Setup0b : exécuter le setup froid puis --check du socle existant ; contrôler
versions/mounts/ports loopback/réseau/DB/J1/keys distincts et services de base
sains. Aucun profil de provisioning, worker, saga, fixture agence ou POST
activation ne doit démarrer. Conserver toutes ressources existantes et nouvelles,
aucun down/prune/cleanup. Si échec indispensable, consigner preuve et arrêter
Setup avant phase dépendante, sans réinitialiser clés ou données.

Ce PASS potentiel porte seulement sur le socle synthétique ; les nouveaux rôle
control_t07/certificat t07-activation/handlers/fixtures/runner T07 sont du futur
Execute, pas du setup de cette mission. Leur qualification précède le premier
octroi T07. Les futures fixtures auront un manifeste T07 disjoint, aucun
consommateur global sur T05/T06 protégées. Aucun DoR runtime activation déduit
du setup de base. Revue indépendante du résultat Setup requise avant handoff.

### 1. Domaine, contrats et capacités bornées

- Modifier `packages/domain/src/agency-lifecycle.ts`, son test : décisions pures
  activation/replay/retry et refus READY≠ACTIVE ; pas d’I/O dans domaine.
- Compléter `packages/contracts/src/agency.contracts.ts`, tests agence et OpenAPI
  existant `packages/contracts/openapi.yaml` : routes/EmptyBody/ActivationView, erreurs, versions/idem.
- Créer `packages/contracts/src/activation.events.ts` et test de contrat dédié :
  activated v1 distinct des deux événements provisioning T06, payload strict
  opaque sans credentials, source centrale toujours rechargée.
- Créer `packages/adapters/src/postgres/t07-capabilities.ts` et tests PG de
  capacités exactes ; câbler grants via migrateur/bootstrap existants. Rôle
  non-login SET par coordinator seulement ; aucune permission supplémentaire
  sur control_t05/control_api, aucun DDL/ownership/DELETE audit.
- Compléter `packages/adapters/src/audit/audit-writer.ts` pour source control_t07
  explicitement autorisée sans étendre auditRole ; conserver SET LOCAL restauré.

### 2. Autorité, autorisation et locks T07

- Créer `apps/api/src/auth/t07-locks.ts` ; compléter `auth.service.ts` et
  `platform/t05-context.ts` ou contrat privé T07 dédié : prélocks sans upgrade,
  chemin onboarding lié ou agency ADMIN propre ; fonctions create/claim restent
  onboarding seulement. Profil SQL T07 activé explicitement, jamais via client.
- Réutiliser native/session/CSRF/J1 ; recheck final après I/O et refresh sous
  autorité exclusive jusqu’au commit. Inclure expired/revoked/native change.
- Tests de courses avec coordinator/T05/T06 et logout/revoke ; deadlines lock
  fermées, aucun fallback/cache de droits. Contrats de Design immuables.

### 3. Audit privé et réservation durable

- Créer `packages/adapters/src/postgres/activation.repository.ts` : réservation
  immuable interne, eventId stable/targetVersion/bindings depuis centre, reprise
  après perte de clé/réponse ; réutiliser idempotency_record, sans schéma nouveau.
- Créer `apps/api/src/provisioning/activation-audit.service.ts` ; compléter
  `provisioner.server.ts`, `provisioner.main.ts` et wiring privé : matrice mTLS
  t07-activation prepare/read, orchestrator project ; pas accès wake/DDL depuis
  coordinator. Corps bornés et aucun SQL/locator client.
- Réutiliser `agency.repository.ts:projectAudit` et vérifications de propriété/
  schéma/ACL/secret ; connexion technique du provisioner uniquement. Local read
  final n’attend jamais une autorité centrale détenue par l’appelant.
- Tests coupure après INSERT/avant ack, rollback local, tuple divergent, mauvais
  certificat/Host/path/JSON, substitution de réservation et binding A→B.

### 4. Publication atomique et API sûre

- Compléter `apps/api/src/agencies/{agencies.service,agencies.controller,agencies.module}.ts`
  et `activation.repository.ts` : GET courant ADMIN/onboarding, POST activation,
  revalidation finale et transaction centrale unique du Design.
- Chaque write conditionnel vérifie rowCount ; aucune réponse200 avant commit
  confirmé ; après commit incertain, erreur sûre/GET/replay. Idem public contrôlé
  après auth et avant If-Match sur replay seulement.
- Créer tests demandés S01 : `apps/api/test/agency-activation.integration.spec.ts`
  et `apps/api/test/agency-isolation.integration.spec.ts`. Ne pas remplacer les
  suites existantes par des mocks ou fixtures générales permissives.

### 5. Retry et projection Inngest durable

- Retry humain : transaction état/versions/idem + audit retried dispatch:false,
  gate IDLE global/attempt<4/absence incertitude/admission100 ; pas d’appel à
  reserve_t06_wakeup sous coordinator. Scanner existant sous dispatcher réserve
  ensuite le wakeup T06 ; pas de nouveau type dans son parseur.
- Compléter `apps/api/src/provisioning/orchestrator.main.ts`, créer
  `activation.function.ts`, câbler `packages/adapters/src/outbox/activation-engine.ts` :
  handler Inngest distinct, signé/privé, relecture source outbox/audit/agency,
  projection locale exact tuple et step durable confirmé après readback.
- Duplicats/ack perdu/crash après ACTIVE avant projection : même événement,
  reprise depuis centre/moteur, aucune perte ou activation supplémentaire.
- Étendre manifestes T07 et contrôles de partition/états dédiés ; préserver les
  assertions T06 « zéro ACTIVE » sur son propre sous-ensemble, jamais retirer
  cette assertion globalement pour faire passer T07.

### 6. Verify, Review et transmission futures

Implémenter doit préparer handoff/execute/verify avec commandes, codes de sortie,
SHA/empreintes des preuves minimisées privées. Reviewer indépendant examine
AC/diff/sources et preuves réelles ; corriger Critical/Major avant PASS.
Goal technique n’est SATISFIED qu’après Verify/Review. Ship seulement sur mandat,
CI finale et Lead Tech indépendant selon REVIEWER, puis validation humaine D57.
Cette préparation ne crée ni PR, commit, déploiement ni demande de fusion.

## Fichiers et dépendances de livraison

Créer les fichiers ciblés aux étapes1–5, ainsi que
`apps/api/test/agency-activation.integration.spec.ts`,
`apps/api/test/agency-isolation.integration.spec.ts`, tests unitaires/contrats/PG
associés et `scripts/s01-t07-test.sh`, tests/manifeste/contrôle d’état T07.
Modifier les fichiers nommés aux étapes, `package.json` (runner test:activation),
`vitest.config.ts`/tsconfig tests si nécessaire, scripts setup/identity/privacy/
environment checks, fixtures testing, `infra/local/compose.yaml`, workflow CI
T07 dédié. Localiser précisément les manifestes privés via chemins T06 avant
édition, aucune fixture existante recyclée silencieusement. Aucune suppression.
Schéma/migrations0001–0005 et agency0001 conservés ; aucun down/checksum modifié.
Les chemins absents marqués créer restent futurs ; le contrat OpenAPI existant
`packages/contracts/openapi.yaml` a été localisé avant revue Plan.

Une seule PR future liée à #76, cohérente T07 ; >3 fichiers/>100l justifié : droits,
contrats/audit/transaction/reprise/tests sont les protections du même octroi,
aucune étape exposant ACTIVE sans elles n’est livrable. L’outillage de setup
peut être préparé séparément si mandat dédié, avant tout octroi ; T08 indépendant
après contrats T07 stabilisés. Un écrivain, reviewer lecture seule, aucun
parallélisme sur les ressources de test. Avant commit lire COMMITS.md, Gitmoji
Unicode impératif/intention atomique/`Fixes #76`, jamais commit inventé ici.

## Validation future et commandes

Depuis le worktree76 uniquement, après adaptation revue de l’outillage et
Worktree Setup PASS ; outils épinglés Node24/pnpm du setup, jamais Node22 hôte.

| Commande prévue | Preuve attendue / AC |
|---|---|
| `bash scripts/worktree-setup.sh --synthetic` puis `--check` | Setup isolé/reproductible, mounts/versions/identité exacts ; aucun PASS tant qu’allowlist refuse |
| `pnpm build` | V6 typecheck/lint/API/web, aucun import secret/PG web |
| `pnpm test:unit` et `pnpm test:contracts` | A1–A9 règles pures et contrats stricts, pas de skip |
| `pnpm test:integration` | V2 historique et T07 après intégration au runner ; vrai PG et deux DB |
| `pnpm test:auth` | V3 natif obligatoire après modifications auth/locks et avant ACTIVE synthétique ; suite entière, pas test:auth:upstream comme substitution |
| `pnpm test:provisioning` | Socle T06 complet/moteur/fencing/partition conservé |
| `pnpm test:activation` — à créer | Runner T07 séquentiel : PG/HTTP/processus/locks/mTLS/Inngest/projection, A1–A9 avec arrêts sûrs et preuve fin ; refuse suite absente ou tests ignorés |
| `python3 scripts/s01-secret-scan.py --worktree` | Canaris détectés puis scan final sans secret réel, logs hors Git |
| `bash scripts/agentic-check.sh`, `git diff --check` | Présence/cohérence documentaire et whitespace ; ne valent pas preuve comportementale |

Le runner T07 démarre les profils bornés, vérifie préconditions et drain final,
conserve ressources et versions. Le wrapper --activation n’existe pas : ne pas
le promettre sans ajout explicite. V5 e2e T08 future, pas de faux PASS de suite
absente. Mesurer GET et activation nominale<2s (hors pannes), budget global≤80,
pools4×2/timeouts2s/5s, aucune charge/valeur prétendue mesurée ici.

## Risques, observabilité, rollback et suivis

| Risque / validation | Responsable | Échéance / action si échec |
|---|---|---|
| J1 deny/opposabilité/locks/expiry après I/O | Implementer sécurité + reviewer | T07 Verify avant ACTIVE ; ferme octroi et réconciliation, aucun retour droits anciens |
| Prepared local/perte réponse et atomicité finale | Backend/QA | T07 Verify ; pas ACTIVE tant que readback non exact, rollback transaction centrale |
| ACL/certificats/private handler/isolation/pools | Backend/QA sécurité | Setup puis Verify avant exposition ; refus fermé, pas élargissement API/runtime |
| Source wakeup/retry/dette projection/restart | Backend/QA | T07 Verify ; préserver état, source centrale/moteur, jamais nouveau CREATE |
| Identité76 absente initialement / socle froid à qualifier | Mainteneur outillage + reviewer | Worktree Setup0a/0b autorisé ; adaptation exacte revue et preuves froid/check ; arrêt sur échec réel |
| LT-M2 pg8 hérité | Mainteneur/Lead Tech | Avant montée majeure pg, aucune montée prévue T07 |
| IAM/J1 ObjectLock/HA/PRA/licences/contrats/capacité | Propriétaire/exploitation/QA | N3 avant réel/vente ; reste synthétique et aucune offre/service réel |

Métriques/corrélations du Design, dette projection observable et erreurs stables,
preuves privées0600 et empreintes sans logs bruts publiés. Rollback : bloquer
nouveaux octrois, drainer émetteurs par protocole sûr si mandat futur, évaluer
compatibilité du runtime ; conserver ACTIVE acquis, audits/J1/outbox/DB/keys et
réservations. Aucun cleanup, arrêt de ressource existante ou rollback exécuté
par ce mandat ; aucune activation IA/mail/modules.

## Complexité, rôles et goal

High recommandé pour préparation/revue sécurité ; capacité héritée GPT-6 Codex,
niveau exact et coûts non observables, pas de changement de modèle prétendu.
Auteur/orchestrateur `/root`, reviewer `/root/t07_dependency_audit` indépendant ;
implémenter futur distinct, mandat Execute à fournir après setup PASS.
Délégation cadrée : lecture PR/logs/socle et artefacts, retour findings/verdict,
pas tests/services/écriture/publication. Modèle hérité disponible conservé.
Escalade après deux échecs sans convergence ou fait nouveau de sécurité ; jamais
réduire un gate. Goal mesurable de préparation : dépendances actuelles tracées,
Research/Design/Plan revus, setup réel évalué, handoff actionnable. Si setup
bloqué, goal global BLOCKED et arrêt, aucune préparation au-delà de cette phase.

## Plan Gate

- [x] Étapes/fichiers/contrats et AC/test matrix définis.
- [x] Dépendances T06/V3 satisfaites et architecture compatible.
- [x] Sécurité/données/observabilité/rollback et suivis explicités.
- [x] Chemin OpenAPI exact confirmé par recherche de fichiers.
- [x] Revue indépendante PASS, P-m1 corrigé ; amendement Setup0a/0b revu PASS.

Verdict : PASS documentaire, [revue indépendante](plan-review.md). Worktree
Setup0a/0b du socle autorisé ; Execute produit interdit dans cette mission.

## Amendement Execute/Verify de reprise — 18 octobre 2026

Mandat utilisateur : réconcilier sans reset puis compléter les scénarios avant
nouvelle revue. Voir [Recovery](recovery.md) et l’addendum Design revu. Le gate
initial a été FENCED/IDLE avec readbacks; l’ancienne fixture contradictoire reste
conservée et non retryable sous audit. A7 renforcé a passé sur une nouvelle fixture.

Complément de tests : 12 fautes avant/après six écritures + trois CAS nuls,
observateur MVCC indépendant, processus SIGKILL avant/après COMMIT, trois POST
concurrents avec barrière hors TX et quatre connexions, matrice rôles/scopes /
substitutions, révocation/expiration/native et J1 fsync sans projection SQL,
DB locale indisponible après ACTIVE, redémarrage moteur/provisioner et replay
idempotent. Runner complet `pnpm test:activation` inclut les deux fichiers T07,
T06 et V3. Aucun PASS final déduit des essais diagnostiques ou d’une revue statique.

Le runner T07 qualifie désormais aussi V2 entier via `pnpm test:integration`
après T06 et V3, conformément à la table de commandes ci-dessus. Les deux
fichiers T07 restent inclus, sans skip. Les diagnostics de synchronisation
(owner/CONNECT, READY avant gate IDLE) sont conservés puis corrigés dans les
tests, sans changer les règles applicatives.
