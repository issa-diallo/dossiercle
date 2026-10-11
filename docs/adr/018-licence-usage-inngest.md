# ADR-018 — Conserver Inngest sous frontière de licence explicite

> **Autorité actuelle D72 :** Inngest conservé et choix moteur clos. La qualification SSPL de l’usage/version demeure une condition de mise en service, sans avis définitif ni nouvelle adoption de runtime. Les recommandations et réserves ci-dessous restent des éléments de conception et des conditions de livraison ; les formulations « proposer »/« non adopté » antérieures sont supersédées pour le choix outil uniquement. [D72](../product/ARCHITECTURE_DECISIONS.md#d72).

## Status

ACCEPTED — choix humain D72 du 2026-10-11. Inngest conservé et choix moteur clos. La qualification SSPL de l’usage/version demeure une condition de mise en service, sans avis définitif ni nouvelle adoption de runtime.

## Date

2026-10-11

## Context

D71 adopte le moteur, pas sa licence ni son exploitation. Le serveur courant est SSPL avec licence future Apache 2.0, distinct du SDK.

## Decision drivers

- Respecter D71 et les invariants de sécurité/données existants.
- Choisir une option exploitable sans annoncer de preuve runtime inexistante.
- Limiter coûts fixes et risques opérationnels, sans chiffrage fictif.

## Options considered

### Option A — Inngest auto-hébergé comme moteur interne

**Pros** : conserve D71, orchestration adaptée, SDK déjà choisi.

**Cons** : clause 13 à qualifier, service persistant PG/Redis et purge à exploiter.

### Option B — Temporal auto-hébergé

**Pros** : alternative de workflows durable ; licence à qualifier par distribution.

**Cons** : changement de stack et exploitation plus lourde, aucune migration qualifiée.

### Option C — BullMQ

**Pros** : file de jobs plus simple.

**Cons** : timers, historique, récupération et garanties à construire ; pas substitution équivalente automatique.

## Decision

Recommander de conserver Inngest auto-hébergé, backend interne uniquement, interfaces non proposées aux clients comme moteur. GO technique conditionnel ; ne pas clore la qualification licence avant examen du binaire/version et usage précis.

## Why

SSPL ne signifie pas interdiction de tout SaaS ; clause 13 vise la fonctionnalité proposée comme service et exige un examen de la frontière réelle. Si incompatible, Temporal devient candidat à ADR de remplacement ; aucune adoption implicite.

## Consequences

### Positive

- Décision proposée concrète et écarts explicites.

### Negative / trade-offs

- Support direct non garanti, coût PG/Redis/HA ; risque juridique non éliminé par privatisation réseau seule.

### Operational impact

- Configurations, responsabilité et preuves de livraison à établir dans les stories ; aucune reprise de POC.

## Security / data impact

- Authentication : TOTP obligatoire et récupération contrôlée préservés.
- Authorization : droits serveur R01 courants avant tout accès/effet ; aucun bypass.
- Sensitive data : Jobs contiennent références opaques, pas email/pièce/prompt original ; rétention explicite, pas purge supposée automatique.
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
- Previous ADR : [005-inngest-scaleway-conditionnel.md](005-inngest-scaleway-conditionnel.md).
- Supersedes : aucune substitution du moteur ; confirme Inngest D71/D72.
- Dossier et sources : [arbitrage](../agentic/work/arch-b02-b12/arbitrage-go-no-go.md).
