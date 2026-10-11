# Goal — ARCH-B02-B12

Date finale : 2026-10-11 ; préparation commencée le 10. Mode LARGE. Reprise au gate produit Architecture. Identifiant local ; aucun numéro d’issue inventé.

Objectif utilisateur : traiter les blocages d’architecture jusqu’aux décisions et preuves nécessaires. Sous-objectif documentaire : fournir un corpus cohérent et un dossier d’arbitrage vérifiable B02–B12.

| Critère de préparation | Preuve | Résultat |
|---|---|---|
| Statuts/dépendances/sorties/rôles B02–B12 | Dossier d’arbitrage | SATISFIED |
| Décisions acquises et supersessions cohérentes | D60–D68, ADR014–016, review | SATISFIED |
| D01–D59/Q historiques et 37 stories/DAG conservés | Verify et comparaison base | SATISFIED |
| Aucun choix proposé adopté tacitement | Deux revues indépendantes | SATISFIED |
| Verify et review sans Critical/Major | verify.md, review.md | SATISFIED |

`GOAL: BLOCKED` pour l’objectif global, préparation documentaire satisfaite. Blockers réels : avis licence/usage Inngest et exception/runtime ; réseau/IAM inter-cloud ; PRA et autorité hors rollback ; contrats et qualifications mail/IA/privacy ; budgets, quotas/rétentions et couverture 24/7 ; capacité disque des POC indispensables B07/B12 et leurs qualifications ; gates humains B09 et Architecture. B11 et le mandat POC sont désormais validés D69. L’absence de ces décisions/preuves interdit Architecture PASS. Aucun produit commencé ; Ship reste pending, aucun commit/PR.

Suite mesurable : décider les options documentées et les bornes POC, réaliser les qualifications autorisées, revoir chaque blocage puis obtenir les verdicts humains distincts. [Dossier](../../../product/ARCHITECTURE_REMEDIATION.md), [Verify](verify.md), [Review](review.md).

## Mandat d’arbitrage du 2026-10-11

Comparer et rendre recommandations concrètes hébergement/réseau, Inngest/licence, MFA et conservation : [dossier](arbitrage-go-no-go.md). Critères : sources primaires, options et verdicts par bloc, alternatives sous NO GO, limites et revue indépendante. La liste de blockers/disque/POC ci-dessus est historique : disque résolu et POC arrêtés D71 ; ne constitue aucun mandat de reprise. Statut de ce sous-objectif : IN_PROGRESS jusqu’à revue ; architecture globale toujours BLOCKED.

Sous-objectif arbitrage documentaire : SATISFIED pour comparaison, recommandations, alternatives, traçabilité et revue ciblée ; ne signifie pas résolution de tous les blockers ni adoption/qualification des remplaçants. Le gate Architecture demeure BLOCKED.

## D72 — choix clôturés et arrêt avant Design System

Validation humaine explicite de Keycloak, Mistral et Inngest : [preuve](evidence/human-approval-d72-tools.md), [décision](../../../product/ARCHITECTURE_DECISIONS.md#d72). Choix de ces trois outils CLOSED_BY_DECISION, pas de nouvelle confirmation requise. Exigences et preuves de livraison maintenues ; pas de licence/contrat/sécurité réputés prouvés. Aucun nouveau POC ni Design System lancé. Autres gates Architecture non clos par extension.

## Livraison Git demandée — issue #55

Mandat explicite de fusion du corpus revu avant arrêt : [Ship](ship.md). Les mentions historiques « aucun Ship autorisé » sont supersédées dans la seule portée de livraison documentaire. Aucun Design System/POC lancé, aucun Architecture PASS implicite. Main sera synchronisé après CI et fusion ; ne pas conserver des décisions uniquement dans un worktree comme source de vérité pour le prochain agent.
