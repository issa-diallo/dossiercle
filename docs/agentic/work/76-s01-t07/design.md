# Design — #76 / S01–T07

## Statut et entrées

`DESIGN: PASS` — Research [PASS](research.md), [revue indépendante PASS](research-review.md).
Entrées normatives : S01 Design/Plan §T07, STORIES AC1–4, Architecture et ADR
listés dans Research ; Design System existant conservé, écrans réservés à T08.
Aucun nouvel arbitrage d’architecture. Les précisions suivantes fixent les
contrats nécessaires au socle réel, sans nouvelle migration de schéma.

## Autorisation et vue

Chaque GET, POST et replay revalide session forte/native, invitation liée ou
membership ADMIN propre, epoch/J1 courant, non-révocation et portée serveur.
Le propriétaire/support/provisioner n’acquiert pas d’accès humain implicite.
Standard/habilité propre403, étranger404 sans donnée, anonyme401 ; échec auth
courante prime tout replay. `canActivate`/`canRetry` sont des indications UI,
jamais des capacités acceptées en entrée.

| Route | Contrat conservé / complété |
|---|---|
| GET `/v1/agencies/{id}/activation` | ActivationView strict existant : agencyId/name/state/step/version/errorCode/retryable/canActivate/canRetry/automationEnabled:false. `Cache-Control: no-store`, aucun refresh/touch idle. Onboarding lié ou ADMIN propre actuel. Aucun locator, secret_ref, credentials, erreur SQL ou données étrangères |
| POST `/v1/agencies/{id}/activation` | `{}` strict, UUID Idempotency-Key et If-Match fort obligatoires, Origin exact + CSRF cookie courant.200 ActivationView ACTIVE après commit seulement.409 NOT_READY, VERSION_CONFLICT ou IDEMPOTENCY_CONFLICT ;503 DEPENDENCY_UNAVAILABLE si preuve/commit non confirmé, GET avant retry |
| POST `/v1/agencies/{id}/provisioning/retry` | Même sécurité/headers/body,202 AgencyAccepted même operationId ; reprend seulement FAILED retryable avec aucun effet/gate incertain, jamais nouveau bootstrap.409 NOT_READY pour état interdit/à réconcilier ou VERSION_CONFLICT ;503 pour dépendance inconnue |

400 INVALID_REQUEST sur body/champs/identifiants/headers invalides, body≤32Kio,
429 RATE_LIMITED selon boundary existante. Versions restent des chaînes décimales
et ETags forts ; pas d’extension permissive du parseur. Chaque réponse est validée
par contrat, erreur minimisée avec correlationId ; refus étranger n’expose rien.

| État central | Présentation backend et commandes |
|---|---|
| PROVISIONING | step courant minimisé, ni activation ni retry ; polling sans activité humaine |
| READY/SUCCEEDED | « prêt à confirmer », ADMIN PENDING, activated_at NULL ; canActivate seulement si preuves/autorité connues valides ; canRetry=false |
| FAILED retryable certain | erreur utile stable ; canRetry=true sous autorisation courante et version ; canActivate=false |
| FAILED nonretryable/incertain | erreur minimisée, flags false ; réconciliation privée requise, aucun retry aveugle |
| ACTIVE | état central seul autoritatif ; canActivate/canRetry=false ; confirmation/replay propre200 sans effet |
| Dépendance indisponible/auth expirée |503/401/403 selon boundary ; jamais ACTIVE déduit du prepared ou d’une réponse précédente |

Le consommateur T08 gérera loading/offline/erreur/clavier/annonces ARIA selon
Design System ; simple GET/reconnexion ne confirme rien. T07 ne construit pas
ces écrans. Automation, mail et modules restent false à toutes les étapes.

## Verrous, session et barrière finale

Créer un chemin privé de session T07 distinct du seul mode onboarding T05 :
réutiliser contrôles cookie/native/J1/CSRF, accepter principal onboarding lié
ou agency ADMIN propre, sans ouvrir claim/create/owner. Dériver sujet/racine
et agence depuis SQL et session, vérifier la route contre cette relation.

Ordre T07 : racine advisory et invitation → autorité exclusive du sujet →
sessions du sujet → agence UPDATE → membership UPDATE → opération/locator et
records idem. Verrous acquis avant refresh/J1 mutation et avant effet local.
Les chemins T05/T06 existants prennent parfois membership avant agence, mais
partagent auparavant la même autorité (exclusive T05, partagée T06). L’exclusive
T07 sérialise ces chemins sur le sujet lié et évite leur croisement. Ne pas
utiliser le prélock T05 qui prend agence SHARE puis upgrader après un refresh.
Pour chaque cible, subject doit correspondre à la racine ; ordre stable multi-
sessions ; aucune nouvelle commande ne verrouille agence avant autorité.
Tests réels de concurrence requis, timeout fermé et aucun retry automatique d’un
effet après perte de connexion/lock.

Sous ces verrous : account CONFIRMED, confirmed_epoch=identity_epoch=session.epoch,
enrollment confirmé/recovery_ready ; invitation CLAIMED/identity confirmée sans
révocation ; J1 head courant égal projection (séquence/hash/epoch, ni PENDING/deny).
Natif et session encore valides, idle30/absolu15j/revoked_at/backchannel contrôlés.
Refaire le contrôle d’expiration et de session/native après l’I/O d’audit et avant
commit ; refaire la barrière J1 après tout refresh. Pas de login/re-MFA propre à
T07 ajouté ; ne pas prolonger le délai absolu. L’activité humaine du POST suit
le mécanisme existant, GET ne refresh jamais. Si un contrôle final échoue, seule
une préparation audit sans octroi peut rester. Le verrou d’autorité reste détenu
jusqu’à fin du commit central ; aucun ancien statut SQL ne neutralise un deny J1.

## Préparation locale durable, transaction centrale et projection

L’API ne reçoit ni DDL ni credentials migration et n’ouvre pas le routeur humain
sur READY. Étendre le transport mTLS privé du provisioner existant par deux
commandes fermées `prepare-activation-audit` et `read-activation-audit`, et un
handler de projection `agency.activated.v1`. La matrice de transport est fermée : identité cliente dédiée `t07-activation`
(coordinator) → POST `/internal/t07/activation/prepare` et
`/internal/t07/activation/read` seulement ; `t06-orchestrator` → wake T06 et
projection dédiée `/internal/t07/activation/project` seulement. Certificats et
clés distincts, SAN/CN attendu et CA vérifiés, Host privé exact
`t06-provisioner:4443`, Content-Type JSON, corps strict et borné4096octets.
Aucun wake/DDL accessible à t07-activation. Le handler Inngest activated est
distinct du parseur provisioning T06, qui garde ses deux types actuels.
Les entrées privées portent seulement
identifiant de réservation/événement ; agence/locator/rôles/secret versions/type/
version/corrélation sont rechargés du centre, jamais du navigateur ou du payload
Inngest. Cette capacité technique n’offre aucune requête métier ni SQL libre.

1. Transaction centrale de réservation, sous session/locks courants : vérifier
   READY/SUCCEEDED, six effets CONFIRMED et clôture T06 certaine, absence exécution
   RUNNING/BLOCKED pour cette opération, locator version/schema/checksum/secret et
   propriété concordants. Réserver eventId prepared, eventId activated, targetVersion
   (version agence+1) et corrélation dans un record interne idempotency_record.
   Namespace `t07.activation-prepare.v1:<agencyId>:<targetVersion>`, key UUID agence,
   actor sujet courant, hash canonique des bindings serveur. Aucune clé publique
   n’est consommée comme succès activation ici. Reservation immuable : tuple
   différent refuse fermé, aucune réutilisation sur autre version/tenant.
2. Préparation privée mTLS : relire cette réservation et bindings, preuve READY,
   ouvrir uniquement la DB vérifiée via capacité technique provisioner, vérifier
   marqueur/schema/ACL/config false/secret version. Écrire
   `agency.activation.prepared.v1` unique puis relire event_id/type/targetVersion/
   correlation exacts avec AgencyRepository.projectAudit. Commit local. Timeout ou
   réponse perdue : lecture privée par même réservation/eventId ; absence ou
   divergence = pas d’activation,503/réconciliation. Ne pas réserver un nouvel
   événement pour contourner un résultat inconnu.
3. Transaction centrale finale : reconstruire tous les verrous et autorisations,
   proofs/locator/version courantes ; lire prepared local via commande privée de
   lecture, réservée à l’identité mTLS. Cette lecture ne prend pas de verrou
   d’autorité central qui attendrait celui détenu par l’appelant : elle ne fait
   aucun octroi et ne se substitue pas au contrôle humain central. Elle vérifie
   binding source et tuple local. Aucun événement local seul n’autorise ACTIVE.
   Recontrôler session/native/J1 après lecture. Dans une seule transaction :
   membership ADMIN PENDING→ACTIVE/version+1, agence READY→ACTIVE/version+1 et
   activated_at UTC, opération step ACTIVE (status SUCCEEDED, version+1), audit
   central `agency.activated.v1`, outbox correspondante et record idem public.
   Chaque UPDATE conditionnel doit toucher exactement une ligne ; sinon rollback.
   Échec audit/outbox/idem/COMMIT interdit de répondre succès présumé.
4. Projection asynchrone : dispatcher existant → Inngest privé signé → handler
   activé borné au manifeste T07 → relecture audit/outbox/agency ACTIVE centraux
   et bindings versionnés → projection audit local du même eventId activated,
   readback exact. Duplicate/ack perdu reprend le même tuple ; aucune seconde
   activation. DELIVERED dispatcher signifie publication moteur, pas projection
   localement acquise : succès step Inngest seulement après readback local.
   Réconciliation depuis outbox/audit central et étapes moteur persistées ;
   panne de projection laisse ACTIVE central et dette observable, pas rollback
   d’octroi, pas perte silencieuse. Aucun moteur parallèle ajouté.

Réservations/records internes utilisent les tables existantes (T02 seulement) ;
la réservation est un fait préparatoire et n’ajoute ni état agence ni autorité.
Le namespace interne permet reprise après perte de clé/réponse sans multiplier
prepared/activated. Tous les bindings sont revalidés au final ; une réservation
orpheline reste conservée/minimisée. Aucun nettoyage automatique.

## Idempotence et reprise

Namespace public activation `t07.agency-activation.v1`, retry
`t07.provisioning-retry.v1` ; hash canonique inclut agence de route et corps `{}`,
resource_id agence. UNIQUE sujet/type/key existant ; conflit route/corps409.
Même clé valide après auth courante : retourner projection actuelle avant
If-Match, sans nouvel effet. Nouvelle clé sur ACTIVE propre :200 courant sans
audit/octroi supplémentaire, enregistrer seulement le replay minimal si nécessaire.
Nouvelle mutation sur version obsolète409 ; ne pas masquer une révocation par
replay. Réponse centrale perdue : GET sans refresh puis même clé ; en cas de perte
de clé, ACTIVE propre reste sans effet avec nouvelle clé.

Retry : verrouiller même opération, agence, autorité et contrôles J1 ; interdire
READY/ACTIVE et toute exécution RUNNING/BLOCKED/UNCERTAIN non réconciliée. Gate
provisioning global IDLE et aucune exécution RUNNING/BLOCKED dans le centre,
conditions relues sous verrous compatibles avant admission. Sur FAILED retryable
certain, attempt<4 et version agence If-Match exacte : même operationId,
DB/refs/secretVersion, admission100 identique T06 avant refresh/nouvel effet ;
transaction centrale vers PROVISIONING/PENDING, incréments versions agence/op,
audit `agency.provisioning.retried.v1` **dispatch:false** et record idem,202 après
commit. Ne pas publier cet événement vers le handler provisioning existant.
Le scanner orchestrateur existant, après commit, appelle sous **session_user
control_dispatcher** `control.reserve_t06_wakeup` : même transport moteur
`agency.provisioning-wakeup`, version/attempt/génération durables et dédoublonnage
existants. Le scanner périodique30s retrouve l’opération même après restart :
202 signifie reprise enregistrée, pas wakeup déjà publié. Aucun appel synchrone
au dispatcher sous verrous humains, aucun octroi de sa fonction au coordinator,
aucun nouvel événement interprété comme creation-accepted ni nouvelle CREATE.
Pas de remise à zéro attempt/generation, pas de second wakeup concurrent avec
le scheduler T06. L’outbox de reprise est ainsi réservée après commit par le
mécanisme T06 existant ; elle n’est pas prétendue atomique avec la commande humaine.

## Capacités SQL et transport

Profil central T07 non-login, sans ownership/DDL/superuser/grant option, SET
explicite par coordinator seulement. SELECT ciblés (source invitation/agency/op/
locator/effects/executions/idem/membership) ; UPDATE colonnes agency state/version/
activated_at, membership state/version, opération state existant via status/step/
version/error/retryable strictement nécessaire ; INSERT idem. Audit/outbox passent
par control_audit, pas privilège UPDATE/DELETE audit. Ajouter seulement capacités
minimum de locks nécessaires, assertions exactes et tests pg réels ; pas élargir
control_t05/control_api/control_t06 silencieusement. Bootstrap/grants sans
modifier le SQL/checksum T02 ; si un nouveau schéma s’avère indispensable, arrêt
et amendement revu avant implémentation.

La projection locale reste privée côté provisioner ; credentials migration
restent confinés à ce processus déjà privilégié, jamais à l’API/BFF/worker. Les
handlers n’acceptent pas de DSN, nom de base, rôle ou secretRef client. Transport
privé contrôle mTLS et entrées strictes avant lecture. Réutiliser vérifications
propriété/ACL/secret du socle, budgets pools4×2/timeouts2s/5s et budget global≤80 ;
aucun pool permanent supplémentaire par agence.

## Risques, observabilité et validations

Courses revoke/activate, changement compte, expiration pendant readback, coupures
locales/centrales et rejeu doivent être prouvés en PG/processus réels (Plan).
Métriques minimisées : demandes/refus/conflits, préparations sans commit, âge des
projections non confirmées, pannes J1/audit et latences ; logs event/correlation/
version uniquement. Objectif GET/activation nominale<2s sur setup local, erreurs
bornées par timeouts ; ce n’est pas un SLA ni un résultat mesuré.
Rollback : désactiver nouveaux octrois/handlers et drainer émetteurs, compatibilité
source avant retour de version, garder ACTIVE central acquis et J1/audit/outbox/
réservations/ressources. Aucune migration down, DROP, reset ou réactivation de
fonction IA. N3 et D57 restent inchangés.

## Design Gate

- [x] AC1–4 et états/erreurs/reprise représentés ; UI T08 distincte.
- [x] Auth/J1/isolation/audit/atomicité/idempotence et rollback explicites.
- [x] Contrats existants conservés, aucun choix architecture rouvert.
- [x] Revue indépendante PASS après corrections retry et autorisation mTLS.

Verdict : PASS ; [revue indépendante](design-review.md), passage à Plan permis.

## Addendum de reprise hôte — 18 octobre 2026

L’implémentation a révélé deux limites de l’outil de réconciliation hérité :
provenance T07 absente et identité d’instance tmpfs perdue après un readback
refusé. [Recovery](recovery.md) documente le protocole amendé, ses revues et les
preuves réelles. Aucune capacité de récupération n’est montée dans l’API.

La preuve d’arrêt exact est fsyncée avant readback; une reprise d’un conteneur
arrêté exige cette preuve privée (scope/instance/conteneur/StartedAt/intégrité).
L’ancienne exécution a été liée à sa trace hôte réelle et à l’inventaire courant
du namespace privilégié, sans reconstruire une identité par redémarrage.
Une base migrée fermée n’est inspectable qu’après fencing, droits PUBLIC/runtime
fermés et aucun CONNECT hors propriétaire migration : ouverture temporaire pour
une transaction READ ONLY puis fermeture vérifiée. Un hôte tué brutalement peut
interrompre finally : le gate reste BLOCKED, contrôle/fermeture requis avant
reprise. Les valeurs, clés, schémas, effets, compteurs et migrations sont retenus.
