# Audit du gate Architecture — 2026-10-11

## Verdict

**ARCHITECTURE: BLOCKED.** Le snapshot de base est `main` après #60
(`4e67593`) ; la décision utilisateur B09 reçue ensuite dans ce worktree est
consignée séparément et incluse dans le verdict présent. Même avec cette
décision, le PASS Architecture n’est pas justifiable. Ce verdict est cohérent
avec le verdict canonique de `docs/product/ARCHITECTURE.md` et le statut
`docs/agentic/STATUS.md`. Il ne s’appuie ni sur l’absence des tests finaux
ordinaires, ni sur un finding Better Auth considéré comme applicable à
Keycloak.

D72 clôt les choix de fournisseur/outils Keycloak, Mistral et Inngest. Elle ne
prouve pas contrat, configuration, licence, coûts, sécurité, runtime, ni ne
ferme les autres blocs. Aucun POC n’a été relancé et aucune story applicative
n’a été commencée.

## État des blocs

| Bloc | État constaté | Décision structurante encore requise avant Architecture PASS | Preuves affectables à Verify/QA après décision |
|---|---|---|---|
| B01 — PostgreSQL | `CLOSED_BY_DECISION — ACCEPTED_WITH_RISK` (D59) | Aucune dans la portée du risque accepté. Ne pas étendre cet arbitrage à d’autres blocs. | Failover, transactions acquittées, reconnexion, PITR, isolation par base, rôles/pools, migrations et coût observé avant production. |
| B02 — jobs et effets | `BLOCKED` | Licence/usage SaaS exacts d’Inngest, exception PRD si nécessaire, runtime/topologie/coût et PG technique ; stratégie de barrière d’effets en vol et protocole qualifiable. Aucun remplacement de moteur implicite. | Annulation, replay, ancien worker, partitions, réconciliation, rétention et durabilité du moteur. |
| B03 — reprise/PRA | `BLOCKED` | Stratégie exploitable de journal/source indépendant, point cohérent entre PG/objets/orchestration, source de reconstruction, opérabilité et coût. Le seuil D58 (<4 h RPO et RTO pour catastrophe) est déjà acquis. | Restaurations complètes chronométrées, mesure RPO/RTO, pertes visibles, réconciliation sans doublon ni droits ressuscités. |
| B04 — réseau et secrets | `BLOCKED` | Topologie des flux inter-cloud/accès PG/egress, identité workload, coffre, IAM, rôles et rotation à arrêter. | Connectivité, latence, pools, cold starts, failover, rotation et callbacks. Une preuve ciblée indispensable à un choix peut précéder sa clôture ; les mesures exhaustives restent QA. |
| B05 — messagerie | `BLOCKED` | Contrats/capacités par fournisseur et boîte, et preuve synthétique requise `B05-P-1` (readback/concurrence/capacités) avant Architecture PASS. La boîte qui ne prouve pas ses capacités reste manuelle. Le protocole Q3 marque cette preuve pré-gate nécessaire ; elle n’a pas été exécutée. | Après choix de contrat/protocole : QA intégrée des parcours réels, fraîcheur des curseurs/tags, quotas, erreurs et états incertains. Ces tests de livraison ne remplacent pas `B05-P-1`. |
| B06 — IA | `BLOCKED` | Mistral est choisi (D72), mais modèle/version/région, contrat ZDR et politique de données, budget/enveloppe/BYOK, tarification, repli restent ouverts ; une qualification synthétique dérivée de `B06-P-1` doit précéder sélection finale du modèle/enveloppe et Architecture PASS. Q3 précédait D72 et visait Qwen/Scaleway ; son protocole doit être adapté à Mistral et autorisé, pas appliqué tel quel. Elle n’a pas été exécutée. | Après choix/qualification : QA intégrée des sorties, injections, concurrence du ledger, coûts, purge et fallback. Pas de données réelles dans la preuve synthétique pré-gate. |
| B07 — identité/MFA | `BLOCKED` | Contrat Keycloak/NestJS, session opaque, versions/configuration et réalisation technique des garanties MFA/récupération D54/D05. `R-B07-01` est un finding de Better Auth 1.7.7, historique et non transposable à Keycloak. | Parcours/configuration Keycloak, MFA, récupération, révocation, idle 30 min, absolu 15 j et coordination multi-onglets. |
| B08 — limites et données | `BLOCKED` | Quotas et unité de taille, formats, durées/finalités, politique active/backups/tombstones, contrats sous-traitants et décisions privacy/droits restent à fixer. | Purge bout en bout, AV/quarantaine, caches, retries, sauvegardes, export et exercice des droits. |
| B09 — temps et rapports | `QUALIFIED_LOCALLY — HUMAN_APPROVED` (2026-10-11) | La décision humaine accepte la qualification algorithmique locale #50/#51 comme suffisante pour clore ce niveau du gate Architecture. D66/D67 sont acquis. | PostgreSQL, transactions, crash/restart, concurrence workers, transport/réconciliation et tzdb durable restent Verify/QA avant mise en service. |
| B10 — exploitation | `BLOCKED` | Objectif interne de disponibilité/SLO, seuils d’alerte/escalade, responsables/prestataire, couverture humaine, capacité et budget. Aucun SLA ne découle de RPO/RTO. | Exercices, délais de mobilisation/reprise et mesures réelles après adoption de l’organisation. |
| B11 — consolidation documentaire | `PASS humain documentaire — D69` | Rien pour le périmètre de consolidation documentaire approuvé ; ce PASS n’étend pas les gates des autres blocs. | Critères de vérification des stories sur leur périmètre respectif. |
| B12 — stack/outillage | `CLOSED_BY_DECISION — D71` (D72 actualise les fournisseurs) | Aucun choix de stack à rouvrir. Les POC préalables ont été arrêtés par l’utilisateur ; aucune nouvelle validation ou reprise n’est requise. | Versions/lock par story, builds, tests, sécurité/SBOM, E2E, charges, OTel, promotion et rollback. |

## Pourquoi le gate reste bloqué

Il reste des décisions préalables ouvertes dans B02–B08 et B10. B09 est
qualifié localement avec l’accord humain enregistré ; ce statut ne vaut pas
qualification de durabilité. Les lignes encore ouvertes portent des choix de
licence/exception, topologie et protocole, de stratégie de reprise, de
contrats/capacités, de politique privacy/données, de sécurité ou d’exploitation.
Elles ne peuvent pas être déclarées « preuves futures » sans arbitrairement
reporter des décisions nécessaires à la conception.

Architecture PASS n’exige pas de démontrer tous les niveaux de service de
production. Q3 impose toutefois explicitement les preuves synthétiques
`B05-P-1` et `B06-P-1` avant la clôture de ces choix et avant Architecture
PASS ; elles ne sont pas reclassées en Verify. Elles n’ont pas été lancées
dans cet audit, conformément à l’absence d’autorisation pour relancer des
POC. Les tests intégration et PRA complets, parcours E2E, preuve effective de
rétention/ZDR, exercices d’astreinte, scans et promotion production restent
Verify/QA/pilote une fois leurs contrats, politiques, propriétaires et
protocoles définis.

Le statut de `docs/product/ARCHITECTURE_REMEDIATION.md` est un dossier daté D71
et pré-D72. Ses références B07 à Better Auth et à la préparation B12 ne sont
pas l’état courant ; D72, l’Architecture réconciliée dans #60 et ce contrôle
font autorité sur cette portée. La fiche gate Design System antérieure a été
actualisée pour supprimer la même référence B07 périmée.

## Preuves consultées

- `README.md`, `docs/agentic/METHOD.md`, `WORKFLOW.md`, `SCALING.md`,
  `CONTEXT.md`, `SAFETY.md` et `COMMITS.md`.
- `docs/product/PRD.md`, `STORIES.md`, `STORY_REVIEW.md`, `ARCHITECTURE.md`,
  `ARCHITECTURE_DECISIONS.md` (dont D58–D72),
  `ARCHITECTURE_REMEDIATION.md`, protocoles et propositions Q1–Q6.
- ADR-001 à ADR-021, lus selon leur applicabilité et leurs supersessions.
- `docs/agentic/STATUS.md`, B01–B12, preuve d’approbation D69, preuve humaine
  D72, [approbation humaine B09](arch-b02-b12/evidence/human-approval-b09-gate.md)
  et revues/Verify antérieures.
- Revue indépendante de l’état B01–B12, sans modification du worktree.

## Gate

`VERIFY: PASS` pour la vérification documentaire du verdict et la cohérence de
la classification décision/Verify. **Architecture reste BLOCKED** jusqu’à
résolution des décisions B02–B08 et B10, réalisation des preuves pré-gate
B05-P-1/B06-P-1, maintien des limites Verify/QA B09, et revue indépendante
finale. Le Design System et les stories ne reçoivent aucun PASS par cet audit.
