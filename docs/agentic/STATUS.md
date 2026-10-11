# Agentic Status — DossierClé

> **Actualisation Design System — 2026-10-11 :** sur instruction utilisateur actuelle, une spécification candidate et sa revue indépendante ont été préparées. Architecture reste **BLOCKED** ; le Design System n’a pas de PASS officiel et aucune story applicative n’a commencé. Cette instruction autorise le travail documentaire demandé, sans lever le gate Architecture.

> **Réconciliation B07 / D72 — 2026-10-11 :** Keycloak est le fournisseur courant retenu. `R-B07-01` porte uniquement sur Better Auth 1.7.7 et ne s'applique pas à Keycloak. B07 reste **BLOCKED** sur l'intégration Keycloak/NestJS, la session applicative, la configuration/version et la réalisation technique de MFA/récupération selon D54/D05, qui restent les invariants. Les preuves de configuration et de parcours relèvent de Verify/QA. La recherche Better Auth ci-dessous est conservée comme constat historique, pas comme blocker courant de Keycloak.

> **D72 — décisions finalisées :** Keycloak et Mistral adoptés, Inngest conservé ; choix de ces trois outils CLOSED_BY_DECISION. [Portée](../product/ARCHITECTURE_DECISIONS.md#d72). Design System à venir, explicitement ne pas démarrer. Les mentions antérieures de remplacement non adopté sont supersédées dans cette seule portée ; conditions de livraison préservées.

> **Arbitrage historique avant D72 :** [benchmark GO/NO GO](work/arch-b02-b12/arbitrage-go-no-go.md), ADR017–021 proposés ; STOP POC D71 maintenu, aucun changement de stack adopté ni GO production.

> **Actualisation du 2026-10-11 — D69 :** B11 PASS humain documentaire. Mandat des POC B07/B12 autorisé, préflight disque résolu (71,3 Gio libres), Research/Design/Plan des qualifications B07/B12 en préparation ; B09 et Architecture non clos. [Portée](work/arch-b02-b12/evidence/human-approval-b11-pocs.md).

## Project mode

Selected mode: **LARGE**. SaaS multi-agence, données sensibles, effets externes, migrations de flotte et reprise. Mise à jour PRA : 2026-10-01, issue [#30](https://github.com/issa-diallo/dossiercle/issues/30), complément documentaire à #27. Complément de traçabilité versions/avis : 2026-10-02, issue [#29](https://github.com/issa-diallo/dossiercle/issues/29).

## Product pipeline

| Phase | Status | Artifact | Blocker / portée |
|---|---|---|---|
| PRD | PASS historique | [PRD](../product/PRD.md) | Cadrage du 2026-09-29 ; amendements D58/D60–D68 non couverts par ce PASS |
| Stories | PASS historique | [Stories](../product/STORIES.md) | 37 stories BACKLOG ; découpage #25 conservé, amendements D58/D60–D68 à revoir |
| Story Review | PASS historique | [Story Review](../product/STORY_REVIEW.md) | Revue indépendante du corpus/empreintes citées ; deux minors historiques, non réécrite |
| Architecture | **BLOCKED** | [Architecture](../product/ARCHITECTURE.md), [décisions](../product/ARCHITECTURE_DECISIONS.md), [sources](../product/ARCHITECTURE_RESEARCH.md) et 16 ADR / [remediation](../product/ARCHITECTURE_REMEDIATION.md) | B01 clos par décision ; B09 qualifié localement mais gate humain pending, B11 validé humainement selon D69 ; autres décisions/gates bloquants |
| Design System | **BLOCKED — spécification candidate préparée, gate non franchi** | [Spécification](../product/DESIGN_SYSTEM.md), [gate Architecture](work/design-system-v1/architecture-gate.md), revue indépendante [review](work/design-system-v1/review.md) | Architecture BLOCKED ; aucun PASS officiel ni story applicative commencée |

`ACCEPTED` dans un ADR désigne une décision utilisateur de principe, pas qualification technique. ADR-005 Inngest reste **PROPOSED**, auto-hébergement chez Scaleway privilégié sous conditions licence/runtime/coût/réseau ; Inngest Cloud exclu. Les autres ADR distinguent choix de principe, mécanismes proposés et preuves futures.

## Addendum produit

[D01–D57](../product/ARCHITECTURE_DECISIONS.md#mapping-exhaustif-d01d57) sont préservées et localisables avec ADR/section. Les décisions historiques invitation/MFA, auth centrale, BYOK/budgets, résiliation et runtime sont préservées ; les dépôts sont retirés et la rétention/rapports actualisés par D60–D68. Elles ne sont pas approuvées rétroactivement par Story Review PASS. Les écarts/supersessions sont [explicites](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions), à reporter et revoir avec autorisation avant Research/Design concernés. S26 weekend/fenêtres et bindings sont précisés D66/D67 ; décisions de principe acquises, qualification locale B09 et gate humain distingués. Le rapport Story Review historique reste inchangé. Minor sizing S30 à revoir en Plan.

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

## Consolidation Architecture — 2026-10-11

Travail commencé le 10, consolidé le 11 : identifiant local ARCH-B02-B12, branche/worktree dédiés, rédaction documentaire sans story produit Execute. [D60–D68](../product/ARCHITECTURE_DECISIONS.md#décisions-acquises-consolidées-le-2026-10-11--d60d68) transposent les décisions acquises #33/#42/#50 : session 15 j, offre 3 comptes/2 boîtes, originaux temporaires/dérivés/provenance, export dérivé, retrait dépôt/OTP, reprise strictement périodée in-app et rapports/fermetures/bindings, cible critique 24/7 non opérationnelle. Nouveaux ADR014–016 et pointeurs anciens ; aucune durée/quota/SLO/runtime nouveau adopté.

B09 : **QUALIFIED_LOCALLY_PENDING_HUMAN — CLOSURE_PROPOSED**. #50/#51 fusionné,63 tests locaux en mémoire rejoués deux fois sous Python 3.12.3 le 2026-10-10 ; aucune preuve crash processus/PG/transport/HA. Répartition gate algorithmique/QA durable proposée pour revue puis décision humaine, aucun PASS automatique.

B11 : **PASS humain documentaire — D69**, après [Verify](work/arch-b02-b12/verify.md) et [revue indépendante PASS](work/arch-b02-b12/review.md) sans Critical/Major ; accord final B11 reçu le 2026-10-11. Architecture reste **BLOCKED** et aucune story ne commence. PRD/Stories/Story Review PASS historiques ne couvrent pas ces amendements.

## Gates et prochaines décisions

[B01–B12](../product/ARCHITECTURE.md#architecture-gate), [dossier d’arbitrage](../product/ARCHITECTURE_REMEDIATION.md), [protocoles effets/PRA proposés](../product/ARCHITECTURE_PROTOCOL_PROPOSAL.md), [POC locaux proposés](../product/ARCHITECTURE_POC_PROPOSAL.md). B01 clos D59, validations Verify/QA visibles. B02/B03/B04/B05/B06/B07/B08/B10/B12 restent BLOCKED : licence/runtime/réseau, reprise/journal indépendant, connecteurs/modèles/privacy/coûts, auth/outillage, quotas/rétention et couverture humaine. B09 pending humain ; B11 validé D69.

Le mandat actuel autorise préparation et consolidation ; aucune installation/compte/cloud/donnée réelle/dépense ou POC nouveau lancé. B07/B12 : mandat et limites autorisés par D69, préflight disque résolu ; préparation des qualifications ; deux heures plafonnent une tentative sans promettre PASS ni réduire le scope Q4. Recherche publique et suites finales QA/charge/PRA sont distinguées, pas « application entière avant Architecture ». Report d’un choix ou risque vers QA nécessite décision explicite par bloc, sans étendre D59.

## Vérification et livraison documentaire

Portée historique des contrôles auteur #27 : couverture 57 décisions/37 stories, structure 13 ADR, liens locaux, absence alors de modification PRD/STORIES/STORY_REVIEW. #30 ajoute D58 ; #52 ajoute D59, synchronise ADR-002/Q1/Architecture/décisions/recherche/STATUS et ne modifie pas PRD, Stories ou Story Review. Contrôles attendus : `git diff --check`, `bash scripts/agentic-check.sh`. Ce script ne vérifie que présence des fichiers. Rapport auteur hors dépôt pour revue indépendante ; aucune auto-approval du rédacteur.

Aucune CI applicative/runtime/charge/PRA qualifiée. Workflow documentaire de présence constaté et réussite historique #51 ; POC temporel local synthétique #50 seulement, aucun test produit Nest/React/PG ni ressource cloud. Pas de ressource cloud ni données réelles. Le pipeline de livraison cible reste développement → tests → QA isolée → accord humain propriétaire → production avec même artefact ; il n'est pas annoncé opérationnel.

Workflow documentaire : un ticket, une branche/worktree, un commit et une PR ; revue indépendante, nouvelle instruction/validation humaine avant fusion. Aucun statut DONE/READY_FOR_EXECUTE ou pilote autorisé ne découle du présent travail.

## Reprise des qualifications — 2026-10-11

Disque désormais suffisant (~71,3 Gio) et worktrees dédiés créés. [B07 Research](work/b07-p-1-auth/research.md) avait conclu BLOCKED sur R-B07-01 natif Better Auth 1.7.7 : hash/non-relecture des secours non satisfaits par le contrat examiné. Revue documentaire PASS, aucun runtime ; exigence non affaiblie. **D72 supersède le fournisseur considéré** : cette conclusion reste vraie pour Better Auth et ne tranche pas Keycloak. [B12 préparation](work/b12-p-1-bootstrap/plan.md) Research/Design/Plan documentaires revus, DoR Execute en attente du manifeste de distribution. Le bootstrap core auth/schéma/absence plugins peut avancer sans full MFA B07, avec contrat figé et requalification si cette frontière change. Architecture/B09 toujours non clos ; B11 validé D69. Aucun package/runtime installé dans cette reprise.

D70 : manifeste distributions B12 validé humainement après revue indépendante PASS ; DoR Execute PASS et phase A autorisée. B07 Research BLOCKED, B09/Architecture non clos. Résultats runtime B12 encore à produire.

Jalon B12 phase A : Node 24.21.0 et pnpm 12.8.1 exécutés ; résolution du lock exit 0, aucun conflit peer/engine signalé. Isolation du résolveur prouvée par refus `ENETUNREACH`, version pnpm sans acquisition implicite. [Audit indépendant des sources PASS](work/b12-p-1-bootstrap/evidence/lock-result-review.md) : 530 paquets produit concordent avec raw metadata/lock/SRI, 35 pins root exacts. Les corrections de transport/configuration sont documentées ; aucune violation Q4 n'est établie par ces échecs fonctionnels. Installations figées, bases/migrations, builds/tests, sécurité et autres preuves Q4 restent à exécuter. Ce jalon ne ferme ni B12 ni Architecture.


## D71 — arrêt des POC et stack validée, 2026-10-11

L'utilisateur arrête explicitement le POC et valide React 19/TypeScript 6/Vite 8, NestJS 12/Node.js 24/Express 5, PostgreSQL 17/Drizzle, Better Auth/NestJS, Inngest, Vitest/Playwright/k6/OpenTelemetry. [D71](../product/ARCHITECTURE_DECISIONS.md#d71) supersède le mandat D69/D70 et l'obligation de terminer le POC avant d'adopter ces choix. **B12 : CLOSED_BY_DECISION pour le choix stack/outillage.** Les preuves restantes sont attribuées aux stories ; aucun test supplémentaire lancé après cette demande.

[Arrêt vérifié](work/b12-p-1-bootstrap/evidence/user-stop.json) : zéro scope/containeur/socket B12 actif, ressources utilisateur conservées, compteur conservateur final 495 538 247 octets. Node/pnpm, résolution/audit et installation frozen 1 étayés ; installation offline 2 interrompue. PostgreSQL/builds/tests/scans/promotion non exécutés ou non qualifiés. Objectif technique du POC non satisfait, arrêt demandé ; aucun nouveau POC en attente d'autorisation ni reprise automatique.

**Suite du pipeline (état à D71, avant D72) :** finaliser les décisions d'architecture restantes (licence/déploiement Inngest et réseau, PRA/effets, privacy/durées/coûts/exploitation), puis Design System et Research des stories dans l'ordre du DAG. Les essais complets ne sont plus exigés pour entériner la stack. La mention de R-B07-01 comme contrainte courante est supersédée par la note D72 en tête de ce document ; aucune sécurité n'est affaiblie. Architecture globale reste BLOCKED par les décisions structurantes non couvertes par les choix adoptés, pas par le POC annulé. Aucune phase sautée et aucune nouvelle implémentation produit lancée.

Préparation utile sans nouveau POC : [brouillon Design System](work/arch-b02-b12/design-system-draft.md), direction visuelle, navigation, tokens et composants/états. Travail anticipé justifié dans le brouillon, hors démarrage officiel de la phase ; gate et document produit restent inchangés jusqu'à Architecture PASS. Aucun composant implémenté ni accessibilité déclarée prouvée.
