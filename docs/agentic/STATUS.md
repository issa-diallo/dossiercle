# Agentic Status — DossierClé

## Project mode

Selected mode: **LARGE**. SaaS multi-agence, données sensibles, effets externes, migrations de flotte et reprise. Mise à jour : 2026-09-30, issue [#27](https://github.com/issa-diallo/dossiercle/issues/27).

## Product pipeline

| Phase | Status | Artifact | Blocker / portée |
|---|---|---|---|
| PRD | PASS historique | [PRD](../product/PRD.md) | Cadrage du 2026-09-29 ; inchangé, pas approbation des ajouts Architecture |
| Stories | PASS historique | [Stories](../product/STORIES.md) | 37 stories BACKLOG ; découpage du ticket #25 inchangé |
| Story Review | PASS historique | [Story Review](../product/STORY_REVIEW.md) | Revue indépendante du corpus/empreintes citées ; deux minors historiques, non réécrite |
| Architecture | **BLOCKED** | [Architecture](../product/ARCHITECTURE.md), [décisions](../product/ARCHITECTURE_DECISIONS.md), [sources](../product/ARCHITECTURE_RESEARCH.md) et 13 ADR | Documents rédigés ; B01–B12 structurels à résoudre et revue indépendante de ce corpus à effectuer |
| Design System | TODO — non commencé | [Artefact existant](../product/DESIGN_SYSTEM.md) | Architecture BLOCKED ; présence du template ne vaut pas réalisation |

`ACCEPTED` dans un ADR désigne une décision utilisateur de principe, pas qualification technique. ADR-005 Inngest reste **PROPOSED**, auto-hébergement chez Scaleway privilégié sous conditions licence/runtime/coût/réseau ; Inngest Cloud exclu. Les autres ADR distinguent choix de principe, mécanismes proposés et preuves futures.

## Addendum produit

[D01–D57](../product/ARCHITECTURE_DECISIONS.md#mapping-exhaustif-d01d57) sont préservées et localisables avec ADR/section. Les décisions récentes complètent le corpus : invitation/MFA, auth centrale, BYOK/budgets, dépôts, résiliation, fermetures, fenêtre weekend, exception runtime Inngest. Elles ne sont pas approuvées rétroactivement par Story Review PASS. Les écarts/supersessions sont [explicites](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions), à reporter et revoir avec autorisation avant Research/Design concernés. S26 weekend est précisé par D48 ; le rapport historique reste inchangé et l'interaction fermetures/rapports B09 reste ouverte. Minor sizing S30 à revoir en Plan.

## Story pipeline

Toutes les stories restent BACKLOG ; aucune phase story n'est lancée par ce travail. Les dépendances sont celles des Stories, Sinistres avant Location et les deux inclus V1. La documentation d'architecture n'est pas Execute de ces stories.

| Story | State | Research | Design | Plan | Execute / Verify | Blocker |
|---|---|---|---|---|---|---|
| S01 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S02 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S03 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S04 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S05 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S06 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S07 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S08 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S09 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S10 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S11 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S12 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S13 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S14 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S15 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S16 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S17 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S18 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S19 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S20 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S21 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S22 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S23 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S24 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S25 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S26 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S27 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S28 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S29 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S30 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S31 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S32 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S33 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S34 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S35 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S36 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES |
| S37 | BACKLOG | Non commencé | Non commencé | Non commencé | Non commencés | Architecture + Design System ; dépendances STORIES ; connecteur optionnel à qualifier |

## Gates et prochaines décisions

Référence : [B01–B12, propriétaires et preuves](../product/ARCHITECTURE.md#architecture-gate). Sont ouverts les choix de PG/PITR/flotte et sauvegardes, licence/runtime/coûts Inngest, cohérence RPO/zéro perte, réseau/coffre/IAM, connecteurs/tags, catalogue/privacy/coûts IA et BYOK, versions/politiques Better Auth, quotas/rétention, fermetures/rapports, disponibilité/opérations, addendum et outillage.

La recherche de qualification pré-Architecture et les mini-POC indispensables exigent un mandat distinct ; ils ne démarrent pas silencieusement Research d'une story. Les suites finales QA/charge/PRA sont futures, exigibles avant pilote/production selon leurs gates, pas toutes avant Architecture. Le gate actuel est bloqué par les décisions/faisabilités structurantes, pas par l'absence normale d'application finie.

## Vérification et livraison documentaire

Portée des contrôles auteur : couverture 57 décisions/37 stories, structure 13 ADR, liens locaux, absence de modification PRD/STORIES/STORY_REVIEW, `git diff --check`, `bash scripts/agentic-check.sh`. Ce script ne vérifie que présence des fichiers. Rapport auteur et outils de contrôle hors dépôt pour revue indépendante ; aucune auto-approval du rédacteur.

Aucune CI applicative configurée constatée au départ, aucun package/runtime/build/test applicatif/charge/PRA exécuté. Pas de ressource cloud ni données réelles. Le pipeline de livraison cible reste développement → tests → QA isolée → accord humain propriétaire → production avec même artefact ; il n'est pas annoncé opérationnel.

Workflow documentaire : un ticket, une branche/worktree, un commit et une PR ; revue indépendante, nouvelle instruction/validation humaine avant fusion. Aucun statut DONE/READY_FOR_EXECUTE ou pilote autorisé ne découle du présent travail.
