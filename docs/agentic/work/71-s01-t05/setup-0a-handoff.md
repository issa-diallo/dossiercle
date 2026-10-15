# Handoff Worktree Setup0a — #71 / S01 T05

2026-10-15. Implementer `/root/implementer`, unique écrivain ; orchestrateur `/root`.
Base/HEAD `71c4536981aa61656b3b7ad0df42ed9c14facd00` ; branche
`feat/71-s01-t05`, racine `/home/issa/Workspace/perso/dossiercle/worktrees/71-s01-t05`.
**0a PASS après revalidation indépendante ; M1/M2 levés, Critical0/Major0/Minor0.**
0b est désormais exécutée ; le gate Setup complet attend sa revue indépendante.
Voir [environnement](environment.md) et [checkpoint](handoff-implementation.md). Aucun AC runtime PASS.

## Revalidation et périmètre

README, AGENTS, index/règles LARGE et règles déclenchées lus ; Research/Design/Plan,
revues, handoff, ADR030 et T05 du Plan S01 relus. Socle/HEAD concordent avec la
préparation. Skill secure-web-dev appliqué aux frontières secrets/SQL/bootstrap.
Les modifications de préparation présentes à l’entrée sont conservées : STATUS,
Design S01, ARCHITECTURE, ADR030 et dossier de préparation. Aucune migration0001–0003
modifiée. Pas de commit.

## Modifications0a

- `scripts/s01-worktree-identity-check.py` : préflight Python inline validant les chemins setup/checker avant chargement repo ; garde en lecture seule avant `cd`,
  acquisition, secrets ou Docker. Vérifie chemin lexical sans symlink, UID, branche
  exacte, vraie racine Git liée, common-dir, backlink et enregistrement Git.
  Couples legacy/T05 seuls, namespace `<repo>/worktrees/<nom>`, marqueur/racine/
  compose.env retenus concordants. Vérifie UID/type/modes exacts des répertoires
  et métadonnées privés avant lecture/écriture, sans réparation silencieuse. Refuse overrides Git qui redirigent l’identité.
- `scripts/worktree-setup.sh` : appelle cette garde pour les deux modes ; crée
  l’identité owner sur environnement frais avant installation Node ; vérifie
  paire/fingerprint/marqueur avant configuration Docker en retenu. Aucun ajout
  tardif de clé absente. Bootstrap SQL crée `control_t05` NOLOGIN sans pouvoirs,
  membership coordinator SET TRUE/INHERIT FALSE/ADMIN FALSE. Build packages puis
  entrypoint migrator compilé et contrôle ACL après migrations.
- `scripts/s01_owner_key.py` : génération Ed25519 OpenSSL, vérification SPKI/
  fingerprint/pairage, mode0400/UID et répertoire0700 tmpfs. Réinitialiser une
  identité existante échoue. Contrôle mounts interdit signer privé et ses ancêtres.
- `scripts/s01-coordinator-setup.py`, `infra/local/compose.yaml` : clé publique seule
  montée RO ; empreinte attendue dans configuration ; privée hors de tout mount.
- `packages/adapters/src/postgres/t05-capabilities.ts`,
  `scripts/s01-t05-capabilities.mjs`, `postgres/migrate.ts` : grants par colonnes
  du Design ; SELECT cinq tables, INSERT idem seul ; UPDATE invitation limité.
  Contrôle exact rôle/membership/ownership/ACL ; drift refusé, sans retrait masquant
  les droits inattendus. Appliqués dans transaction du migrator, pas credentials runtime.
- `.github/workflows/s01-t04.yml` : worktree legacy déplacé de RUNNER_TEMP vers
  `<checkout>/worktrees/s01-espace-isole`, afin de respecter la racine autorisée ;
  suites existantes conservées. Import capabilities source→`.js` impose le build
  packages avant migration froide ; entrypoint compilé existant réutilisé.

## Validation réellement exécutée

| Commande | Résultat / portée |
|---|---|
| `PYTHONDONTWRITEBYTECODE=1 python3 scripts/s01-worktree-identity-test.py` | PASS23 cas (15 initiaux conservés), vrais dépôts/worktrees temporaires ; deux couples positifs, detached/main/branche/couple erronés, symlink, sous-racine/main-root, override Git, UIDroot, état étranger, backlink et déplacement refusés |
| `PYTHONDONTWRITEBYTECODE=1 python3 scripts/s01-worktree-privacy-test.py` | PASS29 cas réels sur deux modes, permissions/type/métadonnées froides et retenues ; 5 UID étrangers simulés séparément |
| `PYTHONDONTWRITEBYTECODE=1 python3 scripts/s01-owner-key-test.py` | PASS21 cas (20 initiaux conservés), fixture tmpfs jetable propre au test ; signature/vérification OpenSSL réelle, absence/perte/droits/fingerprint, mounts dangereux refusés |
| `node --experimental-strip-types scripts/s01-t05-capabilities-test.mjs` | PASS16 cas frontière SQL simulée, grants/colonnes et drift rôle/membership/ACL ; PostgreSQL non démarré |
| `bash -n scripts/worktree-setup.sh` | PASS syntaxe shell |
| `PYTHONDONTWRITEBYTECODE=1 python3 scripts/s01-worktree-identity-check.py "$PWD"` | PASS identité réelle du worktree71, lecture seule |
| `git diff --check` | PASS whitespace diff suivi |

Un premier passage du test Git a révélé `GIT_PAGER` dans l’environnement du
harness ; cette variable de présentation et GIT_TERMINAL_PROMPT sont admises,
les overrides d’identité restent refusés. Suite complète relancée et réussie.
Les tests négatifs invoquent le script copié avec `--synthetic` uniquement sur
des identités rejetées avant son corps ; aucune acquisition, clé ou commande
Docker n’en résulte. Aucun `--synthetic` lancé sur une identité admissible.

## Retour de revue et corrections

La première revue indépendante a reçu CHANGES_REQUIRED/Major2 : inspection
lexicale trop tardive après abspath, et permissions/UID des métadonnées insuffisants.
Corrections et preuves ajoutées sans retirer les cas initiaux ; [historique de revue](setup-0a-review.md).
Préflight inline protège aussi le chargement du checker ; contrôles de modes
refusent la dérive en froid/retenu avant lecture/écriture. Revalidation indépendante PASS reçue avant0b ; M1/M2 levés par le reviewer.

## Limites et reprise

Aucun service, Docker, installation ou environnement `.local` de ce worktree
créé/lancé par0a. Les seules clés générées sont celles de la fixture tmpfs du test,
supprimée par son propriétaire à la fin du test. DB/J1/clés existantes non touchées.
Node hôte22.23.1 utilisé pour le test SQL sans dépendance ; Node24 figé et son
interopérabilité crypto restent à vérifier en0b. Pas de build/typecheck applicatif,
PG réel, contrat/navigateur ou preuve de permissions effectives à ce gate.

Après revue0a favorable seulement : setup synthétique froid complet, --check,
ACL positives/négatives PG17 et membership effectif, fingerprint/public mount
runtime/interop Node24, documentation `environment.md`, puis revue Setup.
Si clé/marqueur retenu perdu ou bootstrap partiel : refus et réconciliation
explicite, aucune régénération/restauration automatique.
