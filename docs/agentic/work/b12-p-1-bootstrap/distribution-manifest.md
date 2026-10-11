# Manifeste de distribution B12 — proposé avant téléchargement

2026-10-11. **APPROVAL: PARTIAL — sources Node/npm/GitHub couvertes, nouveaux hosts navigateur/DB pending ; aucun runtime téléchargé.** Architecture et Execute B12 BLOCKED. Hôte Ubuntu24.04 x86_64 ; choix locaux candidats, pas choix production. D69 fixe 2 000 000 000 octets cumulés B12, zéro dépense externe, 2 h/phase et 8 h total, 4 CPU/8 Gio/15 Gio. Pas de remise à zéro des compteurs.

## Métadonnées et budget

Recherche primaire présente : 1734068 octets de corps HTTP sur plafond 5 000 000, HEAD sans corps ; en-têtes/TLS/IP non mesurés. Ancienne recherche versions 568 200 octets déjà imputée à B12. Cumul mesuré des corps HTTP B12 = 2302268, solde théorique des corps 1 997 697 732 octets, avant nouvelles métadonnées/runtime. Ne pas appliquer ces octets nouveaux à B07 sans coordination du ledger commun. Résultats : [JSON sources](evidence/distribution-research.json), [assets exacts](evidence/distribution-assets.json), [HEAD](evidence/distribution-head.json). Hashes des réponses ≠ hashes des binaires. HEAD constate URL finale/taille, aucun GET du binaire. URLs GitHub finales sont signées/éphémères : approuver chemin d’objet et host de redirection, jamais une wildcard couvrant toutes releases.

## Binaires exacts candidats Linux amd64

Décompresser dans `.poc-b12/tools`, jamais /usr/bin ni profil shell global ; aucun script curl-pipe-shell. Vérifier SHA-256 après GET approuvé et signature/checksum éditeur lorsque publié. Metadata digest est déclaration primaire, pas preuve du contenu reçu.

| Outil | URL initiale exacte | Taille déclarée | SHA-256 publié |
|---|---|---:|---|
| collector | [otelcol-contrib_0.162.0_linux_amd64.tar.gz](https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v0.162.0/otelcol-contrib_0.162.0_linux_amd64.tar.gz) | 112285869 | `sha256:fcc063749f730f8c21fe29f2d340ff174f5f1c5885bd3156fb6c985a3036fcc3` |
| k6 | [k6-v2.3.0-linux-amd64.tar.gz](https://github.com/grafana/k6/releases/download/v2.3.0/k6-v2.3.0-linux-amd64.tar.gz) | 30847764 | `sha256:39c3117b6af817592dcd0ce4242105c0a7af10948c2a425306f0be8f7a8a8ab1` |
| oasdiff | [oasdiff_1.33.0_linux_amd64.tar.gz](https://github.com/oasdiff/oasdiff/releases/download/v1.33.0/oasdiff_1.33.0_linux_amd64.tar.gz) | 6822600 | `sha256:43a4e328e2d13ba1552d760aa68d2485c75c5621f309f6ff64ae895188345247` |
| syft | [syft_1.54.0_linux_amd64.tar.gz](https://github.com/anchore/syft/releases/download/v1.54.0/syft_1.54.0_linux_amd64.tar.gz) | 29217540 | `sha256:54a87372498168b2d033e876fd41fa4e8035b872699e525a57046e1f2f09c860` |
| gitleaks | [gitleaks_8.30.1_linux_x64.tar.gz](https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz) | 8230402 | `sha256:551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb` |
| trivy | [trivy_0.75.0_Linux-64bit.tar.gz](https://github.com/aquasecurity/trivy/releases/download/v0.75.0/trivy_0.75.0_Linux-64bit.tar.gz) | 51704231 | `sha256:c6e65abddb348e25f10549df887045629cf28cc72453cd1c63acb717316b3f3f` |

Six archives totalisent 239108406 octets. Ce total exclut SBOM/checksums/signatures, bases vulnérabilités, paquets npm, Node et navigateur ; ce n’est pas le coût de téléchargement total. Choix binaire Collector plutôt qu’image évite ajout d’un pull Collector ; ses dépendances restent scannées.

### Redirections finales observées HEAD — approbation requise

- `https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v0.162.0/otelcol-contrib_0.162.0_linux_amd64.tar.gz` → `https://release-assets.githubusercontent.com/github-production-release-asset/400253676/1bc777a0-70a4-4320-90c4-b88ae1e9054c` ; taille HEAD 112285869 ; corps reçu 0.
- `https://github.com/grafana/k6/releases/download/v2.3.0/k6-v2.3.0-linux-amd64.tar.gz` → `https://release-assets.githubusercontent.com/github-production-release-asset/54400687/076b374f-4660-44e6-b770-e05d267f0dbf` ; taille HEAD 30847764 ; corps reçu 0.
- `https://github.com/oasdiff/oasdiff/releases/download/v1.33.0/oasdiff_1.33.0_linux_amd64.tar.gz` → `https://release-assets.githubusercontent.com/github-production-release-asset/337689065/8fe2717d-a834-41e1-ba44-f82754a8a039` ; taille HEAD 6822600 ; corps reçu 0.
- `https://github.com/anchore/syft/releases/download/v1.54.0/syft_1.54.0_linux_amd64.tar.gz` → `https://release-assets.githubusercontent.com/github-production-release-asset/262126497/b32d1214-7de5-4415-9754-7b5762614f1f` ; taille HEAD 29217540 ; corps reçu 0.
- `https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz` → `https://release-assets.githubusercontent.com/github-production-release-asset/119190187/9297106e-8ecb-4665-b9f1-5ffe26dde9f5` ; taille HEAD 8230402 ; corps reçu 0.
- `https://github.com/aquasecurity/trivy/releases/download/v0.75.0/trivy_0.75.0_Linux-64bit.tar.gz` → `https://release-assets.githubusercontent.com/github-production-release-asset/180687624/6c28bd66-9da2-480e-bcbd-13389c45bc1f` ; taille HEAD 51704231 ; corps reçu 0.
- `https://cdn.playwright.dev/builds/cft/153.0.8010.12/linux64/chrome-linux64.zip` → `https://storage.googleapis.com/chrome-for-testing-public/153.0.8010.12/linux64/chrome-linux64.zip` ; taille HEAD 195836009 ; corps reçu 0.
- `https://cdn.playwright.dev/builds/cft/153.0.8010.12/linux64/chrome-headless-shell-linux64.zip` → `https://storage.googleapis.com/chrome-for-testing-public/153.0.8010.12/linux64/chrome-headless-shell-linux64.zip` ; taille HEAD 119809080 ; corps reçu 0.
- `https://cdn.playwright.dev/dbazure/download/playwright/builds/ffmpeg/1011/ffmpeg-linux.zip` → `https://playwright.download.prss.microsoft.com/dbazure/download/playwright/builds/ffmpeg/1011/ffmpeg-linux.zip` ; taille HEAD 2376500 ; corps reçu 0.

## Node, npm et fichiers de distribution

Node candidat : `https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-x64.tar.xz`, SHA256 `fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6` lu dans [SHASUMS256](evidence/node-shasums.metadata). Taille HEAD31 890 184 octets ; aucune signature Node vérifiée ici. Installer uniquement dans `.poc-b12/node`, PATH process-local. pnpm12.8.1 et versions directes Q4 : reprendre URLs `dist.tarball`/`dist.integrity` du [préflight versions](../arch-b02-b12/evidence/poc-version-preflight.md). Compléter les peers obligatoires exacts avant résolution, sans latest. La liste des transitifs n’existe pas encore : résoudre métadonnées sous quota, présenter manifest exact + scripts lifecycle avant installation. `pnpm install --ignore-scripts --frozen-lockfile` deux fois depuis lock identique ; tout lifecycle nécessaire exige allowlist préalable, pas `pnpm approve-builds` global implicite.

## PostgreSQL déjà en cache — aucune intervention sur asset utilisateur

Candidat `postgres:17.11-bookworm`, RepoDigest `postgres@sha256:051f7b7b3abdd564d5d1bd1e8c4b9c1b6e77087d1dd22020ede611c096a272e0`, ID local `sha256:a2ea0e68c465e0acf4c3672471b22b6b62972bb341e6f31544c855d85ba43745`. Parent a inspecté image ; digest registry/source exacte et SBOM/advisories restent à vérifier avant réutilisation. Interdire pull automatique (`--pull=never`), pas de tag `postgres:17`. Faire tourner un container **nouveau** exclusivement B12, réseau privé B12 sans Internet, trois DB auth/agency_a/agency_b, roles runtime dédiés et aucun rôle superuser dans API. Préserver intégralement `factory-backend-db-1`, autres containers/images/volumes. Aucun prune ou rmi de cette image préexistante lors nettoyage.

## Chromium/FFmpeg — cache candidat puis distribution autorisée

Source officielle Playwright `v1.63.0` [browsers.json](evidence/playwright-browsers.metadata) et [registry](evidence/playwright-registry.metadata) : chromium/headless revision1243, Chrome153.0.8010.12, ffmpeg1011. Chromium1243 et ffmpeg1011 signalés en cache par parent ; leur origine, hashes installés et version exécutable doivent être prouvés avant réutilisation. Headless1234 ne correspond pas1243. Ne pas lancer de navigateur pour cette préparation, ni modifier le cache utilisateur.

Distributions proposées : Chrome linux64 ZIP 195 836 009 octets ; headless ZIP 119 809 080 ; ffmpeg ZIP 2 376 500, HEAD ci-dessus. URLs finales `storage.googleapis.com/chrome-for-testing-public/153.0.8010.12/linux64/…` et `playwright.download.prss.microsoft.com/.../1011/...`. Digests de ces ZIP non publiés dans browsers.json : provenance officielle + taille + hash du GET à consigner ; reviewer doit accepter cette politique ou exiger checksum primaire avant téléchargement. Un hash calculé après GET seul n’authentifie pas la distribution. Chromium minimal headed possible en headless mode de Chrome complet seulement si tests Playwright compatibles, sans omettre le gate navigateur.

## Bases de scanner — reste à résoudre, aucun téléchargement approuvé

Trivy0.75.0 : proposer DB OCI `ghcr.io/aquasecurity/trivy-db:2`, base Java seulement si SBOM contient Java et gate justifie besoin. Avant tout fetch : vérifier source Trivy au tag, résoudre manifest OCI et digest immutable, tailles blobs et redirections registry/blobs, enregistrer freshness/schema, présenter URLs exactes. Ne pas supposer tag mutable stable, ni autoriser `ghcr.io/**`. Alternative cache valide scoped avec provenance/freshness attestées. Le volet scanner demeure BLOCKED sans DB qualifiée, jamais `--skip-db-update` sur cache inconnu présenté PASS. Audit JS/SBOM utilise sources exactes datées ou registre approuvé en étape acquisition, puis scanners runtime hors réseau avec caches qualifiés.

Gitleaks sans DB réseau ; Syft catalogue local ; oasdiff local ; k6 ne cible que le service API B12 sur réseau Docker internal. Licences exactes/outils AGPL k6 séparés des artefacts produit et avis Q4 à revalider au gel. Collector Prometheus transitive >=0.311.3 à prouver via SBOM, composants non allowlistés restent non configurés.

## Conditions de téléchargement

Approbation d’un manifeste distribs final par l’orchestrateur/propriétaire conformément à D69 ; aucune approbation des hosts manquants déduite du mandat général. Chaque GET est interruptible et compté cumulativement, redirections nouvelle cible = arrêt avant corps. Capture inventory avant/après et quotas mesurés ; aucune taille estimée inventée. Aucun runtime Internet, cloud, e-mail/IA externe ou données réelles.

## Complément final — HEAD Node et DB Trivy

Node archive HEAD : 31 890 184 octets, URL finale identique Node officiel ; [preuve](evidence/node-distribution-head.json). Sources Node/npm et six outils GitHub exacts entrent dans allowlist initiale ; approbation/revue des objets exacts et redirections officielles suffit, pas nouvelle demande de budget ou consentement par archive. Les demandes restantes concernent les nouveaux hosts navigateur et DB.

DB Trivy2 proposée immutable : ghcr.io/aquasecurity/trivy-db@sha256:5393bc6f744928502de96983ed97b46f06f84e718a33169dce616fe304c8024a. Blob db.tar.gz SHA256420fae4c53cae2a53073aca5d7db527a192d5df38c8cf487000984033524b987, 126 923 263 octets ; HEAD final même ghcr.io/v2/aquasecurity/trivy-db/blobs/sha256:420fae4c53cae2a53073aca5d7db527a192d5df38c8cf487000984033524b987, aucun corps reçu. Création manifeste2026-10-11T07:12:30Z, freshness à vérifier aussi dans metadata.json après extraction. [Manifest/source/provenance](evidence/trivy-db-distribution.json), [source Trivy au tag0.75.0](evidence/trivy-db-source.metadata). Token GHCR anonymous pull requête metadata comptée, valeur non sauvegardée/loggée. Ne pas confondre tag2 mutable et digest ; aucune autre mirror GCR, JavaDB ou checks bundle téléchargée implicitement. Pour ce scan vulnérabilité SBOM/OS/JS, désactiver téléchargement de checks non nécessaires sans supprimer le gate Gitleaks/licences ; tout besoin supplémentaire impose source/digest/taille/compteur préalable.

Total recherche présent1 734 068 octets, plafond5Mo initial respecté (extension20Mo permise parent inutile à cette observation). B12 cumul historique+présent2 302 268, solde théorique des corps 1 997 697 732. Binaires6 + Node + Chromium complet + headless + FFmpeg + DB = 715 943 442 octets déclarés ; npm/transitifs/provenance/checksums/SBOM/signatures restent hors ce sous-total. Réutiliser cache qualifié peut réduire trafic, jamais modifier budget approuvé.

Préflight cache complémentaire parent : Chromium1243 marqueurs INSTALLATION_COMPLETE/DEPENDENCIES_VALIDATED présents, mais .links décrit seulement Playwright1.62.1/revision1234 de family-study-tracker. Origine1243 non confirmée : pas de cache réputé valide ni suppression/mutation ; soit provenance établie dans POC, soit distribution exacte approuvée téléchargée en cache B12 propre. Ne pas prendre markers comme preuve d’authenticité. Résolution npm/lock/build/PG/Collector/Chromium sont objectifs Execute avec arrêts sur incompatibilité ; leur absence avant installation ne bloque pas les phases de préparation.

### Ledger réseau retenu — BR01

Le cumul historique 2 302 268 octets est la somme mesurée des **corps HTTP seulement** ; TLS/IP/en-têtes/HEAD historiques ne sont pas mesurés rétroactivement. Réserver 100 000 000 octets dans le même budget de 2 000 000 000, pour transport/erreurs/inconnues ; aucune extension ni remise à zéro. Solde opérationnel initial au plus **1 897 697 732 octets**, inférieur au solde théorique des corps 1 997 697 732. Le sous-total des tailles de distributions ne constitue pas une mesure consommée.

Dès acquisition, conserver baseline et mesures de rx_bytes dans /sys/class/net des interfaces physiques actives, aujourd’hui wlp59s0 et interface physique Ethernet à surveiller si activation. Exclure lo, docker0, bridges et veth pour éviter double compte Docker. La somme des deltas inclut conservativement le trafic utilisateur sans l’inspecter ni le bloquer. Garder aussi compteur des corps/chunks HTTP, erreurs et retries reçus. Décompte conservateur futur = maximum(delta physique agrégé, nouveaux corps reçus) ; additionner une fois au cumul historique + réserve. Mesure interface ≠ mesure filaire exhaustive ; la réserve demeure. Si delta/compteur/tailles ou réserve atteignent le plafond : arrêt souverain avant nouveau chunk/download. Interface ajoutée/changement route/compteur remis à zéro ou indisponible : arrêter plutôt qu’omettre trafic. Baseline/ledger persistent entre phases, jamais reset ; transferts en cours restent interruptibles et margés par réserve.

### Cible k6 retenue — BR02

Runner et API sont deux containers distincts sur le réseau Docker internal créé pour B12. k6 cible uniquement http://b12-api:3000 par DNS de ce réseau ; ce n’est pas le 127.0.0.1 du runner. API bind interne 0.0.0.0:3000, publication éventuelle hôte uniquement127.0.0.1:3000. Aucun host-gateway, host networking, privileged ou fournisseur Internet. DNS/proxy hôte ne devient pas allowlist runtime. Smoke synthétique local Q4 conservé, mêmes cgroups agrégés.
