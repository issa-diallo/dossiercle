# Architecture — DossierClé

## Status

**ARCHITECTURE: PASS — conception N1 complète, B07 résolu par D81/ADR-029.**

Finalisation du 2026-10-11, [issue#63](https://github.com/issa-diallo/dossiercle/issues/63).
Mode LARGE, documents uniquement. Base main après#62 (`c004fc0`).
[Contrats et matrice N1/N2/N3](ARCHITECTURE_FINALIZATION.md),
[budget sourcé](ARCHITECTURE_BUDGET.md), [registre](ARCHITECTURE_DECISIONS.md).
Revue initiale [review](../agentic/work/63-finalize-architecture/review.md), puis
[revue OTP et gate courant](../agentic/work/63-finalize-architecture/otp-review.md).
Aucune installation, POC fournisseur, application, dépense, ressource ou
déploiement n’a été effectué. Le passage documentaire au Design System est
consigné dans [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) ; aucune story ne commence.

## Contexte

SaaS immobilier multi-agence : socle puis Sinistres puis Gestion locative/Location,
37 stories et DAG conservés. Aucun client : développement local synthétique,
infrastructure minimale, pas d’astreinte/SLA ni HA coûteuse imposés au poste.
Production commerciale : isolation/sécurité, absence de doubles effets/droits
révoqués, contrats et intégrations qualifiés, sauvegardes chiffrées30 j,
RPO/RTO chacun strictement<4 h à démontrer, capacité humaine compatible.

L’instruction de finalisation supersède explicitement D59 : Scaleway Paris
remplace Google Cloud SQL et le réseau inter-cloud. Docker/Compose mutualisé,
pas Kubernetes au lancement ; la plateforme gère les serveurs, jamais l’agence.
Mistral et fournisseurs mail demeurent externes, pas deuxième infrastructure PG.
Objectif 100 €/mois, plafond indicatif 150 €, pas garantie de commerce conforme.
Toute inconnue de capacité ou contrat reste une condition d’activation réelle.

## Stack decision

### Requirements

Monolithe modulaire, contrats typés, base logique distincte par agence et rôle
dédié, autorité métier PG, mandats/audit/validation et source messagerie préservés.
Pas auth maison, moteur jobs maison, périmètre artisanV2 ou classement financier.
Pas de réouverture des outils D71/D72 ni du niveau local B09 accepté.

### Options considered

| Option | Bénéfices | Coûts/limites et décision |
|---|---|---|
| Local puis Compose Scaleway Paris | Peu de composants, mutualisation, pas coût cloud sans client | VM/backup/rotation à exploiter ; retenu dans le mandat |
| Cloud SQL+Scaleway privé par VPN | HA/PITR fournisseur documentés D59 | Multi-cloud, coût/routage, supersédé par choix humain D73 |
| Kubernetes/microservices | Orchestration réplicas standardisée | Complexité/ressources sans client, exclus au lancement ; monolithe D06 inchangé |
| DB unique tenant_id/schémas | Peu de migrations/pools | Contraire D08, rejeté ; une instance mutualisée peut servir plusieurs DB |

### Selected stack

| Frontière | Choix et portée |
|---|---|
| Frontend | React 19, TypeScript 6, Vite 8 ; SPA statique React Router, aucune fonctionnalité créée |
| Backend | NestJS 12, Node.js 24, Express 5 ; monolithe modulaire, API REST/OpenAPI, événement versionné |
| DB/ORM | PostgreSQL17 managé Scaleway Paris, Drizzle+pg ; DB agence distincte, instances mutualisées ; ADR-022 |
| Identité | Keycloak central, NestJS BFF OIDC Code+PKCE et sessions opaques ; IdP conservé, TOTP chiffré privacyIDEA via provider officiel ; ADR-029 |
| Jobs | Inngest auto-hébergé Compose interne, PG technique et Redis 7 privés ; dispatcher unique fermé ADR-023 |
| Objets | Scaleway Paris privé temporaire ; bucket distinct backups/journal Multi-AZ, aucun original durable |
| Secrets | Secret Manager scoped par environnement/capacité ; clé bootstrap root protégée/rotée, aucune identité sans secret inventée |
| IA | Mistral stateless EU/ZDR ; Small 4/OCR 4.1 proposés non qualifiés ; budgets/consentements BYOK ADR-027 |
| Infra | Local synthétique puis VM Compose mutualisée, PG privé, pas Kubernetes, pas instance par agence |
| Tests/observabilité | Vitest, Playwright, k6, OpenTelemetry acquis ; preuves applicatives futures, pas CI/runtime qualifiés |

### Why this stack / Trade-offs / Rejected alternatives

Choix humains D71/D72 conservés ; infrastructure de la dernière instruction
supersède Cloud SQL. Coût initial local 0 €, simplicité et portabilité PG/containers.
Le coût commercial estimé235–305 € HT dépasse le plafond 150 €, hors exclusions ;
aucune taille machine n’est donnée comme preuve G05 ou RTO. App/PG mutualisés
impliquent budgets globaux de connexions/mémoire et exploitation plateforme.
Le natif Keycloak seul ne couvre pas D54 ; privacyIDEA conserve les secrets TOTP
chiffrés, clés hors DB, avec provider et fermetures ingress obligatoires ADR-029.
Cette dépendance supplémentaire ne remplace pas le fournisseur Keycloak.

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

[Contrat B07 détaillé](ARCHITECTURE_FINALIZATION.md#b07--contrat-identité-et-protection-totp)
et [ADR-025](../adr/025-keycloak-bff-protection-otp.md) : Keycloak reste seul
fournisseur d’identité OIDC, avec privacyIDEA pour le magasin/validateur TOTP
chiffré ; invitation/secours/récupération contrôlés.
NestJS BFF conserve les tokens, navigateur cookie opaque HttpOnly/Secure ;
CSRF/state/nonce/issuer/audience/signatures vérifiés via bibliothèques maintenues.
Session serveur30 min inactivité humaine réelle et15 j absolu, jamais entretenue
par polling/heartbeat/refresh. Révocation/générations/backchannel et audit.

**KC-OTP-01 résolu en conception par D81**, [ADR-029](../adr/029-keycloak-privacyidea-totp-chiffre.md)
et [contrat OTP sourcé](ARCHITECTURE_OTP.md) : privacyIDEA 3.14, provider 1.8.0,
clés Secret Manager/tmpfs hors PG/backups, rotation offline et reprise coordonnée.
MFA parent REQUIRED, TOTP privacyIDEA ou secours natifs ; aucun TOTP natif Keycloak ni bypass
non-enrôlé. Entrées POST OpenID dangereuses fermées à l’ingress maintenu, sans
accès direct. Compatibilité exacte 26.8/build/parcours/attaques/restauration restent N2 obligatoires,
pas preuves acquises. La revue indépendante confirme le verdict N1 PASS.

### Acteurs humains et identités de service

Les requêtes **humaines** exigent session serveur valide et MFA achevée ; elles sont soumises à idle30, déconnexion et révocation. Les traitements **autonomes** utilisent une identité workload/service authentifiée et limitée, le mandat agence courant, l'abonnement/module/boîte autorisés et les préconditions typées de l'effet. Ils ne conservent pas artificiellement la session d'un utilisateur, n'émettent pas de polling pour la maintenir et ne réemploient pas son cookie. La déconnexion/expiration idle d'un admin ne supprime pas à elle seule le mandat agence déjà enregistré ; elle interdit les requêtes humaines de cette session. Une suspension, un retrait de droit/appartenance, une validation humaine devenue invalide ou la révocation d'une connexion restent recontrôlés par les jobs avant effet. Une validation attribuée dépend encore des droits courants de son approbateur, pas de la survie artificielle de son ancienne session ; un jeton de service ne crée aucun droit métier nouveau.

## Authorization

La [matrice R01](STORIES.md#r01--matrice-des-rôles-et-périmètre-daccès) reste normative. Admin agence gère utilisateurs, connexions, mandat, modèles/clés, export et libération de quarantaine. Habilité uniquement dans son périmètre explicite ; standard uniquement dossiers attribués, pas ceux qu'il vient d'ouvrir. Une validation exige action attribuée à un admin/habilité autorisé, pas son seul rôle. Aucune auto-attribution ni joker implicite. La suppression de la dernière administration active est refusée.

Le contexte autorisé est résolu côté serveur : identité/session/MFA et appartenance actuelle pour une requête humaine, ou identité service authentifiée et autorité agence/mandat pour un job autonome → statut agence/abonnement/module → habilitation/attribution ou portée de service effectivement autorisée → ressource dans la base choisie → politique d'action et version. Les mêmes services contrôlent API, jobs, recherches, compteurs, rapports, archives et exports, sans confondre leurs types d'acteurs. En cas de panne du contrôle central, refus fermé des accès/effets ; la réception n'est déclarée acceptée qu'après persistance sûre, sinon reprise fournisseur.

Le support plateforme n'a pas de droit métier implicite : accord explicite agence, motif, périmètre et fenêtre limités ; accès lecture **et** écriture audités avec identité support réelle et grant. Expiration/révocation s'appliquent aux jobs et URLs. Pas d'impersonation invisible. L'accès technique au provisioning ne doit pas inclure les permissions des bases métier. Urgence technique n'est pas autorisation universelle ; procédure d'incident à approuver sans contourner D28.

## Tenant isolation

Chaque agence possède une **base PostgreSQL distincte** dans la flotte PostgreSQL managé Scaleway, avec credentials runtime dédiés et droits minimums. Ni schéma par agence ni `tenant_id` ne remplacent cette isolation. Plusieurs bases peuvent partager une instance seulement après mesure de densité/pools et preuve d'isolation en QA. Le registre central localise les bases via références opaques, sans DSN fourni par le navigateur. L'identité est centrale conformément à D54 ; D40 interdit données métier/secrets fournisseur en clair au centre, pas les tables auth explicitement autorisées.

Le routeur n'ouvre une base qu'après vérification d'appartenance ; repositories reçoivent un contexte lié à cette base, pas un nom arbitraire. Jobs portent agence opaque et utilisent une résolution autorisée ; échec de contexte interdit l'exécution. Pools `pg` bornés, cache de pools à éviction avec fermeture, plafonds par processus/instance/flotte et backpressure. Pas un pool pré-ouvert pour chaque agence inactive. Le budget global de connexions inclut API, workers, migrations, supervision et identité centrale ; les valeurs doivent être mesurées en Verify/QA avec les contraintes réseau B04, sans multiplication illimitée par autoscaling.

Migration flotte : inventaire version par agence, migration idempotente verrouillée par base, sauvegarde/restauration prouvée, canari synthétique/QA puis lot limité, pause au premier échec. Une agence partiellement migrée n'est pas déclarée active ; backend compatible avec fenêtres de versions explicites. Le rôle migration est séparé du rôle runtime et n'est pas disponible au modèle ni aux workers métier. Provisioning suit une saga persistante (invitation → base créée → schéma prêt → secrets référencés → activation confirmée), chaque étape répétable ; nettoyage destructif seulement autorisé, pas suppression aveugle d'une base partiellement créée.

Objets, liens, clés, caches, exports et audits sont cloisonnés aussi : base séparée seule ne suffit pas. Références objet non prédictibles, mapping vérifié à chaque accès. Un préfixe de bucket n'est pas une ACL. Politique IAM et capacité de révocation des URLs doivent être démontrées B04/B08.

## Async / queues / jobs

Autorité de topologie/protocole : [B02 finalisé](ARCHITECTURE_FINALIZATION.md#b02--protocole-retenu-des-effets-externes)
et ADR-023. OptionA retenue, aucun failover avant fencing réel ancien émetteur.
Les invariants ci-dessous restent obligatoires ; aucune preuve exécutée.


### Persistance et reprise

Inngest auto-hébergé chez Scaleway est retenu, **pas Inngest Cloud**. Son rôle : déclenchements, attentes, retries bornés et calendrier. Les sources de vérité sont les tables métier, outbox/inbox et intentions d'effet, pas les logs d'exécution. PostgreSQL et Redis externes sont requis par la documentation de production ; région Paris, réseau privé, sauvegarde et coût définis dans la finalisation ; comportement réel à qualifier N2. La rétention des logs n'est pas automatiquement purgée selon la documentation consultée : une politique explicite est indispensable.

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
| Rapport, occurrence agence et livraison par destinataire | Mandat Communications actif, occurrence/date/fuseau uniques, destinataire et droits courants, contenu minimisé autorisé, boîte d'envoi autorisée ; créneaux dans les horaires d’action, fermetures manuelles et activation du binding selon D66/D67/ADR-016 | Pas de dossier ni prise/tag IA de conversation artificiels. Budget seulement si génération IA ; aucun rapport pendant fermeture et aucune exception horaire implicite ; décisions D1–D3 acquises et qualification algorithmique locale B09 approuvée, preuves durables restant Verify/QA |
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

Contrats [B05](ARCHITECTURE_FINALIZATION.md#b05--contrats-messagerie) : Gmail
puis Microsoft365 puis IMAP/SMTP TLS, période explicite, déduplication, curseurs,
readback des tags et refus de Seen/isRead comme vérité métier. Manuel tant
que capacités d’une boîte non qualifiées, tests futurs Q3 classés N2 avant
autonomie. API catalogue S37 optionnelle conserve son gate, pas contrat logiciel
agence inventé ; CSV/XLSX catalogue et CSV artisans restent dans leurs stories.

### IA, OCR, enveloppes et BYOK

Contrat [B06](ARCHITECTURE_FINALIZATION.md#b06--ia-budgets-et-qualité) / ADR-027 :
Mistral stateless EU, ZDR organisation et non-entraînement à prouver avant réel.
Candidats Small 4/OCR 4.1 non qualifiés ; provenance, abstention et manuel obligatoires.
Budgets 5 €/agence/mois et 30 € sans client, suspension à épuisement, hausse humaine,
réservation inconnue bloquante, BYOK/secours consentis selon D16–D25 préservés.
Pas de compteur inclus interdit agence, tarifUSD pas converti fictivement en€.

## Security

### Fichiers, quarantaine et dépôt

**Autorité actuelle ADR-014/015, D62–D64** : aucun original email reçu/envoyé ou pièce durable dans DossierClé. Originaux dans messagerie agence ; seulement copies temporaires privées Paris hors PG pour traitements utiles. État initial quarantaine, AV réussi avant usage métier/IA, suspect ou erreur bloque. Analyse isolée sans réseau inutile, MIME réel/signature, tailles compressées/décompressées/pages/temps/mémoire, contenus actifs et archive-bomb contrôlés. Admin seul libère message vers humain d’abord, jamais ses pièces bloquées ni IA implicite.

Limite 20 Mo par pièce, exactement 20 000 000 octets selon D77 ; dépassement visible et pièce non analysée signalée, état/provenance minimisés conservés. Politique email D77 : PDF/JPEG/PNG automatiques, autres formats manuels, purge tous états sous 24 h ; aucune réactivation du formulaire retiré. Imports CSV/XLSX restent distincts, AV/parseur isolé, macros/formules/liens externes jamais exécutés ; neutraliser injection CSV export sans altérer la donnée source.

Aucun espace client ni formulaire externe/OTP/lien 7 j de dépôt V1 ; collecte par email à l’agence. Les contrôles MFA/TOTP collaborateurs et imports internes subsistent. Consultation métier courante : dérivés, constats et provenance descriptive sans URL/deep link vers l’email ; une copie temporaire ne contourne jamais AV ou droits. Source devenue indisponible indiquée sans archive cachée.

La politique de purge reste B08 : application/objets/scanner/cache/retry/log/trace/backup/fournisseur et erreurs/états inconnus à inventorier, durée maximale24 h fixée D77, réalisation/purge complète N2 et contrats fournisseur N3. Expiration interdit exploitation d’une copie ; relecture future uniquement droit fournisseur courant, période autorisée et tâche valide, sans relance aveugle de résultat inconnu. Aucun contenu original durable via historique de messages reçus/envoyés ou payload de job.

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

[B01/B04 finalisés](ARCHITECTURE_FINALIZATION.md#b01b04--stockage-réseau-et-secrets) :
Secret Manager Paris, projets/IAM/capacités distincts, livraison TLS dans fichiers
tmpfs0400, rotation90 j ou incident, bootstrap root protégé. Pas de secret global
worker, pas DSN client, coffre par agence et clés backups/journal séparées.

## Logging / observability

Audit métier/sécurité distinct des logs techniques et Inngest. Aucun mot de
passe, token, TOTP, code, original/prompt brut ou données inter-agences dans logs.
OTel privé et métriques simples ; purge/backup/queue/budget/auth surveillés.
Durées par classe [B08](ARCHITECTURE_FINALIZATION.md#b08--formats-limites-et-rétentions),
finalités et contrats validés avant réel ; disponibilité interne 99,5 % non SLA.

## Environments

A : local synthétique, profils Compose et ressources selon machine, aucun cloud
payant obligatoire. QA isolée par URL/DB/stockage/keys/mailboxes/orchestrateur,
fixtures et allowlists. B : commerce seulement après N2/N3 et accord propriétaire.
Pas de données/boîtes réelles dans A/QA ; aucune configuration concrète déployée.

## CI/CD

État courant : workflow documentaire Agentic documentation / check présent et réussite historique #51, aucune CI applicative/runtime qualifiée ; pas de package produit. Ce contrôle de présence ne prouve aucun comportement logiciel. Proposition à mettre en place après gates : checks méthode/liens/secret scan, lint/types, tests unitaires/intégration/contrat, migrations dry-run, scan dépendances/images/licences, builds immuables frontend/backend, puis E2E/charge/sécurité QA selon risques. La dépendance NestJS tierce, Inngest et chaque image doivent avoir version/digest/licence tracés.

Un ticket, une branche/worktree, un auteur et revue indépendante. Le Ship documentaire utilise un commit et une PR dédiés selon COMMITS ; la fusion requiert une nouvelle instruction/validation humaine. Les vérifications locales ne valent pas revue indépendante ni CI hébergée.

## Deployment

Compose sur VM Paris mutualisée, reverse proxy TLS, PG managé privé ; pas
Kubernetes ni auto-failover émetteur. Images version/digest/SBOM, secrets hors
image et configs, migrations canari/backward-compatible, même artefact QA promu.
Rollback code seul insuffisant ; arrêter effets, garder intentions/audit,
restore isolé puis réconcilier avant reprise. Aucun déploiement autorisé ici.

### Sauvegarde, export, résiliation et PRA

[Protocole B03](ARCHITECTURE_FINALIZATION.md#b03--journal-indépendant-et-reprise) :
J1 indépendant append-only Multi-AZ/ObjectLock, backups par base chiffrés horaires
et point cohérent multi-stores avec manifest/watermarks ; snapshots locaux seuls
insuffisants, aucun PITR natif Scaleway ou HA interzone promis. D59 mécanisme
CloudSQL/PITR supersédé par D73 ; D58 RPO/RTO chacun < 4 h strict maintenu.
Les preuves perte AZ, restore complet, permissions/MFA après cut et transport
inconnu sont N2 avant commerce, capacité humaine N3. Mesure depuis incident,
pas depuis détection ; fréquence de dump ne vaut pas garantie de récupérabilité.

Aucune autorisation restaurée n’est actuelle par présomption. Invalider toutes
sessions, réconcilier membres/facteurs/mandats/boîtes/suppressions post-backup
avec journal courant ; ancien TOTP/rôle/job/validation ne réautorise rien.
Absence source actuelle fiable = périmètre fermé. Propriétaire autorise
intégrité→manuel→autonomie. Fonctionnement normal sans perte silencieuse/double
 effet ; catastrophe seule perte explicite<4 h autorisée D58.

Export admin seulement, session valide, authentifié/audité et temporaire, **sans re-MFA spécifique export refusée**. [ADR-014](../adr/014-originaux-temporaires-export-derive.md)/D63 : CSV/JSON des dérivés détenus (dossiers/contacts/biens, faits utiles, courts résumés, synthèses, suivi/audit autorisé, provenance descriptive et relations), jamais EML ni pièces d’origine, même cachés/encodés ; aucun mot de passe/clé/MFA. L’agence exporte ses originaux depuis sa messagerie ; aucune fonction automatique d’export fournisseur inventée. Archive privée 24 h puis suppression, droit relu au téléchargement/régénération, sources inchangées. Tests futurs absence de contenu original dans tous fichiers/encodages et accès expiré ; risque session compromise résiduel reconnu.

Fin effective abonnement : couper IA et connexions mail, invalider/revoquer tâches et accès associés, conserver accès admin **limité à export 30 jours** puis supprimer données actives. Pas d'accès métier ordinaire pendant cette fenêtre. Backups expirent selon rétention sauf obligation légale ; ne pas affirmer toutes copies effacées au jour 30. Tombstones de suppression et génération de résiliation doivent survivre à une restauration et empêcher recréation/réactivation des données supprimées ; leur minimisation/rétention relève de B08. Suppression des objets/archives/liens, coffre et données techniques associées contrôlée avec rapport, sans supprimer aveuglément les preuves légalement requises.

### Horaires et rapports

Horaires agent **uniques à l'agence**, fuseau explicite ; pas planning distinct par module. Réception continue ; envois autonomes dans les horaires. Fermetures exceptionnelles saisies par admin (congés/jours fériés), communes ; aucun calendrier férié automatique. Exception Sinistres hors ouverture : accusé déterministe unique, seulement si sécurité, mandat et arrêt l'autorisent : demande reçue, examinée à la prochaine ouverture, retour dans les meilleurs délais, réception ne vaut pas début d'intervention. **Pas « demain », pas numéro d'astreinte ni consigne d'urgence ajoutée.** Il ne contourne ni quarantaine ni tags ni suspension ni résiliation.

Rapports : slots fixes **lundi–vendredi 8h45/13h30/16h00** dans fuseau agence, aucun quatrième à midi. D66/D67 et [ADR-016](../adr/016-rapports-fermetures-bindings.md) : aucun rapport en fermeture manuelle, occurrence empêchée visible sans report/rattrapage. Slots dans horaires d’action, configuration incohérente refusée et legacy incompatible empêchée. Prochaine occurrence autorisée couvre depuis le dernier rapport effectivement envoyé, weekend/fermeture inclus ; un destinataire nouveau ou réautorisé reçoit un nouveau binding qui commence à activation, sans historique ni héritage automatique ni ancien curseur. Tous dossiers ouverts restent évalués, « aucune activité » seulement si occurrence autorisée. 13h30 priorités après-midi et 16h00 bilan/restes gardent leur sens métier.

Retard strictement avant prochain slot, sinon PREVENTED_LATE ; état inconnu réconcilié avant reprise et jamais renvoi aveugle. Identité agence/binding/type-créneau/date locale, attributs de révision planning/fuseau/tzdb distincts ; occurrence et livraison par binding/destinataire, droits réduits bloquent ancien contenu plutôt que régénération silencieuse. DST/fuseau/tzdb et configurations recontrôlés. #50/#51 prouvent les mécanismes locaux en mémoire ; leur niveau de qualification algorithmique est approuvé pour le gate Architecture par décision humaine B09. Le POC reprend état encore en mémoire, **pas un crash de processus** ; transactions PG, workers multiples, durabilité et transport réel restent requis en Verify/QA avant mise en service.

## Testing strategy

Les tests produit ci-dessous sont **attendus, non exécutés**. Exception de qualification locale : #50/#51,63 tests Python standard-library rejoués deux fois le 2026-10-10 ; aucun test produit Nest/React/PG ni PRA acquis. Outillage acquis D71/D72, versions exactes/locks et compatibilité réelle N2. Les seules validations réalisées dans ce ticket sont documentaires et consignées dans docs/agentic/work/63-finalize-architecture/verify.md.

| Niveau | Contrôles / propriétaire |
|---|---|
| Unitaires | Équipe développement : trois modes et transitions, rôles/attributions, sélection artisan, complétude sans solvabilité, fenêtres/DST, budgets/réservations/fallback, schémas JSONB et sortie IA ; Vitest acquis D71, exécution future |
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

Attente déterministe 1–3 secondes entre actions dérivée de la graine ; montée linéaire **2 minutes**, maintien **10 minutes**, résorption file maximum **5 minutes**. Conserver cadence/volumes/résultats bruts. Pour chaque scénario : aucune HTTP 500 applicative, aucune perte acceptée, aucun double effet, aucune fuite inter-agences ; 95 % actions interactives ordinaires sous 2 secondes, longues tâches acceptées sous 2 secondes et suivies en arrière-plan ; échec persistant visible/récupérable. Cold start mesuré/publié séparément. k6 est acquis D71, pas un changement du protocole. Aucun PASS obtenu sur charge simplifiée.

### Couverture des Stories et gates

La table détaillée [S01–S37](ARCHITECTURE_DECISIONS.md#couverture-des-37-stories) associe chaque story à une frontière, un ADR et sa preuve, sans la réécrire. G01→auth/isolation ; G02→secrets/fichiers ; G03→barrière/reprise ; G04→PRA ; G05→charge ; G06→budget/opérations ; G07→privacy/lifecycle ; G08→pilote. Toutes restent BACKLOG.

Les critères commerciaux du PRD restent intacts, avec la seule portée catastrophe D58 sur la non-perte : pilote quatre semaines, préconditions zéro fuite/perte/sortie hors mandat/relance après arrêt, restauration et cinq charges prouvées, aucun Critical/Major. Mesures de référence et seuils GO/PIVOT/KILL définis avant observation : usage deux collaborateurs trois jours/semaine chaque semaine, réduction médiane ≥25 % dans chaque workflow, ≥70 % actions routinières sans correction, ≤10 % corrections classification/rattachement, intention écrite payante pour GO. PIVOT seulement si un workflow satisfait avec préconditions ; KILL selon PRD après cycle correctif/amélioration. Architecture ne remplace pas ces preuves ni le choix de l'agence pilote.

## ADR required

ADR-001–021 historiques applicables selon leurs supersessions ; ADR-022–029
portent la finalisation et la résolution OTP. [Index/décisions D73–D82](ARCHITECTURE_DECISIONS.md#finalisation-architecture--2026-10-11--issue-63).
Les décisions acquises n’attribuent aucun test PASS. Q1–Q6 restent byte-for-byte
historiques, [remediation](ARCHITECTURE_REMEDIATION.md) signale leur autorité datée.

## Architecture Gate

[Matrice complète B01–B12/N1–N3](ARCHITECTURE_FINALIZATION.md#matrice-b01b12-et-preuve-de-sortie).
Les décisions infrastructure/reprise/budgets/exploitation sont désormais définies.
B05-P1/B06-P1 reclassés explicitement N2 pour activation qualifiée par D82 ;
leurs plafonds et scénarios sont définis, jamais présentés comme exécutés.
B09 local HUMAN_APPROVED, B11 documentaire humain et
B12 choix stack restent acquis. Les conditions commerciales N3 ne bloquent pas
la conception locale mais bloquent données réelles/vente tant que non satisfaites.

La résolution de KC-OTP-01 est concrète dans D81/ADR-029 et ses sources N1,
sans report de la contradiction native au seul Verify. Les vérifications
futures qualifient la réalisation de cette nouvelle conception et ses barrières.

Verdict : **ARCHITECTURE PASS**, après [revue indépendante](../agentic/work/63-finalize-architecture/otp-review.md)
sans Critical/Major. B01–B12 satisfont leurs sorties N1 documentées ; les preuves
N2/N3 restent obligatoires. La phase produit suivante est Design System ; son
gate Architecture est levé. Aucune story Execute ni ouverture commerciale
n’est autorisée par ce seul PASS.
