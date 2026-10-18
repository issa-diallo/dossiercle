# Review — #76 / S01–T07 Design

## Verdict et indépendance

**PASS**, après corrections et relecture le18/10/2026. Reviewer
`/root/t07_dependency_audit`, distinct de l’auteur `/root`, lecture seule.
Modèle/niveau hérités, identifiant/coût non exposés. Base135f0ea ; Design non
committé ; aucune PR/CI/qualification runtime T07 présumée.

## Inputs reviewed

Research/revue PASS, Design T07 complet, S01 Design/Plan, AuthService,
IdentityCoordinator, locks T05, capabilities/repository T06, migrations0004/0005,
orchestrateur, transport privé et parseur événements.

## Findings et corrections

Aucun Critical/Major/Minor/Nit ouvert.

D-M1 Major initial, clos : retry humain ne peut appeler reserve_t06_wakeup,
réservé à session_user control_dispatcher. Correction relue : transaction humaine
agence/opération/idempotence et audit dispatch:false ; scanner existant après
commit, reprise30s, générations/tentatives conservées, aucun appel dispatcher
sous locks humains, parser provisioning inchangé. Conforme aux sources réelles.

D-m1 Minor initial, clos : mTLS seul ne décrit pas l’autorisation du peer.
Correction relue : matrice t07-activation prepare/read vs t06-orchestrator
wake/project, certificats distincts, peer/Host/path/body bornés ; handler activated
distinct du parseur provisioning.

## Critères et sécurité

- [x] Onboarding lié/ADMIN propre, refus rôles et inter-agences.
- [x] Session/native/J1/révocation avant commit après I/O local.
- [x] Ordre locks compatible T05/T06 et absence upgrade tardive.
- [x] Prepared durable unique, réconciliation et schéma existant.
- [x] Atomicité centrale et projection locale idempotente distinctes.
- [x] Réponse perdue, replay courant et versions ; retry conforme T06.
- [x] API sans DDL/credentials migration, routeur humain fermé avant ACTIVE.
- [x] SQL et transport limités, données minimisées, fonctions IA/mail/modules false.
- [x] Rollback conservateur, D57 et validation humaine.

## Evidence et conclusion

Revue documentaire confrontée au code. Aucun test/service/code/publication ou
ressource modifié. Les courses et pannes devront être prouvées en Execute/Verify.
Allowlist runtime exclut T07 : aucun PASS Worktree Setup anticipé.
**PASS Design**, passage à Plan permis après consignation. Aucun PASS runtime.

## Précision de portée après revue Plan0

La remarque initiale allowlist reste un fait du socle. Elle n’interdit pas
son adaptation exacte dans Worktree Setup autorisé : reviewer a confirmé
Plan0a/0b par précédent74, sans aucune implémentation applicative T07. Aucun
blocker humain artificiel ni changement Architecture/Design.

## Revue indépendante de l’addendum hôte — 18 octobre 2026

Reviewer `/root/t07_review`, lecture seule. PASS préalable du protocole amendé,
après correction des findings : ACL effective `COALESCE(datacl,acldefault(...))`
avec grantee PUBLIC0, fermeture inconditionnelle même si pool.end échoue,
preuve stop durable avant readback, preuve historique liée à la trace réelle
et nouveau constat namespace/cgroups/backends. Quarantaine PASS_WITH_MINOR,
mineur d’intégrité des preuves corrigé avant exécution. Résultats réels et
empreintes dans [Recovery](recovery.md). Ce PASS borne la récupération locale;
il ne vaut pas Review produit finale ni autorisation Ship.
