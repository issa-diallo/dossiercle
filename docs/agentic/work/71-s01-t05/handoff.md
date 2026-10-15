# Handoff de préparation — #71 / S01 T05

## Mandat et état

2026-10-14. Ticket [#71](https://github.com/issa-diallo/dossiercle/issues/71).
Mandat : traiter tous écarts dans Research/Design/Plan, arrêt après Plan revu et
prompt à transmettre. État courant : **PLANNED — préparation terminée**, pas Execute.
[Research PASS](research.md), [review](research-review.md),
[Design PASS](design.md), [review](design-review.md), [Plan PASS](plan.md),
[revue finale](plan-review.md).

## Socle et Git

Base/HEAD `71c4536981aa61656b3b7ad0df42ed9c14facd00`, #68/T04 fusionné.
Branche `feat/71-s01-t05`, worktree `/home/issa/Workspace/perso/dossiercle/worktrees/71-s01-t05`.
Artefacts locaux non committés ; aucune PR créée pour cette préparation.
Un écrivain /root ; exploration et revues lecture seule, traces dans les rapports.
Ancien worktree T04, DB, journal, clés et ressources conservés.

## Choix retenus

- Ed25519 preuve owner privée dans idem existante, refs appariées/TTL24h,
  username==subject, clé privée CLI seule ; signature ne vérifie pas automatiquement
  l’identité humaine et fixture explicitement synthétique.
- Profil NOLOGIN control_t05 étroit dans coordinator privé, prélocks toutes racines
  puis autorités avant J1, même connexion ; rôle précédent restauré après audit.
- TXA réservation durable, TXB PENDING natif réconciliable, issue secret une fois,
  reissue epoch/J1 PENDING/sessions fermées ; REVOKED terminal et aucune ACTIVE.
- Receipt callback/session atomique, claim {} ou legacy token avec même receipt ;
  création agence PROVISIONING/ADMIN PENDING/opération ACCEPTED sans provisioning.
- Migration0001–0003 immuables, ajout grants/bootstrap seulement. ADR030 compatible.
- Correction setup limitée legacy/T05 et revue avant services dans le futur Setup.

## Preuves et limites

Inspection Git/code/contracts/SQL effectuée ; synthèse sourcée dans Research.
Research review PASS, Design initial CHANGES_REQUIRED puis revalidation PASS ;
les findings historiques et corrections sont conservés. Plan première revue
CHANGES_REQUIRED sur ordre keypair/setup, correction0a/0b et revalidation PASS.
Contrôles documentaires reportés ci-dessous ; build/tests/runtime non exécutés,
conformément au mandat. Aucun fichier applicatif, service, installation ou secret créé.
Modèle hérité, configuration précise/coût/quota non observables.

Contrôles exécutés dans ce worktree le2026-10-14 :

| Contrôle | Résultat et portée |
|---|---|
| `bash scripts/agentic-check.sh --existing` | PASS présence ; aucun gate runtime démontré |
| `git diff --check` | PASS sur diff suivi |
| Vérification Markdown ciblée (Python, tracked + untracked) |13 fichiers,118 liens locaux,0 erreur de lien/whitespace |

La commande Python a lu seulement les Markdown modifiés/non suivis identifiés
par Git, pas les sources applicatives ou les fichiers privés. Aucun test
applicatif/build/PG/navigateur exécuté ni CI T05 déclenchée.

## Reprise du futur implementer

Vérifier Git/artefacts/ticket avant étape0 du Plan ; appliquer DoR avant Execute.
[Prompt complet](implementation-prompt.md). Lire uniquement les sources/gaps/ADR
référencés ; ne pas repartir du Research S01 historique sans code.
L’arrêt courant intervient au Plan, pas READY_FOR_HUMAN d’une livraison applicative.
Au futur Ship, aucune autorisation merge T05 issue du mandat T04 ; revue/CI/Lead Tech
de tête et instruction humaine restent requis. Aucun déploiement/cleanup automatique.
