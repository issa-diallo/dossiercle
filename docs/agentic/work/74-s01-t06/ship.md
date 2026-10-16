# Ship — #74 / S01 T06

## État

**IN_PROGRESS** — livraison limitée à READY_FOR_HUMAN. Execute et Verify PASS,
Review indépendante PASS_WITH_MINOR, Goal technique SATISFIED. PR, CI de tête et
examen Lead Tech restent à obtenir. Aucun merge, déploiement ou cleanup autorisé.

## Préconditions et responsabilités

- [x] Execute PASS et Verify PASS : [preuves](verify.md).
- [x] Review PASS_WITH_MINOR, aucun Critical/Major : [rapport](review.md).
- [x] Goal technique SATISFIED : [Goal](goal-implementation.md).
- [x] Écriture transférée de l'implementer à l'orchestrateur, aucun test actif.
- [ ] CI de PR PASS sur la tête courante.
- [ ] Lead Tech distinct de l'implementer et du premier reviewer, avis favorable.

## Git et PR

Branche `feat/74-s01-t06`, base `b18cd38b2c93234211c3c66bba654d63f297149c`.
Remote `origin`, dépôt `issa-diallo/dossiercle`, ticket #74. Commit et lien de PR
seront consignés après leur création. Une seule intention logique après squash.
Le dépassement de taille est justifié dans [Execute](execute.md) : protocole
central, capacités, DDL/coffre, routeur, transport, bootstrap et tests doivent
présenter leurs barrières ensemble, sans livraison intermédiaire ouverte.

## CI et examen final

Les workflows méthode, T04, T05 et T06 doivent passer sur la révision publiée.
Le Lead Tech reçoit la PR, base/tête, diff, Verify, Review et liens de CI.
Son rapport sera conservé dans `lead-tech-review.md`. Si ce rapport est committé,
une CI de la nouvelle tête puis une attestation finale hors diff sont requises ;
la session finale en conservera les SHA et le verdict, sans nouveau commit.

## Migration, rollback et limites

Migrations0004/0005 additives, anciens SQL inchangés. Arrêt/drain vérifié avant
migration ; aucun mode mixte ancien/nouveau runtime. Le rollback applicatif exige
l'arrêt des nouveaux émetteurs et une vérification de compatibilité du schéma :
l'ancien migrateur refuse le nouveau checksum. Aucun down automatique, DROP,
reset de gate/J1, rotation ou effacement de ressources ne constitue un rollback.
Une exécution incertaine reste fermée jusqu'à inspection/fencing certains.

Le candidat est syntheticOnly et son manifeste restreint les opérations T06 ;
aucun runtime hors fixtures n'est qualifié. READY/SUCCEEDED conserve ADMIN PENDING,
activated_at NULL et fonctions métier/IA/modules/mail fermées. Le Minor pg est
suivi par le mainteneur/Lead Tech avant une montée majeure, selon [Review](review.md).

## Arrêt humain

État attendu : READY_FOR_HUMAN avec PR, CI et attestation finale. Validation
humaine et autorisation de fusion D57 restent à obtenir. S01 reste IN_PROGRESS.
Worktree, branche, volumes, bases, J1, clés, versions et fixtures sont conservés.
