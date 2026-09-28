# Workflow de développement

## 0. Intake

Entrée : une issue GitHub exploitable.

L'issue doit décrire :

- problème ou besoin ;
- utilisateur concerné ;
- résultat attendu ;
- critères d'acceptation ;
- hors périmètre ;
- dépendances connues.

Si ces éléments sont insuffisants, l'orchestrateur complète le cadrage avant d'autoriser le code.

## 1. Research

Créer `docs/agentic/work/<ticket>-<slug>/research.md` depuis le template.

Objectif : comprendre le code réel et non imaginer une solution.

La recherche doit identifier :

- composants et modules existants ;
- modèles de données ;
- APIs et contrats ;
- conventions déjà présentes ;
- tests existants ;
- dépendances ;
- sécurité ;
- risques de régression ;
- questions ouvertes.

Sortie : Research Gate = PASS ou BLOCKED.

## 2. Plan

Créer `plan.md`.

Le plan doit être suffisamment précis pour qu'un autre agent puisse implémenter sans refaire toute l'analyse.

Il doit contenir :

- fichiers à créer/modifier ;
- séquence de changements ;
- schéma/API impactés ;
- stratégie de tests ;
- migration éventuelle ;
- rollback si nécessaire ;
- risques et mitigations.

Sortie : Plan Gate = PASS ou BLOCKED.

## 3. Worktree

Créer un worktree et une branche dédiés.

Exemple :

```bash
git fetch origin
git worktree add ../worktrees/187-email-evidence -b feat/187-email-evidence origin/main
```

Un agent = un worktree actif.

## 4. Implementation

L'implementer suit le plan validé.

Règles :

- ne pas étendre le scope ;
- ne pas modifier une architecture commune sans le signaler ;
- ajouter des tests avec le changement ;
- conserver les invariants multi-tenant et human-in-the-loop ;
- documenter les écarts au plan.

## 5. Test

Exécuter les tests pertinents du projet.

Quand le projet aura sa stack technique, le plan devra préciser les commandes exactes.

Minimum attendu selon le changement :

- format/lint ;
- tests unitaires ;
- tests d'intégration ;
- tests contractuels API ;
- tests end-to-end quand le workflow utilisateur l'exige ;
- build.

Ne jamais déclarer "tests pass" sans préciser les commandes réellement exécutées.

## 6. Independent Review

Un reviewer séparé lit :

1. issue ;
2. research ;
3. plan ;
4. diff ;
5. résultats de tests.

Il produit `review.md`.

Sévérité :

- Critical : sécurité, perte/corruption de données, isolation tenant cassée, action sensible non autorisée ;
- Major : comportement incorrect, critère d'acceptation manquant, architecture ou contrat cassé, absence de test significative ;
- Minor : qualité, maintenance, cohérence, dette non bloquante ;
- Nit : cosmétique.

Critical/Major => retour Implementation.

## 7. Pull Request

La PR doit inclure :

- résumé ;
- issue liée ;
- ce qui change ;
- ce qui ne change pas ;
- tests exécutés ;
- risques ;
- captures si UI ;
- migrations/configuration ;
- résultat de la review indépendante.

## 8. CI

La CI doit être verte.

Si la CI ne démarre pas pour une raison externe, le statut est BLOCKED et non PASS.

## 9. Human Approval

Avant merge, une personne vérifie au minimum :

- adéquation avec le besoin ;
- risques fonctionnels ;
- findings de review ;
- CI ;
- éventuel impact données/sécurité.

## 10. Merge et cleanup

Après merge :

```bash
git worktree remove ../worktrees/<ticket>-<slug>
git branch -d <branch>
```

Mettre le ticket et `STATUS.md` à DONE.
