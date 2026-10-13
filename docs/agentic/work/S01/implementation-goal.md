# Goal d’implémentation — S01

GOAL: ACTIVE — mission du 2026-10-11. Mode PRODUCT/LARGE.

## Résultat attendu
Créer et activer un espace isolé selon Research/Design/Plan validés, sans Ship.

## Critères mesurables
- [x] T00 : environnement isolé reproductible, contrôles directs et Worktree Setup PASS.
- [ ] T01–T09 : tous AC et contraintes du plan implémentés ; builds séparés.
- [ ] V1–V6 réellement exécutés sur services synthétiques, sans tests absents/ignorés.
- [ ] Verify PASS, preuves reproductibles de MFA/J1/isolation/reprise.
- [ ] Revue indépendante PASS/PASS_WITH_MINOR, aucun Critical/Major ouvert.
- [ ] T10 : suivi réel et handoff de livraison distinct de la préparation.

## Contraintes
Branche feat/s01-espace-isole ; worktree worktrees/s01-espace-isole.
Aucun numéro GitHub inventé ; identifiant S01 suffisant avant Ship sans commit.
Un écrivain /root ; reviewer indépendant en lecture seule.
Pas de données réelles/cloud/dépense/action fournisseur ni commit/PR/merge.
Pas de fallback MFA ; bases fermées dès CREATE ; journal J1 courant opposable.
Préparation inchangée, B05/B06 hors S01, secrets tmpfs privés.

## Arrêt
Critères satisfaits ou blocage réel prouvé et documenté.
Ship/CI hébergée/validation humaine/merge/cleanup restent séparés ; jamais DONE.

## Preuves
À enregistrer dans environment.md, verify.md et review.md ; aucun PASS applicatif acquis.

## Progression réelle
T01–T03 PASS ; T04 BLOCKED avant callback OIDC : le TOTP frais est refusé et le
POST Keycloak des actions requises reste fermé jusqu’au pont grant-aware/J1.
Preuve et reproduction dans `evidence/t04-mfa-blocker.md`. T05–T10 non démarrés.
Aucun espace ACTIVE ; Verify globale non commencée. Revue corrective indépendante
PASS ciblée (`evidence/t04-corrective-review.md`) ; Review globale reste non atteinte.
