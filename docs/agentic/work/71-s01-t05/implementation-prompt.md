# Prompt à transmettre à l’agent d’implémentation — #71 / T05

Copier le bloc ci-dessous dans une nouvelle session ayant accès au workspace.
Les artefacts de préparation sont dans le worktree indiqué, pas encore fusionnés.

```text
Implémente le ticket GitHub #71 de DossierClé : S01 T05 — Invitations propriétaire
et création durable. Utilise le worktree existant
/home/issa/Workspace/perso/dossiercle/worktrees/71-s01-t05,
branche feat/71-s01-t05. Vérifie son état Git et conserve les artefacts de
préparation présents ainsi que les changements utilisateur. Base de préparation :
71c4536981aa61656b3b7ad0df42ed9c14facd00, contenant T04 fusionné par #68.

Lis README, AGENTS.md et docs/agentic/README.md, puis les règles déclenchées.
Charge docs/agentic/work/71-s01-t05/{research,research-review,design,design-review,
plan,plan-review,handoff}.md et docs/adr/030-t05-invitation-preuve-transaction.md.
Research/Design/Plan PASS sont documentaires ; commence à Worktree Setup selon
étape0 du Plan, puis Execute quand son DoR réel est satisfait. Aucun PASS runtime
T05 n’est acquis. Si la base/les contraintes changent, confronte le delta avant
exécution ; ne recommence pas mécaniquement les gates déjà revus.

Réalise les étapes ordonnées du Plan et ses huit AC : setup portable isolé,
preuve owner signée avec clé privée uniquement CLI, capacité SQL control_t05
limitée et restauration du rôle audit, préverrous multisujets avant J1, réservation
durable puis import Keycloak réconciliable, issue/reissue/revoke, reçu callback lié
à la session forte et claim strict {} / {token}, transaction unique de création.
Conserve username==subjectId, REVOKED terminal, nouveaux epoch/PENDING et sessions
fermées avant réémission, aucun rawtoken dans GET/log/storage navigateur.
L’agence initiale est PROVISIONING, l’ADMIN et l’opération PENDING/ACCEPTED.
T06–T10, ACTIVE, IA/mail, facturation, réel/cloud et déploiement sont hors périmètre.
Préserve Keycloak/privacyIDEA natifs, J1 opposable et protections T04.

Agis comme orchestrateur : un implementer écrivain, reviewers indépendants,
jamais deux écrivains dans ce worktree. Respecte le profil LARGE et les contrats
de délégation du Plan. Corrige les findings bloquants avant le gate suivant.
Exécute vraiment les tests/build/contrats/PG/navigateur T04 et T05 de la matrice,
sans retrait de cas ni transformation d’échecs/skips en PASS. Preuves privées
sans secrets, rapports minimisés et limites SQL simulé/natif explicites.
Produis environment/review Setup, execute/handoff, verify, review et goal
d’implémentation dédiés ; goal.md existant concerne seulement la préparation.

Après Verify PASS et Review indépendante favorable, prépare une PR dédiée #71,
commits Gitmoji Unicode avec Fixes #71 et exception de taille justifiée. Obtiens
CI de tête PASS et examen Lead Tech indépendant sur base/tête finales ; après
commit des rapports, ultime attestation hors diff sans nouvelle boucle de commit.
Arrête à READY_FOR_HUMAN et fournis URL PR, SHA, preuves, findings/risques restants.
La fusion T05 exige une instruction humaine applicable ; l’autorisation T04 ne
la couvre pas. Conserve les DB/J1/clés/fixtures/worktrees ; cleanup distinct.
```
