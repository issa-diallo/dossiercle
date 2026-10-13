# Verify — livraison T00–T04 de S01

Date : 2026-10-13. Portée autorisée : terminer T04 puis livrer/merger et arrêter.
T05–T10 hors mission ; aucun AC d’activation S01 ni état DONE déduit.

## Résultats exécutés au checkpoint précédent (avant correction du montage)

| Commande | Résultat | Portée réelle |
|---|---|---|
| `bash scripts/worktree-setup.sh --check` | PASS | isolation et configuration identifiées |
| `pnpm build` | PASS | types applications/tests, lint, API et Vite |
| `pnpm test:unit` | 37/37 PASS | règles, cookies, CSRF, OIDC, chiffrement, SID |
| `pnpm test:integration` | 58/58 PASS | 12 schema +46 autres ; PostgreSQL réel, J1 et adapters natifs |
| `node scripts/s01-control-migrate.mjs` | PASS | rejeu migration centrale et grants ; checksum ci-dessous |
| `pnpm test:auth` | **12/12 PASS, 11.4 min** | Firefox avec TLS validé, huit parcours natifs +quatre matrices/restart au checkpoint |
| `pnpm test:auth -g 'refresh/faults'` | **1/1 PASS, 2.8 min** | dernière assertion exacte cookie/SID ; reprise503 observée, nouvelle MFA native et logout confirmés |
| `python3 scripts/s01-secret-scan.py` | PASS, zéro match | blobs indexés contre secrets synthétiques raw/hex/base64 et fragments PEM ; compteur dans t04-checks.json |
| `pnpm test:auth -g 'native-password'` | 1/1 PASS, 17.1 s | ajout final : reset mot de passe natif, DENIED durable, restauration refusée |
| `pnpm test:auth:rotation` | 1/1 PASS, 1.1 min | rotation canari réelle, sélection dédiée sans refaire la matrice de pannes |
| `pnpm test:auth -g 'throttle'` | 1/1 PASS, 1.5 min | cinq échecs natifs, délai puis authentification forte |
| `bash scripts/agentic-check.sh` | PASS présence | ne prouve pas les gates applicatifs |
| `git diff --check` | PASS | espaces du patch courant |

Checksum centrale : `9f0dc36dc01ac75df76e23250452f299c4a649f03e6bd6e38c976325c6cb955a`.
Les logs locaux de commande sont sous `.local/`, ignorés par Git. Aucun export
secret, URL d’action/code/state, cookie, trace DOM ou screenshot n’est publié.
Les boundary mocks des tests SQL sont explicitement distingués des tests natifs.

## Matrice V3 observée

- Password natif → TOTP ou secours → Code/PKCE/S256 → claims signés issuer/sub/acr2/SID.
- Enrôlement PI maintenu, premier OTP consommé ; aucune session forte avant preuves.
- OTP invalide, déjà consommé et hors bornes : refus ; succès frais ensuite.
- Secours public concurrent : un BFF seulement ; ancien onglet/formulaire et
  code consommé dans un nouveau grant refusés ; code suivant accepté.
- Owner serveur explicitement configuré : scope platform fort ; onboarding vide.
- Refresh humain natif, polling sans refresh, CSRF et callback/state forgés/rejoués.
- Backchannel natif signé réel, receipt durable, révocation et anti-rejeu.
- Idle30 min/absolu15 j via horloge de test sur vraies transactions SQL ; bornes
  realm natives lues séparément. Aucun test n’a attendu quinze jours réels.
- Changement natif : DENIED epoch+1, toutes sessions révoquées, audit et commit
  avant refus ; crash après fsync avant SQL et restauration ancienne restent fermés.
- Sujet natif absent 404 distingué des pannes ; SID absent ferme la session sans
  DENY global ; dépendances temporaires ne changent pas l’epoch.
- PI/KC arrêtés, ENCKEY absente, journal absent au restart sans régénération,
  clé BFF absente, WAF arrêté : accès fermé ; reprise technique testée.
- Tous clients interactifs lus, consoles et grants hérités fermés, offline retiré ;
  porteurs bearer-only explicitement reconnus, aucun IdP externe configuré.
- Routes natives directes/admin/account/token/device/CIBA/broker/logout/reset,
  query/body/encodages/duplicats/multipart/JSON : refus sans octroi ni mutation J1.
- Restart coordinateur : grants transitoires perdus ; receipt d’admission interdit le rejeu.
- Rotation supplier janitor réelle sur store clone synthétique et credential distinct,
  nouvelle clé, secret resolver réenregistré nativement, compteurs/assignation
  préservés, OTP consommé refusé ; ENCKEY hors dump, seed absente du dump KC,
  export en clair uniquement en RAM sans swap/coredump et supprimé dans finally.

## Finding upstream conservé

La consommation concurrente native des secours est défaillante. La commande
privée `test:auth:upstream` est rejouée séparément ; son échec n’est pas un PASS
natif et ne produit aucun BFF. [Preuve et limites](evidence/t04-recovery-concurrency.md).
La protection composite locale est la propriété qualifiée par la suite publique.

## Limites

CI hébergée et Lead Tech de la tête actuelle restent des gates Ship distincts.
UI PI précédente figée3.14 : upgrade exige requalification. IAM/coffre cloud,
PRA commercial, rétention30j/charge/licences commerciales ne sont pas qualifiés.
Aucune création d’agence, activation IA/modules/mail ou action externe métier.

## Rejeux intermédiaires conservés

Le checkpoint10/10 a passé. Le premier rejeu11 cas a échoué sur trois
contextes multi-onglets ; aucun PASS de cette tête n’a été publié. Le harnais
quitte désormais le document natif avant remplacement des cookies et POST
simultanés, pour éviter sa navigation automatique concurrente ; cookies,
origine, formulaire natif et backend inchangés. Le rejeu ciblé suivant a passé
4/5 ; le cas restant exigeait incorrectement la conservation du SID après restart
Keycloak. Sa correction qualifie explicitement fermeture durable ou reprise,
puis impose toujours une nouvelle MFA native. Ce scénario corrigé a passé1/1.
Le rejeu complet corrigé **12/12 PASS** inclut password et scan RAM renforcé.

## Observation de panne finale

Le rejeu ciblé a observé **503** juste après redémarrage Keycloak, avec J1
inchangé. Nouvelle connexion native password+code secours/Code/acr2 : PASS,
nouveau BFF fort puis logout : PASS. La branche401 du dernier helper n’a pas été
empruntée dans ce rejeu : sa liaison cookie/SID exacte a été relue indépendamment,
la fermeture d’un SID absent est couverte par l’intégration SQL avec frontière
native explicitement simulée. Aucun 401 natif nouvellement exécuté inventé.

## Scan de secrets reproductible

`python3 scripts/s01-secret-scan.py` lit uniquement l’environnement synthétique
connu et ses clés requises, compare les blobs Git indexés aux valeurs privées
brutes/hex/base64 et fragments de clés PEM. Il ne publie que compteurs et chemins
en cas de match ; aucune valeur/pattern privée. Les graines browser restent en
mémoire et ne font pas partie de ce scan de fichiers. Les dumps natifs sont
vérifiés séparément dans le canari de rotation. Derniers compteurs minimisés :
[evidence/t04-checks.json](evidence/t04-checks.json). Un zéro n’est pas un audit
exhaustif de secrets inconnus ; aucun secret connu trouvé dans le snapshot livré.

## Requalification après échec CI et montage fichier

CI2871afb : échec setup neuf, ingress lancé avant PI. Correction minimale :
Compose ingress attend PIservice_healthy ; cible uWSGI statique, recreatePI avec
changementIP exige restart ingress. Rejeu local associé :1FAILED/1PASS
(`NATIVE_FAULT_SESSION_KEY_MISSING_SESSION_KEY_OPEN`). Le montage individuel de
config.json peut conserver une ancienne inode après atomicrename/restart.

Correction : répertoire propre du coordinateur monté readonly sous
`/run/s01-coordinator-config`, bootstrap et healthcheck lisent son config.json ;
clé/credential paths et capacités inchangés. Le répertoire ne donne accès qu’aux
propres clés déjà montées et aux marqueurs/certificats locaux ; aucun secret IdP
supplémentaire. Le test affirme la visibilité de la nouvelle configuration dans
le conteneur avant restart, puis exige le refus503. Aucun faux PASS ni fallback.
La preuve précédente de clé BFF absente est invalide sur ce point : un503
pouvait provenir d’un restart temporaire sans exposition de la nouvelle config.
Elle n’est pas réutilisée. Le readback nouveau est indispensable à sa requalification.
**Requalification complète exécutée : buildPASS, unité37/37PASS, intégration58/58PASS,
Firefox12/12PASS en9.5min**. Logs locaux t04-config-build/unit/integration/auth.log.
Le cas clé absente passe avec readback nouveau avantrestart ; ownerplatform natif
requalifié. Après restartKC, dernier casobserve200/J1inchangé (SID conservé),
puis impose quand même nouvelleMFA forte et logout : tous deuxPASS. L’ancien503
reste son checkpoint distinct. La branche401 du helper n’est pas attestée native
par cette dernière exécution ; frontière SQL simulée explicitement conservée.

**Verdict Verify T00–T04 courant : PASS sur le correctif complet.** Les anciens
checkpoints restent historiques, dont la preuve invalide de clé absente. CI de
nouvelle tête et ultime Lead Tech restent des gates Ship avantmerge.
S01 globale : IN_PROGRESS.

## Portabilité UID — deuxième CI en échec, correction minimale

CI34a31ba/38439173566 : ingress devient healthy, première correction confirmée,
mais Keycloak exit2 au setup. Image native UID1000:GID0, fichiers privés owner0400 ;
le runner utilise un UID différent. Aucun message natif détaillé disponible
(loggingnone). Le diagnostic permissions est cohérent, à confirmer au setup neuf.

Correction : Keycloak utilise S01_UID:GID0, conformément aux droits natifs de
l’image ; setup/check refusent UIDroot et valident ce user exact avant mutations.
Secrets0400, dirs0700, mountsreadonly inchangés ; aucun chmod/chown des secrets,
patch fournisseur ou capability supplémentaire. Le GID0 n’est pas un UIDroot.

Probe réellement exécuté sur l’image figée, user1001:0, sans lecture de secret :
UIDnonroot, répertoire Quarkus et fichier native quarkus-application.dat writable,
exit0. Conteneur probe conservé, aucun cleanup. Startup local Keycloak requalifié
healthy, user1000:0 effectif inchangé ; accès owner aux fichiers privés contrôlé.
Readback/intégration native7/7 PASS (1.98s). Rejeu ciblé ownerTOTP+faults
**2/2 PASS en3.3min** ; restartKC200/J1 inchangé puis nouvelleMFA/logoutPASS.
La locale UID1000 ne qualifie pas tout UID1001 : nouvelle CI full12 obligatoire.

Verdict correctif UID local : PASS ; Review finale PASS_WITH_MINOR,
Critical0/Major0. Ship BLOCKED jusqu’à nouvelleCI complète et ultimeLeadTech.

## Bootstrap TLS — troisième CI et requalification

CI1edc7b6/38440935825 confirme ownerUID1001, tous les services healthy et migration
checksum9f0d…PASS. Échec suivant : grant administrateur master encore appelé en
HTTP privé ; erreur native nonJSON puis erreur de décodage. Aucun message de corps
réutilisé comme preuve. Le transport passe au TLS natif retenu : IP Docker connue,
CA conservée, vérification DNSkeycloak:8443, aucune proxy/redirect/fallbackHTTP.
La garde ferme aussi origine/scheme/port/userinfo avant réseau ; réponses1MiBmax,
erreurs statut uniquement, jamais corps. Aucune modification MFA/sslRequired/clé.

Commandes réellement exécutées :

- `python3 scripts/s01-identity-setup.py` : PASS, native flow configured idempotent,
  avec origineTLS bornée et capréponse, sans qualifierMFA par ce setup seul.
- `python3 scripts/s01-bootstrap-transport-check.py` : PASS, TLS positif ; mauvaise
  CA et certificat d’un autre hostname fermés par SSLCertVerificationError réel ;
  HTTP/autreorigine refusés avant réseau. Redirect testé par appel du handler,
  jamais prétendu échange avec serveur de redirection natif.
- Native integration/readback :7/7 PASS (1.42s).
- `pnpm test:auth -g 'onboarding with native refresh/local|endpoints'` :3/3 PASS
  (1.9min), TOTP/secours et matrice des routes publiques fermées.

Review finale deltaTLS PASS ; globalePASS_WITH_MINOR, Critical0/Major0.
**Verify localT00–T04 PASS**, code applicatif identique à la suite complète12/12
précédente. Nouvelle CI froide doit qualifier le bootstrapTLS/UID1001 et full12
sur la tête finale ; CI précédente échouée et verdict Lead Tech bloqué conservés.

## Quatrième CI et correction de readiness — checkpoint après eda9287

[CI38443681703](https://github.com/issa-diallo/dossiercle/actions/runs/38443681703)
FAILURE au bootstrap technique TLS : nativeStatus503 après serviceshealthy et
migrationPASS ; validations suivantes non exécutées. Check documentaire38443682002
SUCCESS. Aucun PASS applicatif hébergé n'est déduit de ce setup.

Correctif minimal : healthcheck exige HTTP200 et le statut global UP du format
natif figé, plutôt qu'un UP imbriqué ; 7 fixtures PASS (dont DOWN imbriqué,
réponse tronquée et suffixe invalide). Ce filtre n'est pas un parseur JSON général.
Seul le grant technique synthétique s01-bootstrap retente un HTTP503 : budget de
planification30s et timeout par I/O, sans promesse de deadline réseau globale.
401/403/500, TLS et erreurs de format restent fermés. Aucune nouvelle tentative
MFA humaine/BFF. Six tests de politique avec frontières simulées PASS ; la
borne simulée après503 ne prouve pas un timeout socket réel.

Le scénario local owner+faults a donné1FAILED/1PASS (clé coordinateur absente,
ancien label sans statut HTTP, cause non établie). Les rejeux diagnostique puis
processus ont donné chacun1/1PASS (2.1min) : readback config absent, exit1,
HTTP503. Le rejeu suivant à attente bornée a échoué plus tôt sur PI_KEY avec
ancien label sans statut ; conservé, jamais appelé faux positif. Harnais renforcé :
attendre l'arrêt réel PI/nonzero et coordinateur/exit1, puis HTTP503 strict ;
budget de boucle10s et timeout inspect5s. Labels minimisés préservent les chiffres.
Deux reviewers indépendants ont relu le source : aucun Critical/Major ; preuve
locale de ce dernier delta puis CI complète de nouvelle tête encore requises.

## Rejeu strict séquentiel du correctif readiness/clés — PASS local

`pnpm test:auth -g 'refresh/faults'` : **1/1 PASS, 1.9min**,
log privé `.local/t04-ready-fresh-tls.log`. Processus PI arrêté/nonzero et
coordinateur arrêté/exit1, readback config, absence de régénération et
restaurations qualifiés. Une connexion HTTPS publique indépendante par requête,
CA/hostname vérifiés et même cookie BFF en RAM, sans redirect/retry ni lecture de
corps, exige200 avant perturbation/après restauration et503 durant clé absente.
Firefox PI503 ; coordinateur0 (exception fetch, cause inconnue), distinct du503
réel de la connexion TLS fraîche. Aucun HTTP503 navigateur inventé, aucun200
accepté pendant panne, aucun fallback d'authentification. Nouvelle MFA native et
logout PASS ; KC après restart200. Métadonnées privées sans secrets :
`.local/t04-fault-observation.json`.

Le rejeu `.local/t04-ready-bounded-keys.log` FAILED_SESSION_KEY_HTTP0 a été
perturbé par un bootstrap exécuté involontairement en parallèle ; **non qualifiant**,
conservé. Le contrôle TLS parallèle a aussi échoué (KC arrêté) ; il ne qualifie
aucun transport. Rejeu ensuite strictement séquentiel
`python3 scripts/s01-bootstrap-transport-check.py` : PASS natif/CA/hostname/
HTTP/origine/refus redirect handler (`.local/t04-ready-transport-sequential.log`).
L'essai de version via `node .local/node/bin/node --version` a échoué par invocation
erronée du binaire ELF comme source JS ; aucune preuve de version n'en est déduite.
Build/types du wrapper auth PASS ; build37unit/58integration/full12 précédents
restent checkpoints historiques, code applicatif inchangé. CI complète de nouvelle
révision et ultime Lead Tech sur ses SHA définitifs restent requis avantmerge.
