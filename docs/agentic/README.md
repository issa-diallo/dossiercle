# DossierClé Agentic Development System

Ce dossier définit la méthode officielle de développement multi-agents de DossierClé.

## Objectif

Permettre à plusieurs agents de travailler en parallèle sans transformer le dépôt en ensemble de changements difficiles à relire ou à intégrer.

La méthode privilégie :

- le cadrage avant le code ;
- l'isolation par worktree ;
- les changements petits et livrables ;
- les revues indépendantes ;
- la CI comme gate ;
- la validation humaine avant merge.

## Pipeline

```text
GitHub Issue
    |
    v
Research
    |
    v
Plan
    |
    v
Worktree + Branch
    |
    v
Implementation
    |
    v
Tests
    |
    v
Independent Review
    |
    +---- findings ----> Fix ----+
    |                            |
    +----------------------------+
    |
    v
Pull Request
    |
    v
CI
    |
    v
Human Approval
    |
    v
Merge
```

## Structure

```text
docs/agentic/
├── README.md
├── WORKFLOW.md
├── STATUS.md
├── roles/
│   ├── ORCHESTRATOR.md
│   ├── IMPLEMENTER.md
│   └── REVIEWER.md
└── templates/
    ├── STORY.md
    ├── RESEARCH.md
    ├── PLAN.md
    ├── REVIEW.md
    └── HANDOFF.md
```

Les documents spécifiques à une story pourront ensuite être placés dans :

```text
docs/agentic/work/<ticket>-<slug>/
├── research.md
├── plan.md
├── review.md
└── handoff.md
```

## Principe de responsabilité

L'IA peut proposer, implémenter, tester et relire. La décision finale de merger reste humaine.

## Quand utiliser tout le pipeline

Utiliser le pipeline complet pour :

- nouvelle fonctionnalité ;
- changement d'architecture ;
- migration de données ;
- intégration OAuth/API ;
- sécurité ;
- logique multi-tenant ;
- workflow impliquant des actions externes ;
- refactor important.

Pour une correction triviale, Research et Plan peuvent être condensés dans la PR, mais les tests et la revue restent requis.
