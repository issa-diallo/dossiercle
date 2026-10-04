# Agentic Status — DossierClé

## Project mode

Selected mode: **LARGE**. SaaS multi-agence, données sensibles, effets externes, migrations de flotte et reprise. Mise à jour PRA : 2026-10-01, issue [#30](https://github.com/issa-diallo/dossiercle/issues/30), complément documentaire à #27. Complément de traçabilité versions/avis : 2026-10-02, issue [#29](https://github.com/issa-diallo/dossiercle/issues/29).

## Product pipeline

| Phase | Status | Artifact | Blocker / portée |
|---|---|---|---|
| PRD | PASS historique | [PRD](../product/PRD.md) | Cadrage du 2026-09-29 ; amendement catastrophe D58 non couvert par ce PASS |
| Stories | PASS historique | [Stories](../product/STORIES.md) | 37 stories BACKLOG ; découpage #25 conservé, amendement PRA D58 à revoir |
| Story Review | PASS historique | [Story Review](../product/STORY_REVIEW.md) | Revue indépendante du corpus/empreintes citées ; deux minors historiques, non réécrite |
| Architecture | **BLOCKED** | [Architecture](../product/ARCHITECTURE.md), [décisions](../product/ARCHITECTURE_DECISIONS.md), [sources](../product/ARCHITECTURE_RESEARCH.md) et 13 ADR | B01 clos par décision avec risque accepté ; B02–B12 et revue indépendante restent bloquants |
| Design System | TODO — non commencé | [Artefact existant](../product/DESIGN_SYSTEM.md) | Architecture BLOCKED ; présence du template ne vaut pas réalisation |

`ACCEPTED` dans un ADR désigne une décision utilisateur de principe, pas qualification technique. ADR-005 Inngest reste **PROPOSED**, auto-hébergement chez Scaleway privilégié sous conditions licence/runtime/coût/réseau ; Inngest Cloud exclu. Les autres ADR distinguent choix de principe, mécanismes proposés et preuves futures.

## Addendum produit

[D01–D57](../product/ARCHITECTURE_DECISIONS.md#mapping-exhaustif-d01d57) sont préservées et localisables avec ADR/section. Les décisions récentes complètent le corpus : invitation/MFA, auth centrale, BYOK/budgets, dépôts, résiliation, fermetures, fenêtre weekend, exception runtime Inngest. Elles ne sont pas approuvées rétroactivement par Story Review PASS. Les écarts/supersessions sont [explicites](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions), à reporter et revoir avec autorisation avant Research/Design concernés. S26 weekend est précisé par D48 ; le rapport historique reste inchangé et l'interaction fermetures/rapports B09 reste ouverte. Minor sizing S30 à revoir en Plan.

[D58](../product/ARCHITECTURE_DECISIONS.md#d58), confirmée le 2026-10-01 (#30), remplace seulement les bornes PRA et le conflit catastrophe de D27 : **RPO < 4 heures / RTO < 4 heures**. Tolérance catastrophe explicite, zéro perte normale/retries et sauvegardes 30 jours inchangés. PRD/Stories amendés uniquement sur cette portée ; Story Review historique non modifiée et non étendue. B03 demeure ouvert pour preuve technique, cohérence bases/fichiers/jobs et mesures, sans nouvel arbitrage produit zéro perte/catastrophe.

[D59](../product/ARCHITECTURE_DECISIONS.md#d59), confirmée le 2026-10-04 (#52), adopte **Google Cloud SQL for PostgreSQL 17 Enterprise, HA régionale à Paris `europe-west9`**, PITR activé et connexions chiffrées obligatoires. Statut : `B01: CLOSED_BY_DECISION — ACCEPTED_WITH_RISK`, jamais `PASS` technique. Le POC #53 a été abandonné et fermé `not planned` avant exécution ; aucune mesure de failover, RPO/RTO, PITR, isolation, pools, migrations ou coût n'existe. Ces validations restent obligatoires en Verify/QA avant Production. Les choix Scaleway fichiers, IA, coffre candidat, hébergement applicatif et Inngest restent inchangés.

[F10](../product/ARCHITECTURE_RESEARCH.md#f10--versions-observées-et-avis-publiés-au-2026-10-02), ajoutée par #29, distingue serveur Inngest v1.45.1 et SDK npm 4.21.1 comme observations non adoptées, et synthétise les avis Better Auth publics datés avec leurs limites. Elle ne constitue ni audit de code ni preuve de sûreté ; B07/B12 restent ouverts, Architecture reste **BLOCKED** et aucune story ne démarre.

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

Référence : [B01–B12, propriétaires et preuves](../product/ARCHITECTURE.md#architecture-gate). Le choix PG B01 est clos par D59 ; ses preuves de livraison restent visibles mais ne sont plus un arbitrage structurel. Restent ouverts : licence/runtime/coûts Inngest, reprise cohérente et mesures RPO/RTO B03, réseau inter-cloud/coffre/IAM, connecteurs/tags, catalogue/privacy/coûts IA et BYOK, versions/politiques Better Auth, quotas/rétention, fermetures/rapports, disponibilité/opérations, addendum et outillage.

La recherche de qualification pré-Architecture et les mini-POC encore indispensables exigent un mandat distinct ; ils ne démarrent pas silencieusement Research d'une story. B01-P-1 est l'exception explicitement abandonnée et remplacée par un risque accepté, sans supprimer ses validations Verify/QA. Les suites finales QA/charge/PRA sont futures, exigibles avant pilote/production selon leurs gates. Le gate actuel reste bloqué par B02–B12 et non par l'absence normale d'application finie.

## Vérification et livraison documentaire

Portée historique des contrôles auteur #27 : couverture 57 décisions/37 stories, structure 13 ADR, liens locaux, absence alors de modification PRD/STORIES/STORY_REVIEW. #30 ajoute D58 ; #52 ajoute D59, synchronise ADR-002/Q1/Architecture/décisions/recherche/STATUS et ne modifie pas PRD, Stories ou Story Review. Contrôles attendus : `git diff --check`, `bash scripts/agentic-check.sh`. Ce script ne vérifie que présence des fichiers. Rapport auteur hors dépôt pour revue indépendante ; aucune auto-approval du rédacteur.

Aucune CI applicative configurée constatée au départ, aucun package/runtime/build/test applicatif/charge/PRA exécuté. Pas de ressource cloud ni données réelles. Le pipeline de livraison cible reste développement → tests → QA isolée → accord humain propriétaire → production avec même artefact ; il n'est pas annoncé opérationnel.

Workflow documentaire : un ticket, une branche/worktree, un commit et une PR ; revue indépendante, nouvelle instruction/validation humaine avant fusion. Aucun statut DONE/READY_FOR_EXECUTE ou pilote autorisé ne découle du présent travail.
