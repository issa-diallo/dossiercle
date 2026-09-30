# ADR-013 — QA isolée, promotion humaine et rollback compatible

## Status

`ACCEPTED`

Décision utilisateur de principe ACCEPTED, pas une implémentation ni une qualification technique validée. Architecture globale **BLOCKED**. Les mécanismes de conception sont des obligations à vérifier ; détails non arbitrés et produits/outils candidats restent ouverts ou proposés, même dans cet ADR ACCEPTED.

## Date

2026-09-30

## Context

Le dépôt ne contient que documents/méthode, pas code/runtime ni CI applicative. La conception doit fixer une promotion sûre sans présenter ses outils proposés comme installés.

## Decision drivers

Aucun client réel contacté en QA ; même artefact validé promu ; accord propriétaire ; rollback schéma/jobs/données compatible ; preuves LARGE.

## Options considered

### Option A — Dév/tests puis QA isolée et promotion digests après accord humain

**Pros** — Évaluation représentative sans contamination prod, artefacts traçables et retour contrôlé.

**Cons** — Environnement et clés supplémentaires, coûts QA et discipline migration/compatibilité.

### Option B — Tests locaux seulement puis build neuf en production

**Pros** — Moins de coût et opérations.

**Cons** — Ne prouve pas intégration réelle et change artefact validé ; interdit par D36.

### Option C — QA partageant boîtes/DB/objets/keys production

**Pros** — Données et connecteurs déjà disponibles.

**Cons** — Risque contact client/fuite/collision jobs ; ne constitue pas QA distincte.

## Decision

QA distincte par URL, DB, stockage, clés, mailboxes et environnement orchestrateur, fixtures synthétiques et egress/destinataires de test. Développement→tests→QA→accord humain propriétaire→production, mêmes artefacts immuables. Builds/deploys frontend/backend indépendants avec contrats compatibles. Rollback teste schéma/données/événements/jobs ; retour code seul insuffisant. Compose local seulement. GitHub Actions/pnpm/Vitest/Playwright/k6/OTel sont propositions techniques, versions/compatibilité à qualifier B12, aucune installation ou CI verte revendiquée.

### Décisions utilisateur préservées

Le texte ci-dessous conserve les confirmations et leurs réserves ; les propositions contenues dans une décision source ne deviennent pas des validations runtime.

- **[D36](../product/ARCHITECTURE_DECISIONS.md#d36)** — QA véritablement distincte (URL, DB, stockage, clés, mailboxes, environnements orchestrateur), synthétique, aucun vrai client contacté. Dév -> tests -> QA -> accord humain propriétaire -> prod. Même artefact validé promu, migration/rollback compatibles, pas retour arrière code seul supposé suffisant.

## Why

La preuve doit concerner ce qui est promu, sans sacrifier isolation ni sécurité pour commodité ; tests documentaires ne prouvent pas application.

## Consequences

### Positive

Preuves reproductibles, séparation responsabilités auteur/reviewer et approbateur, restauration pensée avant production.

### Negative / trade-offs

Maintien d’un environnement supplémentaire et suites lentes ; migration flotte et jobs longs compliquent rollback.

### Operational impact

Version/digest et résultats bruts, secret scan/dépendances/licences, unitaires/intégration/contrats/E2E/sécurité/charge/PRA ; cold start séparé et cinq distributions exactes PRD. QA→prod jamais nouvelle compilation différente.

## Security / data impact

Secrets distincts et aucune donnée client, mail sink/allowlist vérifiée ; accord humain et rollback jamais contournement MFA/isolation. Architecture BLOCKED et Design System non commencé.

- **Authentication** : requêtes humaines avec session centrale valide et MFA avant métier ; dépôt OTP séparé. Jobs autonomes avec identité workload/service authentifiée, portée limitée et mandat agence courant, sans maintenir une session utilisateur après logout/idle30. Logout ne supprime pas le mandat agence ; retraits de droits, validité des validations humaines et suspensions restent recontrôlés avant effet. Routes publiques strictement limitées, aucun bypass.
- **Authorization** : R01 et vérification courante côté services/jobs, pas droit donné par l’UI ou contenu IA.
- **Sensitive data** : minimisation, objets privés et aucun contenu brut dans traces techniques.
- **Tenant isolation** : base distincte par agence et contrôles objets/jobs/exports ; identité centrale seulement selon D54.
- **Secrets** : coffre scoped, TOTP chiffré clé hors DB, aucun réaffichage/export/log de secret.
- **Compliance** : contrats/rétention/résidence à prouver ; aucune conformité absolue ou test accompli déduit d’une page fournisseur.

## Migration / rollback

- **Migration** : Canari et expansion/transition/contraction, compatibilité API/DB/job ; revue migration avant lot, arrêt dès échec, mêmes artefacts promus.
- **Rollback** : Stopper effets autonomes, revenir artefact compatible ou roll-forward/restore autorisé, réconcilier sorties et générations ; pas annulation d’e-mails déjà envoyés.

## Validation et gate

Actuellement contrôles docs uniquement ; futures evidence app/build/API/browser/charge/PRA obligatoires, aucun Critical/Major ouvert, reviewer indépendant et accord humain avant prod.

Gates/propriétaires et preuves de sortie : **B01–B12 selon composant ; revue indépendante**, décrits dans [Architecture Gate](../product/ARCHITECTURE.md#architecture-gate). La clôture exige preuve et revue indépendante, pas seulement la présente recommandation. Sources techniques datées : [recherche F01–F09](../product/ARCHITECTURE_RESEARCH.md).

## Related

- PRD : [besoin et critères inchangés](../product/PRD.md).
- Story : [STORIES](../product/STORIES.md) — S01–S37 ; G01–G08 ; toujours BACKLOG.
- Issue : [#27](https://github.com/issa-diallo/dossiercle/issues/27).
- Architecture : [section de conception](../product/ARCHITECTURE.md#deployment).
- Previous ADR : aucun ADR antérieur dans le dépôt au début de ce travail ; voir [index](../product/ARCHITECTURE_DECISIONS.md#index-des-adr) pour dépendances transverses.
- Supersedes : aucun ADR antérieur remplacé ; les écarts au PRD/Stories et propositions conversationnelles abandonnées figurent dans [addendum](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions). Pas de réécriture du PASS Story Review historique.
