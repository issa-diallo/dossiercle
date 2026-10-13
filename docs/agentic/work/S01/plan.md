# Plan — S01 Créer et activer un espace isolé

## Statut et résultat attendu

`PLAN: PASS` — 2026-10-11, PRODUCT/LARGE, après [revue indépendante 2](plan-review.md).
État story : PLANNED ; aucun Execute/Verify commencé.
[Research PASS](research.md), [Design PASS](design.md), revues
[Research](research-review.md)/[Design](design-review.md),
[Story S01](../../../product/STORIES.md) et Architecture D73–D82.

Livrable futur : propriétaire invite un sujet vérifié ; ce premier administrateur
crée, suit et confirme un espace PG distinct sans gestion serveur. Répétition,
panne et concurrence ne produisent pas de second espace ou d'octroi partiel.
Aucun IA/mail/module activé implicitement. Cette mission **n'implémente rien**.

## Inspection et provenance des chemins/commandes

Base `main@075602916355813cf4e8d3f952fadaec5e637398` ; voir Research.
`git ls-files apps packages infra scripts tests .github` constate seulement
`scripts/agentic-check.sh`, le test Python temporel et les workflows/templates
GitHub documentaires. Aucun package produit, lock, Compose ou script worktree.
Structure apps/packages : cible dans ARCHITECTURE « Repository structure ».
Noms exacts ci-dessous stabilisés par ce Plan : **tous à créer**, sauf les fichiers
explicitement nommés à modifier. Ce ne sont pas des composants existants supposés.

Commandes **existantes réellement vérifiables maintenant** :
`git diff --check`, `bash -n scripts/agentic-check.sh`, `bash scripts/agentic-check.sh`.
Node trouvé dans PATH : `/home/issa/.nvm/versions/node/v22.23.1/bin/node` ; ce n'est
pas Node24 retenu. pnpm/docker/python3/bash présents ; aucune version/image
produit qualifiée ni service supposé démarré. Ne pas utiliser Node22 par défaut.
Les commandes produit de la table V ci-dessous sont des contrats **futurs**, à
rendre disponibles en T00/T01 ; elles ne sont pas lancées dans cette préparation.

## Contrat d'exécution et ordre

Complexité technique Élevée, story métier M conservée : premier socle sans code,
identité et isolation critiques. Pas de découpage métier/ADR supplémentaire.
Séquence stricte : Worktree Setup T00 → Execute T01…T10 → Verify → Review → Goal
story → Ship seulement sur mandat approprié. Aucun travail parallèle d'écriture.
Auteur du Plan `/root` ; reviewer `/root/s01_reviewer` distinct, lecture seule.
Implémentation future : un implementer, reviewer indépendant, mêmes sources/AC.
Modèle disponible hérité ; High recommandé pour implémentation cadrée et revue,
Extra High seulement si contradiction de sécurité prouvée ; niveau effectif non
observable ici. Aucun changement de modèle ou quota annoncé.
Escalade après deux échecs techniques sans convergence ; contradiction D54/
isolation = arrêter l'activation, consigner fait et revoir ADR, jamais fallback.

**DoR documentaire** : Research/Design PASS, dépendances connues, fichiers et
contrats identifiés, tests/risques traités, aucune décision N1 ouverte. Plan PASS
complétera ce DoR. **Cela n'est pas un mandat Execute** : respecter la limite de
cette mission. Aucun Worktree Setup n'est effectué maintenant.

Un futur ticket de livraison S01 doit être identifié avant commit (numéro GitHub
non inventé). Branche `feat/<ticket>-s01-espace-isole`, worktree
`worktrees/<ticket>-s01-espace-isole`, un écrivain. PR dédiée S01 ; taille >3
fichiers justifiée : premier socle/contrats/tests/identité nécessaire au même AC,
pas de feature indépendante ajoutée. Une PR unique cohérente vise activation
fermée puis preuve synthétique ; pas de PR intermédiaire exposant onboarding
sans isolation. Pas d'ouverture de PR/merge dans la mission présente.

## Commandes et preuves futures — interface à rendre réelle

T00 fournit scripts et configurations ; T01 complète les commandes applicatives.
Chaque script échoue si manifest absent, version erronée, service/fixture manquant
ou test absent ; aucun faux succès `--passWithNoTests`. Les logs expurgent secrets.

| ID | Commande future depuis racine du worktree | Contrat / preuve |
|---|---|---|
| V0 | `bash scripts/worktree-setup.sh --synthetic` | Vérifier versions/digests, installer depuis lock frozen, créer uniquement ressources synthétiques et secrets tmpfs, migrations/seeds isolés, afficher ports/résumé sans secret |
| V1 | `bash scripts/worktree-test.sh --unit` | `pnpm test:unit` : Vitest règles/DTO/guards/services purs ; aucun test ignoré |
| V2 | `bash scripts/worktree-test.sh --integration` | `pnpm test:integration` : vrais PG17, migrations/permissions/deux DB, outbox/saga/crash/J1 ; jamais simple mock de DB |
| V3 | `bash scripts/worktree-test.sh --auth` | `pnpm test:auth` : vrais Keycloak/PI/provider/ingress, attaques, claims, secours/OTP, epochs/session ; suite obligatoire avant ACTIVE synthétique |
| V4 | `bash scripts/worktree-test.sh --contracts` | `pnpm test:contracts` : DTO/OpenAPI/client, statuts/redaction, unknown fields/version/idem |
| V5 | `bash scripts/worktree-test.sh --e2e` | `pnpm test:e2e` : Playwright via TLS ingress synthétique ; onboarding→création→activation et erreurs/accessibilité |
| V6 | `bash scripts/worktree-test.sh --build` | `pnpm typecheck`, `pnpm lint`, `pnpm build:api`, `pnpm build:web` ; builds indépendants, aucune importation secret/PG vers web |
| V7 | `bash scripts/worktree-dev.sh` | Démarrer API/web/provisioner et profils privés ; propriétaire/admin test fournis via canal de test privé, pas logs |
| V8 | `bash scripts/worktree-down.sh` | Arrêter seulement projet Compose de ce worktree ; conserver volumes/evidence ; jamais `down -v` ou prune implicite |

Les scripts utilisent un nom Compose dérivé du chemin+hash du worktree ; allouer
ports locaux libres et stocker mapping dans fichier privé ignoré ; services PG,
IdP, PI, Inngest/Redis et journal propres. API/web passent par ingress, pas accès
Keycloak direct. API runtime sans secret DDL. Volumes/journal/keys distincts des
worktrees préexistants. V0 refuse collision ou données non synthétiques.
Nouvelle acquisition/install/services exclusivement lors du futur mandat ; pas de
reprise du POC annulé D71. Digests et patchs exacts sont vérification N2 de versions
retenues, pas réarbitrage de stack. Manifest trace provenance, licence, hash et
scripts lifecycle allowlist avant usage ; aucun tag `latest`, wildcard ou secret.

## T00 — Worktree Setup futur : environnement synthétique reproductible

**Objectif :** isoler l'environnement avant Execute ; uniquement outillage/env,
pas logique métier. Dépendance : Plan PASS et nouveau mandat compatible.

**À créer :**
- `infra/local/versions.json`, `infra/local/compose.yaml` ;
- `infra/identity/keycloak-realm.json`, `infra/identity/privacyidea.cfg`,
  `infra/identity/provider.properties` ;
- `infra/ingress/nginx.conf`, `infra/ingress/modsecurity.conf`,
  `infra/ingress/otp-rules.conf` ;
- `scripts/worktree-setup.sh`, `scripts/worktree-dev.sh`,
  `scripts/worktree-test.sh`, `scripts/worktree-down.sh` ;
- `docs/agentic/work/S01/environment.md` (ports/projet/services, versions, limites,
  commandes/reprise/cleanup, aucun secret).

**À créer également :** `.gitignore` (absence vérifiée) pour ressources
locales privées/env/certificats/keys/volumes/reports de secrets. Ne pas ignorer tests,
manifests ou evidence redigée.

Stack figée D71/D72 : Node24/Nest12/Express5/React19/TS6/Vite8/PG17/Drizzle/pg,
Inngest retenu, Redis7 ; Keycloak26.8 candidat exact correctif, PI3.14/provider1.8.0,
NGINX/ModSecurity maintenus. Figer correctifs/digests et distributions vérifiés,
conserver les locks/corpus d'origine B12 uniquement en provenance historique.
Sélection d'une bibliothèque OIDC maintenue `openid-client`, validation signatures
backchannel `jose`, schémas partagés `zod`, validation OpenAPI et tests Vitest/
Playwright : adaptateurs techniques aux contrats, pas moteur auth maison.
Pas nouvelle infrastructure SaaS/SMTP/IA/coffre externe obligatoire en local.

Configurer realm `dossiercle`, owner subject explicite, clients BFF/resolver
least privilege, flows REQUIRED et fermeture ingress selon Design/OTP ; profils
identity/provisioning et Inngest privé. ModSecurity body32Kio/nombre64 paramètres,
parsing ambigu = refus ; pas logs body/OTP ni buffering disque. Identifiants et
clés test générés en tmpfs, manifests jamais secrets. Aucun endpoint admin exposé.

**Migrations/API :** aucune migration métier à cette étape ; databases techniques
locales propres, schémas upstream gérés par leurs logiciels ; API pas développée.
**Tests/vérification :** syntaxe scripts (`bash -n`), validate Compose, healthchecks,
digests, frontières réseau/secrets, setup relancé sans collision, cleanup sûr.
V0 initial prépare services et outillage ; signale explicitement « migrations/tests
S01 non disponibles avant T02 » plutôt que PASS fictif. T01 finalisera exécutables.
**DoD :** environnement décrit/reproductible et prêt pour T01 ; setup/dev/test/down
présents, modes encore sans tests applicatifs échouent explicitement. Gate
Worktree Setup couvre l'environnement, pas le comportement S01.

## T01 — Socle monorepo, builds séparés et contrats v1

**Objectif :** rendre le socle cible et les commandes V réels. Dépendance T00.

**À créer :**
- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`,
  `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts` ;
- `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/nest-cli.json`,
  `apps/api/src/main.ts`, `apps/api/src/app.module.ts` ;
- `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`,
  `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/app.tsx` ;
- `packages/contracts/package.json`, `packages/contracts/tsconfig.json`,
  `packages/contracts/src/agency.contracts.ts`, `packages/contracts/openapi.yaml` ;
- `packages/domain/package.json`, `packages/domain/tsconfig.json` ;
- `packages/adapters/package.json`, `packages/adapters/tsconfig.json` ;
- `packages/testing/package.json`, `packages/testing/tsconfig.json` ;
- `packages/contracts/test/agency.contracts.spec.ts` ;
- `apps/api/test/agency.contract.spec.ts`.

Rendre V1…V6 fonctionnels via scripts package root, projets unit/integration/auth/
contracts distincts et vrais exit codes. CORS/origines fermés ; limiteJSON32Kio,
logs redigés/no-store, DTO zod stricts sans imports backend depuis web. OpenAPI
reprend **tous** endpoints/headers/responses Design ; cookie et CSRF décrits.

**API :** contrat Design §HTTP v1 ; inputs name/email/refs, bodies vides stricts,
Idempotency-Key/If-Match, codes sûrs, statut202/200/204/400/401/403/404/409/429/503.
**Migrations :** aucune (T02).
**Tests/commandes :** V1 DTO limites/NFC/unknown fields/header ; V4 validation des
exemples et modèle d'erreur sans fuite ; V6 builds/type/lint réels.
**AC/DoD :** AC1–4 traduits en contrat partagé ; commandes avec locks exacts et
builds indépendants, frontière imports testée, aucune route métier encore ouverte.

## T02 — Schéma central/agence et migrations initiales sûres

**Objectif :** contraintes d'intégrité/rôles depuis Design. Dépendance T01.

**À créer :** `packages/adapters/src/postgres/control.schema.ts`,
`packages/adapters/src/postgres/agency.schema.ts`,
`packages/adapters/src/postgres/migrate.ts`,
`packages/adapters/migrations/control/0001_s01.sql`,
`packages/adapters/migrations/agency/0001_s01.sql`,
`packages/adapters/drizzle.config.ts`,
`packages/adapters/test/schema.integration.spec.ts`,
`packages/testing/src/s01-fixtures.ts`.

Tables exactes Design ; compte app, session/membership/epochs dans schema identity
centrale, jamais hash/password/TOTP maison. FK/unique root/subject/agency/locator/
operation/event/idem ; CHECK enums/ACTIVE/date/schema, singleton marqueur agence,
admin initial role figé. Locks ordre Design. Version/checksum migration enregistrés.
Données synthétiques `Agence A/B`, sujets opaques distincts, owner/admin/standard/
habilité, secrets-canaris et journal séparé ; aucune copie de données réelles.

**Migrations :** nouvelles migrations SQL à générer/relire **pendant Execute**,
rien d'exécutable créé maintenant. Initial schema version1, transaction par DB,
verrou par base ; canari A→B, pas atomicité flotte. Service upstream KC/PI gère
ses tables, pas Drizzle les credential stores natifs. Rôles migration/runtime/
audit/bootstrap séparés, defaults PUBLIC/CONNECT fermés sur toutes DB.
**API :** aucun changement contrat.
**Tests/commandes :** V2 application/rejeu migration, contraintes et rollbacks,
schema partiel non activable, session centrale ne donne pas droit métier.
**AC/DoD :** AC1/2/3 contraintes réelles ; chaque fixture base/rôle indépendant,
reprise migration stable sans DROP, ancienne app ne lit pas version inconnue.

## T03 — Journal courant, audit, outbox et barrière d'autorité

**Objectif :** rendre les refus durables et octrois traçables. Dépendance T02.

**À créer :** `packages/adapters/src/journal/authority-journal.ts`,
`packages/adapters/src/postgres/control.repository.ts`,
`packages/adapters/src/postgres/agency.repository.ts`,
`packages/adapters/src/audit/audit-writer.ts`,
`packages/adapters/src/outbox/outbox-dispatcher.ts`,
`packages/domain/src/authority.ts`,
`packages/adapters/test/authority-journal.integration.spec.ts`,
`packages/adapters/test/outbox.integration.spec.ts`,
`packages/domain/test/authority.spec.ts`.

Journal synthétique append-only avec fsync, séquences/empreintes uniques,
répertoire/volume distinct **jamais restauré avec PG**, seul coordinateur writer.
Contrat head/append/confirm fermé ; production J1 ObjectLock/IAM non simulé comme
qualifié. Sous verrou account_authority courant : lire head, comparer watermark,
refuser PENDING/deny/divergence/indisponibilité ; tenir verrou jusqu'à commit/lecture.
Audit+outbox atomiques dans centre ; event_id unique côté agence projection.
Événements Design, logs sans noms DB/DSN/token/email entier ; ni UPDATE/DELETE audit.
Dispatcher Inngest publie et redéduplique, crash publication→ack sans perte.

**Migrations :** T02 couvre schéma ; pas autre migration.
**API :** erreur sûre503, jamais octroi fondé sur CONFIRMED ancien.
**Tests/commandes :** V1 règles, V2 panne J1 après fsync avant PG, concurrence
activation/deny, lecture/retry interdits malgré epoch central ancien, divergence,
journal perdu, rollback/restauration PG sans résurrection, outbox duplications.
**AC/DoD :** AC1/2/3 et R04 : zéro octroi non tracé, refus indépendant opposable,
commit central/audit atomique, tests utilisant vrais locks et DB.

## T04 — BFF et onboarding natif fermé

**Objectif :** bootstrap premier admin inclus S01, sans attendre S02. Dépendances T03.

**À créer :** `apps/api/src/auth/auth.module.ts`,
`apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.service.ts`,
`apps/api/src/auth/authority.guard.ts`, `apps/api/src/auth/csrf.guard.ts`,
`packages/adapters/src/identity/keycloak-adapter.ts`,
`packages/adapters/src/identity/enrollment-adapter.ts`,
`apps/api/test/auth.unit.spec.ts`, `apps/api/test/auth.integration.spec.ts`,
`tests/auth/s01-auth.spec.ts`.
**À compléter :** configs identity/ingress T00, app.module T01.

OIDC Code+PKCE S256 openid-client, state/nonce usage unique, issuer/aud/signatures,
redirectURI exact, tokens serveur chiffrés, cookie opaque/hash store ; pas logique
password/TOTP maison. Flow Keycloak LOA2 obligatoire et claim `acr=2` attendu,
issuer/client/config connus ; échec claim ou preuve d'enrôlement = refus, jamais
accepter uniquement une déclaration UI. Adapter PI confirme premier OTP par API
maintenue et identité realm/resolver/UUID ; vérifier secours natifs générés via
l'état credential upstream, pas lecture des codes. Authority CONFIRMED seulement
après preuves et J1 convergé ; changement IdP inconnu ferme le compte.
UI/API maintenue PI avec grant temporaire10 min lié sujet/racine, sans accès
métier ; mêmes paramètres OTP/clients fermés normatifs Design/ARCHITECTURE_OTP.

Session scope onboarding lié invitation, scope agency seulement après ACTIVE,
réévaluer scope courant via centrale (pas ancien cookie d'onboarding réutilisé
comme grant métier autonome). Idle30/absolu15j, polling exclu ; CSRF/origin,
backchannel signé/anti-rejeu et logout ;5 échecs/délai progressif≤15min, pas lock
permanent, password policy12 selon contrat upstream. Aucun endpoint récupération
totale nouveau : procédure D05 et lien10min gardés dans dossier privé/runbook.

**Migrations :** T02 identity ; pas credential store custom.
**API :** auth/start/callback/session/logout et scopes Design.
**Tests/commandes :** V1 guards, V3 réels password→TOTP→secours, non-enrôlé/bad
OTP/rejeu/deux secours concurrents, PI/coffre/J1/TLS indisponibles, claim A→B,
CSRF/state/nonce/callback rejeu, inactive/revoked session/idle/15j/multi-onglets,
forgeries scope/id_token_hint query/body encoded/duplicate/multipart/directpath,
WAF arrêté fermé ; dumps KC sans secret TOTP, PI ciphertext/ENCKEY hors backups,
rotation synthétique et clés absentes fermées. Bloquer activation tant que V3 échoue.
**AC/DoD :** AC1/3 bootstrap fort natif sans bypass ; contrats de session partagés
avec S02, aucune régression auth permise, owner bootstrap explicite vérifié.

## T05 — Invitations propriétaire et création durable

**Objectif :** autoriser première création sans inscription libre. Dépendances T04.

**À créer :** `apps/api/src/platform/platform.module.ts`,
`apps/api/src/platform/invitations.controller.ts`,
`apps/api/src/platform/invitations.service.ts`,
`apps/api/src/agencies/agencies.module.ts`,
`apps/api/src/agencies/agencies.controller.ts`,
`apps/api/src/agencies/agencies.service.ts`,
`packages/domain/src/agency-lifecycle.ts`,
`packages/domain/test/agency-lifecycle.spec.ts`,
`apps/api/test/agency-creation.integration.spec.ts`,
`scripts/s01-owner-confirmation.ts`.
**À compléter :** app.module et keycloak/enrollment adapters.

Commande privée owner-confirmation enregistre preuve de contact/canal minimisée
et émet références UUID attendues ; confirmation humaine par owner, fixture
synthétique explicite en test, aucune identité brute/URL/libre texte. Owner subject
serveur, UI privée upstream password jamais connu owner ; idempotency IdP UUID,
PENDING avant call et réconciliation timeout/duplicate. Invitation issuable une
fois après état confirmé, grant/token hashés liés sujet10min ; réémission/revoke
J1, même racine/agency, aucun secret GET/log. Grant claim atomique, même sujet
retrouve contexte, autre sujet refusé.
Création transaction unique invitation/authority/agency/membership PENDING/operation/
audit/outbox/idem ; unicité racine et hash canonical name. Pas subscription
facturée ; politique fonctions/modules fermée, pas appel B05/B06.

**API :** invitations create/get/issue/revoke, claim, POST agencies, GET onboarding
agency ; forme exacte Design. Key replay sous auth courante avant version,
corps différent409 ; double nouvelle key avec même racine/corps même espace.
**Migrations :** T02 seulement.
**Tests/commandes :** V1 règles, V2 deux créations simultanées/même ou différente
clé, deux noms conflit, TTL/réémission/revoke/grant étranger, panne audit avant
commit et réponse perdue après commit ; V4 tous headers/bodies/status/errors.
**AC/DoD :** AC1/2/3 aucune création anonyme/collaborateur/autre invitation,
retour202 uniquement durable ; compte/agency uniques malgré timeout upstream.

## T06 — Provisioning répétable et routage isolé

**Objectif :** une base/rôle/secret par agence, reprise sûre. Dépendances T05.

**À créer :** `apps/api/src/provisioning/provisioner.main.ts`,
`apps/api/src/provisioning/provisioning.function.ts`,
`packages/adapters/src/postgres/agency-provisioner.ts`,
`packages/adapters/src/postgres/tenant-router.ts`,
`packages/adapters/src/secrets/secret-store.ts`,
`packages/adapters/test/provisioning.integration.spec.ts`,
`packages/adapters/test/tenant-isolation.integration.spec.ts`.
**À compléter :** V0/V7 et compose pour processus provisioner séparé ; outbox dispatcher.

Inngest interne déclenche saga ; operation rechargée courante, verrou PG session
operation tenu durant DDL/coffre/checkpoints ; pas lease qui autorise nouvel émetteur.
Nom `ag_<uuidSansTirets>` serveur, rôles `agr_<uuid>`/`agm_<uuid>` générés/quotés.
Secrets locaux tmpfs0400 versionnés, même ref vérifiée au retry. API dépourvue DDL.
CREATE DATABASE hors transaction avec ALLOW_CONNECTIONS false dès création ;
depuis DB maintenance REVOKE PUBLIC CONNECT/TEMP et GRANT CONNECT migration,
puis ALLOW_CONNECTIONS true seulement après vérification ACL, runtime accordé
après schéma/ACL prêts. Pas protection fondée sur template ou seul NOLOGIN B.
Migration transaction locale, checksum+marqueur,
public CONNECT sur DB nouvelle/centrales/autres retiré **avant** tout octroi
runtime. Permissions future objets/table/séquences, runtime non-owner.
Locator jamais accepté depuis client ; pool key agency+secretVersion, fermeture
éviction/rotation. Connexion runtime vérifie marqueur et schema avant READY.

**Bornes techniques locales réversibles fixées :** PG max_connections100 ;
routeur max2 connexions/pool, max4 pools/processus, 2 processus runtime autorisés
(API et provisioner pour vérification), budget16 connexions agence ; centrale
max4/processus, migrations/provisioning une connexion par base et un provisioner.
Réserve20 connexions exploitation/auth ; somme des pools upstream KC/PI/Inngest
+ autre usage à inventorier V0 et garder total≤80. Si impossible, réduire pools/
concurrence avant démarrage, jamais augmenter sans trace/mesure. En attente,
backpressure503 sans ouverture illimitée ; timeout acquisition2s/SQL5s, idle
éviction60s. Un provisioning actif plateforme, backlog100 opérations max acceptées
(sinon429 sans consommation invitation). Valeurs tests locaux, pas capacité G05.

**Migrations/API :** appliquer T02 schema agence1, update operation status via API
GET activation ; jamais exposer credentials/errors SQL. Pas ressource/fichier client.
**Tests/commandes :** V2 deux vrais DB/roles canaris A/B lectures/écritures,
A CONNECT B/control/KC/PI interdit, y compris pendant pause CREATE→REVOKE,
après réouverture migration et après octroi runtime B ; pool/context substitutions, fake outbox locator
ignoré/rejeté, secret/objet mapping A→B interdit, rôle API DDL/SET ROLE interdit ;
crash avant/après chaque effet/commit et publication ; deux runners/lock perdu/
réveil ancien processus/secret uncertain ; schema mismatch refuse READY ; bounded
pools/eviction/backpressure réels. Canary objet synthétique n'ajoute aucune API fichier.
**AC/DoD :** AC1/2/3 même operation/DB/secret à la reprise, preuve ownership avant
adoption, erreur nonretryable si conflit, jamais DROP auto ou deuxième base active.

## T07 — Confirmation d'activation, état et reprise

**Objectif :** publication ACTIVE atomique et vue sûre. Dépendances T06 et V3 PASS.

**À créer :** `apps/api/test/agency-activation.integration.spec.ts`,
`apps/api/test/agency-isolation.integration.spec.ts`.
**À compléter :** agencies service/controller, lifecycle, repositories/audit/outbox.

GET activation autorise onboarding lié ou membership ADMIN propre ; canActivate/
canRetry ne sont pas permission suffisante. Retry same operation version+idem,
revalidation J1 et no revocation. Activation READY uniquement après toutes preuves
Design, audit local prepared unique vérifié puis transaction centrale membership+
agency+audit+outbox+idem. Nouvelle session/login non exigés pour confirmer mais
scope central courant réévalué. Session expired/revoked bloque avant commit.
Pas de re-MFA spécifique supplémentaire inventée, session forte courante requise.
Projection audit local depuis outbox idempotente ; central ACTIVE autorité finale.

**API :** GET activation, POST activation et retry ; contrats/codes Design.
**Migrations :** T02 seulement.
**Tests/commandes :** V2/V4 READY/ACTIVE/FAILED, échec audit local/central, réponse
perdue avant/après central, activation deux appels/double clé, replay avec vieux
If-Match/corps identique sans double audit, version obsolète nouvelle mutation409,
révocation J1→PG concurrente et changement compte pendant activation, tentative
activation A→B404 sans donnée, standard/habilité propre403, anonymous401.
**AC/DoD :** AC1–4, jamais membership partiellement publié ni IA implicitly on,
aucune activité perdue ou projection « préparé » présentée ACTIVE.

## T08 — UI onboarding et état d'activation accessibles

**Objectif :** parcours administrateur exploitable sans infrastructure exposée.
Dépendances T07, contrats stables T01.

**À créer :** `apps/web/src/pages/onboarding.tsx`,
`apps/web/src/pages/agency-activation.tsx`,
`apps/web/src/lib/agency-api.ts`, `apps/web/src/components/activation-status.tsx`,
`apps/web/src/styles/tokens.css`, `apps/web/src/styles/app.css`,
`tests/e2e/s01-activation.spec.ts`, `tests/e2e/s01-isolation.spec.ts`.
**À compléter :** app.tsx routes React Router et main.tsx.

UI native upstream pour password/MFA, formulaire nom seulement, état/progression
et boutons explicites Design ; composants sémantiques simples conformes DS,
aucune bibliothèque UI supplémentaire. Déduire agency contexte du backend, pas
nom/id dans URL comme preuve. Remplacer fragment invitation et no-referrer/
no-store, aucune dépendance analytics/ressource tierce. Double clic/polling borné
sans human activity, offline/relogin→relecture état, erreur persistante et correlation.

**API :** client typé contrats, cookies+CSRF ; pas pg/secrets importés.
**Migrations :** aucune.
**Tests/commandes :** V5 succès/panne/reprise/refresh/double clic/session expired/
offline/étranger, canActivate trompeur ne suffit pas backend, clavier/focus/status
live/reflow320px/zoom200%/contrasteDS, snapshots redigés sans grants/passwords/QR.
V6 builds séparés, aucun token stockage navigateur.
**AC/DoD :** AC1/2/4 visibles, AC3 refus générique ; pas CPU/RAM/secrets, aucun
succès anticipé/IA ou connecteur suggéré comme déjà actif.

## T09 — Qualification complète, CI et preuves par AC

**Objectif :** démontrer le comportement et arrêter si N2 essentiel échoue.
Dépendances T08. Aucune relecture de conception à refaire.

**À créer :** `.github/workflows/s01.yml`,
`docs/agentic/work/S01/verify.md` (futur Verify applicatif),
`docs/agentic/work/S01/review.md` (futur reviewer code indépendant).
**À modifier :** README.md (instructions application/limites une fois réelles),
STORIES/STATUS (uniquement transitions story justifiées), handoff/goal de story
séparés de l'objectif de préparation actuel.

CI sur artefact/locks figés : documentaire existant conservé, V1–V6 via env privé
synthétique, installation frozen, types/lint/builds/contrats et vrais services.
Sans service ou test : job échoue, ne transforme pas « non exécuté » en PASS.
Scans secrets/dépendances/images/notices, digest/SBOM exacts ; provenance
outillage manifest T00. Compte owner CI synthétique, aucun secret réel.

**Tests/commandes :** V0, V1–V6, V8 ; consigner versions, commandes/exit codes,
commit, durations, preuves DB/HTTP/browser/images redigées et défauts rencontrés.
Mesurer acceptation202<2s et GET/activation ordinaire<2s sur setup nominal local,
coldstart séparé ; ces essais S01 ne prétendent pas G05 complet ou production.
**API/migrations :** pas évolution nouvelle ; dry-run migration et restauration
synthétique central/agence/PI avec J1 courant ; erreur ferme octroi.
**AC/DoD :** chaque scénario matrice ci-dessous PASS avec preuve, aucun Critical/
Major ; Verify puis reviewer **indépendant**. CI hébergée seulement annoncée une
fois réellement observée sur la tête. Ship/merge restent sous mandat humain.

## T10 — Handoff de livraison et suivi des limites

**Objectif :** transmission sûre à S02 et suites, pas changement métier.
Dépendance Verify/Review PASS. Fichiers documentation S01 handoff/environment,
STORIES/STATUS/README ; aucun fichier code additionnel.
Reprendre preuves/limitations et contrats/session/membership/epoch pour S02/S04,
conditions N2/N3 commerciales ouvertes et B05/B06 séparés. Goal livraison distinct
SATISFIED seulement après ses critères ; story DONE exige CI/humain/merge/cleanup
selon WORKFLOW et D57. La préparation actuelle n'autorise rien de ces actions.
V8 et documentation checked ; aucune suppression de ressource utilisateur.

## Matrice minimale des tests et preuves

Fixtures synthétiques T02, clock contrôlée pour TTL/idle/15j, réel PG/IdP/PI pour
frontières ; fault injection aux adaptateurs réseau seulement, pas simulation
des contraintes/locks PostgreSQL. Fichiers exacts ci-dessus portent ces cas.

| Cas obligatoire | Tâche / suite | Assertion discriminante |
|---|---|---|
| Création autorisée et admin vérifié | T04/T05/T07, V2/V3/V5 | Password propre+OTP confirmé+secours+J1, une DB/ADMIN ACTIVE ; IA off |
| Création non autorisée | T05 V2/V4 | Anonyme401, rôle propre403, invitation/sub étranger refus identique |
| Validation entrante | T01/T05 V1/V4 | Limites/name/email/unknown/keys/versions/JSON size ; aucune persistance invalide |
| Activation nominale/répétée | T07 V2/V4 | ACTIVE atomique, replay même version résultat courant, un seul événement activated |
| Activation en échec | T07 V2/V5 | Pas ACTIVE ni ADMIN active si preuve/audit/version invalide ; état sûr visible |
| Double création et concurrence | T05/T06 V2 | Deux sessions/runners, une racine/DB/operation ; pas remplacement secret aveugle |
| Lecture et écriture A→B | T06/T07 V2/V4/V5 | Refus backend et PG CONNECT ; canaris B jamais retournés/modifiés |
| Substitution de secret/objet/outbox | T06 V2 | Pas capability par id, locator serveur, mapping deux agences, aucune route fichier |
| Crash/récupération | T03/T06/T07 V2 | Reprise après redémarrage processus depuis PG/outbox, pas seconde base/octroi |
| J1 refus avant PG en panne | T03/T07 V2 | Ancien CONFIRMED/ACTIVE ne permet ni lecture/retry/activation ; watermark courant |
| Révocation/activation concurrentes | T03/T07 V2 | Ordre linéarisé sous verrou ; octroi après deny impossible |
| Non-régression auth | T04 V3/V5 | MFA sans bypass, idle polling/15j/logout/epochs/backchannel/CSRF ; attaques provider bloquées |
| Audit/secrets/UI | T03/T08 V2/V5/V6 | Pas secret canari/token/QR dans bundle/logs/evidence/DTO ; erreurs utiles sans existence B |
| B05/B06 absents | T05/T07 V2/V5 | Aucun réseau fournisseur, espace ACTIVE vide possible, fonctions désactivées |

## Migration, compatibilité et rollback

Initialisation seulement, aucune production existante à migrer ; version1
central/agence contrôlée. Nouveau schéma sous rôle migration, transaction par
base, checkpoint hors DB vérifié ; pas transaction CREATE DATABASE+coffre+IdP.
Code compatible uniquement version1 à ce stade ; future N/N-1 à définir lors de
l'évolution concernée, pas support inventé. Tables invariants/relations, pas JSONB
non validé. Versions d'événements v1 et claims/scopes typés partagés.
Rollback : fermer nouveaux octrois et runner, conserver DB/secret/audit/J1/outbox,
réconcilier propriété/résultats puis reprise explicite. Jamais DROP auto, restore
sur base active ou OTP natif en fallback. Toute restauration se fait isolée et
relit J1 courant, invalide sessions ; disparition/refus post-backup opposables.

## Validations différées — aucune décision indispensable repoussée

| Validation acquise seulement en preuve | Responsable | Échéance | Vérification / action si échec |
|---|---|---|---|
| Compatibilité patchs/digests/locks Node24/Nest12/TS6/PG17 | Implementer/reviewer | T00/T01, avant activation S01 | V0/V6 ; arrêt, correction compatible, ADR si contradiction structurelle |
| D81 KC/PI/provider+ingress/enrollment/claims/OTP/backup clé | Sécurité/QA | T04/V3, avant ACTIVE synthétique | Triplet/config/attaques/dumps/rotation ; rester PENDING, aucun fallback |
| Isolation, routage, permissions, pools | QA backend | T02/T06/T07 Verify, avant exposition | V2 deux DB, budgets≤80 ; fermeture/redimensionnement documenté |
| Audit/J1/opposabilité/revocation/saga/outbox | QA sécurité | T03/T07 Verify, avant octroi | Crash après J1 avant PG, ancienne session, locks/perte, restart ; refus fermé |
| IAM Secret Manager, J1 ObjectLock/Multi-AZ, licences/PI/Inngest, rétention/notice/support/coûts | Propriétaire plateforme | Avant données réelles/vente N3 | Tests IAM/contrats/notices/runbooks ; local synthétique seulement jusque-là |
| D58 PRA30j/RPO/RTO<4h, récupération D05, capacité réelle/pools G05 | Exploitation/QA | S03 puis gates pré-commerce, selon architecture | Restore multistore/J1/PI/clés et cinq charges intégrales ; commerce interdit si échec |
| B05-P-1 | QA intégration mail | S07/S08/S09 avant intégration concernée | Essai D82 propre fournisseur ; mode manuel sans qualification |
| B06-P-1 | QA IA | Story IA concernée avant route IA | Essai D82 ; route désactivée/humain jusque-là |

B05/B06 sont hors tâches S01 et n'en bloquent ni Research, Design, Plan, ni
activation de l'espace vide. Aucune boîte réelle, API Mistral, mail immobilier,
OCR, mandat/autonomie ou facture activée par S01. La preuve locale ne qualifie
pas l'environnement commercial ; les permissions réelles et N3 restent gates.

## Fichiers et Plan Gate

Créer uniquement les fichiers explicitement listés T00–T09 ; modifier uniquement
ceux nommés à compléter/modifier. Supprimer : aucun. Ne pas toucher POC temporel,
worktrees ou changements locaux préexistants. Une modification de fichier futur
« à compléter » suit sa création dans la tâche antérieure, pas une existence actuelle.

- [x] Tâches ordonnées/actionnables, objectifs et dépendances explicites.
- [x] Nouveaux chemins distingués du dépôt réel ; commandes existantes/futures séparées.
- [x] API, migrations, tests, DoD et evidence par AC définis.
- [x] Sécurité/isolation/J1/OTP et rollback couverts.
- [x] B05/B06 non bloquants pour S01 ; aucune décision N1 ouverte.
- [x] Revue indépendante Plan PASS dans `plan-review.md`.

Verdict : **PASS**, après corrections et revue indépendante 2.
Execute/Verify applicatifs non commencés ; Worktree Setup reste futur.
