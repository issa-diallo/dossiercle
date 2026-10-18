# Handoff — #76 / S01–T07 Confirmation d’activation, état et reprise

> Addendum Ship : PR77 publiée, cinq CI SUCCESS et Lead Tech PASS_WITH_MINOR
> sur a43124fd. Dernière tête documentaire et ultime attestation hors diff encore requises.
> Commit, PR et CI autorisés ; fusion/déploiement/cleanup exclus. État courant dans
> [Ship](ship.md) et [Goal Ship](goal-ship.md). Le corps ci-dessous conserve le
> handoff technique pré-Ship ; il n’est pas une interdiction du nouveau mandat.

**Qualification technique locale terminée : Execute PASS, Verify PASS, Review indépendante PASS, Goal technique SATISFIED. Aucun Critical/Major ouvert. Ship hors mandat ; story non DONE.**

## Identité et portée

Worktree `/home/issa/Workspace/perso/dossiercle/worktrees/76-s01-t07`, branche
`feat/76-s01-t07`, HEAD/base inchangé
`135f0eab07f017e9b8a35c704dd1342f53cc2b51`. Préparation T06 : tête
`f42d836541f46002d9d595e5014767601fb1dada` ; ses CI historiques ne sont pas des CI
pour ce candidat T07. Modifications préexistantes README/identité et artefacts
non suivis conservés. Aucun commit, push, PR, fusion, déploiement ni cleanup.
Aucune nouvelle migration ni réécriture de checksum historique.

## Gates

| Gate | État et portée |
|---|---|
| Research / Design / Plan | PASS, revues indépendantes ; compléments de récupération revus avant usage |
| Setup | PASS du socle seulement ; capacités/certificats/handlers T07 qualifiés par Verify |
| Execute | PASS — implémentation et corrections présentes |
| Verify | PASS — A1–A9 et non-régressions réellement exécutés |
| Review | PASS — `/root/t07_final_review`, lecture seule, manifeste/proofs vérifiés ; 0 Critical/Major ouvert |
| Goal de préparation | SATISFIED, portée de préparation inchangée |
| Goal d’implémentation | SATISFIED — qualification technique locale, distincte de Ship |
| CI T07 / Ship / DoD story | Non exécutés, hors mandat ; aucune clôture DONE |

## Fichiers et comportement livrés

Le [manifeste](implementation-manifest.json) donne les **53 fichiers source**
suivis et non suivis, SHA-256
`bf532684652073f2cdafe086b95d10c660b3ba1f6b92aef467821d29454e13c9`.
Les principaux chemins sont :

- `apps/api/src/agencies/` : activation/retry/GET minimisé, autorisation courante,
  revalidation session/native/J1, idempotence, CSRF/Origin et admission100 partagée T06.
- `packages/adapters/src/postgres/activation.repository.ts`, `t07-capabilities.ts`
  et `agency.repository.ts` : réservation durable, finalisation atomique, droits SQL
  bornés et ACL effectives ; aucune migration de table.
- `apps/api/src/provisioning/activation-audit.service.ts`, `activation.function.ts`
  et `orchestrator.main.ts` : prepared unique réconciliable, propriétaire/tag/ACL
  courants, source schema1 et projection privée idempotente depuis outbox/Inngest.
- `packages/contracts/`, contrats agence et OpenAPI : payload strict, état calculé
  serveur, READY/prepared jamais ACTIVE, aucune fuite de locator/secret.
- `scripts/s01-t06-reconcile.mjs`, `s01-t06-inspect.mjs` : fencing exact T06/T07,
  preuve stop durable, inspection host-only d’une base migrée fermée et refermeture
  garantie avant réconciliation IDLE ; aucun élargissement de l’API.
- `apps/api/test/agency-activation*.integration.spec.ts`, `private-t07-*`, tests
  capacités/mTLS et `scripts/s01-t07-test.sh` : fautes, processus, concurrence,
  autorité courante, saturation et runner complet T06 → V3 → V2 → scan.
- `README.md` et ce dossier : état réel, Execute/Verify/Review/Goal, récupération,
  résultats minimisés et empreintes des preuves. IA, mail et modules restent false.

## Résultats réellement exécutés

`pnpm test:activation` final **exit0** : unités114, contrats25, capacités/mTLS6,
socle T06 complet (PG35, unités22, contrats2, canaris12/12), **V3 13/13**, puis
**V2 13+123/123** dont **T07 12/12**, et scan sans match. Ces nombres se recoupent.
`pnpm build` complet API/web/typecheck/lint PASS ; setup RO, certificat T07,
**25 cas Git**, contrôles documentaires et whitespace PASS.

A1–A9 couvrent PG réel, HTTP, SIGKILL avant/après commit, six écritures atomiques,
CAS nuls/MVCC, trois POST concurrents, prepared/ack central perdus, expiration et
révocation pendant I/O, J1 DENIED malgré SQL ancien, contrôles natifs,
inter-agences/rôles/scopes, ACL/tag/propriété, retry/scanner avec mêmes secrets,
panne/restart et projection Inngest/mTLS idempotente. [Verify](verify.md) détaille
les assertions et les diagnostics conservés, y compris les échecs corrigés.

Mesure nominale HTTP/mTLS/PG : GET **44,22–79,43 ms**, activation **249,10 ms**,
maximum PG **observé20**, projection1. Session native de fixture, protocole réel
qualifié séparément par V3 ; aucun benchmark de charge ni plafond garanti.

## Reprises et preuves privées

Le gate initial BLOCKED a été réconcilié par fencing réel, backends absents,
readback fermé complet et refermeture, puis FENCED/IDLE. L’ancienne agence reste
FAILED, opération FAILED/step READY/attempt2/retryable=false après quarantaine
hôte auditée, sans rembobinage ni suppression de données.

- Fencing/readbacks : SHA `a04632c3f94d00c2d7e5b38abd31afd83cf90161fc67f8729b3746f3a5d53293`.
- Quarantaine : SHA `8e7f19667a6c542e93721fa1ee59e6b6d8c374b9f0a92c8c5d37b54b74895826`.
- Anciennes projections : quatre événements DELIVERED réparés **par opérateur**
  via handler/client mTLS existants, snapshots centraux identiques ; inventaire
  indépendant final **21 ACTIVE / 21 tuples locaux exacts, 0 absent/divergent**.
  Preuve SHA `c0144b150355268d9f4703d6a1fd61d90ad7bec542acb2201c6637ffeefed4fa`.
  Ce rattrapage n’atteste pas un succès Inngest des quatre anciennes exécutions.

[Recovery](recovery.md) et [résultats minimisés](evidence-private/results.json)
lient les preuves. Journaux bruts privés0600 dans `.local/`, notamment
`t07-final-qualification.log`, `t07-final-build.log`, mesures/inventaires et
`t07-recovery/`. Les captures PostScript accidentelles restent privées avec
empreintes ; commande d’origine non établie, aucun rendu/publication.

## État laissé et risques non bloquants

**10 services conservés actifs** : sept services de base, identity-coordinator,
orchestrator et provisioner T06. Gate **IDLE**, **0 exécution RUNNING/BLOCKED**,
ancienne exécution FENCED. Partition **T05=16 / T06=668 / T07=93**, exhaustive et
disjointe. Bases, volumes, J1, clés, versions, fixtures et preuves conservés.
Checksum central inchangé `e5d7928caaa1b6f9d145c1102f5119321defcc1cf385fe8356272c9dc7b4632a`.

LT-M2 pg8 reste suivi mainteneur/Lead Tech avant montée majeure. Traçabilité des
captures à transmettre au prochain handoff, contenu conservé privé. Qualification
charge/capacité réelle et N3 restent futures. **Aucun blocker technique local.**

## Avant Ship

Un mandat séparé est nécessaire pour commits/PR, CI T07, revue Lead Tech de la PR
et validation humaine selon [D57](../../../product/ARCHITECTURE_DECISIONS.md#d57).
Aucune fusion, mise en service ou suppression de ressources ne découle de ce PASS.
