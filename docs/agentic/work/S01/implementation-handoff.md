# Handoff d’implémentation — S01

Mission Worktree Setup → Execute → Verify → Review autorisée le 2026-10-11.
Derniers PASS : Research, Design revue3, Plan revue2. Worktree Setup T00 PASS, revue indépendante3 PASS. Phase courante Execute T04.
Base 075602916355813cf4e8d3f952fadaec5e637398, branche feat/s01-espace-isole.
Worktree /home/issa/Workspace/perso/dossiercle/worktrees/s01-espace-isole.
Préparation et suivi préexistants copiés à l’identique, originaux préservés.
Aucun code produit préexistant, aucun fait nouveau invalidant les gates documentaires.
Node PATH22 global conservé ; Node24.21.0 isolé opérationnel.
Docker28.0.1/Compose2.33.1 disponibles ; services préexistants laissés intacts.
Distributions exactes/digests et sources T00 dans infra/local/versions.json.
Goal distinct : implementation-goal.md. Aucun Execute/Verify applicatif ni Ship PASS.

## Execute T01
Socle monorepo/contrats stricts/OpenAPI14 opérations livrés ; V1=13 tests,
V4=4 tests, V6 type/lint/builds séparés PASS réels. Preuves t01-checks.json.
596 packages lock comparés SRI registre ; scripts lifecycle interdits.
Première install cache global par défaut : additions de cache uniquement,
aucun secret/service réel ; corrigé en store .local/pnpm-store et modules issus
première installation préservés .local/first-install, aucun effacement utilisateur.
Compagnon skill typescript-best-practices non présent dans les racines ; conventions
TypeScript strictes DEVELOPMENT et React appliquées, aucune installation de skill.
Prochaine tâche T02 : schémas Drizzle/migrations/tests PG réels.

## Execute T02
Schémas Drizzle et SQL générés/lus, migration centrale appliquée/rejouée réellement,
12 tests PostgreSQL + builds PASS. Revue indépendante corrective T02 PASS, Major
schéma partiel corrigé par empreinte physique et contrôle ACL PUBLIC ; enums/hash/racine renforcés.
Preuves evidence/t02-checks.json. Expériences fixtures v1-v3 conservées, jamais adoptées
à tort ni supprimées ; version v4 utilisée pour les preuves finales.
Prochaine tâche T03 : J1 courant/audit/outbox et verrous réels.
Qualification T04 : Gunicorn23 ne transmet pas REMOTE_USER CGI ; option fournisseur
NGINX+uWSGI à figer/tester, aucun contournement ni PASS MFA à ce stade.

## Execute T03
PASS storage/J1/audit/outbox après revue corrective indépendante. 24 unitaires,
22 tests PG/serviteur Inngest réels (12+10), build PASS. t03-checks.json corrigé avant gate.
Fonction SQL lock_authority sécurisée et dispatcher dédié ; tests vrais comptes
control_api/coordinator/dispatcher. Aucun privilège migration pour runtime.
0001 appliquée conservée ;0002 corrige step et ajoute capacité de verrou, application schema1.
J1 format2 acteur/type/UTC, anciens essais format1 conservés.
Inngest reçoit doublons mêmeeventid : dédup effets obligatoire T06, aucune garantie exactlyonce.
Prochaine tâche T04 MFA natif/BFF/ingress ; aucun ACTIVE avant V3 réel PASS.

## Execute T04 — qualification native partielle
Scripts identity/PI disponibles et exécutés, KC HTTPS natif/resolver TLS vérifié,
clients/services/flow natifs configurés, UI précédente sélectionnée explicitement
pour3.14 après revue documentaire indépendante ; retrait en version suivante annoncé.
Adapters identity et transportTLS typechecked/buildés ;3 tests natifs réels PASS,
25 intégrations globales et build PASS (evidence/t04-native-config.json).
T04 EN_COURS : BFF, grant d'enrôlement, navigateur/MFA/V3 non acquis. Aucun ACTIVE.
Secrets natifs perdus ou admin sans marqueur ferment la reprise pour réconciliation,
aucune rotation implicite ; fixtures natives des essais échoués conservées.

### Avancement T04 après corrections du pont
34 intégrations réellement PASS (12+22), dont4 primitives natives,5 grants PG et
2 ponts natifs ; admission durable et JWT natif lié au grant, locks pendant mutations.
Revue indépendante ciblée corrective PASS, deux Major et un Minor fermés.
Entrée publique conserve503 : aucun parcours MFA complet exposé/qualifié.
V0 rejoué réellement ; CA mTLS dédiée/tmpfs, pont9443 privé, sans port hôte.
Paramètres natifs testés :6chiffres/SHA1/pas30s/fenêtre30s ; authority PENDING.
À poursuivre : coordinateur natif login-actions sous grant/verrous/J1, handoff
entre origines127.0.0.1/localhost, state/nonce/PKCE à usage unique, callback
confirmant preuves et session chiffrée, backchannel/logout, V3 navigateur réel.
Puis T05…T10 dans ordre Plan. Pas de commit/PR/Ship/cleanup.

### Dernière qualification partielle T04
38 intégrations PASS, dont8 grants avec perte réelle de connexion PG et expiration
pendant mutation. Builds/types/lint PASS et dernier setup V0 réellement rejoué.
Profil identity-runtime : coordinateur privé TLS, huitième service, montages
minimaux ; entrée localhost PI seule, métier/Keycloak publics encore fermés.
Firefox réel avec CA dans profil NSS isolé : premier OTP dans UI PI et preuve
native enrolled PASS ; JWT natif en clair absent des stockages navigateur.
Graine synthétique uniquement RAM/stdin outil oath figé, aucune capture DOM/QR.
État avant correction : essais navigateur non répétables et cause non établie.
Aucun PASS global MFA/Verify/Review à cette étape.
Revue ciblée indépendante PASS_WITH_MINOR : documentation obsolète corrigée.
Reste password/secours/Code/session forte/owner et matrice V3, avant T05.

### Fichiers techniques de support au Plan
Le Plan énumère des chemins métier mais leur exécution exige aussi des modules
techniques dédiés. Écart explicite, préparation inchangée : runtime-pool, transport
TLS natif, session-cipher, enrollment-coordinator/proxy, oidc-flow, backchannel,
identity-coordinator/server et scripts identity/PI/transport/coordinator setup ;
leurs tests ciblés et fixture OTP privée isolent les frontières de sécurité.
La migration0002 conserve0001 appliquée et corrige les capacités runtime ; les
exports/configs de packages et index nécessaires rendent les commandes réelles.
Ces fichiers supportent les contrats validés, sans feature/stack/fallback nouveau.

Résultats pré-correction : repeat3 exit1 (1PASS/2FAIL à initialisation), puis
repeat2 exit0 (2PASS), avant que la cause soit établie. Ces constats sont
supersédés par la policy native TOTP et le repeat5 5/5 PASS ci-dessous.

Correction intermittence UI : native `default_tokentype=totp`, readback exact du
policy, attente de la sélection TOTP côté Firefox avant POST. Rejeu5/5 PASS après
correction ; échecs antérieurs gardés dans evidence comme essais pré-correctif.
Cette amélioration ferme le premier OTP seulement, pas le gate MFA/V3 global.

Revue corrective ciblée2 : PASS_WITH_MINOR, zéro Critical/Major sur policy native
webui et garde de test (evidence/t04-native-review-2.md). Cause HOTP initiale
présentée comme plausible, non démontrée pour chaque ancien échec. Aucun MFA global.
V0 replay complet après correction setup : base services healthy, migrations
checksum inchangé et politiques natives relues. Build complet après correction PASS.

### Blocage courant après reprise — 2026-10-12
Le test Firefox synthétique poursuit maintenant le parcours jusqu’au challenge
Keycloak/privacyIDEA. Mot de passe, enrôlement PI, preuve d’enrollment et actions
de récupération Keycloak passent. Le provider rejette `wrong otp value` avec un
TOTP généré après deux périodes complètes ; aucun callback OIDC/session BFF n’est
atteint. Valeurs d’accès et codes non divulgués ; contexte Playwright généré
automatiquement retiré, page nettoyée avant erreur. Reproduction/verdict dans
`evidence/t04-mfa-blocker.md`. T04 BLOCKED, T05–T10 bloqués, Verify/Review globaux
non atteints. Le diagnostic reste au sein du contrat ADR-029/ARCHITECTURE_OTP ;
aucun fallback ni changement architectural n’est autorisé par cette preuve.

### Reprise et corrections — 2026-10-12
Logout utilise maintenant une transaction acceptant une invitation ISSUED confirmée,
avec Origin/CSRF et révocation avant réponse. Test unitaire synthétique ciblé :
PASS ; il ne remplace pas une qualification native. Le reverse proxy ferme le POST
Keycloak `required-action` (403) jusqu’à disponibilité du pont grant-aware sous J1.
Le parcours Firefox TLS confirme le blocage 400/403 des variantes et la liaison OIDC issuer/callback avec
cookie Lax après redémarrage du coordinateur. Validation : unitaires34/34,
typecheck/lint/build complets PASS, navigateur2/2 PASS.

La revue corrective indépendante ciblée est PASS (`evidence/t04-corrective-review.md`),
sans Critical/Major/Minor ouvert sur le delta. Le parcours antérieur
password/secours passait par un accès direct qui contournait grant/J1 ; il ne vaut
pas preuve de conformité. Le TOTP synthétique frais a été refusé avant callback,
cause indéterminée. T04 BLOCKED, T05–T10 non démarrés, Verify globale non commencée,
aucun ACTIVE. Voir `execute.md` et `evidence/t04-mfa-blocker.md`.

## Mandat de livraison T04 repris

Le mandat courant et les preuves actualisées sont dans [t04-delivery-handoff.md](t04-delivery-handoff.md). Les blocages et essais ci-dessus restent historiques. Aucun PASS V3 ou merge à ce checkpoint.
