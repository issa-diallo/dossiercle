# Research — #74 / S01 T06 Provisioning répétable et routage isolé

## Statut, objectif et entrée

`RESEARCH: PASS` — 2026-10-16, après [revue indépendante](research-review.md).

Ticket [#74](https://github.com/issa-diallo/dossiercle/issues/74),
[cadrage et AC1–AC10](ticket.md). Entrée **EXISTING**, mode **LARGE** : tranche
T06 d’une story préparée, sur le socle T00–T05 fusionné ; aucun nouveau produit
ni changement de stack. Les phases produit disponibles restent références,
hors périmètre de ce ticket ; aucun PASS produit/runtime n’est recréé.
Mandat : Research → Design → Plan revus, prompt implementer, puis arrêt.

## Révision, isolement et règles

- Base `origin/main@b18cd38b2c93234211c3c66bba654d63f297149c`, issue de #72,
  fusion observée via GitHub le 2026-10-15T20:30:31Z ; #71 CLOSED.
- Branche `feat/74-s01-t06`, worktree `worktrees/74-s01-t06`, créé par Git.
- /root seul écrivain ; explorations code et architecture déléguées en lecture
  seule à /root/t06_code_research et /root/t06_arch_research.
- Aucun Worktree Setup applicatif, installation, secret, .local, service, DB,
  build ou test runtime exécuté. Un répertoire Git ne vaut pas Setup PASS.
- #73 met à jour la méthode sur une autre branche ; pas de dépendance produit
  supposée, pas de réécriture de ce socle dans T06.
- README → METHOD → WORKFLOW → COMMITS → produit → ADR → ticket → artefacts.
  Aucun AGENTS de sous-dossier dans les zones suivies de cette base.

Lectures de méthode : README/index/SCALING, METHOD/WORKFLOW, SAFETY, EXISTING_PROJECT,
CONTEXT/MODELS, rôles orchestrateur/reviewer, PULL_REQUESTS et templates
Research/Design/Plan/Goal/Handoff/Worktree Environment. Skills appliqués :
feature-design-assistant (structuration), agent-team-orchestration (contrats de
missions et revues), secure-web-dev (frontières de confiance et secrets).
Les choix et le mandat utilisateur évitent toute répétition d’approbation de stack.

## Sources produit et frontière de livraison

Sources : [S01 Design](../S01/design.md), [S01 Plan T06](../S01/plan.md#t06--provisioning-répétable-et-routage-isolé),
[Architecture](../../../product/ARCHITECTURE.md),
[Finalisation](../../../product/ARCHITECTURE_FINALIZATION.md),
[D73–D82 et D57](../../../product/ARCHITECTURE_DECISIONS.md),
[ADR002](../../../adr/002-postgresql-par-agence-drizzle.md),
[ADR004](../../../adr/004-autorisation-mandat-support.md),
[ADR022](../../../adr/022-scaleway-paris-postgresql-compose.md),
[ADR023](../../../adr/023-inngest-dispatcher-ferme.md),
[ADR024](../../../adr/024-journal-reprise-coherente.md),
[ADR030](../../../adr/030-t05-invitation-preuve-transaction.md),
[préparation T05](../71-s01-t05/research.md) et preuves Verify/Ship T05.

S01/design.md:59–67,146–168 et plan.md:308–356 fixent DB/rôles séparés,
verrou session conservé pendant effets, fencing réel avant reprise incertaine,
ACL avant ouverture, secrets versionnés et budgets. **READY technique appartient
à T06** ; ACTIVE et membership ACTIVE appartiennent à T07. Le ticket a été
précisé sur cette frontière avant Research : PROVISIONING peut devenir READY,
ADMIN reste PENDING, activated_at NULL et fonctions/modules/mail false.
Aucun changement de décision produit ni ADR de remplacement n’est nécessaire.

Les bandeaux STATUS/STORIES et Ship T05 sont des checkpoints pré-merge parfois
historiques ; la fusion #72 est un fait GitHub, pas une invention de gates préalables.
Le README de la base décrit correctement T00–T05 et l’absence de T06. Son
allowlist de setup ne permet encore que les identités T04/T05.

## Socle réel et points d’intégration

| Zone / chemin depuis la racine | Fait inspecté | Conséquence T06 |
|---|---|---|
| `package.json`, `packages/adapters/package.json`, `infra/local/versions.json` | Node24/pnpm12, Nest12/Express5, TS6, PG17.9/Drizzle0.45.4/pg8.23.1, SDK Inngest4.23.0 ; serveur Inngest1.46.0 figé | Garder pins/digests/lock ; qualifier l’intégration pendant Execute/Verify |
| `apps/api/src/agencies/agencies.service.ts:50–72` | Création unique agency PROVISIONING + ADMIN PENDING + op ACCEPTED/PENDING + audit/outbox/idem, même TX | Reprendre cette opération ; ajouter admission backlog avant nouvel append J1 |
| `packages/adapters/src/postgres/t05.repository.ts:23–25` | `agency.creation-accepted` a resourceId = racine, agencyId = agence | Résoudre op par agencyId et contrôler racine/tuple/audit ; jamais resourceId pris pour operationId |
| `packages/adapters/src/outbox/outbox-dispatcher.ts:5–16` | TX/SKIP LOCKED, send event.id stable, ack après publication ; payload minimisé, doublon admis | Ajouter boucle/handler réels et reprise, ne pas compter sur exactly-once Inngest |
| `packages/adapters/src/postgres/control.schema.ts:14–32` | États agence PROVISIONING/READY/ACTIVE/FAILED ; op ACCEPTED→DATABASE_CREATED→SCHEMA_READY→SECRETS_REFERENCED→READY→ACTIVE, statuts PENDING/RUNNING/SUCCEEDED/FAILED | Fixer READY/SUCCEEDED et erreurs sûres ; pas nouveau statut public nécessaire |
| même schéma / `migrations/control/0001_s01.sql:83–123` | Locator avec noms DB/rôles, secret_ref, schema_version, verification_version ; pas secret_version, execution_id ni barrière globale durable | Correction additive control0004, migration/fingerprint et permissions à définir |
| `packages/adapters/src/postgres/migrate.ts:7–74` | Transactions locales, lock s01.schema, checksum/owner/fingerprint, corrections0002/0003 ; replay et dérive fermés | Ne pas modifier SQL0001–0003 ; supporter transition attestée vers0004 et refuser états inconnus |
| `packages/adapters/migrations/agency/0001_s01.sql:1–31` | Metadata UUID/schema/checksum, configuration false, audit local | Migration agence1 conservée ; ACL runtime et checksum à contrôler explicitement |
| `packages/adapters/src/postgres/agency.repository.ts:4–14` | verify schema/UUID/version/config, projection audit unique vérifiée | Réutiliser et vérifier aussi migration_checksum, DB owner/rôles/ACL avant READY |
| `scripts/worktree-setup.sh:121–129` | provisioner LOGIN NOCREATEDB/NOCREATEROLE + CONNECT control seulement | Définir principal maintenance DDL non-superuser, jamais distribué à API/worker Inngest non privilégié |
| `packages/adapters/src/audit/audit-writer.ts:4–13` | SET LOCAL ROLE control_audit, whitelist sans provisioner | Grants/whitelist explicites et minimaux, jamais UPDATE/DELETE audit |
| `packages/adapters/src/postgres/runtime-pool.ts:3–6` | Seulement pools contrôle max1–2, timeouts5/10/15s | Créer routeur tenant borné ; réglages T06 sans élargir silencieusement anciens rôles |
| `apps/api/src/auth/t05-locks.ts:57–94`, `auth.service.ts:111–121` | Roots→invitations→autorités→sessions→memberships→agency SHARE, puis validate et refresh/J1 | Nouveau verrou admission avant toute séquence ; aucun verrou tardif après J1 |
| `apps/api/src/auth/auth.service.ts:144–156` | Scope agence exige agence ACTIVE et ADMIN ACTIVE | READY n’ouvre pas l’accès ; tests techniques via capacité privée, pas nouveau bypass public |
| `apps/api/src/agencies/agencies.service.ts:75–82` | GET activation présent, erreur/retryable/canActivate/canRetry codés null/false | Afficher état/erreur persistés ; capacités d’action restent false jusqu’à T07 |
| `scripts/s01-t05-state-check.mjs:14–29` | Vérifie toutes créations T05 : aucun locator et toutes ACCEPTED/PENDING | Suite T05 doit s’exécuter avant démarrage worker et rester vérifiée sur ses fixtures réservées |
| `scripts/s01-secret-scan.py:14–18` | Collecte dossiers secrets existants non récursive | Inclure coffre versionné et représentations nouvelles, sans dump des valeurs |

Absences vérifiées par inventaire `rg --files apps packages scripts tests infra` et
recherches ciblées : aucun répertoire `apps/api/src/provisioning`, handler
`createFunction`/`serve`, boucle dispatcher runtime, tenant-router, agency-provisioner
ou secret-store. Les tests/migrations et les services Inngest existent ; cela ne
constitue pas une saga opérationnelle. Export `./secrets/*` absent du package adapters.

## Flux actuel → incrément attendu

```text
actuel : auth forte/J1 → T05 TX durable → 202 + outbox PENDING → aucun worker
T06 : outbox → Inngest privé signé → réveil non privilégié → provisioner séparé
      → gate global + lock op + autorité courante → effets/checkpoints répétés
      → audit local/central + locator vérifié → READY / ADMIN PENDING
T07 : confirmation humaine forte et atomisation ACTIVE (hors ticket)
```

## Sécurité, risques et questions résolubles par Design

1. **Fencing** : advisory lock n’empêche pas un ancien processus d’appeler coffre
   ou DDL depuis une autre connexion. Persister un execution_id et une barrière
   globale avant effet ; perte/issue inconnue bloque toute nouvelle opération.
   Reprise seulement après preuve d’arrêt du processus/capacité/backends de l’ancienne
   exécution et réconciliation. Aucun lease, CAS ou ping ne vaut fencing externe.
2. **Privilèges** : séparer orchestrateur Inngest sans DDL/coffre et process
   privilégié, identités maintenance/migration/runtime distinctes, aucune capacité
   administrative montée dans API/coordinator. Pas de superuser applicatif.
3. **Autorité** : événement opaque n’est jamais autorisation. Relire root/invitation,
   sujet/epoch/J1, membership, agency/opération avant chaque effet/checkpoint ;
   même ordre compatible avec T05. Révocation/deny/divergence/indisponibilité ferme.
4. **Secret/DB orphelins** : préparation durable d’identité/ref/version et preuve
   de propriété avant effets, readback vérifié avant adoption ; ambiguïté ne déclenche
   ni nouveau secret, ni ALTER PASSWORD aveugle, ni DROP/cleanup automatique.
5. **Migration** : additive0004, transition de fingerprints/checksums explicite,
   fixtures neuves/anciennes supportées, anciennes versions incompatibles fermées.
6. **Backlog** : nombre global d’opérations non terminées, admission sérialisée
   avant append J1 ; replay/contexte existant ne consomme aucune place. À100,
   nouvelles créations429 sans mutation de l’invitation ; désaturation réelle testée.
7. **Pools** : budget global≤80/PG100, réserve20, deux processus runtime, max4
   pools×2/processus, temps acquisition2s/SQL5s, idle60s. Inventorier KC/PI/Inngest,
   contrôle, tests, migration et supervision ; réduire avant démarrage si dépassement.
8. **Régressions** : worker ne consomme jamais implicitement fixtures T05 historiques.
   Namespace indépendant, démarrage/arrêt explicites et suite T04/T05 avant worker ;
   nouvelles preuves T06 sur leurs propres agences, sans modifier les anciens invariants.

Un job utilise une identité service et l’autorisation persistée courante, jamais
un cookie humain conservé ; logout/idle seuls ne suppriment pas une commande
durable (ARCHITECTURE.md:184), tandis que révocation/J1 restent opposables.
Authentification humaine : BFF/MFA existante, Origin/CSRF pour mutation HTTP.
Authentification technique : callbacks Inngest signés/corps brut et transport interne
borné ; canal privé du provisioner avec identité de processus vérifiée.
Données sensibles : credentials DB, chemins coffre, J1 et clés ; aucun contenu métier,
contact/nom/email ou secret dans événement/trace/erreur. Tenant : DB et rôle dédiés,
canaris A/B privés. Actions externes : uniquement synthétiques locales à Execute ;
ni achat/Scaleway ni déploiement autorisés. Validation humaine : reprise après
fencing réel selon procédure privée, activation T07 et fusion D57 séparées.
Observabilité : UUID opération/exécution, étapes/codes sûrs/compteurs ; logs bruts
privés sans credentials ni DSN. Rollback code par revert humain, objets/secrets/J1
conservés et accès fermé ; pas rollback d’autorité ni suppression automatique.

## Sources primaires complémentaires, consultées le 2026-10-16

- [PostgreSQL17 CREATE DATABASE](https://www.postgresql.org/docs/17/sql-createdatabase.html) :
  CREATEDB requis, hors transaction, ALLOW_CONNECTIONS false ferme initialement,
  ACL base non héritées du template. Les tests devront démontrer le montage retenu.
- [PostgreSQL17 locks](https://www.postgresql.org/docs/17/explicit-locking.html) :
  advisory volontaire et session libérée à la fin de connexion, donc insuffisant
  comme preuve d’arrêt d’une capacité externe.
- [PostgreSQL17 administration](https://www.postgresql.org/docs/17/functions-admin.html) :
  pg_terminate_backend avec attente et readback d’absence ; identifier aussi
  backend_start/execution_id, jamais PID seul recyclé.
- [Inngest concurrence](https://www.inngest.com/docs/functions/concurrency) et
  [durabilité](https://www.inngest.com/docs/durable-execution/durable-workflows) :
  concurrence moteur et persistance step ne donnent pas exactement une émission.
- [Inngest HTTP serve](https://www.inngest.com/docs/learn/serving-inngest-functions) :
  intégration HTTP signée à qualifier avec SDK4.23.0 retenu, sans passage en mode dev
  non authentifié pour faire réussir un test.

## Recommandation et gate

Préciser ces contrats dans Design puis séquencer adaptation Setup/capacités,
migration additive, saga privée/fencing, handler/outbox, routeur, admission/état et
qualification. Aucune contradiction concrète n’invalide une décision acquise.
Les preuves runtime/licence commerciale/IAM/PRA ne sont pas dues à Research ;
les validations T06 pertinentes seront attribuées dans Plan, les N3 restent gates
avant réel. Pas de décision utilisateur indispensable laissée ouverte.

- [x] Code réel inspecté, dépendances/fichiers/flux identifiés.
- [x] Risques, secrets, autorité/isolation, observabilité et rollback documentés.
- [x] Frontière READY/T07 et écarts de schéma/capacités identifiés.
- [x] Revue indépendante PASS ; aucun Critical/Major/Minor ouvert. Les décisions
  techniques listées ont leur place en Design, aucun blocker Research.

Verdict : **PASS**, préparation documentaire uniquement. Design peut commencer.
Lectures ciblées/déléguées seulement ; volume exact tokens/coût/quota non observable.
