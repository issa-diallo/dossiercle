# Review — #74 / S01 T06 — Lead Tech PR

## Verdict historique et portée

**PASS_WITH_MINOR — Critical0, Major0**, sur la tête
`10941bb05d744c1415d2a492ca9dbb1b9b95408e` de la
[PR #75](https://github.com/issa-diallo/dossiercle/pull/75).
Le recheck ciblé décrit ci-dessous corrige LT-M1 ; LT-M2 reste suivi avant une
montée majeure de pg. Ce rapport ne peut pas attester son propre commit : après
sa publication et la CI correspondante, l'attestation finale hors diff fera foi.

## Révision et indépendance

- Reviewer : `/root/t06_lead_tech_final`, distinct de l'implementer
  `/root/t06_implementer_complete` et du premier reviewer `/root/t06_setup_reviewer`.
- Mission LARGE, profil Lead Tech de REVIEWER ; lecture seule, aucun test/service,
  changement de fichier/index/DB, commentaire ou approbation GitHub.
- Configuration demandée et disponible : `gpt-6.1-sol`, effort `xhigh`, pour la
  sécurité complexe des capacités, verrous, fencing et isolation multi-agence.
  Coût et fonctionnement interne non observables ; aucune mesure inventée.
- Base examinée : `b18cd38b2c93234211c3c66bba654d63f297149c`.
- Tête examinée : `10941bb05d744c1415d2a492ca9dbb1b9b95408e`.
- GitHub vérifié directement le2026-10-16 vers20:20UTC : PR ouverte, quatre
  workflows SUCCESS attachés à cette tête, base/tête conformes.

| CI de la révision examinée | Résultat |
|---|---|
| [Documentation](https://github.com/issa-diallo/dossiercle/actions/runs/38958552653) | SUCCESS |
| [T04](https://github.com/issa-diallo/dossiercle/actions/runs/38958552745) | SUCCESS |
| [T05](https://github.com/issa-diallo/dossiercle/actions/runs/38958552884) | SUCCESS |
| [T06](https://github.com/issa-diallo/dossiercle/actions/runs/38958552480) | SUCCESS |

## Inputs reviewed

Diff et dix AC avant conclusions existantes ; README/AGENTS et règles de méthode,
sécurité, développement et PR ; Research/Design/Plan/amendements, Execute/Verify,
Review/Goal/Handoff/Ship. ADR utiles à l'isolation PG, dispatcher fermé, journal
indépendant, gates proportionnés et D57. Lecture approfondie migrations/capacités,
saga/effets/verrous, coffres, routeur, transport, reprise hôte et tests associés.
Skill `secure-web-dev` appliquée. Sorties privées, receipts et empreintes ainsi que
logs CI T04/T05/T06 examinés sans publication des logs bruts.

## Findings

### Critical / Major

Aucun.

### LT-M1 — listeners après refus du verrou global — corrigé, CI finale requise

`packages/adapters/src/postgres/provisioning-session.ts` attachait deux listeners
anonymes avant l'acquisition du verrou. Un refus busy rendait le client au pool
sans les retirer : répétitions pouvaient retenir sessions/listeners et provoquer
avertissements/mémoire inutile. Aucune capacité privilégiée acquise sur ce chemin,
aucun contournement d'autorité ou de gate identifié.

Correction par l'orchestrateur : handlers nommés, `retire()` invalide et détache
sans notification de perte, sur busy, échec et fermeture. Le Lead Tech a relu le
delta et donné **PASS statique**, sans nouveau finding ; locks/gate/autorité inchangés.
Tests exécutés : vingt busy sur même client sans listeners retenus, échec
d'acquisition nettoyé, fermeture normale et notification unique de perte.
Build complet,107 unités et23 contrats PASS code0. Log privé
`.local/evidence/t06-lead-fix-checks.log`, SHA-256
`724db26ee79ae15d18cf0f665810f12624a99fa4e93759ed5d28959b9e04853a`.
Responsable : orchestrateur ; correction effectuée avant tête finale. Les suites
PG/processus seront revérifiées par la CI de cette tête avant attestation finale.

### LT-M2 — sérialisation implicite pg8 — suivi non bloquant

Vérifications concurrentes du test de saturation via `provisioning-attempt.ts`
et `provisioning-session.ts` : même client central et avertissement de dépréciation.
Tests locaux et CI passent, aucune violation des barrières constatée. Les logs
n'ont pas de stack de dépréciation ; attribution fondée sur source et scénario.
Qualifier puis sérialiser explicitement cette surface avant une montée majeure
de pg. Responsable : Lead Tech/mainteneur ; échéance : avant cette montée majeure.

## Acceptance criteria

| AC | Avis Lead Tech sur la révision examinée |
|---|---|
| 1 | Source durable et autorité rechargées ; aucune DSN/identité SQL/secret client accepté |
| 2 | Intentions/références préalables, propriété/OID/empreintes, conflits fermés et reprises testées |
| 3 | Session détentrice unique, invalidation sans reconnexion, gate durable et fencing attesté |
| 4 | DB fermée puis révocations/migration/ACL ; API sans DDL |
| 5 | Bases/rôles distincts, refus interbases et substitutions post-connect testés |
| 6 | Coffres liés/versionnés, modes privés, pas de régénération aveugle, marqueur/checksum |
| 7 | Pools/admission/timeouts mesurés ; LT-M1 mineur corrigé avant tête finale |
| 8 | Outbox stable, signatures natives, mTLS, ack perdu et réveils persistants bornés |
| 9 | Six confirmations et audit avant READY/SUCCEEDED, ADMIN PENDING, accès fermé |
| 10 | Preuves locales et quatre CI vérifiées ; revalidation après toute nouvelle tête |

## Architecture, sécurité et preuves

Stack/contrats respectés ; taille justifiée autour des barrières indivisibles.
Autorité/J1 conservés pendant effets et actions tenant. Séparation orchestrateur/
provisioner et identités DDL/migration/runtime ; contextes opaques et readbacks
post-connect. Aucune expiration de bail ne rouvre seule le gate. Migrations0004/
0005 additives, SQL historiques inchangés. Rollback : arrêt et compatibilité
examinés, aucun down/DROP/reset ni résurrection d'autorité. D57 préservée.

Receipts/empreintes des124 historiques,35 runtime T06+18 unités+2 contrats,
105 unités globales/23 contrats et13 natifs concordants. Ces ensembles se
recouvrent et ne constituent pas un total additionnable. CI courante : seize
pannes process/audit, trois scénarios moteur, canaris/scans et états exhaustifs/
disjoints sans ACTIVE ni ADMIN actif. Après LT-M1, unités globales107 et unités
ciblées session4 ; le runner final doit intégrer ces deux nouvelles assertions.

Corrections post-Review recevables : J1 conserve TLS neuf503, journal absent et
récupération200 ; readiness TCP exclut PostgreSQL temporaire sur socket. Trois
bootstraps froids ont passé. Cela n'établit pas la cause interne de l'ancien
arrêt Inngest, qui reste inconnue dans les preuves conservées.

## Risques, limites et recommandation

Wiring syntheticOnly avec allowlist obligatoire pour protéger T05 ; aucune
consommation automatique hors manifeste. Aucun runtime hors fixtures, déploiement,
IAM cloud, PRA ou capacité commerciale qualifié. Effet incertain : indisponibilité
conservatrice ; coffre tmpfs perdu : aucune régénération aveugle. READY technique
ne confère aucune activation T07, accès métier, IA, module ou connexion mail.

Avis favorable à une fusion future **sous validation humaine D57**, sans autoriser
fusion/déploiement/cleanup. Après commit de ce rapport/correction et CI de tête,
demander au même Lead Tech l'ultime attestation en lecture seule sur base/tête
définitives ; conserver cette attestation dans la session, sans nouveau commit.
Le verdict définitif de livraison est celui de cette attestation hors diff,
référencée par [Ship](ship.md), pas celui de ce rapport historique.
