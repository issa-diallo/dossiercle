# Worktree Setup 0a — #74 / S01 T06

## État

`0a PASS` — modifications de bootstrap revues indépendamment sur
`feat/74-s01-t06`, base `b18cd38b2c93234211c3c66bba654d63f297149c`.
Cette étape n’a créé aucun `.local`, secret, service, conteneur ou base dans le
worktree74. La revue indépendante PASS a été reçue avant le premier `--synthetic`.

## Delta

- `scripts/s01-worktree-identity-check.py` autorise exactement le couple
  `74-s01-t06` / `feat/74-s01-t06` ; les identités existantes et refus négatifs
  restent couvertes par le test Git temporaire.
- `scripts/worktree-setup.sh` prépare, uniquement pour un environnement froid,
  les répertoires T06 tmpfs dédiés, le rôle PG `provisioner_ddl` distinct et les
  certificats synthétiques privés mTLS. Le rôle DDL est non-superuser,
  CREATEDB/CREATEROLE, NOINHERIT ; il ne reçoit CONNECT que sur `postgres`.
  Les contrôles retenus exigent les chemins et modes existants ; ils ne régénèrent
  pas une identité ou un secret manquant.
- `infra/local/compose.yaml` ajoute deux services profilés `t06`, `restart: no`,
  réseau privé et sans port publié. Le provisioner seul a runtime/migration RW,
  secrets PG provisioner/DDL RO et J1 RO. L’orchestrateur n’a aucun de ces mounts.
  Le coordinator reçoit le même runtime T06 en RO. PostgreSQL ne reçoit que le
  bootstrap nécessaire, pas le répertoire `pg` contenant les autres credentials.
  Le socket Docker reste absent.
- `scripts/s01-t06-environment-check.py` et son test vérifient ces frontières de
  mounts avec une configuration synthétique en mémoire, sans Docker ni service.

## Vérifications réellement exécutées

| Vérification | Résultat |
|---|---|
| `PYTHONDONTWRITEBYTECODE=1 python3 scripts/s01-worktree-identity-test.py` | PASS, 24 cas avec vrais worktrees Git temporaires ; aucun service démarré |
| `PYTHONDONTWRITEBYTECODE=1 python3 scripts/s01-t06-environment-check-test.py` | PASS, 14 cas de frontières de capacité ; aucun service démarré |
| `bash -n scripts/worktree-setup.sh` | PASS |
| JSON parse `infra/local/compose.yaml` | PASS syntaxe JSON |
| `git diff --check` | PASS |

Un premier test du checker de mounts a révélé qu’il interdisait aussi la clé
mTLS propre de l’orchestrateur ; cette clé est nécessaire au canal privé et ne
confère aucune capacité coffre/DDL. Le contrôle a été corrigé pour interdire la
clé owner-signing et les mounts de credentials privilégiés. La suite complète a
ensuite passé.

## Limites et gate

Aucun setup synthétique réel n’a précédé la revue. Les revues indépendantes ont
trouvé des Major sur les mounts additionnels, les types non-bind ignorés et
l’exposition possible des credentials à d’autres services. Le checker exige
maintenant l’ensemble exact des chemins sources absolus, destinations et modes
du provisioner, de l’orchestrateur et du coordinator ; il contrôle globalement
l’affectation des sources sensibles aux services autorisés. Les tests rejettent
les parents `pg`/tmpfs privé, owner-signing, détournements runtime/migration,
mounts nommés/tmpfs inattendus, réseau `edge` et credential DDL dans
Keycloak/PostgreSQL. PostgreSQL garde seulement ses fichiers bootstrap et init
explicites. La revue finale indépendante est **PASS — Critical0/Major0/Minor0** ;
elle confirme l’allowlist PostgreSQL, celle du coordinator, l’affectation globale
des credentials, le refus des mounts non-bind/secrets/devices et le réseau exact
`private`.

Les profils de runtime T06 ne
sont pas démarrés. Certificats, droits PostgreSQL effectifs, mounts Docker et
budget de connexions restent à qualifier en 0b après revue favorable. Un rôle
DDL dédié est privilégié ; l’isolement effectif de son process et de ses
credentials reste à prouver avant toute saga T06.

Verdict de cette étape : **PASS**. Le verdict 0a ne
vaut pas Worktree Setup PASS ; Execute métier ne commence qu’après 0b et sa revue.
