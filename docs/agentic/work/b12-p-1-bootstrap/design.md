# Design — B12-P-1 local

2026-10-11. **DESIGN: PASS documentaire sous revue indépendante**, après Research de préparation PASS. **Execute BLOCKED** ; aucune fixture créée. Sources : [Research](research.md), Q4 B12-P-1 intégral, ADR-013, D69, [distributions](distribution-manifest.md).

## Fixture et frontières proposées

Racine expérimentale `.poc-b12/` isolée : Node24.21.0/pnpm12.8.1 process-local ; workspaces `apps/web`, `apps/api`, `packages/contracts/domain/adapters/testing` et tests integration/e2e/performance, sans écriture dans source produit. Versions directes exactes Q4, unique lock frozen et engine-strict, lifecycle refusés par défaut. Deux installations propres et deux builds doivent utiliser mêmes manifests/lock et comparaisons de digests. Web sans import pg/Drizzle/secrets, domaine sans frameworks ; artefacts web/API/migrations distincts.

PostgreSQL17.11 cache pin par digest, nouveau container/réseau privé B12, DB auth/agency_a/agency_b avec migrations zéro/N-1/rollback et credentials synthétiques dédiés. API runtime sans superuser ; mapping agence interne, credentials étrangers refusés. Ne jamais utiliser container DB utilisateur. Ports hôte loopback uniquement. Container/API/Collector/navigateur/k6 hors Internet au runtime ; acquisition et exécution phases séparées. Pas de runtime persistant Inngest serveur SSPL : SDK exact vers fixture locale/mock ; signing protocol testé, `enableUnauthedSync:false`, aucun appel cloud.

BetterAuth/Drizzle/pg/tiers Nest importés réellement et schéma/routes contrôlés pour absence plugins interdits. Claims bornés bootstrap ; aucune réussite MFA/codes/récupération B07 déduite. Reviewer indépendant confirme bootstrap sans fullMFA B07 ; contrat coreauth/type/runtime/schéma stable requis et requalification B12 si remédiation B07 le change. Aucun accès métier réel.

Collector exact binaire0.162.0, uniquement otlp receiver, memory_limiter/filter/transform/batch processors, otlphttp vers sink local. Un provider OTel unique par processus. OTLP local protégé, canaris email/DSN/cookie/token/prompt/document injectés puis absents de traces/logs exportés ; audit séparé. SBOM scanné même composants non configurés, notamment dépendance Prometheus Q4.

## Matrice de preuves obligatoires

| Gate Q4 | Preuve attendue |
|---|---|
| Lock/versions/peers | Deux installs frozen, même lock, zéro peer/engine insatisfait, provenance/transitifs/lifecycle |
| Compilation/frontières | TS noEmit, Nest+Vite React deux builds, imports interdits refusés |
| PG/auth | Trois DB/migrations réelles, auth/tiers integration, aucune route/plugin interdit, tentatives croisées refusées |
| Inngest/OTel | Callback local/methodes/signatures/sync non authentifiée refusées, singleton et canaris absents |
| OpenAPI | Deux canonicalisations SHA identiques, rupture volontaire détectée et addition compatible acceptée, client regénéré |
| Tests | Vitest, intégration PG, Playwright Chromium minimal, k6 sur service API B12 interne smoke ; pas cinq charges V1 revendiquées |
| Dépendances/artefacts | SBOM source/binaire/image/cache, licences exactes, Gitleaks/Trivy/advisories, Critical/High bloquants sans dérogation datée, source maps privées |
| Promotion/rollback | Même digest entre QA/prod factices, aucun rebuild, artefact N-1 compatible réactivé après coupure fake effets et smoke |
| Nettoyage/revue | Inventaire avant/après, seules ressources créées retirées, commandes/hashes/résultats/limites, reviewer indépendant |

Quota global4CPU/8Gio/15Gio, maximum4processus API/workers + PG/Collector/Chromium. Zéro fournisseur/compte/donnée réelle, images globales/caches utilisateurs inchangés. POC PASS seulement toute matrice Q4, pas somme de smoke locaux. HA/PRA/promotion réelle/CI/charge complète restent Verify future.

## Isolation egress et ressources

Préflight parent : unshare user/net refusé. Aucun processus API/Collector/navigateur sur hôte supposé sans réseau. Runtime dans containers nouveaux B12, réseau Docker internal ou none pour scans/builds. Aucun montage socket Docker. Ports hôte127.0.0.1 seulement ; contrôle refus egress avant tests par endpoint contrôlé sans fournisseur réel.

Limites cgroup proposées : PG1CPU/2Gio, API1CPU/2Gio, runner avec navigateur1,5CPU/3,5Gio, Collector0,5CPU/0,5Gio. Agrégat4CPU/8Gio ; scanners/builds remplacent runner, pas ajout. Enfants navigateur inclus cgroup. Image PG17.11-bookworm peut porter Node24/API avec entrypoint override, utilisateur nonroot, mounts readonly ; PG distinct. Aucun apt au runtime. Chromium/libs système dans cette base non prouvés : qualifier offline dans POC ; toute autre base nécessite provenance/manifeste/quota, pas apt hôte ni réseau navigateur ouvert.

### Cible k6 retenue — BR02

Runner et API sont deux containers distincts sur le réseau Docker internal créé pour B12. k6 cible uniquement http://b12-api:3000 par DNS de ce réseau ; ce n’est pas le 127.0.0.1 du runner. API bind interne 0.0.0.0:3000, publication éventuelle hôte uniquement127.0.0.1:3000. Aucun host-gateway, host networking, privileged ou fournisseur Internet. DNS/proxy hôte ne devient pas allowlist runtime. Smoke synthétique local Q4 conservé, mêmes cgroups agrégés.
