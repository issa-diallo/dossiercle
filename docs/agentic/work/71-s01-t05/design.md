# Design — #71 / T05 Invitations propriétaire et création durable

## Statut et entrées

`DESIGN: PASS` — 2026-10-14 après [revue et revalidation indépendantes](design-review.md).
[Research PASS](research.md),
[revue](research-review.md), [ticket](https://github.com/issa-diallo/dossiercle/issues/71),
[Design S01](../S01/design.md), [Plan T05 historique](../S01/plan.md#t05--invitations-propriétaire-et-création-durable),
Architecture D04/D05/D40/D54/D75/D81, ADR002/004/024/025/029 et
[ADR030 de cette préparation](../../../adr/030-t05-invitation-preuve-transaction.md).
Mode LARGE. Cet artefact précise les gaps du code fusionné ; les nouveaux choix
ne sont pas des preuves runtime. Arrêt de mission après Plan revu et prompt.

## Parcours et interfaces

```text
Confirmation humaine privée signée → références UUID appariées
→ owner fort : réservation PENDING_IDENTITY durable (TXA)
→ préparation IdP sur UUID réservés et J1 PENDING (TXB)
→ issue unique → parcours natif T04 → reçu serveur avec BFF fort
→ claim propre → création durable PROVISIONING / ADMIN PENDING / ACCEPTED
→ GET onboarding propre pour retrouver la même opération
```

API backend uniquement ; la SPA complète reste T08. Le fragment d’invitation est
effacé par le pont natif existant ; aucune nouvelle UI password/TOTP. Les erreurs
gardent le format traduit par code du Design System. Tests navigateur s’appuient
sur les UI natives maintenues. Pas de nouvelle exigence responsive/a11y ici ;
accessibilité de la SPA demeure à qualifier T08.

## Preuve humaine privée

Décision : registre privé **signé Ed25519**, dans la table existante
`control.idempotency_record`, sous deux operation_type dédiés
`platform.owner-confirmation.v1` et `platform.owner-channel.v1`.
Cette table n’est jamais exposée génériquement par API. INSERT seulement ; pas
UPDATE/DELETE des attestations. La signature distingue l’enregistrement par
procédure privée d’une ligne forgée par un rôle SQL capable d’INSERT idem.

Commande `scripts/s01-owner-confirmation.ts` : environnement synthétique identifié,
Unix owner nonroot, origine/config propriétaire vérifiées. Lire le contact par
stdin privé, jamais argument shell ni stdout. La commande enregistre une
**attestation humaine** explicite `--human-confirmed`, sans prétendre effectuer
elle-même la vérification d’identité ; les tests emploient `--synthetic-fixture`
avec provenance marquée, refusée hors configuration synthétique.
Elle n’appelle ni Keycloak ni PI, ne crée pas de password et n’émet aucun grant.

Payload signé version1 strict : ownerSubject configuré, identityConfirmationRef,
recoveryChannelRef UUID distincts et appariés, invitationId/rootId/subjectId et
technicalUsername **égal subjectId** UUID réservé serveur (invariant du pont natif),
empreinte SHA256 du contact canonique,
confirmedAt/expiresAt UTC, provenance human/synthetic-fixture, fingerprint de clé.
Durée choisie **24h** pour initier/préparer/émettre ; le grant conserve ses10min.
Pas de pièce, URL, texte libre de canal, contact brut ou secret dans ce payload.
L’enregistrement du canal signifie référence d’une procédure privée confirmée,
jamais preuve par simple possession d’un email. Les deux lignes signées sont
insérées dans la même transaction avec actor owner et resource racine.

Clé privée de signature400 en tmpfs réservé à la procédure owner, **non montée**
dans le coordinateur ; celui-ci reçoit seulement la clé publique RO et son
empreinte attendue. Initialisation unique lors du setup frais ; marqueur/keypair
manquant sur environnement retenu = refus, sans régénération ni rotation implicite.
Node24 crypto natif, pas de nouvelle dépendance. Un coordinator compromis garde
ses capacités d’identité existantes ; la signature ne prétend pas le sandboxer.

API crée avec email + deux refs seulement : vérifie signature, paire, owner,
contact canonique, provenance, dates et UUID réservés ; tous IDs viennent du
record signé, jamais du body public. Première consommation liée au même root
via invitation et idem atomiques ; un autre key ne réserve aucun second sujet.
Le sujet invité est distinct du owner configuré ; preuve auto-ciblée refusée.
Reconfirmation privée d’une invitation existante reprend ses UUID après contrôle
owner/contact, produit nouvelles refs signées et un reçu immuable de liaison.
La liaison courante est lue sous verrou racine ; aucune ancienne ref expirée
ne réautorise un nouvel effet. L’API n’ajoute aucun endpoint de récupération réelle.

## Profils SQL et transaction unique

Ajouter au bootstrap privé un rôle **NOLOGIN `control_t05`**, non-owner,
NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOBYPASSRLS. Membership pour
`control_coordinator` avec INHERIT FALSE, SET TRUE, sans ADMIN. Jamais vers
control_migrator ; control_api ne reçoit aucune capacité d’autorité supplémentaire.
Pas de nouvelle table/fonction/migration de schéma ; 0001–0003 restent immuables.
Les rôles/memberships sont appliqués par bootstrap privé identifié, les droits
d’objets par le migrator propriétaire des schémas. Rejeu avec vérification ACL.

Permissions T05 : USAGE/SELECT nécessaires, INSERT par colonnes seulement :
- invitation : id/root/subject/contact/owner/recovery_channel_ref ; defaults PENDING ;
- agency : id/invitation_root_id/name/canonical_name_hash ; default PROVISIONING ;
- membership : subject_id/agency_id/role ADMIN ; default PENDING ;
- operation : id/agency_id ; defaults ACCEPTED/PENDING ;
- idem : INSERT, pas UPDATE ; états de reprise par reçus immuables distincts.
UPDATE invitation seulement token_hash/expires_at/status/version. Aucune mutation
authority/session, agency ACTIVE, locator, operation ou membership par ce rôle.
Audit/outbox passent par le rôle INSERT dédié existant.

Le processus privé habilité utilise **une connexion coordinator** pour auth/J1,
puis `SET LOCAL ROLE control_t05` pour les mutations contrôle nécessaires.
C’est une séparation de profils SQL dans le même processus, pas une séparation
de processus. Les credentials natifs demeurent dans adapters privés.
`writeAudit` capture le rôle courant, le valide par allowlist et le restaure
explicitement après son switch ; RESET ROLE seul réactiverait coordinator.
Tout échec entraîne rollback, aucune query métier après échec audit.

## Ordre des verrous et sessions

Avant le premier append J1, le wrapper transactionnel T05 :
1. Lit le cookie opaque/ligne session pour construire un contexte candidat serveur,
   jamais une autorisation ; le préfiltre owner concerne seulement routes platform
   et TXB. Claim/création préfiltrent scope onboarding et racine propre, jamais owner.
2. Sérialise la réservation d’une racine absente par advisory lock dédié `t05.root`.
3. Verrouille **toutes** invitations concernées par root UUID canonique croissant,
   avec FOR UPDATE dès l’entrée des mutations invitation, notamment claim.
4. Dans TXB seulement, insère si absente l’autorité invitée PENDING sous sa racine.
5. Verrouille toutes autorités owner/invité par sujet UUID croissant, puis sessions
   et projections agence/membership nécessaires ; compare J1/epochs/scopes/natif.
6. Vérifie Origin/CSRF, fait le refresh humain courant et les appends J1 ; mutations
   sous profil T05, audit/idem/outbox et commit sur **la même connexion**.

Ne jamais acquérir une seconde racine/autorité après le verrou J1 global ni attendre
un second pool qui doit append J1 depuis ce callback. Pas de promotion SHARE→UPDATE.
Préverrouillage accepté par AuthService via une voie interne typée, sans `sub/root`
public. Les locks préacquis sont revérifiés, pas un booléen trusted fourni au client.
T04 reste compatible : enrollment, logout, native-change et scope sont inclus dans
les tests du graphe ; conserver le DENIED natif durable avant commit/refus.
Lire/prendre idempotence **après** autorisation actuelle, et vérifier replay avant
If-Match. Rate-limit avant verrous, attente lock/connexion et I/O natives bornées.

## Invitation en phases durables

**TXA** : owner fort/current + preuve signée → réserve invitation PENDING_IDENTITY,
UUID stables et résultat idem minimal ; audit et intention outbox dans même commit.
Pas d’effet IdP avant cette durabilité. Nouvelle clé/mêmes refs retrouve la racine.
Même clé/body différent409. API202 seulement après TXA commit.

**TXB** : préparation privée T05, appelée après TXA hors callback transactionnel,
revalide owner courant et preuve, préverrouille owner/invité, initialise autorité
invitée PENDING/J1 fsync avant import. `createUser` importe UUID exact et readback
contact/root/username ; réponse perdue/409 : reprise relit UUID avant toute nouvelle
tentative. Timeout ne vaut jamais succès. Met identity_status CONFIRMED après
readback ; **autorité invitée demeure PENDING jusqu’à MFA T04**. Pas de CLAIMED.
Une panne SQL après fsync laisse J1 opposable. Reprise confronte head/commande,
aucun nouvel epoch arbitraire ni restoration CONFIRMED.
Un échec natif avec connexion PG encore saine se consigne comme préparation
incertaine : COMMIT des projections PENDING et de l’owner refresh, sans octroi,
puis réponse d’acceptation réservée. Une panne SQL/connexion ne permet pas cette
convergence : refus fermé et récupération privée explicite, pas réécriture aveugle
des projections depuis une ancienne sauvegarde. Tester ces deux branches séparément.

Le handler peut tenter TXB après TXA et avant réponse, mais une panne laisse la
réservation durable PENDING ;202 décrit l’acceptation, pas readiness IdP. Replay
owner autorisé relance/reconcilie la même commande, GET n’exécute aucun effet.
Pas de background non durable ni nouveau moteur de jobs ; T05 ne démarre pas T06.

**Issue** : owner actuel, preuve valide, préparation identité et J1 attendus, mêmes
UUID. Token32octets/hash, TTL10min, version+1/audit/idem atomiques ; lien seulement
après commit et une fois en mémoire réponse. Perte réponse → replay état sans lien ;
réémission explicite nouvelle clé/version, anciens grants/receipts invalidés.
Reissue d’une invitation CLAIMED sans ACTIVE garde sa racine/agence ; nouvelle MFA
et claim requis. Après ACTIVE, reissue/revoke T05 refus409, hors gouvernance S01.
Toute réémission d’une autorité CONFIRMED/ancienne version commence sous les mêmes
préverrous par **nouvel epoch et J1 PENDING fsync**, puis autorité/enrollment PENDING,
confirmed_epoch NULL/recovery_ready false et révocation des anciennes sessions.
Ne pas effacer arbitrairement les facteurs natifs : les relire/reconfirmer avec MFA.
Le nouveau token/version ISSUED n’est committé qu’après convergence PENDING ;
EnrollmentCoordinator.lock attend précisément cet état. En cas d’échec, aucun lien
ni epoch restauré. identity_status reste CONFIRMED seulement si identité native
subject/contact/root actuelle relue et conforme ; sinon préparation ferme.
États sources : premier issue PENDING_IDENTITY préparé ; réémission ISSUED,
EXPIRED ou CLAIMED avant ACTIVE uniquement, avec preuve privée actuelle.
REVOKED est terminal dans T05 : issue/replay/retry ne le réanime pas. La récupération
totale D05 et la gouvernance après ACTIVE restent hors tranche. Chaque commande
reissue possède un UUID stable enregistré avant son premier fsync ; reprise de la
même commande réutilise epoch/version réservés après confrontation J1, et ne les
incrémente pas une seconde fois après perte de réponse/commit.

**Revoke** : invitation exclusive puis autorités ; PENDING/deny + epoch supérieur
fsync précèdent effets natifs/PG ; sessions et droits fermés ; statut REVOKED,
token retiré/version+1, audit/idem atomiques.200 uniquement convergence complète.
Entre fsync et commit échoué :503, head ferme même snapshot SQL ancien. Commande
stable immuable reprise, aucun grant issu avant reconfirmation explicite.

## Claim et continuité serveur — amendement contractuel explicite

Le contrat obligatoire `{token}` du Design S01 n’est pas exploitable après le
callback qui efface les secrets. **Extension compatible retenue : union stricte
`{}` ou `{token}`**, dans DTO et OpenAPI. La branche `{}` utilise le reçu serveur.
La branche legacy vérifie également ce reçu et le hash du token de cette version ;
elle ne permet jamais d’admettre un token arbitraire ni de contourner la MFA.

Au callback T04, écrire un reçu immuable `identity.onboarding-receipt.v1` dans
idem dans **la même transaction que la session forte** : actor sujet, key dérivée
UUID du cookieHash avec domaine dédié, resource racine, résultat minimal
cookieHash/subject/root/version/epoch/tokenHash/admissionReceipt/issuedAt.
La clé dérivée n’est pas une capacité ; comparer tous champs, pas seulement UUID.
Receipt issu uniquement du grant vivant confirmé et de son admission durable.
Ne conserver/rendre aucun token brut ; aucune donnée secrète GET/browserStorage.
Sessions T04 anciennes sans receipt continuent auth mais ne peuvent claim T05 ;
nouvelle MFA sur réémission owner nécessaire, pas auto-upgrade.

Claim prend invitation FOR UPDATE avant autorité/session, vérifie scope onboarding,
sujet/root et receipt current ; TTL requis au premier claim. ISSUED→CLAIMED + audit
atomiques. Rejeu même sujet/root déjà CLAIMED renvoie contexte courant sans second
audit ; expiration du token consommé ne détruit pas une création CLAIMED, mais
version/epoch/session courants et absence de révocation restent requis.

## Création et reprises

Sujet invité fort, root serveur CLAIMED courant, preuve native/J1 sous verrous.
Normalize name NFC+trim, caractères de contrôle refusés, hash canonique.
Transaction unique agence PROVISIONING, ADMIN PENDING, opération ACCEPTED/PENDING,
audit + outbox + idem ; aucune mutation statut invitation après J1 nécessitant
un nouveau lock. Root UNIQUE et operation UNIQUE font autorité, pas nom/email.
Même key/body → projection courante ; différent body409 IDEMPOTENCY_CONFLICT.
Nouvelle key/même root/name → même ressource ; autre name409 CREATION_CONFLICT.
GET onboarding propre retourne204 sans création ou même AgencyAccepted, toujours
no-store, aucune prolongation idle sur GET. Pas de provisioning automatique.

## HTTP et états

Routes conformes Design S01 : POST/GET invitations, POST issue/revoke, POST claim,
POST agencies, GET onboarding/agency. Headers/body exacts, idempotency UUID,
If-Match ETag fort issue/revoke, JSON strict32Kio, ambiguïtés/duplicats refusés.
Passage middleware vers Nest seulement pour ces routes/méthodes validées ; ne pas
ouvrir tout `/v1/**`. Proxies natifs gardent leur parsing/bodyParser:false.
Erreurs400/401/403/404/409/429/503 minimisées, corrélation UUID, no-store.
Owner GET ne retourne ni contact, refs de preuve, lien, hash, secret ni détail IdP.
Non-owner/ressource étrangère : refus indistinguable prévu par Design S01.
Rate-limit : mutation T05 max10/min par session forte, max60/min par IP loopback
pour entrées avant auth ; au plus100 clés actives par bucket, durée60s et refus
fermé si capacité saturée. Retry-After sûr ; limites non revendiquées production.

## Environnement et gates

Setup futur accepte le couple legacy T04 pour CI existante et le couple exact
`feat/71-s01-t05` / `71-s01-t05` dans un vrai worktree Git lié ; autres couples,
main/detached, racine déplacée/namespace/env étrangers refusés avant mutation.
Pas de généralisation permissive des branches. Namespace/ports/CA/DB/secrets
propres au root, secrets nonroot400/RO, pas copie de `.local`/credentials T04.
Adapter cold setup, --check et CI au ticket71 ; décrire commandes et coût limité
aux fixtures locales. Le bootstrap Git ne vaut pas gate applicatif Setup.

## Design Gate

- [x] Huit AC et états/remises en état représentés, pas ACTIVE ni T06.
- [x] Preuve/receipt/locks/profils SQL/API/setup définis ; choix stack conservés.
- [x] Exposition minimale, confirmation humaine, J1/deny et limites documentés.
- [x] Revue indépendante reçue ; reissue/username/préfiltre corrigés et revalidés.

Verdict : **PASS** documentaire ; aucune implémentation/runtime exécutée.


## Addendum Execute — décisions métier avant refresh (2026-10-15)

Ajustement d’implémentation soumis à revue indépendante du graphe avant exposition.
L’étape6 du wrapper est précisée : après prélocks, autorité/J1 courant, session,
scope/epoch, Origin/CSRF et contrôle natif (dont DENIED durable), un hook privé
`T05LockPlan<Decision>.validate` lit uniquement la connexion déjà verrouillée et
retourne une décision typée immuable au callback. Aucun appel IdP, pool, transaction,
audit, mutation SQL ou append J1 dans ce hook. Les erreurs métier attendues (version,
idempotency/body/name, preuve, receipt/token/TTL) sont décidées avant le refresh.
Puis refresh courant/J1 et mutations utilisent la même connexion et les snapshots
validés sous les mêmes verrous, sans nouvelle acquisition root/authority.

Motif observé : lever un409 attendu après le refresh aurait annulé sa projection SQL
sans annuler J1 déjà fsync, fermant la session légitime. Le refus normal avant append
préserve J1, idle et tokens ; la même session peut corriger/rejouer. Les défaillances
réelles après append (refresh, SQL/audit, IdP incertain non couvert par TXB) restent
fermées conformément à J1. Le deny natif se commit avant refus et avant ce hook.
Le contrôle pré-refresh porte la décision d’admission temporelle pour la commande
sous locks ; il n’est pas une autorisation réutilisable hors de cette transaction.
Aucun changement de fournisseur, contrat public, migration ou scope T05.
