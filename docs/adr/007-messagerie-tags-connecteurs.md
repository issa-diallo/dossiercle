# ADR-007 — Trois connecteurs e-mail pilotes et tags comme précondition

## Status

`ACCEPTED`

Décision utilisateur de principe ACCEPTED, pas une implémentation ni une qualification technique validée. Architecture globale **BLOCKED**. Les mécanismes de conception sont des obligations à vérifier ; détails non arbitrés et produits/outils candidats restent ouverts ou proposés, même dans cet ADR ACCEPTED.

## Date

2026-09-30

## Context

L’agence pilote n’est pas connue et peut utiliser Gmail, Microsoft 365 ou IMAP/SMTP. L’application n’est pas le seul lieu de coordination humaine.

## Decision drivers

Couverture V1 sans retrait fournisseur ; tags avant première autonomie ; original/provenances conservés ; identité/source fiables.

## Options considered

### Option A — Adaptateurs Gmail, Microsoft 365, IMAP/SMTP avec matrice capacités

**Pros** — Sémantique commune, tests identiques et qualification séparée réception/envoi/marquage.

**Cons** — Trois intégrations et leurs scopes/quotas/renouvellements ; IMAP varie selon fournisseur/client.

### Option B — Gmail seul puis autres plus tard

**Pros** — Pilote technique plus simple et rapide.

**Cons** — Retrait silencieux de connecteurs requis ; rejeté sans nouvelle instruction.

### Option C — Connexion universelle IMAP et lu/non lu comme statut

**Pros** — Protocole réception largement connu.

**Cons** — SMTP distinct, keywords/client non universels ; lu/non lu n’est pas vérité métier, option rejetée.

## Decision

Préserver les trois connecteurs dès pilote. OAuth authentifié et scoped agence pour Gmail/M365, IMAP et SMTP TLS qualifiés séparément. Sept états/tags PRD inchangés. Tag IA confirmé avant première action autonome, panne ultérieure bloque aussi ; tag humain stoppe avant prochaine action même sans auteur connu. Aucun marqueur fiable : connexion/manuel possibles mais autonomie bloquée. Source originale et curseurs/provenances durables, dédup scoped agence. Push Gmail implique Pub/Sub à qualifier, non moteur métier hors Scaleway ; polling borné alternative seulement avec preuve de fraîcheur tags.

### Bootstrap et course des tags

Le tag initial IA est un effet protégé mais ne requiert pas sa propre confirmation préalable : boîte autorisée, prise/version/fence actuels et absence de prise humaine/suspension sont vérifiés avant son écriture. Readback confirme ensuite le tag et devient précondition de la première sortie autonome. Le marquage humain/arrêt reflète l'état courant même sous suspension ; il n'autorise pas l'IA. Un worker périmé ne peut remettre IA en cours après transfert humain. Si sa requête avait déjà commencé, son résultat tardif n'est pas une autorisation : invalider confirmation, maintenir autonomie bloquée et réconcilier vers humain avant readback courant. Tester bootstrap, échec readback et course ancien marquage IA/prise humaine. Voir [matrice par type](../product/ARCHITECTURE.md#préconditions-typées-des-effets), sans exception générique à la barrière.

### Décisions utilisateur préservées

Le texte ci-dessous conserve les confirmations et leurs réserves ; les propositions contenues dans une décision source ne deviennent pas des validations runtime.

- **[D13](../product/ARCHITECTURE_DECISIONS.md#d13)** — Gmail, Microsoft 365 ET IMAP/SMTP accessibles au pilote V1, agence pilote inconnue. Pas de retrait silencieux d'un connecteur. Capacités tags à prouver, autonomie bloquée si impossibles.

## Why

Les différences fournisseur appartiennent aux adaptateurs, pas aux règles de sécurité ; les capacités non prouvées ne sont pas remplacées par des comportements moins sûrs.

## Consequences

### Positive

Pas de perte du besoin multi-boîtes ; coordination visible dans boîte et produit ; dégradation fail-closed.

### Negative / trade-offs

Tag humain observé avec délai réseau, fraîcheur à prouver ; pas promesse de visibilité universelle immédiate ; dépendance Google Pub/Sub possible.

### Operational impact

Renew watch/subscriptions, delta/history/UID et curseurs ; catégories Graph PATCH Mail.ReadWrite, envoi Mail.Send distinct ; préserver catégories étrangères et read/unread. Gmail nouveaux messages de thread à re-taguer si nécessaire.

## Security / data impact

Authenticité callbacks/webhooks et anti-rejeu, OAuth state/session/agence, scopes minimaux ; Reply-To/usurpation contrôlés ; URLs IMAP/SMTP protégées contre SSRF et rebinding.

- **Authentication** : requêtes humaines avec session centrale valide et MFA avant métier ; dépôt OTP séparé. Jobs autonomes avec identité workload/service authentifiée, portée limitée et mandat agence courant, sans maintenir une session utilisateur après logout/idle30. Logout ne supprime pas le mandat agence ; retraits de droits, validité des validations humaines et suspensions restent recontrôlés avant effet. Routes publiques strictement limitées, aucun bypass.
- **Authorization** : R01 et vérification courante côté services/jobs, pas droit donné par l’UI ou contenu IA.
- **Sensitive data** : minimisation, objets privés et aucun contenu brut dans traces techniques.
- **Tenant isolation** : base distincte par agence et contrôles objets/jobs/exports ; identité centrale seulement selon D54.
- **Secrets** : coffre scoped, TOTP chiffré clé hors DB, aucun réaffichage/export/log de secret.
- **Compliance** : contrats/rétention/résidence à prouver ; aucune conformité absolue ou test accompli déduit d’une page fournisseur.

## Migration / rollback

- **Migration** : Connecteur activé après test sans envoi, import/ingestion initiale reprenable et idempotente ; alias rattaché à vraie boîte sans création de connexion.
- **Rollback** : Révoquer/désactiver une seule boîte et ses tâches ; conserver originaux/cursors, reprise sans mandat implicite ; ne pas déplacer aveuglément messages IMAP.

## Validation et gate

Même suite par fournisseur sur doubles notifications, OAuth falsifié, expiration, auteur tag inconnu, retard/erreur/readback, absence keywords et deux boîtes réelles indépendantes au pilote.

Gates/propriétaires et preuves de sortie : **B04, B05**, décrits dans [Architecture Gate](../product/ARCHITECTURE.md#architecture-gate). La clôture exige preuve et revue indépendante, pas seulement la présente recommandation. Sources techniques datées : [recherche F01–F09](../product/ARCHITECTURE_RESEARCH.md).

## Related

- PRD : [besoin et critères inchangés](../product/PRD.md).
- Story : [STORIES](../product/STORIES.md) — S07–S09, S13–S18, S19–S27, S34 ; toujours BACKLOG.
- Issue : [#27](https://github.com/issa-diallo/dossiercle/issues/27).
- Architecture : [section de conception](../product/ARCHITECTURE.md#messagerie-et-catalogue).
- Previous ADR : aucun ADR antérieur dans le dépôt au début de ce travail ; voir [index](../product/ARCHITECTURE_DECISIONS.md#index-des-adr) pour dépendances transverses.
- Supersedes : aucun ADR antérieur remplacé ; les écarts au PRD/Stories et propositions conversationnelles abandonnées figurent dans [addendum](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions). Pas de réécriture du PASS Story Review historique.
