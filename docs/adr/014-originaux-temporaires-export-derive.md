# ADR-014 — Originaux temporaires, provenance et export dérivé

## Status

`ACCEPTED` — décision utilisateur de principe acquise ; consolidation B11 CONSOLIDATED_PENDING_REVIEW, gate humain PENDING_HUMAN et Architecture BLOCKED. Aucun PASS runtime ou autorisation de production.

## Date

2026-10-11 (transposition, commencée le 10). Source décision : #33 du 2026-10-02.

## Context

Les décisions #33 remplacent la copie durable des messages/pièces et l’export des originaux par un suivi dérivé. Le corpus antérieur promettait EML/pièces et ne peut rester autorité courante.

## Decision drivers

Minimisation ; provenance utile ; source fournisseur ; pas copie cachée ; droits/AV/mandat inchangés.

## Options considered

### A — dérivés et originaux temporaires

**Pros** — Retenu par #33. Réduit exposition et stockage ; source identifiable.

**Cons** — Original supprimé fournisseur irrécupérable ; purge multi-systèmes et relecture coûtent ; résumé ne vaut pas justificatif.

### B — archive EML/pièces durable

**Pros** — Restitution originale indépendante de la boîte.

**Cons** — Ancien choix supplanté ; traitement durable et export non voulus.

### C — aucune extraction durable

**Pros** — Minimise davantage les données.

**Cons** — Empêche suivi/synthèse nécessaires ; non retenu.

## Decision

D62/D63/D65 fixent la portée courante. Originaux dans messagerie agence ; lecture de travail temporaire privée Paris, AV/quarantaine avant IA. DossierClé conserve faits utiles, courts résumés, synthèses, suivi et références descriptives sans URL/deep link vers mail. Le contenu intégral reçu ou envoyé ne doit pas être réintroduit via historique, job, cache, trace, export, retry ou backup. Reprise progressive uniquement période agence sans défaut ; confirmation état in-app sans mandat. Fait essentiel incertain bloque action concernée ; actions indépendantes documentées continuent. CSV/JSON export dérivé seulement, aucun EML/pièce d’origine sous aucune représentation. Droits, fenêtre de résiliation, archive 24 h et refus de re-MFA spécifique export de D42/D44 maintenus. Durées temporaires/métier/audit, politiques fournisseur et budgets restent B06/B08.

## Why

Ce choix vient des arbitrages utilisateur #33 ; il permet le suivi sans constituer une archive parallèle de la messagerie.

## Consequences

### Positive

La portée utilisateur courante devient explicite et compatible avec les Stories.

### Negative / trade-offs

Les limites des options retenues restent des contraintes ; aucune qualité/privacy/disponibilité n’est déduite de la documentation.

### Operational impact

Suppression après extraction/échec/expiration, caches/logs/retries/backups et copies fournisseur à inventorier ; pas de date inventée ici. Référence perdue visible ; droit fournisseur courant recontrôlé avant relecture ; réponse inconnue et état arrêté ne créent pas nouvelle lecture illimitée. Les enveloppes et limites sont ouvertes.

## Security / data impact

Authentification humaine centrale/MFA/session courante et identité service bornée ; R01 et mandat avant effet ; données sensibles minimisées ; base agence et coffre scoped ; secrets jamais exportés ; contrats/finalités/rétentions et privacy à qualifier avant réel. Les résumés et références peuvent rester personnels même sans original.

## Migration / rollback

Migration documentaire : appliquer les critères actuels avant Research story ; préserver texte ancien comme journal avec pointeur d’autorité. Aucune donnée/runtime migrée. Rollback : suspendre le traitement incompatible et réconcilier, jamais rétablir un ancien périmètre supprimé par simple rollback technique ; nouveau choix utilisateur/ADR requis si changement.

## Validation et gate

Critères et responsabilités [remediation](../product/ARCHITECTURE_REMEDIATION.md) ; Verify/Review indépendants de la consolidation puis décision humaine.

## Related

- PRD : [PRD](../product/PRD.md).
- Stories : [S01–S37](../product/STORIES.md), identifiants/DAG conservés.
- Issue : [#33](https://github.com/issa-diallo/dossiercle/issues/33) ; [#50](https://github.com/issa-diallo/dossiercle/issues/50) temporel.
- Previous ADR / Supersedes : ADR-007 (seule conservation originaux), ADR-009 (rétention et export EML), ADR-010/D43 (seule portée export) ; aucune abrogation des contrôles AV/PRA/session/résiliation.
- Décisions actuelles : [D60–D68](../product/ARCHITECTURE_DECISIONS.md#décisions-acquises-consolidées-le-2026-10-11--d60d68).
