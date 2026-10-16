# Handoff — préparation #74 / S01 T06

## État et résultat

**Setup PASS**, 2026-10-16, après revue indépendante des étapes 0a/0b. Research PASS,
Design PASS révision3, Plan PASS révision2 et Setup 0a PASS après revues
indépendantes. Setup froid 0b terminé ; détails et revue dans
[environment.md](environment.md) et [setup-review.md](setup-review.md).
Execute métier n’a pas commencé ; les AC runtime restent à démontrer.

## Objectif et AC

[ticket et dix AC](ticket.md), [#74](https://github.com/issa-diallo/dossiercle/issues/74).
Provisioning durable et routage DB/rôle/secret isolés, malgré pannes/duplicats ;
READY technique sans ACTIVE, ADMIN PENDING. Tous les AC runtime restent à démontrer.
La tranche dépend de T05 fusionnée par #72, pas de T07 ou de la maintenance #73.

## Livrables et gates

- [Research et code observé](research.md), [review PASS](research-review.md).
- [Design final](design.md), [reviews et corrections D1/D2/P1/P2](design-review.md).
- [Plan exécutable et tests par AC](plan.md), [review PASS](plan-review.md).
- [Goal de préparation](goal.md), [contrôles documentaires](documentation-checks.md),
  [Setup 0a](setup-0a.md) et [preuves Setup 0b](environment.md).

Un écrivain /root ; explorateurs code/architecture en lecture seule, reviewer
indépendant /root/t06_reviewer. Modèle/niveau hérités, détail/coût non observables.
Les reviewers de préparation et Setup 0a sont restés en lecture seule. Le setup
0b a démarré uniquement l’environnement synthétique de base, sans profil T06.

## Décisions et corrections utiles à la reprise

- Lock central via helper SECURITY DEFINER borné, aucun UPDATE identité au caller.
- Process API/coordinator partagé reconnu ; runtime RO API/RW provisioner ;
  migration/DDL propres au provisioner, orchestrateur sans ces capacités.
- Gate global durable et exécution identifiée avant effet ; perte advisory seule
  ne permet pas reprise. Arrêt réel processus/backends et inspection avant fencing.
- Ancien runtime ne vérifie pas un modèle compilé : migration hors ligne avec arrêt/
  drainage/absence vérifiée, puis nouveau build contrôlé. Pas de mode mixte promis.
- Outbox creation-accepted resourceId=root ; nouveau provisioning-wakeup utilise
  resourceId=operation, génération monotone et relation durable version/attempt/round.
- READY/SUCCEEDED conserve ADMIN PENDING/NULL activated_at et fonctions false.
- Admission avant roots/J1, replays acceptés à saturation ; scope exhaustif et
  disjoint des fixtures T05/T06 pour conserver les anciennes assertions.

## Git, environnement et autorisations

Racine projet `/home/issa/Workspace/perso/dossiercle`.
Worktree `/home/issa/Workspace/perso/dossiercle/worktrees/74-s01-t06`.
Branche `feat/74-s01-t06`, HEAD/base `b18cd38b2c93234211c3c66bba654d63f297149c`.
Préparation locale non committée/non publiée par PR. Aucun commit/PR/merge dans cette
mission. Le ticket GitHub est créé/mis à jour ; aucune autre communication externe.
Ne pas perdre les nouveaux fichiers non suivis en nettoyant ou recréant le worktree.

Worktree Git uniquement ; aucun .local/secret/port/service/DB installé ou initialisé.
Setup actuel refuse l’identité74. **Prochaine action : Plan0a**, reviewer du bootstrap,
puis0b Setup froid isolé et son gate. Ne pas appeler directement --synthetic avant0a.
Conserver worktrees T04/T05/#73 et toutes ressources ; aucune autorisation de cleanup.
La fusion de T06 nécessitera instruction humaine applicable D57 ; les permissions
T04/T05 ne sont pas un mandat T06. Pas cloud, dépense ou déploiement autorisés.

## Validation et limites

[Contrôles documentaires et commandes réellement exécutées](documentation-checks.md).
Aucun build/test runtime/installation/service lancé dans cette préparation ; les
sources officielles consultées ne qualifient pas les pins en fonctionnement.
Setup/Execute/Verify/Review code/Goal implémentation/CI/Lead Tech/Ship sont futurs.
N3 licence/IAM/PRA/capacité commerciale restent obligatoires avant réel.
S01 IN_PROGRESS ; T06 PLANNED ; T07–T10 non commencées par cette mission.

## Checkpoint

Objectif restant : implémenter le Plan, prouver les dix AC et livrer jusqu’à
READY_FOR_HUMAN. Aucun blocker de préparation ni Critical/Major ouvert.
Ne pas recommencer les phases PASS sans fait nouveau ; vérifier Git/artefacts
à la reprise et utiliser le prompt. Tests de panne séquentiels, pas d’affirmation
exactly-once ou de restauration d’autorité ancienne. Coûts/tokens/quota non observables.
