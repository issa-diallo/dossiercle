# Ship — livraison T00–T04, S01 reste IN_PROGRESS

## Mandat et portée

Instruction humaine explicite : terminer et sécuriser T04, merger puis arrêter.
Ticket [#67](https://github.com/issa-diallo/dossiercle/issues/67).
T00–T03 sont ses dépendances ; T05–T10 non démarrées. Aucun déploiement.
Ce rapport est un checkpoint avant fusion : la preuve définitive de tête/CI,
l’attestation Lead Tech et le merge seront dans la session et la PR GitHub.

## Préconditions

Worktree Setup PASS ; Execute/Verify T00–T04 PASS ; Review PASS_WITH_MINOR ;
Goal technique SATISFIED. Critical0/Major0. CI/Lead Tech de tête restent requis.
[Verify](verify-t04.md), [Review](review-t04.md),
[Goal technique](t04-technical-goal.md), [Goal livraison](t04-delivery-goal.md).

## Git et atomicité

Branche feat/s01-espace-isole ; base075602916355813cf4e8d3f952fadaec5e637398.
Remote issa-diallo/dossiercle ; commit historique2871afb687fe5107a932d349c1180886763ab98c ;
PR [#68](https://github.com/issa-diallo/dossiercle/pull/68), liée à67.
Exception à1–3 fichiers/100 lignes : la base était sans application ; socle,
contrats, migrations, lockfile et manifeste reproductible sont indispensables
au même objectif T04. La préparation non versionnée est conservée. Une division
qui ne livrerait pas ces dépendances ne permettrait pas de vérifier l’authentification.
Aucune feature T05 ni refactor sans dépendance directe. Un commit logique squash.

## CI et Lead Tech

CI hébergée historique2871afb : documentairePASS, applicationFAILURE au
setup neuf (ingress avantPI) ; étapes suivantes SKIPPED. Correction minimale
Compose ingress dépend dePIservice_healthy. Le rejeu local1FAILED/1PASS
a ensuite invalidé la preuve de config/clé absente : montage fichier périmé
aprèsatomicrename. Montage répertoire readonly/bootstrap/healthcheck/readback
corrigés, fullnative12/12PASS9.5min avecbuild37unit/58integration ; nouvelle CI
complète de tête à rejouer.
Aucune fusion avantPASS. L’absence de logs ingress empêche une preuve directe
de son message d’erreur ; la cible uWSGI statique et l’ordre observé fondent
le diagnostic, à confirmer par le setup neuf corrigé.
Workflow `.github/workflows/s01-t04.yml` : setup synthétique neuf, build/migrations,
unités/intégration réelles, Firefox/MFA/pannes/rotation, scan des secrets.
Le check documentaire est distinct de ces preuves applicatives.
Lead Tech : /root/s01_t04_leadtech, second agent indépendant ;
[rapport historique](lead-tech-review.md) BLOCKED livraison/techniquePASS_WITH_MINOR,
Critical0/Major0 sur2871afb. Réexamen obligatoire du correctif et de la nouvelle CI.
Après commit du rapport, CI et ultime attestation sur SHA définitifs dans la
session, sans nouveau commit. Aucun merge avant ces preuves favorables.

## Configuration, migrations et retour arrière

Aucun déploiement/production ; migrations centrales0001–0003 exécutées seulement
sur PostgreSQL synthétique isolé. Clés hors DB/Git, aucun PUBLIC CONNECT/TEMP
avant ouverture de DB dédiée ; runtime capabilities minimales et J1 opposable.
Retour arrière code par revert humain, jamais suppression automatique des données,
clés ou journal ; ne jamais restaurer une ancienne autorité CONFIRMED. Toute
reprise doit retrouver les clés/histoires connues, sinon rester fermée. Pas de
promesse de rollback de production ni de PRA commercial qualifié par ces tests.

## Risques conservés

Secours natifs concurrents DOUBLE_ACCEPTED : finding fournisseur conservé,
protection publique composite testée, Minor contenu. UI PI précédente3.14 figée :
upgrade à requalifier. Aucune activation IA/modules/mail ni accès métier.
La cible uWSGI PI est résolue statiquement : recréerPI avec changement d’IP
nécessite restart/requalification ingress ; stop/start sans recréation conserveIP.
Responsable : mainteneur du projet, revue avant upgrade IdP/PI ou ouverture
supplémentaire de routes/grants, avant toute mise en service.

## Autorisation, fusion et arrêt

Autorisation humaine déjà acquise dans le mandat ci-dessus (D57). Fusion squash
conditionnée à CI et Lead Tech favorables de la tête actuelle. Merge non exécuté
à ce checkpoint ; SHA/date/URL définitifs à relever dans la session/PR.
Arrêt immédiat après merge. Worktree, branche, fixtures, DB, journal et clés
conservés ; cleanup distinct et non autorisé automatiquement. S01 jamais DONE.

## Deuxième CI — checkpoint34a31ba

[38439173566](https://github.com/issa-diallo/dossiercle/actions/runs/38439173566)
FAILURE au setup : ingresshealthy, KCexit2 ; tests hébergés SKIPPED. Diagnostic
UIDimage1000/fichiersownerUIDrunner différent ; correction alignementS01_UID:0,
guardsnonroot/userexact, permissions0400 inchangées, vendorprobe1001exit0.
Rejeux natifs7/7 et browser2/2 PASS (3.3min), Review localePASS_WITH_MINOR0Critical/Major ;
nouvelle CI complète et ultimeLeadTech encore requis.
Ce checkpoint ne prétend pasqualifierUID1001 par la seule localeUID1000.

## Troisième CI — checkpoint1edc7b6

[38440935825](https://github.com/issa-diallo/dossiercle/actions/runs/38440935825)
FAILURE au bootstrapHTTP après7serviceshealthy/UID1001/migrationPASS ; validations
suivantesSKIPPED. BootstrapTLSvérifié/borneorigine et erreurs sanscorps corrigés,
setup idempotent/transportnégatifs/native7/browser3 PASS ; ReviewPASS_WITH_MINOR0Critical/Major.
Nouvelle CI complète et ultimeattestation indépendante sur sesSHA restent requis.
Tous ces champs CI sont checkpoints avant fusion ; preuve finale session/PR.

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
