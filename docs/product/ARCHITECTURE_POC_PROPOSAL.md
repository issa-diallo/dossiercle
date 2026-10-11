# Proposition de bornes B07-P-1/B12-P-1 — pour validation, pas mandat exécuté

> **D71 — 2026-10-11 : stack validée, POC arrêté sur demande utilisateur.** React 19, TypeScript 6, Vite 8 ; NestJS 12, Node.js 24, Express 5 ; PostgreSQL 17/Drizzle ; Better Auth/NestJS ; Inngest ; Vitest, Playwright, k6 et OpenTelemetry sont les choix acquis. Le POC n'est plus un préalable à leur adoption. B12 : choix stack/outillage clos par décision, preuves techniques restantes dans les stories. Aucun nouveau POC/reprise autorisé. Les mentions antérieures de stack proposée, de POC à terminer avant adoption et d'acquisition encore autorisée sont supersédées dans cette portée. Architecture globale non qualifiée, exigences sécurité et décisions d'exploitation encore ouvertes. [D71](ARCHITECTURE_DECISIONS.md#d71), [preuve d'arrêt](../agentic/work/b12-p-1-bootstrap/evidence/user-stop.json).

Date finale : 2026-10-11, observations de versions le 10. Protocoles et bornes NON ADOPTÉS/NON EXÉCUTÉS ; aucune installation autorisée par cette fiche.

Le gate Q4 complet est conservé. La proposition « 2 h, 0 € de dépense externe, 2 Go cumulés par B07 et B12 » peut borner une tentative, mais ne constitue pas une estimation crédible garantissant PASS depuis un environnement vierge. B07 inclut un développement sécurité et la validation de nombreuses courses ; B12 ajoute installation, navigateurs, images, bases de scans, OTel, OpenAPI, deux builds et rollback simulé. Ne pas annoncer qu’ils seront clos en 2 heures.

Aucune installation, daemon, image, compte, fournisseur, IA, envoi mail ou ressource cloud n’est lancé par cette fiche. Toutes les valeurs ci-dessous sont PROPOSED. Architecture reste BLOCKED pour ces gates.

## Préflight requis

- Vérifier place disque/RAM/CPU, disponibilité ports et permissions Docker, sans changer configuration machine. Docker binaire présent ne prouve pas daemon utilisable.
- Inventorier versions et caches existants, arrêter le protocole si origine/empreinte non traçable. Hôte constaté par orchestrateur : Node 22.23.1, npm 10.9.8, Python 3.12.3 ; Node 24 du candidat doit être installé isolément et non remplacer Node global.
- 22.23.1 satisfait déclarativement la plupart des peers, dont Vitest 5 et tiers Nest, mais ne respecte pas le contrat candidat Q4 `>=24.21.0 <25`. Ne pas faire passer un essai Node 22 comme preuve du contrat Node 24.
- Worktree/branche/ticket distincts, writer unique, reviewer indépendant. Artifacts versions/lockfile et nettoyage conservés hors secrets ; pas commit/PR sans respecter COMMITS.
- Reprendre Research/Design/Plan PASS et DoR de l’essai, avant code. Choisir horloge injectable/testable, deux API processus, PostgreSQL local synthétique, faux transport et mail sink mémoire/interne.
- Avant download : manifeste des URL finales, versions, SHA-256/digests, taille Content-Length quand disponible ; budget réseau cumulatif et requêtes reroutées/CDN comptées. Sans taille connue, téléchargement interruptible avec limite octets stricte. Aucune estimation prétendue exacte sans mesure.
- Quotas PROPOSED à ratifier : max 4 processus API/workers, 1 PostgreSQL avec auth et deux agences, 1 Collector, 1 navigateur Chromium, max 4 CPU/8 GiB RAM et 15 GiB disque temporaire pour tentative ; arrêter si host ne permet pas ces plafonds. CPU/RAM/disque ne sont pas acquis par le mandat utilisateur.

## Réseau et bornes réalistes

Coût : 0 € de dépense externe, aucune ressource/compte cloud. Coût local CPU/disque non assimilé à zéro ressource.

Réseau développement : seulement métadonnées docs/registre et distribution des artefacts exacts. Runtime fixture : loopback/réseau Docker privé uniquement, aucun Internet. Télémétrie exportée vers sink local, Inngest fixture locale/mock et sync publique désactivée, k6 ciblant loopback. Mail sink local, aucune API Gmail/Graph/SMTP Internet ni IA.

Allowlist à proposer explicitement : registry.npmjs.org pour paquets, nodejs.org pour Node 24, docs officielles/github.com/api.github.com/raw.githubusercontent.com pour recherche/tags/signatures, ghcr.io ou Docker Hub registry/auth/CDN uniquement pour images exactes si retenues, GitHub release assets pour outils exacts. Les navigateurs Playwright utilisent une distribution CDN séparée et les scanners leurs bases propres : « registres/docs/images seulement » ne couvre pas implicitement ces téléchargements. Options : autoriser explicitement URL distributions navigateur/bases de scanner dans manifeste avant download, ou utiliser caches déjà présents validés. Sans l’un ou l’autre, ce volet est BLOCKED ; ne pas le supprimer.

2 Go doit être une limite cumulative mesurée par essai ou un budget partagé clairement défini. npm + Chromium + PG + Collector + scans et leurs bases peuvent atteindre le plafond ; aucune taille garantie ici. Réutiliser cache contrôlé est possible, mais deux installations frozen reproductibles doivent être vérifiées ; un cache n’est pas une exemption de provenance. Si plafond atteint : arrêt et nettoyage, résultat BLOCKED avec téléchargements restant estimés. Une reprise exige nouveau budget approuvé ; pas de fractionnement pour contourner plafond total.

## Matrice exacte candidate initiale

Versions Q4 publiées vérifiées le 2026-10-10 pour les candidats JavaScript principaux. Aucun `latest` ou `rc` implicite.

| Paquet ou outil | Version candidate |
|---|---|
| Node | 24.21.0 |
| pnpm | 12.8.1 |
| TypeScript | 6.0.3 |
| Nest core/common/platform-express | 12.1.2 |
| Express | 5.2.1 |
| Better Auth et adaptateur | 1.7.7 |
| @thallesp/nestjs-better-auth | 2.8.0 |
| Drizzle ORM / Kit | 0.45.3 / 0.31.11 |
| pg | 8.23.1 |
| React / React DOM | 19.3.0 |
| Vite / plugin React | 8.3.2 / 6.1.1 |
| Vitest / @vitest/coverage-v8 | 5.0.3 |
| Playwright | 1.63.0 |
| Inngest SDK | 4.21.1 |
| OTel API / SDK Node / auto-instrumentation | 1.9.1 / 0.222.0 / 0.80.0 |

Outils externes candidats Q4, existence/checksum à revalider au gel avant distribution : Collector Contrib 0.162.0, k6 2.3.0, oasdiff 1.33.0, Syft 1.54.0, Gitleaks 8.30.1, Trivy 0.75.0. Image PG17 exacte patch+digest à choisir et qualifier ; `postgres:17` flottant interdit. Image mail sink non nécessaire si mémoire/interne.

Peer graph réel, avis sécurité/images/transitives et licences restent à requalifier. Les mises à jour publiées Drizzle 0.45.4/pnpm 12.11.2/Vite 8.3.4/Playwright 1.64.0/Inngest 4.23.0/OTel SDK 0.223.0 ne sont pas automatiquement retenues.

## B07 complet : phases bornées proposées

Proposition réaliste : 3 phases de 2 h chacune, plafond total 6 h, chaque phase arrêt/nettoyage contrôlé et rapport. Ce sont des estimations de tentatives, pas une garantie de réussite. Budget réseau total initial proposé : 2 Go, susceptible d’être insuffisant : le préflight décide faisabilité avant premier download.

A. Provisionnement et preuve primitive : Node/lockfile, deux installations/builds/typechecks, schéma auth/routes, PostgreSQL central et deux agences, comptes synthétiques, TOTP chiffré/clé hors DB et hash du mot de passe. Zéro Organization. Invitation concurrente, inscription libre, MFA et trusted-device. Mot de passe correct vérifié ; mot de passe erroné refusé sans différence permettant l’énumération des comptes existants ou inexistants.

B. Sessions et concurrence : multi-onglets sous horloge contrôlée, polling/getSession sans prolongement, idle 30 et absolu 15 jours bornes ±epsilon, révocation/désactivation/logout/retrait avant effets fake jobs. Backup copie DB seule ne révèle pas TOTP. Codes hashés non relisibles, consommation atomique deux processus, régénération seulement après session fraîche et TOTP courant, invalidant atomiquement tous les anciens codes ; aucune valeur de code dans les logs.

C. Récupération et durcissement : identité/accord synthétiques, dernier admin, token hashé expiry usage unique limité au réenrôlement, anciennes sessions/facteurs/codes refusés. CSRF/origines, rate limits atomiques après redémarrage et deux instances. Migrations forward/rollback, logs canaris secrets absents, double reprise reproductible, rapport/reviewer/nettoyage.

Si une phase échoue fonctionnellement sans déclencher un critère d’arrêt, B07 demeure BLOCKED ; une phase indépendante peut continuer uniquement dans le périmètre, le mandat et les budgets cumulatifs déjà approuvés. Tout arrêt de sécurité, réseau, dépense ou plafond met fin à l’essai : arrêt, nettoyage ciblé et rapport, puis correction et nouvelle autorisation avant toute reprise. Aucun téléchargement ou processus supplémentaire ni remise à zéro des budgets n’est permis après cet arrêt. Cette règle vaut aussi pour B12. Ne pas inventer auth maison pour contourner limites bibliothèque sans ADR.

## B12 complet : phases bornées proposées

Proposition : 4 phases de 2 h, plafond total de huit heures. Réserve possible distincte de revue indépendante. Budget réseau de 2 Go total seulement si préflight manifeste le rend plausible ; sinon soit caches vérifiés, soit proposition plafond révisé avant download. Aucun cloud/compte prod.

A. Bootstrap : monorepo minimal, Node 24/pnpm exact/lock frozen 2 fois, zéro engine ou peer insatisfait, TS/Nest/React/Vite, deux builds, boundaries imports, auth+deux bases PostgreSQL agences migrations, absence plugins interdits.

B. Contrats/tests : OpenAPI, deux générations aux hashes identiques, oasdiff, rupture volontaire+addition, types du client, Vitest, intégration PostgreSQL, Playwright Chromium minimal, smoke k6 local. Aucun parcours métier réel.

C. Jobs/observabilité/chaîne de dépendances : SDK Inngest exact sans sync non authentifiée ni appels cloud, OTel singleton vers Collector exact et sink loopback, canaris sensibles absents exports, SBOM source et images, licences, Gitleaks/Trivy/bases advisories vérifiées, private sourcemaps.

D. Reproductibilité/promotion simulée : deux builds propres même commit/digests identiques ou métadonnées non déterministes expliquées ; manifests/hashes SBOM ; deux répertoires QA/prod factices distincts avec mêmes digests sans rebuild, rollback compatible simulé, smoke, purge et inventaire des processus/ports/volumes/caches. Revue indépendante de preuves.

B12 PASS uniquement après totalité gate Q4 ; PASS phase A ne vaut pas B12 PASS. QA et promotion cloud, charge représentative, HA/PRA et rollback réel restent livraison Verify et ne sont pas revendiqués.

## Arrêts et preuve

Arrêt sur dépassement de deux heures par phase/plafond total, quota réseau/disque/RAM/CPU, facture, endpoint externe runtime, script lifecycle non approuvé, Critical/High non dérogé, MFA/session/révocation contournée, fuite inter-agence ou canari, peers ou engines contradictoires, non déterminisme inexpliqué, migration croisée. Conserver rapport expurgé/versions/commandes/hashes/limites puis cleanup ciblé des seules ressources de l’essai. Pas suppression globale Docker ni retrait outils utilisateur.

Aucun cloud autorisé ; aucune question produit acquise rouverte. La validation humaine restante porte concrètement sur plafonds et manifeste de distribution, puis classement des preuves et gate global.
