# Revue indépendante — gate supports/proxy/lock B12

2026-10-11. Reviewer auth_tooling_temporal, distinct du builder infra_architecture ; lecture seule, aucun GET ni exécution parallèle.

## Verdict

**PASS limité à l'action `phase-a.py lock` sous scope effectif 1 CPU / 2 GiB : qualification de version sans auto-résolution, puis résolution lockfile-only.** Aucun Critical/Major/Minor nécessitant une correction avant cette action. Builder informé directement. Ce gate n'autorise aucune installation workspace, lifecycle, application, gros asset ou runtime ; il ne prouve pas encore zéro conflit peer/engine, deux installs frozen ou B12 PASS.

Gel `/tmp/dossiercle-b12-resolution-manifest.json`, empreinte déclarée `8f259d05a15bb921ce2e92d574ab3ff95d8c6d2dc2ad06bd22aa697a44cecf0c` ; 25 hashes conformes.

## Constats

- Versions structurantes Q4 inchangées. Supports exacts disponibles : rxjs 7.8.2, reflect-metadata 0.2.2, @types/node 24.19.2, @types/react et react-dom 19.3.0, @types/pg 8.23.1, @types/express 5.0.6, @types/qs 6.15.1. Chaque fichier exact correspond au nom/version/SRI du manifeste. Licences MIT ou Apache-2.0 déclarées ; la preuve licence/transitive finale reste SBOM/scans future.
- rxjs et reflect-metadata satisfont les plages documentaires Nest ; @types/react-dom peer ^19.3.0 est satisfait par types React 19.3.0. @better-auth/core 1.7.7 / utils 0.4.2, OTel core 2.11.0 et Zod 4.5.4 restent figés. La compatibilité du graphe résolu demeure un objectif de cette action, pas une conclusion préalable.
- Native pnpm affiche 12.8.1 / exit 0 dans le log précédent, avec warning d'auto-résolution sur le proxy local éteint ; cette preuve n'est pas renommée en qualification silencieuse. La configuration managePackageManagerVersions false est désormais fixée en workspace/npmrc/CLI. CHANGELOG officiel acquis documente le paramètre ; aucune source/lifecycle wrapper n'est exécutée.
- Avant lock, le launcher lance --version avec le proxy actif et impose sortie uniquement 12.8.1 ET nombre d'événements HTTP inchangé. Tout warning, acquisition de package-manager ou autre sortie bloque ce gate fonctionnel avant lock ; aucun fallback. Ceci doit être prouvé par logs et ledger résultat.
- Le lock command utilise lockfile-only, ignore-scripts, strict-peer-dependencies, engine-strict, auto-install-peers=false, fetch-retries=0 et manage-package-manager-versions=false. Versions directes exactes, aucun override ni latest. Les six manifests workspace vides n'introduisent pas encore de code/lifecycle.
- Proxy loopback vers registre npm uniquement ; tarballs/adresses externes et specs Git/file/link/URL sont refusés avant usage. Metadata est réécrite vers le compteur proxy. Writer ledger unique, watchdog idle, limites/délais initiaux et compteur physique+corps restent en place. La politique stricte peut aussi refuser une spec ancienne présente dans un packument non sélectionné : si cela arrive, conserver le fait précis sans le transformer en conflit du candidat sélectionné.
- Lock résultat doit figer transitifs exacts/integrities avant acquisition explicite de leurs tarballs. Résolution n'est ni installation frozen ni preuve de builds : ces étapes garderont un gate séparé.
- Supports reçus et cumul de corps documentés ; baseline/réserve 100 Mo/historique/début 08:53:36 / deadline 10:53:36 inchangés. Le solde du gel est 1 808 742 061, à surveiller suivant RX courant ; aucun reset ou emprunt B07. Recherche supports 6 097 609 octets sous plafond 20 Mo autorisé ; futures métadonnées de résolution restent imputées au budget réseau B12.

## Arrêts et résultats attendus

Tout conflit engine/peer réel, scripts non approuvés, egress imprévu ou quota atteint déclenche arrêt Q4 intégral ; pas de modification de versions/overrides pour obtenir un lock. Un simple échec de chemin/configuration garde sa qualification fonctionnelle distincte et nécessite analyse ciblée. Publier commande, exit, sortie version sans warning, lock/hash et métriques/ledger ; aucune réussite non exécutée annoncée.
