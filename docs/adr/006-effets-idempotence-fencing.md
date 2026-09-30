# ADR-006 — Outbox durable et barrière transactionnelle des effets externes

## Status

`ACCEPTED`

Décision utilisateur de principe ACCEPTED, pas une implémentation ni une qualification technique validée. Architecture globale **BLOCKED**. Les mécanismes de conception sont des obligations à vérifier ; détails non arbitrés et produits/outils candidats restent ouverts ou proposés, même dans cet ADR ACCEPTED.

## Date

2026-09-30

## Context

Un job peut être rejoué, annulé après début, ou perdre la réponse fournisseur après un envoi réussi. L’expiration d’une prise et une vérification initiale ne protègent pas des effets obsolètes.

## Decision drivers

Aucune perte acceptée ; aucun renvoi aveugle ; contrôle au dernier moment ; arrêt/takeover pendant exécution ; pas exactly-once externe promis.

## Options considered

### Option A — Inbox/outbox et intention unique avec fence, dispatch sérialisé et réconciliation

**Pros** — Décision durable et historique d’incertitude ; doublons internes détectables ; autorité indépendante du moteur.

**Cons** — Protocole de concurrence exigeant, fournisseurs sans idempotence/recherche difficiles ; résultat inconnu peut demander humain.

### Option B — Retry/cancel Inngest suffisant et lock au début du job

**Pros** — Moins de code et exploitation apparente.

**Cons** — Étape déjà en cours continue ; check-to-send race et worker périmé possibles ; rejeté.

### Option C — Promettre exactly-once grâce à clé locale ou fence envoyé au fournisseur

**Pros** — Modèle mental simple.

**Cons** — SMTP ne vérifie pas nos fences ; crash après envoi reste ambigu. Garantie externe non fondée.

## Decision

Écrire objet/audit/outbox dans même transaction agence avant réponse acceptée. Consommer inbox de façon idempotente. Toute sortie traverse un dispatcher avec intention logique unique, versions courantes et fencing ; contrôle des préconditions pertinentes au type d’effet juste avant émission, selon la matrice ci-dessous. Stop/takeover et début réseau doivent être sérialisés ; check puis libération du verrou avant appel sans autre garantie est insuffisant. Un appel déjà parti reste visible EN_COURS_EXTERNE/RESULTAT_INCONNU, pas annulé fictivement. Réconcilier avant tout renvoi, revue humaine si fournisseur ne prouve pas résultat. Le protocole exact centre/agence/dispatcher reste gate B02, pas implémentation prouvée.

### Préconditions par type et portée

Socle commun : acteur humain authentifié ou identité service authentifiée, portée agence autorisée actuellement, intention non invalidée, version/fence courants, audit durable et résultat incertain réconcilié. Pas de bypass générique ; type déterminé côté serveur. La [matrice normative de conception](../product/ARCHITECTURE.md#préconditions-typées-des-effets) précise :

| Effet | Préconditions distinctives | Limite de l'exception |
|---|---|---|
| Tag initial IA | Boîte autorisée, prise/version/fence actuels, absence de prise humaine/suspension ; readback après écriture | N'exige pas sa propre confirmation préalable ; aucun contournement des droits/arrêts |
| Tag humain/arrêt | État humain/arrêt courant et droit de transition, fence ; boîte autorisée | Peut refléter une suspension, ne peut jamais rétablir l'IA |
| Envoi autonome/relance | Mandat, prise, tag confirmé/frais, destinataire/contenu, horaires et conditions d'arrêt | Budget seulement si nouvel appel IA ; quarantaine/validation protégée opposables |
| Accusé Sinistres déterministe | Contrôles de l'envoi conservés, contenu borné et anti-doublon | Seule ouverture horaire exceptée D46, ni stop ni quarantaine ni résiliation |
| Appel IA/OCR | Mandat de traitement, état/prise compatible, fournisseur/privacy consentis, AV propre et réservation atomique | Pas destinataire e-mail ni confirmation préalable du tag d'une sortie future ; cette sortie reste contrôlée séparément |
| Rapport | Occurrence agence, mandat Communications, destinataire/droits, boîte, calendrier | Pas prise/tag de dossier ; interaction horaires/fermetures reste B09, non exception décidée |
| Export agence | Admin session valide, droit actif ou fenêtre résiduelle D42, fichiers/conteneurs EML autorisés, archive limitée/audit | Pas dossier, mandat d'autonomie, prise/tag, budget IA ou horaires agent ; ne réactive aucune connexion après résiliation |
| Envoi humain | Session/droits/attribution et décision précise courants, contenu/destinataire, boîte et pièces propres, aucune sortie concurrente | Ne requiert pas un tag IA puisque acteur humain, ne reprend pas l'autonomie |

Toute autre famille exige une matrice explicite avant implémentation. Ajouter tests de bootstrap tag puis envoi, ancien marquage IA contre prise humaine, callback tardif et export agence sans dossier. Si l'ancien marquage est déjà en vol chez le fournisseur, sa confirmation périmée n'autorise rien ; autonomie reste bloquée, réconciliation vers humain et readback courant requis.

### Décisions utilisateur préservées

Le texte ci-dessous conserve les confirmations et leurs réserves ; les propositions contenues dans une décision source ne deviennent pas des validations runtime.

- **[D26](../product/ARCHITECTURE_DECISIONS.md#d26)** — File de tâches persistante, reprise contrôlée et résultats fournisseur incertains réconciliés avant nouvel envoi. Pas promesse exactly-once externe.

## Why

Séparer intention, tentative et effet confirmé empêche qu’un retry technique se transforme en nouvelle autorisation. L’incertitude est un état métier visible, pas une raison d’envoyer de nouveau.

## Consequences

### Positive

Crashes/replays analysables ; prise expirée ne double pas envoi ; même barrière pour IA facturable et e-mail.

### Negative / trade-offs

Attentes manuelles possibles ; pas transaction atomique PG+SMTP ; fencing local seul n’est pas une garantie fournisseur.

### Operational impact

Identifiants fournisseur stables, audit avant appel, résultat et preuve réconciliation ; alerte inconnus/ancien fence. Dispatcher seul dispose credentials d’effets, workers de calcul non.

## Security / data impact

Revocation centrale à synchroniser sans cache ; contrôle destinataire/dossier/contenu et usage unique validation. Un succès technique ancien ne réactive pas mandat ou abonnement.

- **Authentication** : requêtes humaines avec session centrale valide et MFA avant métier ; dépôt OTP séparé. Jobs autonomes avec identité workload/service authentifiée, portée limitée et mandat agence courant, sans maintenir une session utilisateur après logout/idle30. Logout ne supprime pas le mandat agence ; retraits de droits, validité des validations humaines et suspensions restent recontrôlés avant effet. Routes publiques strictement limitées, aucun bypass.
- **Authorization** : R01 et vérification courante côté services/jobs, pas droit donné par l’UI ou contenu IA.
- **Sensitive data** : minimisation, objets privés et aucun contenu brut dans traces techniques.
- **Tenant isolation** : base distincte par agence et contrôles objets/jobs/exports ; identité centrale seulement selon D54.
- **Secrets** : coffre scoped, TOTP chiffré clé hors DB, aucun réaffichage/export/log de secret.
- **Compliance** : contrats/rétention/résidence à prouver ; aucune conformité absolue ou test accompli déduit d’une page fournisseur.

## Migration / rollback

- **Migration** : Introduire intentions/outbox/uniques avant le premier effet livré, pas après S36 ; schémas d’état versionnés et compatibilité jobs maintenue.
- **Rollback** : Suspendre nouvelles émissions ; préserver réservations et résultats inconnus ; ne pas vider la queue ni changer les clés logiques pour forcer un retry.

## Validation et gate

Injecter pannes avant/après commit/publication/dispatch/réponse, stop après contrôle et avant réseau, réveil vieux worker/perte lock, révocation centre, duplication callback, réponse juste avant relance ; tests déterministes de non-renvoi.

Gates/propriétaires et preuves de sortie : **B02, B03, B06**, décrits dans [Architecture Gate](../product/ARCHITECTURE.md#architecture-gate). La clôture exige preuve et revue indépendante, pas seulement la présente recommandation. Sources techniques datées : [recherche F01–F09](../product/ARCHITECTURE_RESEARCH.md).

## Related

- PRD : [besoin et critères inchangés](../product/PRD.md).
- Story : [STORIES](../product/STORIES.md) — S03, S06, S12–S20, S24, S27, S33–S35 ; toujours BACKLOG.
- Issue : [#27](https://github.com/issa-diallo/dossiercle/issues/27).
- Architecture : [section de conception](../product/ARCHITECTURE.md#barrière-des-effets-externes).
- Previous ADR : aucun ADR antérieur dans le dépôt au début de ce travail ; voir [index](../product/ARCHITECTURE_DECISIONS.md#index-des-adr) pour dépendances transverses.
- Supersedes : aucun ADR antérieur remplacé ; les écarts au PRD/Stories et propositions conversationnelles abandonnées figurent dans [addendum](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions). Pas de réécriture du PASS Story Review historique.
