# ADR-002 — PostgreSQL distinct par agence, Drizzle et flotte maîtrisée

## Status

`ACCEPTED`

Décision utilisateur de principe ACCEPTED, pas une implémentation ni une qualification technique validée. Architecture globale **BLOCKED**. Les mécanismes de conception sont des obligations à vérifier ; détails non arbitrés et produits/outils candidats restent ouverts ou proposés, même dans cet ADR ACCEPTED.

## Date

2026-09-30

## Context

Le PRD exige une base distincte par agence, sans serveur réservé systématiquement par agence. Centraliser l'identité n'autorise pas à centraliser les messages et dossiers.

## Decision drivers

Isolation forte ; contraintes transactionnelles ; coûts/pools sous autoscaling ; migrations contrôlées et récupération agence.

## Options considered

### Option A — Bases PostgreSQL distinctes sur flotte maîtrisée, Drizzle + pg

**Pros** — Credentials et permissions propres, restauration/migrations explicitables, SQL et transactions visibles.

**Cons** — Flotte à inventorier/migrer ; nombre de pools et restauration au niveau instance à maîtriser.

### Option B — Base unique avec tenant_id ou schéma par agence

**Pros** — Moins de pools et migrations plus simples.

**Cons** — Ne satisfait pas D08 ; un filtre omis expose plusieurs agences.

### Option C — PostgreSQL par agence avec Prisma ou MikroORM

**Pros** — Prisma outillage intégré et typage ; MikroORM unité de travail riche ; alternatives viables.

**Cons** — Ne résout pas automatiquement routage/flotte/pools ; Drizzle retenu après comparaison, sans prétendre ces alternatives incompatibles serverless.

## Decision

Retenir PostgreSQL+JSONB validé/versionné et Drizzle/pg. Tables/contraintes pour relations et invariants ; binaires en objets privés. Base centrale pour registre/abonnements/modules/localisation/références secrets et, par décision D54, identité/auth centrale. Pas données dossier/email/document ni secrets fournisseur en clair au centre. Offre PG Scaleway exacte ouverte : Serverless SQL backups quotidiens 7j et sources Managed PG ne prouvent pas PITR/RPO15.

### Décisions utilisateur préservées

Le texte ci-dessous conserve les confirmations et leurs réserves ; les propositions contenues dans une décision source ne deviennent pas des validations runtime.

- **[D08](../product/ARCHITECTURE_DECISIONS.md#d08)** — PostgreSQL + JSONB, BASE DISTINCTE par agence (pas simplement schéma/tenant_id). Tables pour invariants/relations, JSONB validé/versionné pour variable. Binaires hors DB.

- **[D39](../product/ARCHITECTURE_DECISIONS.md#d39)** — Drizzle + pilote pg validé après comparaison Prisma/MikroORM. Gestion pools bornés et migrations par agence explicite, aucune isolation/migration flotte automatique supposée.

- **[D40](../product/ARCHITECTURE_DECISIONS.md#d40)** — Base centrale registre agences/abonnements/modules/localisation bases/références secrets, pas données dossier/email/document ni secrets fournisseur en clair.

## Why

L’isolation exigée reste explicite sans confondre base et machine dédiée. Drizzle permet de raisonner sur connexions et verrous ; aucune propriété de sécurité ne lui est attribuée par défaut.

## Consequences

### Positive

Frontière base agence testable, schémas relationnels pour invariants, données variables bornées.

### Negative / trade-offs

Risque multiplication de connexions et échecs partiels de migrations ; identité centrale reste composant sensible commun.

### Operational impact

Budget global connexions API/workers/auth/migrations ; pools bornés/éviction/backpressure, pas préouverture agences inactives. Provisioning saga idempotente et version par agence, canari puis lots.

## Security / data impact

Appartenance centrale avant routage ; jamais DSN venant du client. Credentials dédiés, rôle provisioning/migration séparé, objets/secrets/exports aussi cloisonnés.

- **Authentication** : requêtes humaines avec session centrale valide et MFA avant métier ; dépôt OTP séparé. Jobs autonomes avec identité workload/service authentifiée, portée limitée et mandat agence courant, sans maintenir une session utilisateur après logout/idle30. Logout ne supprime pas le mandat agence ; retraits de droits, validité des validations humaines et suspensions restent recontrôlés avant effet. Routes publiques strictement limitées, aucun bypass.
- **Authorization** : R01 et vérification courante côté services/jobs, pas droit donné par l’UI ou contenu IA.
- **Sensitive data** : minimisation, objets privés et aucun contenu brut dans traces techniques.
- **Tenant isolation** : base distincte par agence et contrôles objets/jobs/exports ; identité centrale seulement selon D54.
- **Secrets** : coffre scoped, TOTP chiffré clé hors DB, aucun réaffichage/export/log de secret.
- **Compliance** : contrats/rétention/résidence à prouver ; aucune conformité absolue ou test accompli déduit d’une page fournisseur.

## Migration / rollback

- **Migration** : Migration par base, verrou/version, sauvegarde prouvée, expansion compatible ; interruption et état partiel visibles, aucun tenant partiellement prêt activé.
- **Rollback** : Arrêter vague de migration, maintenir version compatible, restauration isolée avant remplacement autorisé ; pas DROP automatique sur échec provisioning.

## Validation et gate

QA multi-base sous charge/pools, IDOR/jobs/exports croisés, migration interrompue puis reprise et restauration agence sans données étrangères ; obtenir preuve officielle PITR/granularité.

Gates/propriétaires et preuves de sortie : **B01, B03, B04**, décrits dans [Architecture Gate](../product/ARCHITECTURE.md#architecture-gate). La clôture exige preuve et revue indépendante, pas seulement la présente recommandation. Sources techniques datées : [recherche F01–F09](../product/ARCHITECTURE_RESEARCH.md).

## Related

- PRD : [besoin et critères inchangés](../product/PRD.md).
- Story : [STORIES](../product/STORIES.md) — S01, S03, S13–S15, S28–S29, S31–S37 ; toujours BACKLOG.
- Issue : [#27](https://github.com/issa-diallo/dossiercle/issues/27).
- Architecture : [section de conception](../product/ARCHITECTURE.md#tenant-isolation).
- Previous ADR : aucun ADR antérieur dans le dépôt au début de ce travail ; voir [index](../product/ARCHITECTURE_DECISIONS.md#index-des-adr) pour dépendances transverses.
- Supersedes : aucun ADR antérieur remplacé ; les écarts au PRD/Stories et propositions conversationnelles abandonnées figurent dans [addendum](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions). Pas de réécriture du PASS Story Review historique.
