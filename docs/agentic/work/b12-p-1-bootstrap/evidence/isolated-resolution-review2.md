# Revue ciblée — relais isolé, candidat 2

2026-10-11. Reviewer indépendant auth_tooling_temporal ; lecture seule, aucun GET/installation/test parallèle.

**PASS limité au prochain essai metadata-only isolé du même gate.** 0 Critical/Major/Minor nécessitant correction avant cet essai. Builder informé directement. Gel `/tmp/dossiercle-b12-isolated-resolution-manifest2.json`, SHA-256 `f735e5e0f11fb6363be881180875951f2c48f53e2d20f323b75d47ee2115a9aa`,40 hashes conformes.

## Preuves de l'essai arrêté

Log réel : ENETUNREACH sur contrôle synthétique, pnpm 12.8.1 sans warning et ZERO_HTTP avant lock, puis 502 sur @opentelemetry/api et exit 1. L'inspect archivé confirme network none, root RO, CPU 1, RAM 2 GiB, nonprivileged et seulement mounts tâche readonly/RW attendus. Le container ancien dossiercle-b12-resolver-01 est absent à la lecture indépendante Docker inspect actuelle. La preuve ne démontre ni conflit engine/peer ni source externe acquise. Cause exacte 502 non journalisée : backlog/concurrence reste hypothèse.

Ledger reste RUNNING ; correction fonctionnelle autorisée root, aucun stop Q4 établi. Corps 107 429 565 / RX 153 294 415 donnent consommation 255 596 683 avec historique/réserve et solde 1 744 403 317. Baseline/débuts phase-total initiaux restent identiques. Solde à actualiser pendant reprise.

## Diff accepté

Agent Unix maxSockets 1 borne réellement les connexions upstream ; CLI network-concurrency 1 et store-dir=/work/store rendent les intentions explicites, acceptation runtime à constater. Logging UNIX_RELAY_ERROR code et REGISTRY_PROXY_ERROR type/path/reason bornés ajoutés ; aucun graphe/spec/pin modifié. Confinement network none/Unix/npm metadata-only, selected source/root/SRI audit et ignore-scripts/strict engine/peer restent intacts.

Logs/exit/inspect/command précédents seront renommés attempt1 avant relance ; destinations actuellement absentes, donc cet essai ne les écrase pas. Ancien CID n'est archivé que si Docker inspect ne trouve plus le container. Cette validation porte sur le prochain essai ; toute relance ultérieure devra conserver aussi ces archives sans réutiliser une destination déjà existante.

Aucun lock réussi, installation workspace, archives transitives, builds ou PASS B12 déduit. Tout conflit/stop Q4 réel impose arrêt intégral ; une nouvelle erreur fonctionnelle doit être conservée et analysée sans changement candidat implicite.
