# Plan — #74 / S01 T06 Provisioning répétable et routage isolé

## Statut et résultat attendu

`PLAN: PASS` — 2026-10-16, après [Research PASS](research.md) et
[Design PASS](design.md), [revues Design](design-review.md) et
[revue indépendante Plan2](plan-review.md).
[ticket/AC1–AC10](ticket.md), [ticket GitHub](https://github.com/issa-diallo/dossiercle/issues/74).
Mission actuelle : préparation seulement ; les étapes ci-dessous sont le contrat
**futur** de l’implementer, aucune étape runtime exécutée par cette session.

Résultat observable : une création durable T05 est provisionnée une seule fois
au sens des ressources et de leurs identités, malgré duplications/pannes ; deux
agences ont bases/rôles/secrets isolés ; READY technique, ADMIN PENDING et aucune
activation. L’absence de résultat réseau n’est jamais transformée en succès ou
réémission aveugle. N2 synthétique bornée, aucune qualification commerciale implicite.

## Révision, dépendances, rôles et découpage

Base `b18cd38b2c93234211c3c66bba654d63f297149c` (#72 fusionnée), branche
`feat/74-s01-t06`, worktree `worktrees/74-s01-t06`. Ne pas travailler dans main,
T04/T05 ou #73. Un implementer écrivain ; reviewer indépendant pour Setup,
graphe sécurité puis code final ; Lead Tech distinct au Ship LARGE. /root tient
cette préparation ; prochain agent prend le rôle implementer après relecture du
handoff. Aucun parallélisme d’écriture sur fondations/saga/routeur.

Dépendances : T00–T05 fusionnées ; N1 Architecture et préparation S01 disponibles.
Aucune dépendance à #73 ou à T07 ; pas de B05/B06/cloud. Si la méthode/main évolue
avant reprise, comparer le diff pertinent, revalider les contraintes qui changent ;
ne pas écraser la préparation ou réexécuter aveuglément les gates déjà acquis.

**Complexité élevée/critique, LARGE** : DDL multibase, J1, fencing et secrets.
Niveau recommandé High pour exécution/review ; Extra High ciblé si contradiction
sécurité ou deux corrections sans convergence. Configuration actuelle héritée,
modèle/niveau exact, tokens/coût/quota non observables ; aucune économie inventée.
Critère d’arrêt : résultat mesurable atteint ou blocker réel avec faits/contrainte/
correction attendue ; jamais abaisser un invariant pour terminer.

**Découpage évalué avant code** : (A) fondations Setup/ACL/coffre ; (B) routeur ;
(C) saga/orchestration/admission. Ces tranches sont des checkpoints de travail
strictement dépendants et chacune sera vérifiée. Pour #74, une PR dédiée T06
rassemble le contrat final : READY exige simultanément gestion d’autorité, coffre,
ACL, routage et reprise ; preuve de sûreté transversale requise avant exposition.
Exception explicite aux cibles1–3 fichiers/100 lignes, probablement plusieurs
dizaines de fichiers. Conserver un objectif, diff limité aux dépendances directes
et un commit logique final. Si un socle réellement autonome justifie plusieurs
PR, produire avant Execute le découpage/tickets/contrats et revue du Plan amendé ;
ne pas livrer une route READY ou un principal DDL sans sa barrière et ses preuves.
Aucun commit ou PR demandé pour cette préparation ; conserver les artefacts locaux.

## 0. Worktree Setup avant Execute métier

### 0a — adapter le bootstrap sur environnement encore vierge

Modifier uniquement fondations nécessaires, puis revue indépendante avant premier
`--synthetic` :

- `scripts/s01-worktree-identity-check.py` et test : ajouter exactement couple
 74-s01-t06/feat/74-s01-t06 ; conserver anciens couples et refus main/detached,
 symlinks/fausse racine/Git non lié/collision. Vrais worktrees Git temporaires,
 aucun secret/Docker avant validation de l’identité.
- `scripts/worktree-setup.sh`, `scripts/s01_owner_key.py` si contrôles mounts
 concernés, nouveau `scripts/s01-t06-environment-check.py` et test : namespace/ports
 privés, markers et ressources propres ; aucun .local/secret/DB/CA copié de T05.
- Préparer dès initialisation fraîche les répertoires coffre runtime/migration,
 0400/0700 tmpfs, identités PG provisioner central/control_t06 et provisioner_ddl,
 client/serveur mTLS privés/configs. DDL LOGIN non-superuser maintenance seulement,
 aucune clé admin dans API/orchestrateur. owner-signing T05 demeure hors mounts.
- `infra/local/compose.yaml` : profils T06 inactifs au démarrage initial ;
 orchestrateur privé sans DDL/coffre/J1, provisioner séparé restart=no et mounts
 minimaux (runtime RW, migration RW, J1 RO), API/coordinator runtime RO uniquement.
 Pas port public nouveau ni Docker socket, pas montage parent contournant RO.
- Préparer scripts config/grants appelés **après** migration centrale ; pas de
 régénération automatique d’une clé/secret manquant sur environnement retenu.

Cette tranche bootstrap est justifiée car le setup refuse encore cette identité
et les nouvelles clés doivent exister avant environnement retenu. Elle ne lance
pas la saga/worker/route métier. Tests déterministes d’identité/mounts/config et
revue du delta avant mutation synthétique ; échec = aucun Setup PASS.

### 0b — environnement froid synthétique puis gate Setup

Exécuter setup --synthetic avec outils figés/install frozen ignore-scripts comme
workflow T05 ; --check puis build initial et migrations existantes0001–0003,
configuration native selon workflow. Étendre après l’étape1 vers0004/grants.
Ne pas démarrer profils T06 tant que code/barrières/registre ne sont pas prêts.
V0 inventorie limites réellement configurées : PG100 ; KC actuel4, PI2 et Inngest4
constatés dans sources, plus tous pools/runtime/tests/supervision. Enveloppe Design
57 est un plafond proposé à configurer/mesurer, pas la consommation de cette base.
Somme≤80 avec réserve20 ; sinon réduire les pools/concurrence avant lancement.
Consigner `environment.md`, IDs/ports opaques, versions/digests/mounts/permissions,
proofs minimisées et revue Setup. Ne jamais publier passwords/DSN/cert privées.

## 1. Schéma, domaine et capacités centrales

Créer correction `packages/adapters/migrations/control/0004_s01_provisioning.sql`
selon Design section3 : champs locator version/ref migration/ownership, tables
execution/gate/effect/wakeup et compteur wakeup_generation, FK/CHECK/index unique
d’exécution ouverte et intentions
uniques. Ne modifier aucun SQL0001–0003 ni agency0001.

Modifier `packages/adapters/src/postgres/{control.schema,migrate}.ts` : chaîne
checksum historique explicite, fingerprint connu avant correction, nouvelle
empreinte après commit ; support frais/0001/0002/0003 déjà attestés sans admettre
schema partiel ou drift inconnu. **L’ancien runtime n’a pas de contrôle de modèle
compilé** : arrêter/drainer et constater l’absence d’anciens API/coordinator/
dispatcher/provisioner identifiés, ingress applicatif fermé, avant0004/grants.
Rebuild identifié puis check de compatibilité T06 au startup (`apps/api/src/main.ts`
et entrypoints/launcher concernés) avant réouverture. Aucun mode mixte ni promesse
de migration à chaud. Tester refus de l’ancien migrateur sur nouveau checksum ;
tester séparément le protocole d’arrêt et le refus de démarrage non préparé, sans
affirmer que l’ancien binaire sait refuser0004. Rollback arrête T06 et garde accès
fermés, aucune relance de l’ancienne API supposée compatible. Locator legacy sans nouvelle version
reste non qualifié, jamais complété arbitrairement par default de confiance.

Créer `packages/domain/src/provisioning.ts` + tests et export ; transitions,
classification sûre retryable/unknown/terminal, compteur3 reprises, bornes,
manifest serveur immutable et gate/steps/version CAS. Aucun import PG/http dans domaine.
Créer `packages/adapters/src/postgres/provisioning.repository.ts` et
`t06-capabilities.ts`, routines/grants + assertions exactes.

`control.lock_provisioning_scope(UUID)` SECURITY DEFINER dans0004 : owner
control_migrator, session_user provisioner, search_path pg_catalog, PUBLIC révoqué,
lookup operation→tuple et verrous normatifs, résultat minimisé, aucun UPDATE identity
au caller. Reconciler : fonction `control.reserve_t06_wakeup(UUID)` selon Design section9,
SECURITY DEFINER borné à control_dispatcher, session_user/path/PUBLIC et tuple
serveur contrôlés ; aucun droit direct de mutation d’audit/wakeup/opération au
dispatcher, aucune fonction DDL générique SECURITY DEFINER.

Étendre `audit-writer.ts` allowlist au profil central provisioner/control_t06 et
capacité SET control_audit sans ADMIN/INHERIT ; restaurer exactement rôle précédent,
audit/outbox atomiques, aucune mutation d’audit. Adaptations `runtime-pool.ts` pour
profil central provisioner et bornes≤4/processus, sans desserrer autres rôles.
Revue indépendante grants/fonctions/ordre des locks avant la saga.

## 2. Coffre versionné et primitives DDL d’agence

Créer `packages/adapters/src/secrets/secret-store.ts`, export `./secrets/*` dans
`packages/adapters/package.json`, tests unitaires sur FS réel temporaire privé :
publication exclusive/atomique/fsync, bindings UUID/op/ref/version/kind, mode/UID/
symlinks/ancêtres, collision/incomplet/perte tmpfs, même secret à la reprise.
Aucun remplacement/rotation implicite, version précédente conservée, aucun stdout.
Étendre scanner `scripts/s01-secret-scan.py` à ces arbres et clés mTLS avec collecte
récursive sûre et tests canaris ; aucun dump des valeurs ou pattern sensibles.

Créer `packages/adapters/src/postgres/agency-provisioner.ts` : maintenance séparée,
rôles taggés+intention durable, DB déterministe ALLOW_CONNECTIONS false, readbacks
OID/propriétaire/membership ; retrait PUBLIC CONNECT/TEMP avant réouverture agm.
Credentials SCRAM et SQL/quoting sûrs, jamais paramètres DDL arbitraires depuis réseau.
Connect migration propre max1, migrate agency1 conservé, vérification marqueur/
checksum/ledger/config false, audit local stable. Créer business vide/owner/ACL
et default privileges dans transaction ACL distincte, sans CRUD runtime metadata.
Vérifier aussi DB control/KC/PI/Inngest/postgres/templates/autres fermées aux runtime.

Créer tests PG réels `provisioning.integration.spec.ts`, `t06-capabilities.integration.spec.ts`
et enrichir schema tests sans réécrire anciens cas : frais/replay, rôleAPI sansDDL/
SETROLE, flags/memberships, PUBLIC, droits futurs canaris table/séquence, conflits
préexistants refusés sans modification. Aucune adoption par nom ou reset password.

## 3. Routeur, contexte et pools bornés

Créer `packages/adapters/src/postgres/tenant-router.ts`, tests unitaires et
`tenant-isolation.integration.spec.ts`. Contextes opaques serveur humains/service,
lookup centre→locator→secretVersion→connection ; capability technique privée
provisioner liée execution/locks, aucune option publique `trusted=true`.

Étendre `agency.repository.ts` pour confirmer checksum et privilèges T06 sans
confondre assertion de schema et autorité courante. Clé cache agency+versionsecret+
verificationVersion, max4 pools×2 par processus, aucun préchargement d’agences,
acquisition2s/SQL5s/idle60s, saturation503, close attendu sur éviction/rotation et
invalidations vérifiées avant nouvelle action. `pg`/driver timeouts ne sont pas
présentés comme annulation prouvée d’un effet déjà en cours ; tester backend réel.
API en READY refuse toujours routeur métier et session agence ; aucun ACTIVE créé
pour simplifier un test T06. Deux DB canaris A/B privés suffisent pour test technique.

## 4. Saga persistante et fermeture après perte de lock

Créer `apps/api/src/provisioning/provisioner.main.ts` et service/saga dédié ;
serveur mTLS privé, parsing strict/body4Kio/host/méthodes/timeouts, seul eventId
accepté. Charger configuration de fichiers privés contrôlés, pas env/CLI secrets.

Connexion centrale dédiée conserve singleton puis lock operation pendant toute
la tentative. Intentions/locator/execution/gate RUNNING committés avant premier
fichier ou DDL ; transactions par effet sous root→invitation→autorité→membership
→agency→operation→gate/effect et J1 courant. Ne pas acquérir nouveau verrou après
un append J1 ; ce worker ne fait aucun append. Revalider chaque étape ; réponse
perdue = readback de la même intention, pas nouvelle ressource.

Inventorier chaque backend d’effet avant première mutation avec execution_id,
pid/backend_start ; désactiver reconnexion/reprise implicite d’un détenteur perdu.
Gate non clos bloque toutes opérations même après disparition advisory. CLOSED
seulement après capacités drainées et résultat certain. Code sûr sans résultat
connu ne libère pas le gate, même si erreur ne peut plus être committée.

Créer `scripts/s01-t06-reconcile.mjs` et harnais dédié : host privé, procédure
Design section7 en mode inspection d’abord ; pas credential host admin monté dans
app. Arrêt instance+descendants réel et absence backend exact, pas signal seul,
preuve/confirmation privée (fixtures synthétiques marquées), readback propriété/
effets avant FENCED et IDLE. Aucune suppression/rotation/terminaison de backend étranger.
Revue du protocole/graphes avant intégration des callbacks ; démonstration ensuite
pause/partition/processus suspendu+réveillé et seconde opération concurrente.

Commit final READY atomise état/ready_schema_version/locator version/op READY-
SUCCEEDED/audit/execution CLOSED/gate IDLE seulement après preuve runtime+audit
local confirmé et autorité courante. Conserver ADMIN PENDING/NULL activated_at.

## 5. Inngest, dispatcher et récupération

Créer `apps/api/src/provisioning/provisioning.function.ts` et
`orchestrator.main.ts`. Serve HTTP SDK pin sur réseau privé, signatures natives
obligatoires et tests négatifs ; appel mTLS au provisioner, aucune capacité DDL/
coffre dans orchestrateur. Adapter `outbox-dispatcher.ts`/repository seulement
pour lecture source/reprise/filtres nécessaires, sans perdre autres types d’events.

Valider event.id+type+schema+agency+root+version contre audit/outbox ; root≠operation,
lookup op actuelle ; réveils périmés/forgés ne créent rien. Un step durable englobe
la tentative, aucun PoolClient/secret/DSN dans retour/état step ; concurrence1
moteur et max3 reprises ne remplacent pas gate SQL/attempt durable.
Reconciler borné30s : même eventId pour outboxPENDING ; nouveau type strict
`agency.provisioning-wakeup` schema1, resourceId=operationId/version=generation,
expected_operation_version/target_attempt/delivery_round1..3 liés par table wakeup.
Fonction reserve_t06_wakeup acquiert les verrous root→invitation→autorité→membership
→agency→opération dans le même ordre, sans inversion via FK, sérialise scans et réutilise round
existant si PENDING ou<30s, crée round suivant seulement après DELIVERED sans progrès
et sans exécution non close. Compteur monotone/wakeup+audit+outbox dans même TX ;
contraintes exactes Design section3/9. Handler accepte explicitement creation-accepted
(resourceId=root) ET provisioning-wakeup (resourceId=operation), valide les deux
contre sources courantes et ignore les vieux expected_version/attempt, jamais DDL
sur tuple signé seul. Trois rounds épuisés sans progrès suspendent les réveils,
commande conservée au backlog ; procédure host privée de reprise après inspection
et audit/confirmation, sans reset automatique des compteurs ni effet direct. Aucun
fallback direct effets/moteur secondaire. Tester deux scans concurrents, délai PG,
vieux callback, crash de la TX réservation, échec send/PENDING puis DELIVERED, nouveau
réveil après déduplication moteur et budget épuisé. Tester vrai serveur1.46.0+SDK4.23.0,
publication puis crash avant ack, duplication callback, redémarrage et replay step.

## 6. Admission, état API et compatibilité T05

Modifier `apps/api/src/auth/t05-locks.ts` : option privée agency-create, lock
admission avant roots/authorities/sessions/J1. Modifier `agencies.service.ts` :
validate conserve décisions replay/name/corps puis compte backlog seulement pour
création neuve. Borne100 atomique,429/Retry-After60 sans nouvel append/refresh/idem/
création ni mutation d’invitation ; replay accepté même plein. Test seuil99 avec
roots/sessions/connexions concurrentes et saturation puis désaturation réelle.
Adapter frontière HTTP si Retry-After nécessaire, sans changer Origin/CSRF/limites
ou parseur T05. GET reflète erreurs/états persistés en gardant actions false.
Aucun POST activation/retry ni scope agence READY ajouté ; DTO/OpenAPI compatibles,
compléter description backlog et tests contrats/HTTP sans changer réponses existantes.

Modifier `scripts/s01-t05-state-check.mjs`, helpers de fixtures et tests natifs
pour enregistrer manifestes privés **exhaustifs et disjoints** de fixtures T05
protégées et T06. Valider UUID/relations/listes non vides, détection d’omission via
inventaire différentiel avant/après suite et provenance centrale de création,
pas confiance à une liste client choisie pour exclure un cas échoué.
L’union disjointe des deux manifestes doit égaler l’inventaire central complet des
créations t05.agency-create.v1 ; tout tuple non classé provoque un échec, jamais
une exclusion silencieuse. T05 reste protégée par défaut avant inscription privée
explicite d’un tuple dans le jeu T06.
Worker synthétique n’est démarré qu’avec allowlistT06 restrictive, jamais drain T05.
State-checkT05 conserve zéro locator/READY/ACTIVE et ACCEPTED/PENDING sur toutes
ses fixtures ; state-checkT06 atteste READY/FAILED autorisés et zéroACTIVE/adminactif.

## 7. Environnement intégré, CI, preuves et livraison future

Ajouter commandes `test:provisioning`, `scripts/s01-t06-test.sh`, check d’état
`scripts/s01-t06-state-check.mjs` et config/tests de process appropriés. Étendre
worktree-dev/test/down : start T06 explicite après checks, stop seulement services
identifiés, conserver clés/données/J1. README précise identité et commandes ;
aucune hausse pins, aucun changement parasite à #73, aucun nettoyage automatique.

Créer `.github/workflows/s01-t06.yml` avec checkout/action SHAs épinglés existants,
worktree exact74, Setup froid puis build/migrations/auth native, tests et scans.
Conserver scénarios des workflows T04/T05 et leurs identités ; absence worker
implicite dans ces suites, vrais tests T06 dans profil séparé. Tous checks de tête
requis, pas seulement check documentaire. Logs bruts ignorés privés, rapport réduit
sans cookie/QR/TOTP/recovery/DSN/clé ou dump DOM.

Après Verify : review indépendante code/AC/diff, corriger et rejouer les preuves
impactées ; Goal d’implémentation mesurable SATISFIED, ouvrir PR dédiée, CI de tête
puis Lead Tech distinct (rôle REVIEWER). Si rapport committé, ultime attestation
hors diff après commit/CI sur SHA base+tête définitifs. READY_FOR_HUMAN seulement
après ces gates. Fusion D57 exige instruction humaine applicable ; aucune autorisation
héritée T04/T05. S01 reste IN_PROGRESS ; pas de T07 ou cleanup implicite.

## Matrice de vérification prévue par AC

| AC | Commandes/suites et preuves minimales |
|---|---|
| 1 | Unit contrats event/context ; PG t06-capabilities ; API anonyme/étranger/CSRF, callback signature/cert erroné ; aucune capacité DDL hors provisioner |
| 2 | PG provisioning, doubles runners/ids, kill après chaque effet avant checkpoint, réponse perdue, secret/version/DB/OID stables ; conflit homonyme refusé sans mutation |
| 3 | Harnais processus réel : SIGSTOP autour effet, partition/perte central, tentative seconde opération, SIGCONT ancien encore vivant refusé ; fencing effectif puis reprise même intention |
| 4 | PG pause CREATE→REVOKE→open et migration ; CONNECT A→B refusé à chaque frontière, flag/rôles/SETROLE/ACL et privilèges futurs réels |
| 5 | PG tenant-isolation deux vraiesDB+rôles : canari lecture/écriture et CONNECT B/control/KC/PI/Inngest ; substitution contexte/pool/repository et contrôle après connexion |
| 6 | FS réel privé + PG marqueur/checksum, symlinks/secret/version étrangère/perte, rotation fixture explicite vers version2 et fermeture pools anciennesversions sans suppression |
| 7 | HTTP/PG concurrence99/100/replay/corps409 et pas J1 sur429 ; temps acquisition/SQL/idle/saturation observés, pg_stat_activity et config prouvent budget≤80 |
| 8 | Serveur Inngest réel pin + mTLS, publication/ack crash et callback doublon/sleep replay ; trace step minimisée et absence second DDL après partition |
| 9 | Audit local refus/perte réponse, central commit avant vueREADY ; GET no-store sans refresh, PENDING/NULL/false, aucun ACTIVE ni accès métier |
| 10 | Build/typecheck/lint, unit/contrats, PG intégration,13 scénarios natifs existants T04/T05 conservés + scénario statutT06 ; état/scans, CI de tête et revues indépendantes |

Commandes de base **futures**, PATH figé depuis environnement propre :

```sh
bash scripts/worktree-setup.sh --synthetic
export PATH="$PWD/.local/node/bin:$PWD/.local/pnpm-native/package:$PATH"
pnpm build
node scripts/s01-control-migrate.mjs
pnpm test:unit
pnpm test:contracts
pnpm test:integration
pnpm test:auth
pnpm test:provisioning
python3 scripts/s01-secret-scan.py --worktree
bash scripts/agentic-check.sh
git diff --check
```

Les prérequis auth/configuration suivent workflowT05 avant test:auth ; ce bloc
n’est pas un raccourci supprimant0a/0b. Les commandes nouvelles seront créées aux
étapes indiquées. Exécuter suites runtime/perturbations **séquentiellement** sur
chaque environnement ; ne pas perturber auth pendant une qualification PG.
Après checks pertinents PASS, élargir/rejouer seulement pour delta/échec/risque
encore ouvert ; conserver échecs historiques sans les requalifier arbitrairement.

## Validations différées et risques

| Sujet | Responsable | Échéance | Vérification / action si échec |
|---|---|---|---|
| Identité Git/mounts/keys/profils PG | Implementer + reviewer Setup |0a/0b avant premier environnement retenu | Déterministes réels, Docker/ACL observés ; rester fermé sans régénération |
| Compatibilité SDK/serveur et signatures | Implementer + reviewer backend | étapes5/Verify avant T06 PASS | Inngest réel pins ; corriger intégration compatible ou blocker factuel, pas changer fournisseur |
| Locks/autorité/fencing/secret incertain | Implementer + reviewer sécurité | étapes1/4 puis Verify | Pause/partition/crash/ancienrunner et preuve fence ; gate fermé sinon |
| Isolation PG/coffre/routage/ACL | Implementer + reviewer sécurité | étapes2/3/Verify avant READY | Deux DB/canaris/permissions réelles ; aucune activation si non démontré |
| Densité/pools/réseau/connexions | Implementer QA | V0 puis Verify avant start/capacité | Config et mesure budget≤80 ; réduire pools/concurrence, jamais PG augmenté sans trace |
| Licence usage/version Inngest | Propriétaire projet | N3 avant vente | Qualification écrite prévue ADR023 ; aucune vente sans résultat favorable |
| Coffre/IAM cloud, journal ObjectLock, PRA<4h | Propriétaire/exploitation | N3 avant données réelles/mise en service | Preuves spécifiques ADR022/024/028 ; synthétique ne les qualifie pas |
| Coûts exploitation/montée en charge | Propriétaire produit | Après implémentation et avant engagement réel | Mesure réelle, suivi budget ; pas dépense implicite dans #74 |

Risques résiduels acceptés : indisponibilité conservatrice après incertitude,
privilège administratif intrinsèque du process DDL, tmpfs non durable au reboot.
Mitigation : processus/credentials séparés, gate fermé, recovery host vérifiée,
aucun accès métier et pas de promesse HA/PRA commerciale par ces tests.

## Fichiers prévus et limites

**Créer** : SQLcontrol0004 ; domaine provisioning+tests ; postgres provisioning.repository,
t06-capabilities, agency-provisioner, tenant-router ; secrets/secret-store+tests ;
apps/api/src/provisioning/{provisioner.main,provisioning.function,orchestrator.main,
provisioning.service}.ts ; tests intégration provisioning/tenant-isolation/t06-capabilities/
t06-process et unitaires contexte/coffre/saga ; scripts environment/config/reconcile/
state-check/test T06 ; workflowT06 ; environment/execute/verify/review/goalimplementation/
handoffimplementation/ship/lead-tech-review et preuves minimisées du ticket.

**Modifier** : control.schema/migrate/runtime-pool/agency.repository/audit-writer/outbox-dispatcher ;
package exports/scripts, domain exports ; setup/guard/tests/mounts/secret scanner et
worktree-dev/test/down ; auth/t05-locks et agences service/contrats tests/OpenAPI descriptions ;
fixtures/checks T05 manifestes exhaustifs et tests de ces scopes ; main.ts/launchers
pour protocole de migration hors ligne et compatibilité nouveau build ; compose/README/STATUS.
Toute adaptation auth.service doit se limiter au contrat privé d’admission et conserver
les preuves T04/T05. Fichiers réels à confirmer sans dupliquer un module existant.
**Supprimer** : aucun ; aucun SQL historique/pin/lock produit ou ressource existante retiré.

## Plan Gate

- [x] Étapes actionnables, contrats Design, fichiers et dépendances explicités.
- [x] Tests par AC, migrations/rollback, sécurité et validations différées définis.
- [x] Worktree/écrivain/review/Lead Tech/CI et limites humain/synthétique fixés.
- [x] Revue indépendante PASS, P1/P2 clos et Design revalidé, aucun Critical/Major ouvert.

Verdict : **PASS** documentaire. Worktree Setup/Execute/Verify runtime non commencés.

## Addendum d’exécution — constat PostgreSQL et findings de revue 2026-10-16

L’essai réel de `CREATEROLE` a observé une adhésion implicite `ADMIN=true,
INHERIT=false, SET=false`, grantor `synthetic_bootstrap`, pour chaque rôle agence
créé par `provisioner_ddl`. PostgreSQL ne permet pas au DDL executor de retirer
cette entrée bootstrap. Une seconde entrée explicite `agm <- provisioner_ddl`
`ADMIN=false, INHERIT=false, SET=true` est nécessaire à `CREATE DATABASE OWNER`;
elle est révoquée après création. Pour `agr`, aucune entrée SET n’est acceptée.
L’assertion attend exactement ces lignes, grantors et flags, et refuse tout autre
member, grantor ou SET vers le runtime. Le test relit toutes les lignes concernées,
confirme la révocation de SET vers agm et le refus effectif de SET ROLE agr. Le compte DDL demeure une capacité
administrative sensible déjà reconnue par le Design ; aucun runtime/API ne reçoit
`CREATEROLE` ou le credential.

Ce constat invalide l’exigence littérale d’absence de toute entrée ADMIN du DDL,
mais n’accorde aucun `SET ROLE` sur `agr` et ne modifie pas la barrière métier.
**Première revue indépendante de l’amendement : BLOCKED (3 Major).** Elle a constaté
assertion/test incomplets du graphe, absence de compensation/fencing vérifié après
effet partiel et droits CRUD par défaut trop larges sur `public`. Le code et le
Design sont corrigés : compensation ferme et relit la base, accès runtime différé,
ACL futures limitées à `business`, test de canari et vérifications du graphe.
**Revue indépendante révision4 : PASS (Critical0/Major0)**, puis Execute a révélé
que `provisioner_ddl` ne peut pas fermer une DB dont il n’est pas propriétaire
(DDL échoué, provisioning heureux PASS). Le Design/Plan sont rouverts sur le
protocole de fencing par owner migration. La première revue de ce protocole a
identifié une divergence documentaire ; Design/Plan sont amendés pour exiger
restauration temporaire du membership SET vers agm, REVOKE PUBLIC/runtime/TEMP et
ALLOW_CONNECTIONS false sous SET ROLE depuis la base centrale, révocation du SET,
readback zéro session, et BLOCKED si session persistante. Revue indépendante
révision6 : PASS (Critical0/Major0), statique seulement, incluant cleanup/readback
malgré GRANT ambigu. Execute peut relancer le test PG ciblé ; statut IN_PROGRESS. Le Plan historique PASS demeure traçable et n’est pas réécrit rétroactivement.

### Delta d'exécution additif 0005

0004 étant appliquée, compléter la fonction de réveil prévue en étapes1/5 par
0005 additive. Reconnaître checksum0004 et vérifier son fingerprint avant
application transactionnelle de0005. Ne pas remettre0004 ni ses données à zéro.
Revue indépendante ciblée du delta avant migration ; assertions runtime incluent
ensuite0005. Le scope fonctionnel et les AC sont inchangés.

### Delta qualification Inngest

Configurer queue-workers5 sur1.46.0 : minWorkersFree5 du serveur refuse sinon
les scans malgré publication/FunctionScheduled. Conserver fonction concurrency1,
provisioner unique, gate SQL, max-open PG4/max-idle2 et budget total<=80. Revoir le
delta puis qualifier callbacks/pannes/mesures, sans aucun changement de pin/stack.

### Amendement de qualification CREATE — revue ciblée PASS avant application

Segmenter le sous-effet rôles, le commit de précondition CREATE et le sous-effet
DB, sans confirmer prématurément DATABASE_CREATED. Vérifier absence DB et OID
owner/runtime avant CREATE, conserver la précondition immuable dans l'intention.
Ajouter aux cuts processus : rôles committés, précondition committée, CREATE fermé
avant commentaire, commentaire avant REVOKE, REVOKE avant ouverture, ouverture
avant migration. Pour chaque cut : STOP réellement observé, perte centrale,
ancienne instance sans nouvelle émission après CONT, fencing/readbacks certains,
reprise et mêmes références/empreintes/OID existants. Tester séparément un
homonyme non qualifié, avec catalogue/ACL inchangés après refus.
Ne pas qualifier de PASS l'ancien scénario conservateur « fermé non inspectable »
comme preuve de répétabilité. Revue indépendante ciblée PASS avant exécution des nouveaux cuts ;14 scénarios
processus ont ensuite PASS, sans changement de migration ni de pin.

### Modèle de l'examen Lead Tech Ship

Mission configurée sur `gpt-6.1-sol`, effort `xhigh`, via le harness disponible,
avec fork indépendant sans historique de rédaction. Justification : sécurité
complexe des capacités privilégiées, concurrence/fencing et isolation tenant.
Validation attendue : diff/AC/preuves/CI/rollback, aucun Critical/Major, puis
attestation finale hors diff après toute nouvelle tête. Aucun coût/token précis
observable ; aucun changement prétendu du modèle de l'orchestrateur.
