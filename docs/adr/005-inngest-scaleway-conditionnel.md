# ADR-005 — Inngest auto-hébergé Scaleway sous conditions

## Status

`PROPOSED`

Préférence utilisateur conditionnelle, non décision de mise en production ; Inngest Cloud demeure exclu. Architecture globale **BLOCKED**. Les mécanismes de conception sont des obligations à vérifier ; détails non arbitrés et produits/outils candidats restent ouverts ou proposés, y compris dans cet ADR PROPOSED.

## Date

2026-09-30

## Context

Les attentes/retries exigent une orchestration persistante. L'utilisateur impose son hébergement chez Scaleway, mais l'ancien PRD demande tout managé/serverless à l'usage. Cette divergence n'est pas effacée.

## Decision drivers

Persistance et reprise ; pas Inngest Cloud ; confidentialité payloads ; coût et capacité exploitation ; licence compatible SaaS.

## Options considered

### Option A — Inngest serveur auto-hébergé avec PG/Redis externes chez Scaleway

**Pros** — Orchestration proche des données, SDK/attentes/retries disponibles et hébergement choisi respecté.

**Cons** — Runtime persistant, licence SSPL serveur, HA/backups/rétention et coûts à exploiter ; non qualifié.

### Option B — Inngest Cloud ou autre orchestrateur SaaS

**Pros** — Exploitation serveur déléguée et montée en charge facilitée.

**Cons** — Inngest Cloud explicitement exclu ; pas substitution sans nouvelle décision utilisateur.

### Option C — Jobs PostgreSQL maison ou autre moteur chez Scaleway

**Pros** — Licence/architecture éventuellement différentes, maîtrise complète.

**Cons** — Reconstruire/qualifier timers, concurrence et reprise ; alternative de réarbitrage seulement, pas décision implicite.

## Decision

Privilégier Inngest auto-hébergé chez Scaleway, garder PROPOSED tant que licence, runtime/coût, réseau, HA et preuves ne sont pas fermés. Serveur SSPL v1, clause de transition Apache après trois ans par code/version ; SDK Apache distinct. Avis usage SaaS embarqué à obtenir, pas 'libre donc validé'. PG configuration/historique et Redis queue/run-state externes ; défaut SQLite/mémoire non preuve prod. Pas purge PG automatique : rétention des events/étapes/traces à concevoir. Événements opaques minimisés, aucune pièce/secret/URL signée. Annulation ne coupe pas étape courante : ADR-006 obligatoire.

### Décisions utilisateur préservées

Le texte ci-dessous conserve les confirmations et leurs réserves ; les propositions contenues dans une décision source ne deviennent pas des validations runtime.

- **[D52](../product/ARCHITECTURE_DECISIONS.md#d52)** — Inngest : utilisateur impose orchestration CHEZ SCALEWAY, pas Inngest Cloud. Inngest auto-hébergé privilégié sous conditions licence SSPL/future Apache, infra persistante coût, tests QA. Ne pas présenter validé prod/100% serverless. Choix crée arbitrage explicite ancien PRD tout managé/serverless, aucun changement silencieux. Exception potentielle de runtime persistant plateforme (pas serveur/agence) acceptation dimensionnement ouverte.

## Why

Le candidat satisfait la préférence utilisateur sans masquer des coûts et responsabilités permanents incompatibles avec une promesse 100 % serverless déjà validée.

## Consequences

### Positive

Durabilité/attentes peuvent être standardisées ; domaine reste indépendant des callbacks.

### Negative / trade-offs

Coût fixe et capacité opérateur réels ; dépendance licence/version ; état technique supplémentaire à restaurer.

### Operational impact

Dimensionner service persistant plateforme, pas un serveur/agence. Serverless Containers egress privé seulement : ingress callbacks HTTPS signé/anti-rejeu ou runtime adapté à qualifier. Dashboard/replay restreints/audités.

## Security / data impact

Authentifier chaque callback sur corps brut, anti-rejeu, résolution agence et autorisation métier ; ne jamais confier aux traces Inngest le rôle d’audit. IAM/coffre séparés, exports techniques minimisés.

- **Authentication** : requêtes humaines avec session centrale valide et MFA avant métier ; dépôt OTP séparé. Jobs autonomes avec identité workload/service authentifiée, portée limitée et mandat agence courant, sans maintenir une session utilisateur après logout/idle30. Logout ne supprime pas le mandat agence ; retraits de droits, validité des validations humaines et suspensions restent recontrôlés avant effet. Routes publiques strictement limitées, aucun bypass.
- **Authorization** : R01 et vérification courante côté services/jobs, pas droit donné par l’UI ou contenu IA.
- **Sensitive data** : minimisation, objets privés et aucun contenu brut dans traces techniques.
- **Tenant isolation** : base distincte par agence et contrôles objets/jobs/exports ; identité centrale seulement selon D54.
- **Secrets** : coffre scoped, TOTP chiffré clé hors DB, aucun réaffichage/export/log de secret.
- **Compliance** : contrats/rétention/résidence à prouver ; aucune conformité absolue ou test accompli déduit d’une page fournisseur.

## Migration / rollback

- **Migration** : Prototype QA isolé puis accord exception PRD ; abstraire déclenchement/attente et conserver outbox/ledger dans DB agence pour migration moteur future.
- **Rollback** : Stopper déclenchements/effets, conserver état/outbox/intentions ; réconciliation avant moteur remplacé ou retour version. Aucun replay automatique après restauration.

## Validation et gate

Avis licence versionné, coût/topologie/HA/rétention, panne Redis/PG/réseau, cancellation étape en cours/replay, restore cohérent RPO/RTO et barrière anti-stale. Rien exécuté.

Gates/propriétaires et preuves de sortie : **B02, B03, B04**, décrits dans [Architecture Gate](../product/ARCHITECTURE.md#architecture-gate). La clôture exige preuve et revue indépendante, pas seulement la présente recommandation. Sources techniques datées : [recherche F01–F09](../product/ARCHITECTURE_RESEARCH.md).

## Related

- PRD : [besoin et critères inchangés](../product/PRD.md).
- Story : [STORIES](../product/STORIES.md) — S03, S09, S12–S21, S25–S27, S31–S35 ; toujours BACKLOG.
- Issue : [#27](https://github.com/issa-diallo/dossiercle/issues/27).
- Architecture : [section de conception](../product/ARCHITECTURE.md#async--queues--jobs).
- Previous ADR : aucun ADR antérieur dans le dépôt au début de ce travail ; voir [index](../product/ARCHITECTURE_DECISIONS.md#index-des-adr) pour dépendances transverses.
- Supersedes : aucun ADR antérieur remplacé ; les écarts au PRD/Stories et propositions conversationnelles abandonnées figurent dans [addendum](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions). Pas de réécriture du PASS Story Review historique.
