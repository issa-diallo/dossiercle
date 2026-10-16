# Review — #74 / S01 T06

## Verdict

**PASS_WITH_MINOR — Critical0, Major0.** Verdict indépendant consolidé transmis
par l'orchestrateur le2026-10-16 après vérification des sorties intégrales et
recheck documentaire final. Un Minor pg est suivi avant montée majeure ; aucun
finding bloquant ouvert. Cette Review technique ne vaut ni CI ni examen Lead Tech PR.

## Révision et indépendance

- Mission : revue globale technique de l'implémentation, après Execute/Verify.
- Reviewer : `/root/t06_setup_reviewer`, indépendant de l'unique implementer
  `/root/t06_implementer_complete`. L'orchestrateur `/root` transmet le verdict.
- Modèle/effort réellement utilisés : non exposés au writer ; aucune valeur inventée.
- Révision : base et HEAD local `b18cd38b2c93234211c3c66bba654d63f297149c`,
  branche `feat/74-s01-t06`, diff de travail non committé incluant fichiers non suivis.
- PR/CI : pas encore de PR ni CI de tête à cette phase. Contrôles requis dans Ship.
- Périmètre : code, migration/capacités, saga et fencing, coffres/routeur, transport
  Inngest/mTLS, admission/état, provenance fixtures, bootstrap/CI et preuves réelles.
- Le reviewer travaille en lecture seule et n'a pas exécuté de suite ni muté de ressource.

## Inputs reviewed

[Ticket/AC](ticket.md), architecture/ADR applicables référencés par
[Research](research.md), [Design](design.md), [Plan](plan.md),
[Execute](execute.md), [Handoff](handoff.md), [Verify](verify.md),
[revues ciblées](implementation-reviews.md), sources du diff et fichiers nouveaux.
Les sorties intégrales privées et leurs receipts ont été vérifiés ; les seules
empreintes/compteurs publics sont consignés dans Verify.

## Findings et historique

### Critical / Major

Aucun ouvert. Le finding initial sur les créations HTTP hors manifeste a été
retiré après arbitrage explicite de Design §9 : le candidat est syntheticOnly,
son allowlist additionnelle protège T05. Aucun wiring nonsynthétique ni déploiement
n'est qualifié, aucune consommation globale des anciennes agences n'a été activée.

### Preuves initialement BLOCKED, puis correction vérifiée

La Review a d'abord refusé d'attester35 cas T06 et124 historiques sur les seuls
résumés, faute de logs complets accessibles. Les sorties n'ont pas été reconstruites :
les deux commandes ont été rejouées séquentiellement, logs0600, code0 et receipts
SHA-256 vérifiés par le reviewer. Les13 natifs, build,105 unités et23 contrats
avaient aussi leurs sorties privées conservées. Le refus d'évidence est clos.

Le Minor du test moteur STOP hors try a été corrigé : STOP/inspect/assert sont
sous try/finally garantissant CONT. Le runner complet avec moteur3/3 a été rejoué
après cette correction, sans changement de runtime. Le Minor documentaire dû au
snapshot Verify transitoire est clos après relecture finale de Verify/Execute/
Handoff/STATUS alignés sur les résultats capturés.

### Minor restant : dépréciation de concurrence pg8

Le test de saturation lance volontairement plusieurs queryVerification simultanées.
Leurs revalidations utilisent le même PoolClient central détenteur ; pg8 sérialise
les requêtes et avertit de l'abandon de cette file implicite en pg9. Attribution
source : test isolation lignes109/126 → ProvisioningAttempt.verificationContext.check
→ ProvisioningSession.verify. Le log ne comporte pas de stack trace de dépréciation ;
cette limite est conservée. Les tests passent, les verrous et délais sont vérifiés.

Responsable : Lead Tech / mainteneur. Échéance : avant toute montée majeure de pg,
qualifier puis sérialiser explicitement cette revalidation si cette surface demeure.
Aucun changement de pin ni correction spéculative n'est intégré à cette livraison.

## Acceptance criteria

- [x] AC1 — événement et autorité rechargés au centre, aucune capacité issue d'un locator ou secret client.
- [x] AC2 — PREPARE, références/OID/empreintes stables, reprise et conflits conservés.
- [x] AC3 — pannes process réelles, perte lock, ancien émetteur fermé et fencing certain.
- [x] AC4 — DB fermée aux frontières, migrations/ACL et droits futurs vérifiés.
- [x] AC5 — isolation réelle, identités opaques et bindings post-connect.
- [x] AC6 — coffres immuables, pertes/bindings divergents refusés et rotation qualifiée.
- [x] AC7 — pools/timeouts/plafond réel et admission100 sans consommation au refus.
- [x] AC8 — moteur signé réel, mTLS, replay/ack perdu, wakeups et reprise bornée.
- [x] AC9 — audit local obligatoire et état public sans refresh ni activation.
- [x] AC10 — vérifications locales et non-régressions admises ; CI et Lead Tech PR
  restent obligatoires durant Ship avant READY_FOR_HUMAN.

## Architecture, sécurité et evidence assessment

Stack/pins respectés, autorité/J1 tenue, isolation tenant et permissions SQL réelles,
validation des entrées, secrets et logs protégés. Confirmation privée synthétique
bornée au mandat de tests ; aucune action humaine réelle simulée comme acquise.
Preuves runtime crédibles et détaillées :124 historiques,35 PG/process/moteur T06,
18 unités ciblées/2 contrats,12 canaris ;105 unités globales/23 contrats et13 natifs.
États finaux exhaustifs/disjoints, aucun ACTIVE ni ADMIN actif. Les limites de
qualification synthétique et de stack warning sont explicitement conservées.

Verdict final technique : **PASS_WITH_MINOR**. Goal technique peut être SATISFIED.
Ship doit encore créer la PR, obtenir sa CI et l'examen Lead Tech indépendant.

## Recheck après première CI

`/root/t06_setup_reviewer` a examiné le delta J1 des deux fichiers de tests natifs,
puis vérifié le receipt et le log du rejeu ciblé : **PASS**, aucun finding ajouté.
Le test conserve startup `false 1`, J1 absent et TLS neuf strict503 ; il distingue
transport navigateur0/HTTP503 et exige la récupération navigateur/TLS200.
L'observation J1 est maintenant conservée séparément dans le receipt de panne.
Le rejeu code0 démontre navigateur0/TLS503 ; le statut historique CI reste inconnu.
Empreinte et commande dans [Verify](verify.md). Aucun scénario, retry ou timeout
supprimé. La Review globale reste **PASS_WITH_MINOR** pour le seul warning pg.
