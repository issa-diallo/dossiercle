# Environnement d’implémentation S01

WORKTREE SETUP: PASS — T00, 2026-10-11.
Mode PRODUCT/LARGE. Base 075602916355813cf4e8d3f952fadaec5e637398.
Branche feat/s01-espace-isole ; worktree `/home/issa/Workspace/perso/dossiercle/worktrees/s01-espace-isole`.
Identifiant S01, aucun ticket GitHub inventé, aucun commit/PR/merge.

## Isolation
Projet Compose `s01-a5907ce10e09` déterminé par SHA256 du chemin.
TLS `127.0.0.1:49401`, PG synthétique `127.0.0.1:33005`.
Keycloak, PI, Inngest et Redis sans port hôte. Réseau private internal ; edge
pour ports loopback PG/ingress, sans masquerade. Edge n’est pas présenté comme
interdiction totale d’egress : aucun trafic externe de test autorisé ou exécuté.
Services préexistants ordopro-b01-231-db et factory-backend-db-1 non modifiés.

Données PG `.local/data_pg`, Redis volume projet, journal `.local/journal`
distinct des DB/restaurations. Aucun journal applicatif encore écrit avant T03.
Secrets, clés et CA dans tmpfs `/dev/shm/s01-a5907ce10e09`, répertoires0700/fichiers0400 ;
montages séparés par service. Secrets absents du Compose/Git/rapports/logs Docker.
Logs Docker none ; NGINX accès/audit/corps/debug fermés. Pas de dump contenant clés.
API/provisioner/migrations d’agence absents à T00 ; aucune prétention de qualification.

## Distributions et budgets
Versions/digests/URLs/hash/licences/lifecycle dans `infra/local/versions.json`.
Node24.21.0 et pnpm12.8.1 isolés `.local/`, PATH global22 non modifié.
PG17.9, Redis7.4.8, KC26.8.0 + provider1.8.0 officiel, Inngest1.46.0,
NGINX1.30.5/ModSecurity3.0.17 via image CRS4.25.2 datée et digest figé.
PI3.14 wheel PyPI + psycopg2-binary2.9.10/Gunicorn23.0.0 ; 65 wheels
versionnés/hashés, installation offline sans scripts source, `pip check` exécuté.
Image PI locale construite depuis base Python3.12.13 par digest ; code inchangé.
Les licences commerciales/notices finales/SBOM applicatif restent T09/N3.

PG max_connections100. Budget prévu : tenants16, centrale8, KC4, PI2, Inngest4,
migrations2, réserve20 =56, inférieur80. Ce budget n’est pas une preuve G05.
Pools API/tenants absents à T00 ; limites correspondantes à établir T02/T06.
ACL PUBLIC CONNECT/TEMP retirées sur toutes DB techniques, rôles séparés
NOSUPERUSER/NOCREATEDB/NOCREATEROLE. DB créées ALLOW_CONNECTIONS false avant ACL,
puis ouvertes pour upstream. Aucune DB agence créée avant T06.

## Commandes
- `bash scripts/worktree-setup.sh --synthetic` : acquisition vérifiée, secrets propres,
  validation ressource/environnement, Compose/build offline PI, six healthchecks.
- `bash scripts/worktree-setup.sh --check` : validation sans mutation avant commandes.
- `bash scripts/worktree-test.sh --unit|--integration|--auth|--contracts|--e2e|--build` :
  exit1 explicite tant que suites T01/T02 absentes. Aucun PASS applicatif déduit.
- `bash scripts/worktree-dev.sh` : exit1 avant package app T01 ; services via setup.
- `bash scripts/worktree-down.sh` : stop seulement ce projet identifié ; volumes,
  DB, journal et clés conservés. Aucun down-v, prune, DROP ou effacement.

Setup rejouable ; perte du tmpfs/ref incohérente/collision ferme la reprise,
aucune génération de clé remplaçant aveuglément les DB conservées.
Certificats synthétiques7j : expiration ferme TLS, renouvellement explicite requis.
Schéma PI : initialisation seulement si vide, upgrade sur schéma existant,
état partiel refusé, canari clé vérifié ; aucune avance Alembic fictive au restart.
Sujet owner synthétique explicite réservé00000000-0000-4000-8000-000000000001 ;
bootstrap natif privé/authentication strong à construire T04. Toutes routes publiques
sauf health503 ; flows deny REQUIRED temporaires, remplacés par MFA qualifié T04.
T00 ne qualifie ni enrôlement/password/secours/LOA2 ni TLS provider/anti-rejeu.

## Preuves
`evidence/t00-checks.json` : commandes réelles, codes/durées, santé des services,
TLS vérifié200/503, ACL/rôles, clés inchangées à stop/restart, suites absentes refusées.
Findings reviewer T00 : stamp PI au restart, health Inngest absent, env cible non
comparé — corrigés et revalidés indépendamment PASS.
Aucun fait nouveau invalidant Research/Design/Plan constaté ; leur contenu préservé.

Verdict final T00 PASS, revue indépendante /root/s01_environment_review. Execute/Verify/Review applicatifs non commencés.

## Ajustement N2 T04 — en qualification, aucun PASS MFA
Gunicorn23 forwarder_headers ne produit pas REMOTE_USER WSGI : preuve indépendante
parser+WSGI réelle, HTTP_REMOTE_USER uniquement. Transport fournisseur NGINX+uWSGI
non modifié retenu ; uWSGI2.0.31 source SHA256 figée, build offline dans image Python
3.12.13-bookworm par digest, profil minimal Python/corerouter/http/SSL et deux threads
de compilation. Runtime PI reste3.14 et sa factory native.
Keycloak26.8 execute-actions-email génère/signe le lien puis envoie et renvoie204
sans URL ; pas d'API native de lien seul. Fixture Mailpit1.31.4 par digest, licenceMIT,
réseau Docker privé uniquement, aucun port hôte/relais/service externe, destinataires
limités example.invalid, stockage tmpfs/logsDocker none. Usage N2 identité synthétique
seulement, aucune boîte/connexion mail agence ni envoi immobilier.
Plan116 interdit une infrastructure externe obligatoire ; Design25–33 et mission
autorisent les services locaux synthétiques nécessaires. Interprétation relue
indépendamment, aucun choix MFA remplacé. TLS/credentials/grant absolu/racine/J1 et
chemin natif restent à qualifier ; aucune conformité production déduite.

## Runtime T04 partiel actuel
Profil identity-runtime : coordinateur HTTPS privé4001, huitième service, leaf
mTLS seul et coorPG, aucun secret admin/PI ENCKEY. Public localhost expose seulement
le candidat PI sous grant ; 127.0.0.1 métier/Keycloak fermé503. Firefox isolé/NSS
CA propre et outil oath figé réservés aux tests. Premier OTP qualifié partiellement,
parcours complet et stabilité navigateur non acquis ; aucune session forte/ACTIVE.

### Réconciliation au 2026-10-12
Le montage runtime expose le realm Keycloak `dossiercle` uniquement sur issuer
`https://127.0.0.1:<port>` via l’ingress TLS ; realm étranger, admin, racine métier
et host `localhost` pour ce realm restent fermés. L’origine `localhost` expose l’UI
PI et coordinateur sous grant. Les POST natifs `login-actions/required-action` sont
refusés au proxy jusqu’à un pont grant-aware qui vérifie J1 sous verrou. Le
coordinateur a été reconstruit/redémarré ; contrôles réels navigateur routes et
issuer/callback 2/2 PASS, variantes POST bloquées en 400/403, cookie grant Lax observé. Le TOTP frais échoue encore
avant callback ; T04 reste BLOCKED. Ces ajustements synthétiques ne changent ni
l’architecture validée, ni T00 PASS.
