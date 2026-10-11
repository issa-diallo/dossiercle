# Finalisation Architecture — V1 sans client et ouverture commerciale

Date : 2026-10-11. Issue [#63](https://github.com/issa-diallo/dossiercle/issues/63).
Mode LARGE pour les risques ; infrastructure proportionnée à l’usage.
Autorité : instruction utilisateur « CODEX — Finaliser Architecture DossierClé »,
consignée dans [les décisions humaines](../agentic/work/63-finalize-architecture/evidence/human-decisions.md).

**Architecture : BLOCKED. Un blocage critique N1 : B07 / chiffrement TOTP D54.**
Les décisions restantes ont une sortie de conception définie ; les preuves
N2/N3 ne sont pas déclarées obtenues. Aucun POC, installation, application,
compte fournisseur, ressource cloud, dépense, déploiement ou Design System.

## Trois niveaux de preuve

- **N1 Architecture** : choix, capacité documentaire, contrat et modèle de
  sécurité indispensables pour concevoir. Une contradiction connue reste
  bloquante même avec un futur test prévu.
- **N2 Verify/QA** : implémentation, compatibilité réelle, intégration,
  isolation, concurrence, charge, qualité IA, restauration et mesures.
- **N3 Production** : contrats/configurations de comptes, coûts observés,
  exploitation et disponibilité, autorisation d’ouverture commerciale.

L’autorisation de poursuivre la conception n’autorise ni Execute d’une story
sans ses gates, ni données réelles, ni commercialisation. Les cinq scénarios
G05, les gates G01–G08, les 37 stories et leurs dépendances restent inchangés.

## Environnements et topologie

| Environnement | Architecture | Conditions |
|---|---|---|
| A — sans client | Développement local Docker/Compose, PostgreSQL17 local, Keycloak, Inngest, Redis externe au processus Inngest et services locaux ; données synthétiques ; réseau sortant de test fermé sauf autorisation ultérieure | 0 € cloud, aucun dimensionnement de production imposé au poste. Services démarrables par profils et quotas locaux. Aucune image installée par cette mission. |
| A — hébergement synthétique optionnel | Une VM Scaleway Paris mutualisée, DB managée standalone, mêmes frontières logiques ; pas Kubernetes ni HA coûteuse | Devis et autorisation futurs ; aucun achat. Capacité proposée non qualifiée, pas de service client. |
| B — commerce | Conteneurs mutualisés sur VM Paris, PG17 managé avec option HA, Private Network, Object Storage privé Multi-AZ, Secret Manager ; réseau et contrôle d’accès distincts | Qualification N2/N3 obligatoire ; réplica chaud applicatif non exigé par principe, reprise fermée vers hôte neuf selon test RTO. Si la qualification impose plus de ressources, redimensionner avant ouverture. |

Mistral reste un fournisseur externe IA. Gmail et Microsoft sont des
fournisseurs de messagerie externes ; « un fournisseur d’infrastructure »
ne signifie pas supprimer ces intégrations. Gmail est initialement interrogé
par polling incrémental borné, pour éviter une dépendance Pub/Sub
supplémentaire ; watch/push n’est pas nécessaire à la première intégration.
Microsoft Graph utilise notifications authentifiées et delta de réconciliation.
Les cadences/fraîcheurs effectives sont qualifiées N2, jamais garanties ici.

Frontière d’exécution : reverse proxy TLS seul ingress applicatif public,
NestJS API/BFF, worker sans credentials mail, dispatcher d’effets unique,
Keycloak central, Inngest privé et Redis privé. DB séparées pour contrôle,
identité Keycloak, état Inngest et chaque agence, utilisateurs distincts sur
une instance mutualisée. Jamais instance serveur par agence ni droits
multi-agences attribués au rôle runtime d’une agence. Pools bornés globalement,
ouverture à la demande, LRU/éviction et backpressure ; budget connexions figé
après contrôle `max_connections`, migrations et charge N2.

## B01/B04 — stockage, réseau et secrets

Scaleway Managed PostgreSQL17 Paris est retenu par préférence humaine à la
place de Cloud SQL D59. Le fournisseur documente plusieurs bases par instance,
permissions par base et endpoint uniquement privé après suppression du public.
TLS avec vérification certificat/nom ; rôle propriétaire/migration séparé du
runtime, retrait CONNECT/PUBLIC et privilèges par défaut sur les futurs objets.
Aucun endpoint PG/Redis/Inngest/admin Keycloak public en production.

La version/SKU disponible est contrôlée avant provisionnement. PG17 est
annoncé ; compatibilité Drizzle/pg, migrations et comportement serveur restent
N2. L’HA documentée est primaire/standby synchrone ; **aucune garantie multi-AZ
n’est déduite du libellé HA**. Snapshots locaux ne sont pas des copies hors
zone. **PITR natif non établi** : ne pas confondre restauration snapshot avec
rejeu WAL jusqu’à timestamp arbitraire. D59 est supersédé sur fournisseur,
configuration HA Cloud SQL et mécanisme PITR ; D58 et les garanties production
restent intactes, avec protocole alternatif ci-dessous, pas de faux équivalent.

Secret Manager Scaleway Paris est choisi comme coffre à provisionner plus tard,
aucun coffre existant présumé. Projets/IAM/boîtes/DB/secrets distincts entre
local, QA et commerce. Secret par agence/capacité, retrieval TLS dans fichiers
tmpfs root/service 0400 montés en lecture seule ; jamais Compose/Git/image,
variables exposées par diagnostic, logs ou exports. Chaque service reçoit
uniquement ses secrets. Worker sans clé mail/secret global.

Bootstrap : une clé IAM de lecture scoped par hôte, stockée dans fichier root
0400, rotation au plus tous les 90 jours et immédiate en incident. Cette clé
statique est une concession documentée, pas une identité workload sans secret.
Rotation à deux versions : nouveaux secrets distribués, contrôle des instances,
révocation ancien secret ; pour credentials mail/effets, autonomie suspendue
pendant l’opération, pas période où ancien dispatcher peut envoyer. Propriétaire
responsable de rotation/restauration ; clés de déchiffrement distinctes des
backups, rôle restauration sans permission de rembobiner le journal.

## B02 — protocole retenu des effets externes

Inngest auto-hébergé Compose est un orchestrateur **interne**, pas une API de
workflows proposée aux agences. PG technique externe au processus, Redis 7
externe au processus avec persistance AOF, volumes privés ; SQLite et Redis
mémoire intégrés sont limités aux tests locaux jetables. Versions exactes,
digests et SBOM à geler dans Research/Plan, pas `latest` au déploiement.

Adopter l’option A du protocole antérieur : dispatcher privilégié unique,
sérialisation par agence des admissions et restrictions, ordre déterministe
central puis agence ; worker ne peut joindre les fournisseurs d’effet.
1. Transaction métier : mutation + audit + outbox ; inbox dédupliquée et
   intention unique par action/version ; aucun contenu brut dans Inngest.
2. Dispatcher recharge droits, mandat, attribution, versions, tag frais,
   horaires et validation à usage unique selon la matrice typée Architecture.
3. Enregistrement admission puis début réseau distincts ; sérialisation gardée
   jusqu’au début réel de l’appel. Restriction demandée bloque les nouvelles
   admissions ; elle n’est affichée APPLIED qu’après passage de la barrière et
   convergence des stores. L’UI ne promet jamais rappeler un effet déjà parti.
4. CONFIRME, échec certain ou RESULTAT_INCONNU ; résultat ambigu suspendu sans
   retry d’effet jusqu’à réconciliation fournisseur/humaine. Pas exactly-once SMTP.
5. Pas de failover automatique par expiration de bail. Avant tout nouvel
   émetteur, arrêt vérifié de l’ancien hôte/egress et révocation des anciennes
   capacités, puis inventaire des effets en vol. Sans preuve, émission fermée.

Révocations et restrictions passent par ce coordinateur avant acquittement
positif ; panne de lien/store, perte de lock ou audit absent ferme l’effet.
Les scopes sans dossier (rapport/export agence) gardent leurs préconditions
propres. Tests N2 indispensables : pause avant réseau, perte lock PG, partition,
ancien processus réveillé, takeover concurrent, restriction centrale, callback
retardé, réponse fournisseur perdue et crash entre commits. Une simple
condition SQL ne prouve pas ce protocole exécuté.

Licence : SSPL clause13 pour le serveur selon version, SDK distinct ; publier
les modifications seules ne suffit pas si la fonctionnalité est fournie comme
service. Usage retenu : workflows immobiliers, moteur interne privé, aucun
hébergement de workflows génériques client. L’absence d’exposition du dashboard
n’est pas une exemption juridique prouvée. Qualification écrite de l’usage/version
et, si nécessaire, accord/licence commerciale **avant vente** ; coût inconnu,
jamais 0 € commercial garanti. Une incompatibilité confirmée impose nouvel ADR,
pas changement implicite de moteur. Licence Apache future par ancienneté du code
ne rend pas les versions récentes automatiquement Apache.

## B03 — journal indépendant et reprise

Adopter J1 : événements minimaux de refus/epochs/révocations/tombstones dans
bucket Object Storage Multi-AZ Paris distinct des données/exports, versionné,
Object Lock COMPLIANCE et IAM append-only. Pas secret/facteur/contenu métier.
Chaque commande porte identifiant unique, agence/utilisateur opaque, portée,
génération, séquence et empreinte. Journal durable avant acquittement de refus ;
mutation central/agence idempotente ensuite. Refus valable si seconde écriture
échoue ; octroi non actif avant convergence. Réutilisation d’une même séquence
avec empreinte différente = incident fermé ; permissions API/S3 exactes N2.

Les mutations Keycloak administratives/récupération/réenrôlement passent par le
coordinateur : refus/epoch PENDING durable avant opération Keycloak, aucun accès
métier tant que résultat et génération non confirmés. Account console autonome
et voies de suppression/remplacement MFA hors procédure désactivées ; enrollment
initial donne accès seulement après confirmation courante, callbacks vérifiés.
Une opération IdP extérieure non réconciliée ou un résultat ambigu ferme le compte.
Après restore, un ancien TOTP ne rétablit pas le droit métier si epoch inconnue ;
identité vérifiée et réenrôlement contrôlé, pas confiance au seul login natif.
Le contrat exact du coordinateur/événements et ses crash-points sont N2, aucune
extension existante ou garantie atomique PG+IdP+S3 n’est présumée.

Le runner de sauvegarde n’a pas les droits d’effacer le journal. Son restore
ne l’inclut pas. Rejeu du journal courant requis après rollback, journal
indisponible = pas d’accès/effet. Retention minimale couvrant tous les backups
restaurables, hypothèse 35 jours pour backups 30 j ; aucune suppression des
marqueurs encore nécessaires à empêcher une résurrection. Actualiser l’horizon
si archivage exceptionnel autorisé. Même fournisseur n’apporte pas indépendance
régionale : panne complète Paris reste risque distinct, extension/réplication
régionale à décider si le périmètre commercial la requiert.

**Stratégie de sauvegarde alternative au PITR :** runner dédié horaire,
`pg_dump` cohérent par base avec rôle lecture/sauvegarde, chiffrement côté client
avant stockage Multi-AZ ; clés séparées. Jeux complets central/agences/Keycloak/
PG Inngest, schemas/versions, séquences journal et intentions/manifests.
Dumps multibases non atomiques : barrières par agence, commandes/révocations
journalisées avant acquittement, watermarks causaux et réconciliation ; les
liens impossibles à reconstruire restent fermés. Des snapshots locaux peuvent
accélérer la reprise, mais ne sont pas la protection catastrophe seule.
Backups logiques natifs fournisseur non démontrés chiffrés : ne pas les activer
sur données réelles sans traitement approuvé ; snapshots LUKS et exports chiffrés
seulement selon capacités contrôlées. Aucun original temporaire dans backups.

Hypothèse réversible : horaire sur48 h + quotidien 30 j, avec manifeste signé/hashé
et contrôle d’âge du **jeu complet réellement récupérable** ; alerte à90 min,
suspension des nouvelles acceptations si point récupérable >2 h jusqu’à correction.
Ce garde-fou ne transforme pas une fréquence en garantie ; acquisition, transfert,
retard et pertes doivent être mesurés. Déduplication/archive incrémentale à
qualifier avant de réduire artificiellement l’occupation budgétée.

Test N2 pré-commercial : perte hôte et perte AZ, restauration sur hôte et DB
neufs hors zone défaillante, contrôle des droits/secrets après backup, journal
post-cut, invalidation des sessions, disparition des anciennes validations,
effets inconnus sans renvoi, inventaire des pertes et reprise des timers depuis
PG autoritaire, jamais Redis seul. RPO = incident − dernier point complet
récupérable, **<4 h** ; RTO = incident → service utilisable avec contrôles et
réconciliation, **<4 h**. Propriétaire autorise intégrité → manuel → autonomie.
Aucune durée mesurée ; sans capacité humaine/technique conforme, commerce fermé.

## B05 — contrats messagerie

Trois connecteurs conservés : Gmail/Workspace → Microsoft365 → IMAP/SMTP TLS.
Aucun profil IMAP ou pilote inventé. Gmail : OAuth least privilege, période
explicite sans défaut, historyId/404 et polling incrémental borné, labels/readback.
Microsoft : OAuth permissions/scopes exacts par type de boîte, notification
clientState/anti-rejeu et delta, PATCH préservant catégories étrangères/isRead.
IMAP : TLS certificat vérifié, UIDVALIDITY, PERMANENTFLAGS, keywords/client réel,
SMTP distinct ; pas de repli vers protocole non chiffré.

Contrat commun : sources alias/boîte distinctes, déduplication, période bornée,
curseur durable, quotas/backoff, permissions révoquées, identité auteur incertaine
bloquante, aucun Seen/isRead comme vérité métier, bootstrap tag avant première
sortie, confirmation fraîche et réconciliation. Readback impossible = manuel,
jamais autonomie par simple choix fournisseur. Onboarding OAuth/scopes/revue
fournisseur et habilitations boîtes sont N3 avant données réelles.

Q3 B05-P1 est **reclassé explicitement N2**, parce que les interfaces/capacités
sont décrites mais la qualification est par boîte réelle : aucun connecteur
natif n’est tenu pour universellement qualifié ; architecture impose manuel
et interdit activation autonome sans suite complète. Tests synthétiques futurs
restent indispensables, sur chaque famille supportée. Pas de report d’un
contrat inconnu en prétendue capacité acquise.

## B06 — IA, budgets et qualité

Proposition réversible, non qualifiée : Mistral Small 4 pour classification,
extraction JSON et rédaction bornée ; OCR 4.1 seulement après extraction locale
PDF insuffisante, AV propre et budget réservé. Grandes tâches dépassant budget
ou route disponible : humain, pas promotion automatique vers modèle plus cher.
Identifiants modèle/version/endpoints figés et leur disponibilité vérifiée en
Research de story avant implémentation ; aucun alias mutable accepté en commerce.

Endpoint EU régional, flux chat/OCR stateless uniquement ; ni Files, Agents,
Batch, Conversations ni stockage fournisseur implicite. ZDR org payante approuvée,
training opt-out distinct et région/flux/DPA/sous-traitants vérifiés N3 avant
contenu réel. UE/EFTA fournisseur n’est pas une promesse France exclusive ;
control-plane metadata et transferts évalués, pas conformité déduite du seul host.

5 €/agence/mois inclus et 30 €/mois plateforme sans client, indicatifs devenant
plafonds de traitement concernés : réservation atomique coût maximal + retries,
charge inconnue reste réservée, dépassement/refus suspend nouveaux appels.
Augmentation par décision humaine auditée uniquement. Mois agence et reset
selon contrat D16/D17 préservés ; pas affichage d’un compteur inclus interdit.
BYOK garde ses règles et facture fournisseur, budget configuré admin et consentement
de secours ; clé valide seule ne prouve ni privacy ni modèle compatible.

Qualité par tâche : schéma valide 100 %, zéro fait essentiel faux/non sourcé,
provenance document/page exacte et 100 % des champs essentiels contradictoires/
manquants signalés ; zéro instruction issue du contenu exécutée. Score du
modèle non fiable seul : auto-classification uniquement si règles vérifiables,
aucune ambiguïté essentielle et seuil calibré sur gold set ; sinon humain.
Rédaction n’autorise jamais engagement ni décision locative interdite.

B06-P1 Q3 pré-D72 est reclassé N2 **pour qualifier route et activer son usage**,
pas pour prouver le choix humain du fournisseur. Proposition Small 4/OCR 4.1 ne
vaut pas sélection commerciale démontrée ; benchmark synthétique future
implémentation, seuils figés avant essai. Aucun appel/benchmark autorisé ici.

## B07 — contrat identité et seul blocage N1

Keycloak reste choisi. BFF NestJS OIDC Authorization Code + PKCE S256,
state/nonce serveur usage unique, redirect URI exactes, TLS, client confidentiel,
issuer/audience/signature vérifiés par bibliothèque maintenue ; tokens conservés
serveur, jamais localStorage. Navigateur cookie opaque aléatoire HttpOnly Secure,
SameSite compatible callback ; CSRF/origine sur mutations. Hash identifiant
session dans store serveur ; aucun moteur password/TOTP maison.

Un realm plateforme central, invitation seulement, auto-inscription désactivée ;
MFA TOTP requis avant accès métier et enrollment authentifié. Recovery codes
natifs à usage unique/hashés, à vérifier sous concurrence N2. Keycloak ne décide
pas R01 : membership/roles/attributions actuels NestJS avant accès agence/effet.
Inactivité réelle serveur30 min et absolu15 j (D60) ; polling/refresh/heartbeat
n’entretiennent pas last-human-activity. Avertissement UI2 min avant inactivité,
réauthentification obligatoire après expiration ; coordination multi-onglets N2.

Logout/révocation backchannel signée+anti-rejeu et génération centrale ; panne
centrale = fermé. Actions sensibles sans audit refusées. Récupération totale :
propriétaire vérifie identité par canal indépendant préenregistré et preuves
minimisées ; accord admin agence si disponible, propriétaire si dernier admin.
Pas e-mail seul ; révoquer sessions/facteurs/validations, lien à usage unique10 min
pour réenrôlement, audit sans pièces d’identité brutes ; aucun contournement MFA.
Paramètres de départ réversibles à qualifier N2 : access token5 min,
code callback60s/lien enrollment10 min usage unique ; SSO idle30 min/max15 j,
remember-me/direct grants désactivés ; app impose son propre idle humain.
Anti-bruteforce natif activé,5 échecs puis délai temporaire progressif plafonné15 min,
pas lock permanent automatique ; password policy12 caractères et contrôle fuite
selon capacités natives validées. TLS/proxy trusted/origines explicitement bornés,
console admin privée, aucun default wildcard ou flow alternatif contournant TOTP.
Dernier admin : suppression rétrogradation refusée, procédure et canal de
récupération enregistrés avant activation ; test de récupération avant commerce.

**KC-OTP-01 — critique :** source Keycloak 26.8.0 sérialise le secret TOTP en
JSON puis persiste secretData sans chiffrement applicatif. Vault natif couvre
SMTP/LDAP/IdP, pas TOTP ; chiffrement disque/dump ne satisfait pas D54.
Ni une future QA ni la validation du fournisseur Keycloak ne corrigent ce défaut.
**Recommandation unique :** identifier et retenir une solution maintenue et
supportée de chiffrement des credentials Keycloak, clé hors DB, avec rotation,
restauration et compatibilité documentées, sans construire d’authentification
maison. Aucun composant concret compatible n’est établi dans cette mission.
B07 reste BLOCKED N1 jusqu’à preuve documentaire de cette solution et revue.

## B08 — formats, limites et rétentions

20000000 octets par pièce ; formats email automatiques PDF/JPEG/PNG seulement.
MIME/sniffing, antivirus/quarantaine, archives/chiffrés/contenu actif refusés
au traitement automatique ; source reste messagerie pour traitement humain.
CSV/XLSX des imports catalogue/artisans existants restent autorisés selon
leurs contrats ; cette allowlist email ne supprime pas S23/S29.

Originaux temporaires privés purgés à fin traitement ou au plus tard24 h,
erreurs/quarantaine comprises. Pas logs, retry payload, cache persistant,
backup ou Object Lock d’originaux. Bucket temporaire non versionné séparé,
TTL applicatif cible 23 h, purge supervisée15 min et lifecycle de secours non
considéré comme garantie24 h. Dépassement = incident privacy, traitement suspendu.

| Classe | Durée / autorité | Preuve |
|---|---|---|
| Original temporaire | Fin traitement, plafond 24 h utilisateur ; source agence inchangée | N2 purge tous états et chemins |
| Faits/suivi métier | Hypothèse3 ans après clôture, revue juridique/contractuelle avant données réelles ; suppression/résiliation D42 prime sauf obligation justifiée | N3 finalités/contrats, N2 purge/export |
| Audit sécurité/métier | Hypothèse12mois minimisés, à distinguer du suivi dossier ; obligations/accès à valider | N3, pas durée légale affirmée |
| Logs techniques / sécurité | Hypothèses30 j /180 j, sans contenu original ni secret ; réduction selon finalités | N2 redaction, N3 validation |
| Historique Inngest | Hypothèse7 j pour références/états techniques, purge explicite ; autorité métier ailleurs | N2 purge PG/Redis |
| Sauvegardes chiffrées | 30 j D41 ; horaires 48 h et quotidien 30 j, sans originaux ; horizon journal au moins supérieur | N2 restore/purge, N3 contrats |
| Export dérivé | Privé24 h D42/D63, CSV/JSON seulement, aucun original/MFA/secret | N2 téléchargement autorisé/purge |

3 comptes et2 boîtes inclus selon D61. Limites techniques initiales réversibles :
PDF 50 pages, extraction60s, un appel IA concurrent/agence et2 plateforme ;
dépassement entièrement visible vers humain, aucune troncature silencieuse.
Les3 comptes/2 boîtes inclus ne sont pas des maxima techniques. La question PRD
des maxima commerciaux par offre (comptes/boîtes/stockage) est explicitement
reclassée N3 avant définition de l’offre/clients : aucun maximum commercial
ni supplément n’est promis. Hardlimits techniques stockage/pools/OCR sont
arrêtés en Plan et qualifiés N2 selon budget/G05, sans confondre les deux gates.
Aucun nouveau plafond commercial silencieux. Formulaires/signature/bail,
solvabilité/classement financier et portail artisan V2 restent exclus.

## B10 — exploitation et conditions commerciales

Objectif interne 99,5 %, sans SLA client. Propriétaire responsable, heures ouvrées
et support externe 0 € ; pas astreinte existante ni serveur allumé nécessaire
sans client. Alertes simples : disponibilité, erreur/auth/quarantaine, queue,
âge backup, purge et budget ; OpenTelemetry métadonnées minimisées, audit distinct.

Avant commerce : responsable/canal/escalade et capacité de reprise compatibles
avec RTO < 4 h depuis incident, y compris hors heures ouvrées ; définir couverture
ou moyens réellement qualifiés. Une alerte 24/7 n’est pas intervention 24/7.
La cible 24/7 demeure à réévaluer ; sans capacité compatible, ouverture bloquée.
Mesure 99,5 % définie sur mois glissant de 30 j, requêtes synthétiques de disponibilité
et parcours métier, pas pourcentage fournisseur transformé en SLA DossierClé.

Checklist GO commerce : N2 intégration/security/charge/PRA conformes, zero
Critical/Major, KC-OTP-01 résolu, licences/contrats/ZDR/privacy et coûts validés,
restaurations chiffrées/relecture journal prouvées, intégrations par boîte
qualifiées, supervision/runbooks/exercice, autorisation propriétaire explicite.

## Matrice B01–B12 et preuve de sortie

| Bloc | N1 Architecture actuel | N2 Verify/QA obligatoire | N3 Production |
|---|---|---|---|
| B01 | Choix Scaleway PG17, capacités/limites établies ; ADR-022 supersède D59 | Isolation, permissions, pools/migrations, TLS, backup chiffré/restore agence et AZ | SKU/disponibilité/coût/contrat, aucun PITR natif promis |
| B02 | Inngest interne Compose, dispatcher A fermé ; licence documentée sous condition commerciale | Fencing réel, pause/lock/partition, idempotence/inbox/outbox, résultats inconnus | Qualification écrite SSPL/usage/version, support et coût éventuel |
| B03 | J1 indépendant et protocole récupération retenus, objectifs D58 maintenus | Jeux cohérents, perte AZ, RPO/RTO stricts, droits après backup, réconciliation | Couverture humaine et autorisation de réouverture propriétaire |
| B04 | Paris privé, Secret Manager, IAM scoped/rotation/bootstrap défini | Absence endpoint public, flux, permissions/certificats/rotation, clé compromise | Inventaire/configuration et responsabilités |
| B05 | Contrats et qualification par boîte, manuel obligatoire avant preuve ; Q3-P1→N2 justifié | Suites Gmail puis Graph puis IMAP, période/readback/courses/quotas | OAuth publié/consentement, profils pilotes et permissions |
| B06 | Mistral stateless EU, candidats et budgets définis ; Q3-P1→N2 pour activation | Gold set par tâche, coût/concurrence/purge/injections et disponibilité route | ZDR approuvé/opt-out/région/contrat, budgets observés |
| B07 | **BLOCKED KC-OTP-01**, contrat OIDC/session défini mais D54 non réalisé par natif | Une fois solution N1 retenue : MFA/recovery/concurrence/révocation/idle15 j30 min et dump chiffré | Responsabilité recovery propriétaire, clés/rotation/contrat support |
| B08 | Limites 20 Mo/formats/TTL définis ; rétention 3 ans hypothèse commerciale explicite | AV, toutes purges/backups/retries/export/droits | Durées/finalités juridiquement/contractuellement validées |
| B09 | Qualification locale HUMAN_APPROVED acquise, non rouverte | PG/crash/workers/transport/tzdb/PRA avant mise en service | Surveillance/reprise et droits courants |
| B10 | 99,5 %, propriétaire heures ouvrées/0 € et frontière sans client définis | Alertes/exercices/incidents/RTO | Réévaluation couverture24/7, pas commerce sans capacité conforme |
| B11 | Consolidation et revue indépendante de ce nouveau corpus PASS documentaire | Vérification documentaire de traçabilité | Ne vaut pas conformité/runtime |
| B12 | Stack acquis D71/D72, compatibilité documentaire contrôlée ; pas installation/POC | Locks/builds/sécurité/E2E/G05/OTel/rollback des stories | Artefact QA identique, approbation propriétaire |

Verdict global N1 : **BLOCKED, KC-OTP-01 uniquement**, confirmé par la
[revue indépendante PASS documentaire](../agentic/work/63-finalize-architecture/review.md). Cette liste n’efface aucune condition N2/N3 de production.
Budget : [prévisionnel sourcé](ARCHITECTURE_BUDGET.md).
Sources : [recherche de finalisation](../agentic/work/63-finalize-architecture/research.md).

## Compatibilité documentaire des versions

Node24 conservé ; le manifeste historique B12 a observé24.21.0, compatible avec
le seuil24.15+ du schematics Nest12 et le minimum Vite8. Nest12 ESM/TS6, React19,
Express5, Drizzle/pg/PG17 conservés. Keycloak26.8.0 source examinée et PG17
supporté ; exemple selfhost Inngest PG17/Redis7 documenté. Ces sources ne sont
ni build ni preuve du graphe complet : versions patches/digests/lock/signatures
et compatibilité réelle seront figés/vérifiés dans Research/Plan/Verify des
stories. Le lock historique partiellement installé n’est pas une qualification
produit et aucun package n’est installé/retesté ici. Une incompatibilité réelle
future rouvrira le gate/ADR concerné ; aucune liste de versions dev/prod différente
ou upgrade majeure tacite n’est autorisée.
