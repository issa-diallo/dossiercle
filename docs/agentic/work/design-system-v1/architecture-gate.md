# Vérification du gate Architecture avant Design System

> **Réévaluation courante — 2026-10-11 : ARCHITECTURE PASS au niveau N1.**
> D81/ADR-029 résout la contradiction de chiffrement TOTP B07, avec revue
> indépendante PASS. D82 fixe les plafonds et reclassifie les essais B05-P-1/
> B06-P-1 en N2 avant activation, en maintenant les capacités non qualifiées
> en mode manuel. Les essais restent non exécutés ; leurs plafonds et suites
> sont dans la [matrice de finalisation](../../../product/ARCHITECTURE_FINALIZATION.md)
> et le [registre D82](../../../product/ARCHITECTURE_DECISIONS.md#d82).
> Le blocage décrit ci-dessous est l’instantané historique d’avant D81/D82.

Vérifié initialement le 2026-10-11 sur `382461f` après la PR #56 ; **mis à jour après la PR #60** sur `main` `4e67593`. Voir l’[audit courant du gate](../architecture-gate-2026-10-11.md), qui fait foi pour l’état et le verdict actuels.

## Verdict

**ARCHITECTURE: BLOCKED — le Design System ne peut pas recevoir de PASS de phase.**

Le constat vient de [ARCHITECTURE.md](../../../product/ARCHITECTURE.md) (`ARCHITECTURE: BLOCKED`, tableau des gates B01–B12, verdict final BLOCKED), confirmé par [STATUS.md](../../STATUS.md) et la conclusion D72 du registre [ARCHITECTURE_DECISIONS.md](../../../product/ARCHITECTURE_DECISIONS.md#d72). La PR #56 a livré le corpus et D72 ; sa revue pré-Ship précise elle-même qu’elle ne vaut pas Architecture PASS. Depuis, #60 a réconcilié B07 et l’utilisateur a approuvé la clôture locale B09 ; les décisions B02–B08 et B10 restent ouvertes.

Le choix utilisateur des technologies mentionnées dans D71/D72 est pris comme acquis : React 19, TypeScript 6, Vite 8, NestJS 12, Node.js 24, Express 5, PostgreSQL 17/Drizzle, Keycloak, Mistral et Inngest. Aucun choix n’est redemandé et aucun POC n’est relancé.

## Décisions et sorties structurantes toujours ouvertes

| Bloc | Décision, politique ou contrat qui manque avant Architecture PASS |
|---|---|
| B02 — Inngest | Avis d’usage/licence pour SaaS, éventuelle exception signée au PRD, runtime/topologie/coût et emplacement du PostgreSQL technique ; choisir et documenter la barrière d’effets. Inngest et l’auto-hébergement sont acquis, ces détails ne le sont pas. |
| B03 — reprise | Décider la stratégie exploitable de journal indépendant, point cohérent multi-stores, source de reconstruction, organisation et coût. Le seuil produit D58 (<4 h RPO/RTO en catastrophe) est acquis, sa faisabilité et son protocole ne le sont pas. |
| B04 — réseau et identité machine | Arrêter la topologie de flux inter-cloud, accès PostgreSQL, egress, identité workload, coffre, IAM et rotation. Cloud SQL PostgreSQL 17/HA/PITR est acquis, son interconnexion avec les autres cibles ne l’est pas. |
| B05 — e-mail | Arrêter les contrats/capacités par connecteur et par boîte : réception, envoi, curseur, tags de prise en charge, auteur, quotas, erreurs et mode manuel lorsque les capacités ne sont pas démontrées. |
| B06 — IA | Mistral comme fournisseur est acquis ; arrêter modèle/version et région autorisés, contrat ZDR et politique de données, offre/coûts/enveloppe/BYOK et règles de repli avant activation. |
| B07 — identité | Keycloak comme fournisseur est acquis et remplace Better Auth. Il reste à fixer le contrat d’intégration/session avec NestJS, les versions/configurations et la réalisation technique des garanties MFA/récupération D54/D05. `R-B07-01` a été réconcilié par #60 : finding historique de Better Auth 1.7.7, non transposable à Keycloak. |
| B08 — limites et données | Arrêter quotas utilisateurs/boîtes/stockage/import/pages et unité de taille, formats email, rétention active/backups/tombstones, finalités, droits et traitement/purge des pièces. |
| B09 — gate humain | Décision humaine reçue le 2026-10-11 : la qualification algorithmique locale #50/#51 est acceptée pour clôture du niveau Architecture (`QUALIFIED_LOCALLY — HUMAN_APPROVED`). Les tests PostgreSQL, crash/reprise, concurrence, transport et tzdb durable restent Verify/QA ; pas de PASS production. |
| B10 — exploitation | Arrêter disponibilité/SLO cible, couverture humaine/prestataire, alertes/escalades, runbooks et budget. RPO/RTO ne valent pas SLA. |

B01 est `CLOSED_BY_DECISION — ACCEPTED_WITH_RISK` (Cloud SQL retenu) et B12 `CLOSED_BY_DECISION` pour la stack/outillage. B11 dispose du PASS humain documentaire D69. B09 est `QUALIFIED_LOCALLY — HUMAN_APPROVED` avec preuves durables maintenues en Verify/QA. Ces statuts ne ferment pas B02–B08/B10.

## Preuves techniques qui peuvent rester en Verify/QA

L’Architecture distingue les décisions préalables des suites de livraison. Les points suivants sont des preuves planifiées plus tard ; leur absence seule ne doit pas être utilisée pour exiger que l’application existe avant Design ou pour bloquer artificiellement une décision déjà arrêtée.

| Preuve de livraison | Phase prévue | Limite actuelle |
|---|---|---|
| Cloud SQL : failover, transactions acquittées, reconnexion, PITR isolé/remise en HA, isolation des bases, droits, pools, migrations et coût observé | Verify/QA avant production (B01) | Le choix Cloud SQL demeure clos avec risque accepté ; aucune mesure n’est revendiquée. |
| Annulation, fence, vieux workers, replay, réconciliation et durabilité du moteur | Verify/QA après décision de runtime/protocole (B02) | Ne détermine pas à lui seul licence, exception PRD ou topologie. |
| Restore complet chronométré, RPO/RTO, pertes visibles, absence de doublon/de droits ressuscités | Verify/QA après stratégie de reprise arrêtée (B03) | Le seuil catastrophe est décidé ; les tests complets sont futurs, mais la stratégie/protocole doit être décidé avant Architecture PASS. |
| Connectivité, latence, failover, rotations et flux réels | Verify/QA après réseau/IAM décidés (B04) | Des preuves de capacité indispensable au choix peuvent rester un prérequis ciblé ; les mesures exhaustives sont livraison. |
| `B05-P-1` synthétique : readback, concurrence et capacités du fournisseur/boîte | Prérequis avant Architecture PASS selon Q3 (B05) | Non exécuté : aucun POC n’a été relancé. Les tests intégrés complets restent ensuite Verify/QA ; boîte sans capacité démontrée = mode manuel. |
| `B06-P-1` synthétique adapté au fournisseur Mistral | Prérequis avant sélection finale et Architecture PASS selon Q3 (B06) | Q3 pré-D72 visait Qwen/Scaleway ; ne pas l'appliquer tel quel. Adaptation à Mistral et autorisation requises ; non exécuté, aucun POC relancé ni test avec données réelles. QA intégrée des sorties, injections, coût, purge et fallback reste ensuite à faire. |
| MFA, révocation, inactivité réelle de 30 min, durée absolue de 15 j et recovery dans les parcours multi-onglets | Verify/QA après contrat Keycloak/session et récupération définis (B07) | `R-B07-01` historique Better Auth ne s’applique pas comme choix fournisseur après D72 ; exigences de sécurité métier préservées et à re-spécifier sous Keycloak. |
| Antivirus/quarantaine, purge, URL signées, caches, backups et export sur cycle complet | Verify/QA après limites, durées, finalités et stockage arrêtés (B08) | Aucun cycle réel n’est implémenté dans ce mandat. |
| Persistance PostgreSQL, crash processus, transport, workers concurrents, DST/tzdb, reconstitution durable | Verify/QA avant mise en service (B09) | La preuve locale en mémoire est acceptée pour le niveau Architecture ; l’accord humain ne qualifie pas le comportement durable. |
| Exercices d’incident, délais d’escalade et capacité réelle de mobilisation | Verify/QA/exercices après objectifs et couverture décidés (B10) | Aucun exercice ni niveau de service opérationnel n’est revendiqué. |
| Builds/tests, SBOM, scan, sécurité, parcours bout en bout, charges, OTel, promotion/rollback | Verify/QA des stories (B12 et gates G01–G08) | POC arrêté et choix stack clos par décision ; aucune dispense de sécurité, QA ou production. |

## Effet sur ce travail

L’artefact [DESIGN_SYSTEM.md](../../../product/DESIGN_SYSTEM.md) est produit comme spécification candidate consultable : direction, tokens, composants, états, exigences WCAG et exemples sont préparés sans code ni story applicative. Ce travail ne modifie pas les choix, ne prétend pas clore Architecture et n’attribue pas PASS à la phase Design System. Le verdict reste BLOCKED jusqu’à la clôture ou reclassification argumentée des sorties structurantes et au PASS Architecture documenté par son propriétaire.
