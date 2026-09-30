# ADR-001 — Monolithe modulaire TypeScript et contrats indépendants

## Status

`ACCEPTED`

Décision utilisateur de principe ACCEPTED, pas une implémentation ni une qualification technique validée. Architecture globale **BLOCKED**. Les mécanismes de conception sont des obligations à vérifier ; détails non arbitrés et produits/outils candidats restent ouverts ou proposés, même dans cet ADR ACCEPTED.

## Date

2026-09-30

## Context

Deux workflows V1 partagent contacts, dossiers, contrôle du mandat et effets externes. Les livrer avec des transactions distribuées introduirait une complexité sans besoin démontré. Le dépôt est documentaire, aucun framework n'est encore installé.

## Decision drivers

Cohérence des règles ; Sinistres avant Location ; bases distinctes ; builds frontend/backend indépendants ; coûts initiaux et maintenabilité.

## Options considered

### Option A — Monolithe modulaire NestJS, React/TypeScript/Vite, REST/OpenAPI

**Pros** — Transactions métier locales, dépendances lisibles et contrats explicites ; interface et API évoluent séparément.

**Cons** — Discipline des modules et tests de compatibilité nécessaires ; partage de déploiement métier côté backend.

### Option B — Microservices métier avec événements distribués

**Pros** — Isolation de déploiement et capacité à dimensionner chaque domaine séparément.

**Cons** — Coordination distribuée, doublons et coûts de plateforme prématurés ; rejeté V1.

### Option C — Application intégrée frontend/backend et contrats implicites

**Pros** — Moins de dépôts et d’adaptations visibles au départ.

**Cons** — Couplage de builds et contrats non vérifiables indépendamment ; pas conforme au choix utilisateur.

## Decision

Retenir le monolithe modulaire Socle/Sinistres/Gestion locative, modules activables par agence, sans n8n. Frontend React/Vite et backend NestJS TypeScript dans monorepo avec contrats partagés versionnés ; builds et déploiements distincts ne constituent pas des microservices métier. REST/OpenAPI et tâches longues asynchrones. Docker Compose local n'impose pas Compose prod. L'arborescence, pnpm et outillage tests restent propositions, pas choix utilisateur validés.

### Décisions utilisateur préservées

Le texte ci-dessous conserve les confirmations et leurs réserves ; les propositions contenues dans une décision source ne deviennent pas des validations runtime.

- **[D06](../product/ARCHITECTURE_DECISIONS.md#d06)** — Monolithe modulaire définitivement choisi après comparaison microservices. Socle + Sinistres + Gestion locative ; activables séparément par agence. Pas microservices métier V1.

- **[D07](../product/ARCHITECTURE_DECISIONS.md#d07)** — TypeScript sans n8n ; NestJS backend ; React+TypeScript+Vite frontend.

- **[D09](../product/ARCHITECTURE_DECISIONS.md#d09)** — REST + OpenAPI ; tâches longues asynchrones.

- **[D37](../product/ARCHITECTURE_DECISIONS.md#d37)** — Monorepo frontend/backend/contrats, builds ET déploiements frontend/backend indépendants avec compatibilité API vérifiée. Pas microservices métier pour autant.

- **[D38](../product/ARCHITECTURE_DECISIONS.md#d38)** — Docker Compose local avec services/reproductibilité/données fictives ; n'impose pas Compose prod.

- **[D55](../product/ARCHITECTURE_DECISIONS.md#d55)** — Ordre existant obligatoire : Sinistres avant Location, V1 deux inclus. Pas solvabilité/classement/comparaison/choix/acceptation-refus candidature/bail même brouillon. Contrôle complétude documentaire seulement ; ni IA SQL ni accès cross-agence.

- **[D57](../product/ARCHITECTURE_DECISIONS.md#d57)** — Dépôt public : docs synthétiques uniquement, pas secrets, données clients ou URL privées. PR 1 ticket/branche/commit ; pas merge sans nouvelle instruction.

## Why

Les invariants traversent les workflows ; les garder dans un même domaine simplifie leur autorisation et leur test sans empêcher une évolution ultérieure par ADR.

## Consequences

### Positive

Moins de transactions distribuées ; règles métier découplées des fournisseurs ; livraison Sinistres démontrable avant Location.

### Negative / trade-offs

Le monolithe demande des frontières d’import et de données testées ; compatibilité entre releases frontend/backend et événements à maintenir.

### Operational impact

Versionner OpenAPI/événements, surveiller latence et files ; conserver les cinq répartitions de charge du PRD, pas seulement trois paliers.

## Security / data impact

Aucun secret/pg/repository dans le bundle web. Les contrats ne sont pas une autorisation ; contrôle R01 côté serveur et exclusions Location même en brouillon.

- **Authentication** : requêtes humaines avec session centrale valide et MFA avant métier ; dépôt OTP séparé. Jobs autonomes avec identité workload/service authentifiée, portée limitée et mandat agence courant, sans maintenir une session utilisateur après logout/idle30. Logout ne supprime pas le mandat agence ; retraits de droits, validité des validations humaines et suspensions restent recontrôlés avant effet. Routes publiques strictement limitées, aucun bypass.
- **Authorization** : R01 et vérification courante côté services/jobs, pas droit donné par l’UI ou contenu IA.
- **Sensitive data** : minimisation, objets privés et aucun contenu brut dans traces techniques.
- **Tenant isolation** : base distincte par agence et contrôles objets/jobs/exports ; identité centrale seulement selon D54.
- **Secrets** : coffre scoped, TOTP chiffré clé hors DB, aucun réaffichage/export/log de secret.
- **Compliance** : contrats/rétention/résidence à prouver ; aucune conformité absolue ou test accompli déduit d’une page fournisseur.

## Migration / rollback

- **Migration** : Aucune migration actuelle. Future évolution additive API/schéma, compatibilité N/N-1 explicitement définie et testée ; ne pas inventer support illimité.
- **Rollback** : Revenir à des artefacts compatibles avec schéma/événements ; suspendre effets si ancienne version ne comprend plus une politique. Jamais code-only supposé suffisant.

## Validation et gate

Revue imports intermodules, contrat client/API, deux builds indépendants, E2E Sinistres puis Location et cinq scénarios de charge. Aucun de ces tests exécuté.

Gates/propriétaires et preuves de sortie : **B02, B04, B12**, décrits dans [Architecture Gate](../product/ARCHITECTURE.md#architecture-gate). La clôture exige preuve et revue indépendante, pas seulement la présente recommandation. Sources techniques datées : [recherche F01–F09](../product/ARCHITECTURE_RESEARCH.md).

## Related

- PRD : [besoin et critères inchangés](../product/PRD.md).
- Story : [STORIES](../product/STORIES.md) — S01–S37 ; toujours BACKLOG.
- Issue : [#27](https://github.com/issa-diallo/dossiercle/issues/27).
- Architecture : [section de conception](../product/ARCHITECTURE.md#stack-decision).
- Previous ADR : aucun ADR antérieur dans le dépôt au début de ce travail ; voir [index](../product/ARCHITECTURE_DECISIONS.md#index-des-adr) pour dépendances transverses.
- Supersedes : aucun ADR antérieur remplacé ; les écarts au PRD/Stories et propositions conversationnelles abandonnées figurent dans [addendum](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions). Pas de réécriture du PASS Story Review historique.
