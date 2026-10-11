# B07 — résolution documentaire du chiffrement TOTP

2026-10-11, suite issue#63/PR#64. Demande humaine : « trouve la solution puisse
passe l’architecture en PASS ». Mode LARGE sécurité. Recherche fournisseur/code
publié seulement ; aucune installation, POC, benchmark, cloud ni donnée réelle.
Décision D81/[ADR-029](../adr/029-keycloak-privacyidea-totp-chiffre.md).

## Solution retenue et preuves N1

Keycloak conserve identités, mots de passe hashés, OIDC et sessions ; privacyIDEA
3.14 stocke/valide les TOTP à travers provider officiel 1.8.0. Serveur MFA maintenu
par le projet/NetKnights, releases publiques ; support payant facultatif non acquis.
Le serveur chiffre les secrets TOTP avec AES256 ; `PI_ENCFILE` désigne les clés externes
au store SQL. Cela satisfait la confidentialité D54 contre lecture/dump SQL ;
AES256CBC n’est pas une garantie d’intégrité contre écriture SQL malveillante.
La compromission PI/Keycloak/VM ou du coffre reste un risque distinct.

PrivacyIDEA est un service central technique, pas une DB métier partagée. Conteneur
privé Docker/Compose mutualisé, DB `privacyidea` et rôle PG 17 distincts des bases
agences/Keycloak/Inngest. Aucun Kubernetes, HSM ou licence support achetés. PI ne
reçoit ni dossiers, ni mails, ni documents métier. NestJS reste autorité R01.

Provider1.8.0 publié01/07/2026, client Java 1.5.1 et compilation Keycloak 26.5.6,
Java 17, avec SPI privés. Famille26 documentée, endpoints OIDC/API et types
credentials de26.8 lus ; **aucun test ni garantie binaire26.8**. Retenir26.8 comme
candidat actuel sans redescendre silencieusement une version ; Plan fige les
versions correctives/digests, Verify qualifie ce triplet. Une incompatibilité
réelle rouvre Architecture ; une application non construite n’est pas une preuve
indispensable pour sélectionner ce moteur existant.

## Clés, sauvegarde et rotation

Secrets natifs PI : `PI_ENCFILE` (96 octets, trois clés256bits), `SECRET_KEY`,
`PI_PEPPER`, clés de signature audit ; production distincte du synthétique.
ENCKEY dans Secret Manager Paris avec IAM limité au runtime PI ; injection TLS
à un fichier tmpfs 0400 propriétaire UIDPI, montage lecture seule. Pas clés dans
PG, image, dépôt, env imprimée, logs, dumps ou backup VM. Le bootstrap IAM suit
D73/D74 ; administrateur DB seul n’a pas accès au coffre. Le partageVM n’est pas
une isolation contre root : durcissement conteneurs/hôte et accès propriétaire.

Backups DB chiffrés côté client selon D75 ; sauvegarde des clés séparée dans
périmètre IAM/coffre distinct, avec version/date, restauration autorisée humainement.
**Ne pas utiliser tel quel le backupDocker PI regroupant clés et DB.** Aucun
bundle export, dump/configuration ou rapport diagnostic ne contient ENCKEY.
Manifest des sauvegardes référence seulement version de clé et schemaPI.
Conserver les versions capables de déchiffrer les points restaurables30jours et
les restaurations en cours ; après migration/expiry vérifiée, destruction humaine.

Rotation au plus 90 jours, sur incident et changement d’accès, propriétaire responsable.
Procédure fournisseur offline : geler validation/enrôlement/mutations PI, invalider
sessions selon incident, checkpoint+manifest, export `privacyidea-token-janitor`
vers tmpfs privé, réimport/update avec nouvelle clé, contrôler toutes les sorties
et nombres/assignations/types/counters, test canari puis reprise humaine. Export
contient les secrets TOTP en clair : aucun disque/swap/core dump/traces shell/log/backup,
RAM isolée, privilèges minimaux, nettoyage sur succès ET échec. Configuration
resolver secrète traitée séparément, car la procédure token ne la rechiffre pas.
Rotation de clé de stockage ne remplace pas un secret compromis : révoquer et
réenrôler les facteurs concernés, session/epochs/validations invalidées.

Après restore PI/Keycloak/app : appliquer J1 avant login/droits métier, invalider
sessions, replay tombstones/revocations/enrollment changes, vérifier UUID/facteurs,
manifest/versionsclés et usageunique secours. Aucune réussite OTP restaurée ne
réactive un droit. Le coordinateur D75 couvre désormais PI autant que Keycloak :
PENDING durable/deny epoch avant mutation, confirmation après effets observés,
incertitude fermée. Sans clé ou résultat ambigu, pas réouverture TOTP. Tests PRA
incluent ce store et la récupération des clés dans RPO/RTO<4h, non démontrés.

## Contrat MFA et enrôlement

Realm Keycloak plateforme central, invitations seulement. Login par mot de passe
natif Keycloak, puis sousflux MFA **REQUIRED** avec privacyIDEA TOTP ou recovery
code natif en alternatives ; aucune condition « user has OTP » qui sauterait le
MFA des nouveaux comptes. Retirer OTP Form/Configure OTP natifs, y compris console
et AccountConsole ; aucune création de secret TOTP brut dans Keycloak.

Secours natifs26.8 hashés et consommés, leur action de génération n’exige pas
credential OTP natif. Création obligatoire et régénération après authentification forte selon
D05 ; concurrence/uniqueness à prouverN2. La réussite d’un secours est le parcours
second facteur autorisé, pas un bypass password. Tous les clients/grants, consoles,
resetcredentials et callbacks suivent cette exigence ; direct grants/offline
access, authentificationpasswordless et IdPexternes non utilisés désactivés.

Provider `configuredFor=true`, `requiresUser=false`, pas required action d’enrôlement :
**il ne garantit pas l’enrôlement**. Compte invité reste en état métier PENDING
jusqu’à password vérifié, TOTP initial confirmé et secours générés. Sousparcours
invitation/réenrôlement vers UI/API PI maintenue, session limitée à l’enrôlement,
pas accès aux dossiers/effets, URL/secret d’authentification temporaires expirant 10 min. Le
propriétaire autorise bootstrap/récupération totale avec contrôles D05 ; aucune
auto-enrollment par absence de token ni activation au seul scan du QRcode.
`verify_enrollment` exige preuve du premier OTP. Enrôlement privé/authentifié,
CSRF, no-store, aucune secret dans analytics/logs ; selfservice hors coordinateur
interdit. Aucun écran d’authentification ni calculTOTP maison ne sont construits.

Identité PI : resolver Keycloak/HTTP maintenu, username exact → UUID `id`, avec
realm et resolver fixes. Username technique immuable et jamais réattribué après
suppression ; email seulement attribut de contact. Le resolver lit `view-users`
(et query-users si exigé par version), jamais `manage-users`. Authresolver
**client_credentials**, request mapping configurable HTTP ; remplacer son défaut
ROPC/admin-cli et désactiver userpassword check côté resolver. Pas de mot de passe
utilisateur transmis à PI, Keycloak valide lui-même. Ne pas créer de nouveaux
comptes par lookup ambigu ; suppression/invitation/assignment journalisées.

Paramètres provider : VerifySSL=true ; Included/Excludedgroups vides ; SendPassword,
SendStaticPassword, TriggerChallenge, passkey/push/Entra non activés ; DisablePasswordCheck=false.
PI : TOTP seul pour parcours normal, otppin=none (premier facteur déjà Keycloak),
pas auth_cache, passthru, passOnNoToken/passOnNoUser ou validation permissive.
OTP incorrect, compte absent, absence de token, TLS/PI/PG/coffre indisponible =
refus/compte PENDING, jamais succès par défaut. Fenêtre/counters, throttling,
verrouillageprogressif, non-rejeu et concurrence à qualifier N2. Pas loggingdebug.

## Protection du parcours OpenID du provider

Le code1.8 peut traiter `scope`/`id_token_hint` POST et changer context.user ; la
signature n’est contrôlée que pour l’issuer Microsoft reconnu. Ce comportement
est hors périmètre V1, **désactivé par fermeture d’entrée**, pas ignoré.
L’ingress NGINX + ModSecurity 3 maintenu est le seul accès HTTP navigateur Keycloak.
Sur les POST de toutes les routes normalisées `login-actions/**`, analyser les
paramètres URLencoded query ET corps : refuser `scope` ou `id_token_hint`, même
vide/encodé/dupliqué ; refuser doublons et parsingambigu, mauvais encodages,
content-types non autorisés, dépassements de taille/nombre et erreurs analyse.
Inspection bloquantephase 2, corps en RAM bornée, aucune écriturebodylog/disque,
pas le mode DetectionOnly. Rejeter chemins alternatifs/normalisationambiguë et accèsdirect
à Keycloak. Les paramètres OIDC GET normaux sur endpoint d’autorisation restent
compatibles ; ces règles ciblent les actions POST, pas les requêtes OIDC initiales.

ModSecurity fournit parserURLencoded, ARGS/ARGS_POST_NAMES et erreursREQBODY ;
règles déclaratives réseau, pas moteur d’authentification maison. PI limite aussi
les types de tokens et autorisations pour qu’un mode de formulaire forgé ne permette ni
WebAuthn/push ni enrollement libre. Plan doit figer règles/endpoints exacts ;
aucun accès réel avant tests de contournement, extractionUUID et anti-user-switch.

## Licence, coût et maturité

PI AGPL v3, provider Apache 2, composants maintenus non modifiés/services REST
séparés. Conserver notices et accès au code correspondant ; l’section 13 de l’AGPL encadre les
versions modifiées offertes sur réseau. Pas de forkPI ni liaison du code AGPL
à NestJS. La séparation technique ne vaut pas avis juridique général ; avant vente,
contrôle des licences effectives/distribution, notices/offre de sources et dépendances.
README upstream mentionne serveur CE sans limite technique et plugin Keycloak 10 000
utilisateurs ; aucun « illimité » commercial promis. Support externe 0 € reste
hypothèse sans contrat ni astreinte, pas garantie éditeur.

Cloud local 0 € ; PI et ingress dans les ressources mutualisées déjà chiffrées,
**capacitéRAM/CPU non mesurée**. Réserver 5 € HT/mois supplémentaires pour
secretsversions/stockagemétadonnées, allocation indicative pas prixproduitPI.
Enveloppe synthétique90–115€HT, commerciale235–305€HT horsIA/support/autres
exclusions ; si QA imposeVM supplémentaire, coûts augmentent avant autorisation.

## Preuves N2 et N3 obligatoires

N2 / S01–S06 : build provider+26.8, PG 17/schema et restore ; aucune secret dans dump
Keycloak, ciphertext dansPI, ENCKEY absent des backups ; rotation/erreurs/perte de clé ;
onboarding obligatoire/authinitiale, secours non relisibles/usageunique concurrent,
rejeu OTP, brute force, pannePI/TLS, formes forgées/switchuser/id_token_hint/scope,
encodages/multipart/directpath/échec du WAF, règlespolicies/clients/consoles et tokens
claimsauthentification forte ; sessions idle 30 min/max 15 j/révocation/epochs/dernier administrateur ; PRA PI.
Un findingcritical/major rouvre la qualification, n’autorise aucune activation.

N3 avant réel/commerce : durcissement/IAMclés/secretpermissions, runbooksPIrotation
et restauration testés, licences/notices/distribution, volumes/ressources/budget,
responsabilitéowner/incident et support. ArchitecturePASS n’est ni VerifyPASS ni
autorisationcloud/production ni preuve de conformité opérationnelle.

## Sources primaires consultées

- [ReleasePI 3.14](https://github.com/privacyidea/privacyidea/releases/tag/v3.14) et [releaseprovider 1.8](https://github.com/privacyidea/keycloak-provider/releases/tag/v1.8.0).
- [CryptoPI 3.14](https://raw.githubusercontent.com/privacyidea/privacyidea/v3.14/doc/faq/crypto-considerations.rst), [implémentationcrypto](https://raw.githubusercontent.com/privacyidea/privacyidea/v3.14/privacyidea/lib/security/default.py), [config](https://raw.githubusercontent.com/privacyidea/privacyidea/v3.14/doc/installation/system/inifile.rst).
- [Rotation](https://raw.githubusercontent.com/privacyidea/privacyidea/v3.14/doc/faq/re-encryption.rst), [backup](https://privacyidea.readthedocs.io/en/stable/installation/system/pi-manage.html), [Dockerbackup](https://raw.githubusercontent.com/privacyidea/privacyidea/v3.14/deploy/docker/README.Docker.md).
- [ProviderREADME](https://raw.githubusercontent.com/privacyidea/keycloak-provider/v1.8.0/README.md), [POM 26.5.6](https://raw.githubusercontent.com/privacyidea/keycloak-provider/v1.8.0/pom.xml), [code/entrées](https://raw.githubusercontent.com/privacyidea/keycloak-provider/v1.8.0/src/main/java/org/privacyidea/authenticator/PrivacyIDEAAuthenticator.java).
- [ResolverUUID](https://raw.githubusercontent.com/privacyidea/privacyidea/v3.14/privacyidea/lib/resolvers/KeycloakResolver.py), [configurationHTTP](https://raw.githubusercontent.com/privacyidea/privacyidea/v3.14/doc/configuration/useridresolvers.rst).
- [Recovery Action 26.8](https://raw.githubusercontent.com/keycloak/keycloak/26.8.0/services/src/main/java/org/keycloak/authentication/requiredactions/RecoveryAuthnCodesAction.java), [Recovery Form 26.8](https://raw.githubusercontent.com/keycloak/keycloak/26.8.0/services/src/main/java/org/keycloak/authentication/authenticators/browser/RecoveryAuthnCodesFormAuthenticator.java).
- [AGPLPI](https://raw.githubusercontent.com/privacyidea/privacyidea/v3.14/LICENSE), [Apacheprovider](https://raw.githubusercontent.com/privacyidea/keycloak-provider/v1.8.0/LICENSE), [capacités/support/limites](https://github.com/privacyidea/privacyidea).
- [ModSecurity parser/règles/erreurs](https://github.com/owasp-modsecurity/ModSecurity/wiki/Reference-Manual-(v3.x)).
- [Proxy rejeté](https://github.com/cozystack/keycloak-kms-proxy) / [release 0.2.3](https://github.com/cozystack/keycloak-kms-proxy/releases/tag/v0.2.3).

La [revue indépendante N1](../agentic/work/63-finalize-architecture/otp-review.md)
conclut PASS avec zéro Critical/Major. Les sources établissent des capacités et
une conception, pas leur fonctionnement dans une application DossierClé inexistante.
