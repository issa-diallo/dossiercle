# ADR-004 — Autorisation R01, mandat révocable et accès support consenti

## Status

`ACCEPTED`

Décision utilisateur de principe ACCEPTED, pas une implémentation ni une qualification technique validée. Architecture globale **BLOCKED**. Les mécanismes de conception sont des obligations à vérifier ; détails non arbitrés et produits/outils candidats restent ouverts ou proposés, même dans cet ADR ACCEPTED.

## Date

2026-09-30

## Context

Les humains et agents peuvent agir sur le même dossier. Un rôle, un tag ou un contenu reçu ne constitue pas une autorisation suffisante ; plateforme et agence ont des pouvoirs séparés.

## Decision drivers

R01 intacte ; attribution durable distincte de prise temporaire ; restrictions agence prioritaires ; aucun support métier implicite.

## Options considered

### Option A — Politiques serveur centrales appliquées dans chaque service/effet

**Pros** — Même règle API/jobs, refus à chaque frontière, restrictions versionnées et traçables.

**Cons** — Concurrence révocation/envoi et cohérence centre/base agence doivent être spécifiées et prouvées.

### Option B — RBAC dans interface ou contrôleurs seulement

**Pros** — Mise en œuvre initiale plus courte.

**Cons** — Jobs/accès directs contournent masquage ; attribution/action/version manquent ; rejeté.

### Option C — Super-admin plateforme impersonnant toute agence

**Pros** — Support plus rapide pour opérateur.

**Cons** — Viole D28 et R01 ; lecture ou écriture sans consentement/audit interdite.

## Decision

R01 reste exacte : admin gère mandat/comptes, habilité périmètre explicite, standard dossiers attribués. Validation exige action attribuée et droits courants même pour admin. Revalider session/agence/droits/objet/prise/mandat avant lecture sensible, mutation et effet. Trois modes et invalidations déterministes, nouvelle fonction désactivée ; aucun task invalidé ressuscité. Support exceptionnel sur accord agence, motif/périmètre/temps bornés, lectures et écritures auditées, pas admin agence implicite.

### Décisions utilisateur préservées

Le texte ci-dessous conserve les confirmations et leurs réserves ; les propositions contenues dans une décision source ne deviennent pas des validations runtime.

- **[D28](../product/ARCHITECTURE_DECISIONS.md#d28)** — Support accès métier exceptionnel seulement accord explicite agence, borné motif/périmètre/temps, lecture ET écriture auditées. Admin plateforme pas admin agence implicite.

- **[D56](../product/ARCHITECTURE_DECISIONS.md#d56)** — Matrice rôles R01 Stories inchangée : admin/habilité/standard attributions, pas droits implicites. Prise exclusive, mandat trois modes et invalidations déterministes, tags avant première action autonome, source lu/non lu jamais vérité.

## Why

Rôles seuls ne décrivent ni attribution ni autorisation au moment de l’effet ; une politique partagée réduit les divergences entre humains, agents et jobs.

## Consequences

### Positive

Refus identiques aux frontières ; décisions explicables et révocables ; support contrôlable.

### Negative / trade-offs

Plus de données de politique et tests de courses ; besoin d’approbation disponible pour support, pas de bypass de commodité.

### Operational impact

Versions de droits/mandat, file admin pour non-attribués, invalidation au retrait, audit obligatoire dès S01. Grant support expire/révoque aussi jobs et URLs.

## Security / data impact

Lecture filtrée aussi sur compteurs/recherches/rapports/export. Un email ou résultat IA n’autorise rien. Aucune permission cross-agence ou auto-attribution. Réactivation habilité ne lève pas suspension admin.

- **Authentication** : requêtes humaines avec session centrale valide et MFA avant métier ; dépôt OTP séparé. Jobs autonomes avec identité workload/service authentifiée, portée limitée et mandat agence courant, sans maintenir une session utilisateur après logout/idle30. Logout ne supprime pas le mandat agence ; retraits de droits, validité des validations humaines et suspensions restent recontrôlés avant effet. Routes publiques strictement limitées, aucun bypass.
- **Authorization** : R01 et vérification courante côté services/jobs, pas droit donné par l’UI ou contenu IA.
- **Sensitive data** : minimisation, objets privés et aucun contenu brut dans traces techniques.
- **Tenant isolation** : base distincte par agence et contrôles objets/jobs/exports ; identité centrale seulement selon D54.
- **Secrets** : coffre scoped, TOTP chiffré clé hors DB, aucun réaffichage/export/log de secret.
- **Compliance** : contrats/rétention/résidence à prouver ; aucune conformité absolue ou test accompli déduit d’une page fournisseur.

## Migration / rollback

- **Migration** : Transcrire R01 en matrice tests et politiques serveur versionnées ; addendum produit revu avant Research/Design, pas nouveau rôle implicite.
- **Rollback** : Fail-closed si politique inconnue ; suspendre effets et révoquer grants, ne pas restaurer ancienne version permissive ou autorisation expirée.

## Validation et gate

Matrice deux agences/trois rôles/attribué-non attribué ; course validation-révocation/stop-takeover ; support lecture/écriture après expiration ; tags humains auteur inconnu bloquants.

Gates/propriétaires et preuves de sortie : **B02, B07, B11**, décrits dans [Architecture Gate](../product/ARCHITECTURE.md#architecture-gate). La clôture exige preuve et revue indépendante, pas seulement la présente recommandation. Sources techniques datées : [recherche F01–F09](../product/ARCHITECTURE_RESEARCH.md).

## Related

- PRD : [besoin et critères inchangés](../product/PRD.md).
- Story : [STORIES](../product/STORIES.md) — S01–S37, spécialement S05–S06, S10–S12, S16–S18, S35–S36 ; toujours BACKLOG.
- Issue : [#27](https://github.com/issa-diallo/dossiercle/issues/27).
- Architecture : [section de conception](../product/ARCHITECTURE.md#authorization).
- Previous ADR : aucun ADR antérieur dans le dépôt au début de ce travail ; voir [index](../product/ARCHITECTURE_DECISIONS.md#index-des-adr) pour dépendances transverses.
- Supersedes : aucun ADR antérieur remplacé ; les écarts au PRD/Stories et propositions conversationnelles abandonnées figurent dans [addendum](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions). Pas de réécriture du PASS Story Review historique.
