# ADR-012 — Audit distinct et alertes minimisées

## Status

`ACCEPTED`

Décision utilisateur de principe ACCEPTED, pas une implémentation ni une qualification technique validée. Architecture globale **BLOCKED**. Les mécanismes de conception sont des obligations à vérifier ; détails non arbitrés et produits/outils candidats restent ouverts ou proposés, même dans cet ADR ACCEPTED.

## Date

2026-09-30

## Context

La visibilité métier ne peut dépendre de traces techniques temporaires ou accessibles aux opérateurs sans contrôle. L’agence doit comprendre les actions sans recevoir secrets et contenus sensibles dans des alertes.

## Decision drivers

Tout acte important tracé dès socle ; admin audit consultable/exportable mais non modifiable ; minimisation et budget inclus réservé plateforme.

## Options considered

### Option A — Historique métier, audit append-only et traces techniques séparés

**Pros** — Accès et finalités distincts, audit durable associé aux décisions, export agence possible sans ouvrir observabilité plateforme.

**Cons** — Rétentions/volumes et cohérence de corrélation à concevoir ; résistance à falsification nécessite plus qu’un hash local.

### Option B — Logs applicatifs/Inngest comme seul audit

**Pros** — Moins de systèmes et écriture initiale facile.

**Cons** — Rétention, redaction, droit d’export et intégrité insuffisants ; Inngest ne purge pas automatiquement et n’est pas l’autorité métier.

### Option C — Tout logger en clair pour débogage ou tout envoyer en email

**Pros** — Diagnostic apparent plus rapide.

**Cons** — Secrets/documents exposés, collecte excessive ; contraire D29/D35.

## Decision

Audit séparé pour auth/support/droits/config/humains/IA/envois, lectures et écritures support comprises ; historique métier garde messages privés, traces techniques IDs/corrélations minimisées. Jamais mots de passe, API keys, TOTP, codes, documents bruts dans logs. Admin consulte/exporte audit agence sans modification/suppression UI ; purge réglementaire hors UI. Alertes importantes UI+email admin sans pièce/contenu sensible, lien application, répétitions groupées ; Qwen coûts/tokens/alertes budget plateforme uniquement. Échec audit préalable interdit action sensible.

### Décisions utilisateur préservées

Le texte ci-dessous conserve les confirmations et leurs réserves ; les propositions contenues dans une décision source ne deviennent pas des validations runtime.

- **[D29](../product/ARCHITECTURE_DECISIONS.md#d29)** — Tout doit être tracé/logger : auth, accès support, actions humaines/IA, droits/config, envois. Jamais mots de passe/clé API/TOTP/codes/documents bruts dans logs techniques. Journal audit distinct historique métier et traces Inngest.

- **[D30](../product/ARCHITECTURE_DECISIONS.md#d30)** — Admin consulte/exporte audit agence sans modifier/supprimer depuis UI ; purge réglementaire/rétention séparées.

- **[D35](../product/ARCHITECTURE_DECISIONS.md#d35)** — Alertes opérationnelles importantes UI + email admin, sans contenu sensible ni pièce, lien application, répétitions groupées. Exception budget Qwen D21 réservée plateforme.

## Why

La capacité d’expliquer et de contrôler un effet est un invariant du socle, pas un écran de fin de projet ; séparer finalités réduit exposition inutile.

## Consequences

### Positive

Audit dès S01, consultation S36 sans perte passée, support responsabilisé et alertes exploitables.

### Negative / trade-offs

Volumes et rétention à financer ; protection append-only ne signifie pas inviolabilité absolue contre admin infrastructure.

### Operational impact

Rôles écriture/lecture distincts, métriques queues/tags/latence/erreurs/incertains/pools/PRA, pas PII dans labels ; collecteur privé/OpenTelemetry proposés, produit et rétention ouverts.

## Security / data impact

Audit complet admin et historique fonctionnel R01 ne sont pas même droit. Purges autorisées tracées, corrections par événement lié, exports soumis auth/temporaire ; tests redaction/falsification.

- **Authentication** : requêtes humaines avec session centrale valide et MFA avant métier ; dépôt OTP séparé. Jobs autonomes avec identité workload/service authentifiée, portée limitée et mandat agence courant, sans maintenir une session utilisateur après logout/idle30. Logout ne supprime pas le mandat agence ; retraits de droits, validité des validations humaines et suspensions restent recontrôlés avant effet. Routes publiques strictement limitées, aucun bypass.
- **Authorization** : R01 et vérification courante côté services/jobs, pas droit donné par l’UI ou contenu IA.
- **Sensitive data** : minimisation, objets privés et aucun contenu brut dans traces techniques.
- **Tenant isolation** : base distincte par agence et contrôles objets/jobs/exports ; identité centrale seulement selon D54.
- **Secrets** : coffre scoped, TOTP chiffré clé hors DB, aucun réaffichage/export/log de secret.
- **Compliance** : contrats/rétention/résidence à prouver ; aucune conformité absolue ou test accompli déduit d’une page fournisseur.

## Migration / rollback

- **Migration** : Installer événements/audit dans chaque première story, pas attendre S36 ; versionner schémas et corrélations, garder lecture versions historiques.
- **Rollback** : Conserver journaux à changement de collecteur ; si audit indisponible bloquer actes sensibles plutôt que logs best-effort ; ne pas supprimer traces lors rollback.

## Validation et gate

Secrets canaris synthétiques absents logs/traces, refus modification/suppression UI, accès support audités, audit unavailable fail-closed, groupement alertes sans fuite tokens Qwen.

Gates/propriétaires et preuves de sortie : **B02, B08, B10, B12**, décrits dans [Architecture Gate](../product/ARCHITECTURE.md#architecture-gate). La clôture exige preuve et revue indépendante, pas seulement la présente recommandation. Sources techniques datées : [recherche F01–F09](../product/ARCHITECTURE_RESEARCH.md).

## Related

- PRD : [besoin et critères inchangés](../product/PRD.md).
- Story : [STORIES](../product/STORIES.md) — S01–S37, surtout S34–S36 ; toujours BACKLOG.
- Issue : [#27](https://github.com/issa-diallo/dossiercle/issues/27).
- Architecture : [section de conception](../product/ARCHITECTURE.md#logging--observability).
- Previous ADR : aucun ADR antérieur dans le dépôt au début de ce travail ; voir [index](../product/ARCHITECTURE_DECISIONS.md#index-des-adr) pour dépendances transverses.
- Supersedes : aucun ADR antérieur remplacé ; les écarts au PRD/Stories et propositions conversationnelles abandonnées figurent dans [addendum](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions). Pas de réécriture du PASS Story Review historique.
