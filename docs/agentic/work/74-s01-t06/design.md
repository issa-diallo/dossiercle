# Design — #74 / S01 T06 Provisioning répétable et routage isolé

## Statut et entrées

`DESIGN: PASS` — amendement fencing 2026-10-16 après revue indépendante révision6, Critical0/Major0 ; preuve statique, test PG correctif à rejouer en Execute. Révisions antérieures conservées dans [design-review.md](design-review.md).
Entrées : [ticket/AC1–AC10](ticket.md), [Research](research.md),
[S01 Design](../S01/design.md), [Plan T06](../S01/plan.md#t06--provisioning-répétable-et-routage-isolé),
[Architecture](../../../product/ARCHITECTURE.md), ADR002/004/022/023/024/030 cités
par Research. Le Design System reste référence ; aucune UI T06. Responsive/WCAG
sans objet dans cette tranche backend ; l’UI et ses vérifications restent T08.
Aucune décision de stack/hébergement remplacée, aucune ressource réelle acquise.

## 1. Résultat et interfaces

```text
T05 creation durable + outbox
 → dispatcher interne / Inngest signé
 → orchestrateur sans DDL ni coffre, appel mTLS privé limité à un event UUID
 → provisioner dédié : reload commande/autorité + verrou global et opération
 → préparation ressources → DB fermée → ACL → migration1 → secrets/ACL/runtime
 → audit local confirmé → commit central READY + opération READY/SUCCEEDED
 → ADMIN PENDING, activated_at NULL, accès métier fermé
```

Processus séparés : API dans le coordinator existant (main.ts), sans séparation
OS fictive entre ces modules ; orchestrateur Inngest+outbox sans
secrets agence/DDL ; provisioner privilégié unique. Seuls API et provisioner sont
autorisés à héberger le routeur runtime, au maximum deux processus. Orchestrateur
n’a qu’un pool control_dispatcher max2 ; aucune session humaine ni clé IdP.
Le provisioner lit J1 en RO, ne l’initialise ni n’y écrit ; le process API/coordinator reste
seul writer. Il ne reçoit ni cookie BFF, ni clé owner privée, ni bootstrap superuser.

| Interface | Contrat |
|---|---|
| Callback Inngest | Serve SDK4.23.0 sur réseau Compose privé, signatures natives sur corps brut, clé figée ; aucun endpoint public ni mode dev non signé |
| Réveil provisioner | POST privé `/internal/t06/wake`, mTLS CA privée avec nom serveur et identité client dédiés, body strict `{eventId:UUID}`, max4Kio, méthodes/host allowlist, timeout I/O borné ; jamais une DSN/agency/role arbitraire |
| Résultat privé | `{operationId, disposition: 'closed'|'busy'|'blocked'|'ignored'}`, aucun secret/nom DB ; admission d’un réveil n’est pas un succès READY |
| Reconciler | Même orchestrateur et même source durable ; scan borné30s, pas moteur concurrent. Réessayer outbox PENDING ; réveil neuf persisté/audité pour opération reprise autorisée si receipt moteur déjà consommé |
| GET activation existant | État/step/version/errorCode/retryable courants, no-store, auth actuelle ; `canActivate=false`, `canRetry=false`, `automationEnabled=false` en T06 |
| POST création existant | Même202 durable et replays ; ajout limite backlog429 avec Retry-After60, sans nouvel état ni consommation d’invitation |

POST activation et POST provisioning/retry restent non implémentés : T07.
Aucun endpoint de données métier/canari n’est créé. Les canaris sont privés aux tests.

## 2. États durables et erreurs

| Situation | Agence | Opération | Barrière globale |
|---|---|---|---|
| T05 acceptée | PROVISIONING | ACCEPTED/PENDING | IDLE ou occupée par une autre opération |
| Tentative technique autorisée | PROVISIONING | dernier step/RUNNING, attempt+1 | RUNNING avec execution_id |
| Échec connu sans effet incertain | FAILED | dernier step/FAILED, retryable selon catégorie | IDLE seulement après fermeture vérifiée des capacités |
| Effet/connexion/arrêt incertains | PROVISIONING ou FAILED selon dernier commit sûr | état antérieur conservé si centre indisponible, sinon FAILED/non retryable automatique | RUNNING non clos ou BLOCKED : jamais assimilé IDLE |
| Contrôle final réussi | READY, ready_schema_version1 | READY/SUCCEEDED | IDLE, exécution CLOSED |

Le step conserve la dernière étape confirmée ; aucune progression sur simple
réponse envoyée. READY est terminal pour T06. Membership n’est jamais promu,
activated_at reste NULL, configuration agence trois booléens false.

Codes internes bornés : AUTHORITY_CLOSED, RESOURCE_CONFLICT, SECRET_UNCERTAIN,
EXECUTION_UNCERTAIN, LOCK_LOST, SCHEMA_MISMATCH, ACL_MISMATCH, CAPACITY_UNAVAILABLE,
DEPENDENCY_UNAVAILABLE. Vue publique mappe conflit vers PROVISIONING_CONFLICT,
autres échecs techniques vers PROVISIONING_FAILED ou DEPENDENCY_UNAVAILABLE ;
pas d’ajout de code interne à ErrorCode public ni de message SQL/chemin.
`retryable` public décrit une reprise techniquement sûre, pas une action exposée.
Un résultat inconnu reste non réémissible jusqu’à réconciliation/fencing.

Un échec transitoire **certain et clos** peut être repris par identité service sur
la même opération, autorité courante et budget cumulé de3 reprises automatiques.
Attempt est durable ; l’engine n’est pas le compteur d’autorité. Après budget,
FAILED sans relance automatique, conservation des objets. Révocation/conflit ne
sont pas retryables. Aucun retry HTTP humain ajouté par T06.

## 3. Données et migration additive

Créer `migrations/control/0004_s01_provisioning.sql`, sans éditer0001–0003 ni
migration agency0001. Miroir Drizzle explicite ; migration transactionnelle,
checksum/fingerprint du préétat vérifiés avant transformation, nouveau checksum
après commit. Rejeu ancien état attesté, état neuf et état déjà0004 supportés ;
fingerprint inconnu/partiel refusé par le migrateur. **Un ancien runtime ne vérifie
pas cette empreinte compilée** : ce contrôle ne le ferme pas. Avant0004, arrêter
et drainer API/coordinator/dispatcher/provisioner identifiés de cet environnement,
constater leur absence et fermer ingress applicatif. Appliquer migration/grants
puis démarrer seulement les nouveaux builds identifiés avec check de compatibilité
T06 au startup. Pas de coexistence ancien/nouveau runtime ni de migration à chaud
revendiquée ; ancien migrateur refuse le checksum inconnu, ancien runtime est
fencé par ce protocole de lancement/arrêt. Une ancienne relance hors ce protocole
n’est pas une garantie du logiciel. Rollback laisse T06/ingress fermés jusqu’à
revalidation ; aucune relance automatique de l’ancienne API sur0004.

### Données nouvelles

- `control.database_locator` : ajouter `secret_version integer >0`,
  `migration_secret_ref uuid`, `ownership_tag text` SHA256. Nullable pour une
  ancienne ligne non qualifiée, **sans default inventant une qualification** ;
  nouvelle saga exige ces valeurs avant effet. schema_version0 et verification_version0
  tant que réservé. secret_ref runtime UUID opaque, migration_ref distincte ;
  même version1 initiale, toutes références générées serveur et immuables.
- `control.provisioning_execution` : execution_id UUID PK, operation_id FK,
  instance_id UUID, état RUNNING/CLOSED/BLOCKED/FENCED, started_at/closed_at,
  backends JSON strict minimisé (pid, backend_start, kind, execution_id),
  preuve fencing opaque nullable. Historique append-only, updates limités à
  progression/fermeture de l’exécution ; aucun secret, hostname libre ou DSN.
- `control.provisioning_gate` : singleton true, execution_id FK nullable,
  state IDLE/RUNNING/BLOCKED, version positive ; CHECK impose IDLE↔référence NULL.
  Une seule exécution globale non close ; ligne verrouillée avant changement.
  Index unique partiel sur constante pour les états RUNNING/BLOCKED empêche deux
  exécutions ouvertes, en complément de la ligne singleton.
- `control.provisioning_wakeup` : event_id UUID PK/FK outbox, operation_id FK,
  expected_operation_version bigint positive, target_attempt integer positive,
  delivery_round integer1..3, generation bigint positive, created_at UTC ; UNIQUE
  (operation_id,expected_operation_version,target_attempt,delivery_round) et UNIQUE
  (operation_id,generation). Ajouter operation.wakeup_generation bigint>=0 default0,
  compteur indépendant de operation.version ; aucun secret dans ces champs.
- `control.provisioning_effect` : effect_id UUID PK, operation_id FK, kind
  allowlist, target_version positive, status PLANNED/CONFIRMED/UNCERTAIN,
  expected_fingerprint SHA256, evidence JSON strict non sensible ; UNIQUE
  (operation_id,kind,target_version). Identifiant d’audit réservé avec l’effet,
  conservé pour readback après réponse perdue ; pas nouvelle intention sur replay.

Les tuples operation/agency/root/subject sont résolus via FK existantes, vérifiés
sous verrous ; colonnes d’association ne sont jamais réaffectées en reprise.
La réservation locator et les intentions durables précèdent les DDL/fichiers.
Retour arrière : arrêter T06 et fermer ses accès, revert code humain ; données,
versions, J1, DB et rôles conservés. Pas de down migration/DROP automatisé.

## 4. Identités et capacités PostgreSQL17

Tous profils NOSUPERUSER, NOREPLICATION, NOBYPASSRLS, NOINHERIT ; les mots de passe
restent hors SQL applicatif/logs, représentations SCRAM côté serveur seulement.
Requêtes valeurs paramétrées ; identifiants UUID dérivés, regex stricte et quoting
PG. Refus total d’identifiants/SQL/password depuis callback ou requête publique.

| Profil | Capacités et limites |
|---|---|
| control_api/control_coordinator/control_t05 | Profils existants conservés ; aucun CREATEDB/CREATEROLE/membership DDL, locator non mutable par voie T05 ; fonction admission étroite si besoin, audit existant |
| control_dispatcher | SELECT outbox/audit minimisés et UPDATE status/attempt déjà cadrés ; nouveaux réveils par fonction bornée sans choix libre d’événement ou d’actor, aucun grant locator/DDL |
| provisioner (central) | CONNECT control ; SELECT colonnes/objets nécessaires aux tuples/autorité ; UPDATE agency(state,ready_schema_version,version), operation(step,status,last_error_code,retryable,attempt,version), locator et nouvelles tables via profil control_t06 NOLOGIN limité ; jamais activated_at ni membership/identity/session |
| control_t06 | NOLOGIN/NOCREATEDB/NOCREATEROLE ; SET autorisé seulement depuis provisioner, sans INHERIT/ADMIN ; grants par colonnes, aucune propriété/control migration ; assertion exacte de droits et refus de dérive |
| provisioner_ddl | LOGIN maintenance postgres uniquement, CREATEDB/CREATEROLE, aucune table control/identity ; uniquement dans process privilégié, jamais API/orchestrateur ; pas clé superuser |
| agm_<uuidSansTirets> | LOGIN migration, propriétaire de sa DB/schéma/objets, NOCREATEDB/NOCREATEROLE ; credential privilégié stable distinct, jamais API ; aucune autre DB CONNECT |
| agr_<uuidSansTirets> | LOGIN runtime, non-owner, NOCREATEDB/NOCREATEROLE, aucune membership SET vers migration/DDL ou autre agence ; CONNECT seulement propre DB après validation |
| control_audit | INSERT audit/outbox seulement ; SET LOCAL ROLE depuis provisioner central autorisé explicitement, whitelist writeAudit étendue puis rôle caller restauré ; aucun UPDATE/DELETE |

provisioner_ddl crée ses rôles transactionnellement avec tag d’ownership/comment
et memberships administratives explicites : droits SET sur **agm propre créé**
requis pour CREATE DATABASE OWNER ; INHERIT FALSE. Aucun membre humain/API/runtime
n’est ajouté. Privilèges administratifs DDL sont une capacité technique sensible,
pas une preuve d’impossibilité absolue d’accéder au métier pour l’administrateur PG.
Les connexions utilisées par les repositories restent runtime dédiées et aucun
code de provisioning ne lit des dossiers. Tester graphe pg_auth_members, flags,
SET ROLE et connexion inter-DB ; aucune confiance dans le seul NOINHERIT.

**Amendement technique 2026-10-16, corrigé après finding Major et passé en revue indépendante :** le test
sur le PostgreSQL réel du worktree a montré que `CREATEROLE` porte une entrée
`pg_auth_members` ADMIN, INHERIT=false, SET=false, dont le grantor est
`synthetic_bootstrap`, sur chaque rôle créé par `provisioner_ddl`. Le DDL executor
ne peut pas retirer cette entrée. Une entrée distincte accordée par le DDL executor
permet SET=true, ADMIN=false uniquement vers son rôle `agm` ; l’entrée ADMIN
implicite ne donne donc aucun `SET ROLE`. Pour `agr`, seule l’entrée ADMIN non-SET
est observée ; aucune adhésion entrante ou SET vers `agr` n’est admise. L’assertion
de graphe doit distinguer et borner ces deux entrées, vérifier leur grantor et
révoquer après CREATE DATABASE l’entrée SET de `agm`. L’isolation opérationnelle
reste fondée sur le processus DDL privilégié et son credential, et ne prétend pas
qu’un principal CREATEROLE soit incapable d’administrer les rôles qu’il crée.
Les tests doivent confirmer ce comportement sur la version PostgreSQL figée ; si
le grantor/flags diffèrent, le provisioning reste fermé. Ce fait invalide seulement
la formulation « ADMIN=false sur toute adhésion du DDL », pas l’isolation runtime.

Les verrous de lignes centraux sans droit UPDATE sur identité passent par
`control.lock_provisioning_scope(operation_id uuid)` SECURITY DEFINER, propriétaire
control_migrator de confiance, search_path=pg_catalog, objets qualifiés, EXECUTE
PUBLIC révoqué et accordé uniquement à control_t06. Vérifier session_user provisioner ;
aucun argument root/subject arbitraire. La fonction dérive operation→agency→root→subject,
prend root advisory/invitation SHARE puis autorité (helper lock_authority existant),
membership SHARE, agency/operation UPDATE dans cet ordre, revalide associations
et retourne IDs/états/epochs/watermarks minimisés. Elle ne mute aucun droit ou état.
Le caller lit J1 RO, applique requireAuthority et tient la TX autour de l’effet.
Ne pas remplacer les row locks par SELECT simple ou accorder UPDATE identity.
Tests PG vérifieront EXECUTE étranger refusé, aucun UPDATE identity, ordre et
sérialisation avec revoke ; le besoin UPDATE de FOR SHARE est ainsi satisfait
uniquement dans le rôle definer.

Schema et droits runtime : SELECT metadata/configuration et historique audit ;
aucun droit d’écriture sur metadata/configuration/audit/migration ledger, DDL,
CREATE/TEMP ou DELETE audit au rôle runtime. Toute écriture d’audit reste réservée
à la capability locale explicitement bornée, hors du rôle runtime.
Le rôle migration crée le schéma `business` vide et détenu par agm ; les droits
futurs SELECT/INSERT/UPDATE/DELETE et USAGE/SELECT sur séquences ciblent uniquement
`business`. Les futurs objets `public` ne reçoivent aucun CRUD par défaut. Tester
une table et séquence canari sous `business`, puis les refus d’écriture sur metadata,
configuration et audit, ainsi que CREATE/TEMP dans `public` et TEMP au niveau DB.
Le fingerprint public de migration agency0001 reste inchangé ; l’existence/owner/ACL
et default privileges business sont une assertion T06 distincte à chaque vérification,
avec refus d’objet business inattendu en dehors des canaris privés identifiés.
Aucune ouverture ALL TABLES qui donne écriture metadata ; aucune dépendance RLS
pour remplacer DB/rôle séparés. Les futurs objets publics restent fermés.

## 5. Verrous, autorité et admission

### Autorité service et ordre

Une commande durable ne dépend pas de la durée d’un cookie : logout/idle ne
l’annule pas. Avant **chaque** effet et checkpoint, relire invitation CLAIMED,
identity_status CONFIRMED, subject attendu, autorité CONFIRMED/epochs concordantes,
J1 présent/convergent sans deny/PENDING, membership ADMIN PENDING de cette agence,
agence PROVISIONING (ou FAILED retryable autorisée), opération/locator concordants.
Pas de refresh natif, d’écriture J1 ou de session humaine recréée par worker.

Verrous de session dédiés : `s01.t06.singleton` puis `s01.t06.operation:<UUID>`.
Conserver **la même connexion centrale** jusqu’à fin de tentative ; jamais pool
release/reconnect automatique du détenteur. Transactions par effet : root advisory
et invitation → autorité → membership → agency → opération → gate/execution/effect,
puis lecture J1 sous verrou autorité, effet externe, contrôle/checkpoint et commit.
Respecter l’ordre des roots/subjects de T05 et tenir les barrières jusqu’au commit.
Pas de transaction distribuée revendiquée entre centre/DB agence/coffre.
Les refus prennent effet avant le prochain effet ; une action déjà engagée reste
visible/à réconcilier, jamais déclarée annulée rétroactivement.

### Admission backlog100

Étendre T05LockPlan avec option **privée de service** agency-create : dans
lockT05Subjects, prendre lock xact `s01.t06.admission` **avant** resolve/root/invitation/
autorité et avant tout append J1. Pas flag client. validate contrôle après auth/CSRF/
natif actuels : replay/corps/name conflict d’abord, puis seulement si aucune agence
propre compte les opérations PENDING/RUNNING, FAILED retryable ou bloquées/incertaines.
Seules nouvelles créations augmentent ce nombre ; sorties ne font que le diminuer,
aucune reprise d’un FAILED terminal hors backlog par T06. À100 :429 RATE_LIMITED,
Retry-After60, rollback sans création/record/refresh/J1 ni mutation invitation.
Une invitation déjà CLAIMED avant cet appel reste CLAIMED ; T06 ne prétend pas
annuler le claim séparé. GET et replays valides restent accessibles à saturation.
Deux créations de roots différentes au seuil99 sont sérialisées : une seule acceptée.
Pas de verrou admission dans une callback déjà sous J1 ; pas de SELECT FOR UPDATE
sur toutes les opérations pour compter.

## 6. Saga et preuves d’ownership

Chaque effet a une intention durable avant émission et un readback indépendant.
État non lu/propriété douteuse = fermé, jamais adoption sur seul nom. Les noms
`ag_<uuidSansTirets>`, `agm_<uuidSansTirets>`, `agr_<uuidSansTirets>` sont dérivés
seulement de agency.id serveur ; UUID canonical lower, aucun nom humain dans DDL.

| Étape | Effet et confirmation | Checkpoint durable |
|---|---|---|
| PREPARE, step ACCEPTED | Gate IDLE, ancienne exécution close, locks acquis ; réserver locator/ref/version/tag, execution RUNNING et intentions d’effets | Commit avant premier fichier/DDL ; absence de commit connu = pas d’effet |
| Secrets préparés | Coffre privé publie version1 runtime et migration, manifests op/agence/tag et empreinte attendus ; readback stable | Effet confirmé ; locator encore schema0/verification0 |
| Rôles puis DB | Rôles+tags dans TX maintenance ; CREATE DATABASE hors TX, OWNER agm attendu, ALLOW_CONNECTIONS false dès création | Confirmer OID/propriété/flags ; op DATABASE_CREATED après audit/checkpoint |
| Fermeture et ouverture migration | REVOKE PUBLIC CONNECT/TEMP depuis maintenance ; toutes autres DB/templates centrales vérifiées fermées aux runtime ; CONNECT agm propre puis ALLOW_CONNECTIONS true | Aucun CONNECT agr, aucune fenêtre A→B admise |
| Schéma | Connexion agm max1, migrate(agency,UUID) transactionnelle ; ledger checksum, marqueur UUID/version/checksum et configuration false ; audit local stable | Op SCHEMA_READY, schema_version1 ; crash avant central réconcilie commit local |
| Références et ACL | Confirmer références/version coffre, ACL DB/schema/tables/futures séquences ; octroi agr propre et connexion runtime limitée | Op SECRETS_REFERENCED, pas encore accès humain |
| Vérification finale | Runtime privé relit marker/ledger/checksum/ACL et canari propre ; audit local unique relu après réponse perdue ; revalider J1/tuple central | TX centrale agency READY/schema1 + locator verification_version=version attendue + op READY/SUCCEEDED + audit + execution CLOSED + gate IDLE atomiques |

Si une DB existe après réponse CREATE perdue : intention antérieure, propriétaire
agm taggé réservé à cette opération, OID/ACL/absence d’objets étrangers et marqueur
lorsqu’il existe doivent tous concorder. Une DB homonyme sans provenance complète
est conflit non retryable, même vide. Ne pas la modifier pour la rendre conforme.
Rôles existants : flags/memberships/tag/OID attendus ; secret existant : binding/
version/empreinte attendus. Aucun ALTER PASSWORD sur incertitude ni seconde DB.
Les grants déjà prévus et vérifiés peuvent être rejoués ; une dérive inattendue
n’est pas silencieusement corrigée ou révoquée pour masquer le problème.

## 7. Perte de verrou, crash et reprise réellement fermée

Le gate RUNNING est écrit avant l’effet ; toute exécution non close, même si
verrou PG disponible et processus apparemment mort, bloque **toutes** les nouvelles
opérations. Aucun timeout/lease ni heartbeat ne remet le gate IDLE. Le détenteur
qui perd son socket/lock invalide son contexte, cesse nouveaux effets, ferme ses
connexions ; ne recrée jamais sa capacité par une reconnexion implicite.
Un effet engagé sur une autre connexion peut finir : état inconnu à conserver.

Chaque backend DDL/migration s’enregistre par execution_id+pid+backend_start avant
première mutation ; aucun pool privilégié libre non inventorié. L’instance du
provisioner est dédiée, identifiée (container ID/identité démarrage), restart=no,
pas de child survivant hors son groupe ; pas de Docker socket dans l’application.

Procédure host privée `s01-t06-reconcile` :

1. Vérifier worktree/namespace/syntheticOnly et correspondance operation/execution/
   instance ; geler les réveils, empêcher restart automatique de l’ancien service.
2. Arrêter réellement le conteneur/groupe ancien et ses descendants ayant accès
   coffre ou DDL ; constater arrêt et identité exacte, pas seulement signal envoyé.
3. Avec capacité host d’administration privée **hors application**, relire les
   backends enregistrés, pid+backend_start+execution_id ; terminer uniquement ceux
   de l’exécution, attendre terminaison et vérifier absence. Inconnu ou non prouvable
   = ne pas rouvrir. Ne pas tuer arbitrairement un PID réutilisé.
4. Inspection RO de DB/rôles/ACL/secrets/effets ; résoudre readbacks PLANNED ou
   UNCERTAIN. Conflit/propriété douteuse reste bloqué, aucune destruction/rotation.
5. Après confirmation humaine privée de l’opérateur (fixture synthétique explicite
   autorisée dans tests), consigner référence de preuve opaque et audit ; marquer
   ancienne exécution FENCED. Gate IDLE seulement sous lock global, tuple courant
   et réconciliation certaine ; nouvelle exécution réutilise opération/ref/versions.

L’application ne détient pas pg_signal_backend/superuser ou clés de cette procédure.
SIGTERM seul, pg_terminate_backend sans attente, libération advisory et CAS seuls
ne sont jamais une preuve suffisante. L’indisponibilité conservatrice est acceptée.

## 8. Coffre synthétique et routage

### Coffre

Base de confiance : répertoire dédié sous `/dev/shm/<namespace>` créé au Setup,
0700, fichiers immuables0400, même UID nonroot contrôlé, marker synthetic connu.
Séparer subtree runtime **RW dans provisioner seul et RO dans API/coordinator** ;
subtree migration **RW dans provisioner seul**, absent de l’API/coordinator et de
l’orchestrateur. Le code identity ne résout pas de secret agence ; ce partage de
process API/coordinator n’est pas présenté comme isolation OS entre modules.
Orchestrateur sans coffre. Aucun mount parent/chemin alternatif RW dans API ;
credentials provisioner_ddl et migration jamais montés hors process provisioner.
Retour secret uniquement en mémoire du résolveur autorisé, jamais serialisé en step.
API ne peut pas écrire ni demander une version différente de locator courant.

Identités/ref/version/ownership_tag réservées avant génération ; opération coffre
create-if-absent sans écrasement, binding canonique op/agence/ref/version/kind.
Publication atomique sans remplacement avec fsync fichier+répertoire ; O_NOFOLLOW,
validation owner/mode/ancêtres et refus symlink/traversée/objet étranger.
Fichier incomplet, version disparue ou résultat indéterminé : fermé, pas régénéré.
Tmpfs perdu n’est pas une sauvegarde ; redémarrage host/perte clés garde les DB
fermées jusqu’à reprise explicitement qualifiée. Versions précédentes conservées.
Le mot de passe PG a un vérificateur système ; aucun mot de passe brut au centre.

### Routeur et pools

Interface serveur : contexte opaque issu du contrôle d’autorité courant ; resolver
centre renvoie locator lié à l’agence, jamais une DSN du client/job. Mode humain
exige ACTIVE+membership ACTIVE+epoch/J1 ; READY/PENDING est refusé. Vérification
technique T06 est une capability interne opaque construite seulement dans le
process provisioner sous les locks d’exécution, non exportée comme booléen HTTP.

Clé de pool = agencyId+secretVersion+locatorVerificationVersion ; vérifier avant
chaque acquisition et chaque action l’autorité/mapping actuel, pas seulement
l’ouverture initiale. Connexion vérifie current_database/current_user, marker/
schema/checksum et configuration fermée. Empreinte/context ne peut être substitué
par objet spread ou id libre ; repository reçoit le contexte lié à ce client.
Pools max2, max4/processus, acquisition2s, statement_timeout/query_timeout5s,
eviction idle60s. Cache saturé sans pool idle évictable :503 ; aucune création
illimitée. Éviction attend fermeture ; rotation/invalidation bloque nouvelles
acquisitions et ferme/drain les anciennes avant remplacement, timeout ferme.
Une requête déjà engagée n’est pas annoncée annulée fictivement.

Budget local : runtime≤16 (2×4×2), contrôle API≤4, provisioner≤4,
orchestrateur≤2, DDL maintenance1 + migration1, KC≤10, PI≤5, Inngest≤4,
setup/tests/supervision≤10 : enveloppe57≤80 et réserve20 sur PG100. Ce sont plafonds
à **configurer et mesurer** en V0, pas consommations constatées. Si upstream ne
permet pas ces plafonds ou compte davantage, réduire concurrence/pools avant start,
ne pas augmenter PG100. Une seule opération active, rôles/DB limites secondaires
ne remplacent pas les bornes clients.

## 9. Outbox, événements et tests sans contamination

Le dispatcher conserve event.id stable, pas de secret ni nom DB dans send/data.
Le handler accepte exactement deux types serveur, schemaVersion1 :

- `agency.creation-accepted` : eventId existe dans audit/outbox avec tuple exact
  type/agencyId/resourceId=root/version ; résoudre opération via agency.
- `agency.provisioning-wakeup` : resourceId=operationId, version=generation du
  réveil ; eventId pointe une ligne provisioning_wakeup dont agence résolue,
  expected_operation_version et target_attempt concordent avec l’opération
  actuelle. Audit/outbox partagent eventId/type/resource/version ; acteur service
  fixé serveur et correlation=operationId. Opération avancée ou tentative déjà
  commencée : ignorer ce réveil périmé, ne pas revenir en arrière.

Un callback signé contenant tuple inventé n’est jamais une capacité. Autres types
ignorés par la fonction T06. Le dispatcher n’en modifie pas la sémantique.

Réconciliation via `control.reserve_t06_wakeup(operation_id uuid)` SECURITY DEFINER,
EXECUTE uniquement control_dispatcher, search_path pg_catalog/PUBLIC révoqué et
session_user vérifié. Dérive tout tuple/acteur/type depuis les tables, aucune
entrée version/type/agency/round libre. Prélookup opération puis ordre root→invitation
→autorité→membership→agency→opération identique au provisioner, tuple revalidé ;
pas de lock opération avant agency qui inverserait l’ordre via les FK audit. Refuse terminal,
conflit, autorité courante SQL invalide, exécution non close ou budget de reprises
techniques épuisé ; le provisioner revalide ensuite J1 avant effet. Une outbox
PENDING est republiée même id. Sinon, pour une opération en attente ou une reprise
connue autorisée, le premier scan réserve round1 ; deux scans concurrents relisent
la même réservation. Si outbox déjà DELIVERED, sans démarrage d’exécution ni progrès
d’opération depuis30s (horloge PG), round suivant≤3 peut être réservé pour contourner
receipt moteur déjà consommé. Increment wakeup_generation, insert audit/outbox/
wakeup atomiques, version de l’opération métier inchangée par ce seul réveil.
UNIQUE(type,resource_id,version) outbox est satisfait par resourceId=operationId
et version=generation monotone. Audit resource_version versionne ici le réveil,
expected_operation_version reste séparée dans la ligne liée.

Après3 rounds livrés sans progrès, scans n’émettent plus et signalent suspension
opérationnelle minimisée ; l’opération durable reste visible et compte au backlog,
pas abandonnée ni considérée réussie. Inspection host privée, preuve aucune exécution
active/effet incertain, autorité courante et confirmation humaine peuvent augmenter
operation.version avec audit pour autoriser un nouveau cycle ; jamais reset par
timeout seul. Aucun effet n’est déclenché directement par cette procédure.
Même logique d’exécution et d’autorité, pas job direct bypassant Inngest.
Le step durable englobe une tentative complète, sans step.sleep/
await durable entre prise et release des verrous. Returns minimisés, retries bornés,
concurrency1 moteur comme réduction charge uniquement. Pas de promesse exactly-once.

**Portée des fixtures** : créer manifeste privé non sensible T06 dans son propre
worktree, listant agency/root/operation UUID autorisés aux scénarios T06. En mode
synthétique, gate de sélection du provisioner exige ces tuples ; jamais consommateur
global automatique des agences T05 conservées. Tests production-like de résolution
ne font confiance qu’au stockage central, l’allowlist synthétique ajoute une restriction.
Le state-check T05 doit accepter un manifeste explicite de ses fixtures protégées,
vérifier qu’il n’est ni vide ni tronqué et qu’aucun tuple T06 n’y est inclus, puis
maintenir exactement ses assertions zéro locator/READY/ACTIVE et ACCEPTED/PENDING.
Les checks T06 portent séparément leurs tuples READY/FAILED et absence ACTIVE.
Aucun retrait d’une fixture échouée ni skip/timeout abaissé pour obtenir PASS.

## 10. Couverture, vérifications différées et gate

| AC | Contrat et preuve attendue en Execute/Verify |
|---|---|
| 1 | Validation événement/source, mTLS/signature, service courant/root/epoch/J1 ; injections callback/locator et absence DDL depuis API |
| 2 | Intentions/ownership/ref version stables, doubles workers/événements, réponse DB/coffre perdue, conflits homonymes fermés |
| 3 | Gate global durable, pause/perte lock/partition/kill/réveil et tentative seconde opération ; reprise privée après fencing réel |
| 4 | Deux connexions pause CREATE→REVOKE→réouverture, ACL/flags/SET ROLE et default privileges réels |
| 5 | Deux DB+rôles/canaris A/B lecture/écriture/CONNECT, centre/KC/PI et pools/contextes étrangers interdits |
| 6 | Symlinks/versions/perte tmpfs/checksums et substitutions secret/objet/mapping ; aucune valeur publiée |
| 7 | Admission concurrente99/100/replays/rollback avant J1, pools saturation/acquisition/éviction et inventaire PG≤80 réel |
| 8 | Inngest serveur figé réellement signé, doublon publication/ack, redémarrage/reconciler/step replay sans second effet |
| 9 | READiness/audit local+central atomiques, erreurs sûres GET, ADMIN PENDING/NULL activated_at, aucun accès métier |
| 10 | Build/unit/PG/contrats/HTTP, conservation13 scénarios natifs T04/T05, CI de tête, Review et Lead Tech futures |

N2 locaux isolation/fencing/pools/Inngest sont à démontrer avant T06 Verify PASS.
N3 coffre/IAM cloud, licence avant vente, PRA/RPO/RTO et capacité commerciale restent
gates avant réel, pas requis pour PASS de cette conception. Propriétaire du projet
responsable ; Plan fixe exécutant/échéance/action en cas d’échec.

- [x] AC représentés, états/erreurs/reprise et interfaces définis.
- [x] Architecture et Design System respectés, aucun accès ACTIVE ajouté.
- [x] Relecture indépendante PASS du delta P1/P2 ; D1/D2 clos, aucun Critical/Major ouvert.

Verdict : **PASS** documentaire, révision3. Aucune preuve runtime acquise.


### Compensation et fencing des effets de provisioning

Après toute erreur de préparation (publication de secret, rôles, base, migration,
assertion ou ACL), si la base appartient au tenant attesté, le rôle owner `agm`
rétablit depuis la connexion centrale le membership SET temporaire exact vers
`agm`, applique sous `SET ROLE agm` les révocations `PUBLIC`/runtime/TEMP et
`ALLOW_CONNECTIONS false`, puis révoque à nouveau le SET. Le provisioner relit
`datallowconn=false`, zéro session et l’absence du SET résiduel. Il ne
termine aucune session étrangère : si une session subsiste, le fencing est incertain
et la barrière centrale reste BLOCKED. Chaque résultat de GRANT/SET/ALTER ambigu suit quand même RESET, REVOKE et
readback. Les erreurs initiales et de cleanup sont conservées ensemble. Si le
fencing ou sa preuve échoue, même état incertain ; aucun retry ni IDLE n’est autorisé. Les credentials et ressources sont
conservés. Le changement d’ALLOW_CONNECTIONS s’effectue depuis la base centrale, jamais
depuis la base agence elle-même. Les seuls accès temporaires sont ceux du rôle migration. Le replay
restaure l’adhésion SET temporaire requise avant de rouvrir une base fermée, puis
la révoque à nouveau avant migration. Test requis : erreur après ouverture,
fermeture vérifiée, replay d’effet partiel, et session survivante entraînant un
fencing non vérifié. Un simple timeout ou signal ne constitue pas une preuve d’arrêt.

### Amendement additif 0005 — finalisation du réveil durable

La migration0004 a déjà été appliquée et son checksum est conservé. La fonction
`reserve_t06_wakeup` prévue en section9 manquait à cette première application.
Elle est livrée dans `0005_s01_provisioning_wakeup.sql`, sans réécrire0001–0004,
avec transition fingerprint/checksum attestée depuis0004, même protocole hors
ligne et aucune suppression de données. La sémantique demeure celle de section9.
Revue indépendante de l'amendement requise avant application de0005.

### Qualification runtime du budget Inngest — 2026-10-16

Le serveur figé1.46.0 impose `minWorkersFree=5` avant tout scan de queue
([constante](https://github.com/inngest/inngest/blob/v1.46.0/pkg/execution/queue/consts.go#L140-L142),
[scan](https://github.com/inngest/inngest/blob/v1.46.0/pkg/execution/queue/scan.go#L44-L52)).
Le réglage préparatoire queue-workers1 laisse les runs FunctionScheduled sans
scanner. Correction de configuration : queue-workers5, minimum compatible.
La concurrence de fonction reste1 ; le verrou global SQL reste l'autorité. Ces
workers sont goroutines de queue Redis/HTTP, pas cinq connexions PG additionnelles.
Le pool serveur PG reste max-open4/max-idle2 et l'enveloppe57<=80 est conservée.
Aucun pin, moteur ni fournisseur changé. Revue ciblée requise avant redémarrage.

### Amendement de reprise CREATE sans réponse — revue ciblée PASS

Le cut entre `CREATE DATABASE ... ALLOW_CONNECTIONS false` et `COMMENT` ne
peut pas être assimilé à un replay après checkpoint. Le sous-effet rôles est
exécuté sous une barrière d'autorité puis terminé sans confirmer DATABASE_CREATED.
Une transaction centrale distincte, sur la session détentrice et sous scope/J1/gate,
persiste dans l'intention DATABASE_CREATED une `creationPrecondition` immuable :
agence, opération, version cible1, absence de DB observée et OID des deux rôles
créés/tagués. Ce commit précède strictement CREATE. Aucun COMMIT intermédiaire
n'est injecté dans `attempt.run`.

Une DB sans commentaire n'est adoptable que fermée, avec propriétaire/OID exact,
les deux rôles tagués et leurs OID inchangés, et cette preuve antérieure durable.
La reprise contrôle ces éléments sous la même barrière puis pose le commentaire,
ferme PUBLIC/TEMP et le rôle runtime avant toute ouverture pour migration.
Un homonyme sans cette preuve, ouvert, commenté autrement ou appartenant à un
autre rôle est refusé sans mutation. La preuve reste dans les readbacks confirmés.
Revue indépendante ciblée PASS, Critical0/Major0, avant exécution des nouveaux
cuts. Les14 scénarios processus correspondants ont ensuite PASS. Chaque statement
privilégié vérifie encore la session centrale ; aucune nouvelle
requête n'est émise après perte connue de cette capacité.

La réconciliation hôte peut qualifier une DB encore fermée comme
CLOSED_DATABASE_UNMIGRATED uniquement avec cette preuve, zéro connexion et aucun
backend migration enregistré dans toute l'histoire de l'opération. Elle ne
l'ouvre pas. Après arrêt/fencing prouvé et autorité courante, une nouvelle exécution
peut reprendre la fermeture ACL puis migration. Si une migration a pu être émise,
la DB fermée reste BLOCKED tant qu'elle ne peut pas être inspectée avec certitude.
