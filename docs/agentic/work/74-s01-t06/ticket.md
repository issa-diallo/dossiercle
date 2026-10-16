# Ticket #74 — S01 T06

## Objectif et mandat

Implémenter #74 S01/T06 : provisioning répétable et routage isolé d’une agence après création durable T05, jusqu’à Verify, Review indépendante, CI et Lead Tech ; arrêt READY_FOR_HUMAN, sans merge, déploiement ni cleanup. Ce mandat d’implémentation, donné le 2026-10-16, prolonge le cadrage initial documenté plus bas ; il le conserve sans réécrire ses preuves historiques.

## Sources et dépendances

- T05 #71 livrée par #72, fusion `b18cd38b2c93234211c3c66bba654d63f297149c` ; T00–T04 #67/#68.
- `docs/agentic/work/S01/plan.md`, section T06 ; Design et Research S01.
- Architecture et décisions/ADR applicables ; préparation et preuves de T05.
- Mode LARGE : DDL PostgreSQL, secrets, reprise après crash, isolation multi-agence.

## Périmètre

- Processus provisioner séparé de l’API ; déclenchement interne Inngest depuis outbox durable, rechargement des identifiants et de l’autorité depuis le centre.
- Saga idempotente avec verrou PostgreSQL de session sur l’opération, tenu pendant les effets et checkpoints ; un provisioning actif plateforme, reprise sans second émetteur après perte du verrou.
- Base et rôles dérivés d’un UUID serveur, un secret versionné par agence ; contrôle de propriété avant adoption, conflit fermé, aucune destruction ou rotation aveugle.
- Création de DB fermée, suppression de CONNECT/TEMP PUBLIC, migration locale transactionnelle et octrois runtime après schéma/ACL vérifiés ; API privée de DDL.
- Routage par locator serveur et contexte autorisé, marqueur d’agence et version de schéma vérifiés ; pools bornés, éviction et fermeture à la rotation.
- Sécurité des commandes/outbox, isolement du coffre local synthétique et séparation des capacités ; aucun locator/secret client digne de confiance.
- Observabilité minimisée, reprise des interruptions et backpressure ; inventaire de connexions sous la borne locale existante.

## Critères d’acceptation à préciser dans Design/Plan

1. Un événement ne permet aucun DDL depuis un identifiant, locator, rôle ou secret fourni par un client ; le worker recharge l’opération persistée et refuse toute correspondance ou autorité invalide.
2. Une même opération rejouée, dupliquée ou exécutée par deux runners retrouve la même base, les mêmes rôles et la même version de secret ; conflit de propriété fermé, sans DROP automatique.
3. Verrou de session tenu sur toute la saga ; interruption/perte de connexion/ancien runner ne permet pas deux émetteurs concurrents ni octroi tardif. Reprise démontrée après chaque effet/checkpoint.
4. Une nouvelle base est créée ALLOW_CONNECTIONS false ; PUBLIC CONNECT/TEMP fermé avant réouverture pour migration ; runtime non propriétaire et octrois après migration/ACL. L’API n’a ni DDL ni moyen SET ROLE vers les rôles privilégiés.
5. Deux vraies agences avec bases/rôles/canaris distincts : A ne peut lire, écrire ou se connecter à B, au centre, ni aux DB Keycloak/privacyIDEA ; vérification pendant les fenêtres de provisioning et après octrois.
6. Secrets synthétiques hors Git/DB/logs, tmpfs0400 versionné ; reprise vérifie la référence et conserve les anciennes versions. Substitutions de secret, objet, locator, contexte et pool A→B fermées ; marqueur/schéma incompatibles refusent la disponibilité technique.
7. Pools ≤2 connexions, ≤4 pools par processus, deux processus runtime ; centre≤4/processus, un provisioner/migrateur, total inventorié≤80 sur max_connections100 avec réserve20. Acquisition2s/SQL5s, éviction idle60s, backpressure503 ; backlog≤100, sinon429 avant consommation de l’invitation selon le contrat S01.
8. Outbox durable redédupliquée et Inngest interne authentifié ; crash publication/ack et réveil tardif ne perdent pas d’opération et ne confèrent aucune capacité supplémentaire.
9. État et erreurs techniques sont durables et minimisés ; agence passe de PROVISIONING à READY seulement après confirmations techniques, ADMIN reste PENDING et accès métier fermé. Aucune publication ACTIVE/activation T07 par T06.
10. Build/tests domaine, PostgreSQL réel, contrats internes, isolation et pannes/pools prévus et exécutés lors de l’implémentation ; non-régression T04/T05 et CI de tête, review indépendante puis Lead Tech requis avant livraison.

## Hors périmètre

T07 activation/ACTIVE, T08 UI, T09–T10 livraison globale, facturation, IA, mail applicatif, B05/B06, données réelles, cloud/dépense/déploiement, qualification commerciale IAM/PRA/charge. Aucun cleanup de worktrees, volumes, bases, J1, clés ou fixtures existants.

## Gates et transmission

Branche/worktree dédiés au numéro de ce ticket, un écrivain ; explorateurs et reviewers en lecture seule. Research PASS précède Design, Design PASS précède Plan. Artefacts sous `docs/agentic/work/<ticket>-s01-t06/`, avec revues, goal de préparation, handoff et prompt implementer. Les preuves runtime sont planifiées, jamais déclarées acquises dans cette mission. Aucune autorisation de fusion déduite des missions précédentes ; D57 reste applicable.

## Préparation initiale au 2026-10-16

**PLANNED à cette date** : Research PASS, Design PASS révision3, Plan PASS révision2 après
revues indépendantes. D1/D2/P1/P2 corrigés et relus, aucun Critical/Major ouvert.
Précisions retenues : helper de locks borné sans UPDATE identité au caller ;
runtime RW provisioner/RO API-coordinator ; migration hors ligne avec ancien
runtime arrêté/drainé ; ledger et événement provisioning-wakeup bornés.

Branche `feat/74-s01-t06`, worktree `worktrees/74-s01-t06`, base fusionnée
`b18cd38b2c93234211c3c66bba654d63f297149c`. Artefacts locaux non committés/non
publiés dans `docs/agentic/work/74-s01-t06/` : research/design/plan, leurs revues,
goal, handoff et implementation-prompt. À cette date, aucun code/runtime/installation/service ou Setup applicatif T06 exécuté ; tests fonctionnels futurs définis par AC. Execute ultérieur détaillé dans [execute.md](execute.md).
Contrôles présence/whitespace/liens locaux PASS, portée documentaire uniquement.

Prochain agent : commencer par Plan0a (identité/bootstrap revus), puis0b Setup
froid isolé avant Execute. Arrêt de cette mission après Plan et prompt ; S01
IN_PROGRESS, aucun AC S01 complet coché. #73 reste une maintenance indépendante.
