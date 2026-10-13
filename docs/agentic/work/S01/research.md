# Research — S01 Créer et activer un espace isolé

## Statut

`RESEARCH: PASS` — 2026-10-11. [Revue indépendante PASS](research-review.md) avant Design.
Entrée PRODUCT ; mode LARGE : identité, secrets et isolation multi-agence.
Mission limitée à Research → Review → Design → Review → Plan → Review.
Identifiant S01 ; aucun numéro GitHub supposé, aucune PR demandée.

## Contexte, objectif et exigences

Préparer un espace agence indépendant, exploité par la plateforme, sans choix
CPU/RAM pour l'agence. Un espace est une agence du registre, une **base PostgreSQL
distincte**, des credentials runtime dédiés et une appartenance administrateur
centrale vérifiée. Ce n'est ni un serveur réservé ni un filtre `tenant_id`.

| AC S01 | Exigence à conserver |
|---|---|
| AC1 | Création autorisée, base distincte, premier administrateur vérifié, état ACTIVE ; aucune fonction IA implicitement activée |
| AC2 | Répétition/panne sans second espace actif ni activation partielle ; progression et reprise explicites |
| AC3 | Substitution d'agence : aucune donnée, fichier ou secret accessible |
| AC4 | État et erreur utile visibles à l'admin, aucun réglage infrastructure ou secret |

R01–R05 s'appliquent : contrôle serveur avant lecture/écriture, appartenance
courante, refus étranger indistinguable, audit dès S01, fixtures synthétiques et
scénarios de panne/répétition/concurrence. Les tâches longues sont acceptées
après persistance durable, puis suivies par une API autorisée. Aucune donnée
réelle, installation ou qualification d'intégration pendant cette préparation.

## Sources et ordre de référence

Lectures ciblées au 2026-10-11 :
- [README](../../../../README.md), [AGENTS](../../../../AGENTS.md),
  [index](../../README.md), [SCALING](../../SCALING.md), [METHOD](../../METHOD.md),
  [WORKFLOW](../../WORKFLOW.md), [SAFETY](../../SAFETY.md), [CONTEXT](../../CONTEXT.md),
  [MODELS](../../MODELS.md), templates Research/Design/Plan/Goal/Worktree et rôle Reviewer.
- [PRD §1 et Parcours A](../../../product/PRD.md),
  [S01 et R01–R05](../../../product/STORIES.md), [suivi](../../STATUS.md),
  [Story Review](../../../product/STORY_REVIEW.md) et consolidation B11 D69.
- [Architecture](../../../product/ARCHITECTURE.md) : structure cible, données,
  API, auth, autorisation, isolation et saga ;
  [finalisation](../../../product/ARCHITECTURE_FINALIZATION.md) B01/B04/B07/B03 ;
  [registre](../../../product/ARCHITECTURE_DECISIONS.md) D01–D11/D39/D40/D54/D60/D72–D82 ;
  [OTP](../../../product/ARCHITECTURE_OTP.md).
- ADR [001](../../../adr/001-monolithe-stack-contrats.md),
  [002](../../../adr/002-postgresql-par-agence-drizzle.md),
  [003](../../../adr/003-identite-centrale-better-auth-mfa.md),
  [004](../../../adr/004-autorisation-mandat-support.md),
  [025](../../../adr/025-keycloak-bff-protection-otp.md),
  [029](../../../adr/029-keycloak-privacyidea-totp-chiffre.md) et supersessions
  ADR022–024/028 dans le registre ;
  [Design System](../../../product/DESIGN_SYSTEM.md), contrats FormField/Button/Alert/StatusBadge.

D73–D82 priment sur les passages historiques CloudSQL, Better Auth, B07 BLOCKED
ou B05/B06 avant Architecture. Architecture et Design System PASS documentaires
constatés ; les PASS PRD/Stories historiques ne sont pas étendus à du runtime.
Le skill feature-design-assistant fournit exploration, conception et tâches ;
questions/approbations et emplacement générique sont remplacés par le mandat
explicite de l'utilisateur et les artefacts Agentic. Aucun arbitrage de stack à refaire.

## Dépôt réel et preuves d'inspection

Base `main@075602916355813cf4e8d3f952fadaec5e637398`.
`git status --short` initial : seul `?? worktrees/`, préexistant et laissé intact.
`rg --files --hidden -g '!worktrees/**' -g '!.git/**'` inspecté :
- Pas de `apps/`, `packages/`, package.json, lock produit, Compose, schéma Drizzle,
  SDK, contrat OpenAPI exécutable ou composant React applicatif.
- `poc/b09_temporal/engine.py` et `tests/poc/test_b09_temporal.py` : prototype
  temporel Python en mémoire, étranger au provisioning ; ni auth ni isolation PG
  réutilisables. Inspection de ses imports et tests, pas lancement inutile.
- `scripts/agentic-check.sh` et `.github/workflows/agentic-docs.yml` : contrôle
  documentaire de présence et whitespace uniquement. Commandes existantes :
  `bash -n scripts/agentic-check.sh`, `bash scripts/agentic-check.sh`, `git diff --check`.
- AGENTS racine seul applicable aux docs visés. Les AGENTS des worktrees
  préexistants ne s'appliquent pas à cette rédaction dans la racine.

Les noms conceptuels agence/membership/session/invitation et endpoints Architecture
sont **proposés**, pas des modules installés. Plan devra créer le minimum sous
`apps/api`, `apps/web`, `packages/contracts`, `packages/adapters`,
`packages/domain`, `packages/testing` ; tous les nouveaux chemins et scripts
seront marqués « à créer ». Aucun script produit existant ne sera inventé.

## Acteurs, activation et données

D04 : propriétaire plateforme invite le premier administrateur ; aucune
inscription libre, aucun collaborateur créateur d'agence. L'opérateur ne connaît
pas le mot de passe. Premier administrateur : identité liée à l'invitation,
mot de passe personnel Keycloak, TOTP privacyIDEA confirmé, secours natifs générés,
session BFF forte et canal/procédure de récupération enregistrés avant activation.
Les étapes d'enrôlement privées restent interdites aux données métier.

Activation exige invitation valide/consommée par le sujet attendu, schéma prêt,
credentials et permissions contrôlés, audit durable, identité/facteurs et epochs
courants confirmés, premier membership ADMIN actif. La publication ACTIVE doit
être atomique avec l'octroi applicatif central ; aucun accès sur base seulement créée.

| Frontière | Données et accès |
|---|---|
| Contrôle central | Agence, état provisioning, invitation, localisation opaque, référence secret, modules désactivés ; aucun dossier/mail/pièce |
| Identité centrale | Keycloak comptes/mots de passe/secours ; PI facteurs chiffrés ; app sessions/memberships/epochs selon D54, distincts des données métier |
| Base agence | Marqueur d'identité/schema, audit minimal et configuration fermée ; futures données boîtes/contacts/dossiers/artisans/biens restent dans cette base |
| Objets/secrets | Pas de fichiers métier S01 ; credentials hors SQL central en clair, aucune URL/DSN navigateur ; futur objet exige mapping et ACL, pas seulement préfixe |

Cycle obligatoire : invitation → création persistée → base créée → schéma prêt →
secrets référencés → activation confirmée. Échec visible et reprise même opération.
Les états précis et transactions seront figés en Design. Désactivation d'agence,
résiliation, gestion des collaborateurs, récupération totale et écran de session
complet ne sont pas des nouvelles fonctions S01 ; la fermeture des accès en cas
de révocation ou panne est une barrière obligatoire du socle, non un parcours de
réactivation métier ajouté.

## Dépendances et V1

S01 : **aucune dépendance de story** ; bootstrap identité inclus, donc pas de
cycle S01↔S02. S02 puis S04/S05/S06 consommeront ce socle ; S03 suivra S02.
B05-P-1 et B06-P-1 restent requis avant activation des connecteurs/IA respectifs,
selon D82 ; ils ne conditionnent aucun gate de préparation ni ACTIVE de l'espace
vide S01. Pas de mail immobilier, tag, OCR, IA, BYOK, abonnement facturé ou mandat
à développer. Modules/fonctions non configurés fermés par défaut.

Stack réutilisée : React19/TS6/Vite8 ; Nest12/Node24/Express5 ; PG17/Drizzle/pg ;
Keycloak/BFF et PI/provider ADR029 ; Inngest interne pour réveiller la saga durable,
pas moteur jobs maison. Local Compose synthétique ; aucune ressource cloud imposée.
Les paramètres techniques bornés et la méthode de test seront définis au Plan.

## Risques et décisions retenues

| Risque réel | Décision / mitigation | Preuve future |
|---|---|---|
| Compte/enrôlement incomplet activé | PENDING fermé ; preuve MFA et epochs courants, pas simple `email_verified` ni QR scanné | E2E Keycloak/PI et essais de bypass |
| DB/secret créé puis crash | Saga persistante et objets nommés depuis UUID serveur, adoption seulement après vérification de propriété, pas DROP aveugle | Crash à chaque étape, reprise après redémarrage |
| Double soumission/concurrence | Une création par invitation, clé idempotence+empreinte, verrous/contraintes SQL ; activation unique | PG réel deux appels et deux runners |
| IDOR/routage/pool partagé | Appartenance vérifiée avant résolution ; credentials dédiés, CONNECT/PUBLIC retirés, contexte immuable | Deux bases, canaris et refus rôle A→B |
| Provisioner trop puissant | Processus/capacités séparés du runtime API, privilèges migration non disponibles au navigateur/worker métier | Tests de permissions et flux réseau |
| Audit indisponible | Pas d'octroi/activation non traçable, état explicite récupérable | Injection panne d'audit |
| Incertitude IdP/PI ou restauration | Deny epoch/PENDING durables, reconciliation vérifiée avant octroi ; journal J1 selon D75/D81 | Tests de refus et relecture journal courant |
| Triplet Keycloak/PI/provider ou WAF incompatible | Qualification N2 avant activation réelle ; arrêt fermé, pas OTP natif/auth maison en fallback | Build/config/attaques locaux dans Execute/Verify |

Aucune comparaison technique utile : base distincte, ORM, IdP et moteur sont
acquis. La saga évite de prétendre à une transaction distribuée entre CREATE
DATABASE, coffre, PG agence et IdP. Le monolithe et les étapes existantes sont
conservés. Rétention/licences/rotation/PRA/charge commerciaux N2/N3 restent suivis,
non prétendus prouvés ici ; Design et Plan préciseront leur propriétaire/échéance.

## Questions ouvertes et critères de sortie

**Aucune question métier/technique bloquante pour Design.** Versions correctives,
digests, installation, permissions exactes runtime et compatibilité fournisseur
sont des validations prévues en Execute/Verify, pas un arbitrage reporté. Si un
fait nouveau contredit D54/isolation, bloquer S01 et rouvrir l'ADR concerné.

Design peut commencer après revue indépendante PASS constatant : quatre AC et
R01–R05 représentés, dépôt inspecté, données/acteurs/frontières définis, dépendances
sans B05/B06 artificiel, risques avec mitigations, aucune décision indispensable
ouverte. Design devra figer contrats, modèle, contraintes, saga/concurrence,
onboarding fermé, erreurs/audit/UI. Aucun test applicatif exécuté dans Research.

## Research Gate

- [x] Dépôt réel inspecté, socle absent explicitement constaté.
- [x] Dépendances et sources identifiées.
- [x] Zones impactées identifiées ; fichiers exacts à stabiliser en Plan.
- [x] Risques et validations différées documentés.
- [x] Questions bloquantes résolues par décisions existantes.
- [x] Revue indépendante PASS consignée dans `research-review.md`.

Verdict : **PASS**, après inspection indépendante ; aucune qualification applicative déduite.
