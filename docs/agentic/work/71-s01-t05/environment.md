# Worktree Setup — #71 / S01 T05

2026-10-15. **Setup PASS indépendant —0a/0b ; Critical0/Major0/Minor0.**
Implementer unique `/root/implementer`, orchestrateur `/root`. Pas Execute métier.
Base `71c4536981aa61656b3b7ad0df42ed9c14facd00`, branche `feat/71-s01-t05`.
La revue0a favorable est [consignée avant lancement](setup-0a-review.md).

## Environnement synthétique conservé

| Élément | État observé |
|---|---|
| Racine | `/home/issa/Workspace/perso/dossiercle/worktrees/71-s01-t05` ; vrai worktree lié et couple autorisé |
| Namespace Compose | `s01-a4378060f7db`, indépendant de T04 |
| Propriétaire | UID1000 ; `.local`0700, environment/compose.env0600, private0700, synthetic marker0400 |
| Exposition | TLS `https://localhost:42867`, PostgreSQL `127.0.0.1:60521` ; aucun port métier externe |
| Secrets | tmpfs `/dev/shm/s01-a4378060f7db`, propres à ce worktree ; aucune copie T04 |
| Identité owner | Ed25519 OpenSSL frais avant Node ; privée0400 non montée ; publique0400 montée RO seule et empreinte attendue vérifiée dans le coordinateur T04 sain |
| État durable | `.local/data_pg` et `.local/journal` propres et conservés ; aucune suppression ni restauration DB/J1/clés |
| Outils | Node24.21.0, pnpm12.8.1, artefacts/lock vérifiés par manifest ; install frozen sans scripts lifecycle |
| PostgreSQL | 17.9 ; schemaVersion1, checksum `9f0dc36dc01ac75df76e23250452f299c4a649f03e6bd6e38c976325c6cb955a` |
| Services sains | postgres, redis, keycloak, privacyidea, inngest, ingress, mailpit, identity-coordinator existant T04 |
| Capacité mesurée | Après setup :24G disque et16G tmpfs disponibles ; pas de cleanup ; budget de connexions synthétique configuré56/100 |

Les versions/images restent épinglées dans `infra/local/versions.json` ; valeurs
observées, empreinte publique, hashes immuables0001–0003 et résultats structurés
dans [setup-0b-evidence.json](setup-0b-evidence.json). L’empreinte est publique ;
aucune clé, credential, cookie ou raw token dans cet artefact.

## Exécution et échec conservé

1. `bash scripts/worktree-setup.sh --synthetic` : **FAIL1 initial réel**, après
   services sains, install/build packages et migration/grants réussis. Le script
   T05 importait `pg` depuis scripts/, où pnpm strict ne le déclare pas.
2. Correction minimale de `s01-t05-capabilities.mjs` : `createRequire` ancré au
   package adapters, propriétaire de la dépendance. Même résolution utilisée par
   le test PG. Aucun changement de dépendance/version/lock.
3. `--check` retenu et `s01-t05-capabilities.mjs --check` : **PASS**, avant reprise.
4. `bash scripts/worktree-setup.sh --synthetic` retenu : **PASS0** ; mêmes clés,
   namespace et données ; bootstrap natif Keycloak/privacyIDEA configuré.
5. `pnpm build:api` : **PASS0**. Profil `identity-runtime` existant démarré et sain,
   afin de vérifier le montage public effectif. Aucun endpoint métier T05 ajouté.

Journaux complets privés0600 sous `.local/setup-0b*.log`, ignorés par Git ; ils
restent locaux. Le premier échec n’est ni effacé ni présenté comme PASS.
Le scanner existant a été étendu à la clé owner PEM et propose `--worktree` pour
inclure le delta non committé ; le mode index reste le défaut pour CI/Ship.

## Preuves réellement exécutées

| Vérification | Résultat et limites |
|---|---|
| Garde worktrees Git réels | PASS23 cas ;15 cas initiaux conservés |
| Métadonnées privées | PASS29 cas réels ;5 UID étrangers simulés séparément |
| Clés/absence/modes/mounts | PASS21 cas ;20 cas initiaux conservés ; fixture tmpfs de test uniquement |
| Frontière SQL simulée sous Node24 | PASS16 cas ; aucune sémantique PG déduite de ce test |
| PostgreSQL réel | PASS41 cas : rôle/membership/ACL exactes, SET exclusif coordinator, capacités minimales par colonnes, defaults fermés, refus authority/session/DDL/ACTIVE/locator/audit/outbox/UPDATE idem/DELETE ; toutes écritures de fixture annulées par ROLLBACK |
| Clé OpenSSL / Node24 crypto | PASS signature/vérification native en mémoire, mauvais payload refusé, fingerprint et pairage vérifiés |
| Mount Docker effectif | PASS public RO unique, aucun mount privée/ancêtre ; clé publique lisible et fingerprint concordante dans coordinator sain |
| Native transport | PASS TLS ; mauvaise CA/hostname, HTTP, origine étrangère et redirects refusés |
| `--check`, build packages/API | PASS0 ; lock et migrations conservés ; build API existante T04, pas fonctionnalités T05 |
| Secrets | PASS index402 fichiers et worktree429 fichiers,279 représentations privées,0 match ; scan final incluant cet artefact et le delta non committé |
| Whitespace | `git diff --check` PASS |

## Commandes de reproduction

Depuis ce worktree avec `PATH="$PWD/.local/node/bin:$PWD/.local/pnpm-native/package:$PATH"` :

```sh
bash scripts/worktree-setup.sh --check
node scripts/s01-t05-capabilities.mjs --check
node scripts/s01-owner-key-interop-test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 scripts/s01-t05-environment-check.py
python3 scripts/s01-bootstrap-transport-check.py
python3 scripts/s01-secret-scan.py --worktree
```

Ces commandes vérifient l’état sans changer les ressources. Le test
`node scripts/s01-t05-postgres-test.mjs` crée ses fixtures dans une transaction
ROLLBACK ; preuve et source sont disponibles au reviewer, aucune ligne conservée.
Les suites déterministes0a peuvent être relancées dans leurs worktrees/tmpfs de test.
Ne pas relancer froid, supprimer des ressources, régénérer une clé ou modifier
DB/J1 pour une revue. `scripts/worktree-down.sh` est arrêt seul ; non exécuté.

## Limites et gate

Setup ne qualifie pas la MFA humaine/native ni les huit AC T05. Aucun test
navigateur fonctionnel, contrat T05, restauration du rôle par `writeAudit`, lock
multisujet, invitation/claim/création ou panne métier n’est revendiqué ici.
La restauration audit actuelle appartient à l’étape3 ; le test PG prouve seulement
la capacité SQL de switch audit puis restauration explicite T05.
Vite/frontend n’a pas été lancé ; coordinateur T04/TLS est sain. Build complet et
tests applicatifs/navigateurs restent Execute/Verify selon Plan, sans skip PASS.
Mailpit est seulement le service synthétique du socle ; aucun mail envoyé.

La revue Setup indépendante porte sur le delta0b, la correction import et ces
preuves. **PASS indépendant reçu ; [avis formel](environment-review.md). Execute autorisé.**
