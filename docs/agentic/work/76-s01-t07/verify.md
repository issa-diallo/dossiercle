# Verify — #76 / S01–T07

**VERIFY: PASS — qualification locale complète sur le candidat non committé.**

Manifeste source : [implementation-manifest.json](implementation-manifest.json),
53 fichiers suivis/non suivis, HEAD/base `135f0eab07f017e9b8a35c704dd1342f53cc2b51`,
SHA-256 `bf532684652073f2cdafe086b95d10c660b3ba1f6b92aef467821d29454e13c9`.
Les modifications locales préexistantes ont été conservées.

## Commandes réellement exécutées

| Vérification | Résultat final observé |
|---|---|
| `pnpm test:activation` corrigé, runner complet | **PASS, exit0** ; setup/identity/migrate, typecheck/lint, unités/contrats, capacités/mTLS, T06, V3, V2 et scan séquentiels |
| `pnpm test:unit` / `pnpm test:contracts` dans ce runner | PASS, **114 / 25 tests** |
| Capacités T07 sur PostgreSQL réel + transport privé | PASS, **6 tests** |
| `pnpm test:provisioning` / T06 complet | PASS, PG **5+4+3+1+2+1+16+3** tests, puis unités T06 **22**, contrats T06 **2** ; aucun skip |
| Canaris et scan T06 | PASS, **12/12** canaris détectés, aucun match final |
| `pnpm test:auth` / V3 complet dans le dernier runner | PASS, **13/13**, **9,7 min** ; un V3 complet avait aussi passé avant les activations complémentaires |
| `pnpm test:integration` / V2 complet dans le dernier runner | PASS, **13** tests de schéma puis **123/123 sur 14 fichiers**, dont **12/12 T07**, sans skip ; **321,52 s** hors schéma |
| V2 complet corrigé distinct avant le runner final | PASS, exit0, même **13+123** tests ; **254,28 s** hors schéma |
| Retry renforcé ciblé après récupération | PASS, **1 test / 3 filtrés**, **70,09 s**, même base/références de secrets, attempt2 READY |
| `pnpm build` complet après le runner | PASS : typecheck, lint, API et web ; bundle web **219,70 kB / 68,67 kB gzip** |
| `bash scripts/worktree-setup.sh --check` final | PASS, contrôle RO identité/worktree |
| `bash scripts/s01-t07-identity.sh` final | PASS, client T07, CA vérifiée, fichiers privés0400 |
| `PYTHONDONTWRITEBYTECODE=1 python3 scripts/s01-worktree-identity-test.py` final | PASS, **25 cas Git**, zéro service lancé / setup synthétique non déclenché |
| Mesure nominale privée HTTP/mTLS/PG | PASS, **1 test**, trois GET **79,43 / 44,22 / 52,15 ms**, activation **249,10 ms**, projection locale unique |
| Connexions PostgreSQL pendant cette mesure | Maximum **observé 20**, échantillon10ms ; pas une garantie de capacité sous charge |
| Inventaire final et réparation opérateur des anciennes projections | PASS, **21 sources ACTIVE / 21 tuples locaux exacts**, zéro absent/divergent, snapshots centraux inchangés ; [Recovery](recovery.md) |
| Scan après mesure/rattrapage | PASS, **aucun match**, périmètre suivi et non suivi |
| `git diff --check` | PASS |

Les nombres de suites se recoupent ; ils ne constituent pas un total de tests
uniques. La mesure nominale exclut préparation de fixture et provisioning. Elle
utilise une session native de fixture ; le protocole natif réel est qualifié par
V3. Elle ne démontre ni une latence sous charge ni un plafond global garanti.

## A1–A9

| Critère | Preuve réellement exécutée |
|---|---|
| A1 | READY/PENDING reste sans octroi ; prepared unique ; schéma/checksum/flags, ACL, tag et propriétaire effectifs vérifiés. Dérives réelles UPDATE configuration, INSERT audit, CREATE public, tag et propriétaire refusées puis restaurées. |
| A2 | **12 fautes** avant/après six écritures finales, **3 CAS nuls**, observateur MVCC indépendant sans visibilité partielle ; vrai processus Node SIGKILL avant commit (rollback) et après commit (état durable/replay). |
| A3 | Perte d’ack prepared et reprise ; **3 POST concurrents**, même clé répétée et clé distincte, une membership/audit/outbox/idempotence ; perte d’ack centrale et replay courant. |
| A4 | Revalidation après I/O : expiration absolue et révocation SQL de session, native ended/changed, J1 indisponible et vrai DENIED fsyncé malgré rollback SQL. Aucun octroi après refus ; reprise après expiration. |
| A5 | Substitutions inter-agences reservation/event/secret refusées ; GET/POST/retry anonymes, STANDARD/HABILITED et scope plateforme refusés ; cross-agency404, body400, Origin/CSRF403, démotion refusant aussi replay. |
| A6 | GET minimisé/no-store ; activité idle, compteur refresh et J1 inchangés. READY/prepared jamais ACTIVE. |
| A7 | Retry humain dispatch:false et aucun outbox direct ; scanner après commit, wakeup target_attempt2 DELIVERED, READY/SUCCEEDED avec même opération/base/secrets. Admission100 : deux refus429 concurrents sans refresh/J1, capacité99 puis reprises, replay autorisé à100 sans duplication. |
| A8 | Base locale fermée après commit : ACTIVE durable et replay courant, outbox livré, projection privée refusée pendant panne ; redémarrage et rattrapage Inngest réel puis projection répétée idempotente. Schéma outbox2 refusé par contrainte PG23514. Anciennes projections réparées par opérateur, distinctement des reprises automatiques. |
| A9 | V3 entier, T06/PG/capacités/isolation/mTLS/Inngest privé, manifestes exhaustifs/disjoints, IA/mail/modules false, scan secrets/canaris. |

## Diagnostics conservés et limites

Le premier wrapper a terminé exit1 (T07 10/12) : le test propriétaire perdait
CONNECT avant la garde attendue, et le test retry injectait FAILED avant la
libération du gate. Corrections de tests relues, puis V2 complet et runner global
corrigé PASS. Deux diagnostics resilience antérieurs 5/6 ont corrigé les attentes
J1 fail-closed503 et contrainte outbox23514. Le premier lancement du harness de
mesure a échoué à l’import Nest depuis `.local` (0 test, aucune fixture) ; seuls
ses chemins privés ont été corrigés avant son PASS. Aucun échec n’est masqué.

LT-M2 hérité pg8 : avertissement de sérialisation, suivi avant montée majeure.
Trois fichiers PostScript accidentels restent privés, provenance de commande
non établie ; voir [Review](review.md). Aucun contenu affiché/publié.

## Ressources conservées

**10 services actifs** : sept services de base, identity-coordinator et les deux
services T06. Gate IDLE/no_execution, **0 RUNNING/BLOCKED**, ancienne exécution
FENCED ; ancienne agence FAILED, opération FAILED/step READY/attempt2/retryable=false. Partition
finale **T05=16, T06=668, T07=93**, exhaustive/disjointe. Checksum central inchangé
`e5d7928caaa1b6f9d145c1102f5119321defcc1cf385fe8356272c9dc7b4632a`.
Aucune nouvelle migration, réécriture de checksum, suppression/reset, rotation de
clé/version, commit, push, PR, fusion, déploiement ou cleanup.

Sorties brutes privées0600 dans `.local/` : `t07-final-qualification.log`,
`t07-final-integration.log`, `t07-final-build.log`, `t07-final-checks.log`,
`t07-performance-qualified.log`, `t07-performance.json`, inventaires/proof hôte.
Les [résultats minimisés](evidence-private/results.json) seuls sont publiables.
Aucune CI de cette version non committée ni aucun gate Ship n’est revendiqué.
