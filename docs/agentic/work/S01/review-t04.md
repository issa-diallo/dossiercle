# Review indépendante — T00–T04

## Verdict

**PASS_WITH_MINOR — 2026-10-13. Critical0, Major0.**
Portée : livraison technique T00–T04 seulement. S01 reste IN_PROGRESS.

## Révision et indépendance

Reviewer /root/s01_environment_review, distinct de l’implementer /root,
lecture seule. Modèle hérité ; nom/effort/coût effectifs non observables.
Base075602916355813cf4e8d3f952fadaec5e637398 ; diff worktree précommit et ses
correctifs successifs examinés. Pas de PR/CI hébergée à cette revue : Ship distinct.
Aucun test/service/fichier modifié par le reviewer ; preuves implementer lues.

## Entrées et assessment

Story S01, Research/Design/Plan et revues validées, architecture/ADR/contrats OTP,
diff de socle T00–T04, environnement/revue Setup, [Verify](verify-t04.md) et
preuves ciblées, harnais natif et scanner indexé. Build, unités37, intégration58,
browser12/12 et ciblé faults1/1 confirmés dans les logs minimisés.
Le dernier cas observe503 natif puis nouvelle MFA/logout, sans inventer401.
Le refus d’un SID absent est couvert séparément sous SQL réel/frontière native
simulée. Le scanner vérifie les secrets privés connus du présent environnement,
jamais une absence universelle de secrets inconnus/historiques.

## Findings corrigés

- Denial temporaire après changement natif : J1DENIED/epoch+1 durable, toutes
  sessions révoquées, audit, COMMIT avant refus ; ancienne restauration fermée.
- Sujet natif absent404 distingué d’une panne ; SID terminé ferme sa session,
  sans DENY global du compte. Receipt exactement lié au cookie/SID relu.
- Clients/grants/consoles hérités et offline fermés, bearer-only explicites.
- J1/clés absents au restart : aucune création silencieuse, accès fermé.
- Rotation fournisseur réelle sur clone privé, nouvelles clés, revalidation,
  export RAM sans swap/coredump, dump canary renforcé, aucun faux PASS de dry-run.
- Harnais navigateur : ancienne page native quittée sans changement de jar/origine
  avant POST concurrent, pas de bypass applicatif ni de retry masquant un finding.

## Findings ouverts

Critical : aucun. Major : aucun. Nit bloquant : aucun.

Minor1 : double acceptation native des secours concurrents (`DOUBLE_ACCEPTED`,
5/5 expériences privées en échec au checkpoint). Contenue par grant/J1, formulaire
à usage unique, sérialisation backend et fermeture de tous accès natifs alternatifs.
La propriété qualifiée est composite, jamais consommation atomique native PASS.
Suivi : mainteneur, avant upgrade Keycloak ou ouverture de routes/grants.

Minor2 : UI native précédente privacyIDEA3.14, nécessaire au token mémoire sans
browserStorage ; version figée, upgrade après requalification. Suivi : mainteneur,
avant tout upgrade PI et avant mise en service.

## Conformité et conclusion

Stack/contrats conservés, contrôle backend/J1, fixtures synthétiques, pas de secret
observé, aucune activité métier ni activation IA/modules/mail. Aucun AC complet
d’activation S01 coché ; T05 non démarré. Les checkpoints historiques sont conservés.

Review **PASS_WITH_MINOR**, favorable à Ship T00–T04 sous CI/Lead Tech de tête.
Cette revue n’autorise aucun déploiement et ne remplace pas le mandat humain de fusion.

## Correctif après CI — confirmation finale

Échec setup CI2871afb : ingress lancé avant PI. Le rejeu local1FAILED/1PASS a
révélé un bind fichier config périmé. Correction validée indépendamment : ingress
attend PI healthy ; répertoire readonly expose les remplacements atomiques ;
bootstrap main/server et healthcheck alignés ; readback exact avant restart,
sans impression de secret. Aucun credential supplémentaire accessible.

L’ancienne preuve de clé absente est invalidée. Requalification complète relue :
build PASS, unités37/37, intégration58/58, navigateur12/12 en9.5min, dont owner
platform et clé absente avec configuration réellement vue. Après restart KC :
200/J1 inchangé puis nouvelle MFA forte et logout PASS ; aucun401 natif inventé.

**Confirmation finale du reviewer : PASS_WITH_MINOR, Critical0/Major0.**
Minors inchangés. CI de tête et ultime Lead Tech restent obligatoires avantmerge.
Aucun test ni mutation exécuté par le reviewer.

## Correction UID — confirmation finale locale

Deuxième CI34a31ba : ingresshealthy puis KCexit2. ImageUID1000/fichiersownerUIDrunner
justifient l’alignement UIDhostnonroot/GID0 natif ; guardssetup/userexact. Secrets
0400/RO inchangés, aucune capability ou règleMFA modifiée. Source relue PASS.
Readback natif7/7 et navigateurTOTPplatform+faults2/2 PASS (3.3min), KC200/J1
inchangé puis nouvelleMFA/logout. UIDlocal1000:0 inchangé ; probeimage1001 ne
qualifie pas le parcours complet1001. CI neuve full12 obligatoire.
**Review finale du delta local : PASS_WITH_MINOR, Critical0/Major0.**
Aucun test ni mutation par le reviewer. Minors fournisseurs inchangés.

## Bootstrap TLS — Review finale

Source et preuves relues : connexionIPnative/SNIkeycloak/CAretenue, origine HTTPS
exacte, pasproxy/redirect/fallbackHTTP ; erreurstatutseul/corpsnonpublié/cap1MiB.
Minor helperorigines fermé par garde et tests HTTP/foreign avant réseau. TLS positif,
mauvaiseCA/mauvaishostname réellement refusés ; redirectHandler testé directement.
Setup idempotent, readback7/7 et browser3/3PASS. DeltaTLS PASS, globalePASS_WITH_MINOR,
Critical0/Major0 ; deuxMinors fournisseurs conservés. NouvelleCI et ultimeLeadTech
restent requis. Aucun test ni mutation du reviewer.

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
