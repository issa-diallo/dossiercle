> **Correctif de livraison requalifié : Execute/Verify T00–T04 PASS.**
> Configuration montée par répertoire readonly, ingress après PIhealthy.
> Build37unit/58integration/native12 PASS (9.5min). L’ancienne preuve de clé
> absente est invalidée et remplacée par readback+refus natif réellement exécutés.
> Review du correctif source sansCritical/Major ; CI nouvelle tête requise avantmerge.
> T05 non démarré, S01 IN_PROGRESS. Les checkpoints ci-dessous sont historiques.

# Checkpoint de livraison T00–T04 — 2026-10-13

**Execute T00–T04 : PASS.** Worktree Setup PASS ; T01–T04 implémentées dans le périmètre autorisé.
Build/37 unités/58 intégration et premier rejeu V3 navigateur10/10 PASS.
Ajout natif password-reset/restauration1/1 PASS ; rotation1/1 et throttle1/1 PASS.
Le rejeu V3 de tête12/12 PASS (11.4 min) et ciblé faults1/1 PASS (2.8 min)
sont acquis. Verify T00–T04 PASS ; Review indépendante PASS_WITH_MINOR, Critical0/Major0 ; Goal technique SATISFIED.
Aucun commit, PR, CI hébergée ou merge à ce checkpoint. T05–T10 non démarrées.
S01 globale IN_PROGRESS, jamais DONE. [Verify T04](verify-t04.md).

Corrections : pont natif limité aux grants/J1, flow/password/MFA natif LOA2,
fenêtre TOTP60 N2 explicite, SID opaque natif, migration scope0003,
refresh humain, logout/backchannel, refus durable des changements natifs,
fermeture clients hérités/offline, pannes/restauration/rotation synthétiques réelles.
Le finding de concurrence fournisseur reste visible et contenu ; aucune propriété
atomique native inventée. Préparation Research/Design/Plan PASS conservée.

## Historique des checkpoints précédents

# Execute S01 — livraison applicative distincte de la préparation

État BLOCKED. Verdict global Execute : BLOCKED sur T04, aucun PASS global.
Worktree feat/s01-espace-isole, base0756029, aucun commit/PR.
Implementer /root ; reviewer /root/s01_environment_review en lecture seule.
Préparation Research/Design/Plan inchangée et PASS documentaires conservés.

| Tâche | État réel | Preuve |
|---|---|---|
| T00 | PASS, revue indépendante PASS | environment.md, environment-review.md, evidence/t00-checks.json |
| T01 | PASS socle/contrats/build | evidence/t01-checks.json |
| T02 | PASS schémas/migrations, revue corrective indépendante PASS | evidence/t02-checks.json |
| T03 | PASS, revue corrective indépendante PASS | evidence/t03-checks.json ; 24 unitaires et 22 intégration |
| T04 | BLOCKED avant callback OIDC | TOTP frais refusé ; POST actions requises fermé jusqu’au pont grant-aware/J1 ; [preuve](evidence/t04-mfa-blocker.md) |
| T05–T10 | BLOQUÉS | dépendance T04/V3 non satisfaite |

## Corrections T02
Drizzle default BigInt non sérialisable → SQL defaults 0/1 équivalents.
Noms d'index UNIQUE générés identiques → nom agency_creation_root_unique explicite.
Revue1 CHANGES_REQUIRED : Major schéma partiel au rejeu ; correction empreinte
physique tables/colonnes/types/defaults/contraintes et zéro ACL PUBLIC avant retour.
CHECK enrollment_status/hash J1/racine onboarding renforcés, tests PG réels.
Revue2 reçue PASS le 2026-10-11 : zéro Critical/Major ouvert sur T02 seulement.
Relecture du reviewer, tests non rejoués par celui-ci ; preuves implementer examinées.

## Limites
V3/V5 et MFA complet/saga/activation non exécutés ; J1 courant testé en T03. Aucun AC coché sur ce seul socle.
Verify/Review applicatifs globaux, CI hébergée et Ship non atteints.

## Correctifs après revue indépendante — 2026-10-12

La revue ciblée précédente CHANGES_REQUIRED a relevé que logout ne pouvait pas
révoquer une session d’invitation encore ISSUED et que les POST Keycloak
`login-actions/required-action` contournaient le grant/J1 courant. `AuthService.logout`
utilise maintenant la transaction qui accepte une invitation ISSUED confirmée,
conserve Origin/CSRF et révoque avant réponse. Un test unitaire synthétique couvre
la révocation puis le refus du GET suivant ; il ne qualifie pas l’IdP natif.

Le POST Keycloak `required-action` est refusé par le reverse proxy (403, sans
journalisation/audit du corps) tant que le pont grant-aware n’est pas livré. Le
Firefox TLS réel vérifie les refus 400/403 de toutes les variantes. Les essais antérieurs de changement password/
secours passaient par l’accès direct Keycloak et ne prouvent pas la conformité
grant/J1. La reprise sûre de ces mutations nécessite le pont validé au Design.

Le test OIDC avait observé `SameSite=Strict` car le processus coordinateur était
périmé malgré le rebuild. Après redémarrage explicite, le cookie Lax est reçu et
le contrôle issuer/callback passe. Unitaires 34/34 et typecheck/lint/build complets
PASS ; contrôles navigateur des routes et liaison issuer/callback 2/2 PASS (variantes bloquées en 400/403).
Revue indépendante corrective PASS, zéro finding ouvert sur ce delta
([preuve](evidence/t04-corrective-review.md)). Le TOTP synthétique frais reste
refusé avant callback. Execute T04 reste BLOCKED ; Verify globale non commencée,
aucune activation. Review globale reste à effectuer après un Execute complet.

## Blocage courant — MFA/Code natif

Le navigateur termine l’enrôlement PI, confirme le mot de passe et les secours
Keycloak, puis le challenge natif privacyIDEA refuse un TOTP synthétique frais,
même après deux pas temporels complets. L’URL callback n’est jamais atteinte.
Cause exacte non établie ; aucune activation permise. Voir
[preuve reproductible](evidence/t04-mfa-blocker.md). Ne pas traiter le rejet comme
un défaut de test ni réduire le niveau d’authentification sans nouvelle décision
documentée.

## Qualification T04 en cours — UI native privacyIDEA

Fait nouveau observé dans le wheel figé3.14 : l'UI courante écrit son JWT dans
sessionStorage ou localStorage, sans option mémoire. La documentation fournisseur
[WebUI](https://privacyidea.readthedocs.io/en/stable/webui/index.html) le confirme.
La revue documentaire indépendante a identifié l'option native explicite
PI_STATIC_FOLDER=static_old/ et PI_TEMPLATE_FOLDER=static_old/templates/ ; son
AuthFactory conserve le token uniquement en mémoire. Cette UI est livrée en3.14
pour une version de transition et sa suppression suivante est annoncée.

Correction candidate minimale : sélectionner explicitement cette UI native sur
la version3.14 figée, à la racine d'une origine locale TLS dédiée, et qualifier
réellement stockage, enrôlement, CSRF et expiration absolue. Aucun patch fournisseur,
classe LegacyUIConfig/TestingConfig, fallback automatique, token browserStorage ou
abaissement MFA. Cette correction n'a pas encore de PASS ; le gate T04/V3 reste
ouvert. Une montée PI suivante exige requalification ; cette solution ne promet
pas une compatibilité future. Préparation conservée ; aucun choix produit changé.

Transport resolver privé : HTTPS natif Keycloak avec certificat synthétique signé
par la CA existante, identité DNS keycloak vérifiée. Un premier essai de signature
a échoué (fichier serial CA en lecture seule) et laissé un certificat vide ; aucun
PASS attribué. Reprise avec le même CSR et la même clé, serial explicite aléatoire,
validation puis remplacement atomique du certificat. Aucune clé PI/CA régénérée.

## Corrections T03 en revue
Deux Major de permissions runtime/dispatcher signalés indépendamment : capacité
SQL lock_authority minimale, rôle dispatcher UPDATE(status,attempt) séparé, tests
sous vrais comptes applicatifs. BEGIN protégé et release garanti.
Typo implémentation step DB_CREATED incompatible avec DATABASE_CREATED validé :
correction 0002_s01_runtime_capabilities.sql sans réécrire la 0001 appliquée ;
le schéma applicatif reste1. Upgrade transactionnel et empreinte des fonctions.
Journal format2 ajoute acteur/type/UTC ; essais synthétiques format1 conservés.
Préparation inchangée, aucun arbitrage architecture modifié.

## Correction d'implémentation T04 — sujet réservé avant J1
POST Keycloak /users ignore l'id fourni et génère le sub. Primitives initiales
créaient donc un sub reçu après appel ; elles ne pouvaient pas être utilisées
par le coordinateur conformément au Design. Source26.8 UsersResource/UserProfile
et UsersPartialImport/DefaultExportImportManager relue indépendamment.
Correction : API native /partialImport, users uniquement, ifResourceExists=FAIL,
id réservé explicitement, aucun credential/role/group fourni. Relecture par
UUID technique et égalité sub/racine/contact avant adoption ; pas OVERWRITE/SKIP.
API exige manage-realm : client s01-importer distinct, uniquement coordinateur
privé, jamais secret importeur dans BFF/runtime métier. Les montages/confinement
et J1avantappel restent à qualifier avant PASS T04/T06. Resolver reste view-users/
query-users ; s01-identity manage-users pour actions natives séparées.
Le test natif conserve désormais réellement le sub réservé et le même compte
sur rejeu ; aucun droit métier ni CONFIRMED issu de ce seul test.
Minor de transport en revue corrigé : deadline absolue en plus du timeout socket,
test TLS local qui envoie des octets toutes20ms, appel fermé à150ms.

## T04 — grant et pont natif qualifiés partiellement
Admission 256bits hashée, consommation durable par version d’invitation, grant
volatile10min lié racine/sujet/version/epoch ; restart ferme sans replay implicite.
JWT utilisateur natif lié par empreinte au grant ; aucun JWT administrateur browser.
Verrou invitation→autorité gardé jusqu’au résultat natif et commit. Mutation facteur
J1 PENDING/fsync avant effet ; panne après fsync ferme les appels suivants.
CA mTLS cliente dédiée, pont ingress9443 strictement privé, identité CGI construite
côté coordinateur. Clé CA cliente réservée au setup ; seul certificat+clé leaf
seront montés au coordinateur, jamais le répertoire CA privé complet.

Revue indépendante ciblée CHANGES_REQUIRED puis PASS correctif : query PI fusionnée
avec JSON contournait l’allowlist, paramètres TOTP libres affaiblissaient vérification,
chemins WHATWG masquaient dotsegments. Corrections : POST query refusée avant J1,
GET allowlist/doublons, chemin brut refusé avant normalisation, paramètres six
chiffres/SHA1/pas30s/fenêtre30s stricts et configuration native correspondante.
Vérification ne peut changer clé/configuration ; serial propre lu via JWT natif.
Le réglage natif de fenêtre était180s par défaut : qualification locale candidate
30s, à confirmer par V3 ; aucun PASS MFA. Policies TOTP relues dans scope USER ;
ENROLL et force_server_generate refusés réellement par REST, non retenus.

Preuves réelles après correction : intégration34/34 (12schema+22autres), dont
5 grants PG et2 ponts KC/PI/ingress, initialisation native TOTP en état verify,
paramètres natifs effectifs relus, attaques refusées sans modification J1.
V0 relancé avec frozen lock/build offline/7services sains. Autorité reste PENDING.
Cette preuve antérieure ne comprenait aucun premier OTP/password/secours/Code/session
forte. Les preuves plus récentes ci-dessous la complètent sans qualifier T04.

## T04 — navigateur natif et maintien de la barrière

38 intégrations réellement PASS (12 schema +8 J1 +3 outbox +5 identité native
+8 grants +2 ponts), types/lint/builds PASS. Perte réelle du backend PG propre à
la fixture : requête TLS annulée, aucun effet suivant, divergence J1 ferme la
reprise. Expiration pendant la mutation : résultat non publié et état PENDING.
V0 dernier setup rejoué, sept services de base sains ; runtime coordinateur sous
profil identity-runtime démarré séparément, soit huit services applicatifs locaux.

Un test Firefox réel sélectionné PASS : CA synthétique dans son profil NSS propre,
TLS vérifié, UI PI fournisseur, premier OTP vérifié et preuve native enrolled
relue par le verifier. Oath maintenu et figé simule exclusivement le téléphone
de la fixture : graine via stdin, jamais argv/fichiers/rapports ni code applicatif.
Absence du JWT natif en clair dans localStorage/sessionStorage vérifiée. Captures,
traces, vidéo et snapshots DOM automatiques désactivés ; diagnostics de clés/types
uniquement. Cette preuve ne démontre pas à elle seule toute absence de persistance.

État avant correction : un rejeu a échoué à native-enroll-result après redémarrage
du runtime. La cause plausible, trouvée dans les sources natives, était l'UI
initialisée temporairement en HOTP avant retour du droit TOTP. Paramètres inertes de l'UI normalisés explicitement,
pas de mutation des sources fournisseur ; limite réponse2MiB réservée aux static,
API1MiB. Revue ciblée indépendante PASS_WITH_MINOR, correction documentaire ici.

T04 EN_COURS : password, secours, Code, session forte, bootstrap owner et attaques
V3 restent à qualifier. La suite auth complète reste explicitement en échec tant
qu'ils manquent. Aucun ACTIVE, Verify/Review globaux non atteints.

Résultats pré-correction : repeat3 exit1 (1PASS/2FAIL à initialisation), puis
repeat2 exit0 (2PASS), alors encore sans cause établie. Ce constat historique est
supersédé par la correction et repeat5 5/5 PASS ci-dessous.

### Correction du défaut intermittent UI TOTP
La revue native a identifié que l’UI PI3.14 démarrait parfois sur HOTP pendant
l’attente du callback `/auth/rights`. Le proxy refusait correctement ce facteur.
Policy webui native `default_tokentype=totp` ajoutée puis relue via API ; le
script setup échoue si la valeur effective diffère. Le navigateur attend l’option
TOTP affichée avant submit. Rejeu Firefox répété5/5 PASS : premier OTP natif et
preuve `EnrollmentAdapter.proof` PASS. Les deux anciens échecs restent consignés
comme essais avant correction, sans leur attribuer un faux succès rétroactif.
Le périmètre reste partiel : mot de passe/secours/Code/session forte/V3 manquants.
