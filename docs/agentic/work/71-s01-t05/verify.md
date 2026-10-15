# Verify — #71 / S01 T05

`VERIFY: PASS` — 2026-10-15, validation locale synthétique. Revue finale indépendante
**PASS** après M1 documentaire revalidé. Snapshot local antérieur à la PR conservé ;
CI/Lead Tech historiques sur9bc560b sont désormais PASS, voir Ship. Aucun
READY_FOR_HUMAN anticipé avant ultime CI/attestation du commit des rapports.
Worktree `71-s01-t05`, branche `feat/71-s01-t05`, base `71c4536`, diff non commité.
Environnement retenu : [environment.md](environment.md), Setup PASS indépendant.

## Huit critères d’acceptation

| AC | Preuve exécutée et sources | Résultat |
|---|---|---|
| AC1 autorisation/isolation | `agency-creation.integration.spec.ts` : vrais endpoints Nest anonymous401/onboarding403/owner200, Origin forgé403, activation non exposée404 ; `t05-locks.integration.spec.ts` : sujet/root/session/plan étrangers, J1 avant replay et autorité native courante | PASS |
| AC2 preuve/import | `owner-proof.spec.ts`18 cas, `owner-confirmation.integration.spec.ts`4 cas dont CLI Node24 réelle ; `invitations.integration.spec.ts` : TXA visible depuis seconde connexion avant import, panne native réponse perdue conserve PENDING, reprise UUID sans réimport, interruption TXA→TXB ; navigateur natif T05 | PASS |
| AC3 grant | `invitations.integration.spec.ts` : hash seul/TTL10min/lien une fois, reissue epoch supérieur une seule fois, fermeture anciennes BFF, commande durable avant fsync, crash fsync ferme malgré rollback SQL, REVOKED terminal ; GET/replay sans lien ; navigateur natif issue200 | PASS |
| AC4 claim | PG/J1 réels : admission durable, receipt/BFF même commit, rollback receipt sans BFF, claim{} et legacy, refus cookie/version/epoch/tokenHash/admissionReceipt/ancien T04, TTL premier claim, deux claims et concurrence owner issue/revoke ; navigateur PI/KC réel→callback→claim{}200 | PASS |
| AC5 durabilité | Nest202 après commit, PG PROVISIONING/ADMIN PENDING/op ACCEPTED PENDING, audit/outbox/idem ; injection outbox rollback complet ; `s01-t05-state-check.mjs` inspecte43 agences T05 :0ACTIVE/READY,0locator, opérations toutes ACCEPTED/PENDING | PASS |
| AC6 idempotence | Deux connexions et deux BFF liées receipt ; mêmes key/root/name→même agency/op ; NFC/trim ; body/name conflits409 avant refresh, session du perdant réutilisable ; replay courant avant If-Match périmé, conflit key d’une autre invitation avant préparation | PASS |
| AC7 reprise | Nouvelle instance stateless après réponse création perdue→même agency/op ; TXA interrompue avant TXB et commande issue interrompue avant finale ; crash après fsync conserve commande et ferme ancienne BFF ; tête divergente refuse HTTP replay ; navigateur GET/replay propre sans rawtoken | PASS |
| AC8 HTTP/secrets | Parseur UTF8/32Kio/duplicats/clés échappées/framing/rawHeaders, Nest via Node brut, IP60/session10/100 clés bornées, whitelist méthodes/routes, erreurs minimales et Retry-After ; TLS et ACL Setup revalidés, scans sans secret, GET sain sans refresh/append métier, URL propre et local/sessionStorage sans token | PASS |

Sources de tests : `apps/api/test/{invitations,agency-creation,t05-locks,auth}.integration.spec.ts`,
`apps/api/test/t05-request.unit.spec.ts`, `apps/api/test/agency.contract.spec.ts`,
`packages/adapters/test/{owner-proof,owner-confirmation,t05-capabilities,authority-journal,enrollment-coordinator}*.ts`,
`tests/auth/{s01-auth,s01-t05}.spec.ts`. Helpers privés synthétiques marqués.
Aucun effet métier ne dépend d’un booléen public de MFA ou d’un rôle déclaré par client.

## Commandes finales réellement exécutées

PATH préalable : `export PATH="$PWD/.local/node/bin:$PWD/.local/pnpm-native/package:$PATH"`.
Node24.21.0/pnpm12.8.1 et distributions du manifeste retenus.

| Commande | Résultat | Log privé |
|---|---|---|
| `pnpm build` | PASS0, typecheck complet/CLI/tests, lint, API et web | `.local/t05-verify-final-build-recheck.log` |
| `pnpm test:unit` |87/87,9 fichiers, aucun skip | `.local/t05-verify-final-unit.log` |
| `pnpm test:contracts` |6/6,1 fichier ; tous états replay OpenAPI/Zod | `.local/t05-verify-final-contracts-recheck.log` |
| `pnpm test:integration` |110/110 =12 schémas +98 autres,12 fichiers ; aucun skip/unhandled | `.local/t05-verify-final-integration.log` |
| `pnpm test:auth` |13/13 =12 T04 inchangés +1 T05,9,1min ; aucun skip | `.local/t05-verify-browser-full-first.log` |
| `node scripts/s01-t05-state-check.mjs` |43 agences T05 inspectées, toutes fermées ; lecture seule | `.local/t05-verify-final-state-rerun.log` |
| `node scripts/s01-owner-key-interop-test.mjs` | Ed25519 OpenSSL/Node24, fingerprint identique, privée non montée/imprimée | `.local/t05-verify-final-key-interop.log` |
| `bash scripts/worktree-setup.sh --check` + `python3 scripts/s01-t05-environment-check.py` | Identité Git/UID retenue,8 services healthy, public RO seule, privée/ancêtre non montés, PG17.9, checksums0001–0003 inchangés | `.local/t05-verify-final-environment.log` |
| Tests déterministes Setup |23 Git réels,29 privacy réels,5 UID simulés séparés,21 clés,16 frontières SQL simulées | `.local/t05-verify-setup-deterministic.log` |
| `python3 scripts/s01-secret-scan.py --worktree`, `git diff --check`, `bash scripts/agentic-check.sh` | PASS, compteurs finaux dans verification-evidence.json ; présence méthode seulement pour agentic-check | Logs `.local/t05-verify-final-*` |

Les41 assertions PostgreSQL de capacités réelles restent incluses dans **un** test
Vitest de la suite ; elles ne sont pas ajoutées aux110 tests. Les16 frontières SQL
simulées déterministes sont distinguées de ces contrôles PG réels.

## Runtime et protections

### SQL/J1, services et Nest

Tests services et HTTP utilisent réellement PostgreSQL, verrous de plusieurs
connexions, J1/fsync, Ed25519, BFF chiffrée et Nest. Leurs nativeSession/refresh/import
sont des frontières instrumentées explicitement : ces tests seuls ne prouvent pas
MFA réelle. Les routes T05 sont sélectionnées vers Nest avant les proxies ; un403
proxy n’est jamais compté comme preuve API. Platform et Agencies ont leurs modules
séparés et un limiteur commun borné.

Les refus métier attendus passent sous tous prélocks après auth/J1 actuel/CSRF/natif,
avant refresh. Décisions typées gelées transmises au callback, aucun effet dans le
hook. Les défaillances après append restent fermées ; DENIED natif commit avant refus.
Revues indépendantes initiales et correctif M1 PASS dans [locks-review.md](locks-review.md).
GET sain ne prolonge pas idle et ne refresh ni append ; les contrôles natifs courants
et leur deny durable sont conservés. REVOKED ne redevient jamais réémissible.

Contrôle PG final :43 agences T05 retenues, toutes PROVISIONING, aucune READY/ACTIVE,
aucun locator ; opérations ACCEPTED/PENDING. Membership ADMIN PENDING, ou DENIED
après révocation volontaire dans les tests. Le parcours natif final vérifie séparément
son ADMIN PENDING et son opération ACCEPTED/PENDING. Aucune agence ACTIVE créée par
T05, aucun provisioner/worker de création DB, aucune activation ou mail applicatif.

### Navigateur natif réel

`playwright test tests/auth` sélectionne13 tests :12 T04 conservés (TOTP, recovery,
owner platform, logout/backchannel, changement natif/password, throttle, faults,
realm/issuer/callback forgery et restart), puis1 T05. PI native fait l’enrôlement et
OTP via outil externe ; Keycloak natif fait password/recovery MFA et OIDC signé.
Le test T05 utilise une identité propriétaire synthétique isolée, configuration
restaurée en finally, et aucune génération/rotation de clé owner.

Parcours T05 passé : owner MFA → procédure host signée stdin → invitation202 →
import KC exact → issue200 → guest PI/KC MFA → callback receipt → claim{}200 →
création202 → GET200/replay202 même agence/opération. URL courante nettoyée et
localStorage/sessionStorage sans rawtoken. GET/replay sans lien, toutes directives
Cache-Control no-store (doublon ingress+coordinator valide).

Profils NSS/CA synthétique, `ignoreHTTPSErrors:false`. Traces/vidéos/screenshots et
captures DOM automatiques désactivés ; aucune capture native QR/recovery/credential
publiée. Les preuves sont codes/compteurs/booleans, pas DOM/cookies/raw URLs. Le contrôle
storage porte l’URL courante et les stockages web applicatifs, pas une expertise
forensique disque du navigateur. UI métier frontend, responsive et audit WCAG non
applicables : aucune UI métier T05 créée ; interfaces natives maintenues conservées.

## Échecs historiques, aucun échec transformé en PASS

Historique Setup/graphe et revues Major conservé dans Execute/locks-review. Incréments :
fixture FK racine avant session et rollback connexion corrigés ; colonne locator test
corrigée vers table réelle ; premier Node brut omettait Host (400 avant Nest), corrigé ;
Nest POST donnait201, code corrigé explicitement à200 ; imports inutilisés corrigés.
Injection perte SQL trop large visait `SELECT 1 FROM...` avant refresh ; ciblée ensuite
sur **exactement** `SELECT 1` de préparation, panne connexion réelle qualifiée fermée.
Un échec initial affichait un CSRF de fixture dans un log privé ignoré ; aucun raw
invitation/OIDC token publié. Les assertions de refus évitent désormais l’impression
d’un payload de succès inattendu dans les nouveaux cas concernés.

Deux premiers essais natifs T05 FAIL : les codes202/200/202 et égalité/PROVISIONING/
stockage propre étaient vrais, comparaison chaîne Cache-Control exacte fausse. Test
corrigé pour exiger **toutes** directives égales no-store ; aucun proxy ni cas retiré.
Run complet13/13 final PASS. Une qualification PG lancée en parallèle de T04 natif
échouait27/28 sur lock_timeout writer J1 partagé ; mauvaise indépendance des suites,
timeout et cas inchangés. Tous reruns finaux PG ont été sérialisés après navigateur :
110/110 PASS. Les logs des FAIL sont conservés privés, jamais présentés comme PASS.
Dernier outil state-check refusait initialement avant secret (argument racine requis
omis au checker) ; corrigé et relancé, inspection réelle PASS43.

## Validations différées, risques et livraison

| Risque | État / preuve | Responsable / échéance restante | Action si échec |
|---|---|---|---|
| Auth native, graphe, SQL ACL et HTTP | Setup et locks indépendants PASS ; suites locales finales PASS | Reviewer indépendant, prochaine phase Review | corriger tout Critical/Major avant PR |
| CI exacte et Lead Tech base/tête finales | Non lancés, aucune PR créée/commit | orchestrateur, après Review favorable | pas READY_FOR_HUMAN tant que manquant |
| N3 données réelles/IAM/PRA/commercial | Hors périmètre synthétique | propriétaire, avant mise en service réelle | aucun déploiement autorisé ici |
| Coût/charge d’exploitation | Ressources locales retenues ; aucun coût cloud engagé, pas de benchmark charge/SLA production | propriétaire, avant usage réel | requalifier dimensionnement |

Déploiement, activation, T06–T10, données réelles et cleanup non exécutés. Toutes bases,
clés/J1/fixtures et autres worktrees conservés. Aucun accès cloud ni fusion.

## Gate Verify

- [x] Chaque AC a une preuve exécutée et ses limites.
- [x] Builds/tests/contrats/PG/navigateur T04+T05 PASS, aucun skip nécessaire.
- [x] Environnement, clés/mounts/ACL et migrations retenus vérifiés.
- [x] Scan sans secret et diff-check ; handoff prêt pour Review indépendante.

Verdict : **PASS local**. La revue finale est la phase suivante, pas une condition
circulaire de ce gate. Review/CI/Lead Tech/PR restent à obtenir avant READY_FOR_HUMAN.


## Revue indépendante post-Verify

[Review finale](review.md) PASS après correction/revalidation indépendante du Minor
M1 : collision basename des migrations control/agency0001 dans evidence JSON.
Les quatre chemins relatifs et huit hashes sources ont été comparés à fichiers/Git ;
aucun code/migration modifié, aucun rerun applicatif supplémentaire inventé.


## Suivi livraison historique sur9bc560b

PR72 et trois CI SUCCESS + Lead Tech indépendant PASS acquis sur la base/tête
explicites de [Ship](ship.md). Le présent Verify demeure la preuve locale décrite
ci-dessus ; aucun rerun applicatif inventé pour la rédaction documentaire. Ultime
CI et attestation hors diff du dernier commit des rapports restent requises.
