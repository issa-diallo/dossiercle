# Architecture — DossierClé

> **D72 — choix clôturés :** Keycloak remplace Better Auth ; Mistral remplace Scaleway Generative APIs ; Inngest conservé. ADR018/019/021 acceptés pour les choix, preuves de livraison distinctes. [Décision](ARCHITECTURE_DECISIONS.md#d72). Design System NON DÉMARRÉ, sur instruction utilisateur. Autres gates Architecture non clos implicitement.

> **D71 historique — 2026-10-11 : stack validée, POC arrêté sur demande utilisateur ; choix auth/IA actualisés D72.** React 19, TypeScript 6, Vite 8 ; NestJS 12, Node.js 24, Express 5 ; PostgreSQL 17/Drizzle ; Better Auth/NestJS ; Inngest ; Vitest, Playwright, k6 et OpenTelemetry sont les choix acquis. Le POC n'est plus un préalable à leur adoption. B12 : choix stack/outillage clos par décision, preuves techniques restantes dans les stories. Aucun nouveau POC/reprise autorisé. Les mentions antérieures de stack proposée, de POC à terminer avant adoption et d'acquisition encore autorisée sont supersédées dans cette portée. Architecture globale non qualifiée, exigences sécurité et décisions d'exploitation encore ouvertes. [D71](ARCHITECTURE_DECISIONS.md#d71), [preuve d'arrêt](../agentic/work/b12-p-1-bootstrap/evidence/user-stop.json).

## Status

`ARCHITECTURE: BLOCKED`

Date : 2026-09-30. Mode **LARGE**. Issue [#27](https://github.com/issa-diallo/dossiercle/issues/27). Livrable de conception documentaire, pas une implémentation ni une autorisation de pilote. Constat historique #27 : absence de runtime produit/CI applicative ; POC temporel local et workflow documentaire ajoutés depuis, sans qualifier le produit ; `scripts/agentic-check.sh` ne vérifie que la présence de fichiers.

**Les décisions utilisateur de principe sont fermes ; leur faisabilité reste à prouver.** `ACCEPTED` ou `ACCEPTED_WITH_RISK` dans un ADR ne signifie pas test réussi. B01 est `CLOSED_BY_DECISION — ACCEPTED_WITH_RISK` depuis le 2026-10-04 : le produit PostgreSQL est choisi, mais ses validations opérationnelles sont reportées à Verify/QA avant Production. Inngest est choisi comme moteur par D71 ; licence, runtime et topologie restent à finaliser. B09 est QUALIFIED_LOCALLY_PENDING_HUMAN et sa fermeture est seulement proposée ; B11 PASS humain documentaire selon D69. Les blocages restants et les gates humains empêchent toujours Architecture PASS et donc le démarrage du Design System et des phases story.

Sources internes : [PRD](PRD.md), [37 Stories](STORIES.md), [Story Review historique](STORY_REVIEW.md), [registre D01–D68 et addendum](ARCHITECTURE_DECISIONS.md). Ce dernier transpose les confirmations utilisateur et distingue décisions, propositions et supersessions. [D58](ARCHITECTURE_DECISIONS.md#d58) amende les objectifs PRA ; [D59](ARCHITECTURE_DECISIONS.md#d59) adopte Cloud SQL avec risque accepté. D60–D68 réconcilient les arbitrages #33/#42/#50. Story Review reste inchangée ; son PASS historique ne valide pas ces ajouts. Dossier courant [remediation](ARCHITECTURE_REMEDIATION.md), protocoles [B02/B03 proposés](ARCHITECTURE_PROTOCOL_PROPOSAL.md). Q1–Q6 restent historiques byte-for-byte ; leurs décisions/couts obsolètes sont explicitement supersédés ici, jamais réécrits.

## Contexte

SaaS pour agences immobilières mixtes, multi-boîtes, données personnelles et documents privés. Le socle, les Sinistres puis la Gestion locative/Location partagent un monolithe modulaire. **Les deux workflows font partie de V1 ; Sinistres est validé avant Location.** Le catalogue minimal et la validation humaine doivent donc précéder certains écrans métier. V2 invitation artisan et portail ultérieur sont exclus de cette architecture V1 livrable.

Google Cloud SQL Paris `europe-west9` est la cible PostgreSQL active. Scaleway Paris reste retenu pour l'hébergement applicatif, les fichiers privés et les choix distincts IA/Inngest ; la décision Cloud SQL ne les remplace pas. Le traitement IA reste UE, minimisé, sans entraînement et à conservation maîtrisée. Une région cloud ne prouve ni conformité RGPD ni absence de transferts chez les sous-traitants. Finalités, durées actives, droits et liste documentaire autorisée restent à formaliser avant données réelles. Aucune donnée réelle, secret ni URL privée ne figure ici.

Le coût initial doit rester faible, sans serveur réservé systématiquement à chaque agence inactive. Une base distincte n'impose pas une instance physique par agence. La mutualisation d'instances n'autorise pas le mélange des bases métier. Compétences d'équipe et capacité d'astreinte non établies ; aucune date de livraison ni SLA commercial n'est inventé. L'exploitation d'Inngest persistant à l'échelle plateforme constitue une exception potentielle au PRD entièrement managé/serverless, explicitement bloquante tant qu'elle n'est pas arbitrée et chiffrée.

## Stack decision

### Requirements

- Préserver R01–R05 des Stories : rôles/attributions explicites, interdictions Location, original dans messagerie et dérivés minimisés, mandat déterministe, audit dès le socle et contrôle avant effet.
- Tester les cinq répartitions de charge PRD, 1/50/200 sessions utilisateur, latence interactive p95 inférieure à 2 secondes ; accepter les longues tâches en moins de 2 secondes sans les exécuter dans la requête.
- Cloisonner chaque base et chaque secret, révoquer les sessions effectivement, reprendre sans renvoi aveugle, rendre toute erreur visible.
- Construire et déployer frontend et backend séparément avec compatibilité contractuelle, sans distribuer les transactions métier en microservices.
- Mesurer coûts fixes, coûts variables et reprise ; viser RPO < 4 heures/RTO < 4 heures sans les annoncer acquis.

### Options considered

| Option | Composition | Avantages | Limites et disposition |
|---|---|---|---|
| A — monolithe modulaire retenu | React/TS/Vite ; NestJS/TS ; bases PostgreSQL par agence sur Cloud SQL ; Drizzle/pg ; **Keycloak (D72 ; Better Auth est historique D71)** ; services applicatifs/fichiers/IA distincts chez Scaleway | Domaine central, transactions locales, contrats typés, livraison progressive | Flotte de bases, exploitation multi-cloud et orchestration à maîtriser ; retenu par utilisateur |
| B — microservices métier | Même frontend, plusieurs services/DB et auth commune | Déploiements métier autonomes | Transactions distribuées, observabilité et coûts prématurés ; rejeté V1 |
| C — application fortement intégrée/ORM généraliste | Front/backend couplés ; Prisma ou MikroORM ; jobs maison | Outillage intégré, moins de frontières apparentes | Couplage de livraison, hypothèses pools/serverless, maintenance des reprises ; alternatives non retenues après comparaison |
| D — orchestration SaaS ou n8n | Moteur externe managé ou low-code | Moins d'exploitation initiale | Inngest Cloud et n8n incompatibles avec décisions ; rejetés, pas secours implicite |

### Selected stack

| Couche | Choix et statut |
|---|---|
| Langage / frontend | TypeScript 6, React 19, Vite 8 — ACCEPTED D71 ; Design System non commencé |
| Backend / API | NestJS 12, Node.js 24, Express 5 ; REST + OpenAPI ; longues tâches asynchrones — ACCEPTED D71 |
| Données / accès | Google Cloud SQL for PostgreSQL 17 Enterprise, HA régionale `europe-west9`, PITR activé et TLS obligatoire ; JSONB validé/versionné ; base distincte par agence ; Drizzle + `pg` — `ACCEPTED_WITH_RISK`, preuves QA futures |
| Auth / autorisation | Keycloak central — ACCEPTED D72, remplace Better Auth ; backend NestJS/session opaque ; protection TOTP D54 et consommation des secours à qualifier avant livraison |
| Cache | Aucun cache de session/droits retardant une révocation. Cache de données non sensibles possible uniquement après preuve d'invalidation ; non retenu comme prérequis |
| Jobs | Inngest — choix moteur/conservation CLOSED_BY_DECISION D72 ; auto-hébergé Scaleway ; licence/usage et configuration à qualifier avant mise en service |
| Fichiers | Copies de travail temporaires privées Scaleway Paris hors PG, quarantaine/AV et purge ; aucune conservation durable originaux D62 ; durée/configuration ouvertes B08 |
| Messagerie | Gmail OAuth, Microsoft 365 OAuth, IMAP sécurisé + SMTP sécurisé dès pilote V1 ; capacités séparément qualifiées |
| IA | Mistral stateless ZDR — fournisseur ACCEPTED D72, remplace Scaleway Generative APIs ; modèle à sélectionner ; ZDR/entraînement/région à prouver avant réel ; budgets/BYOK préservés |
| Recherche | Proposition : requêtes PostgreSQL indexées bornées et recherche exacte d'abord ; pas moteur externe ni SQL IA |
| Observabilité | OpenTelemetry — ACCEPTED D71 ; audit métier/sécurité distinct, collecteur privé et rétention à finaliser |
| Secrets | Coffre par agence ; Secret Manager Scaleway candidat, IAM/rotation/workload identity à prouver |
| Infra / hébergement | Services applicatifs/fichiers/IA/Inngest chez Scaleway selon leurs décisions propres ; PostgreSQL chez Google Cloud SQL Paris ; réseau inter-cloud, identité workload, egress, latence et coût restent à prouver B04 |
| CI/CD | Proposition GitHub Actions, artefacts immuables, QA puis accord humain ; aucune pipeline applicative présente ou exécutée |
| Tests | Vitest, Playwright, k6 — ACCEPTED D71 ; tests NestJS HTTP avec PostgreSQL réel, preuves de compatibilité/build/runtime dans les stories, aucun nouveau POC préalable |
| Package/build | Monorepo acquis ; TypeScript 6/Vite 8 ACCEPTED D71. pnpm expérimenté localement, non ajouté implicitement au choix humain ; lock produit à figer dans la préparation de la story socle |

### Why this stack / Trade-offs / Rejected alternatives

Le monolithe met règles, verrouillage et données d'une agence dans une frontière transactionnelle tout en isolant les adaptateurs. Drizzle laisse visibles SQL, transactions et pools ; il ne fournit pas automatiquement gestion de flotte ni sécurité multi-agence. Prisma offrait une expérience intégrée, MikroORM une unité de travail riche ; ces abstractions ne dispensent pas de router chaque connexion et de migrer chaque base. PostgreSQL apporte contraintes et transactions ; JSONB n'est pas un schéma libre. REST/OpenAPI permet des clients indépendants, contrairement à un contrat implicite partagé uniquement par compilation TypeScript. React/Vite sépare l'interface d'un backend responsable des règles et secrets ; ce choix exige une politique de cookies/origines explicite.

Historique D71 : Better Auth évitait de créer toutes les primitives d'authentification, mais ne validait pas la récupération manuelle, la MFA obligatoire, l'idle timeout ni l'intégration NestJS tierce. D72 a retenu Keycloak ; les inconnues d'intégration et de configuration restent au gate B07. Une base unique avec `tenant_id` ou des schémas séparés simplifierait les migrations : elle est rejetée car contraire à D08. JWT en localStorage rejeté car contraire à la révocation serveur/cookie. Un moteur de jobs maison éviterait une licence tierce, mais reporte durabilité, reprise et exploitation dans le produit : uniquement une option de réarbitrage si Inngest échoue, jamais un remplacement décidé silencieusement.

## Repository structure

Structure **cible proposée**, absente à ce jour ; aucun répertoire applicatif n'est créé par ce ticket :

```text
apps/web/                  React + Vite
apps/api/                  NestJS ; modules et points d'entrée HTTP/jobs
packages/contracts/        schémas DTO/OpenAPI, événements versionnés
packages/domain/           règles pures et types métier sans fournisseur
packages/adapters/         pg/Drizzle, mail, IA, fichiers, orchestration
packages/testing/          fixtures exclusivement synthétiques
 tests/performance/        générateur et exports prescrits par le PRD
 docs/product/             besoins, architecture, décisions
 docs/adr/                 décisions structurantes
```

Les chemins exacts seront stabilisés en Plan. Interdire les imports frontend de secrets, du pilote PG ou des tables internes ; les contrats ne doivent pas devenir un accès partagé aux repositories. Un worker déployé séparément peut exécuter le même monolithe, ce n'est pas un nouveau microservice métier.

## Boundaries / modules

| Module | Responsabilité et données propriétaires | Interfaces et interdictions |
|---|---|---|
| Contrôle plateforme | Registre agences, abonnement, modules, localisation DB, références coffre, provisioning | Ne lit pas les dossiers. Provisioning privilégié séparé du compte runtime |
| Identité centrale | Comptes, invitations, sessions, MFA, appartenances et versions d'autorisation | Émet contexte authentifié ; ne donne pas accès implicite à toutes agences |
| Socle agence | Boîtes/alias, contacts, conversations, dossiers, attributions, mandat, prises, validation, audit | Services métier seuls autorisent et modifient ; pas de bypass par job |
| Entrée et documents | Inbox durable minimisée, provenance descriptive, déduplication, copies temporaires/quarantaine et purge ; aucun dépôt client | Aucun contenu reçu n'est une instruction privilégiée |
| Orchestration / effets | Échéances, outbox, exécutions, intentions d'effet, réconciliation | Inngest déclenche, la DB métier décide de la validité ; adaptateurs d'effet derrière barrière |
| Sinistres | Qualification, urgence justifiée, artisans/CSV, sélection déterministe, suivi devis et résolution | Affectation/engagement/devis/dépense/indemnisation/litige : humain obligatoire |
| Gestion locative | Catalogue/CSV/XLSX, demandes, disponibilité, visites, pièces/complétude | Pas solvabilité, notation, classement/comparaison, choix, acceptation/refus candidature, bail même brouillon |
| Rapports / supervision | Projections autorisées, occurrences/archives, alertes opérationnelles | Ne calcule pas de droits indépendants ; filtrage serveur et avant envoi |
| Passerelle IA | Catalogue, tâches typées, minimisation, routage, budgets et appels | Aucun SQL, secret, accès arbitraire réseau ni autorisation donnée par le modèle |

Contrôleurs : transport/validation. Services : invariants et autorisations. Repositories : SQL explicitement lié à une base autorisée. Adaptateurs : fournisseurs interchangeables sans transférer les règles métier dans leurs SDK. Événements versionnés, pas dépendance directe d'un module au schéma privé d'un autre. Socle toujours requis ; activation de Sinistres et Gestion locative indépendante par agence ; désactiver invalide les tâches concernées sans effacer l'historique.

Dépendances de livraison : conserver le DAG des Stories ; S01→S02→S04→S05→S06 ; S07/S08→S09 et S10→S11→S12 ; S35 tôt, S28 avant S15 ; S13→S14→S15 et S16→S17→S18 ; S22/S23 puis S19/S20/S24→S21 ; S21 avant S30–S33. S03 démarre après S02 et doit être rejouée sur toute V1. Rapports revalidés après Location. S37 conditionnelle ne bloque pas V1 saisie/import. Aucun parallélisme Execute avant gates produit PASS.

## Data model

Modèle conceptuel, **pas DDL ni contrat exécuté**. Identifiants opaques, dates UTC avec fuseau IANA agence pour calcul local ; versions monotones pour objets concurrents. Relations et contraintes indispensables en tables ; JSONB seulement pour extraction variable, payload fournisseur minimisé et snapshots de politique, avec `schema_version`, validation stricte et migrations.

| Plan | Entités / contraintes |
|---|---|
| Central contrôle | `agency`, `subscription`, `enabled_module`, `database_locator`, `secret_reference`, état provisioning/résiliation ; aucune donnée e-mail/dossier/document |
| Central identité | `user`, hash mot de passe, MFA chiffré, codes de secours non récupérables en clair, `session`, `membership`, rôle et version d'accès, invitations/récupérations ; D54 autorise ces tables explicitement |
| Agence entrée | `mailbox`, `alias`, `sync_cursor`, `message`, `message_source`, `attachment`, `contact`, `contact_email`, `conversation` ; dérivés/provenance multiboîtes séparés ; aucun original EML durable, pièces de travail temporaires hors PG |
| Agence travail | `case`, liens bien/contact/conversation, `assignment`, `claim`, `mandate_version`, `suspension`, `approval`, `action_intent`, `outbox`, `inbox_event`, `job_execution` |
| Agence métier | `property` référence unique agence, `property_link`, `claim_case` sinistre, `artisan`, spécialités/zones/justificatifs, `rental_request`, `document_requirement`, `document_check`, versions de complétude |
| Agence exploitation | `audit_event`, `business_history`, `report_occurrence`, `report_delivery`, `export_job`, `import_batch`, `import_row`, configuration IA/BYOK et ledger de réservations limité à l'agence |
| Technique plateforme | Ledger enveloppe incluse/coûts plateforme minimisé par identifiant agence sans contenu métier ; état Inngest/Redis/PG technique séparé des bases agence |

Une contrainte unique d'intention couvre `(agency, dossier, action logique, version pertinente)` ; une livraison rapport couvre occurrence et destinataire. Un événement inbox possède un identifiant fournisseur scoped agence/boîte et empreinte de vérification ; `Message-ID` seul n'est pas preuve d'unicité mondiale ni de confiance. La déduplication multiboîtes conserve les sources et ne confond pas les références de sources différentes sur identifiant forgé ; cas ambigu à revoir humainement. Pas fusion inter-agences.

Contraintes relationnelles : une attribution durable n'est pas une prise temporaire ; une validation lie acteur autorisé, action/destinataire/contenu exacts, version et usage unique. Les modifications rendent les validations antérieures obsolètes. Un document remplacé crée une version et invalide le constat de complétude, sans réécrire l'historique. L'état antivirus appartient à chaque objet/version, indépendamment de la quarantaine du message. Les binaires ne vont ni dans PG ni dans le payload Inngest.

Les index couvrent références exactes, e-mails normalisés, dates/états et files autorisées ; pagination stable bornée. La recherche de bien respecte : référence exacte, adresse normalisée + bâtiment/étage/lot, lien contact confirmé, conversation/dossier rattaché, candidats approchants. Seul résultat unique satisfaisant règles et seuil autorise un rattachement autonome ; sinon précision/humain. Les résultats IA sont des propositions typées, jamais des requêtes SQL.

## API / contracts

Endpoints **indicatifs**, à formaliser en OpenAPI en Design ; ils ne prétendent pas exister. Préfixe versionné proposé `/v1`, schémas entrée/sortie validés, pagination et limites, erreurs avec code stable et corrélation sans existence étrangère. Pas de contrat exécutable ou SDK produit ici.

| Famille indicative | Autorité / résultat |
|---|---|
| `POST /auth/login`, `/auth/mfa/verify`, `/auth/logout` ; `GET /session` | Contrat indicatif à préciser avec Keycloak central et NestJS ; accès métier seulement après MFA ; interrogation n'entretient pas l'activité |
| `POST /platform/agencies/invitations` | Propriétaire plateforme seulement ; premier admin crée lui-même ses facteurs |
| `POST /agencies/{id}/invitations`, `PATCH /members/{id}` | Admin agence ; version courante ; protection dernier admin |
| `POST /mailboxes/connections`, `/oauth/callback`, `DELETE /mailboxes/{id}/connection` | Admin et flux OAuth lié à session/agence ; suppression de connexion n'efface pas messages |
| `GET /cases`, `/conversations/{id}`, `PATCH /cases/{id}` | R01, attribution et base autorisée ; version attendue sur mutation |
| `PUT /mandate`, `POST /suspensions`, `/cases/{id}/takeover`, `/cases/{id}/release` | Droits précis ; invalidation atomique ; libération n'annule pas suspension supérieure |
| `POST /approvals/{id}/decision`, `/actions/{id}/retry` | Action attribuée, version, usage unique ; invalidée non relançable |
| `POST /imports`, `/exports` | Autorisation et limites ; `202` + référence job après acceptation durable |
| Collecte documentaire | Pièces reçues par email à l’agence ; aucun parcours dépôt/OTP/espace client V1 selon D64 ; traitement temporaire après AV |
| `GET /audit`, `/reports/{id}` ; `POST /audit/exports` | Audit admin exportable ; historique fonctionnel filtré R01 ; pas modification/suppression UI |
| `PUT /ai/config`, `/ai/byok`, `GET /ai/byok/usage` | Admin uniquement ; écriture secret à sens unique, jamais GET clé ; aucun compteur Qwen inclus agence |

Toutes les mutations utilisent protection CSRF/origine, autorisation serveur et contrôle de version ; répétitions identifiées par clé d'idempotence scoped agence+opération et empreinte du corps. Même clé avec corps différent : conflit ; ancien `If-Match` : conflit de version. Définir les codes exacts en Design ; préférer réponses indistinguables pour ressource absente/étrangère. L'acceptation asynchrone écrit l'objet, l'audit requis et l'outbox dans une même transaction agence ; erreur avant commit signifie non accepté, après commit la publication peut être répétée sans perte. L'UI suit un job autorisé, jamais une URL privée d'orchestrateur.

Contrat événement proposé : identifiant, type/version, agence opaque, référence ressource, version mandat/objet, corrélation et heure. Le worker ne fait pas confiance à ces seuls champs pour s'autoriser ; il recharge les valeurs actuelles. Aucun e-mail, pièce brute, clé ou token dans l'événement. Validation entrée et sortie IA, taille et durée bornées. Les compatibilités frontend/backend et événements/consommateurs sont testées avant builds indépendants.

## Authentication

Comptes DossierClé e-mail/mot de passe, aucune inscription libre rattachant à une agence. Propriétaire plateforme invite une agence ; premier administrateur active son identité, choisit son mot de passe, enrôle TOTP et conserve ses codes à usage unique. Les collaborateurs sont invités uniquement par l'administrateur agence. Tant que MFA non achevée, seules opérations d'enrôlement/connexion autorisées, pas accès métier. Le propriétaire ne connaît aucun mot de passe.

Keycloak est le fournisseur central d'identité et MFA retenu par D72. L'intégration avec NestJS, les versions/configurations, la frontière des données centrales et le contrat de session opaque restent à décider/qualifier en B07 ; D72 n'adopte aucun adaptateur ni protocole précis. Les exigences produit demeurent : invitation seule, accès métier après MFA, TOTP collaborateurs obligatoire, aucun remplacement par SMS/e-mail. Le parcours OTP dépôt client est retiré V1D64. Les modalités techniques de récupération doivent réaliser les garanties déjà fixées par D05. R-B07-01 concernait Better Auth 1.7.7 et son implémentation native des codes de secours : c'est un finding historique spécifique, non transposable à Keycloak et non preuve contre ce choix.

Sessions persistantes centrales, cookie opaque `Secure`, `HttpOnly`, politique `SameSite` compatible avec les flux choisis et origines explicitement autorisées ; aucun token de session en localStorage. Révocation centrale vérifiée au prochain accès métier et avant effet ; pas cookie-cache ou cache secondaire pouvant retarder le refus. Changement de rôle/désactivation invalide droits, sessions nécessaires et décisions en attente ; pas réutilisation de droits d'une ancienne requête.

**30 minutes d'inactivité réelle** : horodatage serveur d'une activité utilisateur explicite, pas prolongation par polling, websocket, refresh automatique ou heartbeat. Proposition de mécanisme : requêtes de lecture/mutation initiées par geste réel portent un signal d'activité validé/limité ; l'UI coordonne les onglets et avertit avant expiration. Ce signal ne crée pas un droit ni une garantie contre session compromise. Brouillons sauvegardés dans l'agence pendant session valide avec version ; après expiration, aucune écriture serveur non authentifiée et pas stockage local durable de pièces sensibles. Prévenir l'utilisateur si sauvegarde impossible. Durée absolue 15 jours acquise D60, même usage continu ; délai d’avertissement, politique mot de passe et seuils anti-abus restent ouverts B07. La configuration effective Keycloak/application devra respecter les deux délais sans confondre durée absolue et inactivité.

Perte de TOTP **et** codes : récupération manuelle avec vérification d'identité et accord admin agence, ou propriétaire plateforme si seul admin. Email seul insuffisant. Lien temporaire limité au réenrôlement, révocation des anciennes sessions, invalidation ancien facteur et audit des approbations/étapes. La méthode de preuve d'identité et la séparation opérationnelle des approbateurs doivent être approuvées avant ouverture. Hash mot de passe robuste selon bibliothèque qualifiée ; TOTP chiffré, clé hors DB, rotation testée ; codes de secours consommés atomiquement et non exportables.

### Acteurs humains et identités de service

Les requêtes **humaines** exigent session serveur valide et MFA achevée ; elles sont soumises à idle30, déconnexion et révocation. Les traitements **autonomes** utilisent une identité workload/service authentifiée et limitée, le mandat agence courant, l'abonnement/module/boîte autorisés et les préconditions typées de l'effet. Ils ne conservent pas artificiellement la session d'un utilisateur, n'émettent pas de polling pour la maintenir et ne réemploient pas son cookie. La déconnexion/expiration idle d'un admin ne supprime pas à elle seule le mandat agence déjà enregistré ; elle interdit les requêtes humaines de cette session. Une suspension, un retrait de droit/appartenance, une validation humaine devenue invalide ou la révocation d'une connexion restent recontrôlés par les jobs avant effet. Une validation attribuée dépend encore des droits courants de son approbateur, pas de la survie artificielle de son ancienne session ; un jeton de service ne crée aucun droit métier nouveau.

## Authorization

La [matrice R01](STORIES.md#r01--matrice-des-rôles-et-périmètre-daccès) reste normative. Admin agence gère utilisateurs, connexions, mandat, modèles/clés, export et libération de quarantaine. Habilité uniquement dans son périmètre explicite ; standard uniquement dossiers attribués, pas ceux qu'il vient d'ouvrir. Une validation exige action attribuée à un admin/habilité autorisé, pas son seul rôle. Aucune auto-attribution ni joker implicite. La suppression de la dernière administration active est refusée.

Le contexte autorisé est résolu côté serveur : identité/session/MFA et appartenance actuelle pour une requête humaine, ou identité service authentifiée et autorité agence/mandat pour un job autonome → statut agence/abonnement/module → habilitation/attribution ou portée de service effectivement autorisée → ressource dans la base choisie → politique d'action et version. Les mêmes services contrôlent API, jobs, recherches, compteurs, rapports, archives et exports, sans confondre leurs types d'acteurs. En cas de panne du contrôle central, refus fermé des accès/effets ; la réception n'est déclarée acceptée qu'après persistance sûre, sinon reprise fournisseur.

Le support plateforme n'a pas de droit métier implicite : accord explicite agence, motif, périmètre et fenêtre limités ; accès lecture **et** écriture audités avec identité support réelle et grant. Expiration/révocation s'appliquent aux jobs et URLs. Pas d'impersonation invisible. L'accès technique au provisioning ne doit pas inclure les permissions des bases métier. Urgence technique n'est pas autorisation universelle ; procédure d'incident à approuver sans contourner D28.

## Tenant isolation

Chaque agence possède une **base PostgreSQL distincte** dans la flotte Cloud SQL, avec credentials runtime dédiés et droits minimums. Ni schéma par agence ni `tenant_id` ne remplacent cette isolation. Plusieurs bases peuvent partager une instance seulement après mesure de densité/pools et preuve d'isolation en QA. Le registre central localise les bases via références opaques, sans DSN fourni par le navigateur. L'identité est centrale conformément à D54 ; D40 interdit données métier/secrets fournisseur en clair au centre, pas les tables auth explicitement autorisées.

Le routeur n'ouvre une base qu'après vérification d'appartenance ; repositories reçoivent un contexte lié à cette base, pas un nom arbitraire. Jobs portent agence opaque et utilisent une résolution autorisée ; échec de contexte interdit l'exécution. Pools `pg` bornés, cache de pools à éviction avec fermeture, plafonds par processus/instance/flotte et backpressure. Pas un pool pré-ouvert pour chaque agence inactive. Le budget global de connexions inclut API, workers, migrations, supervision et identité centrale ; les valeurs doivent être mesurées en Verify/QA avec les contraintes réseau B04, sans multiplication illimitée par autoscaling.

Migration flotte : inventaire version par agence, migration idempotente verrouillée par base, sauvegarde/restauration prouvée, canari synthétique/QA puis lot limité, pause au premier échec. Une agence partiellement migrée n'est pas déclarée active ; backend compatible avec fenêtres de versions explicites. Le rôle migration est séparé du rôle runtime et n'est pas disponible au modèle ni aux workers métier. Provisioning suit une saga persistante (invitation → base créée → schéma prêt → secrets référencés → activation confirmée), chaque étape répétable ; nettoyage destructif seulement autorisé, pas suppression aveugle d'une base partiellement créée.

Objets, liens, clés, caches, exports et audits sont cloisonnés aussi : base séparée seule ne suffit pas. Références objet non prédictibles, mapping vérifié à chaque accès. Un préfixe de bucket n'est pas une ACL. Politique IAM et capacité de révocation des URLs doivent être démontrées B04/B08.

## Async / queues / jobs

### Persistance et reprise

Inngest auto-hébergé chez Scaleway est le candidat privilégié, **pas Inngest Cloud**. Son rôle : déclenchements, attentes, retries bornés et calendrier. Les sources de vérité sont les tables métier, outbox/inbox et intentions d'effet, pas les logs d'exécution. PostgreSQL et Redis externes sont requis par la documentation de production ; leur région, sauvegarde/HA, réseau et coût sont ouverts. La rétention des logs n'est pas automatiquement purgée selon la documentation consultée : une politique explicite est indispensable.

Le producteur écrit l'outbox avec la mutation métier ; un dispatcher publie et marque la publication. Crash après publication : duplication possible, dédupliquée côté consommateur. Le consommateur écrit sa réception/exécution et vérifie état courant avant travail. Retries exponentiels avec jitter, maximums/délais par famille à fixer B06 ; erreur permanente va à la file visible. Pas d'abandon d'un message accepté. Les durées d'attente ne reposent ni sur mémoire locale ni sur requête HTTP ouverte. Le résultat du modèle est persisté/réutilisé seulement s'il reste compatible avec versions et mandat.

### Barrière des effets externes

Une annulation Inngest **n'arrête pas l'étape déjà en cours**. Appeler `cancel` ou vérifier le mandat au début du job est insuffisant. Toute sortie (mail, relance, tag, appel IA facturable, export préparé, changement fournisseur) passe par un adaptateur contrôlé ; les workers de calcul n'ont pas de credentials d'envoi directs.

Spécification de barrière à prototyper avant PASS B02 :

1. Transaction agence : réserver une `action_intent` unique avec type et portée explicites (`dossier`, `conversation`, `boîte`, `occurrence rapport` ou `agence`), ressource, empreinte du contenu/destinataire lorsqu'applicable, versions pertinentes de politique/droits/objet et jeton de fencing monotone. Le dossier n'est pas artificiellement exigé pour un export agence. Une validation humaine, si nécessaire, est liée à ces valeurs et à un usage unique.
2. Dispatcher d'effets : appliquer le socle commun et **la matrice par type ci-dessous**, jamais une précondition universelle circulaire. Recharger l'autorité actuelle, la portée, l'état de l'intention et ses versions/fence ; vérifier que l'abonnement ou le droit résiduel d'export autorise précisément ce type. Une condition requise manquante interdit cet effet. Une condition non applicable est déclarée par le type serveur, pas omise par le client/worker. L'audit préalable durable est obligatoire.
3. Sous sérialisation commune à la prise de main et aux restrictions, comparer versions/fence, consommer la réservation et enregistrer le début d'émission. Un ancien worker ou une nouvelle tentative avec un fence périmé est rejeté. L'ordre de verrouillage centre/agence et la synchronisation des révocations centrales ne peuvent reposer sur une transaction distribuée imaginaire : protocole de dispatch sérialisé à prouver sous panne réseau B02.
4. Au point d'émission réseau, conserver la protection contre l'envoi par un worker périmé : un verrou court libéré **avant** appel sans dispositif de sérialisation au dispatcher laisserait une course et n'est pas suffisant. L'implémentation doit montrer que stop/takeover et début d'appel ont un ordre linéarisé. Un fence n'a d'effet chez un fournisseur que s'il le vérifie ; ne pas prétendre que SMTP vérifie nos tokens.
5. Si l'effet a commencé avant l'arrêt, le marquer `EN_COURS_EXTERNE` ou `RESULTAT_INCONNU`, rendre ce fait visible et interdire toute deuxième émission. La prise de main suspend immédiatement le futur travail mais n'affiche pas « annulation de l'envoi garantie ». Les appels déjà remis au fournisseur ne sont pas rappelables. Une course dont le point de début ne peut être établi exige réconciliation, pas « non envoyé » présumé.
6. Enregistrer acquittement/identifiant fournisseur et état `CONFIRME`, ou échec certain, ou incertitude. Consommer/finaliser le ledger sans double comptage. En timeout/crash après requête, rechercher l'effet via API fournisseur/identifiant stable si possible. Avec SMTP sans preuve suffisante, revue humaine plutôt que renvoi automatique. Aucun exactly-once externe promis.

Un bail expiré autorise à reprendre le calcul, **pas** à recréer une intention d'envoi indéterminée. Une nouvelle prise augmente le fence ; elle n'efface pas le ledger. Les nouvelles politiques et révocations doivent atteindre le dispatcher avant la prochaine émission ; aucun cache de droits retardant un refus. Les tests de course doivent inclure arrêt juste après contrôle, juste avant réseau, worker suspendu puis réveillé, perte du verrou, réponse perdue et changement de droit central.

### Préconditions typées des effets

Le socle commun à tous les types est : identité d'acteur ou service authentifiée, agence/portée autorisée actuellement, intention unique non invalidée, version/fence courants, audit durable, confidentialité des données transmises et réconciliation de toute tentative incertaine. Les retraits d'accès et de capacité restent opposables. Le type est une enum serveur fermée ; aucune option `skipChecks` ni exception générique. « Non applicable » signifie que la ressource ou la dépense n'existe pas pour ce type, pas que la sécurité est désactivée.

| Type / portée | Conditions supplémentaires obligatoires | Préconditions non applicables ou exception strictement bornée |
|---|---|---|
| Marquage initial/actualisation **IA en cours**, conversation/dossier dans une boîte | Boîte/connecteur autorisés, prise IA actuelle non expirée, version d'état/fence courants, absence de prise humaine/suspension/résiliation ; readback de la valeur écrite et fraîcheur établis | Pas sa propre confirmation préalable : ce marquage la produit. Pas de budget IA ni destinataire e-mail. Le marquage de coordination n'est pas une réponse envoyée hors horaires |
| Marquage humain/arrêt ou correction d'état, conversation/dossier | Nouvelle autorité humaine/état de suspension enregistré, droits de la transition, version/fence courants ; écriture non contradictoire avec l'état courant, boîte encore autorisée | Possible lorsque autonomie arrêtée pour refléter cet arrêt ; ne permet jamais de remettre IA en cours. Pas confirmation IA, budget ni fenêtre d'envoi de réponse requis |
| E-mail métier autonome/relance, dossier ou conversation | Mandat/module/boîte actifs, prise IA actuelle, tag IA confirmé/frais, horaires agence, destinataire/contenu autorisés, pièces propres, limites et conditions d'arrêt, validation si action protégée | Budget IA seulement si un nouvel appel IA est nécessaire ; un e-mail déjà déterminé n'invente pas une dépense IA. Aucun contournement d'arrêt/quarantaine |
| Accusé Sinistres déterministe hors horaires, conversation/dossier | Toutes conditions de sécurité/prise/tag/mandat/boîte/arrêt/résiliation applicables à l'envoi, contenu déterministe borné et clé anti-doublon | Seule la fenêtre d'ouverture est remplacée par l'exception D46 ; aucun appel génératif ni budget IA nécessaire, aucune exception globale |
| Appel IA de traitement ou OCR, dossier/conversation/document | Mandat de traitement, module, état/prise compatibles sans main humaine contradictoire, fournisseur/capacité/privacy consentis, documents AV propres, minimisation et réservation budget | Pas confirmation préalable du tag d'un e-mail sortant, pas destinataire e-mail. Une éventuelle réponse ultérieure reste entièrement soumise à sa propre barrière ; horaires de traitement ne peuvent autoriser envoi hors fenêtre |
| Rapport, occurrence agence et livraison par destinataire | Mandat Communications actif, occurrence/date/fuseau uniques, destinataire et droits courants, contenu minimisé autorisé, boîte d'envoi autorisée ; créneaux dans les horaires d’action, fermetures manuelles et activation du binding selon D66/D67/ADR-016 | Pas de dossier ni prise/tag IA de conversation artificiels. Budget seulement si génération IA ; aucun rapport pendant fermeture et aucune exception horaire implicite ; B09 attend qualification et décision humaine, sans rouvrir D1–D3 |
| Export agence demandé par humain | Admin session valide, droit d'export actuel (abonnement actif ou fenêtre résiduelle D42), périmètre objets autorisé, contrôle de sécurité de chaque fichier dérivé CSV/JSON et de l’archive export autorisée, sans EML ni original, archive privée/temporaire et audit | Pas mandat d'autonomie, prise/tag de dossier, budget IA ni horaires d'envoi agent. Aucun droit mail/IA rétabli après résiliation ; re-MFA export non ajoutée |
| E-mail métier validé/envoyé par humain | Session/droits et attribution/action humaine courants, contenu/destinataire/version exacts, absence de sortie concurrente, boîte autorisée et pièces propres ; décision valable si action protégée | Ne dépend pas d'un tag « IA en cours » puisque responsable humain ; ne constitue pas reprise de l'autonomie ni dépassement de ses limites |

Une nouvelle famille d'effet (invitation, OTP, notification ou connecteur) exige en Design un type propre et sa matrice complète avant implémentation ; elle n'hérite pas d'un bypass « sans dossier ». Les horaires applicables aux messages système seront définis sans toucher aux décisions D45–D48.

Cas de preuve indispensables : bootstrap du premier tag puis première sortie ; concurrence ancien marquage IA/prise humaine ; callback tardif de marquage ; export agence sans dossier pendant fenêtre résiduelle ; accusé hors heures qui reste refusé sous suspension ; rapport empêché pendant fermeture ou hors horaires d’action conformément à D66/D67, sans exception implicite. Si un marquage ancien est déjà parti vers un fournisseur qui n'accepte pas nos fences, son résultat ne confirme jamais une autorisation courante : invalider cette confirmation, réconcilier vers l'état humain, garder l'autonomie bloquée jusqu'à readback courant.

### Mandat, prise et états

Sept statuts conservés exactement : `NOUVEAU`, `PRIS_EN_CHARGE_IA`, `PRIS_EN_CHARGE_HUMAIN`, `EN_ATTENTE_REPONSE_EXTERNE`, `ACTION_HUMAINE_REQUISE`, `TRAITE`, `ECHEC_A_REPRENDRE`. Tags respectifs `DossierClé/Nouveau`, `DossierClé/IA en cours`, `DossierClé/Humain en cours`, `DossierClé/En attente`, `DossierClé/Action humaine requise`, `DossierClé/Traité`, `DossierClé/Erreur`.

Prise exclusive au niveau conversation/dossier, acquise atomiquement, temporaire ; responsable, heure, état/version, prochaine action/échéance et dernière sortie visibles. À la première action autonome, confirmation du tag IA dans la boîte obligatoire ; panne ultérieure bloque également. Tag humain appliqué dans la boîte bloque avant prochaine action, auteur inconnu à confirmer dans l'application. Aucun statut lu/non lu comme vérité. La propagation fournisseur peut être retardée : test et preuve de fraîcheur/réconciliation requis avant autonomie, pas promesse de simultanéité magique.

Trois modes exacts : **L'agent fait seul**, **L'agent prépare et demande une validation**, **L'agent ne fait pas**. Nouvelle fonction désactivée. Restriction locale ne peut élargir le mandat. Autonome→préparation invalide le futur effet et crée une nouvelle validation seulement si action toujours pertinente. Ne fait pas/désactivation/suspension invalide et transfère à humain/file admin, **sans conversion automatique en brouillon ou validation**. Réactiver exige nouvelle décision sous mandat courant ; pas résurrection des tâches. Une libération humaine ne lève ni restriction admin ni suspension supérieure.

## External integrations

### Messagerie et catalogue

Gmail OAuth et Microsoft 365 OAuth **et** IMAP/SMTP sont accessibles dès pilote V1 ; agence pilote inconnue, aucun fournisseur retiré silencieusement. OAuth : état anti-CSRF lié à session/agence, consentement/scopes minimaux vérifiés, callback authentifié, renouvellement/révocation tracés sans tokens. Webhooks : vérifier authenticité, audience, anti-rejeu et liaison à la boîte ; notification n'est pas autorisation. Ingestion périodique avec curseur réconcilié couvre notifications perdues/dupliquées. Ne pas avancer le curseur durable avant stockage validé.

Réception, envoi et tags sont trois capacités séparées. Gmail libellés, M365 catégories, IMAP mots-clés ou dossiers dédiés selon preuve ; changer de dossier IMAP peut changer des identifiants, à tester. Une boîte sans marqueur fiable conserve le manuel et la réception mais pas l'autonomie externe. Connexion testée sans envoyer de vrai message. Les scopes OAuth exacts, renouvellement subscriptions, polling/IDLE et limites fournisseur restent B05. IMAP/SMTP : TLS strict, serveurs publics validés contre SSRF/DNS rebinding, pas adresses internes/métadonnées cloud ; l'acceptation d'un nom de serveur n'est pas accès réseau arbitraire.

Contact multi-adresses confirmé ; rapprochement ambigu humain via S35. Catalogue saisi ou importé CSV/XLSX avec mapping/aperçu, erreurs ligne, idempotence et absence de suppression par omission. Artisans : CSV seulement ; statut Brouillon/À vérifier/Actif/Suspendu/Archivé, pas activation automatique. Filtre artisan déterministe spécialité/zone/actif/disponibilité/urgences/justificatifs/priorité/historique ; ex aequo à fixer en Design, sinon humain. S37 : API catalogue lecture seule optionnelle, identifiants stables, pagination/quotas/reprise, activation explicite ; pas connexion à base externe ni fournisseur déjà déclaré compatible.

### IA, OCR, enveloppes et BYOK

Qwen via Scaleway est le principal par défaut ; `Qwen3.6-35B-A3B` est uniquement un candidat avancé lors du cadrage, pas une disponibilité ni un tarif vérifiés. Mistral API directe est candidat alternatif/secours. **Aucun benchmark DossierClé exécuté.** Catalogue approuvé avec version, tâches, limites, capacités texte/vision/outils/sortie structurée, région, contrat/rétention et tarifs datés. L'admin agence seul sélectionne un modèle/fournisseur et sa clé ; pas URL arbitraire, découverte de modèle incontrôlée ni fallback imposé.

Minimiser et pseudonymiser quand possible ; n'envoyer que champs utiles et fichiers propres nécessaires à la tâche, jamais base entière, secret ou données d'une autre agence. Les fournisseurs doivent démontrer traitement UE, non-réutilisation entraînement, rétention et sous-traitants avant données réelles. Prompts, OCR et mails sont non fiables ; outils IA exposent des commandes métier étroites avec arguments validés, pas réseau/SQL/shell. Toute sortie est validée, avec confiance et sources corrigeables. OCR recommandé : extraction texte PDF quand disponible, vision pour scans/photos, humain si doute ; pas preuve d'authenticité, de solvabilité ou d'un « meilleur OCR ».

| Situation | Routage autorisé et visibilité |
|---|---|
| Offre incluse disponible | Qwen par défaut ; coût/tokens/alertes budgétaires uniquement propriétaire plateforme, aucun dashboard agence |
| Enveloppe incluse exceptionnellement épuisée | Email/reception et travail manuel continuent, IA en attente, aucune perte ni surfacturation automatique ; état opérationnel sans chiffres visible |
| Complément payant | Accord commercial explicite admin, distinct d'une alerte budget Qwen ; pas de divulgation d'un compteur interdit |
| BYOK activée | Expliquer avant confirmation : fournisseur payé directement **en plus** de l'abonnement, aucune remise inventée ; admin voit consommation/coût estimés, facture fournisseur fait foi |
| BYOK budget épuisé, clé invalide/révoquée ou fournisseur indisponible | Retour Qwen inclus si accord initial explicite admin et enveloppe disponible ; pas de pause si ces conditions sont réunies |
| Secours Mistral/autre approuvé | Consentement explicite agence requis pour fournisseur et tâches ; capacités/confidentialité compatibles, jamais activation silencieuse |
| Fournisseur choisi rétabli | Vérifier clé/budget et délai de stabilité ; retour automatique pour appels futurs uniquement, pas répétition d'une requête à résultat inconnu |
| Tous chemins autorisés indisponibles | Attente IA visible ; email/manuel continuent ; recontrôle mandat, horaire, prise humaine, budget et idempotence avant reprise |

L'enveloppe incluse est mensuelle **sans cumul** ; dimensionnement après mesure tokens entrée/sortie, OCR, retries, secours, coût dossier, activité mensuelle et marge. Objectif épuisement rare, pas usage illimité ; ce modèle n'impose aucun virement mensuel réel au fournisseur.

Ledger proposé : réservation atomique avant appel selon coût maximal borné (tokens/pages/sortie), clé unique d'appel logique et version tarif ; concurrence ne peut dépenser deux fois le disponible. Finaliser à coût observé/estimé, libérer la différence, conserver la réserve si résultat inconnu jusqu'à réconciliation. Passage de mois : périodes séparées, réservation attachée à sa période d'origine, pas double crédit/report implicite. BYOK budget configurable ne plafonne que les appels DossierClé ; plafond fournisseur complémentaire conseillé, autres usages non contrôlés. Si aucun coût maximal fiable n'est estimable, bloquer cette capacité plutôt que dépasser silencieusement. Les seuils, change/devises, délai de stabilité et stratégie de synchronisation ledger central/agence sont ouverts B06, à tester sous concurrence et panne.

## Security

### Fichiers, quarantaine et dépôt

**Autorité actuelle ADR-014/015, D62–D64** : aucun original email reçu/envoyé ou pièce durable dans DossierClé. Originaux dans messagerie agence ; seulement copies temporaires privées Paris hors PG pour traitements utiles. État initial quarantaine, AV réussi avant usage métier/IA, suspect ou erreur bloque. Analyse isolée sans réseau inutile, MIME réel/signature, tailles compressées/décompressées/pages/temps/mémoire, contenus actifs et archive-bomb contrôlés. Admin seul libère message vers humain d’abord, jamais ses pièces bloquées ni IA implicite.

Limite 20 Mo par fichier, unité 20 000 000 octets ou 20 MiB ouverte B08 ; dépassement visible et pièce non analysée signalée, état/provenance minimisés conservés. Politique formats email ouverte B08 ; anciens formats du formulaire retiré ne la fixent pas. Imports CSV/XLSX restent distincts, AV/parseur isolé, macros/formules/liens externes jamais exécutés ; neutraliser injection CSV export sans altérer la donnée source.

Aucun espace client ni formulaire externe/OTP/lien 7 j de dépôt V1 ; collecte par email à l’agence. Les contrôles MFA/TOTP collaborateurs et imports internes subsistent. Consultation métier courante : dérivés, constats et provenance descriptive sans URL/deep link vers l’email ; une copie temporaire ne contourne jamais AV ou droits. Source devenue indisponible indiquée sans archive cachée.

La politique de purge reste B08 : application/objets/scanner/cache/retry/log/trace/backup/fournisseur et erreurs/états inconnus à inventorier, durée maximale à approuver. Expiration interdit exploitation d’une copie ; relecture future uniquement droit fournisseur courant, période autorisée et tâche valide, sans relance aveugle de résultat inconnu. Aucun contenu original durable via historique de messages reçus/envoyés ou payload de job.

### Menaces et contrôles à prouver

| Menace | Barrière et preuve attendue |
|---|---|
| IDOR/inter-agences, jobs ou exports falsifiés | Routeur après appartenance, credentials base dédiés, ACL objets et refus indistinguables ; matrice deux agences sur API/recherche/count/jobs/liens |
| Compte/session volés, récupération frauduleuse | MFA obligatoire, anti-abus, session serveur, idle réel, révocation, récupération double contrôle ; test ancien onglet/TOTP-code secours rejoué/support hors fenêtre |
| Export sans re-MFA | Choix explicite respecté ; session valide admin, archive limitée/audit et alertes d'opération ; risque résiduel session compromise reconnu, pas re-MFA export ajoutée |
| Phishing/usurpation/Reply-To trompeur | Identité expéditeur et destinataire recontrôlées, incohérences en quarantaine ; signaux fournisseur pas preuve d'identité certaine ; aucun reply automatique suspect |
| HTML actif/traceurs et liens SSRF | Sanitization, scripts/formulaires interdits, pas chargement distant automatique, egress filtré et DNS/IP contrôlés ; tests synthétiques |
| Pièce hostile/parser/ZIP bomb | Quarantaine par objet, antivirus fail-closed, limites de ressources et sandbox ; même erreur AV ne libère pas |
| Injection prompt via mail/OCR | Contenu traité comme données, instructions système séparées, outils whitelist, arguments/auth serveur et sorties schéma ; modèle incapable d'octroyer droits |
| Clé BYOK, endpoint ou log exfiltrant | Catalogue fermé, secrets récupérés au dernier moment, egress limité, masquage, aucun secret transmis au modèle |
| Double envoi/résultat inconnu | Outbox/inbox + intention unique, fencing/dispatch sérialisé, réconciliation ; crash/retry/cancel in-flight déterministes |
| Saturation et coût/double facturation | Quotas par agence/type, file bornée, réservation atomique, tarif versionné et replay ledger ; bornes à fixer avant pilote |
| Audit falsifié ou indisponible | Écriture append-only par rôles restreints, stockage séparé/empreintes proposé, accès audité, effet sensible bloqué sans audit préalable |
| Restauration/résiliation réactivant vieux jobs | Tombstone durable, nouvelles générations/fences, sorties désactivées par défaut, réconciliation avant reprise |

Tests d'e-mails malveillants obligatoires : phishing/usurpation et Reply-To, pièce hostile simulée, liens/SSRF, injection prompt, saturation/coût, HTML actif/traceurs. Utiliser données synthétiques et charges inoffensives, **pas malware réel** ; aucun résultat ne vaudra preuve de protection absolue. Les envois protégés ne sont jamais autorisés par un mot dans un message ou une réponse de modèle.

## Secrets

Secrets OAuth, SMTP, BYOK et credentials DB dans coffre, références uniquement en base métier/centrale. TOTP chiffré dans auth centrale avec clé hors DB est l'exception explicite D54, non une permission de stocker toutes clés en clair. Coffre par agence au sens permissions/périmètre ; configuration réelle Secret Manager, versions/rotation, récupération, audit et identité de workload à qualifier B04. Pas de credential global ouvrant toutes bases dans un worker métier. Un service de provisioning séparé a des permissions bornées et contrôlées.

Clés jamais réaffichées après saisie, jamais loguées ni exportées ni passées au modèle. Rotation conserve la disponibilité sans garder des versions accessibles indéfiniment ; révocation force les prochaines utilisations à échouer et déclenche la politique de secours consentie. QA/local/prod ont leurs propres secrets, pas copie de production. Aucun `.env` n'est lu ou créé par ce travail.

## Logging / observability

Trois plans distincts : (1) historique métier privé avec faits/résumés courts/provenance des échanges et suivi actions, sans copie intégrale reçue/envoyée ; (2) journal d'audit des acteurs, autorisations, auth/MFA/récupération, lectures/écritures support, configuration, humains/IA/envois ; (3) logs techniques et traces Inngest minimisés. Les traces d'orchestrateur ne remplacent pas l'audit. IDs opaques/corrélation, version mandat, source de décision et résultat ; pas mot de passe, clé API, TOTP, codes, document brut ou corps de mail dans logs techniques.

Audit append-only depuis S01, échec d'écriture préalable bloque action sensible ; correction par nouvel événement lié. Admin consulte/exporte audit agence sans modifier/supprimer via UI. R01 continue d'autoriser l'historique fonctionnel dans le périmètre des autres rôles ; cela ne leur donne pas l'export du journal complet. Purge réglementaire contrôlée hors UI, rétention par finalité à valider, accès exploitation restreint et audité. Un hash seul dans la même base n'est pas preuve inviolable : dépôt séparé/empreintes et contrôle d'intégrité proposés à qualifier.

Mesures : âge/profondeur files, retard ingestion/tags, échecs par connecteur, étapes incertaines, refus de fence, sessions/récupérations anormales, quarantaines/erreurs AV, pools, migrations, sauvegardes/restaurations, latences/cold start, budget et fallback. Pas d'étiquette métrique contenant une adresse e-mail ou un document. Alertes importantes UI + e-mail admin, groupées, sans pièce ni contenu sensible, lien application. Exception : alertes budget Qwen inclus et tokens/coûts réservées propriétaire plateforme ; agence voit seulement incapacité opérationnelle. Politique de fréquence/astreinte et SLA restent ouverts.

## Environments

- **Local** : Docker Compose reproductible proposé pour PostgreSQL central + bases synthétiques, stockage simulé/privé, mail sink, antivirus et Inngest/Redis si retenu ; versions fixes, données fictives. N'impose pas Compose en production.
- **Tests** : environnements jetables isolés, horloges/fournisseurs contrôlés, deux agences minimum pour sécurité ; charge conforme au PRD.
- **QA** : véritable URL, DB, objets, clés, boîtes et environnement orchestrateur distincts ; uniquement synthétique. Egress limité et destinataires contrôlés pour ne jamais contacter un vrai client. Aucun restore de production dans QA ordinaire.
- **Production** : aucune ressource créée ici. Après preuves, accord humain propriétaire et promotion du même artefact validé, uniquement ; secrets propres et accès stricts.

## CI/CD

État courant : workflow documentaire Agentic documentation / check présent et réussite historique #51, aucune CI applicative/runtime qualifiée ; pas de package produit. Ce contrôle de présence ne prouve aucun comportement logiciel. Proposition à mettre en place après gates : checks méthode/liens/secret scan, lint/types, tests unitaires/intégration/contrat, migrations dry-run, scan dépendances/images/licences, builds immuables frontend/backend, puis E2E/charge/sécurité QA selon risques. La dépendance NestJS tierce, Inngest et chaque image doivent avoir version/digest/licence tracés.

Un ticket, une branche/worktree, un auteur et revue indépendante. Le Ship documentaire utilise un commit et une PR dédiés selon COMMITS ; la fusion requiert une nouvelle instruction/validation humaine. Les vérifications locales ne valent pas revue indépendante ni CI hébergée.

## Deployment

Frontend et backend buildés/déployés indépendamment depuis monorepo, avec matrice des versions compatibles. Proposition : expansion du schéma d'abord, backend tolérant ancien/nouveau contrat, frontend ensuite, contraction seulement après preuve de non-utilisation. Événements et jobs de longue durée exigent compatibilité versionnée aussi. Migration flotte canari puis lots, arrêt si incompatibilité ; aucun « down migration » destructif automatique.

Chaîne imposée : développement → tests → QA → accord humain propriétaire → production. Promouvoir exactement les digests validés, pas rebuild avec dépendances différentes ; seules configurations/secrets d'environnement changent. Smoke tests post-déploiement synthétiques sans sortie vers clients, suivi erreurs/latence/quarantaine et invalidations. Une régression de sécurité ou de barrière arrête les effets avant diagnostic ; pas laisser des workers obsolètes tourner pendant rollback.

Rollback : identifier artefact, schéma, événements et données compatibles. Revenir au code seul ne répare ni migration irréversible ni e-mail déjà envoyé. Désactiver l'autonomie/dispatcher, conserver intentions et audit, sélectionner version compatible, restaurer en environnement isolé seulement si nécessaire, réconcilier puis autoriser reprise humaine. Si migration incompatible, roll-forward correctif ou restauration contrôlée après accord ; pas suppression de données non autorisée.

### Sauvegarde, export, résiliation et PRA

Objectifs **RPO < 4 heures, RTO < 4 heures** pour incident majeur, selon [D58](ARCHITECTURE_DECISIONS.md#d58) du 2026-10-01 ; bornes strictes, pas garanties acquises. Cloud SQL doit utiliser le PITR explicitement activé, avec restauration vers une nouvelle instance isolée ; cette capacité documentaire ne prouve ni restauration individuelle d'agence, ni durée réelle, ni remise en HA, ni cohérence avec objets/versioning, clés, central auth/registre et état orchestrateur. Sauvegardes chiffrées, accès restreint, rétention cible **30 jours sous validation technique/réglementaire**. La perte complète de `europe-west9` n'est pas couverte par la seule HA régionale et reste un risque distinct. B03 demeure ouvert.

L'invariant PRD « aucun message ou traitement accepté perdu » demeure en fonctionnement normal et dans les tests de pannes/retries ordinaires : acceptation seulement après persistance durable, conservation source fournisseur et curseur/provenance dérivés et réconciliation. D58 autorise explicitement, pour catastrophe/incident majeur seulement, une fenêtre de perte strictement inférieure à 4 heures ; ce n'est ni une perte silencieuse normale ni une permission de doublon, de rejeu ou de réactivation de droits révoqués. Reconstruire ce qui est récupérable et rendre les pertes/écarts visibles. Les actions manuelles et validations ne sont pas toutes récupérables depuis une boîte : preuve spécifique exigée. **B03** reste ouvert pour la faisabilité et la preuve de reprise cohérente, non pour un arbitrage produit zéro perte/catastrophe désormais tranché.

Mesurer le RPO entre le dernier état cohérent réellement récupérable avant l'incident et l'instant de l'incident, pour bases, fichiers et jobs ensemble ; un snapshot récent de la seule base ne suffit pas. Une sauvegarde exactement toutes les 4 heures ne démontre pas RPO < 4 heures : prévoir une marge pour durée, retard et échec et vérifier le dernier point effectivement récupérable. Mesurer le RTO depuis l'instant de l'incident (pas sa détection ni le début du restore) jusqu'au service effectivement utilisable, contrôles de cohérence et de sécurité compris ; une restauration technique terminée seule ne suffit pas.

Runbook cible : instant de l’incident et détection horodatés séparément → suspendre effets et révoquer capacités compromises → sélectionner point cohérent → restaurer central/agence/objets/orchestration en isolement → vérifier manifests/hashes, FK, comptages, générations et tombstones → invalider toutes sessions restaurées et réconcilier droits/facteurs/révocations avec les sources actuelles indépendantes du rollback → rapprocher messages et intentions avec fournisseurs → renouveler les secrets si compromis → réouvrir lecture/manuelle d'abord après nouvelle authentification → accord opérateur pour autonomie. Mesurer début/fin RTO, écart réel RPO, pertes/écarts, et répéter sur agence V1 complète, incident instance et panne région selon capacité retenue. Ne pas réutiliser les anciens jobs comme autorisations.

**Aucune autorisation restaurée n'est réputée actuelle.** Toutes les sessions issues du snapshot auth sont invalidées avant ouverture, avec génération de reprise/révocation conservée indépendamment de ce rollback. Le journal de changements d'appartenance/rôles, désactivation de comptes, récupération/réenrôlement MFA et révocation de boîtes de la fenêtre post-sauvegarde doit être réconcilié depuis une source actuelle fiable. Une réauthentification avec un ancien TOTP restauré ne suffit pas si ce facteur a été remplacé depuis : compte/facteur concerné reste fermé jusqu'à reconstitution validée, puis réenrôlement contrôlé si nécessaire. Sans source fiable pour déterminer les droits/facteurs/connexions courants, refuser les accès et effets des périmètres concernés, y compris jobs de service ; aucune réouverture permissive fondée seulement sur cohérence du snapshot. Le mécanisme indépendant et sa durabilité font partie de B03/B07. Test PRA futur : session révoquée, membership retiré, MFA récupérée et boîte révoquée **après sauvegarde**, puis restore ancien : aucun de ces accès/capacités ne ressuscite.

Export admin seulement, session valide, authentifié/audité et temporaire, **sans re-MFA spécifique export refusée**. [ADR-014](../adr/014-originaux-temporaires-export-derive.md)/D63 : CSV/JSON des dérivés détenus (dossiers/contacts/biens, faits utiles, courts résumés, synthèses, suivi/audit autorisé, provenance descriptive et relations), jamais EML ni pièces d’origine, même cachés/encodés ; aucun mot de passe/clé/MFA. L’agence exporte ses originaux depuis sa messagerie ; aucune fonction automatique d’export fournisseur inventée. Archive privée 24 h puis suppression, droit relu au téléchargement/régénération, sources inchangées. Tests futurs absence de contenu original dans tous fichiers/encodages et accès expiré ; risque session compromise résiduel reconnu.

Fin effective abonnement : couper IA et connexions mail, invalider/revoquer tâches et accès associés, conserver accès admin **limité à export 30 jours** puis supprimer données actives. Pas d'accès métier ordinaire pendant cette fenêtre. Backups expirent selon rétention sauf obligation légale ; ne pas affirmer toutes copies effacées au jour 30. Tombstones de suppression et génération de résiliation doivent survivre à une restauration et empêcher recréation/réactivation des données supprimées ; leur minimisation/rétention relève de B08. Suppression des objets/archives/liens, coffre et données techniques associées contrôlée avec rapport, sans supprimer aveuglément les preuves légalement requises.

### Horaires et rapports

Horaires agent **uniques à l'agence**, fuseau explicite ; pas planning distinct par module. Réception continue ; envois autonomes dans les horaires. Fermetures exceptionnelles saisies par admin (congés/jours fériés), communes ; aucun calendrier férié automatique. Exception Sinistres hors ouverture : accusé déterministe unique, seulement si sécurité, mandat et arrêt l'autorisent : demande reçue, examinée à la prochaine ouverture, retour dans les meilleurs délais, réception ne vaut pas début d'intervention. **Pas « demain », pas numéro d'astreinte ni consigne d'urgence ajoutée.** Il ne contourne ni quarantaine ni tags ni suspension ni résiliation.

Rapports : slots fixes **lundi–vendredi 8h45/13h30/16h00** dans fuseau agence, aucun quatrième à midi. D66/D67 et [ADR-016](../adr/016-rapports-fermetures-bindings.md) : aucun rapport en fermeture manuelle, occurrence empêchée visible sans report/rattrapage. Slots dans horaires d’action, configuration incohérente refusée et legacy incompatible empêchée. Prochaine occurrence autorisée couvre depuis le dernier rapport effectivement envoyé, weekend/fermeture inclus ; un destinataire nouveau ou réautorisé reçoit un nouveau binding qui commence à activation, sans historique ni héritage automatique ni ancien curseur. Tous dossiers ouverts restent évalués, « aucune activité » seulement si occurrence autorisée. 13h30 priorités après-midi et 16h00 bilan/restes gardent leur sens métier.

Retard strictement avant prochain slot, sinon PREVENTED_LATE ; état inconnu réconcilié avant reprise et jamais renvoi aveugle. Identité agence/binding/type-créneau/date locale, attributs de révision planning/fuseau/tzdb distincts ; occurrence et livraison par binding/destinataire, droits réduits bloquent ancien contenu plutôt que régénération silencieuse. DST/fuseau/tzdb et configurations recontrôlés. #50/#51 prouvent mécanismes locaux en mémoire ; B09 QUALIFIED_LOCALLY_PENDING_HUMAN, fermeture de ce niveau gate proposée seulement, revue et décision humaine requises. Critère Q6 crash avant réseau reste explicite : POC reprend état encore en mémoire, **pas un crash de processus** ; transactions PG, workers multiples, durabilité et transport réel requis avant production.

## Testing strategy

Les tests produit ci-dessous sont **attendus, non exécutés**. Exception de qualification locale : #50/#51,63 tests Python standard-library rejoués deux fois le 2026-10-10 ; aucun test produit Nest/React/PG ni PRA acquis. Outillage proposé, versions à qualifier B12. Les seules validations réalisées dans ce ticket sont documentaires et rapportées hors dépôt.

| Niveau | Contrôles / propriétaire |
|---|---|
| Unitaires | Équipe développement : trois modes et transitions, rôles/attributions, sélection artisan, complétude sans solvabilité, fenêtres/DST, budgets/réservations/fallback, schémas JSONB et sortie IA ; Vitest candidat |
| Intégration | Développement/QA : vrais PostgreSQL et contraintes, routage de bases, pools bornés, outbox/retries/fences, auth Keycloak/Nest à qualifier, stockage/AV/quarantaine, migrations flotte ; pas seulement mocks |
| Contrats | QA intégrations : OpenAPI producteurs/clients, événements versionnés, capacités Gmail/M365/IMAP-SMTP, authentification webhooks, fournisseurs IA texte/vision/outils, preuves réseau/coffre |
| E2E navigateur | QA : invitation→MFA→droits→idle/logout/récupération, Sinistres complet S21 avant Location S30–S33, tags/takeover, mandats, rapports, collecte email temporaire/purge, export dérivé/résiliation ; Playwright candidat |
| Sécurité | Sécurité indépendant : matrice deux agences/trois rôles, support consentement, secrets/logs, CSRF/session, liens internes/TOTP/codes secours, malware simulé, phishing/Reply-To, SSRF, prompt injection, saturation, HTML/traceurs ; zéro Critical/Major ouvert |
| Chaos/reprise | QA/exploitation : panne avant/après commit/publication/envoi, arrêt durant étape Inngest, résultats incertains, réponses juste avant relance, révocation centrale concurrente, restauration et tombstones ; pas double effet, aucune perte acceptée hors catastrophe D58 |
| Performance/coût | QA/exploitation : protocole exact ci-dessous, pools/queues/cold start, budgets simultanés, coût fixe/variable, enveloppe entrée/sortie/OCR/retry/secours et marge |
| PRA | Exploitation/QA : restauration agence complète et dépendances, mesures RPO/RTO, aucune sortie restaurée sans réconciliation ; recommencer sur modèle V1 final |

### Protocole de charge conservé

Cinq scénarios obligatoires, sessions **utilisateur authentifiées** (pas connexions DB ou boîtes) : 1 dans une agence ; 50 dans une agence ; 50 à parts égales dans 5 agences ; 200 dans une agence ; 200 à parts égales dans 10 agences.

Par agence : **200 utilisateurs authentifiables ; 5 boîtes + 5 alias ; 5 000 contacts ; 10 000 conversations ; 50 000 messages dont 10 % avec au moins une pièce référencée ; 2 000 dossiers exactement 1 000 Sinistres et 1 000 Biens ; 500 artisans**. Synthétique, graine UTF-8 `dossiercle-load-v1-20260928`. Futurs chemins `tests/performance/generate-load-fixtures` et `tests/performance/fixtures/load-v1` ; Verify enregistre commit du générateur et SHA-256 export, aucun fichier de charge créé ici.

Catalogue exact : 15 % page de 50 messages récents d'abord ; 15 % page de 50 dossiers récents d'abord ; 20 % conversation de 20 messages et métadonnées pièces ; 7 % recherche e-mail contact exact ; 7 % référence conversation exacte ; 6 % référence dossier ; 10 % transition valide ; 10 % note interne de 200 caractères ; 5 % classification asynchrone message non traité ; 5 % préparation asynchrone brouillon message classifié.

Attente déterministe 1–3 secondes entre actions dérivée de la graine ; montée linéaire **2 minutes**, maintien **10 minutes**, résorption file maximum **5 minutes**. Conserver cadence/volumes/résultats bruts. Pour chaque scénario : aucune HTTP 500 applicative, aucune perte acceptée, aucun double effet, aucune fuite inter-agences ; 95 % actions interactives ordinaires sous 2 secondes, longues tâches acceptées sous 2 secondes et suivies en arrière-plan ; échec persistant visible/récupérable. Cold start mesuré/publié séparément. k6 est une proposition, pas un changement du protocole. Aucun PASS obtenu sur charge simplifiée.

### Couverture des Stories et gates

La table détaillée [S01–S37](ARCHITECTURE_DECISIONS.md#couverture-des-37-stories) associe chaque story à une frontière, un ADR et sa preuve, sans la réécrire. G01→auth/isolation ; G02→secrets/fichiers ; G03→barrière/reprise ; G04→PRA ; G05→charge ; G06→budget/opérations ; G07→privacy/lifecycle ; G08→pilote. Toutes restent BACKLOG.

Les critères commerciaux du PRD restent intacts, avec la seule portée catastrophe D58 sur la non-perte : pilote quatre semaines, préconditions zéro fuite/perte/sortie hors mandat/relance après arrêt, restauration et cinq charges prouvées, aucun Critical/Major. Mesures de référence et seuils GO/PIVOT/KILL définis avant observation : usage deux collaborateurs trois jours/semaine chaque semaine, réduction médiane ≥25 % dans chaque workflow, ≥70 % actions routinières sans correction, ≤10 % corrections classification/rattachement, intention écrite payante pour GO. PIVOT seulement si un workflow satisfait avec préconditions ; KILL selon PRD après cycle correctif/amélioration. Architecture ne remplace pas ces preuves ni le choix de l'agence pilote.

## ADR required

Index complet et statuts dans le [registre des ADR](ARCHITECTURE_DECISIONS.md#index-des-adr). ADR-001 structure/stack ; 002 données/flotte ; 003 identité ; 004 autorisation/support ; 005 Inngest ; 006 effets ; 007 messagerie ; 008 IA/budgets ; 009 fichiers/dépôts ; 010 cycle de vie/PRA/export ; 011 temps/rapports ; 012 audit ; 013 livraison/tests ; 014 originaux temporaires/export dérivé ; 015 retrait dépôt ; 016 rapports/bindings. Toutes les décisions structurantes ont leur alternatives, conséquences, sécurité, migration/rollback et gate de preuve. Aucun `ACCEPTED` ne vaut runtime qualifié.

## Architecture Gate

### Bloqueurs bornés et preuves de sortie

Les propriétaires ci-dessous sont des **rôles à affecter**, pas des personnes prétendument engagées. Chaque ligne distingue implicitement un choix structurel à arrêter et des preuves de qualification/livraison ; les niveaux sont explicités ici pour ne pas créer un cycle « application terminée avant Architecture » :

1. **Gate Architecture** : arrêter le produit/la topologie/le coût/la politique, documenter les sources et risques, approuver l'arbitrage utilisateur, définir protocole et responsable de la preuve. Tous les choix structurants B01–B12 doivent être clos ou explicitement reclassés par décision argumentée ; pas de report silencieux vers Execute.
2. **Qualification pré-Architecture, seulement si indispensable à un choix** : mini-POC borné ou recherche technique dédiée, sous autorisation distincte, données synthétiques, environnement isolé. Le mini-POC B01-P-1 a été abandonné par décision humaine et fermé `not planned` avant exécution ; son absence est enregistrée comme risque accepté, sans devenir preuve. Les autres qualifications pré-Architecture conservent leurs propres gates.
3. **Verify/pilote/production** : suites complètes QA, cinq charges, E2E V1, restauration complète chronométrée, audit sécurité et métriques de coûts sont des preuves de livraison **futures**. Elles ne sont pas toutes exigibles avant Architecture/Design/Plan. Leur protocole doit être crédible et compatible avec les décisions avant PASS ; leur succès reste exigé au gate de mise en service correspondant.

Les preuves de la dernière colonne sont donc le plan de qualification et de livraison à répartir selon ces niveaux, pas une déclaration que tout le logiciel doit préexister à Architecture. Le blocage actuel vient des décisions et faisabilités structurantes B02–B12 encore ouvertes (licence/runtime/réseau, reprise cohérente, privacy/coût/quotas, auth et politiques), non du choix PostgreSQL désormais clos ni de l'absence normale des tests finaux. Les choix fins de Design ne doivent pas changer les invariants acquis. Dispositions et demandes concrètes dans [remediation](ARCHITECTURE_REMEDIATION.md) ; la réduction éventuelle d’un POC/Q4 ou le report de preuve nécessite argument et validation, jamais une fermeture documentaire implicite.

| ID | Décision/preuve manquante | Propriétaire / sortie attendue |
|---|---|---|
| B01 | **`CLOSED_BY_DECISION — ACCEPTED_WITH_RISK`** : Cloud SQL PostgreSQL 17 Enterprise, HA régionale `europe-west9`, PITR activé, TLS obligatoire | Choix structurel clos par #52 sans POC. Verify/QA avant Production : failover, transactions acquittées, reconnexion, PITR isolé/remise en HA, isolation par base, droits, pools/densité, migrations, coût et revue indépendante. Aucun résultat opérationnel acquis. |
| B02 | Inngest SSPL/future Apache, runtime persistant, Redis/PG, HA/rétention et barrière contre étapes in-flight | Propriétaire + conseil licence + exploitation/QA : version/licence analysées, exception PRD signée, coût/topologie, tests annulation/fence/révocation/réconciliation ; sinon ADR alternative, pas Cloud implicite |
| B03 | Preuve technique de reprise cohérente RPO < 4 heures / RTO < 4 heures (D58) | Exploitation + propriétaire : journaux/sources récupérables, restore central/agence/objets/orchestration chronométré, dernier état réellement récupérable, pertes/écarts visibles et réconciliation sans doublon ni droits ressuscités ; faisabilité et mesures encore ouvertes, arbitrage produit catastrophe acquis |
| B04 | Réseau serverless/PG/Inngest/egress, timeout/background, Secret Manager/IAM | Architecte infra/sécurité : matrice de flux Paris, preuve connectivité/identité workload/rotation, droits restreints et absence secret global worker |
| B05 | Gmail/M365/IMAP-SMTP pilotes et tags fiables, scopes/webhooks/quotas | Responsable intégrations/QA : contrat par fournisseur réception/envoi/marquage/authenticité, fraîcheur tags, auteur inconnu et panne ; autonomie bloquée par boîte non prouvée |
| B06 | Modèles/capacités/privacy IA, tarifs/enveloppe/BYOK concurrence | Responsable IA + propriétaire + privacy : catalogue/version/région/contrats, benchmark synthétique, coûts et marge, ledger atomique/fallback/retour stables ; aucun modèle candidat réputé qualifié |
| B07 | Keycloak central identité/MFA selon D72 ; intégration NestJS, session applicative opaque, configuration/version et réalisation technique de la récupération D05 à arrêter. Préserver D54/D05 : invitation seule, TOTP, secret chiffré avec clé hors DB, secours irréversibles, récupération contrôlée et révocation. `R-B07-01` reste un finding historique sur Better Auth 1.7.7 et ne se transpose pas à Keycloak ; il ne qualifie ni ne bloque ce fournisseur. | Sécurité + développement + propriétaire : décider le contrat Keycloak/NestJS et les paramètres ouverts, implémenter les garanties MFA/récupération D54/D05 sans les rouvrir ni les affaiblir. Verify/QA : versions/configuration retenues, MFA, récupération, révocation et délais d’inactivité réel (30 min) / absolu (15 j), multi-onglets sans prolongation par polling |
| B08 | Limites utilisateurs/boîtes/stockage/import/pages et unité 20 Mo ; rétention/export/privacy | Propriétaire + exploitation + privacy : quotas chiffrés, unité explicite, politique formats email et données actives/backups/tombstones, droits et sous-traitants ; contrôles ingestion email temporaire/antivirus/purge/URLs internes |
| B09 | **QUALIFIED_LOCALLY_PENDING_HUMAN — CLOSURE_PROPOSED** : D66/D67 acquis, #50/#51 fusionné, preuve locale en mémoire | Reviewer indépendant + propriétaire : revoir répartition gate locale/QA puis décision humaine ; aucun PASS automatique. Avant production : PG/transport/process crash/multi-workers/DST/tzdb et réconciliation durable. |
| B10 | Objectif disponibilité/SLA et exploitation réelle | Propriétaire + exploitation : objectif chiffré validé, seuils alertes/escalade/support et capacité humaine ; ne pas déduire SLA de RTO |
| B11 | **PASS humain documentaire — D69** : D60–D68 et impacts sur 37 stories/ADR/PRD/Architecture | Verify et revue documentaire PASS sans Critical/Major ; accord propriétaire B11 reçu le 2026-10-11. Aucun PASS historique étendu et aucune story commencée. |
| B12 CLOSED_BY_DECISION D71 — choix stack/outillage | Stack et tests/observabilité validés humainement ; POC arrêté, preuve technique partielle conservée | Développement/QA : Research/Plan des stories figent les patchs et le lock, Execute/Verify prouvent builds/tests/isolation/SBOM/promotion ; aucune dispense sécurité/livraison |

### Verdict

- [x] Contraintes, alternatives, raisons, compromis et exclusions explicités.
- [x] Frontières, données, interfaces indicatives, auth/authz, menaces et reprise décrites.
- [x] Stratégie tests/charge, environnements, promotion et rollback définis comme cibles.
- [x] ADR structurants et registre D01–D68 disponibles.
- [x] Produit PostgreSQL B01 arrêté par décision documentée avec risque accepté, sans faux PASS runtime.
- [ ] Stack et infrastructure complètement qualifiées, coûts/quotas/privacy décidés pour les autres blocs.
- [x] Revue indépendante documentaire terminée sans Critical/Major ; [preuves ARCH-B02-B12](../agentic/work/arch-b02-b12/review.md).
- [ ] Aucun blocage structurel ouvert.

**Verdict : BLOCKED.** Documentation livrable ; aucun Design System, Research story, code applicatif, déploiement, pilote réel ou promesse de production n'est autorisé par ce document.

## Sources externes datées

Vérifications documentaires communiquées au rédacteur par la recherche d'orchestration le **2026-09-30**, complétées le **2026-10-02** par l'issue [#29](https://github.com/issa-diallo/dossiercle/issues/29), pas tests DossierClé :

- [Inngest self-hosting](https://www.inngest.com/docs/self-hosting) : PG/Redis externes production, rétention des logs non automatiquement purgée ; dimensionnement/version propres à qualifier.
- [Inngest cancellation](https://www.inngest.com/docs/features/inngest-functions/cancellation) : annulation ne coupe pas l'étape en cours.
- [Licence Inngest](https://github.com/inngest/inngest/blob/main/LICENSE.md) : SSPL et transition Apache après trois ans selon texte/version ; pas avis juridique ni autorisation SaaS déduite.
- [Releases serveur Inngest](https://github.com/inngest/inngest/releases), lecture du 2026-10-02 : serveur v1.45.1 observé, distinct du SDK npm 4.21.1 ; observations, pas versions adoptées ou gelées.
- [Better Auth / NestJS](https://better-auth.com/docs/integrations/nestjs) : intégration tierce `@thallesp`.
- [Better Auth 2FA](https://better-auth.com/docs/plugins/2fa), [sessions](https://better-auth.com/docs/concepts/session-management), [Drizzle](https://better-auth.com/docs/adapters/drizzle), [dépôt/licence MIT](https://github.com/better-auth/better-auth) : primitives disponibles ; ne prouvent pas politiques DossierClé configurées.
- [Avis publiés Better Auth](https://github.com/better-auth/better-auth/security/advisories), lecture du 2026-10-02 : 37 avis publics retournés et synthétisés en F10 ; pas audit du code, pas couverture des avis privés/futurs, pas preuve de sûreté.

Le [dossier de recherche F01–F16](ARCHITECTURE_RESEARCH.md) consigne les sources primaires et leurs limites, avec les qualifications détaillées Q1–Q6 référencées par F11–F16. Constats structurants intégrés à cette conception :

- La qualification Scaleway PostgreSQL du 2026-10-02 reste une preuve historique de rejet pour B01 ; elle n'est plus la cible active. Cloud SQL PostgreSQL 17 Enterprise HA régionale `europe-west9` est adopté avec risque selon [Q1](ARCHITECTURE_Q1_B01.md), sans POC ni mesure opérationnelle.
- Serverless Containers : **egress privé seulement, pas ingress privé**. Les callbacks Inngest vers NestJS ne sont pas réputés privés ; authentification HTTPS/signature selon canonicalisation du SDK/version épinglés et anti-rejeu ou gateway/runtime alternatif à qualifier. Timeout maximum documenté 60 minutes/disque temporaire ne constituent pas exécution background durable.
- Scaleway IA : ZDR par défaut comporte une **exception de conservation des requêtes jusqu'à deux semaines** pour diagnostic/abus. Mistral : ZDR pay-as-you-go sur demande approuvée pour endpoints stateless, distinct du training opt-out. Chaque compte BYOK doit prouver région/contrat/rétention/non-entraînement ; clé valide seule insuffisante. Conservation maîtrisée ne signifie pas promesse zéro absolu inventée.
- Secret Manager : suppression planifiée de 7 jours, inaccessible mais restaurable ; révoquer auprès du fournisseur indépendamment, ne pas annoncer effacement physique immédiat.
- Gmail push : dépendance Google Cloud Pub/Sub à qualifier région/contrat/coût ; transport fournisseur, pas orchestrateur métier hors Scaleway. Alternative polling borné à comparer sans compromettre les tags. Graph catégories : PATCH avec Mail.ReadWrite, Mail.Send distinct ; préserver catégories étrangères/read-unread. IMAP : mots-clés persistants et readback/client final à prouver, SMTP séparé.
- Better Auth — notes historiques D71/F09/F10 : désactivation/trusted-device et cookie cache ne devaient pas contourner la MFA ; avis, plugins et métadonnées concernaient le candidat alors examiné. Ces constats ne qualifient pas Keycloak ; ses options, extensions et preuves d'absence de fonctionnalités hors périmètre doivent être vérifiées séparément en B07. La préservation des invariants MFA/session/révocation reste une exigence indépendante du fournisseur.

Aucun tarif, offre IA ou réseau déployé n'est certifié pour DossierClé par ces liens. Les métadonnées des versions ne prouvent pas compatibilité runtime. B01 est clos par décision avec risque accepté ; B02–B12 et l'Architecture globale restent ouverts ou `BLOCKED` selon leurs statuts.
