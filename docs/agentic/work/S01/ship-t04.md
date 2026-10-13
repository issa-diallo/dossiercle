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
Remote issa-diallo/dossiercle ; commit et PR non créés à ce checkpoint.
Exception à1–3 fichiers/100 lignes : la base était sans application ; socle,
contrats, migrations, lockfile et manifeste reproductible sont indispensables
au même objectif T04. La préparation non versionnée est conservée. Une division
qui ne livrerait pas ces dépendances ne permettrait pas de vérifier l’authentification.
Aucune feature T05 ni refactor sans dépendance directe. Un commit logique squash.

## CI et Lead Tech

CI hébergée : non atteinte à ce checkpoint, obligatoire sur chaque tête finale.
Workflow `.github/workflows/s01-t04.yml` : setup synthétique neuf, build/migrations,
unités/intégration réelles, Firefox/MFA/pannes/rotation, scan des secrets.
Le check documentaire est distinct de ces preuves applicatives.
Lead Tech : second agent indépendant, examen après PR/CI ; rapport à consigner.
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
Responsable : mainteneur du projet, revue avant upgrade IdP/PI ou ouverture
supplémentaire de routes/grants, avant toute mise en service.

## Autorisation, fusion et arrêt

Autorisation humaine déjà acquise dans le mandat ci-dessus (D57). Fusion squash
conditionnée à CI et Lead Tech favorables de la tête actuelle. Merge non exécuté
à ce checkpoint ; SHA/date/URL définitifs à relever dans la session/PR.
Arrêt immédiat après merge. Worktree, branche, fixtures, DB, journal et clés
conservés ; cleanup distinct et non autorisé automatiquement. S01 jamais DONE.
