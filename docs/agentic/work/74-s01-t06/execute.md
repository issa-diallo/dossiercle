# Execute — #74 / S01 T06

## État courant

**PASS local** — implémentation et Verify technique complets,35 tests PG/process/
moteur T06,124 historiques,105 unités,23 contrats et13 natifs PASS. [Review indépendante finale](review.md) PASS_WITH_MINOR,
Critical0/Major0 ; Goal technique SATISFIED.
Aucun gate CI/Lead Tech n'est déclaré acquis. Branche `feat/74-s01-t06`, base
`b18cd38b2c93234211c3c66bba654d63f297149c`, worktree dédié74 conservé.

Le [journal historique](execute-history.md) conserve les premiers incréments et
échecs. Ses mentions « pas de saga » ou « profil arrêté » décrivent leur date,
pas le candidat actuel. Les résultats courants sont dans [Verify](verify.md).

## Implémentation

| Étape du Plan | Résultat réalisé | État de validation |
|---|---|---|
| 0a/0b | Bootstrap revu, environnement synthétique isolé, secrets tmpfs/mounts bornés | Setup PASS |
| 1 | Migrations0004 puis corrective additive0005, schéma/garde, grants bornés, intentions/exécutions/gate | PG ciblé PASS ; ancien migrateur exact refusé |
| 2 | Coffres immuables, rôles/DB fermée, migrations/ACL/readbacks, précondition CREATE durable | PG5/5 et cuts CREATE PASS |
| 3 | Contextes opaques, capacité liée à génération/attempt, factory humain central/J1/session, post-connect DB/user/marker/ACL, pools | Isolation et plafond processus4 pools réels PASS |
| 4 | PREPARE atomique, session-lock global puis opération sur même client, inventaire backends, arrêt/fencing/reconcile avec preuve fsync | Process14/14 et audit2/2 ciblés PASS |
| 5 | SDK4.23.0/serveur1.46.0, signatures natives, mTLS privé, source ledger, outbox/wakeup/reprise hôte | Moteur3/3 PASS ; wakeup1/1 PASS au runner global |
| 6 | Backlog100 sous lock avant refresh/J1/roots, replay/conflict à saturation, état public borné | HTTP2/2 PASS |
| 7 | Inventaire central exhaustif, intentions privées précommit SQL/avant POST HTTP, partitions disjointes, scanner canaris, CI et commandes reproductibles | Runner global et contrôles finaux PASS |

## Points de sécurité et répétabilité

Les effets privilégiés sont précédés d'intentions committées. Chaque attempt
conserve la connexion centrale qui détient les deux advisory locks ; un `error`/
`end` invalide sa capacité sans reconnect du détenteur. Le gate durable ne dépend
pas de la seule présence de ces locks. Les connexions DDL/migration sont inscrites
avec PID/backend_start avant mutation et contrôlent la session avant statement.
Les barrières scope/autorité/J1 restent tenues pendant chaque effet et action tenant.

PREPARE réserve locator et six intentions dans une transaction unique. Le segment
rôles est suivi d'un commit central de précondition CREATE (absence observée et
OID exacts) avant le segment CREATE. Une DB fermée sans commentaire ne peut être
adoptée qu'avec cette preuve antérieure, même propriétaire/OID et mêmes rôles tagués.
PUBLIC/TEMP et runtime sont fermés avant ouverture migration. Les homonymes non
qualifiés sont intacts après refus. Aucune perte de coffre n'entraîne de rotation.

Le reconciler inspecte par défaut. La confirmation privée synthétique vérifie
l'instance Compose et l'absence du groupe réel après arrêt, relit l'inventaire
final des backends, termine les identités exactes puis relit ressources/intents/
J1/autorité. Preuves JSON+SHA liées par UUID, O_EXCL0400, fsync fichier+dossier et
readback précèdent FENCED/IDLE. Une DB fermée n'est qualifiable sans ouverture que
si son absence de migration est prouvée par l'inventaire historique ; sinon BLOCKED.
Aucun reset de gate, de compteur, de J1 ou de ressources ne contourne l'incertitude.

## Migration et incidents conservés

0004 appliquée initialement au checksum cumulatif
`5397766a1c5df8b52167e3c6a26cbc2940b134b41b0e40c289c37befefceffb4`.
Les sources0001–0004 ont toujours cette empreinte ;0001–0003 et agency0001 sont
inchangées par rapport à la base. 0005 a été revue avant application, ingress et
coordinateur arrêtés/drainés, absence d'anciens émetteurs constatée. Checksum courant
`e5d7928caaa1b6f9d145c1102f5119321defcc1cf385fe8356272c9dc7b4632a`.
L'ancien runtime n'avait pas de garde de checksum ; l'arrêt/drain est sa barrière.
Le nouveau garde est testé séparément, sans présenter une fonction comme un boot complet.

L'incident host B sans émission a été clôturé CLOSED/known-unissued, ref fencing
NULL, après revue indépendante et preuve privée0400 `0b3041d6…`. Aucun PID n'a été
inventé. Les premiers essais d'auto-SIGSTOP depuis PID1 ne prouvaient pas une pause ;
ils ne sont pas comptés comme preuves AC3. Les scénarios actuels vérifient le PID
hôte et l'état `/proc` T avant perte centrale, puis CONT et absence de nouvelle émission.

Le premier essai admission a créé un gagnant HTTP dont un spread ajoutait trois
champs au tuple strict. L'erreur de classification et le refus de terminalisation
sont conservés. Le tuple exact a été validé (provenance/J1/heure/aucun effet), promu
explicitement T06 puis terminalisé comme charge synthétique ; le T05 natif est intact.
Les intentions privées pré-requête empêchent désormais cette fenêtre de reclassification.

Le moteur pin1.46.0 ne scannait pas avec queue-workers1 : minWorkersFree=5 dans
les sources officielles du tag. Le delta revu utilise5 workers, pool PG4/idle2 et
concurrence fonction1 inchangés. Aucun changement de pin ni de stack.

## Rôles et suite

Pendant Execute, un seul écrivain : implementer délégué ; orchestrateur et reviewers
indépendants en lecture seule. Au handoff final, Ship passe à l’orchestrateur ; reviews ciblées0 Critical/Major sur bootstrap, migrations, locks,
secrets, reconcile, transport/signatures, worker5, binding routeur et provenance.
La Review globale finale est consignée séparément et PASS_WITH_MINOR. Le coût exact n'est pas observable.
La mission se poursuit jusqu'au handoff Review/Goal/Ship puis READY_FOR_HUMAN avec
PR, CI de tête et examen Lead Tech. Aucun merge, déploiement ni cleanup autorisé.

## Lisibilité et taille de livraison

Les41 nouveaux modules ont reçu un formatage mécanique, preuve AST identique dans
[evidence/format-ast.json](evidence/format-ast.json), puis build/unités/contrats PASS.
Aucune migration SQL ni source historique n'a été incluse dans ce formatage.
Le ticket dépasse les cibles indicatives de taille : protocole central, capacités
DDL/coffres, routeur, transport, bootstrap et preuves doivent rester une livraison
cohérente. Les séparer laisserait temporairement des barrières incomplètes entre
identité, effets privilégiés, routage et reprise. La PR porte une seule intention,
T06 complet ; aucun endpoint métier T07 ni activation n'y est ajouté.

Review a demandé une preuve détaillée accessible : les commandes historiques124 et
runner T06 complet ont été rejouées avec sorties intégrales privées0600, exitCode0
et receipts SHA-256 (Verify). Le Minor du test moteur a déplacé STOP/inspect/assert
sous try/finally avant ce rejeu, sans modification du runtime après formatage.
