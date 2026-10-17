# Worktree Setup 0b — #74 / S01 T06

## État

`SETUP PASS` — setup froid synthétique terminé et revu indépendamment le 2026-10-16 dans
`worktrees/74-s01-t06`, identité `s01-71b427155a21`. L’étape 0a est PASS et sa
revue indépendante précède le premier `--synthetic`. Les profils T06 restent
inactifs ; aucun worker, saga ou test d’agence n’a été lancé.

## Preuves minimisées

- `bash scripts/worktree-setup.sh --check` : PASS sur le worktree et la
  configuration Compose réelle. Le checker valide les mounts absolus, modes,
  destinations, sources sensibles et réseau privé ; aucun secret n’est publié.
- Setup froid : installation pnpm `--frozen-lockfile --ignore-scripts`, Firefox
  privé et build d’image privacyIDEA : terminés. Versions locales rapportées par
  le setup : Node `v24.21.0`, pnpm `12.8.1`, Firefox Playwright `157.0`.
- Docker Compose : services `postgres`, `redis`, `keycloak`, `privacyidea`,
  `inngest`, `ingress` et `mailpit` sains. Liste observée des services actifs :
  `ingress`, `inngest`, `keycloak`, `mailpit`, `postgres`, `privacyidea`, `redis`.
  `t06-provisioner` et `t06-orchestrator` absents de cette liste.
- Build des packages contracts/domain/adapters/testing : PASS (TypeScript).
- Migration centrale conservée : `schemaVersion=1`, checksum
  `9f0dc36dc01ac75df76e23250452f299c4a649f03e6bd6e38c976325c6cb955a`.
- `s01-t05-capabilities.mjs --check` : PASS, rôle T05, memberships et ACL
  observés. Configuration synthétique Keycloak/privacyIDEA appliquée ; sorties
  explicites indiquent que MFA n’est pas qualifiée et que l’accès métier reste fermé.
- PostgreSQL réel : `provisioner` est LOGIN non-superuser, sans CREATEDB,
  CREATEROLE ou CONNECT à `postgres`; `provisioner_ddl` est LOGIN non-superuser,
  CREATEDB/CREATEROLE, CONNECT à `postgres`, sans CONNECT à `control`. Les rôles
  `control_api` et `control_coordinator` ne sont ni superuser ni créateurs et
  n’ont pas CONNECT à `postgres`.
- Budget de setup affiché : `56/100`, réserve incluse ; la limite de Design
  `80/100` est respectée par cette configuration.

## Échecs conservés et reprise

Les deux premiers appels de setup se sont arrêtés avant tout démarrage de service :
le premier révélait l’objet `networks` sérialisé par Compose, le suivant une
initialisation `root/private` manquante dans le préflight Python. Après correction,
le `--check` réel et le setup complet passent sans réinitialiser l’identité ni les
clés retenues. Aucun journal brut n’est inclus dans cet artefact.

## Limites

Cette étape ne qualifie pas les certificats mTLS T06 par échange réel, les
credentials DDL depuis le conteneur provisioner, les pools, le routeur tenant,
la migration0004, Inngest T06 ou les AC runtime. Les profils T06 restent arrêtés.
Le setup fournit seulement l’environnement et le socle T00–T05 froid.

Verdict : **PASS Worktree Setup**, [revue indépendante](setup-review.md).
Execute métier peut commencer ; aucune agence n’a été créée par cette étape.


## Actualisation Execute — 2026-10-16

La migration centrale additive0004 a été appliquée hors ligne après fermeture de
l’ingress et arrêt des profils applicatifs ; checksum courant
`5397766a1c5df8b52167e3c6a26cbc2940b134b41b0e40c289c37befefceffb4`. Le script
`python3 scripts/s01-t06-environment-check.py infra/local/compose.yaml` vérifie la
configuration Compose normalisée en lecture seule : PASS. Ses 14 tests de frontière
de mounts passent, sans démarrer de service. La preuve historique de Setup ci-dessus
reste telle qu’observée à l’étape0b ; les tests DDL synthétiques ciblés sont consignés
dans execute.md, et les profils T06 applicatifs restent arrêtés.
