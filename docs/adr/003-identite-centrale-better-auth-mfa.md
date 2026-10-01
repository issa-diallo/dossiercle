# ADR-003 — Identité centrale Better Auth, MFA obligatoire et sessions serveur

## Status

`ACCEPTED`

Décision utilisateur de principe ACCEPTED, pas une implémentation ni une qualification technique validée. Architecture globale **BLOCKED**. Les mécanismes de conception sont des obligations à vérifier ; détails non arbitrés et produits/outils candidats restent ouverts ou proposés, même dans cet ADR ACCEPTED.

## Date

2026-09-30

## Context

Le produit doit inviter ses utilisateurs, révoquer immédiatement leurs accès et imposer TOTP. Une bibliothèque fournit des primitives, pas automatiquement les politiques métier ni la récupération contrôlée.

## Decision drivers

MFA universelle ; pas inscription libre ; identité centrale validée ; 30 minutes inactivité réelle ; absence de secrets récupérables/exportables.

## Options considered

### Option A — Better Auth central, Drizzle PG et adaptation NestJS qualifiée

**Pros** — Primitives comptes/sessions/TOTP, licence MIT, intégration documentée et identités centrales cohérentes.

**Cons** — Tiers @thallesp à qualifier ; récupération et idle réels spécifiques ; sécurité configuration et versions à prouver.

### Option B — Fournisseur identité SaaS externe

**Pros** — Exploitation de primitives auth déléguée.

**Cons** — Contraintes résidence/dépendance et gestion des comptes à comparer ; non retenu face choix Better Auth chez Scaleway.

### Option C — Auth maison ou JWT localStorage

**Pros** — Contrôle total du protocole ou session stateless simple.

**Cons** — Coût/risque cryptographique et récupération maison ; tokens navigateur et révocation retardée contraires D10.

## Decision

Better Auth accepté de principe avec identités, sessions et MFA centraux ; mot de passe hashé, TOTP chiffré clé hors DB. Invitations propriétaire→agence puis admin→collaborateurs, mot de passe/MFA définis par l'intéressé. Cookie opaque sécurisé avec session serveur et droits revérifiés sans cache retardant révocation. MFA TOTP+codes secours usage unique avant métier ; pas SMS/e-mail ni trusted-device comme bypass implicite. Le dépôt OTP e-mail est un périmètre séparé. Perte des deux facteurs : vérification identité + accord admin (propriétaire si seul admin), lien réenrôlement temporaire, sessions révoquées et audit. 30 minutes d'inactivité réelle, polling exclu ; durée absolue et seuils d'abus ouverts.

### Reprise d'identité après restauration

Une base auth restaurée ne fournit pas des droits actuels par simple cohérence interne. Toutes ses sessions sont invalidées avant ouverture, avec génération indépendante du rollback ; changements post-sauvegarde d'appartenance/rôles, comptes désactivés et récupération/réenrôlement MFA sont réconciliés sur source fiable. Ancien TOTP restauré non réputé valide : si la situation actuelle est inconnue, maintenir le compte/facteur fermé et appliquer récupération contrôlée si nécessaire. Réconcilier aussi boîtes et validations avant effets de service. [ADR-010](010-pra-export-resiliation.md) fixe le runbook et les scénarios de révocation après backup suivie de restore ; aucune session ou ancien droit ne doit ressusciter.

### Décisions utilisateur préservées

Le texte ci-dessous conserve les confirmations et leurs réserves ; les propositions contenues dans une décision source ne deviennent pas des validations runtime.

- **[D01](../product/ARCHITECTURE_DECISIONS.md#d01)** — Comptes gérés par DossierClé : e-mail + mot de passe, MFA obligatoire pour tous avant accès métier.

- **[D02](../product/ARCHITECTURE_DECISIONS.md#d02)** — MFA application TOTP + codes de secours à usage unique ; pas SMS ni email comme remplacement silencieux du second facteur. Codes email du dépôt documentaire sont un parcours séparé.

- **[D03](../product/ARCHITECTURE_DECISIONS.md#d03)** — Collaborateurs uniquement invités par administrateur agence, définissent mot de passe et MFA avant accès. Aucune inscription libre rejoignant une agence.

- **[D04](../product/ARCHITECTURE_DECISIONS.md#d04)** — Création des agences sur invitation du propriétaire de plateforme ; premier admin active son compte, opérateur ne connaît jamais son mot de passe.

- **[D05](../product/ARCHITECTURE_DECISIONS.md#d05)** — Perte TOTP ET codes : récupération manuelle contrôlée, identité vérifiée et accord admin agence (propriétaire plateforme si seul admin), lien temporaire de réenrôlement, anciennes sessions révoquées, audit. Email seul insuffisant.

- **[D10](../product/ARCHITECTURE_DECISIONS.md#d10)** — Sessions serveur avec cookie sécurisé, pas tokens localStorage ; révocation effective côté serveur, pas cache retardant les interdictions.

- **[D11](../product/ARCHITECTURE_DECISIONS.md#d11)** — 30 minutes d'inactivité réelle : avertissement et sauvegarde sûre des brouillons ; polling automatique ne maintient pas l'accès. Durée absolue de session non décidée : proposition/open.

- **[D53](../product/ARCHITECTURE_DECISIONS.md#d53)** — Better Auth validé en principe auth NestJS chez Scaleway, Drizzle PG, licence MIT, QA obligatoire. Intégration Nest via tiers à qualifier ; pas toutes politiques prêtes par défaut. Épingler versions stables compatibles après recherche, ne pas prendre @latest/@rc non validé.

- **[D54](../product/ARCHITECTURE_DECISIONS.md#d54)** — Identités/comptes/sessions/MFA CENTRAUX explicitement validés : mot de passe hashé, TOTP chiffré clé hors DB. Tables auth centrales autorisées malgré D40 qui concernait secrets fournisseur. Appartenance/droits revérifiés avant base agence ; pas plugin organization remplaçant DB/agence. Récupération/export ne fournit jamais secrets.

## Why

L’utilisateur garde la responsabilité des comptes tout en réutilisant des primitives reconnues ; séparer appartenance et contenu des bases agence évite une auth dupliquée incohérente.

## Consequences

### Positive

Révocation centrale effective ; procédure d’onboarding/récupération traçable ; absence de token localStorage.

### Negative / trade-offs

Panne/compromission centrale touche plusieurs agences ; état de session serveur coûte une vérification ; récupération manuelle exige processus humain fiable.

### Operational impact

Épingler matrice stable compatible, tiers Node ≥22.22.1 candidat plus strict que Nest seul ; pas @latest/@rc adopté sans tests. BodyParser/raw body webhooks à vérifier, expiration 7j par défaut Better Auth ne prouve pas idle30.

## Security / data impact

Auth obligatoire MFA pour tous ; autorisation métier distincte R01. Hash mots de passe, TOTP chiffré hors clé, codes consommés atomiquement ; coffre/DB/backups séparés, aucune valeur sensible exportée. Invitations/recovery anti-rejeu et rate limits.

- **Authentication** : requêtes humaines avec session centrale valide et MFA avant métier ; dépôt OTP séparé. Jobs autonomes avec identité workload/service authentifiée, portée limitée et mandat agence courant, sans maintenir une session utilisateur après logout/idle30. Logout ne supprime pas le mandat agence ; retraits de droits, validité des validations humaines et suspensions restent recontrôlés avant effet. Routes publiques strictement limitées, aucun bypass.
- **Authorization** : R01 et vérification courante côté services/jobs, pas droit donné par l’UI ou contenu IA.
- **Sensitive data** : minimisation, objets privés et aucun contenu brut dans traces techniques.
- **Tenant isolation** : base distincte par agence et contrôles objets/jobs/exports ; identité centrale seulement selon D54.
- **Secrets** : coffre scoped, TOTP chiffré clé hors DB, aucun réaffichage/export/log de secret.
- **Compliance** : contrats/rétention/résidence à prouver ; aucune conformité absolue ou test accompli déduit d’une page fournisseur.

## Migration / rollback

- **Migration** : Générer/relire schéma auth pour versions choisies, distinct des migrations agence ; renforcer progressivement sans fenêtre d’accès métier avant MFA.
- **Rollback** : Invalider sessions/tokens d’enrôlement si incompatibilité ; revenir à schéma compatible sans déchiffrer/exporter TOTP ni désactiver MFA pour dépanner.

## Validation et gate

QA enrollement/codes simultanés/recovery/dernier admin, session révoquée ancien onglet et tâche différée, idle avec polling et brouillon sûr, séparation agence. Aucun test exécuté.

Gates/propriétaires et preuves de sortie : **B04, B07, B12**, décrits dans [Architecture Gate](../product/ARCHITECTURE.md#architecture-gate). La clôture exige preuve et revue indépendante, pas seulement la présente recommandation. Sources techniques datées : [recherche F01–F09](../product/ARCHITECTURE_RESEARCH.md).

## Related

- PRD : [besoin et critères inchangés](../product/PRD.md).
- Story : [STORIES](../product/STORIES.md) — S01–S06, S03, S31 ; toujours BACKLOG.
- Issue : [#27](https://github.com/issa-diallo/dossiercle/issues/27).
- Architecture : [section de conception](../product/ARCHITECTURE.md#authentication).
- Previous ADR : aucun ADR antérieur dans le dépôt au début de ce travail ; voir [index](../product/ARCHITECTURE_DECISIONS.md#index-des-adr) pour dépendances transverses.
- Supersedes : aucun ADR antérieur remplacé ; les écarts au PRD/Stories et propositions conversationnelles abandonnées figurent dans [addendum](../product/ARCHITECTURE_DECISIONS.md#addendum-et-supersessions). Pas de réécriture du PASS Story Review historique.
