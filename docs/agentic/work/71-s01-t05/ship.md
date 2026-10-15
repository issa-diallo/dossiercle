# Ship — #71 / S01 T05

`SHIP: IN_PROGRESS` — 2026-10-15. Livraison limitée à READY_FOR_HUMAN.

## Préconditions

- [x] Execute et Verify locaux PASS, huit AC prouvés.
- [x] Review finale indépendante PASS, M1 documentaire corrigé et revalidé.
- [x] Aucun Critical/Major/Minor ouvert.
- [ ] Goal SATISFIED : reste ACTIVE jusqu’aux contrôles de livraison restants.

## Git et PR

- Branche : `feat/71-s01-t05`, worktree dédié conservé.
- Base après fetch origin/main : `71c4536981aa61656b3b7ad0df42ed9c14facd00`, inchangée.
- Commit/PR : en préparation, à renseigner après création ; aucun force push.
- Objectif unique : preuve owner/invitation/grant/claim et création durable T05.
- Exception de taille documentée dans le Plan et la description PR : contrats,
  auth/J1, SQL/ACL, Setup, services/API, tests natifs et preuves sont couplés ; les
  séparer livrerait une route sans sa barrière ou une capacité sans ses tests.
- Un commit logique final par squash humain envisagé, aucune fusion automatique.

## Preuves et CI

Build0,unit87,contrats6,PG110,navigateur13 PASS locaux ; voir Verify et evidence.
CI distante non lancée à ce checkpoint, URL et SHA à renseigner après push/PR.
Lead Tech indépendant du premier reviewer à déléguer par l’orchestrateur sur la
base/tête exactes et leur CI, puis ultime attestation hors diff après dernier commit.

## Environnement, rollback et gate humain

Aucune migration0001–0003 modifiée ; configuration synthétique publique seule pour
clé owner, données/J1/clés/fixtures retenus. Aucun déploiement, activation ACTIVE,
provisioner/cloud/mail applicatif ou cleanup. Rollback éventuel : revert de code
sur instruction humaine, jamais restauration d’une ancienne autorité/J1.

Fusion : non autorisée, instruction humaine T05 applicable nécessaire. Aucune
suppression de worktree, branche, base, clé, journal ou fixture prévue/exécutée.
Verdict : **IN_PROGRESS**, pas READY_FOR_HUMAN tant que CI/Lead Tech manquants.


## Contrôles avant premier commit

Staging explicite :87 fichiers liés à71, préparation préexistante comprise et
conservée ; dépassement87 fichiers/~5,8k lignes expliqué par le périmètre couplé.
Scans index et worktree466 fichiers/291 représentations privées/0match ; diff et
cached diff-check PASS ;152 cibles locales Markdown existantes vérifiées (contrôle
existence des fichiers, pas validation exhaustive des ancres) ; agentic presence PASS.
Une ligne vide EOF du helper privé fixture a été retirée après premier cached
check ; aucun cas/comportement modifié. Ce helper n’est pas parmi les huit hashes
sources de evidence, tous recontrôlés identiques ; migrations quatre chemins intactes.
