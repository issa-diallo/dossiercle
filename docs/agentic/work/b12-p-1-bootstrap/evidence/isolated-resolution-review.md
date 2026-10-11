# Revue indépendante — résolution isolée B12

2026-10-11. Reviewer auth_tooling_temporal, distinct du builder infra_architecture. Lecture seule des scripts/inputs ; aucun GET, container ou exécution par ce reviewer.

## Verdict

**PASS limité à la résolution metadata-only par resolve-isolated.py sous scope host 1 CPU / 2 GiB et container client 1 CPU / 2 GiB.** Aucun Critical/Major/Minor restant. Builder informé directement du PASS limité. Aucun lock réussi, absence de conflit engine/peer, install frozen ou PASS B12 n'est encore prouvé.

Empreinte finale uniquement : `/tmp/dossiercle-b12-isolated-resolution-manifest.json`,36 fichiers, SHA-256 `b8f4349d8f0457f5d29d4b904cf6a993a6f10f1def8939e1a7122cf7f0413edf`. Tous hashes conformes, y compris binaires Node/pnpm, sources/SRI et error/provenance existants. Le précédent gel 29 fichiers est remplacé par cet inventaire d'inputs complet, sans changement scripts entre ces gels.

## Contrôles

- Image cache ID exact, pull never, network none, read-only root, UID 1000, cap drop ALL, no-new-privileges, mémoire 2 GiB / swap 2 GiB, CPU 1, pids 128. Aucun entrypoint PG/app. Tools/scripts readonly ; mounts RW uniquement fixture/store/config/cache/state/pnpm-home de la tâche, pas user assets/docker socket/host-gateway. Inspect avant start vérifie image/user/label/network/quota/root ; rendu commande et inspect doivent être archivés comme preuves réelles.
- Client vérifie interfaces/routes loopback et ENETUNREACH sur adresse TEST-NET réservée 192.0.2.1, sans fournisseur réel. HTTP GET seulement loopback→socket Unix tâche→proxy host npm HTTPS ; pas CONNECT ni URL absolue ou forwarding arbitraire. Proxy metadata_only refuse archives avant audit. Le client ne peut ouvrir un chemin Git/custom externe par réseau ; son FS est borné aux mounts tâche et image readonly.
- Packuments bruts intégraux/hash/provenance et transformés sont conservés. Transformation ne modifie que dist.tarball npm→transport loopback ; versions/specs/refs historiques intactes. Aucune suppression pour forcer le graphe. Le refus jackspeak antérieur ne prouve pas une spec effectivement sélectionnée : le contexte brut de cet événement ancien n'est pas rétroactivement inventé.
- Audit après lock compare raw hashes/transformation, présence des versions réellement sélectionnées, sources npm/SRI, specs sélectionnées et chaque root pin exact. Références custom/git/file/link/workspace sélectionnées sont refusées ; archives/install attendent audit. Les importers workspace sont actuellement vides, hors root exact, pas de source locale introduite.
- pnpm --version doit donner 12.8.1 seule et zéro requêtes relais, puis lockfile-only/ignore-scripts/engine-strict/strict-peer/noautopeers/noretries ; aucun override ou fallback. Tout conflit réel engine/peer déclenche stop Q4.
- Host proxy1CPU/2GiB + client 1 CPU / 2 GiB = 2 CPU / 4 GiB, sous plafonds agrégés 4 CPU / 8 GiB. Proxy watchdog surveille timebox/RX/disque ; superviseur arrête client si ledger/worker s'arrête. Durées, baseline, réserve/cumuls restent initiaux ; reprise contextualisée tracée par décision root, archive jackspeak stop préservée. Cleanup ne cible que CID créé dont label/image sont vérifiés, aucune suppression globale.

## Mesure disque confirmée

Le guard et la prévalidation d'expansion additionnent ROOT + EVIDENCE (répertoires disjoints), incluant registry-raw/ledger/logs. Le champ fixture_disk_bytes couvre donc aussi les preuves de cette tâche. Aucun dépassement constaté. La remarque IR01 initialement communiquée provenait de la lecture de l'ancienne garde ; elle est retirée après relecture du candidat gelé actuel, sans changement du writer.

Les sorties confinement, refus egress, lock/audit et compteurs restent attendues. Cette revue n'installe ni runtime ni package, n'autorise pas les archives transitives, et ne ferme aucun des 11 critères Q4.
