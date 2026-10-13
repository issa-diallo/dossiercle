# Design — S01 Créer et activer un espace isolé

## Statut et entrées

`DESIGN: PASS` — 2026-10-11, après [revalidation indépendante 3](design-review.md)
des corrections S01-P-01/P-02. Revue 2 conservée en historique.
[Story](../../../product/STORIES.md), [Research PASS](research.md),
[revue Research](research-review.md), [Architecture](../../../product/ARCHITECTURE.md),
[finalisation](../../../product/ARCHITECTURE_FINALIZATION.md),
[contrat OTP normatif](../../../product/ARCHITECTURE_OTP.md),
[Design System](../../../product/DESIGN_SYSTEM.md).
Les choix ci-dessous précisent ces contrats sans nouvelle fonction métier/ADR.

## Cycle de vie et parcours

```text
Propriétaire vérifié → invitation liée au premier sujet Keycloak
→ administrateur définit ses propres password/TOTP/secours (UI maintenue)
→ session d'onboarding limitée → création durable
→ base et rôle dédiés → schéma prêt → secrets référencés
→ confirmation de l'administrateur → ACTIVE (IA et mail désactivés)
```

Le propriétaire seul initialise le compte invité dans Keycloak via adaptateur
administratif privé : username technique UUID immuable, sujet `sub` fixe, contact
email, compte sans password connu de l'opérateur, actions natives pour définir
son password et générer ses secours. Cette préparation est journalisée avant
appel IdP ; résultat incertain garde l'invitation PENDING et se réconcilie par
UUID technique, jamais par un email ambigu. Le grant limité d'enrôlement est
expirant 10 min/usage unique et dirigé vers les UI/API maintenues Keycloak/PI.
Le propriétaire transmet l'invitation par un canal privé approuvé ; pas de
connecteur Gmail/Graph/IMAP ni de service d'envoi immobilier S01.
En local, les liens synthétiques sont transmis au navigateur de test sans logs.

« Administrateur vérifié » signifie sujet lié par invitation du propriétaire,
identité de contact confirmée par ce propriétaire via canal préenregistré,
mot de passe personnel vérifié par Keycloak, premier TOTP PI effectivement
validé, secours natifs générés et epoch courante confirmée. Email seul, rôle
fourni par client, callback non vérifié ou QR scanné sont insuffisants. Enrôlement
PI n'accorde aucun accès métier. Aucun password/TOTP calculé par NestJS.
La procédure et le canal de récupération sont enregistrés avant ACTIVE ; la
récupération totale ultérieure suit D05, sans écran supplémentaire S01.

### États

Invitation : `PENDING_IDENTITY → ISSUED → CLAIMED`, ou `EXPIRED`/`REVOKED`.
Le jeton d'invitation expire 10 min après ISSUED, est stocké hashé, 256 bits
aléatoires, et lié au sujet attendu. Réémission propriétaire invalide le grant
précédent ; conserve la même invitation racine et la même création éventuelle.
Une création CLAIMED peut finir après expiration du jeton consommé ; chaque
nouvelle mutation exige encore session forte et invitation non révoquée.

Agence : `PROVISIONING → READY → ACTIVE` ; `PROVISIONING → FAILED` ;
`FAILED → PROVISIONING` seulement sur reprise autorisée de la même opération.
READY signifie techniquement préparée, **pas accès métier**.
Étape persistée : `ACCEPTED`, `DATABASE_CREATED`, `SCHEMA_READY`,
`SECRETS_REFERENCED`, `READY`, `ACTIVE`. `FAILED` conserve dernière étape réussie,
code d'erreur sûr, retryabilité et version ; un état inconnu ne devient pas READY.
Pas d'API de désactivation/résiliation/réactivation d'agence S01. Révocation,
epoch PENDING ou contrôle central indisponible ferme les accès quelle que soit
la valeur ACTIVE. Une invitation révoquée avant ACTIVE ne peut être réanimée
par retry. Les fonctions IA et modules sont fermés dans tous les états S01.

## Acteurs et autorisations côté backend

| Acteur | Opérations permises | Interdictions |
|---|---|---|
| Anonyme | Démarrer redirect OIDC/enrôlement avec grant valide uniquement | Créer/consulter/activer agence, choisir `sub`/rôle/base |
| Propriétaire plateforme | Inviter/réémettre/révoquer invitation ; voir état technique minimisé | Mot de passe de l'invité, accès métier implicite, activation au nom de l'admin |
| Sujet invité fort | Créer/reprendre/consulter sa propre création ; activer son espace READY | Autre invitation/agence, s'attribuer autre rôle, ignorer MFA |
| Admin actif agence | Consulter l'état de son agence ; rejouer confirmation ACTIVE sans effet | Autre agence sans appartenance explicite, choisir credentials/DSN |
| Standard/habilité | Aucun endpoint création/activation S01 | Privilège ADMIN par rôle IdP/client |
| Provisioner service | Étapes techniques de l'opération enregistrée, privilèges DDL séparés | Sessions humaines, données dossier, octroi ADMIN non contrôlé |
| Support technique | Aucun accès métier sans grant explicite selon ADR004 | Bypass via statut propriétaire ou service |

Propriétaire est identifié par sujet serveur configuré explicitement, vérifié
avec MFA ; jamais par inscription libre ou première connexion. Bootstrap local
uniquement synthétique, effectué via outils administratifs privés maintenus,
pas route publique « premier utilisateur devient owner ».
Toutes mutations : cookie BFF, Origin exact + CSRF serveur lié à la session.
Session/enrôlement limitée : scopes `onboarding` et invitation racine unique,
aucune route métier. Session agence requiert membership ACTIVE actuel, statut
agence et epoch. Cookies Secure/HttpOnly/SameSite compatible OIDC ; pas token
localStorage. Idle30 min réel, absolu15 j ; GET/polling ne prolonge rien.
Logout/backchannel/epoch contrôlés au prochain accès, panne fermée.
Concrétisation du contrat fort : flow Keycloak LOA2 obligatoire, token BFF avec
`acr=2` attendu et provenance issuer/client/config vérifiée ; la preuve native
password+TOTP (ou secours après enrôlement initial confirmé) et l'epoch J1 restent
requises, pas confiance au seul claim. Claim absent/différent = onboarding fermé,
aucun abaissement automatique du niveau. T04 qualifie ce mapping natif en N2.

## Données et contraintes relationnelles

Deux schémas applicatifs `control`/`identity` dans **la même DB centrale contrôle**
pour atomiser agency+membership+audit+outbox ; rôles SQL distincts par capacité.
Keycloak et PI conservent leurs DB dédiées. Cela ne centralise aucun métier et
respecte D40/D54. FK locales explicites ; aucune FK inventée entre DBs.
Tous IDs UUID générés serveur, timestamps UTC, versions bigint monotones.

| Table | Champs/contraintes indispensables |
|---|---|
| `control.agency_invitation` | id/root_id, subject_id attendu, contact minimisé, owner_id, identity_status, token_hash unique nullable, expires_at, status, version, recovery_channel_ref ; une racine est stable, empreinte/proof de contrôle sans pièce d'identité |
| `control.agency` | id, invitation_root_id UNIQUE NOT NULL FK, name, state CHECK, version, created_at/activated_at ; ACTIVE implique activated_at et ready_schema_version=1 |
| `control.provisioning_operation` | id, agency_id UNIQUE FK, step, status, last_error_code, retryable, attempt, version ; un seul déroulement durable par agence |
| `control.database_locator` | agency_id PK/FK, database_name UNIQUE, runtime_role UNIQUE, migration_role, schema_version, secret_ref UNIQUE, verification_version ; noms générés depuis UUID sans donnée utilisateur |
| `control.idempotency_record` | actor_id, operation_type, key, canonical_body_hash, resource_id, résultat minimisé ; UNIQUE(actor_id, operation_type, key), pas de token/cookie dans corps hashé |
| `identity.account_authority` | subject_id PK Keycloak, identity_epoch, confirmed_epoch, status PENDING/CONFIRMED/DENIED, journal_sequence/journal_hash, enrollment_status, recovery_ready ; octroi seulement si epochs égales et preuves natives fortes |
| `identity.membership` | subject_id + agency_id PK/FK, role ADMIN/HABILITED/STANDARD, state PENDING/ACTIVE/DENIED, version ; rôle initial ADMIN figé par invitation |
| `identity.session` | hash cookie PK, subject_id FK, scope, invitation_root_id nullable, issued_at, last_human_activity_at, absolute_expires_at, epoch, revoked_at ; tokens OIDC chiffrés côté serveur, clés hors DB |
| `control.audit_event` | event_id PK, agency_id nullable avant création, actor/type, at, event_type/schema_version, resource_id, outcome, correlation, versions ; append-only rôle writer, pas PII/secrets/payload IdP |
| `control.outbox` | event_id PK/FK audit/intention, type/schema_version, agency_id, resource_id/version, status/attempt ; UNIQUE(type, resource_id, version) |
| agence `agency_metadata` | singleton avec agency_id UNIQUE, schema_version=1, migration checksum ; refuse un marqueur de propriété différent |
| agence `agency_configuration` | singleton, automation_enabled=false, modules fermés ; absence de configuration signifie interdit |
| agence `audit_event` | événement minimal prêt/activation, event_id UNIQUE central corrélé ; append-only, pas données originales |

PK/FK/UNIQUE/CHECK + transitions conditionnelles SQL sont combinées ; un CHECK
ne vérifie pas une autre DB/IdP. Dans la transaction finale, verrouiller agence,
invitation, account_authority et membership ; leurs modifications utilisent le
même ordre de verrous (invitation → autorité identité → agence → membership).
Les octrois/révocations d'identity sont sérialisés sur account_authority ;
le verrou est gardé pendant la barrière J1 et le commit, selon les règles ci-dessous. Invariant
au commit ACTIVE : un membership ADMIN actif vérifié et aucune permission
implicite supplémentaire. L'API métier refuse un membre actif d'agence non active.

## Saga, transactions et concurrence

1. **Inviter** : transaction centrale réserve racine/subject prévu, audit préalable
   et commande PENDING ; adaptateur IdP effectue création/enrollment initial, J1
   avant changements sensibles. Confirme sujet par UUID et résultat actuel avant
   ISSUED. Création Keycloak réussie mais réponse perdue : rechercher UUID stable,
   ne pas créer un second compte. Aucun jeton retourné sur résultat incertain.
2. **Accepter création** : recontrôler session forte, preuve native et invitation
   sous verrous ; transaction centrale vérifie CLAIMED (grant consommé lors du claim) et écrit agency
   PROVISIONING, membership PENDING, opération, audit et outbox atomiquement.
   Le 202 n'est rendu qu'après commit ; après timeout client, consulter/rejouer.
3. **Réveiller** : dispatcher publie l'outbox vers Inngest interne ; duplications
   admises, fonction provisioner recharge état/autorisations et l'opération.
   Unicité/concurrency Inngest ne remplace pas verrou PG. Reconciler périodiquement
   les outbox/opérations non terminées après redémarrage, sans moteur de jobs alternatif.
4. **Provisionner** : process dédié, une connexion centrale et advisory lock
   session par operation_id pendant **toutes** les étapes réseau/DDL, ni lease
   expirant ni failover automatique. Runners concurrents attendent/refusent.
   En cas de perte de connexion/lock, ce runner cesse tout nouvel effet. Une
   capacité incertaine n'est pas réémise ; reprise après arrêt vérifié de l'ancien
   runner et inspection des objets, même mécanisme fermé D75/ADR023.
   Nom DB/roles depuis UUID, CREATE DATABASE hors transaction PG **avec
   ALLOW_CONNECTIONS false dès la création**. Depuis la DB de maintenance,
   retirer PUBLIC CONNECT/TEMP et accorder CONNECT seulement au rôle migration,
   puis ouvrir ALLOW_CONNECTIONS true pour migration ; runtime octroyé seulement
   après schéma/ACL vérifiés. Une pause/crash CREATE→REVOKE ne permet donc aucune
   connexion A vers B. Durcir seulement template ou NOLOGIN B ne protège pas des
   autres rôles A. Droits runtime
   limités, CONNECT/PUBLIC retirés sur **toutes** les DB centrales/agences et
   privilèges futurs. Aucun superuser API, aucun runtime propriétaire de sa base.
   Création/relecture du secret : même référence et version enregistrée ; identité
   et empreinte de propriété concordantes avant adoption, conflit = FAILED non
   retryable. Secret incertain = reconciliation, jamais nouveau mot de passe aveugle.
5. **Schéma** : migration sous verrou dans DB agence et transaction locale,
   checksum/version et agency_metadata contrôlés ; audit local puis checkpoint
   central. Crash après commit agence : vérifier checksum/marqueur avant avancer.
   Coffre et ACL confirmés ; connexion runtime vérifie canari/agence et version.
   Transaction centrale marque READY+audit après toutes confirmations.
6. **Activer** : session admin forte toujours courante ; agence READY, invitation
   CLAIMED non révoquée, account CONFIRMED/epoch et recovery_ready, base/schema et
   secret version confirmés, barrière J1 courante convergée et sans deny/PENDING.
   Écrire d'abord audit local « préparation activation »
   unique sous event_id réservé ; si ce commit ou sa réponse est incertain,
   réconcilier l'événement par identifiant, sans publication ACTIVE.
   Transaction centrale finale atomise membership ACTIVE, agence ACTIVE/version,
   audit `agency.activated.v1`, idempotency et outbox. Le journal local préalable
   ne signifie jamais activation ; l'audit de confirmation local sera projeté
   idempotemment depuis l'outbox. L'autorité finale est le commit central.
7. **Reprise** : après panne identifiée/sans effet incertain, l'admin recontrôlé
   demande retry ; même opération/DB/secret, nouvelle version/outbox, jamais
   retour au bootstrap ni seconde invitation. Révocation bloque reprise/octroi.

Audit central indisponible = transaction refusée, aucun 202/ACTIVE. Audit local
indisponible = pas READY/activation. Publication Inngest indisponible après commit
= opération acceptée et en attente, pas perdue. Les copies d'audit agence sont
projections rattrapables ; elles ne représentent pas une transaction distribuée.
Échec technique après création laisse la base en quarantaine fermée ; pas de
DROP/effacement automatique. Nettoyage destructif nécessite mandat humain séparé.

### Idempotence

Mutations exigent `Idempotency-Key` UUID et empreinte JSON canonique.
Scope sujet+opération+invitation/agence ; token invitation est contrôlé séparément,
jamais inclus dans l'empreinte persistée. Même clé/corps : même ressource/effet,
projection d'état **courante**, pas réponse historique contenant vieux droits.
Même clé/corps différent :409 `IDEMPOTENCY_CONFLICT`. Nouvelle clé/même invitation
CLAIMED et même name canonique : même création existante ; nom différent :409
`CREATION_CONFLICT`. Pas de dédoublonnage par nom agence ou email.
Sur activation ACTIVE, même admin autorisé reçoit200 courant sans nouvel audit
activation ; replay vérifié avant `If-Match`. Une nouvelle activation ACTIVE
avec nouvelle clé également sans effet ; droits courants toujours vérifiés.
Records de création/activation conservés durant le cycle de vie de l'espace,
purge finale selon politique applicable ; aucune expiration courte qui libérerait
l'unicité racine. Version obsolète sur mutation nouvelle :409 `VERSION_CONFLICT`.

## Contrats HTTP versionnés à créer

Pas d'endpoint existant ; ce tableau fige OpenAPI v1 et les DTO partagés.
Réponses `Cache-Control: no-store` ; erreur `{code, correlationId, retryable}`,
message UI traduit par code. Aucun stacktrace/secret/nom d'objet étranger.
UUID malformé400 ; inconnu/étranger404 identique après auth ; absent auth401 ;
rôle interdit sur ressource propre403. Panne autorité/coffre/journal503 ferme.

| Endpoint | Acteur / entrée | Réponse et contrôle |
|---|---|---|
| `POST /v1/platform/agencies/invitations` | Owner fort ; `{email, identityConfirmationRef, recoveryChannelRef}` ; clé idem | 202 `{invitationId,status:PENDING_IDENTITY}` ; préparation IdP auditée ; aucun droit métier |
| `GET /v1/platform/agencies/invitations/{id}` | Owner uniquement | État minimisé ; liens/grants ne sont pas retournés par GET |
| `POST /v1/platform/agencies/invitations/{id}/issue` | Owner ; `{}` clé idem, If-Match | 200 invitation ISSUED + `enrollmentUrl` à usage unique retournée **une fois** sur TLS canal privé ; replay renvoie état seul, réémission explicite invalide ancien grant |
| `POST /v1/platform/agencies/invitations/{id}/revoke` | Owner ; `{}` clé idem, If-Match | 200 état REVOKED après J1/deny courant ; résultat pending503 fermé |
| `GET /v1/auth/oidc/start`, `GET /v1/auth/oidc/callback` | Redirect upstream, state/nonce/PKCE serveur liés au grant | Cookie onboarding seulement jusqu'à confirmation forte et epoch ; aucune acceptation de `sub` client |
| `POST /v1/onboarding/invitation/claim` | Sujet attendu, onboarding fort ; `{token}` | 200 contexte propre sans jeton ; token consommé une fois, claims rejoués par même sujet renvoient même contexte ; autre sujet refus générique |
| `POST /v1/agencies` | Sujet invité fort ; `{name}` + clé idem | 202 `{agencyId,operationId,state,version,statusUrl}` ; utiliser invitation liée côté serveur, pas id choisi client |
| `GET /v1/onboarding/agency` | Session onboarding et racine liée | Création propre ou204 si aucune ; retrouver résultat après perte réponse/key |
| `GET /v1/agencies/{id}/activation` | Invité lié à sa création ou ADMIN membership propre actuel | 200 `{agencyId,name,state,step,version,errorCode,retryable,canActivate,canRetry,automationEnabled:false}` |
| `POST /v1/agencies/{id}/activation` | Invité initial vérifié ou ADMIN propre ; `{}` + clé idem + If-Match version | 200 ACTIVE ; 409 `NOT_READY`/`VERSION_CONFLICT` ; 503 échec avant commit, consulter avant retry |
| `POST /v1/agencies/{id}/provisioning/retry` | Invité initial/admin propre ; `{}` + clé idem + If-Match | 202 même operationId PROVISIONING ; 409 état interdit/à réconcilier |
| `GET /v1/session`, `POST /v1/auth/logout` | BFF courant ; logout CSRF | Vue scope/agency autorisée sans token ; logout révoque avant204 ; minimum socle S01, S02 développera parcours complet |

Issue/réémission : premier issue crée un grant ; nouveau issue explicite après
relecture version est une réémission, pas deuxième agence/compte. Les liens
secrets ne figurent jamais dans audit, GET, cache, analytics ou erreurs. Fragment
URL nettoyé immédiatement côté onboarding ; `Referrer-Policy: no-referrer`, pas
ressources tierces. PI et Keycloak restent privés hors ingress maintenu.

Validations : JSON strict, unknown fields interdits ; name NFC+trim 1–120 caractères,
contrôles/caractères de commande refusés, texte échappé en UI, pas interpolation
SQL. Email syntaxique borné254 caractères, contact normalisé sans modifier
arbitrairement la casse de la partie locale ; n'est pas clé d'autorisation.
Refs de confirmation/canal : UUID serveur vers preuve minimale privée, jamais
URL/libre texte/identité brute fournie par invité. `If-Match` entier version forte,
clé obligatoire ; body32 Kio max, rate-limit dédié et429 sans enumeration.
Owner confirmation/canal sont enregistrés par procédure privée avant invitation,
adaptateur et fixture fournissent ces références, pas validation automatique.

## Isolation et contrôles techniques

Chaîne obligatoire : cookie/IdP/epoch → appartenance ou invitation propre →
statut autorisé → locator serveur → credentials dédiés → contexte PG immuable.
Un invité ne dispose que de la projection d'activation centrale ; aucun accès
métier avant commit ACTIVE. Le propriétaire utilise registre technique, pas
routeur métier. Changer id dans route/corps/outbox ne donne pas de capacité.

Routeur vérifie agency_metadata et schema_version après ouverture ; key de pool
inclut agency_id+secret_version, aucune variable globale « current agency ».
Révocation relue à chaque appel et avant commit mutation ; pas cache de droits.
Pools à la demande, bornés et évincés ; aucune connexion A capable de CONNECT B.
Noms SQL techniques générés/quotés ; runtime sans CREATE DATABASE/ROLE, DDL,
SET ROLE migration, permissions control/Keycloak/PI. Tables audit en INSERT/SELECT
limités, pas UPDATE/DELETE. Migration/provisioner privés, API ne détient pas leur clé.

Aucun endpoint fichier, upload ou téléchargement S01 ; toute route inconnue
refusée, aucun stockage public créé. Tests canaris objets/secrets vérifieront
le mapping par agence via adaptateur synthétique, sans ajouter une API fichier.
Futures données métier ne sont pas créées artificiellement pour tester : marqueurs
synthétiques directement insérés dans les bases de test servent de canaris.

Ingress OTP reprend **intégralement** ARCHITECTURE_OTP : sousflow MFA REQUIRED,
aucun OTP natif, passwordless/direct grants/selfservice alternatif désactivés ;
resolver realm/UUID immuable ; VerifySSL true et paramètres permissifs fermés.
NGINX/ModSecurity blocage phase2 des POST normalisés `login-actions/**` : ARGS
query+body `scope`/`id_token_hint` et doublons/encodages/parser erreurs/multipart/
normalisation ambiguë, RAM bornée, aucun bodylog/disque, pas DetectionOnly.
Pas accès direct Keycloak. GET autorisation OIDC normaux préservés. Les règles
exactes générées pour le realm fixe `dossiercle` couvrent
`/realms/dossiercle/login-actions/**`, y compris actions d'enrôlement/recovery,
et refusent tout chemin alternatif ; matrice d'attaques obligatoire avant activation.

J1 : événement opaque PENDING/deny epoch avant mutation IdP/PI/révocation, confirme
après résultat courant ; S01 implémente contrat et stockage local synthétique
append-only indépendant des DB restaurées. Une instance locale ne prouve pas
ObjectLock/Multi-AZ ; adapter production/IAM/PRA reste N2/N3 avant données réelles.
Restore local doit fermer sessions et accès si journal/clé/propriété inconnus.

**Opposabilité J1 en fonctionnement courant, pas seulement après restore :**
chaque accès onboarding/métier et chaque octroi prend une barrière d'autorité
courante : lire le head J1 indépendant du sujet (séquence+empreinte+epoch), puis
comparer sa projection centrale `journal_sequence/journal_hash`. Aucun cache de
droits/head n'autorise un accès. PENDING/deny, head inconnu, divergence ou lecture
impossible = refus, même si SQL présente encore CONFIRMED/ACTIVE. Une écriture
J1 réussie reste opposable si la seconde écriture PG échoue.

Le coordinateur et l'activation suivent l'ordre de verrous défini : la ligne
account_authority sérialise les changements d'identité, la barrière J1 et le
commit d'activation ; lecture sensible tient un verrou partagé d'autorité
jusqu'à fin de la lecture, mutation tient le verrou approprié jusqu'au commit
agence. Pas de commit d'octroi après libération de cette protection. La révocation
prend le verrou exclusif, écrit/fsync J1 deny/PENDING avant mutation PG/IdP/PI,
puis n'acquitte APPLIED qu'après convergence. Si PG/IdP échoue après J1, le head
PENDING continue d'interdire les appels suivants et l'activation. Si la connexion
ou le lock est perdu, aucune nouvelle opération, refus fermé et réconciliation.
Le journal lui-même sérialise append par sujet/commande, séquence unique+empreinte ;
seul le coordinateur écrit, opérations manuelles upstream hors procédure interdites.
Cela ordonne accès/octroi/révocation sans transaction distribuée supposée.

Tests indispensables : panne juste après J1 avant PG (ancien compte CONFIRMED
et ancienne session pourtant refusés), panne de lecture J1, empreinte divergente,
activation concurrente au deny et réconciliation qui ne réaccorde pas le droit
sans nouvelle confirmation explicite.

### Preuve ciblée de la fermeture initiale PG

Le 2026-10-11, lecture documentaire uniquement de la documentation primaire
[PG17 CREATE DATABASE](https://www.postgresql.org/docs/17/sql-createdatabase.html)
et [privilèges PG17](https://www.postgresql.org/docs/17/ddl-priv.html) : false
interdit les connexions ; permissions de DB non héritées du template, commande
hors transaction. Cette capacité précise la fermeture préexistante de la saga,
pas nouvel ADR. Test obligatoire : tenter CONNECT A→B pendant pause entre CREATE
et REVOKE, puis après réouverture réservée migration et après grant runtime B.
Aucun test PG exécuté ici ; capacités managées à qualifier avant exposition.

## Audit, erreurs et observabilité

Événements v1 : `invitation.pending/issued/claimed/revoked`,
`identity.enrollment.confirmed/denied`, `agency.creation.accepted`,
`agency.provisioning.step/failed/retried`, `agency.activation.prepared/activated`,
`authorization.denied`, `session.revoked`. Agence/sujet opaque, acteur réel/type,
UTC, objet/version, résultat, corrélation et event_id uniques. Pas password,
token/code/TOTP/grant, email entier, DSN, nom base ou payload fournisseur.
Refus étranger journalise référence de requête hachée, jamais l'agence cible réelle.
Métriques low-cardinality : opérations par état, âge de la plus ancienne,
erreurs par code, outbox en attente, pools/connexions ; labels sans PII/UUID.

| Situation | Code sûr / résultat | Reprise |
|---|---|---|
| Grant absent/invalide/expiré/autre sujet | `INVITATION_UNAVAILABLE`, aucun détail étranger | Contacter propriétaire, pas créer nouvel espace |
| MFA/facteur/epoch non confirmé | `IDENTITY_NOT_READY` / accès métier refusé | Enrôlement upstream autorisé, jamais OTP natif fallback |
| Central/coffre/PI/J1/audit indisponible | `DEPENDENCY_UNAVAILABLE` | Fermer octroi, état conservé, réconciliation |
| DDL/migration certaine en échec | `PROVISIONING_FAILED`, retryable si connue récupérable | Même DB/operation ; erreur technique détaillée uniquement logs internes redigés |
| DB/secret existant de propriété différente | `PROVISIONING_CONFLICT`, non retryable | Intervention propriétaire, aucune adoption/destruction aveugle |
| Activation non prête ou révoquée | `NOT_READY` / refus courant | Aucun ACTIVE partiel |
| Réponse activation perdue après commit | Résultat incertain côté UI | GET état, puis replay sous droits courants ; pas double octroi |

## Interfaces, états et accessibilité

Onboarding `/onboarding` : lien privé → native enrollment → retour BFF ; formulaire
nom agence seulement, libellé obligatoire et bouton « Créer mon espace ».
Après202, page `/agencies/:id/activation` nom/contexte agence, statut texte,
étapes compréhensibles et erreur persistante/corrélation ; aucune CPU/RAM/coffre.
READY : « Votre espace est prêt » + « Activer mon espace » ; affichage constant
« Aucune fonction IA ni connexion e-mail n'est activée ». ACTIVE confirme serveur,
aucune navigation vers modules non livrés. FAILED récupérable : « Reprendre la
préparation » ; incertain : « Vérification en cours », pas nouvelle création.

Button/FormField/Alert/StatusBadge selon tokens du Design System, aucune
bibliothèque UI ou dashboard supplémentaire. Pending : `aria-busy`, libellé
conservé, double clic neutralisé. Erreur validation : focus résumé+liens champs,
valeurs nom conservées, aucune information sensible en stockage persistant.
Poll5s tant que visible et PROVISIONING ; pause page cachée/offline, backoff jusqu'à
30s sur erreur ; ne maintient pas last_human_activity. Récupération après refresh
via GET onboarding/agency, pas token/key conservé en localStorage.
Session expirée : arrêter mutations/polling, réauth upstream puis relecture état.
Refus générique, aucun nom étranger. Mise en page une colonne320 CSSpx/zoom200%,
clavier/focus visibles, status live polite, cibles44px, contraste DS et mouvement réduit.
Pas de création/activation automatique après reconnexion ou simple chargement.

## Couverture et gate

| Critère | Conception | Tests à planifier |
|---|---|---|
| AC1 | Invitation owner, admin fort, base distincte, commit central ACTIVE, IA fermée | Parcours navigateur et vrais PG/IdP/PI, statut et modules |
| AC2 | Unicité racine, saga/reprise, idem/version, verrous et audit | Double clic/deux runners/crash à chaque commit/activation replay |
| AC3 | Chaîne autorisation→base, credentials, canaris, absence fichiers | Matrice anonyme/rôles/A→B, lectures/écritures, secrets/outbox falsifiés |
| AC4 | Vue activation sûre et accessible, erreurs/récupération explicites | Contrat DTO/redaction, E2E états/panne/offline/clavier |

- [x] Research cohérent et AC couverts.
- [x] Architecture/OTP/Design System conservés.
- [x] États, erreurs et contrôles backend définis.
- [x] B05/B06 hors périmètre ; aucune dépendance cachée.
- [x] Revalidation indépendante des corrections Plan dans `design-review.md`.

Verdict : **PASS**, revue indépendante 3 ; S01-D-01/P-01/P-02 fermés.
Aucun code/migration créé ; aucun test runtime acquis.
