# ADR-021 — Fournisseur IA compatible avec la conservation proposée

> **Autorité actuelle #63 — D73–D80 :** Mistral/ZDR acquis D72 ; D78 route statelessEU/budgets et candidats, preuves ZDR/contrats/région avant réel, benchmark qualité N2. [ADR-027](027-mistral-budget-qualification.md), [matrice](../product/ARCHITECTURE_FINALIZATION.md). Le corps antérieur conserve sa provenance ; ses états ouverts/pending ou propositions contradictoires sont historiques dans cette seule portée.

> **Autorité actuelle D72 :** Mistral adopté comme fournisseur IA, voie stateless ZDR. Preuves compte/contrat/région avant données réelles ; modèle/version exacts non adoptés. Les recommandations et réserves ci-dessous restent des éléments de conception et des conditions de livraison ; les formulations « proposer »/« non adopté » antérieures sont supersédées pour le choix outil uniquement. [D72](../product/ARCHITECTURE_DECISIONS.md#d72).

## Status

ACCEPTED — choix humain D72 du 2026-10-11. Mistral adopté comme fournisseur IA, voie stateless ZDR. Preuves compte/contrat/région avant données réelles ; modèle/version exacts non adoptés.

## Date

2026-10-11

## Context

Scaleway GenAPI autorise certains contenus HTTP deux semaines et cache non désactivable. Ce traitement ne satisfait pas le plafond strict proposé, sans contrat dérogatoire.

## Decision drivers

- Respecter D71 et les invariants de sécurité/données existants.
- Choisir une option exploitable sans annoncer de preuve runtime inexistante.
- Limiter coûts fixes et risques opérationnels, sans chiffrage fictif.

## Options considered

### Option A — Scaleway Generative APIs standard

**Pros** : hébergement et catalogue déjà envisagés, pas entraînement annoncé.

**Cons** : exception rétention/caches incompatible avec politique stricte ; NO GO sous cette contrainte.

### Option B — Mistral stateless ZDR

**Pros** : mécanisme ZDR documenté pour chat/OCR couverts.

**Cons** : activation compte et opt-out distincts ; région EU inclut EFTA ; contrats/traitements hors région à établir.

### Option C — Inférence privée France ou humain

**Pros** : pas de contenu vers API non conforme.

**Cons** : exploitation GPU, modèle/licence/qualité/coût non qualifiés ; manuel n’offre pas autonomie IA.

## Decision

Proposer Mistral stateless avec ZDR prouvé, entraînement désactivé et engagement régional compatible comme voie prioritaire. NO GO d’exploitation tant que preuves manquent. Si conditions échouent, inférence privée ou mode humain ; jamais fallback automatique incompatible.

## Why

Aucun fournisseur n’est déclaré illégal. Le verdict vise le traitement sous nos limites. Changer de modèle dans la même API ne supprime pas sa politique de stockage.

## Consequences

### Positive

- Décision proposée concrète et écarts explicites.

### Negative / trade-offs

- Modèle et endpoints régionaux à choisir ; BYOK ne dispense pas des preuves du compte ; pas de dépense/contact autorisé par cette note.

### Operational impact

- Configurations, responsabilité et preuves de livraison à établir dans les stories ; aucune reprise de POC.

## Security / data impact

- Authentication : TOTP obligatoire et récupération contrôlée préservés.
- Authorization : droits serveur R01 courants avant tout accès/effet ; aucun bypass.
- Sensitive data : Pas uploads/files/batch/agents stateful non couverts ; contrôle sous-traitants/support ; données sensibles exclues sans base/contrat adaptés.
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
- Previous ADR : [008-ia-catalogue-budget-byok.md](008-ia-catalogue-budget-byok.md).
- Supersedes : ADR008 sur le choix fournisseur Scaleway Generative APIs seulement ; contraintes métier/budgets/BYOK préservées.
- Dossier et sources : [arbitrage](../agentic/work/arch-b02-b12/arbitrage-go-no-go.md).
