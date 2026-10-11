# Registre des décisions Architecture — DossierClé

Date initiale : **2026-09-30**. Mode LARGE. [Architecture](ARCHITECTURE.md) **PASS**. Le registre conserve les **57 entrées historiques D01–D57**, complétées par **D58 du 2026-10-01 (#30)** et **D59 du 2026-10-04 (#52)** et **D60–D68 consolidées le 2026-10-11 à partir de #33/#42/#50**, puis **D69 : validation B11 et mandat borné des POC**, **D70 : distributions B12 approuvées**, **D71 : stack validée et POC arrêté**. D72 clôt les outils ; D73–D80 finalisent la conception selon la mission#63 ; D81 résout B07 par privacyIDEA, fournisseur Keycloak conservé. Ce document n'autorise ni implémentation, ni ressource cloud, ni pilote, ni merge.

## Autorité et force des décisions

Source : registre intégral des confirmations explicites utilisateur du 30 septembre 2026 transmis à l'auteur ; transposition publique sans conversations privées ni identités réelles. L'ordre du corpus a été lu : AGENTS, README, METHOD, WORKFLOW, COMMITS, SCALING, PRD intégral, Stories intégral, Story Review et templates. [PRD](PRD.md) et [Stories](STORIES.md) appliquent les amendements D58/D60–D68 ; [Story Review](STORY_REVIEW.md) reste inchangée et son PASS historique ne couvre pas ces amendements. Consolidation B11 : PASS humain documentaire le 2026-10-11 selon D69 ; les autres gates restent distincts. La revue historique porte sur ses propres empreintes, pas sur ce registre nouveau.

- **Confirmé utilisateur** : obligation de principe, force conservée. Un choix confirmé peut rester techniquement bloqué.
- **Autorité actuelle** : D73–D81 complètent D72 ; ScalewayPG17/Compose remplace D59 et la topologie inter-cloud, pas D58 ou D54. Les anciennes propositions sont historiques dans leur portée supersédée.
- **Décision versus preuve** : choix de conception retenus sous obligations N2/N3 ; KC-OTP-01 résolu par le nouveau contrat D81/ADR029, revue N1 indépendante PASS, zéro Critical/Major. Aucun runtime/contrat commercial réputé acquis.
- **Objectif d'acceptation** : test futur, pas fait acquis. RPO/RTO, absence de fuite/perte/double effet et charge exigent preuves.
- **Ouvert** : décision/protocole de qualification nécessaire au gate indiqué. Propriétaires par rôle dans Architecture, aucune personne supposée engagée.

## Index des ADR

Statuts courants après mission#63 ; corps historiques conservés, bannières de
supersession précisent la portée. Aucun statut ACCEPTED ne prouve un test.

| ADR | Décision | Portée actuelle |
|---|---|---|
| [ADR-001](../adr/001-monolithe-stack-contrats.md) | Monolithe modulaire TypeScript et contrats indépendants | ACCEPTED — conception, N2/N3 futures |
| [ADR-002](../adr/002-postgresql-par-agence-drizzle.md) | PostgreSQL distinct par agence, Drizzle et flotte maîtrisée | PARTIALLY_SUPERSEDED fournisseur par ADR022 ; isolation/Drizzle maintenus |
| [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) | Identité centrale Better Auth, MFA obligatoire et sessions serveur | PARTIALLY_SUPERSEDED fournisseur par ADR019 ; D54 maintenue |
| [ADR-004](../adr/004-autorisation-mandat-support.md) | Autorisation R01, mandat révocable et accès support consenti | ACCEPTED — conception, N2/N3 futures |
| [ADR-005](../adr/005-inngest-scaleway-conditionnel.md) | Inngest auto-hébergé Scaleway sous conditions | Précisé ADR018/023 ; Inngest accepté |
| [ADR-006](../adr/006-effets-idempotence-fencing.md) | Outbox durable et barrière transactionnelle des effets externes | ACCEPTED — conception, N2/N3 futures |
| [ADR-007](../adr/007-messagerie-tags-connecteurs.md) | Trois connecteurs e-mail pilotes et tags comme précondition | ACCEPTED — conception, N2/N3 futures |
| [ADR-008](../adr/008-ia-catalogue-budget-byok.md) | Catalogue IA approuvé, Qwen inclus, BYOK et secours consenti | ACCEPTED — conception, N2/N3 futures |
| [ADR-009](../adr/009-documents-quarantaine-depot.md) | Documents privés, quarantaine et dépôt sans compte borné | ACCEPTED — conception, N2/N3 futures |
| [ADR-010](../adr/010-pra-export-resiliation.md) | PRA mesurable, export limité et résiliation sans résurrection | ACCEPTED — conception, N2/N3 futures |
| [ADR-011](../adr/011-horaires-fermetures-rapports.md) | Horaires agence uniques, fermetures et rapports fixes | ACCEPTED — conception, N2/N3 futures |
| [ADR-012](../adr/012-audit-observabilite-alertes.md) | Audit distinct et alertes minimisées | ACCEPTED — conception, N2/N3 futures |
| [ADR-013](../adr/013-qa-livraison-tests.md) | QA isolée, promotion humaine et rollback compatible | ACCEPTED — conception, N2/N3 futures |
| [ADR-014](../adr/014-originaux-temporaires-export-derive.md) | Originaux temporaires, provenance et export dérivé | ACCEPTED ; B11 humain acquis, B09 local humain pour ADR016 |
| [ADR-015](../adr/015-collecte-email-retrait-depot-externe.md) | Collecte par email et retrait du dépôt externe V1 | ACCEPTED ; B11 humain acquis, B09 local humain pour ADR016 |
| [ADR-016](../adr/016-rapports-fermetures-bindings.md) | Rapports, fermetures et bindings explicites | ACCEPTED ; B11 humain acquis, B09 local humain pour ADR016 |
| [ADR-017](../adr/017-hebergement-reseau-prive.md) | Hébergement Paris et réseau privé inter-cloud | SUPERSEDED par ADR022 |
| [ADR-018](../adr/018-licence-usage-inngest.md) | Conserver Inngest sous frontière de licence explicite | ACCEPTED — conception, N2/N3 futures |
| [ADR-019](../adr/019-alternative-mfa-keycloak.md) | Alternative MFA Keycloak sous conditions | ACCEPTED fournisseur/contrat ; protection OTP précisée ADR029 |
| [ADR-020](../adr/020-conservation-finalites.md) | Conservation bornée par finalité | ACCEPTED — conception, N2/N3 futures |
| [ADR-021](../adr/021-ia-retention-fournisseur.md) | Fournisseur IA compatible avec la conservation proposée | ACCEPTED — conception, N2/N3 futures |
| [ADR-022](../adr/022-scaleway-paris-postgresql-compose.md) | Scaleway Paris, PostgreSQL mutualisé et Compose | ACCEPTED — conception, N2/N3 futures |
| [ADR-023](../adr/023-inngest-dispatcher-ferme.md) | Inngest interne et dispatcher fermé | ACCEPTED — conception, N2/N3 futures |
| [ADR-024](../adr/024-journal-reprise-coherente.md) | Journal indépendant et reprise cohérente | ACCEPTED — conception, N2/N3 futures |
| [ADR-025](../adr/025-keycloak-bff-protection-otp.md) | Contrat Keycloak BFF et protection OTP | ACCEPTED fournisseur/contrat ; protection OTP précisée ADR029 |
| [ADR-026](../adr/026-documents-retention-limites.md) | Documents temporaires et rétentions séparées | ACCEPTED — conception, N2/N3 futures |
| [ADR-027](../adr/027-mistral-budget-qualification.md) | Mistral stateless, budgets et qualification | ACCEPTED — conception, N2/N3 futures |
| [ADR-028](../adr/028-exploitation-gates-proportionnes.md) | Exploitation et gates proportionnés aux clients | ACCEPTED — conception, N2/N3 futures |
| [ADR-029](../adr/029-keycloak-privacyidea-totp-chiffre.md) | TOTP chiffré privacyIDEA, Keycloak conservé et ingress fermé | ACCEPTED conception D81 ; runtime N2 |

## Mapping exhaustif D01–D57

Chaque entrée conserve le texte source, y compris ce qui reste proposition ou preuve manquante. Autorité courante : D60–D68 et matrice de supersession ci-dessous ; les anciennes mentions dépôt/EML/absolu ouvert/fermetures ouvertes sont historiques dans leur portée supplantée. Les liens renvoient au lieu de conception et à l'ADR principal ; les autres ADR peuvent imposer des contraintes transverses. Aucun `ACCEPTED` ne transforme une réserve du texte en validation.

### D01

Comptes gérés par DossierClé : e-mail + mot de passe, MFA obligatoire pour tous avant accès métier.

**Traçabilité :** [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#authentication). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B07, B12.

### D02

MFA application TOTP + codes de secours à usage unique ; pas SMS ni email comme remplacement silencieux du second facteur. Codes email du dépôt documentaire sont un parcours séparé.

**Traçabilité :** [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#authentication). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B07, B12.

### D03

Collaborateurs uniquement invités par administrateur agence, définissent mot de passe et MFA avant accès. Aucune inscription libre rejoignant une agence.

**Traçabilité :** [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#authentication). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B07, B12.

### D04

Création des agences sur invitation du propriétaire de plateforme ; premier admin active son compte, opérateur ne connaît jamais son mot de passe.

**Traçabilité :** [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#authentication). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B07, B12.

### D05

Perte TOTP ET codes : récupération manuelle contrôlée, identité vérifiée et accord admin agence (propriétaire plateforme si seul admin), lien temporaire de réenrôlement, anciennes sessions révoquées, audit. Email seul insuffisant.

**Traçabilité :** [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#authentication). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B07, B12.

### D06

Monolithe modulaire définitivement choisi après comparaison microservices. Socle + Sinistres + Gestion locative ; activables séparément par agence. Pas microservices métier V1.

**Traçabilité :** [ADR-001](../adr/001-monolithe-stack-contrats.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#stack-decision). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B02, B04, B12.

### D07

TypeScript sans n8n ; NestJS backend ; React+TypeScript+Vite frontend.

**Traçabilité :** [ADR-001](../adr/001-monolithe-stack-contrats.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#stack-decision). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B02, B04, B12.

### D08

PostgreSQL + JSONB, BASE DISTINCTE par agence (pas simplement schéma/tenant_id). Tables pour invariants/relations, JSONB validé/versionné pour variable. Binaires hors DB.

**Traçabilité :** [ADR-002](../adr/002-postgresql-par-agence-drizzle.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#tenant-isolation). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B01, B03, B04.

### D09

REST + OpenAPI ; tâches longues asynchrones.

**Traçabilité :** [ADR-001](../adr/001-monolithe-stack-contrats.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#stack-decision). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B02, B04, B12.

### D10

Sessions serveur avec cookie sécurisé, pas tokens localStorage ; révocation effective côté serveur, pas cache retardant les interdictions.

**Traçabilité :** [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#authentication). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B07, B12.

### D11

30 minutes d'inactivité réelle : avertissement et sauvegarde sûre des brouillons ; polling automatique ne maintient pas l'accès. Durée absolue de session non décidée : proposition/open.

**Traçabilité :** [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#authentication). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B07, B12.

### D12

Fichiers privés Scaleway Paris, stockage distinct PG, accès autorisé + liens temporaires courts. Pas fichiers publics.

**Traçabilité :** [ADR-009](../adr/009-documents-quarantaine-depot.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#fichiers-quarantaine-et-dépôt). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B08.

### D13

Gmail, Microsoft 365 ET IMAP/SMTP accessibles au pilote V1, agence pilote inconnue. Pas de retrait silencieux d'un connecteur. Capacités tags à prouver, autonomie bloquée si impossibles.

**Traçabilité :** [ADR-007](../adr/007-messagerie-tags-connecteurs.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#messagerie-et-catalogue). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B05.

### D14

IA minimisation, traitement UE, pas réutilisation entraînement, conservation maîtrisée, garanties fournisseur vérifiées avant données réelles.

**Traçabilité :** [ADR-008](../adr/008-ia-catalogue-budget-byok.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#ia-ocr-enveloppes-et-byok). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B06, B08.

### D15

Qwen via Scaleway PRINCIPAL PAR DÉFAUT ; Mistral via API directe candidat alternatif/secours. Modèle précis Qwen3.6-35B-A3B seulement candidat avancé par assistant, qualification/version/tarif/disponibilité/confidentialité restent à prouver. Aucun benchmark DossierClé exécuté.

**Traçabilité :** [ADR-008](../adr/008-ia-catalogue-budget-byok.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#ia-ocr-enveloppes-et-byok). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B06, B08.

### D16

Admin agence SEUL choisit modèle/fournisseur dans catalogue approuvé et gère sa clé personnelle. Pas URL arbitraire ; clés coffre agence, jamais réaffichées/loguées/passées au modèle.

**Traçabilité :** [ADR-008](../adr/008-ia-catalogue-budget-byok.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#ia-ocr-enveloppes-et-byok). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B06, B08.

### D17

SECOURS seulement après accord explicite agence ; aucune activation Mistral silencieuse. Compatibilité texte/vision/outils/sorties structurées et confidentialité requises par tâche.

**Traçabilité :** [ADR-008](../adr/008-ia-catalogue-budget-byok.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#ia-ocr-enveloppes-et-byok). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B06, B08.

### D18

Abonnement comprend enveloppe IA mensuelle dimensionnée après tests tokens entrée/sortie, OCR, reprises, secours, coût dossier et charge mensuelle + marge. Dimensionner pour rendre épuisement RARE, pas usage illimité. Renouvellement mensuel SANS CUMUL. Pas nécessité de virement réel fournisseur mensuel.

**Traçabilité :** [ADR-008](../adr/008-ia-catalogue-budget-byok.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#ia-ocr-enveloppes-et-byok). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B06, B08.

### D19

Enveloppe plateforme exceptionnellement épuisée : email reçu et travail manuel continuent, IA en attente, aucune perte ni surfacturation automatique. Complément payant demande accord admin. Conflit éventuel avec alerte budget plateforme seule : pas divulguer compteur, autorisation commerciale séparée avant supplément.

**Traçabilité :** [ADR-008](../adr/008-ia-catalogue-budget-byok.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#ia-ocr-enveloppes-et-byok). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B06, B08.

### D20

Clé personnelle : consommation payée directement au fournisseur EN PLUS abonnement ; expliquer avant activation ; pas remise inventée sur abonnement.

**Traçabilité :** [ADR-008](../adr/008-ia-catalogue-budget-byok.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#ia-ocr-enveloppes-et-byok). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B06, B08.

### D21

Pas tableau de bord ni alerte tokens/coûts Qwen pour agence : suivi/alertes budget UNIQUEMENT propriétaire plateforme. Incapacité opérationnelle visible sans chiffres/tokens ni alerte budgétaire agence.

**Traçabilité :** [ADR-008](../adr/008-ia-catalogue-budget-byok.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#ia-ocr-enveloppes-et-byok). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B06, B08.

### D22

Avec clé personnelle : admin agence voit consommation/coût estimé, facture fournisseur fait foi. Budget mensuel configurable limité appels DossierClé, plafond fournisseur complémentaire, réservations atomiques/coûts concurrents à concevoir.

**Traçabilité :** [ADR-008](../adr/008-ia-catalogue-budget-byok.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#ia-ocr-enveloppes-et-byok). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B06, B08.

### D23

Budget clé personnelle épuisé OU clé invalide/révoquée OU fournisseur indisponible : bascule Qwen inclus, avec accord initial explicite admin, dans enveloppe plateforme disponible. Pas mise en pause si cette bascule autorisée et disponible.

**Traçabilité :** [ADR-008](../adr/008-ia-catalogue-budget-byok.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#ia-ocr-enveloppes-et-byok). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B06, B08.

### D24

Retour automatique modèle choisi après rétablissement/vérification budget et délai de stabilité ; reprise appels futurs uniquement. Tous fournisseurs autorisés indisponibles : attente, manuel/email continuent ; mandat/horaires/état humain/budget/idempotence recontrôlés au retour.

**Traçabilité :** [ADR-008](../adr/008-ia-catalogue-budget-byok.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#ia-ocr-enveloppes-et-byok). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B06, B08.

### D25

OCR : recommandation (non bench exécuté) extraction directe texte PDF si possible, vision sur scans/photos, humain si doute. Pas authenticité ni solvabilité. Modèle métier et capacités OCR à qualifier, pas claim meilleur OCR.

**Traçabilité :** [ADR-008](../adr/008-ia-catalogue-budget-byok.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#ia-ocr-enveloppes-et-byok). **Statut :** proposition OCR non approuvée, à qualifier ; aucun benchmark exécuté. **Gate :** B06, B08.

### D26

File de tâches persistante, reprise contrôlée et résultats fournisseur incertains réconciliés avant nouvel envoi. Pas promesse exactly-once externe.

**Traçabilité :** [ADR-006](../adr/006-effets-idempotence-fencing.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#barrière-des-effets-externes). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B02, B03, B06.

### D27

**Historique du 2026-09-30 : bornes PRA et conflit zéro perte/catastrophe remplacés par [D58](#d58) le 2026-10-01. Citation originale conservée ci-dessous, non exigence active sur ces points.**

Objectifs DR : perte max 15 minutes (RPO) et retour sous 4h (RTO) pour incident majeur, tests restauration bases+documents+orchestration, pas garanties acquises. Invariants message accepté non perdu du PRD restent, arbitrage cohérence RPO à expliquer sans affaiblir le PRD.

**Traçabilité :** [ADR-010](../adr/010-pra-export-resiliation.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#sauvegarde-export-résiliation-et-pra). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B01, B03, B08.

### D28

Support accès métier exceptionnel seulement accord explicite agence, borné motif/périmètre/temps, lecture ET écriture auditées. Admin plateforme pas admin agence implicite.

**Traçabilité :** [ADR-004](../adr/004-autorisation-mandat-support.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#authorization). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B02, B07, B11.

### D29

Tout doit être tracé/logger : auth, accès support, actions humaines/IA, droits/config, envois. Jamais mots de passe/clé API/TOTP/codes/documents bruts dans logs techniques. Journal audit distinct historique métier et traces Inngest.

**Traçabilité :** [ADR-012](../adr/012-audit-observabilite-alertes.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#logging--observability). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B02, B08, B10, B12.

### D30

Admin consulte/exporte audit agence sans modifier/supprimer depuis UI ; purge réglementaire/rétention séparées.

**Traçabilité :** [ADR-012](../adr/012-audit-observabilite-alertes.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#logging--observability). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B02, B08, B10, B12.

### D31

Pièces en quarantaine jusqu'à antivirus réussi ; suspect OU erreur analyse bloque téléchargement métier et IA. Analyser isolé, MIME réel/limites/archive-bomb/protections parser.

**Traçabilité :** [ADR-009](../adr/009-documents-quarantaine-depot.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#fichiers-quarantaine-et-dépôt). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B08.

### D32

Tests obligatoires emails malveillants : phishing/usurpation et Reply-To, pièce hostile, liens/SSRF, injection prompt, saturation/coût, HTML actif/traceurs, aucune autorisation via contenu. Messages synthétiques, pas malware réel ni preuve de protection absolue.

**Traçabilité :** [ADR-009](../adr/009-documents-quarantaine-depot.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#fichiers-quarantaine-et-dépôt). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B08.

### D33

Email suspect conservé quarantaine, aucune réponse automatique, alerte admin. Pas suppression aveugle.

**Traçabilité :** [ADR-009](../adr/009-documents-quarantaine-depot.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#fichiers-quarantaine-et-dépôt). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B08.

### D34

Admin SEUL libère message après contrôle, traitement HUMAIN d'abord, pas activation IA implicite ; pièce malveillante reste bloquée indépendamment.

**Traçabilité :** [ADR-009](../adr/009-documents-quarantaine-depot.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#fichiers-quarantaine-et-dépôt). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B08.

### D35

Alertes opérationnelles importantes UI + email admin, sans contenu sensible ni pièce, lien application, répétitions groupées. Exception budget Qwen D21 réservée plateforme.

**Traçabilité :** [ADR-012](../adr/012-audit-observabilite-alertes.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#logging--observability). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B02, B08, B10, B12.

### D36

QA véritablement distincte (URL, DB, stockage, clés, mailboxes, environnements orchestrateur), synthétique, aucun vrai client contacté. Dév -> tests -> QA -> accord humain propriétaire -> prod. Même artefact validé promu, migration/rollback compatibles, pas retour arrière code seul supposé suffisant.

**Traçabilité :** [ADR-013](../adr/013-qa-livraison-tests.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#deployment). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B01–B12 selon composant ; revue indépendante.

### D37

Monorepo frontend/backend/contrats, builds ET déploiements frontend/backend indépendants avec compatibilité API vérifiée. Pas microservices métier pour autant.

**Traçabilité :** [ADR-001](../adr/001-monolithe-stack-contrats.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#stack-decision). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B02, B04, B12.

### D38

Docker Compose local avec services/reproductibilité/données fictives ; n'impose pas Compose prod.

**Traçabilité :** [ADR-001](../adr/001-monolithe-stack-contrats.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#stack-decision). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B02, B04, B12.

### D39

Drizzle + pilote pg validé après comparaison Prisma/MikroORM. Gestion pools bornés et migrations par agence explicite, aucune isolation/migration flotte automatique supposée.

**Traçabilité :** [ADR-002](../adr/002-postgresql-par-agence-drizzle.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#tenant-isolation). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B01, B03, B04.

### D40

Base centrale registre agences/abonnements/modules/localisation bases/références secrets, pas données dossier/email/document ni secrets fournisseur en clair.

**Traçabilité :** [ADR-002](../adr/002-postgresql-par-agence-drizzle.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#tenant-isolation). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B01, B03, B04.

### D41

Sauvegardes chiffrées, accès restreint, rétention 30 jours sous validation technique/réglementaire. Différent rétention dossiers actifs.

**Traçabilité :** [ADR-010](../adr/010-pra-export-resiliation.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#sauvegarde-export-résiliation-et-pra). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B01, B03, B08.

### D42

Fin effective abonnement : IA et connexions email arrêtées, révoquer les tâches et accès correspondants, accès admin limité export 30 jours puis supprimer données actives. Backups expirent suivant rétention sauf obligation légale, restauration ne réactive pas données supprimées. Ne pas affirmer toutes copies effacées au 30e jour.

**Traçabilité :** [ADR-010](../adr/010-pra-export-resiliation.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#sauvegarde-export-résiliation-et-pra). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B01, B03, B08.

### D43

Export : dossiers/contacts/biens/historiques CSV/JSON, mails EML, pièces originales, index relations. Pas mots de passe/clés. Fichiers malveillants exclus et signalés dans index (complétude soumise sécurité).

**Traçabilité :** [ADR-010](../adr/010-pra-export-resiliation.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#sauvegarde-export-résiliation-et-pra). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B01, B03, B08.

### D44

Export réservé admin session valide, authentifié/temporaire/audité ; utilisateur REFUSE re-MFA spécifique export, ne pas la réintroduire. Risque session compromise reconnu. Archive disponible 24h puis supprimée, sources inchangées, regénération si droit actif.

**Traçabilité :** [ADR-010](../adr/010-pra-export-resiliation.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#sauvegarde-export-résiliation-et-pra). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B01, B03, B08.

### D45

Horaires agent configurables UNIQUES pour agence, PAS horaires séparés modules ; réception continue, envois autonomes dans horaires. Fuseau agence explicite.

**Traçabilité :** [ADR-011](../adr/011-horaires-fermetures-rapports.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#horaires-et-rapports). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B09, B11.

### D46

Exception Sinistres hors horaires : accusé réception déterministe autorisé, sans doublon, contrôles sécurité et arrêt respectés : reçu, examiné prochaine ouverture, retour meilleurs délais, réception pas début intervention. PAS 'demain' absolu, PAS numéro astreinte/consigne urgence ajoutés (refus utilisateur).

**Traçabilité :** [ADR-011](../adr/011-horaires-fermetures-rapports.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#horaires-et-rapports). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B09, B11.

### D47

Admin configure fermetures exceptionnelles (congés/jours fériés saisis), communes ; accusé sinistres reste exception. Pas calendrier fériés automatique inventé ; compléter Stories qui disait pas calendrier supplémentaire, citer décision nouvelle.

**Traçabilité :** [ADR-011](../adr/011-horaires-fermetures-rapports.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#horaires-et-rapports). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B09, B11.

### D48

Rapport lundi matin couvre depuis dernier rapport vendredi + weekend ET dossiers ouverts. Préserver PRD trois horaires 8h45/13h30/16h lundi-vendredi, jours/horaires exacts. Effet fermetures sur rapports à préciser sans changement silencieux, proposal/open si besoin.

**Traçabilité :** [ADR-011](../adr/011-horaires-fermetures-rapports.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#horaires-et-rapports). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B09, B11.

### D49

Limite 20 Mo par fichier, dépassement message visible avec signalement pièce non analysée ; définir unité sans changer silencieusement, limites connexions/import/pages à qualifier.

**Traçabilité :** [ADR-009](../adr/009-documents-quarantaine-depot.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#fichiers-quarantaine-et-dépôt). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B08.

### D50

Dépôt sécurisé sans compte par lien temporaire révocable 7 jours, plusieurs dépôts, OTP email destinataire à chaque nouvelle session. Pas consultation pièces déjà transmises/données dossier.

**Traçabilité :** [ADR-009](../adr/009-documents-quarantaine-depot.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#fichiers-quarantaine-et-dépôt). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B08.

### D51

Dépôt sécurisé PDF/JPEG/PNG seulement, 20 Mo et antivirus ; Word/exécutable/ZIP refusés CE formulaire. CSV/XLSX catalogue restent parcours séparé. Formats email hors formulaire non inventés validés, politique à proposer.

**Traçabilité :** [ADR-009](../adr/009-documents-quarantaine-depot.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#fichiers-quarantaine-et-dépôt). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B08.

### D52

Inngest : utilisateur impose orchestration CHEZ SCALEWAY, pas Inngest Cloud. Inngest auto-hébergé privilégié sous conditions licence SSPL/future Apache, infra persistante coût, tests QA. Ne pas présenter validé prod/100% serverless. Choix crée arbitrage explicite ancien PRD tout managé/serverless, aucun changement silencieux. Exception potentielle de runtime persistant plateforme (pas serveur/agence) acceptation dimensionnement ouverte.

**Traçabilité :** [ADR-005](../adr/005-inngest-scaleway-conditionnel.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#async--queues--jobs). **Statut :** préférence utilisateur conditionnelle ; PROPOSED. **Gate :** B02, B03, B04.

### D53

Better Auth validé en principe auth NestJS chez Scaleway, Drizzle PG, licence MIT, QA obligatoire. Intégration Nest via tiers à qualifier ; pas toutes politiques prêtes par défaut. Épingler versions stables compatibles après recherche, ne pas prendre @latest/@rc non validé.

**Traçabilité :** [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#authentication). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B07, B12.

### D54

Identités/comptes/sessions/MFA CENTRAUX explicitement validés : mot de passe hashé, TOTP chiffré clé hors DB. Tables auth centrales autorisées malgré D40 qui concernait secrets fournisseur. Appartenance/droits revérifiés avant base agence ; pas plugin organization remplaçant DB/agence. Récupération/export ne fournit jamais secrets.

**Traçabilité :** [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#authentication). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B04, B07, B12.

### D55

Ordre existant obligatoire : Sinistres avant Location, V1 deux inclus. Pas solvabilité/classement/comparaison/choix/acceptation-refus candidature/bail même brouillon. Contrôle complétude documentaire seulement ; ni IA SQL ni accès cross-agence.

**Traçabilité :** [ADR-001](../adr/001-monolithe-stack-contrats.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#stack-decision). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B02, B04, B12.

### D56

Matrice rôles R01 Stories inchangée : admin/habilité/standard attributions, pas droits implicites. Prise exclusive, mandat trois modes et invalidations déterministes, tags avant première action autonome, source lu/non lu jamais vérité.

**Traçabilité :** [ADR-004](../adr/004-autorisation-mandat-support.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#authorization). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B02, B07, B11.

### D57

Dépôt public : docs synthétiques uniquement, pas secrets, données clients ou URL privées. PR 1 ticket/branche/commit ; pas merge sans nouvelle instruction.

**Traçabilité :** [ADR-001](../adr/001-monolithe-stack-contrats.md) ; [Architecture — frontière concernée](ARCHITECTURE.md#stack-decision). **Statut :** confirmation de principe, réserves/propositions internes conservées. **Gate :** B02, B04, B12.

## Nouvelle décision du 2026-10-01 — issue #30

### D58

**Source :** confirmation utilisateur explicite du 2026-10-01, [issue #30](https://github.com/issa-diallo/dossiercle/issues/30) : « Oui, perte de données et remise en service : chacune sous 4 heures ».

**Décision :** pour catastrophe/incident majeur, **RPO < 4 heures et RTO < 4 heures**, chacun strictement inférieur, et non inférieur ou égal. D58 supersède uniquement les bornes PRA de D27 et son conflit non résolu entre zéro perte et catastrophe. La tolérance de perte est désormais explicitement autorisée dans ce seul cas ; zéro perte en fonctionnement normal/retries, absence de doublon, contrôles de révocation et cohérence bases/documents/jobs restent requis. Perte/écart visible, jamais normalisé silencieusement. Sauvegardes chiffrées/restreintes 30 jours sous validation technique/réglementaire (D41) inchangées ; autres décisions non modifiées.

**Mesure :** RPO entre le dernier état cohérent réellement récupérable avant l'incident et l'instant de l'incident ; RTO depuis cet incident jusqu'au service effectivement utilisable, réconciliation et sécurité comprises. Sauvegarder exactement toutes les 4 heures ne prouve pas RPO < 4 heures : marge pour durée, retard et échec, point récupérable vérifié sur bases/fichiers/jobs. La faisabilité, les mesures et les preuves demeurent ouvertes sous B03 ; aucun fournisseur, test réussi, Architecture PASS ou droit de déployer n'est déduit de cet arbitrage.

**Traçabilité :** [ADR-010 amendé](../adr/010-pra-export-resiliation.md), [Architecture — PRA](ARCHITECTURE.md#sauvegarde-export-résiliation-et-pra), portée catastrophe [PRD](PRD.md) / [Stories](STORIES.md). **Statut :** décision utilisateur nouvelle validée ; revue indépendante de l'amendement à effectuer, hors PASS Story Review historique. **Gate :** B01, B03, B08, B11.

## Nouvelle décision du 2026-10-04 — issue #52

### D59

> **Historique supersédé par D73/ADR022** sur fournisseur, configuration Cloud SQL/HA/PITR ; D58 et garanties de production inchangés.

**Source :** décisions humaines explicites enregistrées le 2026-10-04 sur [#52](https://github.com/issa-diallo/dossiercle/issues/52), après fermeture `not planned` du POC [#53](https://github.com/issa-diallo/dossiercle/issues/53).

**Décision :** adopter **Google Cloud SQL for PostgreSQL 17 Enterprise, HA régionale à Paris `europe-west9`**, avec PITR explicitement activé et connexions chiffrées obligatoires. La portabilité PostgreSQL native, `pg`, Drizzle, `pg_dump` et `pg_restore` reste un objectif. Une base et un utilisateur runtime dédiés par agence demeurent requis ; la densité par instance n'est pas décidée sans mesure.

**Statut :** `B01: CLOSED_BY_DECISION — ACCEPTED_WITH_RISK`. Le produit PostgreSQL n'est plus un choix structurel ouvert. Ce statut n'est pas un `PASS` technique : aucun failover, PITR, RPO/RTO, isolement, pool, migration ou coût n'a été mesuré. `B01-P-1` est abandonné avant exécution ; ses validations sont reportées à Verify/QA et restent obligatoires avant toute Production. B03 reste `BLOCKED` pour la reprise cohérente multi-services et les mesures RPO/RTO. Aucun SLA, survie à la perte régionale ou `ARCHITECTURE: PASS` n'est déduit.

**Supersession bornée :** D59 remplace uniquement la portion PostgreSQL/base de données des clauses [PRD — Légales et conformité, ligne 575](PRD.md#légales-et-conformité), [PRD — Techniques, ligne 598](PRD.md#techniques), [PRD — Décisions enregistrées, ligne 923](PRD.md#décisions-enregistrées) et [Stories — Décisions reportées au bon gate, ligne 952](STORIES.md#décisions-reportées-au-bon-gate). Ces clauses continuent d'imposer Scaleway Paris pour le runtime applicatif, les fichiers privés, l'IA/Qwen, le coffre candidat et Inngest auto-hébergé. D59 n'étend pas Cloud SQL à ces composants et ne modifie aucune autre contrainte Scaleway.

**Traçabilité :** [ADR-002 amendé](../adr/002-postgresql-par-agence-drizzle.md), [Q1 — B01](ARCHITECTURE_Q1_B01.md), [Architecture — données](ARCHITECTURE.md#tenant-isolation), [Architecture Gate](ARCHITECTURE.md#architecture-gate), [STATUS](../agentic/STATUS.md). **Gate :** B01 clos par décision ; B03/B04 et Verify/QA restent ouverts.

## Décisions acquises consolidées le 2026-10-11 — D60–D68

Sources : [atelier #33](ISSUE_33_DECISIONS.md), [confirmation D1–D3](https://github.com/issa-diallo/dossiercle/issues/42#issuecomment-5966676710), [qualification #50](https://github.com/issa-diallo/dossiercle/issues/50), [PR #51](https://github.com/issa-diallo/dossiercle/pull/51). Le [rappel de gate humain](https://github.com/issa-diallo/dossiercle/issues/33#issuecomment-5967415396) reste obligatoire. Dates ci-dessous = dates sources, pas date de validation nouvelle. Aucune recommandation de remediation n’est ajoutée comme décision.

### D60

**Session absolue 15 jours — source 2026-10-02, #33.** La session expire après 15 jours absolus même en usage continu. Les 30 minutes d’inactivité humaine réelle de D11 demeurent ; polling, heartbeat et refresh ne prolongent pas l’activité humaine. Durée d’avertissement, mot de passe, anti-abus et récupération restent B07.

**Traçabilité :** [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) ; [Architecture](ARCHITECTURE.md) et [remediation](ARCHITECTURE_REMEDIATION.md). **Statut :** décision acquise, transposition documentaire à revoir ; aucune qualification runtime induite. **Gate :** B07, B12.

### D61

**Offre de lancement — source 2026-10-02, #33.** Trois comptes individuels par agence, administrateur compris et quota commun aux modules ; comptes supplémentaires possibles contre supplément, prix et plafond ouverts. Deux boîtes incluses : Sinistres puis Location, aucune boîte supplémentaire proposée au lancement. La capacité technique multi-boîtes, les cinq répartitions, leurs volumes par agence et les niveaux de sessions du [protocole PRD](PRD.md) restent inchangés. Alias et simultanéité commerciale non arbitrés.

**Traçabilité :** [ADR-007](../adr/007-messagerie-tags-connecteurs.md) ; [Architecture](ARCHITECTURE.md) et [remediation](ARCHITECTURE_REMEDIATION.md). **Statut :** décision acquise, transposition documentaire à revoir ; aucune qualification runtime induite. **Gate :** B05, B08, B11.

### D62

**Originaux temporaires et provenance — source 2026-10-02, #33.** Aucune copie durable des e-mails ni des pièces d’origine dans DossierClé ; originaux dans la messagerie de l’agence. Conserver seulement suivi, faits utiles structurés, courts résumés, synthèse et provenance descriptive sans URL/deep link cliquable. Analyse temporaire des pièces utiles après AV/quarantaine ; purge couvrant application, objets, caches, retries, logs, backups et fournisseurs, durée ouverte B08. Une source supprimée peut être irrécupérable. Fait essentiel manquant/contradictoire suspend l’action concernée et appelle clarification humaine ; actions indépendantes assez documentées continuent. DossierClé n’est pas autorisé à supprimer l’original fournisseur.

**Traçabilité :** [ADR-014](../adr/014-originaux-temporaires-export-derive.md) ; [Architecture](ARCHITECTURE.md) et [remediation](ARCHITECTURE_REMEDIATION.md). **Statut :** décision acquise, transposition documentaire à revoir ; aucune qualification runtime induite. **Gate :** B03, B05, B06, B08, B11.

### D63

**Export dérivé uniquement — source 2026-10-02, #33.** Export CSV/JSON des seules données détenues : faits, résumés courts, synthèses, suivi et références descriptives ; aucun EML ni pièce originale, même sous forme encodée ou cachée. L’agence exporte ses originaux depuis sa messagerie. D43 supplanté sur la seule portée originaux. D42/D44 (droits, fenêtre résiliation, archive 24 h et refus re-MFA spécifique export) restent en vigueur.

**Traçabilité :** [ADR-014](../adr/014-originaux-temporaires-export-derive.md) ; [Architecture](ARCHITECTURE.md) et [remediation](ARCHITECTURE_REMEDIATION.md). **Statut :** décision acquise, transposition documentaire à revoir ; aucune qualification runtime induite. **Gate :** B03, B08, B11.

### D64

**Retrait dépôt externe — source 2026-10-02, #33.** V1 réservée à l’agence et ses collaborateurs ; aucun espace client ni formulaire externe de dépôt sans compte. Pièces clients reçues par e-mail à l’agence. D50 et la seule portée formulaire de D51 supplantées, y compris lien 7 j/OTP dépôt ; MFA collaborateurs, AV/quarantaine e-mail et imports catalogue CSV/XLSX restent obligatoires. La liste de formats du formulaire retiré n’est pas une politique email validée.

**Traçabilité :** [ADR-015](../adr/015-collecte-email-retrait-depot-externe.md) ; [Architecture](ARCHITECTURE.md) et [remediation](ARCHITECTURE_REMEDIATION.md). **Statut :** décision acquise, transposition documentaire à revoir ; aucune qualification runtime induite. **Gate :** B04, B08, B11.

### D65

**Reprise progressive dans période choisie — source 2026-10-02, #33.** L’agence choisit la période sans défaut, frontière stricte de lecture/inventaire/qualification/affichage/notification. Aucun accès hors période, même si un mail renvoie vers un dossier antérieur ; aucun élargissement suggéré. Un collaborateur habilité peut demander expressément une autre période que l’agence choisit. Dossiers préparés puis état réel confirmé dans l’application uniquement, sans mail/SMS ; silence/lu/non-lu ne vaut pas confirmation et confirmation ne vaut pas mandat d’envoi. Aucune action rétroactive ; droits, mandat, horaires, prise humaine, validations et déduplication restent applicables.

**Traçabilité :** [ADR-014](../adr/014-originaux-temporaires-export-derive.md) ; [Architecture](ARCHITECTURE.md) et [remediation](ARCHITECTURE_REMEDIATION.md). **Statut :** décision acquise, transposition documentaire à revoir ; aucune qualification runtime induite. **Gate :** B03, B05, B06, B08, B11.

### D66

**Rapports et fermetures manuelles — source 2026-10-02, #33.** Aucun rapport pendant fermeture manuellement saisie, ni calendrier férié automatique. Occurrence empêchée visible sans report/rattrapage automatique ; créneaux lundi–vendredi 8h45/13h30/16h00 inchangés. Prochaine occurrence autorisée couvre depuis le dernier rapport réellement envoyé, fermeture/weekend inclus, sans rapport supplémentaire ; tous dossiers ouverts restent visibles.

**Traçabilité :** [ADR-016](../adr/016-rapports-fermetures-bindings.md) ; [Architecture](ARCHITECTURE.md) et [remediation](ARCHITECTURE_REMEDIATION.md). **Statut :** décision acquise, transposition documentaire à revoir ; aucune qualification runtime induite. **Gate :** B09, B11.

### D67

**Arbitrages temporaux D1–D3 — source 2026-10-03, #42 puis #50.** D1 : les trois créneaux fixes appartiennent aux horaires d’action ; configuration incompatible refusée, configuration legacy incompatible empêche l’occurrence. D2 : retard permis seulement avant le prochain créneau ; à la borne ou au-delà PREVENTED_LATE, aucun report. D3 : un destinataire nouveau ou réautorisé reçoit un nouveau binding depuis activation, sans historique ni héritage automatique ni reprise de l’ancien curseur. Ces décisions ne confèrent aucun PASS B09/B11/Architecture. POC #50 fusionné #51 démontre mécanismes locaux en mémoire seulement.

**Traçabilité :** [ADR-016](../adr/016-rapports-fermetures-bindings.md) ; [Architecture](ARCHITECTURE.md) et [remediation](ARCHITECTURE_REMEDIATION.md). **Statut :** décision acquise, transposition documentaire à revoir ; aucune qualification runtime induite. **Gate :** B09, B11.

### D68

**Exploitation critique visée 24/7 — source 2026-10-02, #33.** Prise en charge critique visée 24 h/24 et 7 j/7 par propriétaire avec prestataire, sans prestataire identifié ni engagement/rotation/budget acquis. Disponibilité de lancement objectif interne, aucun SLA client. Cible D58 reste intacte et non démontrée ; support fournisseur n’est pas exploitation applicative. Objectif chiffré, relais, seuils, canaux et financement restent B10.

**Traçabilité :** [ADR-012](../adr/012-audit-observabilite-alertes.md) ; [Architecture](ARCHITECTURE.md) et [remediation](ARCHITECTURE_REMEDIATION.md). **Statut :** décision acquise, transposition documentaire à revoir ; aucune qualification runtime induite. **Gate :** B03, B10, B11.

### Matrice des supersessions actuelles

| Ancienne autorité (2026-09-30) | Décision source nouvelle | Portée actuelle | Maintenu |
|---|---|---|---|
| D11 / ADR-003 absolu ouvert | D60, #33 du 2026-10-02 |15 j absolus| idle 30 réel, révocation/MFA |
| Multi-boîtes sans quota commercial | D61, #33 |2 boîtes/3 comptes offre|3 connecteurs, capacité technique et charge inchangées |
| D12 / ADR-007/009 originaux durables | D62, #33 | originaux seulement temporaires, provenance descriptive| privés Paris, AV/quarantaine, isolation |
| D31–D34 copie/quarantaine sans durée | D62, #33 | copies temporaires purge bornée à décider|fail-closed, admin libère message humain seulement, pièce indépendante |
| D43 / ADR-010 EML+pièces export | D63, #33 |CSV/JSON dérivés seuls| droits/session/audit et D42/D44 |
| D50 / D51 formulaire | D64, #33 |parcours retiré V1|MFA/AV/imports, formats email ouverts |
| D45–D48 interaction fermetures ouverte | D66, #33 ; D67, #42/#50 |slots fixes dans horaires, pas rapport fermeture, fenêtre depuis envoi effectif, bindings|accusé Sinistres borné et interdictions |
| Reprise historique non définie | D65, #33 |période stricte sans défaut/élargissement suggéré, confirmation in-app|mandat indépendant et déduplication |
| Disponibilité/SLA ouverts | D68, #33 |cible prise en charge 24/7 non engagée, objectif interne|D58 et B10 restent à prouver |

D01–D59 ci-dessus restent le journal historique. Les mentions dépôt/EML/quarantaine durable de leurs textes ou de l’ancien addendum ci-dessous sont historiques dans les portées supplantées par cette matrice. Les anciens ADR conservent leurs corps et reçoivent des pointeurs d’autorité ; la clause commune « dépôt OTP séparé » est corrigée pour retirer une injonction transversale obsolète. Aucun autre mécanisme acquis n’est abrogé.

### D69

- **Date :** 2026-10-11.
- **Source :** confirmation utilisateur « oui je valide » en réponse à la validation explicite B11 et au mandat POC ; [preuve de portée](../agentic/work/arch-b02-b12/evidence/human-approval-b11-pocs.md).
- **Décision :** B11 PASS humain pour la consolidation documentaire revue ; B07-P-1 et B12-P-1 autorisés selon les bornes proposées (2 h par phase, totaux 6 h/8 h, 2 Go par essai, 0 € externe, 4 CPU/8 Gio RAM/15 Gio disque et données synthétiques). Préflight, manifeste et règles d’arrêt obligatoires, gate Q4 complet inchangé.
- **Limites :** aucune fermeture B09, aucune qualification B07/B12 ni Architecture PASS ; aucune adoption nouvelle de stack/licence/topologie/privacy ou SLA. Les distributions non présentées restent à arrêter avant téléchargement. Préflight disque BLOCKED avant toute installation ; autorisation conservée pour reprise après résolution de cette condition.


### D70

- **Date :** 2026-10-11.
- **Source :** réponse utilisateur « oui » au manifeste concret de distribution B12 ; [preuve](../agentic/work/b12-p-1-bootstrap/evidence/distribution-approval.md).
- **Décision :** autoriser les distributions Chrome153.0.8010.12/FFmpeg1011 et DBTrivy du manifeste revu (Google/Microsoft/GHCR), avec provenance officielle HTTPS et empreintes enregistrées pour les archives navigateur sans checksum public. DoR B12 satisfait après Research/Design/Plan et revue PASS.
- **Limites :** aucun changement de budgets D69, pas de nouveau host/artefact implicite, pas de B07/B12/Architecture PASS technique, aucun compte/cloud/donnée réelle/dépense/envoi externe. GateQ4 intégral et arrêts maintenus.



### D71

2026-10-11 — **ACCEPTED : choix de stack validé et POC arrêté par l'utilisateur.**

L'utilisateur valide React 19 / TypeScript 6 / Vite 8 ; NestJS 12 / Node.js 24 / Express 5 ; PostgreSQL 17 / Drizzle ; Better Auth avec intégration NestJS ; Inngest ; Vitest / Playwright / k6 / OpenTelemetry. Ce sont désormais les choix de référence pour préparer et implémenter les stories, et non des options à remettre en concurrence. Les patchs exacts du lock expérimental restent des références de recherche ; cette validation des outils et versions majeures n'en fait pas un lock produit livré. Le choix de pnpm et celui de GitHub Actions ne sont pas ajoutés implicitement à la liste approuvée.

**Le mandat d'exécuter les POC B07/B12 est révoqué.** Aucun nouveau téléchargement, essai, phase ou reprise autorisé au titre de D69/D70. B12 arrêté, absence de scopes/containers/socket tâche attestée ; preuves et ressources utilisateur conservées. L'achèvement du POC B12 n'est plus un préalable au choix de stack : B12 clôture ce choix par décision humaine, les preuves manquantes sont reportées aux Research/Design/Plan puis Execute/Verify/Review des stories concernées avant livraison. Ni build, ni deuxième installation offline, ni PostgreSQL, ni tests/scans, ni QA/promotion/PRA ne sont annoncés PASS. Les règles d'arrêt sécurité, les tests et les conditions de mise en service restent applicables à ces futures étapes.

Cette décision remplace l'obligation antérieure de terminer Q4 B12 avant d'entériner la stack. Elle ne modifie pas les exigences MFA/stockage irréversible des secours, ne valide pas une extension auth maison et ne choisit pas silencieusement les licences, déploiements, contrats/rétention, réseau multi-cloud, coûts ou astreinte encore ouverts. Inngest est choisi comme moteur ; son exploitation self-hosted/licence/topologie reste à finaliser. Architecture globale non déclarée PASS par cette seule décision.

Preuves partielles conservées : Node/pnpm exécutés, résolution exit 0 sans conflit peer/engine signalé, 530 paquets audités et une installation frozen réussie ; deuxième installation interrompue. [Arrêt B12](../agentic/work/b12-p-1-bootstrap/evidence/user-stop.json), [handoff](../agentic/work/b12-p-1-bootstrap/handoff.md), [audit indépendant](../agentic/work/b12-p-1-bootstrap/evidence/lock-result-review.md). ADR-001/002/003/005/012/013 et Architecture reflètent le choix courant ; leurs réserves historiques restent traçables.

## Addendum et supersessions

Journal historique du 2026-09-30, supplanté dans les seules portées de la matrice actuelle ci-dessus.

Cet addendum expose les écarts ; seul le carve-out catastrophe D58 est reporté au PRD/Stories par #30, sans réécrire le rapport de revue ni attribuer une approbation rétroactive. Avant Research/Design des stories affectées, propriétaire produit et reviewer indépendant doivent approuver les modifications du corpus autorisées au ticket correspondant. Aucune story n'est Ready for Execute.

| Sujet | État antérieur / proposition abandonnée | Décision postérieure qui prévaut | Traitement / gate |
|---|---|---|---|
| Création agence/comptes | PRD création administrateur, méthode auth ouverte | D01–D05 : invitation plateforme/agence, MFA et récupération contrôlée | Compléter S01/S02/S04 sans inscription libre ; B07/B11 |
| Stack/ORM | Framework/auth/queue reportés à Architecture ; alternatives microservices/ORM | D06–D09/D39/D53 : Nest/React/Vite, Drizzle/pg, Better Auth ; Inngest seulement conditionnel | ADR-001/002/003/005, versions et preuves non acquises |
| PostgreSQL managé et clauses Scaleway | PRD lignes 575, 598 et 923 ainsi que Stories ligne 952 imposent Scaleway Paris de manière générale ; Scaleway Managed PostgreSQL était prioritaire sous conditions, B01 bloqué et POC requis | D59 : seule leur portion PostgreSQL/base de données est supersédée par Cloud SQL PostgreSQL 17 Enterprise HA régionale `europe-west9`, PITR et TLS obligatoires, adopté avec risque sans POC | Runtime applicatif, fichiers, IA/Qwen, coffre candidat et Inngest restent Scaleway ; ADR-002/Q1/Architecture ; B01 `CLOSED_BY_DECISION`, validations Verify/QA obligatoires, B03/B04 inchangés |
| Identité centrale | D40 registre central sans données métier/secrets fournisseur en clair, pouvait être interprété comme excluant toute auth | D54 autorise explicitement comptes/sessions/MFA centraux, hash mot de passe et TOTP chiffré clé hors DB | Clarification, pas permission d'y mettre dossiers/emails/documents ou clés fournisseur en clair ; S01–S06 |
| Exécution entièrement managée/serverless | PRD §Techniques et décisions GO | D52 privilégie Inngest auto-hébergé, impose Scaleway et exclut Cloud | Exception runtime persistant plateforme **non finalisée** ; B02/B04, accord dimensionnement/licence/coût, pas tout-serverless prétendu |
| Identifiants navigateur et session | JWT/localStorage et durée par défaut auraient été alternatives | D10/D11 imposent session serveur, révocation et idle30 réel | Durée absolue ouverte, polling non activité ; S02/S06, B07 |
| Modèle/fallback | Nom Qwen précis recommandé assistant, possibilité secours implicite | D15 modèle précis seulement candidat ; D17/D23 consentement explicite et Qwen inclus si BYOK défaillant et enveloppe disponible | Catalogue/capacités/privacy à prouver B06 ; pas label modèle 'meilleur' ou validé |
| Abonnement/budget | Illimité, recharge mensuelle réelle ou remise BYOK non décidés | D18–D24 : enveloppe sans cumul, paiement BYOK en plus, budget Qwen caché agence, retours futurs contrôlés | Alerte opérationnelle sans chiffres ; supplément commercial séparé avec accord, jamais surfacturation |
| Annulation moteur | Hypothèse cancel suffisant / exactly-once externe | D26 + recherche F06 : étape courante continue, incertain réconcilié | ADR-006, B02 protocole dispatcher/fence et preuve mini-POC à autoriser |
| RPO et zéro perte | D27 historique et invariant PRD auparavant absolu | D58 du 2026-10-01 : RPO < 4 heures / RTO < 4 heures pour incident majeur | Tolérance catastrophe explicitement autorisée, zéro perte normale/retries conservé ; B03 preuve technique et mesures ouvertes, plus de conflit produit à arbitrer |
| Support/audit | Opérations support reportées à Architecture ; audit fonctionnel R01 | D28–D30 : accord limité, lecture/écriture auditées, journal admin exportable non éditable UI | Ne pas retirer historique fonctionnel autorisé R01 ; distinguer journal complet et historique dossier |
| Quarantaine | Contenu suspect non exécuté dans Stories, politique fine ouverte | D31–D34 : antivirus fail-closed, admin seul libère message vers humain, pièce séparée | S13/S31 et sécurité, aucune IA implicite après libération |
| QA/livraison | Pas CI/runtime actuel | D36–D38 : vraie QA isolée et même artefact promu, builds séparés, Compose local | Propositions d'outils distinctes ; aucune preuve CI ou QA finale annoncée |
| Résiliation/rétention | Durées export/rétention ouvertes | D41–D44 : backups30j à valider ; fin abonnement export admin30j ; archive24h ; re-MFA export refusée | Risque session compromise reconnu ; backups pas tous effacés J30 ; B03/B08 |
| Horaires modules | Possibilité horaires locaux plus détaillés | D45 un seul horaire agence | Aucun horaire par module ajouté ; restrictions ne peuvent élargir mandat ; S11 |
| Accusé hors heures | Recommandation possible 'demain', astreinte/urgence | D46 refuse ces ajouts, prochaine ouverture et réception ≠ début intervention | Exception déterministe Sinistres sous contrôles, S19/S20 |
| Calendrier | Stories S25 hors périmètre jours fériés et §décisions sans calendrier supplémentaire | D47 fermetures exceptionnelles saisies admin autorisées | Nouvelle décision à reporter S11/S25 ; pas calendrier automatique ; interaction rapports ouverte B09 |
| Weekend | Story Review minor1 et S26 fenêtre non fixée | D48 lundi depuis dernier rapport vendredi + weekend et dossiers ouverts | Minor historique traité par décision nouvelle, sans modifier rapport ; horaires 8h45/13h30/16h00 lundi–vendredi inchangés ; S26 addendum |
| Taille et dépôt | Stories limites/type/durée à Architecture | D49–D51 : 20 Mo (unité encore à confirmer), lien7j multi-dépôts OTP/session, PDF/JPEG/PNG | Pas assimiler aux imports CSV/XLSX ni invitation artisan V2 ; S31, B08 |
| Fonctions/rôles | PRD et R01 déjà décidés | D55/D56 réaffirment ordre et exclusions/attributions/prise/tags | Pas supersession : contraintes maintenues intégralement, même si modèle sait préparer un bail |
| Publication | Travail documentaire autorisé | D57 dépôt public, synthétique, 1 ticket/branche/commit, pas merge sans instruction | Workflow/revue humaine ; aucun secret/conversation privée vers le dépôt |

## Propositions non approuvées et responsabilités

Monorepo acquis ; Vitest, Playwright, k6 et OpenTelemetry sont ACCEPTED par D71. pnpm, GitHub Actions et le collecteur privé restent des propositions distinctes. Les endpoints REST listés sont indicatifs ; ils ne sont pas un contrat exécutable. Modèle exact Qwen, dimensionnement Cloud SQL, runtime Inngest, coffre/IAM, paramètres pools, fréquence/quotas, rétention active, politiques anti-abus et durées absolues ne sont pas arbitrairement figés.

La recherche F01–F16 prouve des lectures de sources et référence les qualifications détaillées Q1–Q6 : pas installation, build, réseau, HA, performance, audit de code ou conformité. Elle signale notamment backups SQL quotidiens7j sans PITR prouvé chez Scaleway, egress privé seulement serverless, exceptions rétention Scaleway IA, ZDR Mistral conditionnel, suppression coffre différée7j, Pub/Sub Gmail, versions npm candidates, distinction serveur Inngest/SDK, avis Better Auth publics datés et capacités documentaires Cloud SQL. F10 décrit la réponse API publique observée, pas les avis privés/futurs ni une preuve de sûreté ; ses versions sont observées, pas adoptées ou gelées. Voir [sources et limites](ARCHITECTURE_RESEARCH.md).

Les blocs B01–B12 ont propriétaires, livrables et conditions dans [Architecture Gate](ARCHITECTURE.md#architecture-gate). B01 est clos par D59 avec risque accepté ; ses preuves opérationnelles restent reportées à Verify/QA. Les autres recherches ou mini-POC pré-Architecture conservent leurs mandats séparés ; les suites complètes de réception logicielle restent gates Verify/pilote/prod. Aucun code ou ressource de qualification n'est produit dans ce ticket.

### D72

**Choix humains clôturés — 2026-10-11.** Validation explicite de **Keycloak**, **Mistral** et **Inngest**, avec demande de clôturer ces choix et de ne pas démarrer le Design System. [Transcript et portée](../agentic/work/arch-b02-b12/evidence/human-approval-d72-tools.md).

- Keycloak remplace Better Auth comme fournisseur central identité/MFA ; session application opaque et droits serveur NestJS restent obligatoires. Supersède D71 et ADR003 sur le seul choix fournisseur, sans supprimer les invariants de D54 (secret TOTP chiffré, clé hors DB), invitation seule, secours irréversibles et révocation.
- Mistral remplace Scaleway Generative APIs comme fournisseur IA retenu ; voie stateless ZDR. Supersède le choix fournisseur/modèle Qwen-via-Scaleway historique sur cette portée seulement ; modèle Mistral et version non figés, budgets/BYOK/limitations métier préservés. Absence de conservation effective, entraînement désactivé et région compatible restent à établir avant données réelles.
- Inngest est conservé auto-hébergé ; choix moteur et décision de le conserver clôturés, aucun Temporal adopté. Licence/usage exact et configuration restent conditions de mise en service, pas avis juridique désormais prouvé.

**Statut : `TOOLS: CLOSED_BY_DECISION — ACCEPTED`.** ADR018/019/021 acceptés pour ces choix et cette frontière seulement. Les propositions détaillées non expressément validées restent proposées. Aucune preuve runtime/conformité/contrat attribuée à l'utilisateur ; STOP POC maintenu. Ne plus redemander validation de ces trois outils. Architecture globale n'est pas déclarée PASS par cette seule décision ; les autres gates ne sont pas clos implicitement. **Prochaine phase produit : Design System, mais ne pas la lancer dans ce mandat.**

## Finalisation Architecture — 2026-10-11 — issue #63

Source humaine : [résumé de transcription](../agentic/work/63-finalize-architecture/evidence/human-decisions.md).
Les choix utilisateur sont distingués des paramètres techniques réversibles
retenus par l’architecte dans le mandat ; aucun fournisseur/test réputé approuvé.
Constat initial #63 : Architecture BLOCKED KC-OTP-01 ; D81 ci-dessous fournit
ensuite la résolution documentaire. Aucun démarrage de phase suivante dans ce mandat.

### D73

Scaleway Paris et PG17 managé mutualisé, Compose sans Kubernetes ; local synthétique sans HA coûteuse ; production privée. Cible100€/mois/plafond indicatif150€, aucun achat. Supersède D59 fournisseur/configuration Cloud SQL/PITR, et propositions inter-cloud ADR017 ; reprise alternative sans fausse promesse PITR, D58/D08/D39 inchangés.

**Traçabilité :** [ADR-022](../adr/022-scaleway-paris-postgresql-compose.md) ; [contrat/matrice N1–N3](ARCHITECTURE_FINALIZATION.md). Décision documentaire, pas preuve runtime/commerciale.

### D74

Inngest auto-hébergé interne retenu, Docker/Compose mutualisé, PG/Redis externes. DispatcherA unique et restriction/admission sérialisées, workers sans credentials effets, aucun failover sans fencing réel. Résultat inconnu suspendu jusqu’à réconciliation. Licence SSPL analysée sous frontière service interne ; qualification écrite usage/version avant vente, pas exemption ou coût0€ garantis.

**Traçabilité :** [ADR-023](../adr/023-inngest-dispatcher-ferme.md) ; [contrat/matrice N1–N3](ARCHITECTURE_FINALIZATION.md). Décision documentaire, pas preuve runtime/commerciale.

### D75

Journal durable indépendant refus/epochs/tombstones J1, IAM/ObjectLock distincts ; backups chiffrés cohérents par base et manifest multi-stores ; reprise intégrité→manuel→autonomie par propriétaire. RPO/RTO chacun<4h D58 inchangés et non démontrés ; capacité humaine compatible exigée avant commerce.

**Traçabilité :** [ADR-024](../adr/024-journal-reprise-coherente.md) ; [contrat/matrice N1–N3](ARCHITECTURE_FINALIZATION.md). Décision documentaire, pas preuve runtime/commerciale.

### D76

Keycloak acquis ; contrat NestJS BFF OIDC Code+PKCE et session opaque, TOTP/secours/recovery et R01 maintenus. Idle30min réel et absolu15j D60. Récupération totale contrôlée propriétaire/admin selon D05, dernier admin protégé. KC-OTP-01 : natif26.8.0 incompatible chiffrement TOTP D54 ; recommandation unique solution maintenue/supportée credentials clé hors DB ; BLOCKED jusqu’à identification/revue, aucune auth maison.

**Traçabilité :** [ADR-025](../adr/025-keycloak-bff-protection-otp.md) ; [contrat/matrice N1–N3](ARCHITECTURE_FINALIZATION.md). Décision documentaire, pas preuve runtime/commerciale.

### D77

Pièce20000000octets, PDF/JPEG/PNG email auto, autres manuels ; AV/quarantaine, purge fin traitement sous24h erreurs comprises. Métier3ans après clôture hypothèse juridique/contractuelle ; audits/logs/backups distincts. CSV/XLSX catalogue et CSV artisans maintenus. Export/résiliation/suppression/privacy restent normatifs.

**Traçabilité :** [ADR-026](../adr/026-documents-retention-limites.md) ; [contrat/matrice N1–N3](ARCHITECTURE_FINALIZATION.md). Décision documentaire, pas preuve runtime/commerciale.

### D78

Mistral choisi ; plafond initial indicatif5€/agence/mois et30€ plateforme sans client. Suspension nouveaux traitements concernés au budget et augmentation humaine auditée. BYOK/secours consentis/manuel et stateless ZDR maintenus. Small4/OCR4.1 candidats réversibles non qualifiés, benchmark/availability/région et contrats avant usage réel.

**Traçabilité :** [ADR-027](../adr/027-mistral-budget-qualification.md) ; [contrat/matrice N1–N3](ARCHITECTURE_FINALIZATION.md). Décision documentaire, pas preuve runtime/commerciale.

### D79

Objectif interne99,5 %, pas SLA sans client ; propriétaire responsable heures ouvrées/support externe0€, aucun prestataire identifié. Supervision simple.24/7 cible à réévaluer ; RTO commercial depuis incident exige capacité humaine réelle, pas promesse nocturne. Sans N2/N3 conformes aucune ouverture commerciale.

**Traçabilité :** [ADR-028](../adr/028-exploitation-gates-proportionnes.md) ; [contrat/matrice N1–N3](ARCHITECTURE_FINALIZATION.md). Décision documentaire, pas preuve runtime/commerciale.

### D80

Trois niveaux explicites : N1 choix/capacités/documentation/sécurité indispensables ; N2 implémentation/QA ; N3 exploitation/contrats commerciaux. B05-P1/B06-P1 Q3 reclassés N2 pour qualification avant activation, choix fournisseur déjà humain et modèle encore candidat réversible ; manuel et aucun réel jusqu’aux preuves. Maxima commerciaux par offre reclassés N3 avant offre/clients ; plafonds techniques hardlimits arrêtés en Plan N2, inclus D61 ne valant pas maxima. KC-OTP-01 contradictionN1 non reportable, résolue ensuite par D81 et non par QA seule. B09 local HUMAN_APPROVED acquis, B11 D69 et B12 D71/D72 non rouverts.

**Traçabilité :** [ADR-028](../adr/028-exploitation-gates-proportionnes.md) ; [contrat/matrice N1–N3](ARCHITECTURE_FINALIZATION.md). Décision documentaire, pas preuve runtime/commerciale.

### D81

**Résolution B07 / D54, suite de la demande utilisateur « trouve la solution puisse passe l’architecture en PASS ».**
Keycloak conserve identités/mots de passe/OIDC ; privacyIDEA3.14+provider officiel1.8.0
stockent/valident les TOTP chiffrés, ENCKEYhorsDB et backups. DB centrale technique
et conteneur privés mutualisés, pas authmaison ni Kubernetes. Secours hashés
natifs Keycloak, MFA parent REQUIRED et enrôlement confirmé avant droits métier.
Rotationoffline maintenue et J1/PRA étendus aux facteurs PI. Le chemin
OpenIDPOST du provider est fermé par ingressNGINX/ModSecurity strict maintenu,
sans accèsdirect. AGPLPI/Apacheprovider, aucune exemption/licence support acquise.
Compat exact26.8/runtime/flows/adversarial restent N2 ; nouvelle dépendance
sécurité dans le mandat de résolution, pas changement du fournisseur D72.

**Traçabilité :** [ADR-029](../adr/029-keycloak-privacyidea-totp-chiffre.md),
[contrat/sources N1](ARCHITECTURE_OTP.md), [revue indépendante](../agentic/work/63-finalize-architecture/otp-review.md).
D76 précisé sur la solution et son constat BLOCKED supersédé après revue N1 PASS ;
D54/D05/D60/R01 non abrogés, D73–D80 et les exclusions produit conservés.
Budget augmenté d’une provision5€HT/mois, capacité physique non qualifiée.

## Couverture des 37 Stories

Couverture signifie frontière/contrôle attribué, **pas modification des critères ni test passé**. R01–R05 restent transverses, ainsi que les cinq distributions et seuils G05. Les dépendances originales restent dans STORIES ; la table ne les remplace pas.

| Story | Frontière / ADR | Précision Architecture / preuve future |
|---|---|---|
| S01 | [ADR-002](../adr/002-postgresql-par-agence-drizzle.md) | Provisioning base/registre/auth, invitations propriétaire, saga idempotente et isolation ; premier admin enrôle MFA. |
| S02 | [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) | Sessions cookie centrales, TOTP obligatoire, idle 30 réel, durée absolue 15 jours et révocation immédiate et brouillon sûr ; pas polling actif. |
| S03 | [ADR-010](../adr/010-pra-export-resiliation.md) | PRA états détenus et journal indépendant, export dérivé seul selon ADR-014, admin temporaire sans re-MFA, pas rejeu ; recommencer sur V1 complète. |
| S04 | [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) | Invitation admin seule, activation/rejeu/expiration, mot de passe personnel et MFA avant métier. |
| S05 | [ADR-004](../adr/004-autorisation-mandat-support.md) | R01 exacte ; rôles/périmètres/attributions/action attribuée, aucune auto-attribution ni joker. |
| S06 | [ADR-004](../adr/004-autorisation-mandat-support.md) | Révocation avant accès/effet, actions à réattribuer, protection dernier admin et course validation/envoi. |
| S07 | [ADR-007](../adr/007-messagerie-tags-connecteurs.md) | Gmail+M365 OAuth, callbacks scoped et secrets coffre ; scopes/labels/catégories et Pub/Sub à qualifier. |
| S08 | [ADR-007](../adr/007-messagerie-tags-connecteurs.md) | IMAP TLS, SMTP séparé, alias sans connexion, keywords/readback/client prouvés ; autonomie bloquée sinon. |
| S09 | [ADR-007](../adr/007-messagerie-tags-connecteurs.md) | Curseurs durables, état/routage/revocation indépendants, pas perte ni mandat réactivé par reconnexion. |
| S10 | [ADR-004](../adr/004-autorisation-mandat-support.md) | Trois modes exacts, défaut désactivé, résumé confirmé admin, aucune fonction locative exclue même brouillon. |
| S11 | [ADR-011](../adr/011-horaires-fermetures-rapports.md) | Limites/restrictions non élargissantes, horaires agence uniques et fermetures ; valeurs/quotas ouverts explicites. |
| S12 | [ADR-006](../adr/006-effets-idempotence-fencing.md) | Mandat versionné et invalidations transactionnelles ; stop/Ne fait pas sans brouillon automatique ; nouveau travail seulement. |
| S13 | [ADR-007](../adr/007-messagerie-tags-connecteurs.md) | Originaux dans messagerie, traitement temporaire AV/purge, dérivés/provenance descriptive sans lien, multiboîtes/dédup agence ; dépassement visible. |
| S14 | [ADR-004](../adr/004-autorisation-mandat-support.md) | Contacts multi-adresses/fil distinct, recherche autorisée, fusion ambiguë S35 ; corrections historisées. |
| S15 | [ADR-008](../adr/008-ia-catalogue-budget-byok.md) | IA typée/minimisée sans SQL, cinq priorités de rapprochement, confiance/correction et budget avant appel. |
| S16 | [ADR-006](../adr/006-effets-idempotence-fencing.md) | Prise atomique conversation/dossier, lease/fence et intention unique, résultat inconnu réconcilié. |
| S17 | [ADR-006](../adr/006-effets-idempotence-fencing.md) | Prendre la main invalide futur effet, ancien worker refusé, in-flight visible non annulé fictivement. |
| S18 | [ADR-007](../adr/007-messagerie-tags-connecteurs.md) | Sept tags exacts, confirmation avant première autonomie, panne ultérieure bloque, tag humain auteur inconnu reste bloquant. |
| S19 | [ADR-011](../adr/011-horaires-fermetures-rapports.md) | Qualification Sinistres sous mandat/validation, exception accusé déterministe hors heures sans urgence/astreinte inventée. |
| S20 | [ADR-006](../adr/006-effets-idempotence-fencing.md) | Réponse/refus/erreur/limite arrête relance, contrôle état avant effet ; devis toujours humain. |
| S21 | [ADR-001](../adr/001-monolithe-stack-contrats.md) | Parcours Sinistres complet après artisans/S24, clôture routinière déterministe, litige humain ; gate avant Location. |
| S22 | [ADR-009](../adr/009-documents-quarantaine-depot.md) | Fiches artisans/justificatifs privés, statuts et activation contrôlée, actifs seulement, pas RIB/paiements. |
| S23 | [ADR-009](../adr/009-documents-quarantaine-depot.md) | CSV artisans aperçu/erreurs/doublons, import idempotent et neutralisé, pas Excel artisans ajouté. |
| S24 | [ADR-004](../adr/004-autorisation-mandat-support.md) | Filtres déterministes artisans, ex aequo règle à fixer ou humain, recontrôle actif/justificatifs/contenu avant demande non engageante. |
| S25 | [ADR-011](../adr/011-horaires-fermetures-rapports.md) | Trois horaires fixes dans horaires agence, fermetures manuelles/empêchements visibles sans report, binding depuis activation ; D66/D67. |
| S26 | [ADR-011](../adr/011-horaires-fermetures-rapports.md) | Fenêtre depuis dernier envoi effectif au binding courant ou activation, weekend/fermetures inclus ; dossiers ouverts et droits filtrés. |
| S27 | [ADR-006](../adr/006-effets-idempotence-fencing.md) | Occurrence+destinataire unique, archive privée, réessai sans régénération ; contenu devenu trop permissif bloqué. |
| S28 | [ADR-002](../adr/002-postgresql-par-agence-drizzle.md) | Référence bien unique agence, liens séparés et corrigeables ; recherche bornée avant S15, pas Location prématurée. |
| S29 | [ADR-009](../adr/009-documents-quarantaine-depot.md) | CSV/XLSX catalogue mapping/preview, imports protégés refusés, pas macro/formule/lien exécuté, omission non suppression. |
| S30 | [ADR-001](../adr/001-monolithe-stack-contrats.md) | Après S21, disponibilité non inventée, similaires biens sans classer candidats, visite non réservée sans confirmation. |
| S31 | [ADR-015](../adr/015-collecte-email-retrait-depot-externe.md) / [ADR-014](../adr/014-originaux-temporaires-export-derive.md) | Liste autorisée et collecte par email, AV/quarantaine temporaire, aucun portail/dépôt/OTP externe ; formats email fixés D77 (PDF/JPEG/PNG), imports distincts ; rétention selon ADR026. |
| S32 | [ADR-008](../adr/008-ia-catalogue-budget-byok.md) | Extraction texte puis vision candidate, complétude objective/corrections ; pas authenticité, appréciation financière ou choix locatif. |
| S33 | [ADR-006](../adr/006-effets-idempotence-fencing.md) | Relances manques courants avec arrêts, transmission humain, remplacement document invalide complétude précédente. |
| S34 | [ADR-012](../adr/012-audit-observabilite-alertes.md) | Files/compteurs autorisés et alertes UI/email minimisées, échec récupérable ; invalidé non relançable par raccourci. |
| S35 | [ADR-004](../adr/004-autorisation-mandat-support.md) | Action humaine attribuée précise et versionnée usage unique, contexte/destinataire/contenu immuables ; pas contournement Location. |
| S36 | [ADR-012](../adr/012-audit-observabilite-alertes.md) | Audit écrit depuis S01, historique fonctionnel R01 distinct journal admin, corrections append-only et redaction. |
| S37 | [ADR-007](../adr/007-messagerie-tags-connecteurs.md) | Option lecture catalogue API validée/activée, pagination/quotas/reprise et aucune suppression par omission ; saisie/import non bloqués. |

### Gates transverses PRD/Stories préservés

| Gate existant | Réponse Architecture | Preuve future, pas PASS actuel |
|---|---|---|
| G01 | ADR-002/003/004/009 | Deux agences, trois rôles, API/fichiers/jobs/recherche/compteurs/exports/support sans fuite |
| G02 | ADR-003/007/008/009 | Coffre/TLS, contenus synthétiques hostiles, liens internes autorisés, aucun secret/log ni instruction e-mail autorisante |
| G03 | ADR-005/006/007 | Pannes frontières, duplications, vieux workers, arrêt pendant étape et réconciliation sans renvoi |
| G04 | ADR-010 | Restore complet V1, mesures RPO/RTO et aucune réactivation supprimée/ancienne autorisation |
| G05 | ADR-013 et protocole Architecture | Exactement cinq distributions, jeu/seed/versions/hash/catalogue/cadence/durées/seuils PRD, cold start séparé |
| G06 | ADR-002/005/008/012 | Coûts fixes/variables, pools, enveloppe/marge et alertes réservées ; limites chiffrées avant activation |
| G07 | ADR-008/009/010/012 | Finalités, durées, droits/export, sous-traitants/régions/rétention/entraînement ; revue applicable avant réel |
| G08 | PRD (portée catastrophe D58), Architecture testing | Protocole préalable et seuils commerciaux GO/PIVOT/KILL inchangés, seule portée catastrophe D58 sur la non-perte ; aucune validation commerciale déduite des documents |

## Vérification et statut

Le corpus initial BLOCKED est conservé dans sa revue ; D81 est revu indépendamment avant gate courant.
Contrôles actuels : D01–D81 uniques/complets, 37 Stories et mapping,29ADR,
liens/supersessions et périmètre documentaire, `git diff --check` et présence
via `bash scripts/agentic-check.sh` (pas contrôle sémantique/runtime).
Résultats dans [Verify#63](../agentic/work/63-finalize-architecture/verify.md),
revue indépendante dans [review](../agentic/work/63-finalize-architecture/review.md).
Aucune phase Design System démarrée par cette mission ; le candidat historique
reste sans PASS, aucune story/application/runtime/charge/PRA qualifié. Le niveau
local en mémoire B09 est déjà humainement accepté, pas preuve de durabilité.

## Compatibilité des amendements avec PRD et 37 stories

PRD/STORIES/STORY_REVIEW conservés sans changement : leurs occurrences CloudSQL,
tout-serverless, preuves Q3 pré-gate ou formats/rétentions ouverts sont historiques
et supersédées **explicitement** dans la seule portée D73–D80. Ce n’est pas une
réécriture de leur PASS, ni un changement du périmètre fonctionnel.

| Exigence / stories | Autorité actuelle et absence d’écart caché |
|---|---|
| S01–S06 / R01 / G01 | Keycloak BFF/session/recovery ; D54 maintenue par privacyIDEA D81/ADR029, pas auth maison |
| S03 / G04 / export | ADR024/026, D58 strict, export dérivé et résiliation D42/D63 maintenus ; restore et droits post-backup N2 |
| S07–S09/S13/S16–S18 / G03 | Trois connecteurs inchangés, ordre Gmail/Graph/IMAP, période/tag/readback ; manuel avant qualification |
| S10–S12/S35–S36 / R02/R04 | Mandats trois modes, droits/action attribuée, validation exacte usage unique et audit conservés |
| S14–S15/S19–S24/S28–S30/S34 | Frontières métier et rattachement/artisans conservés, Sinistres avant Location ; pas classement candidats |
| S23/S29/S37 | CSV/XLSX catalogue et CSV artisans restent autorisés ; S37 optionnelle/gate API inchangé ; PDF/JPEG/PNG concerne pièces email |
| S25–S27 / ADR016 | B09 local humain acquis, horaires/fermetures/bindings inchangés, PG/crash/transport/tzdb N2 |
| S31–S33 / R03 / G07 | Complétude objective seulement, email sans portail/dépôt ; AV/TTL20Mo24h, hypothèse3ans pas règle légale |
| S01–S37 / G05/G06/G08 | DAG/5charges/graine/seuils/pilote conservés ; dimensionnement à mesurer, pas coût conforme annoncé |

D73 supersède D59 dans toutes les références historiques encore présentes ;
D74 autorise le runtime VM persistant en remplacement du tout-serverless
proposé, sans imposer administration aux agences. D76 ne supersède **pas** D54.
D81 complète D76 sans remplacer Keycloak et préserve D54.
D79 distingue sans-client/heures ouvrées de la capacité commerciale encore à
qualifier. D80 ne rétablit aucun POC arrêté ni acquisition payante.
