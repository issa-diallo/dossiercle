# DossierClé — Agent Rules

Ce dépôt utilise un workflow de développement agentique structuré. Les agents ne doivent pas coder directement depuis une demande vague.

## Source de vérité

Avant toute modification, lire dans cet ordre :

1. `README.md`
2. `docs/agentic/README.md`
3. `docs/agentic/WORKFLOW.md`
4. le ticket GitHub concerné
5. les documents de travail de la story dans `docs/agentic/work/`

## Règle fondamentale

Une tâche de développement suit obligatoirement :

`Issue -> Research -> Plan -> Implement -> Test -> Independent Review -> Fix -> PR -> CI -> Human Approval -> Merge`

Ne jamais sauter directement de l'Issue à l'implémentation sauf correction triviale explicitement qualifiée comme telle.

## Isolation

Pour toute story non triviale :

- une issue GitHub ;
- une branche dédiée ;
- un worktree dédié ;
- un seul périmètre fonctionnel principal ;
- une PR dédiée.

Convention recommandée :

`worktrees/<ticket>-<slug>`

Branche :

`feat/<ticket>-<slug>`, `fix/<ticket>-<slug>`, `chore/<ticket>-<slug>`.

Deux agents ne doivent pas modifier le même worktree simultanément.

## Rôles séparés

L'agent qui implémente ne valide pas seul son propre travail.

Les rôles sont définis dans :

- `docs/agentic/roles/ORCHESTRATOR.md`
- `docs/agentic/roles/IMPLEMENTER.md`
- `docs/agentic/roles/REVIEWER.md`

Le reviewer doit raisonner à partir du ticket, du plan, du diff et des critères d'acceptation. Il ne doit pas simplement reprendre les conclusions de l'implementer.

## Gates obligatoires

Une story ne peut passer à l'étape suivante que si le gate précédent est satisfait.

### Gate Research
- contexte du repo compris ;
- dépendances identifiées ;
- fichiers impactés identifiés ;
- risques et inconnues listés.

### Gate Plan
- étapes d'implémentation concrètes ;
- tests prévus ;
- impacts sécurité/données décrits ;
- aucun point bloquant non résolu.

### Gate Implementation
- périmètre du ticket respecté ;
- pas de refactor hors sujet ;
- tests ajoutés ou adaptés ;
- documentation mise à jour si nécessaire.

### Gate Review
- aucun finding Critical ou Major ouvert ;
- critères d'acceptation vérifiés ;
- comportement multi-tenant et validation humaine vérifiés quand concernés ;
- tests pertinents exécutés.

### Gate Ship
- branche à jour ;
- CI verte ;
- PR complète ;
- validation humaine avant merge.

## DossierClé — invariants produit

Les agents doivent préserver ces règles :

- les données d'une agence sont isolées de celles des autres agences ;
- aucune action sensible ne doit contourner la validation humaine prévue ;
- les accès aux boîtes e-mail, contacts, conversations, sinistres, biens et artisans doivent être autorisés explicitement ;
- ne jamais exposer de secrets, tokens OAuth ou données personnelles dans les logs ;
- toute automatisation doit être traçable et réversible quand cela est pertinent.

## Travail parallèle

Le parallélisme est autorisé uniquement si les stories sont suffisamment indépendantes.

L'orchestrateur doit :

- identifier les dépendances ;
- limiter les collisions de fichiers ;
- lancer d'abord les stories structurantes ;
- ne pas merger automatiquement une dépendance risquée uniquement pour débloquer les suivantes.

## État

Mettre à jour `docs/agentic/STATUS.md` lorsqu'une story importante change d'état.

États autorisés :

- BACKLOG
- RESEARCH
- PLANNED
- IMPLEMENTING
- REVIEW
- BLOCKED
- PR_OPEN
- CI
- READY_FOR_HUMAN
- DONE

## Modèles

Utiliser le modèle le moins coûteux capable de réaliser la tâche correctement.

- architecture, sécurité, ambiguïtés fortes, review critique : modèle puissant ;
- implémentation clairement planifiée : modèle intermédiaire ;
- tests mécaniques, documentation et tâches répétitives : modèle économique ;
- escalader vers un modèle plus puissant si le premier agent reste bloqué après une tentative raisonnable.

Le choix du modèle ne remplace jamais les gates de qualité.
