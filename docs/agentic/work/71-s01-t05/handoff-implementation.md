# Checkpoint implémentation — #71 / S01 T05

2026-10-15. Unique écrivain `/root/implementer`, orchestrateur `/root` ; aucun commit.
Worktree `/home/issa/Workspace/perso/dossiercle/worktrees/71-s01-t05`, branche
`feat/71-s01-t05`, HEAD `71c4536981aa61656b3b7ad0df42ed9c14facd00`.
Préparation initiale conservée : Research/Design/Plan/revues/handoff/goal et ADR030 ;
STATUS, Design S01 et Architecture déjà modifiés à l’entrée, non remplacés.

## État réel

- 0a **PASS indépendant** après CHANGES_REQUIRED/Major2 ; historique et levée M1/M2
  dans [setup-0a-review.md](setup-0a-review.md).
- 0b **exécutée**, preuves dans [environment.md](environment.md) et
  [setup-0b-evidence.json](setup-0b-evidence.json) ; **revue Setup indépendante PASS,0 findings**.
- Execute étapes1–4 autorisé et en cours, aucune API T05 exposée, aucun AC applicatif PASS ; Goal implémentation
  ACTIVE dans [goal-implementation.md](goal-implementation.md).
- Pas de PR, CI, merge, déploiement ou cleanup. Les services synthétiques restent
  conservés/sains, bases/J1/clés/autres worktrees intacts.

## Bootstrap prêt et preuves

Garde Git réelle et invocation lexicale avant code repo/secrets/Docker ; couples
legacy/T05 exacts. UID/type/modes privés stricts sans chmod de dérive retenue.
Clé owner Ed25519 créée fraîche avant Node, privée tmpfs non montée, publique seule
RO et fingerprint vérifiée dans coordinateur T04 sain. Profil control_t05 NOLOGIN
et membership coordinator SET TRUE/INHERIT FALSE/ADMIN FALSE ; droits objets par
colonnes/defaults, contrôles exacts.0001–0003 inchangées.

Preuves :23 Git réels,29 privacy réels et5 UID étrangers simulés distincts,
21 clés,16 frontière SQL simulée,41 PostgreSQL réels (fixtures ROLLBACK), interop
Node24, mount réel/TLS natif, build packages/API T04 et --check PASS. Scan worktree
inclut delta non committé et clé owner,0 match. Journaux privés `.local/setup-0b*`.
Échec initial0b import pg conservé ; correction createRequire ancré package adapters,
reprise même environnement PASS. Aucun échec ou skip converti en succès.

## Reprise autorisée après revue Setup favorable seulement

Suivre étapes1–8 du Plan, avec revue du graphe de verrous avant exposition API.
Les remarques de l’exploration indépendante transmises par l’orchestrateur sont
des contraintes techniques, pas des preuves d’exécution :

- callback `withSession` actuel intervient après append J1 ; wrapper T05 doit
  prendre toutes racines/autorités/sessions nécessaires avant refresh et J1.
- Préverrouiller l’invité PENDING sans `withLockedAuthority`, car celui-ci appelle
  immédiatement `requireAuthority` ; revalider ensuite les projections/locks.
- J1 indexe replay `commandId+state` globalement : commandes UUID distinctes par
  sujet/effet, stables aux reprises, pour éviter collisions owner/invité.
- Receipt : point atomique confirm→issue, même connexion que session forte ; enrichir
  contexte privé du grant avec tokenHash/admission durable. Jamais token brut GET/log/storage.
- `writeAudit` restaure aujourd’hui via RESET ROLE ; l’étape3 doit capturer/valider
  et restaurer explicitement le rôle précédent. Le test PG0b vérifie seulement
  les capacités SET, pas cette correction applicative future.

Le rapport complet du reviewer locks est disponible auprès de l’orchestrateur.
Pas de migration0001–0003 ni de rôle migrator/runtime élargi. Pas T06–T10/ACTIVE.

## Commandes et limites de reprise

Charger PATH local Node24/pnpm12.8.1 ; commandes de vérification sans mutation des
ressources documentées dans environment.md. Pas besoin de relancer un setup frais.
Clés/marker manquants imposent refus et réconciliation explicite, jamais génération
sur environnement retenu. Frontend Vite et tests navigateur ne sont pas exécutés
à ce checkpoint ; tests/build/contracts/T04 complets restent Execute/Verify.

Après Verify/revue favorables : commits Gitmoji/Fixes#71, PR dédiée, CI de tête,
examen Lead Tech base/tête finales et arrêt READY_FOR_HUMAN, sans fusion/déploiement.

## Checkpoint après étapes1–4

Execute IN_PROGRESS, incréments1–4 implémentés/testés ; voir [execute.md](execute.md).
Build complet PASS, unités87/87, contrats5/5, intégration ciblée6 fichiers53/53
(PG/J1 réels et frontières natives explicites). Aucun skip/unhandled final.
Échecs intermédiaires et corrections conservés dans Execute ; pas de gate final.

Code figé pour revue indépendante du graphe : t05-locks.ts + AuthService, audit
role restoration et nouveaux tests. Les droits agency UPDATE restent absents ;
prélock membership UPDATE avant definer scope existant, tous avant J1. Une projection
acteur fraîche remplace le snapshot pré-refresh avant callback T05.

Preuve owner : owner-proof.ts + owner-confirmation.ts, CLI host stdin et binding
signé courant, aucun raw contact stdout/record. Les records de fixture des essais
sont conservés, sans activation ou API métier publique. Le binding final est lié
à sa clé identityConfirmationRef signée ; anciens records expérimentaux non
consommés ne sont pas réécrits ni utilisés pour autoriser une action publique.

Étapes5–8 bloquées au gate revue locks favorable ; aucune exposition T05.
Après avis : TXA/TXB, import réconciliable, émission/révocation/claim/création et
receipt callback/session, middleware strict/wiring, tests intégration/API/navigateur
et CI selon Plan. Utiliser les helpers stricts implémentés ; ne pas recréer de clé
ou de schema. Demander à l’orchestrateur le rapport indépendant avant reprise.


## Checkpoint gate correctif pré-refresh (2026-10-15)

Gate initial locks PASS indépendant déjà reçu ; implémentation privée services5–7
en cours. **Aucun endpoint T05 exposé**, processus coordinateur retenu non redémarré.
Nouveau fait documenté dans Execute + addenda Design/Plan : refus métier409 doit
précéder le refresh durable pour éviter de fermer la session sur rollback normal.
Wrapper fournit maintenant une décision privée générique typée/immuable au callback,
calculée sous tous prélocks après auth/CSRF/natif, zéro effet hook ; deny natif commit
avant hook. Services transportent snapshots gelés au callback. Aucun changement graphe
root/authority, rôle ou migration, ni pool/transaction imbriquée.

Revalidation indépendante requise avant câblage. Fichiers prioritaires reviewer :
`apps/api/src/auth/{auth.service,t05-locks}.ts`, services `platform/*.ts`,
`agencies/agencies.service.ts`, `apps/api/test/t05-locks.integration.spec.ts`.
Rerun identique Execute : build, unit, contracts et six fichiers intégration ciblée.
Résultats acquis : typecheck PASS,87 unit,5 contrats,57 PG (16 locks). Logs et échecs
intermédiaires détaillés Execute ; capacités41 assertions restent un seul test.

Après gate correctif : tests réels services/receipt/concurrence et corrections,
contrat InvitationIssued replay, activation view, GET sans effet, puis middleware
whitelist/Nest/controllers, CI et navigateur natif T04+T05. Les services nouveaux
ne sont pas encore qualifiés, Verify8AC est toujours en attente. Conserver les
clés/données/J1 ; environnement retenu, aucun besoin de setup ou cleanup.

État figé pour revue : build complet PASS0, scan450/279/0 match, diff-check PASS.
Aucune écriture prévue avant retour reviewer sur ce delta.


### M1 revalidation — delta figé

Avis CHANGES_REQUIRED Major1 consigné, aucune auto-clôture. Correction limitée à
`InvitationsService.issue` et guard privé `InvitationPreparationService.prepare`,
tests services réels `t05-invitations.integration.spec.ts`. Le guard vérifie la vraie
commande sous les prélocks de préparation avant refresh/import ; key/body conflict
et staleversion refusés sans effets, replay avant If-Match. Le contrôle natif de
session d’autorisation reste requis. Quatre nouveaux tests PASS, suite PG61/61,
build complet0 PASS. Aucun endpoint câblé, coordinateur non redémarré, aucun commit.
Revalidation indépendante attendue avant poursuite5–8.


## Handoff Execute/Verify final — figé pour Review indépendante

2026-10-15. Execute PASS local, Verify PASS local ; Goal ACTIVE. **Aucun commit/PR,
CI distante ou Lead Tech final**, aucun READY_FOR_HUMAN encore. Reviewer indépendant
à déléguer par orchestrateur. Historique Setup/locks et Major1 levé conservé.

Implémentation1–8 complète : modules Platform/Agencies, services TXA/TXB/commands,
receipt lié à admission+BFF, claim{}, création durable PROVISIONING/ADMIN PENDING/op
ACCEPTED PENDING, Nest réel et whitelist sans modifier les routes/proxies T04.
Public key owner seule montée ; aucune migration0001–0003 ni activation/provisioner.
T05 ajoute native test/helper et workflow dédiée ;12 scénarios T04 inchangés.

### Reproduction (environnement retenu, pas de synthetic frais/cleanup)

Depuis ce worktree, charger PATH `.local/node/bin:.local/pnpm-native/package:$PATH`.
Exécuter **séquentiellement** les commandes partageant PG/J1 global :
1. `pnpm build` puis `pnpm test:unit` et `pnpm test:contracts`.
2. `pnpm test:integration` (schémas12 +98 autres =110).
3. `pnpm test:auth` (wrapper build/restart ciblé du coordinateur,13 tests natifs,
   durée observée9,1min). Ne pas lancer PG/J1 simultanément au navigateur.
4. `node scripts/s01-t05-state-check.mjs` (lecture seule,43 agences T05 au moment
   de la preuve, nombre peut augmenter au rerun car fixtures retenues).
5. `node scripts/s01-owner-key-interop-test.mjs`, `bash scripts/worktree-setup.sh --check`,
   `python3 scripts/s01-t05-environment-check.py`, scan `--worktree`, diff-check,
   `bash scripts/agentic-check.sh`.

Résultats finaux : build0,unit87/87,contrats6/6,PG110/110,navigateur13/13 sans skip ;
Setup déterministes23 Git +29 privacy réels/5 UID simulés séparés/21 clés/16 SQLsim.
Les41 assertions PG réelles sont incluses dans un test et non ajoutées aux110.
Logs privés exacts, matrice8AC et erreurs historiques : [verify.md](verify.md),
compteurs sûrs : [verification-evidence.json](verification-evidence.json).

### Points de revue prioritaires

Graphe/readonly décision avant refresh + guard issue avant préparation ; replays
sous auth actuelle avant If-Match ; commandes stables/REVOKED terminal ; receipt
cookieHash complet + admission et commit BFF unique ; aucune mutation/secret GET ;
transactions création/audit/outbox/idem et capacités minimales. Services tests PG
font native boundaries instrumentées, navigateur13 qualifie réellement PI/KC MFA.
Review ne peut être remplacée par ces preuves implementer. Corriger tout finding
Critical/Major avant commit/PR, puis CI de tête et Lead Tech sur base/tête finales.

Les ressources, fixtures et clés sont conservées. Les fixtures natives modifient
ownerSubject dans la seule config synthétique puis restaurent en finally ; la
clé propriétaire n’est jamais régénérée. Captures DOM/QR/recovery, raw URLs et
cookies ne sont pas publiés. UI frontend, données réelles, cloud et activation
restent hors périmètre ; aucune fusion sans instruction humaine T05 applicable.


## Après Review indépendante — préparation Ship

Review initiale PASS_WITH_MINOR (M1 hash control0001 écrasé par basename agency0001),
correction par chemins relatifs des quatre migrations + huit hashes sources vérifiés,
puis revalidation indépendante PASS0 finding reçue. Aucun code ou migration modifié.
Rapport complet review.md, historique conservé. Fetch origin/main confirme la base
71c4536981aa61656b3b7ad0df42ed9c14facd00 inchangée. Commits/PR autorisés, CI et Lead Tech
encore requis ; Goal ACTIVE, ship.md IN_PROGRESS. Aucun merge/deploy/cleanup.
