# Review — Design #74 / S01 T06

## Révision1 — CHANGES_REQUIRED

Revue indépendante `/root/t06_reviewer`, 2026-10-16, base b18cd38 ; Design DRAFT,
Research PASS, ticket, préparation S01, architecture et code confrontés.
Lecture seule, aucun test/service/secret/.local ni publication. Modèle/niveau hérités,
détail/coût non observable. Rapport consigné par /root, auteur distinct.

### Critical

Aucun.

### Major D1 — SELECT seul ne permet pas les verrous centraux prévus

Design initial matrice droits et ordre de verrous incompatibles : FOR SHARE/
KEY SHARE/UPDATE exige droit UPDATE sur au moins une colonne. Donner ce droit à
identity au provisioner élargirait inutilement sa capacité ; SELECT simple perdrait
la sérialisation. [Source PG17 SELECT](https://www.postgresql.org/docs/17/sql-select.html).
Correction demandée : helper SECURITY DEFINER borné operation→tuple serveur,
search_path sûr/PUBLIC révoqué, ordre normatif et tuple minimisé ; assertions PG
négatives et concurrence planifiées. Correction consignée dans Design section4.

### Major D2 — montage du coffre sans writer et topologie API imprécise

Runtime annoncé RO aussi dans provisioner alors que la saga doit y écrire.
En outre API tourne actuellement dans coordinator (main.ts:6–8) : interdire tout
secret runtime à ce même process contredit le besoin routeur API.
Correction : runtime RW provisioner/RO process API-coordinator ; migration RW
provisioner uniquement, aucun mount parent ou clé DDL ailleurs ; topologie
partagée réelle explicitée. Correction consignée dans Design sections1/8.

### Minor / Nit

Aucun.

## Couverture et limites de la revue1

Intentions/gate durable avant effets, fencing réel, autorité service sans session,
READY sans ACTIVE, admission avant J1, fixtures séparées et migration additive
correctement couverts. Plafonds déclarés à configurer, pas résultats mesurés.
Aucune preuve runtime PG/isolation/Inngest/fencing acquise. Plan attend correction
et avis indépendant à jour. Relecture D1/D2 demandée après corrections.

## Révision2 — PASS

Retour indépendant `/root/t06_reviewer`, même base, relecture des corrections et
de leur impact global. Critical0/Major0 ; aucun finding supplémentaire retenu.

- D1 clos : helper SECURITY DEFINER borné, verrous ordonnés/tuple serveur, session_user
  et droits minimaux précis, aucun UPDATE identity accordé au caller.
- D2 clos : runtime RW provisioner/RO process API-coordinator, migration/DDL exclusifs
  au provisioner ; topologie réelle et absence de montage parent RW explicites.
- Index unique partiel exécutions ouvertes et ACL futures business cohérents,
  sans réécriture migration agency0001 ni fingerprint public changé par ces ACL.
- Saga, autorité, admission, reprise et isolation relus ; aucune contradiction
  bloquante nouvelle. Assertions concrètes dues en Execute/Verify.

Avis documentaire uniquement, aucun test/service exécuté. **DESIGN PASS** ; Plan
peut commencer. Ce verdict n’est pas une qualification des capacités futures.

## Révision3 — PASS après findings Plan P1/P2

La revue Plan a découvert deux précisions nécessaires de conception : absence de
protection automatique de l’ancien runtime et contrat de réveil non matérialisé.
Design repassé DRAFT sur ce delta pendant correction, puis relecture indépendante
`/root/t06_reviewer` : **PASS**, aucun Critical/Major ouvert.

P1 : migration hors ligne, anciens processus arrêtés/drainés et absence vérifiée,
ingress fermé ; migration/grants puis nouveau build identifié/check startup ;
ancien migrateur et ancien runtime distingués, rollback conserve fermeture.
P2 : table wakeup/compteur/UNIQUE, type schema1 défini, deux validations distinctes,
fonction bornée et ordre de verrous cohérent, rounds bornés et commande conservée.
Pas de régression admission/J1/gate/capacités/fixtures/READY observée en lecture.
Aucun test/service exécuté ; preuves de fonctionnement dues à Setup/Execute/Verify.


## Révision4 — PASS amendement provisioning

Relecture indépendante `/root/t06_setup_reviewer`, 2026-10-16, après findings Major
sur membership, compensation et ACL. Critical0/Major0.

- Membership relu avant/après GRANT : deux adhésions ADMIN bootstrap attendues,
  une adhésion SET temporaire `agm` avec flags/grantor exacts, révocation avant
  migration, assertion post-GRANT à trois lignes ; test final catalog exact et
  `SET ROLE agr` refusé. Replay restaure l’entrée SET via `createRoles` avant
  réouverture de la DB, puis la révoque.
- Compensation relâche les clients DDL avant fencing, désactive les nouvelles
  connexions, termine et compte les sessions, relit `datallowconn=false`; échec
  de preuve remonte un état incertain. Scénario statique d’injection checkpoint
  couvre fermeture puis replay.
- ACL futures business seulement ; objets runtime public/control en lecture seule,
  sans TEMP/CREATE, test canari business et assertions négatives présents.

Avis statique uniquement ; aucun test/DDL/service exécuté. Design amendé **PASS** ;
Execute continue, avec preuves PG et de panne dues.


## Révision5 — PASS fencing owner migration

Relecture indépendante `/root/t06_setup_reviewer`, 2026-10-16. Critical0/Major0 ;
statique uniquement. Le rôle `agm` owner de la base révoque PUBLIC/runtime/TEMP,
applique `ALLOW_CONNECTIONS false`, ferme son pool, puis le DDL relit le flag et
zéro session. Aucune terminaison de backend étranger ; une session persistante ou
un échec de readback reste incertain/BLOCKED. Rejeu : adhésion SET temporaire
restaurée puis révoquée. Design/Plan PASS ; preuve PG du protocole due en Execute.


## Révision6 — PASS erreurs ambiguës de fencing

Relecture indépendante `/root/t06_setup_reviewer`, 2026-10-16. Critical0/Major0 ;
statique uniquement. GRANT/SET/ACL/ALTER sont protégés par capture d’erreur ;
RESET, REVOKE et readback restent tentés même après une erreur de réponse. Toute
erreur d’action, de cleanup ou de preuve est agrégée et maintient l’état incertain.
Design/Plan PASS ; test PostgreSQL correctif toujours requis en Execute.

## Finalisation additive0005 et protocole — 2026-10-16

Reviewer indépendant `/root/t06_setup_reviewer`, lecture seule : PASS ciblé
Critical0/Major0 sur0005 et sa chaîne de checksum, après correction de deux Major
(chaîne migrateur absente ; gate non verrouillé lors réservation wakeup). PASS
ciblé du protocole session/backend/autorité après correction des Major de perte
des deux secrets et checkpoint schema nu. Le Minor progression retardée a depuis
été corrigé : chaque confirmation de frontière avance son step durable. Ces
avis ne remplacent ni les tests process/Inngest ni la revue finale.
