# ADR-017 — Hébergement Paris et réseau privé inter-cloud

> **Autorité actuelle #63 — D73–D80 :** SUPERSEDED : proposition réseau inter-cloud non adoptée remplacée par Scaleway Paris privé, Compose mutualisé sans Kubernetes D73. [ADR-022](022-scaleway-paris-postgresql-compose.md), [matrice](../product/ARCHITECTURE_FINALIZATION.md). Le corps antérieur conserve sa provenance ; ses états ouverts/pending ou propositions contradictoires sont historiques dans cette seule portée.

## Status

PROPOSED — recommandation issue du mandat d'arbitrage du 2026-10-11 ; aucune substitution de stack adoptée.

## Date

2026-10-11

## Context

D59 impose Cloud SQL 17 Enterprise HA Paris. Le VPC Scaleway seul ne donne pas accès au réseau privé GCP.

## Decision drivers

- Respecter D71 et les invariants de sécurité/données existants.
- Choisir une option exploitable sans annoncer de preuve runtime inexistante.
- Limiter coûts fixes et risques opérationnels, sans chiffrage fictif.

## Options considered

### Option A — Scaleway Paris + Cloud SQL Paris par VPN privé

**Pros** : conserve les choix approuvés ; chemin IPsec/BGP documenté.

**Cons** : exploitation et facturation inter-cloud ; HA de bout en bout à qualifier.

### Option B — Tout déplacer chez GCP

**Pros** : réseau et identité moins fragmentés.

**Cons** : remplacerait plusieurs choix approuvés ; migration et coût non établis.

### Option C — PostgreSQL public filtré

**Pros** : accès plus simple.

**Cons** : viole la frontière privée ; rejeté.

## Decision

Recommander optionA : API Nest Serverless Containers avec Private Network, Inngest privé sur Instances actif/secours dans deux AZ Paris, Redis externe persistant à sauvegardes maîtrisées, tunnel IPsec/IKEv2 et routage BGP vers Cloud SQL privé. Exception au tout-serverless explicitement proposée. Identité inter-cloud non résolue : WIF exige émetteur fiable ; Kapsule constitue alternative documentée, aucun bootstrap sans clé revendiqué. HA et tarifs détaillés dans étude infra. GO documentaire, pas GO production.

## Why

Respecte D59 et la région choisie, sans prétendre qu’un VPC Scw suffit. La documentation VPN est une capacité, pas un test de failover.

## Consequences

### Positive

- Décision proposée concrète et écarts explicites.

### Negative / trade-offs

- Deux clouds, tunnels, egress et astreinte ; budget complet non démontré.

### Operational impact

- Configurations, responsabilité et preuves de livraison à établir dans les stories ; aucune reprise de POC.

## Security / data impact

- Authentication : TOTP obligatoire et récupération contrôlée préservés.
- Authorization : droits serveur R01 courants avant tout accès/effet ; aucun bypass.
- Sensitive data : PostgreSQL sans IP publique ; dashboard/metrics/jobs techniques privés ; sorties fournisseurs minimisées.
- Tenant isolation : base distincte par agence ; identité centrale seulement selon D54.
- Secrets : clés hors données protégées, IAM minimal, aucun secret dans logs/export.
- Compliance : conclusion documentaire bornée ; contrats et usage exact à vérifier avant réel.

## Migration / rollback

- Migration : préparation documentaire uniquement ; validation préalable de tout changement de stack.
- Rollback : retour fermé, jamais réactivation de droits/mandats/secrets supprimés ; aucune donnée réelle migrée.

## Related

- PRD : [PRD](../product/PRD.md).
- Story : [Stories](../product/STORIES.md), périmètres structurels couverts par l'arbitrage.
- Issue : identifiant local ARCH-B02-B12 ; aucune issue inventée.
- Previous ADR : [002-postgresql-par-agence-drizzle.md](002-postgresql-par-agence-drizzle.md).
- Supersedes : aucun à ce stade PROPOSED.
- Dossier et sources : [arbitrage](../agentic/work/arch-b02-b12/arbitrage-go-no-go.md).
