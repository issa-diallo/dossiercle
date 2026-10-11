# Dossier d’arbitrage Architecture — ARCH-B02-B12

> **Note d’état courant — 2026-10-11 :** ce dossier et sa matrice sont un instantané consolidé avant D72 et avant l’approbation humaine du niveau local B09. D72 clôt ensuite le choix Keycloak/Mistral/Inngest ; B12 est clos par décision pour le choix stack/outillage, et `R-B07-01` ne concerne que Better Auth 1.7.7. L’utilisateur a approuvé la clôture de la qualification algorithmique locale B09 ; les preuves durables restent Verify/QA. Pour le gate courant, lire l’[audit B01–B12 post-#60](../agentic/work/architecture-gate-2026-10-11.md), l’Architecture canonique et STATUS. Cette mise à jour ne réécrit pas la provenance des propositions ni leurs statuts historiques.

> **D71 — 2026-10-11 : stack validée, POC arrêté sur demande utilisateur.** React 19, TypeScript 6, Vite 8 ; NestJS 12, Node.js 24, Express 5 ; PostgreSQL 17/Drizzle ; Better Auth/NestJS ; Inngest ; Vitest, Playwright, k6 et OpenTelemetry sont les choix acquis. Le POC n'est plus un préalable à leur adoption. B12 : choix stack/outillage clos par décision, preuves techniques restantes dans les stories. Aucun nouveau POC/reprise autorisé. Les mentions antérieures de stack proposée, de POC à terminer avant adoption et d'acquisition encore autorisée sont supersédées dans cette portée. Architecture globale non qualifiée, exigences sécurité et décisions d'exploitation encore ouvertes. [D71](ARCHITECTURE_DECISIONS.md#d71), [preuve d'arrêt](../agentic/work/b12-p-1-bootstrap/evidence/user-stop.json).

Consolidation : **2026-10-11**. Observations et tests : **2026-10-10**. Mode LARGE. **ARCHITECTURE: BLOCKED**. État à la consolidation : B09 `QUALIFIED_LOCALLY_PENDING_HUMAN — CLOSURE_PROPOSED` ; statut courant post-approbation utilisateur : `QUALIFIED_LOCALLY — HUMAN_APPROVED` (preuve référencée ci-dessus). B11 : **PASS humain documentaire — D69**.

Ce dossier prépare les arbitrages et transpose les décisions acquises. Aucune recommandation nouvelle n’est adoptée. Aucun nouveau POC, compte fournisseur, ressource cloud, donnée réelle ou dépense n’a été utilisé. Les choix, acceptations de risque, installations et contrats nouveaux nécessitent une décision distincte.

## Autorité et décisions acquises

Le travail reprend au gate produit Architecture. Les PASS historiques PRD → Stories → Story Review restent limités à leurs corpus initiaux. Le [plan](../agentic/work/arch-b02-b12/plan.md) autorise cette préparation documentaire. Design System attend Architecture ; S01–S37 restent BACKLOG, avec identifiants, dépendances et cinq charges conservés.

Le [registre](ARCHITECTURE_DECISIONS.md) porte les décisions. Q1–Q6 et le plan historique sont conservés sans modification. [F17](ARCHITECTURE_RESEARCH.md#f17--actualisation-et-consolidation-du-2026-10-11) rassemble les sources, leurs dates et limites. Une page fournisseur ne constitue jamais une preuve runtime.

Les confirmations #33 du 2 octobre sont transposées dans D60–D68 : session absolue de 15 jours et inactivité humaine de 30 minutes ; trois comptes individuels, administrateur compris, et deux boîtes Sinistres/Location ; originaux traités temporairement, faits et provenance descriptive conservés ; export dérivé sans EML ni pièces ; retrait du dépôt client et de son OTP ; période historique stricte sans défaut, confirmation dans l’application, sans mandat implicite ; fermetures manuelles et couverture depuis le dernier rapport envoyé ; cible critique 24/7 avec propriétaire et prestataire, sans engagement acquis.

D67 reprend les décisions temporelles #42/#50/#51 : créneaux dans les horaires, retard traité strictement avant le prochain créneau et activation du binding. D59 adopte Cloud SQL PostgreSQL 17 Enterprise HA Paris, PITR et TLS, avec risque accepté : B01 est clos par décision. D58 conserve RPO et RTO chacun strictement inférieurs à quatre heures pour catastrophe incluant perte datacenter/AZ. Ces choix ne sont pas rouverts.

D01–D59 et les anciens ADR gardent leur historique et leurs supersessions. Le [rappel humain #33](https://github.com/issa-diallo/dossiercle/issues/33#issuecomment-5967415396) interdit un PASS automatique B09, B11 ou Architecture après POC.

## Matrice des blocages

Les responsables sont des rôles à affecter. Les choix structurants et qualifications indispensables précèdent Architecture ; les suites complètes restent Verify/QA avant mise en service.

| Bloc et statut | Dépendances | Sortie avant Architecture | Preuves QA futures |
|---|---|---|---|
| B02 BLOCKED | B04/B03/B07/B12 | Licence, exception persistante, topologie/coût, Redis/PG et protocole d’effets qualifiable | Annulation, replay, vieux worker, partitions, reconstruction et rétention |
| B03 BLOCKED | B02/B04/B08/B10 | Journal indépendant, point cohérent, reconstruction, organisation et coût | RPO et RTO AZ chacun strictement < 240 min, pertes visibles, aucun droit ressuscité ni doublon |
| B04 BLOCKED | B02/B01 clos | Réseau inter-cloud, identité, coffre, IAM et flux | Latence, pools, cold starts, AZ/Gateway, rotation et callbacks |
| B05 BLOCKED | B04/B02/B08 | Contrats par capacité/boîte, profils IMAP et qualification Q3 | Fournisseurs, curseurs, quotas, tags, incertitude et période stricte |
| B06 BLOCKED | B08/B02/B04 | Modèle/région/contrats, benchmark Q3, coûts et enveloppe | Ledger concurrent, purge, injections, BYOK et fallback |
| B07 BLOCKED | B04/B12/B03 | Routes/versions, récupération approuvée et B07-P-1 complet Q4 | UI/support, restauration auth, clés, audit et charge |
| B08 BLOCKED | B06/B03/B05/B10 | Taille, formats, quotas, durées/finalités, contrats et tombstones | Purge, AV, caches, retries, backups, export et droits |
| B09 `QUALIFIED_LOCALLY — HUMAN_APPROVED` | B11/B02/B07/B03 | Niveau algorithmique local #50/#51 accepté pour clôture du gate Architecture par décision humaine | PG, crash/restart, multi-workers, transport/réconciliation et tzdb durable en Verify/QA avant mise en service |
| B10 BLOCKED | B03/B08/B04 | SLO, couverture, personnes/prestataire, budget et runbooks | Exercices et délais réels de mobilisation/reprise |
| B11 PASS humain documentaire — D69 | B09/décisions produit | Verify, revue et accord humain B11 acquis ; autres gates distincts | Nouveaux critères dans Verify des stories |
| B12 CLOSED_BY_DECISION D71 — choix stack/outillage | Contrats des stories concernées | Choix stack acquis, POC arrêté ; pas de nouveau POC préalable | Research/Plan figent versions/lock ; Execute/Verify/Review couvrent CI/SBOM, E2E, cinq charges, OTel, promotion et rollback |

Préparer B11 et examiner B09 d’abord ; traiter B02/B04 ensemble, puis B03/B08. D71 arrête les POC et adopte la stack : l'achèvement B07/B12 ne conditionne plus le choix d'outillage. Les exigences de sécurité B07 restent à résoudre avant Execute des stories auth. B05/B06 dépendent des profils, de la privacy et du budget. Préparer B10 en parallèle. Aucune vague Execute produit avant Architecture et Design System PASS.

## Infrastructure et reprise : recommandations

Inngest est choisi comme moteur par D71 ; finaliser séparément son exploitation. Analyser SSPL pour l’usage SaaS ; la concession Apache future ne vaut pas licence actuelle. Comparer Instances sur trois AZ et Kapsule, avec exploitation, coût fixe et exception au tout-serverless explicites. Localiser séparément le PG technique Inngest ; D59 ne décide pas implicitement son hébergement. Redis ne devient pas un journal métier : reconstruction depuis intentions, outbox et timers PG à démontrer. Autre licence ou moteur exige ADR/arbitrage.

Le [protocole proposé](ARCHITECTURE_PROTOCOL_PROPOSAL.md) détaille A, dispatcher sérialisé avec failover fermé, et B, porte d’egress durable. Admission et début réseau restent distincts. Un fence ignoré par SMTP ne protège pas contre un ancien processus réveillé. Aucun exactly-once externe ni nouvelle sémantique du stop n’est adopté.

Étudier Cloud SQL privé via VPN/routage inter-cloud redondé, TLS et rôles distincts. Private Network Scaleway seul n’ouvre pas le VPC Google. L’alternative publique avec connector/proxy nécessite une exception explicite à « aucun port PG public ». WIF Google/OIDC et bootstrap Scaleway sont distincts : CSI Scaleway exige encore une clé statique scoped, avec risque/rotation à décider. Callbacks : SDK épinglé, `enableUnauthedSync:false`, signature, méthodes, rotation et anti-rejeu ; signature ≠ autorisation métier. Administration privée, aucun credential global chez worker.

Pour PRA, comparer J1, journal minimal de refus/epochs/tombstones hors ensemble restaurable, et J2, fermeture globale/revalidation humaine dont le RTO est fragile. Manifestes et watermarks causaux couvrent tous les stores ; le minimum des timestamps ne prouve pas un point cohérent. Mail retrouvé ne reconstruit pas validation, mandat, révocation ou téléphone. Invalider sessions restaurées et réconcilier avant réouverture lecture → manuel → autonomie autorisée. Chiffrer le risque régional séparément.

Les totaux Q2/Q5 avec PostgreSQL Scaleway sont historiques. Recalculer Cloud SQL, HA/PITR, stockage/backups, réseau/egress, runtime/Redis, IA, observabilité, QA et opérateurs, sans SKU, densité ou devis inventé.

## Intégrations, privacy et offre : recommandations

Conserver les trois connecteurs et qualifier chaque boîte/capacité. Tags ou fraîcheur non prouvés : manuel pour cette boîte. Gmail exige scopes/onboarding et assessment appropriés ; Graph préserve permissions/catégories/delta ; IMAP exige profils serveur/client, TLS, UIDVALIDITY/PERMANENTFLAGS et SMTP distinct. Références descriptives minimisées sans lien cliquable. Aucun curseur expiré n’autorise le hors-période ; simulateur local ≠ fournisseur qualifié.

Qwen3.6 reste candidat ; Qwen3.8 au catalogue ne change pas le choix sans benchmark. Gold set Sinistres puis Location, extraction locale puis vision/OCR conditionnelle. Seuils Q3 : JSON/provenance essentielle complets, zéro fait essentiel faux/non sourcé, clarification des incertitudes essentielles, zéro instruction hostile exécutée. Mesurer tokens, pages, retries, réservations inconnues, latence et coûts avant enveloppe commerciale.

Prix Scaleway historiques non regelés après erreur de page. Mistral Small4 : 0,15/0,60 USD par million entrée/sortie ; OCR4.1 : 4 USD/1 000 pages. Garder EUR/USD séparés. Disponibilité compte/région à prouver ; +10 % tokens régionaux ne fixe pas le supplément OCR.

Scaleway peut conserver HTTP complet deux semaines en incident/abus, usage agrégé six mois et cache éphémère automatique non désactivable : acceptation/refus explicite requis. Mistral ZDR exige demande approuvée, preuve compte et flux stateless ; opt-out entraînement distinct. EU couvre UE/EFTA, control plane potentiellement ailleurs. Consentement BYOK et clé valide ne prouvent pas conformité.

Proposer 20 000 000 octets, « 20 Mo » ; alternative 20 MiB, « 20 Mio ». Contrôle serveur, dépassement visible sans IA/troncature, limites pages/temps/mémoire distinctes. Réception large et IA étroite, allowlist progressivement qualifiée ; autres pièces traitées humainement dans la messagerie.

Purge proposée après extraction, plafond local 24 h tous états : durée ouverte à challenger AV/retry/métier. Fournisseur deux semaines reste distinct. Diagnostic 30 jours et sécurité six mois sont candidats ; audit séparé. Métier : durée commune post-clôture après revue, options 2/3/5 ans sans règle légale universelle. Backups 30 jours conditionnels, export 24 h hérités ; tombstones couvrent tout horizon restaurable. Aucun original durable via caches/logs/backups/export.

Revoir rôles agence responsable du traitement/DossierClé sous-traitant métier, finalités propres, bases légales, contrats, transferts, droits et durées avant données réelles. Quotas/prix/alias restent ouverts. Proposer lots sous plafond ferme, estimation dans la période, sans compteur Qwen interdit agence ni surfacturation automatique.

## Qualifications locales et exploitation

Les [POC proposés](ARCHITECTURE_POC_PROPOSAL.md) détaillent B07/B12, gate Q4 intégral. **Deux heures sont un plafond de tentative, pas une estimation de PASS complet.** Propositions : zéro dépense externe, 2 Go téléchargés mesurés, 4 CPU/8 GiB RAM/15 GiB disque, versions/hashes/allowlist explicites. Les découpages 6 h/8 h ne sont pas approuvés. Préflight, Node 24 isolé, runtime local sans Internet, limites, arrêts, preuves et nettoyage ciblé restent obligatoires.

B07 couvre notamment MFA, codes non relisibles, consommation atomique, idle humain/absolu, révocation et récupération. B12 couvre builds répétés, dépendances/licences, isolation PG, SDK, OTel, OpenAPI, tests, SBOM et promotion/rollback locaux. Versions candidates ≠ gel validé. Dépassement ou échec : BLOCKED, aucun enchaînement automatique.

B09 : [#42](https://github.com/issa-diallo/dossiercle/issues/42#issuecomment-5966676710), [#50](https://github.com/issa-diallo/dossiercle/issues/50), [PR #51](https://github.com/issa-diallo/dossiercle/pull/51), commit `1654fb572c235f101cfc7a04473ac10c8e4f0507`. 63 tests rejoués deux fois sous Python 3.12.3 le 10 octobre, log `/tmp/dossiercle-arch-b09-verify.log` à archiver. CI documentaire SUCCESS ; revue narrative PASS, aucune GitHub review enregistrée. Mémoire/RLock ne prouvent pas crash de processus. Proposer clôture algorithmique locale avec durabilité QA explicite ; sans revue et accord humain, aucune clôture officielle.

B10 : proposer SLO interne 99,5 %, alternatives 99,9/99,95 %, sans SLA client. Couverture critique 24/7 à contractualiser avec relais/budget. Proposer détection SEV1 ≤5 min, accusé ≤15 min, confinement ≤30 min ; D58 global reste <4 h. Support fournisseur ≠ résolution ≠ RTO. Conserver vingt runbooks Q5 et exercices avant service.

## Décisions demandées

Liste d’actions rédigée avant les décisions D71/D72 et l’approbation humaine B09 du 2026-10-11 : les arbitrages B02–B08/B10 restent à traiter ; la ligne « revoir B09/B11 » est historique et ne représente plus une action ouverte. Aucun report QA ni risque accepté n’est déduit tacitement de D59. Architecture reste BLOCKED.
