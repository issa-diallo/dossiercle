# Registre des décisions Architecture — DossierClé

Date : **2026-09-30**. Issue [#27](https://github.com/issa-diallo/dossiercle/issues/27). Mode LARGE. [Architecture](ARCHITECTURE.md) **BLOCKED** ; le registre conserve les **57 entrées historiques D01–D57** et leurs réserves, complétées par **D58 du 2026-10-01 (#30)**, avec un ADR principal localisable par entrée. Ce document n'autorise ni implémentation, ni pilote, ni merge.

## Autorité et force des décisions

Source : registre intégral des confirmations explicites utilisateur du 30 septembre 2026 transmis à l'auteur ; transposition publique sans conversations privées ni identités réelles. L'ordre du corpus a été lu : AGENTS, README, METHOD, WORKFLOW, COMMITS, SCALING, PRD intégral, Stories intégral, Story Review et templates. [PRD](PRD.md) et [Stories](STORIES.md) reçoivent le seul amendement catastrophe D58 du 2026-10-01 (#30) ; [Story Review](STORY_REVIEW.md) reste inchangée. La revue historique porte sur ses propres empreintes, pas sur ce registre nouveau.

- **Confirmé utilisateur** : obligation de principe, force conservée. Un choix confirmé peut rester techniquement bloqué.
- **Conditionnel** : Inngest privilégié sous conditions, pas validé production ; ADR-005 PROPOSED.
- **Proposition de conception** : détails outillage, topologie, contrat indicatif, algorithme et dimensionnement ne sont pas présentés comme approuvés par l'utilisateur. L'acceptation documentaire de leur principe ne remplace pas la preuve runtime.
- **Objectif d'acceptation** : test futur, pas fait acquis. RPO/RTO, absence de fuite/perte/double effet et charge exigent preuves.
- **Ouvert** : décision/protocole de qualification nécessaire au gate indiqué. Propriétaires par rôle dans Architecture, aucune personne supposée engagée.

## Index des ADR

| ADR | Décision | Statut de principe | Qualification ouverte |
|---|---|---|---|
| [ADR-001](../adr/001-monolithe-stack-contrats.md) | Monolithe modulaire TypeScript et contrats indépendants | ACCEPTED | B02, B04, B12 |
| [ADR-002](../adr/002-postgresql-par-agence-drizzle.md) | PostgreSQL distinct par agence, Drizzle et flotte maîtrisée | ACCEPTED | B01, B03, B04 |
| [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) | Identité centrale Better Auth, MFA obligatoire et sessions serveur | ACCEPTED | B04, B07, B12 |
| [ADR-004](../adr/004-autorisation-mandat-support.md) | Autorisation R01, mandat révocable et accès support consenti | ACCEPTED | B02, B07, B11 |
| [ADR-005](../adr/005-inngest-scaleway-conditionnel.md) | Inngest auto-hébergé Scaleway sous conditions | PROPOSED | B02, B03, B04 |
| [ADR-006](../adr/006-effets-idempotence-fencing.md) | Outbox durable et barrière transactionnelle des effets externes | ACCEPTED | B02, B03, B06 |
| [ADR-007](../adr/007-messagerie-tags-connecteurs.md) | Trois connecteurs e-mail pilotes et tags comme précondition | ACCEPTED | B04, B05 |
| [ADR-008](../adr/008-ia-catalogue-budget-byok.md) | Catalogue IA approuvé, Qwen inclus, BYOK et secours consenti | ACCEPTED | B06, B08 |
| [ADR-009](../adr/009-documents-quarantaine-depot.md) | Documents privés, quarantaine et dépôt sans compte borné | ACCEPTED | B04, B08 |
| [ADR-010](../adr/010-pra-export-resiliation.md) | PRA mesurable, export limité et résiliation sans résurrection | ACCEPTED | B01, B03, B08 |
| [ADR-011](../adr/011-horaires-fermetures-rapports.md) | Horaires agence uniques, fermetures et rapports fixes | ACCEPTED | B09, B11 |
| [ADR-012](../adr/012-audit-observabilite-alertes.md) | Audit distinct et alertes minimisées | ACCEPTED | B02, B08, B10, B12 |
| [ADR-013](../adr/013-qa-livraison-tests.md) | QA isolée, promotion humaine et rollback compatible | ACCEPTED | B01–B12 selon composant ; revue indépendante |

## Mapping exhaustif D01–D57

Chaque entrée conserve le texte source, y compris ce qui reste proposition ou preuve manquante. Les liens renvoient au lieu de conception et à l'ADR principal ; les autres ADR peuvent imposer des contraintes transverses. Aucun `ACCEPTED` ne transforme une réserve du texte en validation.

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

## Addendum et supersessions

Cet addendum expose les écarts ; seul le carve-out catastrophe D58 est reporté au PRD/Stories par #30, sans réécrire le rapport de revue ni attribuer une approbation rétroactive. Avant Research/Design des stories affectées, propriétaire produit et reviewer indépendant doivent approuver les modifications du corpus autorisées au ticket correspondant. Aucune story n'est Ready for Execute.

| Sujet | État antérieur / proposition abandonnée | Décision postérieure qui prévaut | Traitement / gate |
|---|---|---|---|
| Création agence/comptes | PRD création administrateur, méthode auth ouverte | D01–D05 : invitation plateforme/agence, MFA et récupération contrôlée | Compléter S01/S02/S04 sans inscription libre ; B07/B11 |
| Stack/ORM | Framework/auth/queue reportés à Architecture ; alternatives microservices/ORM | D06–D09/D39/D53 : Nest/React/Vite, Drizzle/pg, Better Auth ; Inngest seulement conditionnel | ADR-001/002/003/005, versions et preuves non acquises |
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

Architecture propose une arborescence monorepo, pnpm, Vitest, Playwright, k6, OpenTelemetry/collecteur privé et GitHub Actions. Les endpoints REST listés sont indicatifs ; ils ne sont pas un contrat exécutable. Modèle exact Qwen, produit PG, runtime Inngest, coffre/IAM, paramètres pools, fréquence/quotas, rétention active, politiques anti-abus et durées absolues ne sont pas arbitrairement figés.

La recherche F01–F09 prouve des lectures de sources : pas installation, build, réseau, HA, performance ou conformité. Elle signale notamment backups SQL quotidiens7j sans PITR prouvé, egress privé seulement serverless, exceptions rétention Scaleway IA, ZDR Mistral conditionnel, suppression coffre différée7j, Pub/Sub Gmail, et versions npm candidates. Voir [sources et limites](ARCHITECTURE_RESEARCH.md).

Les choix structurants B01–B12 ont propriétaires, livrables et condition de clôture dans [Architecture Gate](ARCHITECTURE.md#architecture-gate). Une recherche de qualification ou un mini-POC pré-Architecture exige mandat séparé si nécessaire ; les suites complètes de réception logicielle restent gates Verify/pilote/prod, pas précondition de rédaction. Aucun code ou ressource de qualification n'est produit dans ce ticket.

## Couverture des 37 Stories

Couverture signifie frontière/contrôle attribué, **pas modification des critères ni test passé**. R01–R05 restent transverses, ainsi que les cinq distributions et seuils G05. Les dépendances originales restent dans STORIES ; la table ne les remplace pas.

| Story | Frontière / ADR | Précision Architecture / preuve future |
|---|---|---|
| S01 | [ADR-002](../adr/002-postgresql-par-agence-drizzle.md) | Provisioning base/registre/auth, invitations propriétaire, saga idempotente et isolation ; premier admin enrôle MFA. |
| S02 | [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) | Sessions cookie centrales, TOTP obligatoire, idle30 réel, révocation immédiate et brouillon sûr ; pas polling actif. |
| S03 | [ADR-010](../adr/010-pra-export-resiliation.md) | PRA bases+objets+orchestration, export admin temporaire sans re-MFA, pas rejeu ; recommencer sur V1 complète. |
| S04 | [ADR-003](../adr/003-identite-centrale-better-auth-mfa.md) | Invitation admin seule, activation/rejeu/expiration, mot de passe personnel et MFA avant métier. |
| S05 | [ADR-004](../adr/004-autorisation-mandat-support.md) | R01 exacte ; rôles/périmètres/attributions/action attribuée, aucune auto-attribution ni joker. |
| S06 | [ADR-004](../adr/004-autorisation-mandat-support.md) | Révocation avant accès/effet, actions à réattribuer, protection dernier admin et course validation/envoi. |
| S07 | [ADR-007](../adr/007-messagerie-tags-connecteurs.md) | Gmail+M365 OAuth, callbacks scoped et secrets coffre ; scopes/labels/catégories et Pub/Sub à qualifier. |
| S08 | [ADR-007](../adr/007-messagerie-tags-connecteurs.md) | IMAP TLS, SMTP séparé, alias sans connexion, keywords/readback/client prouvés ; autonomie bloquée sinon. |
| S09 | [ADR-007](../adr/007-messagerie-tags-connecteurs.md) | Curseurs durables, état/routage/revocation indépendants, pas perte ni mandat réactivé par reconnexion. |
| S10 | [ADR-004](../adr/004-autorisation-mandat-support.md) | Trois modes exacts, défaut désactivé, résumé confirmé admin, aucune fonction locative exclue même brouillon. |
| S11 | [ADR-011](../adr/011-horaires-fermetures-rapports.md) | Limites/restrictions non élargissantes, horaires agence uniques et fermetures ; valeurs/quotas ouverts explicites. |
| S12 | [ADR-006](../adr/006-effets-idempotence-fencing.md) | Mandat versionné et invalidations transactionnelles ; stop/Ne fait pas sans brouillon automatique ; nouveau travail seulement. |
| S13 | [ADR-007](../adr/007-messagerie-tags-connecteurs.md) | Original durable, multiboîtes/provenances et dédup agence ; quarantaine message/objet, dépassement visible. |
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
| S25 | [ADR-011](../adr/011-horaires-fermetures-rapports.md) | Rapports lundi–vendredi trois horaires, fuseau/DST/destinataires ; nouveau cas fermetures B09, pas horaire déplacé. |
| S26 | [ADR-011](../adr/011-horaires-fermetures-rapports.md) | Lundi depuis dernier vendredi+weekend/dossiers ouverts ; aucun activité et filtrage droits, addendum minor historique. |
| S27 | [ADR-006](../adr/006-effets-idempotence-fencing.md) | Occurrence+destinataire unique, archive privée, réessai sans régénération ; contenu devenu trop permissif bloqué. |
| S28 | [ADR-002](../adr/002-postgresql-par-agence-drizzle.md) | Référence bien unique agence, liens séparés et corrigeables ; recherche bornée avant S15, pas Location prématurée. |
| S29 | [ADR-009](../adr/009-documents-quarantaine-depot.md) | CSV/XLSX catalogue mapping/preview, imports protégés refusés, pas macro/formule/lien exécuté, omission non suppression. |
| S30 | [ADR-001](../adr/001-monolithe-stack-contrats.md) | Après S21, disponibilité non inventée, similaires biens sans classer candidats, visite non réservée sans confirmation. |
| S31 | [ADR-009](../adr/009-documents-quarantaine-depot.md) | Collecte privée liste autorisée, dépôt lien7j OTP/session PDF/JPEG/PNG et AV, aucune lecture dossier externe. |
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
| G02 | ADR-003/007/008/009 | Coffre/TLS, contenus synthétiques hostiles, liens/OTP, aucun secret/log ni instruction e-mail autorisante |
| G03 | ADR-005/006/007 | Pannes frontières, duplications, vieux workers, arrêt pendant étape et réconciliation sans renvoi |
| G04 | ADR-010 | Restore complet V1, mesures RPO/RTO et aucune réactivation supprimée/ancienne autorisation |
| G05 | ADR-013 et protocole Architecture | Exactement cinq distributions, jeu/seed/versions/hash/catalogue/cadence/durées/seuils PRD, cold start séparé |
| G06 | ADR-002/005/008/012 | Coûts fixes/variables, pools, enveloppe/marge et alertes réservées ; limites chiffrées avant activation |
| G07 | ADR-008/009/010/012 | Finalités, durées, droits/export, sous-traitants/régions/rétention/entraînement ; revue applicable avant réel |
| G08 | PRD (portée catastrophe D58), Architecture testing | Protocole préalable et seuils commerciaux GO/PIVOT/KILL inchangés, seule portée catastrophe D58 sur la non-perte ; aucune validation commerciale déduite des documents |

## Vérification et statut

Le livrable documentaire peut être revu indépendamment malgré Architecture BLOCKED. Les contrôles auteur historiques portaient sur D01–D57 ; l’amendement #30 ajoute D58 et vérifie les décisions antérieures préservées, 37 Stories, sections ADR, liens locaux, périmètre des fichiers, `git diff --check` et présence des artefacts via `bash scripts/agentic-check.sh`. Les résultats réels sont transmis dans un rapport auteur hors dépôt ; pas d'auto-approbation indépendante. Design System non commencé, aucune story implémentée, aucune preuve runtime/charge/PRA ou CI applicative annoncée.
