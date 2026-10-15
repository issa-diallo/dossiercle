# Execute — #71 / S01 T05

`EXECUTE: PASS` — 2026-10-15. Unique écrivain `/root/implementer`.
Setup PASS indépendant dans [environment-review.md](environment-review.md).
Pas de commit ni PR. Gate initial étapes1–4 PASS indépendant dans locks-review.md.
Correctif pré-refresh revalidé indépendamment PASS ; étapes5–8 terminées et
Verify local PASS. Revue finale, commits, PR, CI et Lead Tech restent à obtenir.

## Incréments réalisés

| Plan | Implémentation / chemins | Preuve actuelle |
|---|---|---|
| 1 domaine/contrats | `packages/domain/src/agency-lifecycle.ts`, tests ; NFC/trim/hash, conflits idem/name, REVOKED terminal et defaults PROVISIONING/ADMIN PENDING/ACCEPTED | Unités domaine et contrats dans suite87/87 |
| 1 HTTP | `apps/api/src/http/t05-request.ts`, tests ; JSON UTF8 strict32Kio, clés dupliquées décodées, framing/headers stricts, UUID/ETag, buckets10/60 par minute,100 clés actives/catégorie | Unités HTTP et87/87 ; aucun endpoint câblé |
| 1 claim DTO | `agency.contracts.ts`, OpenAPI et tests : union stricte{} / legacy{token}, ClaimContext sans secret | Contrats5/5 et parseur OpenAPI PASS |
| 2 preuve owner | `identity/owner-proof.ts`, `owner-confirmation.ts`, CLI `scripts/s01-owner-confirmation.ts` incluse au typecheck | Crypto18 tests ; PG4 tests dont CLI Node24 réelle stdin/sortie2refs |
| 3 capacités/audit | Routine T05/41 assertions PG du Setup dans suite découverte ; `audit/audit-writer.ts` capture current_user allowlisté et restaure explicitement son rôle après succès | PG3 tests, dont41 assertions minimales et restauration T05/échec transaction abortée |
| 4 wrapper | `apps/api/src/auth/t05-locks.ts`, extension privée AuthService.withT05Session ; résolveur serveur revalidé sous locks, pas IDs publics autorisants |12 tests graphe PG/J1/concurrence et17 tests auth T04 conservés PASS |

Les permissions et0001–0003 sont conservées. Aucun élargissement UPDATE agency.
Le rôle t05 protège ses mutations ; les opérations identité restent dans le profil
coordinator privé, explicitement activable dans la même transaction. Le processus
n’est pas sandboxé par ces profils SQL qu’il peut activer.

## Preuve owner et procédure

Payload Ed25519 strict couvrant owner/paires/IDs réservés/contact hash/dates24h/
provenance/fingerprint ; username==subject, self-target et fausse paire refusés.
Paires de records INSERT et binding signé immuable à séquence croissante, clé de
binding égale identityConfirmationRef signée. Lecture courante sous verrou racine,
reconfirmation conserve IDs/racine et invalide les anciennes refs dans la lecture
courante. Aucun contact brut ou secret dans les records de preuve.

CLI host Node24 après build packages : stdin JSON privé `{email,invitationId?}`,
flag explicite human-confirmed ou synthetic-fixture ; vérifie worktree, UID,
clé/config existantes, ne génère aucune clé ; sortie limitée aux deux refs.
Elle atteste une procédure déclarée humaine, ne vérifie pas automatiquement
l’identité. Tous tests CLI emploient synthetic-fixture. Les records de fixtures
créés durant les essais sont conservés ; aucun usage métier public avant revue.

## Graphe de verrous soumis à revue

1. Cookie/session en prélecture candidat ; préfiltre owner seulement mode owner,
   mode onboarding lié à sa racine propre, pas au rôle owner.
2. Résolution privée cible depuis preuve/DB ; advisory roots triées, puis toutes
   invitations concernées FOR UPDATE dès l’entrée, actor root compris.
3. TXB seul autorise initialisation de la cible PENDING sous sa racine existante ;
   réservation TXA peut garder son autorité absente. Aucune requireAuthority sur
   le sujet invité PENDING.
4. Autorités owner/invité triées, sessions triées, projections nécessaires et
   nouvelle lecture session/plan. Pas de booléen trusted ni autorisation du candidat.
5. Barrière T04 requireAuthority/J1 sur acteur, Origin/CSRF, preuve native courante,
   refresh humain et J1, puis work sous rôle T05 sur la même connexion/transaction.
   Les projections acteur rendues au callback sont relues après refresh.

PG exige UPDATE pour FOR SHARE direct agency ; ce droit est volontairement absent.
Le wrapper réutilise donc le definer existant `control.lock_session_scope` pour
SHARE agency/membership. Il prend d’abord membership UPDATE, après toutes les
autorités, afin d’éviter SHARE→UPDATE. Les verrous agency T04/T05 sont SHARE ;
aucun UPDATE agency dans cette tranche. L’absence de projection ADMIN cohérente
ferme l’action. Les locks/projections sont pris avant le premier append J1.

Native-change conserve le chemin DENIED fsync+SQL/audit/COMMIT avant refus.
Le test deny() concurrent vérifie la compatibilité du chemin authority→J1 existant.
UUID commandes distinctes par sujet/effet ; pas d’imbrication de pool attendue
depuis un callback qui détient J1. Les tests de claim/revoke/reissue sont ici des
callbacks privés modelant le graphe ; ils ne qualifient pas les futurs endpoints.

## Commandes réellement exécutées et résultats

| Commande | Résultat final |
|---|---|
| `pnpm build` | PASS0 : typecheck complet, lint, builds API/web ; CLI incluse |
| `pnpm test:unit` | PASS87/87,9 fichiers, aucun skip |
| `pnpm test:contracts` | PASS5/5,1 fichier, aucun skip |
| Vitest intégration ciblée ci-dessous | PASS53/53,6 fichiers, aucun skip/unhandled |

Suite PG ciblée : `apps/api/test/{t05-locks,auth}.integration.spec.ts`,
`packages/adapters/test/{t05-capabilities,owner-confirmation,authority-journal,enrollment-coordinator}.integration.spec.ts`.
Commande : `pnpm exec vitest run --project integration` suivie de ces six chemins.
Logs privés `.local/t05-step4-final-{build-retry,unit-retry,contracts,pg}.log`.
Les53 tests incluent les41 assertions du script de capacité PG, sans les confondre
avec41 tests Vitest supplémentaires. Native MFA non qualifiée par ces frontières.

Couverture graphe : ownerUUID/root au-dessus et au-dessous, cible PENDING, projection
PROVISIONING, fraîcheur post-refresh, changement candidat par seconde connexion,
plan changé sous locks, root étrangère, DENIED natif durable, writer J1 indisponible,
refresh échoué/head PENDING, audit échoué/rollback, deny() concurrent, attente PG
réellement observée pour callbacks claim contre owner revoke/reissue et fermeture
de l’ancienne session T04. Traces SQL assurent aucune nouvelle prise racine/autorité/
projection après premier J1 dans les callbacks testés.

## Échecs rencontrés, conservés et corrigés

- Premier build domaine : TS6 ne chargeait pas implicitement types Node ; types
  explicités dans tsconfig domaine, puis build complet PASS.
- Premier graphe PG :9 tests nouveaux échoués, dont2 attentes de latch, et2 unhandled
  après refus agency FOR SHARE ;17 T04 PASS. Aucun finding masqué. Correction par
  definer existant sans nouveau grant/migration ; latches libérés en finally ;
  mêmes cas conservés puis enrichis et relancés jusqu’au résultat final53/53.
- Premier lint : import de type inutilisé dans le test, retiré.
- Premier full-unit :1 mock T04 ne répondait pas à SELECT current_user ;86 autres
  PASS. Mock enrichi et assertion audit→coordinator ajoutée ;87/87 finaux.

## Limites et suite — checkpoint historique étapes1–4

Revue indépendante des locks attendue. Pas de service invitation/réconciliation,
issue/revoke/claim/création ni wiring API T05 encore. Pas de receipt callback/session
T05, de test navigateur fonctionnel, de Verify final ou d’avis Lead Tech/CI/PR.
Le coordinateur T04 lancé avant Execute garde ses modules chargés ; il sera
redémarré avec le build final lors du câblage/tests natifs, sans modifier ses clés.
Les suites d’intégration complètes et navigateur doivent encore passer après
étapes5–8. Aucun PASS final ne découle de cet incrément.


## Incrément services5–7 / gate correctif pré-refresh — IN_PROGRESS

Services privés écrits mais **pas encore qualifiés de bout en bout** :
`platform/invitation-preparation.service.ts`, `platform/invitations.service.ts`,
`agencies/agencies.service.ts`, `postgres/t05.repository.ts`,
`identity/onboarding-receipt.ts` et raccord receipt callback/issue même connexion.
TXA réserve durablement IDs/commande avant TXB ; la réconciliation native distingue
404 positif et panne, et ne transforme pas une connexion SQL perdue en acceptation.
Grant réservé durablement avant J1, completion sans raw token, replay projette l’état
courant. Claim utilise le receipt lié au cookie complet et admission durable ;
création rassemble agence PROVISIONING, ADMIN PENDING, opération ACCEPTED et audit.
Ces affirmations décrivent le code en cours ; les tests métier/native/API/navigateur
restent requis, aucune de ces capacités n’est présentée comme PASS global.

Fait nouveau : un409 métier attendu après refresh ferait rollback sa projection
SQL malgré J1 durable. Ajout du hook privé générique `validate`, lecture seule,
après auth/session/epoch/CSRF/natif et avant append. Décision typée `Readonly`,
snapshots `Object.freeze`, transmise explicitement au callback sans état extérieur
capturé. Les vérifications métier attendues ont quitté les callbacks aprèsrefresh.
Les contrôles de cohérence J1 et les pannes dépendances restent fermés aprèsappend.
Addenda Design/Plan ajoutés ; aucun wiring endpoint ou redémarrage coordinateur.

Preuves ciblées correctif : typecheck complet PASS ; unités87/87 PASS ; contrats5/5
PASS ; PG57/57 dans les six fichiers précédents, dont16 tests locks (+4 conservant
les12 précédents). Les trois409 sont des variantes de test, pas des tests retirés.
Aucune mutation session/J1 après refus, retry même session et décision gelée vérifiés.
CSRF et DENIED natif n’atteignent pas le hook, deny reste commité ; refresh/J1/audit
failure, concurrence T04 et locks sont conservés.

Échecs de cet incrément conservés : premier PG13 PASS/3 FAIL, assertion nouvelle
erronée `head.sequence+2` supposant une séquence par sujet ; J1 est global, les
fixtures invités s’intercalent. Corrigée vers head CONFIRMED, même epoch, nouvelle
commande et séquence supérieure, sans retirer les trois variantes. Premier build
échoue lint sur type `{}` trop permissif du claim ; remplacé par dictionnaire vide
strict au type, validation publique prévue par schéma strict existant.
Logs privés `.local/t05-step5-{decision-typecheck,hook-pg,hook-pg-rerun,hook-unit,hook-contracts,hook-build,hook-build-rerun}.log`.

Build complet final PASS0 (typecheck/lint/API/web). Scan worktree450 fichiers,279
représentations privées,0 match ; git diff --check PASS. Gate correctif indépendant PENDING.
Pas de tests métiers services5–7, de Nest réel, de MFA navigateur T05 ou de CI dédiée
encore exécutés. Contrat OpenAPI InvitationIssued à aligner sur replay état courant,
projection activation à terminer et contrôle GET sans effet à compléter pendant5–8.


### Correctif M1 revue pré-refresh

Revue indépendante CHANGES_REQUIRED Major1 reçue, voir locks-review.md. `issue` ne
fait plus de préparation avant ses checks key/body/version : guard privé lu dans
la transaction de préparation sous les mêmes prélocks, après auth/natif/CSRF et
avant refresh/J1/import. Replay reconnu avant If-Match périmé, completion saute
la préparation native. Preuve owner/ACTIVE/source/terminalité revérifiés au même
point ; aucun effet dans le guard. Wrapper inchangé.

Nouveaux tests réels services :4/4 PASS, puis61/61 dans7 fichiers PG (57 antérieurs
conservés). Build complet0 PASS. Tests instrumentent séparément nativeSession
d’autorisation (conservé/requis) et refresh/user/createUser : refus409 conserve
exactement J1 et sessions, sans effet préparation/refresh. Replay complet courant
et reprise commande PENDING durable après interruption entre transactions passent.

Premier run services :3 FAIL de fixture (racine invitation créée trop tard pour FK
session ; réutilisation connexion abortée). Correction fixture : racine avant
session et rollback garanti en catch ; aucun changement schéma, test ou assertion
réduit. Logs privés `.local/t05-step5-issue-guard-{pg,pg-rerun,pg-final,pg-source-final,typecheck,build}.log`.
Gate correctif reste PENDING indépendant ; aucune exposition endpoint T05.


## Étapes5–8 terminées — état final local

| Plan | Implémentation | Preuves finales |
|---|---|---|
| 5 TXA/TXB | `platform/{invitations,invitation-preparation}.service.ts`, `postgres/t05.repository.ts` : réservation/proof/audit/idem commit avant IdP, commande native stable J1 PENDING, readback réservé exact, healthy-PG uncertain distinct connexion perdue | Tests interruption TXA→TXB, TXA visible seconde connexion avant import, réponse native perdue/reprise sans réimport et vraie terminaison backend PG |
| 6 issue/reissue/revoke | Commande durable avant fsync, replays autorisés avant staleIfMatch ; guard pré-refresh avant préparation réelle, version/epoch/session/J1, grant hash/TTL10min ; lien RAM réponse seule et completion sans lien ; REVOKED terminal | Tests services et HTTP, crash après guest fsync, reprise commande avant finale, sessions fermées, reissue après claim préserve création, revoke terminal et concurrency réelle |
| 7 receipt/claim/création | `identity/onboarding-receipt.ts`, callback/coordinator/AuthService : admission durable/cookieHash complet/subject/root/epoch/version/tokenHash/issuedAt ; receipt+BFF commit unique. Claim{} ou legacy ; agence PROVISIONING, ADMIN PENDING, op ACCEPTED/PENDING, audit/outbox/idem même commit | Refus receipts/sessions anciennes et TTL, rollback receipt sans BFF, rollback outbox sans agence, deux claims/deux BFF, body/name409 avant refresh, nouvelle instance après réponse perdue |
| 8 Nest | `platform/{platform.module,invitations.controller}.ts`, `agencies/{agencies.module,agencies.controller}.ts`, `http/t05-boundary.ts`, AppModule/coordinator ; public key seule, whitelist méthodes/routes avant proxies, strict body/headers et erreurs minimales, buckets bornés | Node HTTP réel, POST202/200, GET204/200 sans refresh, no-store, anonymes/rôles/CSRF, UTF8/headers/framing, IP60/session10 et head avant replay |
| 8 navigateur/CI | `tests/auth/s01-t05.spec.ts`, helper privé natif ;12 T04 inchangés et1 T05 sélectionnés ; `.github/workflows/s01-t05.yml` dédiée, namespace Git autorisé et contrôlé avant secrets ; aucun retrait T04 | `pnpm test:auth`13/13 PASS,9,1min ; CI distante non lancée, aucune PR créée |

Les fichiers de tests suivent désormais les noms Plan `invitations.integration.spec.ts`
et `agency-creation.integration.spec.ts` ; les cas du checkpoint
`t05-invitations.integration.spec.ts` ont été déplacés et enrichis, aucun retrait.
Helper commun SQL/J1 privé extrait dans `private-t05-fixture.ts`. Modules Platform et
Agencies séparés. Contrat OpenAPI InvitationIssued aligné sur états courants du replay,
Zod et HTTP ; GET activation ne fait que projeter PROVISIONING/ACCEPTED et ne permet
aucune activation (canActivate/canRetry false, automationEnabled false).

Commandes finales et limites détaillées dans [Verify](verify.md) : build0, unités87,
contrats6, intégration110 (12 schémas +98 autres), navigateur13, tous PASS sans skip.
Après navigateur fini, les qualifications PG finales sont strictement sérialisées.
Déterministes Setup23 Git/29 privacy réels,5 UID simulés séparés,21 clés,16 frontières
SQL simulées ;41 assertions réelles de capacités incluses dans un test Vitest.
Interop Node24/Ed25519,8 services healthy, public RO/privée non montée et checksums
0001–0003 inchangés revalidés. `s01-t05-state-check.mjs` lecture seule inspecte43 agences
T05, toutes PROVISIONING/op ACCEPTED PENDING,0ACTIVE/READY et0locator ; ADMIN PENDING
ou DENIED après révocation. Aucune activation, migration0001–0003, ressource réelle,
base métier/provisioner, cloud, mail applicatif, déploiement, fusion ou cleanup.

Échecs supplémentaires conservés : cas de test inspector locator erroné, client Node
sans Host, défaut201 Nest corrigé à200, imports lint inutilisés ; injection SQL trop
large corrigée pour tuer le backend dans le vrai contrôle de préparation ; premier
state-check refusé avant secret car argument root omis puis corrigé. Deux essais
natif T05 échouaient uniquement comparaison chaîne cache exacte (double no-store
valide) : assertion de toutes directives conservée, aucun proxy modifié. Enfin un
run PG27/28 lancé parallèlement au natif échouait lock_timeout writer J1 partagé ;
suites non indépendantes, timeout/cas inchangés, rerun final sérialisé110/110 PASS.
Logs privés minimisés et historique détaillés Verify, aucun FAIL/skip renommé PASS.

## Gate Execute final

- [x] Research/Design/Plan documentaires revalidés, Setup indépendant PASS.
- [x] Graphe initial et correctif pré-refresh indépendamment PASS, Major historiques levés.
- [x] Étapes1–8 implémentées dans le scope, tests et erreurs/concurrences exécutés.
- [x] Contrats, builds, PG et navigateur réel T04+T05 PASS ; aucun retrait de cas.
- [x] Handoff/Verify/Goal d’implémentation préparés, données/clés/J1 conservés.

Verdict : **PASS local**, prêt pour Review indépendante ; aucun commit/PR encore.
