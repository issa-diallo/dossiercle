# ADR-011 — Horaires agence uniques, fermetures et rapports fixes

## Status

`ACCEPTED`

Décision utilisateur de principe ACCEPTED, pas une implémentation ni une qualification technique validée. Architecture globale **BLOCKED**. Les mécanismes de conception sont des obligations à vérifier ; détails non arbitrés et produits/outils candidats restent ouverts ou proposés, même dans cet ADR ACCEPTED.

## Date

2026-09-30

## Context

Le mandat impose une fenêtre d’envoi et les rapports trois horaires fixes. Les décisions nouvelles ajoutent fermetures saisies et fenêtre weekend sans autoriser déplacement silencieux des rapports.

## Decision drivers

Un planning agence ; réception continue ; exception accusé Sinistres déterministe ; lundi sans trou vendredi/weekend ; DST sans doublons.

## Options considered

### Option A — Planning/fuseau unique agence, fermetures manuelles et occurrences rapport identifiées

**Pros** — Même règle pour modules, prévisibilité des envois et fenêtres auditables.

**Cons** — Interaction fermetures/horaires agent/rapports fixes à arbitrer B09.

### Option B — Horaires indépendants par module et calendrier fériés automatique

**Pros** — Flexibilité métier et moins de saisie.

**Cons** — Contraire choix planning unique ; calendrier automatique non décidé.

### Option C — Décaler/supprimer/rattraper rapports automatiquement les jours fermés

**Pros** — Politique technique facile à appliquer.

**Cons** — Modifie implicitement horaires/occurrences PRD ; alternatives seulement, pas validées.

## Decision

Horaires uniques agence avec fuseau explicite, réception continue et fermetures exceptionnelles saisies admin communes. Hors horaires Sinistres : accusé déterministe unique autorisé sous contrôles/arrêts, indique reçu/examen prochaine ouverture/retour meilleurs délais et pas début intervention ; pas demain absolu, astreinte ou consigne urgence. Rapports lundi–vendredi 8h45/13h30/16h00 inchangés ; lundi depuis dernier rapport vendredi + weekend et dossiers ouverts. Option rapports administratifs maintenus vs occurrences empêchées lors fermetures reste ouverte, avec décision utilisateur avant Architecture PASS ; pas choix par défaut silencieux.

### Décisions utilisateur préservées

Le texte ci-dessous conserve les confirmations et leurs réserves ; les propositions contenues dans une décision source ne deviennent pas des validations runtime.

- **[D45](../product/ARCHITECTURE_DECISIONS.md#d45)** — Horaires agent configurables UNIQUES pour agence, PAS horaires séparés modules ; réception continue, envois autonomes dans horaires. Fuseau agence explicite.

- **[D46](../product/ARCHITECTURE_DECISIONS.md#d46)** — Exception Sinistres hors horaires : accusé réception déterministe autorisé, sans doublon, contrôles sécurité et arrêt respectés : reçu, examiné prochaine ouverture, retour meilleurs délais, réception pas début intervention. PAS 'demain' absolu, PAS numéro astreinte/consigne urgence ajoutés (refus utilisateur).

- **[D47](../product/ARCHITECTURE_DECISIONS.md#d47)** — Admin configure fermetures exceptionnelles (congés/jours fériés saisis), communes ; accusé sinistres reste exception. Pas calendrier fériés automatique inventé ; compléter Stories qui disait pas calendrier supplémentaire, citer décision nouvelle.

- **[D48](../product/ARCHITECTURE_DECISIONS.md#d48)** — Rapport lundi matin couvre depuis dernier rapport vendredi + weekend ET dossiers ouverts. Préserver PRD trois horaires 8h45/13h30/16h lundi-vendredi, jours/horaires exacts. Effet fermetures sur rapports à préciser sans changement silencieux, proposal/open si besoin.

## Why

La décision de principe récente complète le PRD ; formaliser la divergence empêche que Design transforme un détail calendrier en changement produit.

## Consequences

### Positive

Fenêtre weekend explicitée et chronologie plus claire ; planning commun limite incohérences entre modules.

### Negative / trade-offs

D47 contredit une exclusion antérieure Stories sur calendrier supplémentaire ; addendum/revue requis. Horaires fixes peuvent sortir des horaires agent si non arbitrés.

### Operational impact

Stocker UTC + fuseau IANA/version planning, unicité agence/type/date locale et destinataire, état occurrence empêchée explicite ; DST/fuseau/dernier rapport réussi ou prévu à préciser sans perdre événements.

## Security / data impact

Accusé n’outrepasse jamais quarantaine, mandat, stop, tags ou résiliation. Rapports filtrés droits à génération puis revérifiés avant livraison ; droits réduits bloquent ancien contenu.

- **Authentication** : requêtes humaines avec session centrale valide et MFA avant métier ; dépôt OTP séparé. Jobs autonomes avec identité workload/service authentifiée, portée limitée et mandat agence courant, sans maintenir une session utilisateur après logout/idle30. Logout ne supprime pas le mandat agence ; retraits de droits, validité des validations humaines et suspensions restent recontrôlés avant effet. Routes publiques strictement limitées, aucun bypass.
- **Authorization** : R01 et vérification courante côté services/jobs, pas droit donné par l’UI ou contenu IA.
- **Sensitive data** : minimisation, objets privés et aucun contenu brut dans traces techniques.
- **Tenant isolation** : base distincte par agence et contrôles objets/jobs/exports ; identité centrale seulement selon D54.
- **Secrets** : coffre scoped, TOTP chiffré clé hors DB, aucun réaffichage/export/log de secret.
- **Compliance** : contrats/rétention/résidence à prouver ; aucune conformité absolue ou test accompli déduit d’une page fournisseur.

## Migration / rollback

- **Migration** : Addendum S11/S25–S27 avant Design/Research, version planning et fenêtres ; ne pas réécrire PRD/Stories/Review historique dans ce ticket.
- **Rollback** : Suspendre émissions calendrier fautif, préserver clés occurrence/livraisons et contenu généré ; aucun rattrapage automatique d’une occurrence invalidée.

## Validation et gate

Vendredi/samedi/dimanche/lundi, aucune activité+dossiers ouverts, fermeture prolongée, DST/fuseau, double déclenchement et résultat mail incertain ; tests après arbitrage B09.

Gates/propriétaires et preuves de sortie : **B09, B11**, décrits dans [Architecture Gate](../product/ARCHITECTURE.md#architecture-gate). La clôture exige preuve et revue indépendante, pas seulement la présente recommandation. Sources techniques datées : [recherche F01–F09](../product/ARCHITECTURE_RESEARCH.md).

## Related

- PRD : [besoin et critères inchangés](../product/PRD.md).
- Story : [STORIES](../product/STORIES.md) — S11–S12, S19–S20, S25–S27, S33 ; toujours BACKLOG.
- Issue : [#27](https://github.com/issa-diallo/dossiercle/issues/27).
- Architecture : [section de conception](../product/ARCHITECTURE.md#horaires-et-rapports).
- Previous ADR : aucun ADR antérieur dans le dépôt au début de ce travail ; voir [index](../product/ARCHITECTURE_DECISIONS.md#index-des-adr) pour dépendances transverses.
- Supersedes : aucun ADR antérieur remplacé ; les écarts au PRD/Stories et propositions conversationnelles abandonnées figurent dans [addendum](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions). Pas de réécriture du PASS Story Review historique.
