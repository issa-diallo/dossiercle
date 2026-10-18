# Research — #76 / S01–T07 Confirmation d’activation, état et reprise

## Statut

`RESEARCH: PASS` — 2026-10-18, entrée PRODUCT, mode LARGE (authentification,
octroi de droits, données sensibles et isolation multi-agence). Préparation seule.
Le [plan S01](../S01/plan.md#t07--confirmation-dactivation-état-et-reprise) et son
Design font autorité ; aucun nouveau choix de stack ni gate produit inventé.
Revue indépendante PASS après correction documentaire R-M1 : [rapport](research-review.md).

Ticket : [#76](https://github.com/issa-diallo/dossiercle/issues/76).
Base locale et du worktree : `135f0eab07f017e9b8a35c704dd1342f53cc2b51`.
Branche dédiée `feat/76-s01-t07`, worktree `worktrees/76-s01-t07`.
L’isolation Git anticipée protège les autres worktrees ; elle ne vaut pas PASS
Worktree Setup runtime, qui suit Plan. Un seul écrivain : orchestrateur `/root` ;
reviewer indépendant en lecture seule. Au gate Research, aucun code applicatif ou outil modifié ; le delta outillage
ultérieur est limité à Setup0a et tracé séparément.

## Dépendances vérifiées maintenant

[Capture minimisée des dépendances](dependency-evidence.json).
Consultation GitHub directe le 2026-10-18, `gh pr view 75`, API pulls/75 et
API actions/runs filtrée par SHA. Les fichiers committés T06 ne sont pas une
attestation de leur propre commit.

| Gate requis | Preuve actuelle | Verdict et limites |
|---|---|---|
| Livraison T06 | [PR75](https://github.com/issa-diallo/dossiercle/pull/75) MERGED le 2026-10-17T03:59:02Z par `issa-diallo` ; issue74 CLOSED ; head `f42d836541f46002d9d595e5014767601fb1dada`, base `b18cd38b2c93234211c3c66bba654d63f297149c`, merge `135f0eab07f017e9b8a35c704dd1342f53cc2b51` | PASS dépendance technique livrée ; ni S01 DONE ni qualification commerciale |
| Execute / Verify / Review / Goal T06 | [Verify](../74-s01-t06/verify.md), [Review](../74-s01-t06/review.md), [Goal](../74-s01-t06/goal-implementation.md), confrontés au body PR finale et à sa CI | PASS / PASS / PASS_WITH_MINOR sans Critical/Major / SATISFIED technique |
| Lead Tech final | Description actuelle PR75 : attestation finale indépendante `/root/t06_lead_tech_final`, 2026-10-16T20:48Z, base et head ci-dessus, PASS_WITH_MINOR, aucun Critical/Major ; rapports historiques référencés par Ship | Attestation finale référencée publiquement ; session source non accessible ici, pas de review GitHub ni commentaire. Ne pas présenter la description comme une nouvelle review réalisée dans cette mission |
| CI tête finale | [Documentation38962176551](https://github.com/issa-diallo/dossiercle/actions/runs/38962176551), [T0438962176380](https://github.com/issa-diallo/dossiercle/actions/runs/38962176380), [T0538962176235](https://github.com/issa-diallo/dossiercle/actions/runs/38962176235), [T0638962176496](https://github.com/issa-diallo/dossiercle/actions/runs/38962176496), quatre SUCCESS, SHA `f42d836…` | PASS, métadonnées GitHub relues ; pas une CI de T07 |
| V3 authentification native | Log consulté du run38962176380, étape `Verify native browser authentication and failures`, commande `pnpm test:auth` → `bash scripts/s01-auth-test.sh`, treize parcours réels, `13 passed (9.2m)` à20:40:10Z le16/10 ; TOTP/secours, onboarding/platform, refresh/logout/backchannel/native-change/native-password/throttle/faults et attaques ingress | PASS pour le socle livré, à rejouer après modification T07 ; aucune suite exécutée dans cette mission |
| Identité de la base livrée | `git diff 135f0ea f42d836 --stat` vide ; main local `135f0ea`, arbre identique à la tête finale de75 | Le squash n’introduit aucun delta de contenu non vérifié |

Les formulations « PR ouverte » / « CI et attestation finales attendues » de
`74-s01-t06/{handoff,verify,ship,lead-tech-review}.md` sont historiques, notamment
sur10941bb. Elles ne sont ni un nouveau blocker ni un PASS de la tête finale.
Le cleanup T06 n’est pas attesté : ressources conservées, aucune action requise
pour consommer le code fusionné. Ne pas déclarer T06 DONE selon la DoD complète.
LT-M2 (sérialisation pg8) reste Minor suivi mainteneur/Lead Tech avant montée
majeure pg ; T07 ne change aucune version fournisseur.

Dépendances : T04/V3 → T05 → T06 → T07 → T08 UI → T09/T10 preuves globales.
T06 et V3 PASS sont requis dès Research ; ils sont satisfaits. Les preuves N2
propres à T07 sont futures. N3 (IAM cloud, ObjectLock/HA, PRA, contrats/licences,
capacité commerciale) reste avant réel/vente, sans bloquer la préparation locale.
B05/B06 ne bloquent pas l’espace vide ; chaque intégration reste désactivée
jusqu’à ses propres qualifications. Aucun fournisseur IA/mail contacté.

## Sources normatives et périmètre

Lectures : README puis index/SCALING/METHOD/WORKFLOW/SAFETY/MODELS/CONTEXT,
rôles orchestrateur/reviewer, templates Research/Design/Plan/Goal/environnement,
PULL_REQUESTS ; S01 plan §T07 et table V, Design §acteurs/données/saga/idempotence/
HTTP/J1/audit ; STORIES S01 AC1–4 ; ARCHITECTURE auth/autorisation/isolation/
observabilité/environnements ; registre D57/D73–D82, ADR002/004/006/012/024/025/
029/030. Les supersessions en tête des ADR et D81 priment leurs snapshots anciens.
Skill feature-design-assistant utilisé pour structurer la préparation ; les
questions/options déjà décidées sont résolues par le mandat et le produit.
Pas de nouvelle validation humaine de l’architecture demandée.

T07 : confirmation explicite, vue backend d’activation et retry borné du provisioning.
T08 garde les écrans React et E2E complets ; pas d’UI construite ici. Pas de
suspension/résiliation/réactivation, inscription libre, fournisseur IA, mail,
module, nouvelle architecture ou nouveau service de jobs.

## Socle réellement inspecté

| Fichiers existants | Observation et intégration à prévoir |
|---|---|
| `apps/api/src/agencies/agencies.service.ts`, `agencies.controller.ts` | Création T05 et GET activation onboarding propre seulement ; `canActivate=false`, `canRetry=false`. Pas de POST activation ni retry. Le service actuel refuse un principal devenu `agency` : compléter sans ouvrir création/claim aux autres scopes |
| `apps/api/src/auth/{auth.service,t05-locks}.ts`, `platform/t05-context.ts` | Session opaque, autorité/J1 et natif, CSRF/Origin, refresh uniquement mutation humaine ; résolution scope via `control.lock_session_scope`. Plan T05 mode owner/onboarding et préverrous limités à ce périmètre ; étendre explicitement pour ADMIN propre et ordre compatible, pas drapeau client |
| `packages/domain/src/agency-lifecycle.ts` | Création/idempotence/invitation existantes ; décision d’activation et retry à ajouter sans effets réseau dans domaine |
| `packages/contracts/src/agency.contracts.ts` | ActivationView/EmptyBody/IfMatch/erreurs/états déjà prévus ; If-Match ETag fort, version chaîne ; pas de DSN/identité client |
| `packages/adapters/migrations/control/0001…0005`, `agency/0001_s01.sql` | Tables centrales agency/membership/audit/outbox/idempotence et contraintes READY/ACTIVE/date ; audit local event_id PK ; provisioning_execution/effect/gate durables. Schéma T02 suffisant à conserver ; pas de réécriture de SQL/checksum historique |
| `packages/adapters/src/postgres/{t05.repository,provisioning.repository,agency.repository}.ts` | Idem et audit central ; six confirmations T06 et READY/SUCCEEDED ; `projectAudit` insert dédoublonné puis relecture type/version/corrélation. Préparation activation et projection de confirmation à relier |
| `packages/adapters/src/postgres/{tenant-router,tenant-router-factory,provisioning-attempt}.ts` | Capacité humaine seulement ACTIVE, revalidation autorité/locator et post-connect ; contexte de vérification T06 seulement PROVISIONING. Aucune réutilisation permissive d’un contexte humain avant ACTIVE |
| `packages/adapters/src/postgres/{migrate,t05-capabilities,t06-capabilities}.ts`, `scripts/s01-control-migrate.mjs` | Profils SQL explicites, séparation coordinator/API/provisioner. Examiner/étendre seulement capacités nécessaires sous mandat Execute, sans DDL API ni droits migration humains |
| `packages/adapters/src/audit/audit-writer.ts`, `src/outbox/*`, `src/journal/authority-journal.ts` | Audit central + outbox même transaction ; J1 indépendant ; dispatcher et réveils T06 typés, pas de projection activated déjà câblée présumée |
| `scripts/{worktree-setup.sh,s01-worktree-identity-check.py}`, `.github/workflows/s01-t06.yml` | Allowlist identités Git seulement T04/T05/T06, donc nouveau runtime T07 refusé avant secrets/Docker. Adaptation bornée future, aucun contournement par emprunt d’identité |

Tests existants : domain lifecycle/authority/provisioning ; contrats agence et
events ; PG audit/outbox/J1/schema ; API T05 ; tests T06 admission, primitives,
saga, wakeup, isolation, fencing et moteur ; `tests/auth/s01-auth.spec.ts` natif.
Tests T07 activation/isolation à créer selon plan S01. Les noms complémentaires
et les frontières exactes sont fixés en Design/Plan après revue Research.

## Flux observé et cible imposée

Actuel : invitation/claim → PROVISIONING + ADMIN PENDING → saga six preuves →
READY/SUCCEEDED, `activated_at=NULL`, GET sûr sans octroi.
Cible imposée : commande humaine autorisée → preuves courantes + prepared local
unique relu → transaction centrale atomique → ACTIVE et ADMIN ACTIVE → projection
locale activated depuis outbox. Prepared n’est jamais une publication ACTIVE.

## Sécurité, risques et questions

- Auth forte native et session courantes avant chaque lecture/mutation/rejeu ;
  expiration/révocation/changement compte doivent encore bloquer avant commit
  après tout I/O local. Pas de nouvelle connexion ni re-MFA dédiée exigée.
- Onboarding lié ou ADMIN de l’agence propre ; owner/support/service ne sont pas
  ADMIN implicites ; standard/habilité403, étranger404 sans données, anonyme401.
- Invitation/racine → autorité identité → agence → membership, ordre cohérent
  avec coordinator/T05/T06 ; authority conservée jusqu’au commit et J1 courant.
  Les préverrous existants incluent sessions/memberships puis agence SHARE :
  Design doit traiter les conversions de locks, pas inventer un ordre contradictoire.
- Audit local sous rôle distinct ; runtime humain n’a pas INSERT audit. Ne pas
  ouvrir métier READY, ni donner credentials migration à l’API. Chemin technique
  privé borné à l’audit/validation nécessaire, relit locator et versions serveur.
- Perte réponse/commit local : relire par identifiant stable ; aucune activation
  tant que prepared incertain. Perte réponse centrale : état puis replay autorisé.
- Idempotence durable, résultat courant après autorisation, avant If-Match sur
  replay ; pas réponse historique avec droits périmés ni clé qui cible autre agence.
- Observabilité : event_id/corrélation/versions et erreurs stables ; pas cookies,
  jetons, secret_ref, DSN, noms SQL ou données inter-agences dans réponses/logs.
- Rollback : fermer octrois/émetteurs et évaluer compatibilité, conserver DB,
  J1/audits/outbox/keys/versions ; jamais down/DROP/reset ni retour artificiel
  ACTIVE→READY ou restauration d’anciens droits.

Aucune dépendance T06/V3 bloquante observée. La mise à disposition du runtime
nouveau est un travail de Worktree Setup à évaluer après Plan, pas un PASS acquis.
Pas de fait nouveau invalidant un choix d’architecture ; aucune ADR rouverte.

## Research Gate

- [x] Socle/code/contrats inspectés, dépendances actuelles vérifiées dans la PR/CI.
- [x] Fichiers et risques identifiés, frontières sécurité et données explicites.
- [x] Aucune question produit requise non résolue ; preuves T07 planifiées ultérieurement.
- [x] Revue indépendante PASS, correction R-M1 relue et verdict consignés.

Verdict : PASS ; passage à Design permis, aucun mandat Execute.
Logs CI lus seulement en local temporaire ; aucune copie brute dans le dépôt.
Coût/tokens/quota et modèle interne non observables ; aucun chiffre inventé.
