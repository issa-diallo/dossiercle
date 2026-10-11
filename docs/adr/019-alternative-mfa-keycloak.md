# ADR-019 — Alternative MFA Keycloak sous conditions

> **Autorité actuelle #63 — D73–D80 :** Keycloak acquis D72 ; contrat BFF D76. KC-OTP-01 (source26.8.0) maintient B07 BLOCKED N1 : pas protectionOTP conforme inventée ou reportéeQA. [ADR-025](025-keycloak-bff-protection-otp.md), [matrice](../product/ARCHITECTURE_FINALIZATION.md). Le corps antérieur conserve sa provenance ; ses états ouverts/pending ou propositions contradictoires sont historiques dans cette seule portée.

> **Autorité actuelle D72 :** Keycloak adopté en remplacement de Better Auth. Protection TOTP D54 à résoudre dans la conception/livraison ; aucune exigence affaiblie et aucun runtime qualifié. Les recommandations et réserves ci-dessous restent des éléments de conception et des conditions de livraison ; les formulations « proposer »/« non adopté » antérieures sont supersédées pour le choix outil uniquement. [D72](../product/ARCHITECTURE_DECISIONS.md#d72).

## Status

ACCEPTED — choix humain D72 du 2026-10-11. Keycloak adopté en remplacement de Better Auth. Protection TOTP D54 à résoudre dans la conception/livraison ; aucune exigence affaiblie et aucun runtime qualifié.

## Date

2026-10-11

## Context

Better Auth 1.7.7 natif ne respecte pas les secours irréversibles de B07. Changer ce choix exige validation ; D54 reste intact.

## Decision drivers

- Respecter D71 et les invariants de sécurité/données existants.
- Choisir une option exploitable sans annoncer de preuve runtime inexistante.
- Limiter coûts fixes et risques opérationnels, sans chiffrage fictif.

## Options considered

### Option A — Better Auth natif inchangé

**Pros** : conserve D71 et intégration TypeScript.

**Cons** : liste de secours récupérable ; NO GO à exigence inchangée.

### Option B — Keycloak 26.8.0

**Pros** : secours réellement hashés, verrou optimiste credentials, Apache 2.0.

**Cons** : TOTP secretData sans chiffrement applicatif natif identifié ; runtime Java et exploitation.

### Option C — ZITADEL 4.19.4

**Pros** : secours hashés et TOTP chiffré avec clé séparée.

**Cons** : réserve de concurrence dans la source, AGPL/commercial. Authentik/Kratos examinés ne corrigent pas les secours bruts.

## Decision

Proposer Keycloak central comme candidat prioritaire, OIDC Code+PKCE backend, session application opaque NestJS. PAS de GO global avant résolution documentée de protection TOTP D54 ; aucune détente D54 ni auth maison adoptée.

## Why

Le correctif secours est prouvé par source immutable. Une alternative ne devient pas conforme en déplaçant le défaut vers TOTP. Rechercher protection native/supportée conforme ou revenir à un autre candidat ; tout arbitrage D54 doit être explicite et validé.

## Consequences

### Positive

- Décision proposée concrète et écarts explicites.

### Negative / trade-offs

- Service central persistant, gestion des invitations/révocations/backchannel et UX secours séquentiels ; disponibilité, sessions et concurrence à vérifier à livraison.

### Operational impact

- Configurations, responsabilité et preuves de livraison à établir dans les stories ; aucune reprise de POC.

## Security / data impact

- Authentication : TOTP obligatoire et récupération contrôlée préservés.
- Authorization : droits serveur R01 courants avant tout accès/effet ; aucun bypass.
- Sensitive data : Aucun token IdP dans navigateur ; protection physique DB/WAL/backups ne prouve pas chiffrement applicatif du TOTP contre lecture SQL/dump.
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
- Previous ADR : [003-identite-centrale-better-auth-mfa.md](003-identite-centrale-better-auth-mfa.md).
- Supersedes : ADR003 et D71 sur le choix Better Auth seulement ; D54 et autres invariants préservés.
- Dossier et sources : [arbitrage](../agentic/work/arch-b02-b12/arbitrage-go-no-go.md).
