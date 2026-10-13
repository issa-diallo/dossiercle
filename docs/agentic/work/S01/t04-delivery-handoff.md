> **Bootstrap TLS requalifié localement.** CI1edc7b6 confirmeUID1001 et services/
> migrationPASS mais échoue au bootstrapHTTP. TLS CA/DNS/origine vérifiés sansfallback,
> setup/transport/readback7/browser3 PASS ; ReviewPASS_WITH_MINOR, Critical0/Major0.
> NouvelleCI complète et ultimeLeadTech de tête avantmerge. S01 IN_PROGRESS, pasT05.
> Les checkpoints ci-dessous sont historiques ; verdict final horsdiff en session/PR.

> **Correction de portabilité UID en requalification.** CI34a31ba : ingresshealthy,
> KCexit2. AlignementUIDnonroot des fichiers privés, GID0 natif, secrets0400/RO
> inchangés ; readback natif7/7PASS et ownerTOTP/faults2/2PASS (3.3min).
> Review finale locale PASS_WITH_MINOR, Critical0/Major0 ; aucunruntime1001complet
> qualifié par la locale. NouvelleCI
> complète sousUIDrunner et ultimeLeadTech avantmerge. Checkpoints ci-dessous historiques.

> **Correctif complet requalifié : build/37 unités/58 intégrations/native12 PASS
> en9.5min ; configuration atomicrename réellement visible, clé absente fermée.**
> Review finale corrective PASS_WITH_MINOR, Critical0/Major0 ; Goal technique SATISFIED.
> Nouvelle CI de tête et ultime Lead Tech avantmerge. Ancienne CI setupFAILURE et
> ancien test1FAILED/1PASS restent historiques ; aucun merge encore. S01 IN_PROGRESS.

# Handoff de livraison T04 — distinct de la préparation S01

Mandat : terminer et sécuriser T04, merger après les gates puis arrêter.
Branche `feat/s01-espace-isole`, base `075602916355813cf4e8d3f952fadaec5e637398`.
Worktree `worktrees/s01-espace-isole` ; changements locaux du dépôt principal conservés.
Mode LARGE ; implementer /root, reviewer indépendant /root/s01_environment_review.

## État au 2026-10-13

T00 PASS réel ; T01–T04 implémentées. Build, 37 unités, 58 intégration PASS.
V3 navigateur10/10 PASS, ajout password-reset/restauration1/1 PASS.
Rejeu complet de tête12/12 PASS (11.4 min) ; targeted faults1/1 PASS (2.8 min),
503 natif observé puis nouvelle MFA forte/logout confirmés. Execute/Verify T00–T04 PASS. [Verify](verify-t04.md).
Review finale indépendante PASS_WITH_MINOR, Critical0/Major0 ; Goal technique
SATISFIED au checkpoint technique. [Review](review-t04.md).
Commit2871afb/PR68 créés. CI documentairePASS ; applicationFAILURE setup ingress
avantPI. Lead Tech historiqueBLOCKED livraison, Critical0/Major0. Correctif
Compose dépendancePIhealthy validé source ; rejeux et nouvelleCI requis avantmerge.
T05–T10 non démarrées ; aucune agence ACTIVE ni activation IA/modules/mail.
S01 globale IN_PROGRESS, pas DONE.

## Contrats et corrections

Native Keycloak26.8/provider1.8 + PI3.14 maintenus. Aucun password/TOTP maison.
Code+PKCE S256, issuer/nonce/state/acr2/SID vérifiés ; cookie opaque, tokens serveur
chiffrés, CSRF/Origin ; scopes onboarding/platform stricts, aucun accès métier.
Grant lié sujet/root/epoch10min et formulaires natifs émis à usage unique ;
mutations sous verrou invitation→autorité/J1. SID natif opaque qualifié, clé interne
hashée ; fenêtre PI60 explicitement qualifiée N2. HTTP native actions cachées
au navigateur hors pont ; identités/consoles/grants/offline hérités fermés.
Session humaine refresh natif, polling exclu, idle30/absolu15j ; logout et
backchannel signé révoquent sous J1/tombstones. Changement natif connu ou sujet
supprimé : DENIED epoch+1 et toutes sessions révoquées, audit, commit avant refus ;
restauration ancienne ne réouvre pas. Pannes temporaires distinctes.

## Preuves et findings

[evidence/t04-durable-native-denial.md](evidence/t04-durable-native-denial.md),
[evidence/t04-recovery-concurrency.md](evidence/t04-recovery-concurrency.md),
[evidence/t04-totp-window.md](evidence/t04-totp-window.md),
[evidence/t04-native-sid.md](evidence/t04-native-sid.md).
Native recovery DOUBLE_ACCEPTED dans expérience privée : échec conservé,
protection publique composite démontrée, Minor contenu selon reviewer.
UI PI précédente transitoire3.14 : upgrade interdit sans requalification.
Rotation supplier janitor réelle sur DB clone dédiée et sans swap : metadata/counter
préservés, new-key validation native, old/missing closed, export RAM supprimé.
Aucun secret dans Git/logs/captures/rapports. Journal/DB/versions de clés conservés.

## Suite autorisée

Ticket67 créé ; preuves techniques et Review acquis. Créer commit
Gitmoji/PR, obtenir CI de tête et examen Lead Tech indépendant, merger selon
instruction humaine puis arrêter. Aucun T05, déploiement, cloud métier ou cleanup
automatique. L’ancien goal outil reste paused et ne représente pas ce mandat ;
[goal de livraison distinct](t04-delivery-goal.md) utilisé pour ce périmètre.

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

### Revues indépendantes finales du delta local

Premier reviewer /root/s01_environment_review : delta PASS, Critical0/Major0/
Minor0 ; global T00–T04 PASS_WITH_MINOR. Second Lead Tech
/root/s01_t04_leadtech : technique pré-CI PASS_WITH_MINOR, Critical0/Major0 ;
livraison BLOCKED jusqu'à nouvelle CI complète. Logs et métadonnées distinctes
relus, aucun test/service/fichier modifié par les reviewers. Deux Minor fournisseur
et limite IP ingress conservés. Ultime attestation hors nouveau commit sur
SHA/CI définitifs obligatoire. Aucun merge observé à ce checkpoint.
