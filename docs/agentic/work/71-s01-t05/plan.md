# Plan — #71 / S01 T05 Invitations propriétaire et création durable

## Statut et résultat attendu

`PLAN: PASS` — 2026-10-14, EXISTING/LARGE, après
[revue finale indépendante](plan-review.md).
[Research PASS](research.md), [Design PASS](design.md),
[ADR030](../../../adr/030-t05-invitation-preuve-transaction.md),
[ticket #71](https://github.com/issa-diallo/dossiercle/issues/71).
Mandat courant : préparation seulement, Plan revu puis prompt et arrêt.
Les étapes suivantes sont le contrat du **futur** implementer, pas du code produit.

Résultat T05 : owner fort et confirmation privée → invitation native réconciliable
→ issue/claim propre → unique agence PROVISIONING, ADMIN PENDING et opération
ACCEPTED/PENDING durable. Aucun ACTIVE/provisioner/IA/mail ni fonctions T06–T10.
Les huit AC du ticket sont repris dans la matrice de tests ci-dessous.

## Révision, dépendances et exécution

Base fusionnée `71c4536981aa61656b3b7ad0df42ed9c14facd00`, avec #67/#68 livré.
Branche `feat/71-s01-t05`, worktree `worktrees/71-s01-t05`, artefacts ici.
Un implementer écrivain ; reviewer indépendant, Lead Tech distinct au futur Ship.
Pas de parallélisme d’écriture : setup/ACL/locks/receipt sont structurants.
L’orchestrateur délègue l’exécution non triviale après le DoR ; reviewers lecture seule.
Niveau recommandé High pour exécution ; Extra High pour arbitrage sécurité non
résolu avec critère d’arrêt concret. Modèle le moins coûteux capable disponible ;
configuration de cette préparation héritée, coût/quota non observables.
Escalade sur fait bloquant ou deux corrections sans convergence, jamais gate abaissé.

## 0. Worktree Setup — bootstrap complet avant premier environnement

Fichiers : modifier `scripts/worktree-setup.sh`, créer
`scripts/s01-worktree-identity-check.py` et `scripts/s01-worktree-identity-test.py`.
Couples permis exactement : legacy feat/s01-espace-isole + s01-espace-isole,
et feat/71-s01-t05 +71-s01-t05. Vérifier vrai worktree Git lié, branche actuelle,
racine résolue, UID nonroot, namespace/marker cohérents ; refuser main/detached,
couple incohérent, symlink/racine étrangère avant acquisition/secrets/Docker.
Conserver --check et tous contrôles secrets/ports/CA/volumes existants.

**Ordre justifié :** le Setup existant refuse le nouveau nom, donc seule la
correction du bootstrap/son test déterministe appartient d’abord à Worktree Setup,
après ces trois gates de préparation. Ce n’est pas Execute métier anticipé.
Revue indépendante du delta bootstrap avant `--synthetic`. Le test doit créer de
vrais worktrees temporaires via Git et vérifier refus sans effet, pas seulement
simuler les regex. Aucune suppression des anciens worktrees/environnements.

**0a, avant tout premier `--synthetic` :** en plus de la portabilité, préparer
les modifications structurelles de `worktree-setup.sh`, `s01-coordinator-setup.py`
et `infra/local/compose.yaml`, ainsi que `scripts/s01-t05-capabilities.mjs` :
initialisation keypair owner/fingerprint/marker exclusivement sur environnement
frais ; signer key400 tmpfs non montée, clé publique seule RO coordinator ;
NOLOGIN control_t05/membership et contrôles d’identité/ACL du bootstrap.
Employer OpenSSL déjà requis par le setup pour générer le keypair Ed25519 avant
installation Node ; la CLI Node24 vérifiera ensuite l’interopérabilité signature.
Préparer aussi la routine de grants objets T05 appelée après migrations de base.
Cette tranche concerne uniquement bootstrap/capabilities, pas domaine ou services
métier ; elle est entièrement revue avant le premier runtime. La création d’un
environnement puis ajout tardif d’une clé manquante est interdite.

**0b :** exécuter le setup synthétique froid complet dans le worktree71, --check,
outils figés/install frozen sans lifecycle, migrations/grants et configuration
native selon workflow existant. Vérifier déjà présence/empreinte/mount public seul
et profils SQL attendus. Documenter `environment.md` puis review Setup.
Ne copier aucun .local, credential, DB/J1 ni CA du worktree T04. Créer ports,
namespace Compose et ressources privées propres ; checksum/versions lus sans secret.
Si limite/capacité inconnue : mesurer et fermer, aucun budget/quota supposé.

## 1. Domaine, contrats et HTTP de T05

Créer `packages/domain/src/agency-lifecycle.ts` et son test : transitions invitation,
terminal REVOKED, name canonique/hash, idem/root replay, PROVISIONING/PENDING/ACCEPTED.
Modifier `packages/contracts/src/agency.contracts.ts`, tests et `openapi.yaml` :
ClaimInvitation union stricte EmptyBody/{token}, reçu obligatoire dans les deux
branches ; définir DTO contexte claim/onboarding sans données sensibles.
Conserver compatibilité legacy token et tous DTO/erreurs/routes v1 existants.
Mettre à jour l’assertion OpenAPI `apps/api/test/agency.contract.spec.ts`.

Créer `apps/api/src/http/t05-request.ts` et test `.unit.spec.ts` : lecture stream
JSON strict32Kio (proxies/bodyParser natifs inchangés), champs inconnus/duplicats,
content-type, UUID/header Origin/CSRF, clés idem et If-Match fort. Définir limites
et codes400/404/409/429/503 sans corps natif/SQL. Bucket borné Design10/min par
session,60/min par IP,100 buckets actifs max, TTL60s ; saturation ferme.

## 2. Preuve owner privée signée

Créer `packages/adapters/src/identity/owner-confirmation.ts` (vérification/store),
`scripts/s01-owner-confirmation.ts` (signature privée/CLI) et tests dédiés.
Procédure stdin privé, owner configuré, refs UUID appariées, subject=username,
root/id réservés ; attestation human explicite ou fixture synthétique marquée.
Payload strict/canonique déterministe, Ed25519 native, TTL24h et empreinte clé ;
records INSERT immuables dans idem existante, signature couvrant tous champs.
Retour uniquement deux références opaques ; aucune identité/contact/clé stdout.
Reconfirmation privée d’une invitation existante préserve subject/root/agency.

Réutiliser l’initialisation keypair/marqueur et mounts publics préparés en0a et
qualifiés en0b ; **ne pas générer de clé sur cet environnement désormais retenu**.
Marqueur connu, perte clé = refus ; pas regeneration/rotation silencieuse.
Ajouter scripts au typecheck (`tsconfig.tests.json` ou config dédiée) et commandes
exécutables Node24 après build packages ; aucune dépendance/pin nouvelle prévue.

## 3. Capacité SQL limitée et conservation du rôle

Réutiliser `packages/adapters/src/postgres/t05-capabilities.ts`,
`scripts/s01-t05-capabilities.mjs`, init `worktree-setup.sh` et grants de
`postgres/migrate.ts` préparés en0a/qualifiés en0b ; approfondir leurs tests.
NOLOGIN control_t05 non-owner sans pouvoirs admin, SET TRUE/INHERIT FALSE/sans
ADMIN depuis coordinator, aucune membership migrator ou modification control_api.
Permissions par colonnes exactement Design ; idem INSERT seulement ; agence/
membership/opération utilisent defaults SQL fermés, UPDATE invitation limité.
Idempotent, ACL exactes vérifiées sur frais et retenu ; pas patch de migrations0001–0003.

Modifier `audit/audit-writer.ts` : capture current_user, allowlist des profils,
switch audit, restauration explicite du rôle précédent. À l’échec rollback,
aucune poursuite sous coordinator après action commencée en t05.
Créer tests PG ACL négatives et restoration role/rollback audit.

## 4. Barrières transactionnelles multisujets

Modifier `apps/api/src/auth/auth.service.ts` et au besoin
`packages/adapters/src/postgres/control.repository.ts` pour wrapper T05 interne typé.
Préflight cookie/row candidat, validation role propre puis plan de locks serveur ;
advisory réservation root absente ; toutes invitations ordonnées (mutations FOR
UPDATE dès entrée), autorités ordonnées, sessions/projections, puis refresh/J1.
Les métadonnées cible viennent du proof/DB et sont revérifiées sous locks.
La transaction reste unique, deny natif sous verrou comme T04, work sous rôle t05.
Rien n’autorise seulement via AuthorityGuard/SessionView. Aucune seconde connexion
attendue depuis callback J1, aucune nouvelle racine/autorité après son append.
Conserver comportement auth T04, scopes owner/onboarding, CSRF, backchannel,
idle30/absolu15j et polling sans refresh. Revue du graphe locks avant API exposée.

## 5. Réservation et préparation native réconciliables

Créer modules/services platform, notamment `platform.module.ts`,
`invitations.service.ts`, `invitation-preparation.service.ts` et repository
`packages/adapters/src/postgres/t05.repository.ts`.
TXA avec owner courant + signature valide : reservation PENDING, audit/outbox/idem
commit ; reprendre mêmes UUID sur autre key même proof et vérifier conflit body.
TXB **après TXA hors callback** : revalider owner/proof, prélocks, autorité invitée
PENDING et commande stable, fsync avant IdP, `createUser` puis readback exact.
Timeout/409 : résultat incertain, prochain appel relit UUID avant nouvel import.
Conserver username==subject ; aucun password transmis ni TOTP calculé.
Rejeu/issue owner peut réconcilier TXB ; GET est sans effet. Test failure natif
avec COMMIT PENDING possible séparé du failure SQL/connection closed ; pas background
non durable ni faux succès de readiness/IDENTITY_CONFIRMED.

## 6. Issue, réémission et révocation fermées

Créer `platform/invitations.controller.ts`, wiring service/repository.
Issue après préparation/confirmation valide, token32bytes seulement RAM réponse,
hash/version/TTL10min/audit/idem commit puis lien une seule fois ; replay état seul.
Réémission ISSUED/EXPIRED/CLAIMED avant ACTIVE : commande stable réservée durablement,
epoch invité supérieur et J1 PENDING fsync, sessions révoquées, projections pending,
readback natif conforme puis nouveau token/version atomiques. Préserver création.
Replay après réponse perdue ne réincrémente ni epoch ni version. REVOKED terminal.
Revoke : J1 PENDING/deny avant mutation, epoch/sessions fermés, état/version/hash
convergés et audit/idem ;200 après commit complet,503 en résultat incertain.
Tester stale If-Match après replay reconnu, revoke/reissue concurrent à claim/T04.

## 7. Receipt callback, claim et création

Modifier `identity-coordinator.ts`, `enrollment-coordinator.ts`, `auth.service.ts` :
receipt serveur du grant vivant/admission durable, écrit avec BFF dans même commit.
UUID clé domain-separated dérivé cookieHash, mais comparaison de hash complet,
sujet/root/version/epoch/tokenHash ; pas de rawtoken persisté. Sessions anciennes
sans receipt ne claim pas, reprise par reissue explicite/MFA nouvelle.
Créer modules/controllers/services agences : `agencies.module.ts`,
`agencies.controller.ts`, `agencies.service.ts`. Claim{} et tokenlegacy avec receipt
obligatoire, FOR UPDATE initial, TTL au premier claim, audit unique/replay courant.

Création sous barrières mêmes : INSERT PROVISIONING/ADMIN PENDING/operation
ACCEPTED, audit/outbox/idem atomiques ;202 après commit seulement. Même root/name
retrouve ressource ; autres body/name409. GET onboarding204 ou AgencyAccepted
courant propre, no-store, jamais nouveau refresh. Aucun locator/DB/provisioner créé.

## 8. Câblage API réel et tests complets

Modifier `app.module.ts`, `identity/coordinator.server.ts`, configuration/setup
coordinateur : injection des services privés/capabilities/proof public key ;
middleware whitelist des méthodes/routes T05 vers Nest, parsing ciblé, filter sûr.
Préserver routes/proxies OIDC/enrollment/backchannel et origine TLS.
Une réponse403 via proxy natif à une route T05 n’est pas un test API concluant.

Créer `apps/api/test/agency-creation.integration.spec.ts`,
`apps/api/test/invitations.integration.spec.ts`,
`packages/adapters/test/t05-capabilities.integration.spec.ts`,
`packages/adapters/test/owner-confirmation.integration.spec.ts`,
`tests/auth/s01-t05.spec.ts` et helpers privés synthétiques ciblés.
Toutes fixtures gardent leurs marqueurs, aucun bypass production. `playwright.config.ts`
et `scripts/s01-auth-test.sh` doivent réellement sélectionner la suite ajoutée.
Configurer workflow `.github/workflows/s01-t05.yml` (ou étendre celui existant sans
retirer T04) avec ce worktree et la suite contracts + intégration + navigateur T05.

## Matrice AC et validations différées

| AC / risque | Vérification prévue | Responsable / échéance | Échec |
|---|---|---|---|
| AC1 autorisation/isolation | vrais endpoints anonymous, owner, invité, étranger, rôles forgés ; J1 actuel avant replay | implementer + reviewer / Verify T05 | aucune exposition |
| AC2 preuve/import | signature/clé/fausse paire/contact/owner/TTL, duplicate/timeout natif/readback et restart | QA / avant issue | PENDING et réconciliation fermée |
| AC3 grant/issue/revoke | lien une fois, GET/replay sans secret, TTL10min, versions/epochs, REVOKED terminal, crash fsync | sécurité / avant endpoint utilisable | aucun grant/session |
| AC4 claim | receipt/session atomicité, cookies/epochs/versions différents, {} et legacy, deux claims, claim vs revoke | QA / Verify | pas CLAIMED |
| AC5 commit durable | inspection PG et réponses202, rollback audit/outbox, defaults/ACL, aucune ACTIVE/locator | backend / Verify | pas succès partiel |
| AC6 idem/concurrence | deux connexions/sessions, mêmes/différentes keys/root/name, conflits409, replay courant avant If-Match | backend / Verify | aucune seconde création |
| AC7 reprise | crash/commit perdu/réponse perdue, GET et replay même agency/operation ; head divergent ferme | QA / Verify | reprise explicite, jamais restore droits |
| AC8 HTTP/secrets | headers/body32Kio/duplicats/rate-limit, Origin/CSRF/TLS, erreurs et scan secrets | sécurité / Verify | fermeture route concernée |
| Compatibilité T04 / D81 | suite native existante incluse, J1 pannes/logout/backchannel/MFA, concurrence locks T04/T05 | reviewer / Verify avant Ship | retour correction |
| Setup et ACL / D75 | worktrees Git réels, cold setup, --check, droits PG réels/rôle audit, keys absentes | implementer/reviewer / Setup puis Verify | Execute métier bloqué |
| N3 humain/clés/IAM/PRA/commercial | qualification avant données réelles/mise en service, responsable propriétaire | suivi ultérieur N2/N3 | aucun déploiement/commerce |

## Commandes et evidence attendues du futur agent

Précondition outils natifs/worktree contrôlés avant commandes d’environnement :
`python3 scripts/s01-worktree-identity-test.py`, `bash scripts/worktree-setup.sh --synthetic`,
`bash scripts/worktree-setup.sh --check`, export PATH local figé puis `pnpm build`,
`node scripts/s01-control-migrate.mjs` et bootstrap/capabilities T05 idempotent.
Configuration native : commandes existantes du workflow T04 avec setup T05 ajouté.
Tests : `pnpm test:unit`, `pnpm test:contracts`, `pnpm test:integration`,
`pnpm test:auth` **incluant T04 et T05**, transport/checks TLS et scan secrets connus.
Compléter scripts/wrapper si une commande nouvelle est requise et vérifier son
sélecteur ; ne pas prétendre ces commandes déjà disponibles/qualifiées T05.
Logs bruts privés .local ignorés ; preuves publiables = compteurs, codes sûrs,
versions/UUID publics et assertions minimisées. Pas de DOM/rawpayload/url/cookie.
Verify doit distinguer SQL réel/frontière simulée et natif réel, tests non exécutés,
échecs historiques et état de la tête finale. Une suite skipped ne devient pas PASS.

## Livrables, DoR, risques et livraison future

Livrables futurs : environment/review Setup, execute/handoff, verify, review et
goal d’implémentation dédiés ; tests sources et preuves. Pas de suppression prévue.
Risque principal = régression auth/locks ; review avant exposition, tests négatifs
et concurrence. Pas de lock global conservé entre deux connexions ; pas de nouveau
droit de confirmation pour control_api, signature privée absente du runtime.
Rollback : revert code humain ; conserver ressources/DB/records/J1/clés, deny/epochs
opposables ; pas restauration autorité CONFIRMED ni cleanup automatique.

DoR Execute métier : Research/Design/Plan PASS revus, ADR compatibles, scripts et
runtime Setup PASS avec review, contrats/sources identifiés, stratégie V1/V2/V3/V4
exécutable, aucun Critical/Major/blocker. Avant ce DoR, seule préparation Setup
décrite en étape0 ; pas de service métier construit sur environnement fictif.

PR future dédiée #71, objectif unique T05. Exception >3fichiers/100lignes nécessaire
pour auth/ACL/contrats/transaction/tests cohérents ; aucune feature T06 ajoutée.
Commits Gitmoji Unicode atomiques avec Fixes #71 ; squash logique unique à la fusion.
Verify puis reviewer indépendant, CI exacte et Lead Tech distinct sur SHA finaux.
Après commit du rapport, dernière attestation hors diff/CI de tête, sans nouveau
commit de revalidation. READY_FOR_HUMAN au futur Ship ; **merge demande une instruction
humaine T05 applicable**, autorisation T04 non héritée. Pas de déploiement/cleanup.

## Plan Gate

- [x] Étapes ordonnées, fichiers/tests/AC, dépendances et invariants définis.
- [x] Sécurité, validations différées, observabilité et rollback responsables.
- [x] Scope et arrêt après Plan préservés ; aucun code/runtime lancé.
- [x] Revue indépendante finale PASS ; contrôles documentaires dans le handoff.

Verdict : **PASS** documentaire. Arrêt après transmission du prompt implementer.


## Addendum Execute — gate correctif graphe (2026-10-15)

L’étape4 inclut la décision métier privée typée/immuable en lecture seule après
auth/CSRF/natif et avant refresh/J1, pour les services étapes5–7. Voir l’addendum
Design pour l’ordre exact. Gate indépendant à réouvrir avant tout wiring API.
Tests supplémentaires obligatoires :409 VERSION/IDEMPOTENCY/CREATION sans delta
J1/session (idle/tokens inclus), retry/replay via même session, décision gelée
transmise au callback, CSRF refusé avant hook, deny natif durable avant hook,
refresh échoué toujours fermé. Aucun test existant retiré ou réduit.
