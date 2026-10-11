# Préflight hôte — B07-P-1 / B12-P-1

Observation en lecture seule. La partition du projet et /tmp sont identiques. Node 22.23.1, npm 10.9.8 et pnpm 12.4.1 globaux inchangés ; Docker daemon 28.0.1 disponible. PostgreSQL local non installé. Aucun outil/runtime téléchargé, aucune image/container/volume créé, aucun nettoyage d’élément existant.

```json
{
  "observed_at_utc": "2026-10-10T22:20:19.401900+00:00",
  "cpu_logical": 12,
  "mem_available_bytes": 19790168064,
  "disk_free_bytes": 2977042432,
  "disk_cap_bytes": 16106127360,
  "disk_preflight": "BLOCKED",
  "downloads_runtime_bytes": 0,
  "new_runtime_resources": 0
}
```

Verdict : **BLOCKED** avant installation. Espace libre inférieur au plafond temporaire validé de 15 Gio ; impossible de réserver cette capacité. /dev/shm a de la place mais consomme RAM et ne fournit pas cette capacité tout en respectant le plafond mémoire 8 Gio. Aucun changement de cible ou réduction implicite de quota.

Commandes : `df -B1 /home/issa/Workspace/perso/worktrees /tmp /dev/shm`, `docker version --format {{.Server.Version}}`, `docker system df --format {{json .}}`, versions Node/npm/pnpm et lecture /proc/meminfo. Les volumes/images préexistants, même indiqués reclaimable, ne sont pas autorisés à être supprimés.

Reprise : au moins 15 Gio disponibles sur la partition cible, ou emplacement distinct fourni et vérifié ; reprendre le préflight et vérifier marges, quotas et provenance avant toute installation.
