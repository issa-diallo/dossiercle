# Prompt implementer — #74 / S01 T06

Copier le texte suivant dans une session d’implémentation disposant de ce workspace.
Les artefacts sont locaux, non committés ; les conserver et les inclure dans la
livraison cohérente du ticket. La préparation est terminée, pas l’implémentation.

```text
Implémente le ticket #74 « S01 — T06 Provisioning répétable et routage isolé ».

Travaille dans /home/issa/Workspace/perso/dossiercle/worktrees/74-s01-t06,
branche feat/74-s01-t06, base b18cd38b2c93234211c3c66bba654d63f297149c
(T05 fusionnée par #72). Les documents locaux de préparation sont à conserver.
Lis README.md, AGENTS.md et docs/agentic/README.md, puis
 docs/agentic/work/74-s01-t06/handoff.md,
 docs/agentic/work/74-s01-t06/ticket.md,
 docs/agentic/work/74-s01-t06/research.md et research-review.md,
 docs/agentic/work/74-s01-t06/design.md et design-review.md,
 docs/agentic/work/74-s01-t06/plan.md et plan-review.md.
Research PASS, Design PASS révision3, Plan PASS révision2 après revue indépendante.
Les décisions précises et la matrice AC/tests sont dans ces fichiers ; applique-les.

Vérifie l’état Git et la base actuelle ; préserve les artefacts non committés,
autres worktrees, DB, J1, clés et fixtures. Si main/méthode a évolué, compare et
revalide seulement les contraintes affectées. Mode LARGE, un écrivain par worktree,
reviewer indépendant ; délègue l’exécution selon les rôles du projet.

Commence par l’étape0a du Plan : adaptation exacte identité74, bootstrap des
capacités/mounts/coffre/mTLS puis revue avant premier --synthetic. Le setup actuel
refuse cette identité ; ne le contourne pas et ne copie aucun .local de T05.
Exécute ensuite0b et consigne Worktree Setup PASS avant Execute métier.

Suis le Plan jusqu’à Execute, Verify, Review indépendante et Goal d’implémentation.
Points impératifs : migration0004 additive avec arrêt/drain vérifié de l’ancien
runtime ; aucune réécriture SQL0001–0003/agency0001 ; intents/gate durables avant
DDL/coffre ; lock session global+op conservé et fencing réel avant reprise incertaine ;
profil DDL séparé/API sans DDL ; DB créée fermée puis ACL avant ouverture ; tuples,
secrets versionnés, marqueur/checksum et autorité/J1 courants vérifiés ; pools et
admission100 bornés ; deux types d’événements Inngest validés depuis leur source
centrale et ledger wakeup borné ; fixtures T05/T06 exhaustives et disjointes.

Démontre les AC avec PostgreSQL/processus/Inngest réels et tests de panne,
substitution et concurrence. Conserve les13 scénarios natifs T04/T05 ; aucune
perturbation parallèle entre suites. Exécute les checks appropriés du Plan et
consigne preuves minimisées, échecs et limites, sans secrets ni dump de logs privés.
Corrige les findings Critical/Major et rejoue les vérifications impactées.

Résultat T06 : agence READY et opération READY/SUCCEEDED, ADMIN PENDING,
activated_at NULL, aucun accès métier ni activation IA/modules/mail.
T07 activation/retry HTTP, T08 UI, cloud/dépense/déploiement et cleanup hors scope.

Après Verify/Review/Goal satisfaits, prépare la PR dédiée avec commits conformes
COMMITS.md (Gitmoji Unicode, impératif, Fixes #74). Passe la CI de la tête actuelle
et fais examiner la PR par un Lead Tech distinct du premier reviewer ; ultime
attestation hors diff si rapport committé. Arrête-toi à READY_FOR_HUMAN avec lien PR,
preuves, risques et suite. Ne fusionne pas sans instruction humaine applicable D57.
En cas de contradiction réelle, documente le blocker et un handoff ; aucun
remplacement silencieux de stack, aucune baisse de gate ni S01 déclaré DONE.
```
