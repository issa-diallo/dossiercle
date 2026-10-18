# Execute — #76 / S01–T07

**EXECUTE: PASS — implémentation et corrections présentes ; qualification finale dans Verify.**

Mandat LARGE dans le worktree dédié, root seul écrivain du code. Aucun commit,
push, PR, fusion, déploiement ou cleanup. Les modifications préexistantes et tous
les artefacts ont été conservés. Aucune migration ni checksum historique modifié.

## Implémentation

- Autorisation serveur onboarding lié ou ADMIN propre, session forte courante,
  CSRF/Origin, J1 et revalidation native/session/révocation jusqu’au commit.
- Verrouillage T05/T06, réservation durable et prepared local unique avec bindings
  agence/opération/locator/secrets/proofs ; après I/O, seconde transaction sans
  nouvel append J1 non réversible et revalidation immédiatement avant octroi.
- Publication centrale atomique membership, agency, opération, audit, outbox et
  idempotence. READY/prepared ne donnent aucun droit ACTIVE.
- GET minimisé/no-store sans refresh ni extension d’inactivité ; replay sous
  autorisation courante, sans double octroi ni audit dupliqué.
- Retry humain audit dispatch:false, verrou admission100 partagé avec T06,
  refus avant refresh à saturation et réservation wakeup par scanner après commit.
- Projection locale activated idempotente depuis outbox, Inngest privé et mTLS.
  Propriétaire/tag de base, schéma/checksum/flags et ACL effectives revalidés par
  le provisioner privé ; aucun credential migration dans l’API.
- Capacités SQL/certificat/handlers/contrats/fixtures/runner T07, manifeste
  exhaustif/disjoint avec T05/T06. IA, mail et modules restent false.

## Reprise et corrections examinées

Le gate T06 initialement BLOCKED a été réconcilié par fencing réel, readbacks
exhaustifs et preuve durable avant IDLE ; ancienne fixture artificielle mise en
quarantaine auditée sans suppression ni rembobinage. Voir [Recovery](recovery.md).
Le retry renforcé corrigé part d’une agence réellement provisionnée puis d’un
échec contrôlé SECRETS_REFERENCED ; sa reprise conserve base et références des
secrets runtime/migration. Le scénario ciblé a passé.

La première revue avait révélé un append J1 irréversible dans une transaction
ensuite annulée. La revalidation post-I/O utilise maintenant mutation=null.
La revue de reprise a ensuite relevé deux Major : ACL locales courantes non
relues et admission100 absente du retry. Les deux corrections ont été relues
indépendamment et les Major clos sur le code ; leurs tests réels rejoignent la
qualification finale. Aucun octroi synthétique supplémentaire ne justifie un Ship.

## Couverture complémentaire implémentée

Fautes avant/après six écritures et CAS nuls avec observateur MVCC ; SIGKILL
avant/après commit ; concurrence trois POST ; substitutions inter-agences ;
révocation/expiration/native/J1 pendant I/O ; panne DB locale après commit,
redémarrage et rattrapage Inngest ; dérives réelles ACL/tag/propriété ; admission
100, deux retries concurrents, absence de refresh/J1 sur refus et replay saturé.
Résultats réellement terminés dans [Verify](verify.md).

Le [Goal de préparation](goal.md) reste distinct du
[Goal technique](goal-implementation.md).
