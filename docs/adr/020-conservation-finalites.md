# ADR-020 — Conservation bornée par finalité

> **Autorité actuelle #63 — D73–D80 :** D77 fixe20Mo/PDFJPEGPNG/TTL24h ; métier3ans reste hypothèse juridique/contractuelle, données/audits/logs/backups distincts. [ADR-026](026-documents-retention-limites.md), [matrice](../product/ARCHITECTURE_FINALIZATION.md). Le corps antérieur conserve sa provenance ; ses états ouverts/pending ou propositions contradictoires sont historiques dans cette seule portée.

## Status

PROPOSED — recommandation issue du mandat d'arbitrage du 2026-10-11 ; aucune substitution de stack adoptée.

## Date

2026-10-11

## Context

D62 interdit originaux durables, mais durées locales et dérivées restaient ouvertes. Backups30j et export 24 h doivent rester distincts du PITR.

## Decision drivers

- Respecter D71 et les invariants de sécurité/données existants.
- Choisir une option exploitable sans annoncer de preuve runtime inexistante.
- Limiter coûts fixes et risques opérationnels, sans chiffrage fictif.

## Options considered

### Option A — Durée uniforme de cinq ans

**Pros** : politique simple.

**Cons** : conservation excessive, finalités différentes ; rejetée.

### Option B — Politique par finalité avec purge et archive sélectionnée

**Pros** : minimisation, cycle de vie explicite, restore sûr.

**Cons** : contrôles de purge et exceptions justifiées à maintenir.

## Decision

Recommander optionB et matrice complète benchmark-retention : temporaires dès fin/maximum 24 h ; rapports 90 j ; métier jusqu’à nécessité puis90j maximum selon finalité ; audit 6 mois ; diagnostics 30 j ; backups 30 j ; PITR 7 j Enterprise ; tombstones horizon réel+5j. Archive probatoire seulement sélectionnée et justifiée.

## Why

Les plafonds sont des recommandations de conception ; aucune obligation uniforme cinq ans n’est créée. Les originaux/archives réglementaires restent chez l’agence.

## Consequences

### Positive

- Décision proposée concrète et écarts explicites.

### Negative / trade-offs

- Suppression des données live et expiration backup différentes ; gestion de droits, exceptions et archives restreintes.

### Operational impact

- Configurations, responsabilité et preuves de livraison à établir dans les stories ; aucune reprise de POC.

## Security / data impact

- Authentication : TOTP obligatoire et récupération contrôlée préservés.
- Authorization : droits serveur R01 courants avant tout accès/effet ; aucun bypass.
- Sensitive data : Aucun original dans sauvegarde/log/job ; pseudonymisation n’est pas anonymisation ; restauration bloque tant que suppressions/révocations non réappliquées.
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
- Previous ADR : [014-originaux-temporaires-export-derive.md](014-originaux-temporaires-export-derive.md).
- Supersedes : aucun à ce stade PROPOSED.
- Dossier et sources : [arbitrage](../agentic/work/arch-b02-b12/arbitrage-go-no-go.md).
