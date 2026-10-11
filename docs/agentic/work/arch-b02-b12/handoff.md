# Handoff — ARCH-B02-B12

Date finale : 2026-10-11, préparation commencée le 10. État : **READY_FOR_HUMAN** pour le candidat documentaire. B11 est READY_FOR_HUMAN et gate humain PENDING_HUMAN ; Architecture BLOCKED.

Worktree : /home/issa/Workspace/perso/worktrees/arch-b02-b12-architecture. Branche : chore/arch-b02-b12-architecture. Base : 54967be. Writer unique ; aucun commit, push ou PR. Mandat : traiter blocages Architecture, consolider les décisions acquises ; aucune story produit démarrée.

## Changements

D60–D68 transposent #33/#42/#50 avec dates et supersessions de portée précise. PRD/Stories/Architecture sont réconciliés ; ADR014–016 isolent minimisation/export, retrait dépôt et rapports/bindings. Anciens corps ADR conservés avec pointeurs d’autorité ; seule clause commune obsolète dépôt OTP corrigée. F17 distingue observations du 10 et consolidation du 11. STATUS et ancien handoff #50 reçoivent addenda courants sans PASS humain implicite.

[Dossier d’arbitrage](../../../product/ARCHITECTURE_REMEDIATION.md) : B02–B12, dépendances, responsables par rôle, propositions non adoptées et demandes humaines. [Protocoles effets/PRA](../../../product/ARCHITECTURE_PROTOCOL_PROPOSAL.md) et [POC locaux](../../../product/ARCHITECTURE_POC_PROPOSAL.md) proposés uniquement. Aucune installation ou qualification nouvelle exécutée.

## Contrôles auteur

`git diff --check` et `bash scripts/agentic-check.sh` PASS ; le second contrôle uniquement présence des fichiers. Contrôle local des chemins Markdown : zéro cible de fichier manquante. Comparaison à HEAD : 37 identifiants Stories et toutes rubriques Dépendances identiques ; corps source D01–D59 identiques ; Q1–Q6 et Story Review inchangés. Aucun fichier code/test modifié. Ces contrôles ne remplacent ni revue indépendante ni CI applicative.

## Limites et suite

[Verify documentaire PASS](verify.md) et [revue indépendante PASS](review.md), sans finding ouvert ; preuves archivées. B09 : preuve locale en mémoire #50/#51, tests datés 10 octobre ; fermeture algorithmique proposée seulement, PG/crash processus/transport/HA non prouvés. B11 est READY_FOR_HUMAN après revue sans Critical/Major ; accord propriétaire distinct toujours requis. Les autres blocages licence, réseau/runtime, reprise, privacy/coûts/quotas, couverture humaine et bornes POC restent réels. Le goal utilisateur ne sera pas SATISFIED par la seule remise documentaire. Ship hors mandat présent.

## Contrôle indépendant final

Le reviewer `/root/auth_tooling_temporal` a contrôlé le candidat 3 (42 fichiers, SHA-256 `408bc1f553facbce609d9d9b7ddeb006cabea22783d946da2a369cd9b103b79a`) : **PASS documentaire**, 0 Critical/0 Major/0 Minor ouverts. Quatre archives de revue fidèles octet pour octet, deux manifests fidèles et log B09 fidèlement reproduit ; transitions de statuts cohérentes sans PASS humain/runtime. [Rapport archivé](evidence/journal-review-final.md). Après ce verdict, seules son archive et cette note ont été ajoutées, selon le périmètre autorisé par le reviewer.

B11 READY_FOR_HUMAN ; B09 QUALIFIED_LOCALLY_PENDING_HUMAN ; Architecture BLOCKED. Main reste inchangée. La prochaine décision humaine porte sur le corpus B11, le classement B09 et les mandats bornés des qualifications restantes ; aucun Ship ou nouveau POC effectué.

## Validation reçue et préflight des POC

2026-10-11 : D69 enregistre l’accord utilisateur pour B11 (PASS humain documentaire) et les POC locaux bornés. B09 non clos. Préflight hôte BLOCKED : environ 2,8 Gio libres pour capacité15 Gio. Arrêt avant installation ; aucun runtime ni nettoyage destructif. [Preuves](evidence/human-approval-b11-pocs.md). Les statuts READY_FOR_HUMAN précédents sont historiques.

Contrôle indépendant D69/préflight : **PASS documentaire**, zéro finding ; [Verify de cette étape](verify-preflight.md). Hôte/Research B07/B12 restent BLOCKED, aucun Execute commencé. Autorisation acquise pour reprise après résolution de la capacité disque.


## D71 — arrêt utilisateur et suite, 2026-10-11

Stack validée et POC arrêté : référence [D71](../../../product/ARCHITECTURE_DECISIONS.md#d71), [revue indépendante PASS](evidence/stack-d71-review2.md). B12 choix stack/outillage clos par décision ; aucun PASS technique complet. Aucun scope/container/socket B12 actif selon preuve d'arrêt archivée ; archives et assets utilisateur conservés. Les essais restants reviennent aux stories ; aucune reprise POC planifiée.

[Brouillon Design System](design-system-draft.md) prêt : préparation anticipée documentée, pas de gate franchie. Suite : finaliser les décisions d'exploitation/données/sécurité encore ouvertes, puis formaliser Design System et reprendre Research des stories dans leur DAG. Aucune nouvelle implémentation produit ou ressource cloud effectuée.

## Arbitrage courant du 2026-10-11

[Dossier reviewable](arbitrage-go-no-go.md) et ADR017–021 proposés. Choix recommandé : API Scaleway Serverless PN, Inngest Instances actif/secours inter-AZ, Cloud SQL D59 privé via IPsec/BGP ; conserver Inngest sous frontière SSPL explicitée. NO GO MFA Better Auth natif ; Keycloak prioritaire conditionnel TOTP D54 non résolu. Politique par finalité et plafond temporaires24h ; NO GO Scaleway GenAPI sous cette proposition stricte, Mistral ZDR conditionnel compte/région/contrat. Pas changement de stack adopté. STOP POC maintenu. Architecture reste BLOCKED ; aucun avis légal, devis total ou preuve d'exploitation prétendu.

## D72 — choix clôturés et arrêt avant Design System

Validation humaine explicite de Keycloak, Mistral et Inngest : [preuve](evidence/human-approval-d72-tools.md), [décision](../../../product/ARCHITECTURE_DECISIONS.md#d72). Choix de ces trois outils CLOSED_BY_DECISION, pas de nouvelle confirmation requise. Exigences et preuves de livraison maintenues ; pas de licence/contrat/sécurité réputés prouvés. Aucun nouveau POC ni Design System lancé. Autres gates Architecture non clos par extension.

## Livraison Git demandée — issue #55

Mandat explicite de fusion du corpus revu avant arrêt : [Ship](ship.md). Les mentions historiques « aucun Ship autorisé » sont supersédées dans la seule portée de livraison documentaire. Aucun Design System/POC lancé, aucun Architecture PASS implicite. Main sera synchronisé après CI et fusion ; ne pas conserver des décisions uniquement dans un worktree comme source de vérité pour le prochain agent.
