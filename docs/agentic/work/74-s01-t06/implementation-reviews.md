# Revues ciblées d'implémentation — #74

## Portée

Revues indépendantes en lecture seule, transmises par l'orchestrateur à l'unique
écrivain le2026-10-16. Les PASS suivants autorisent les incréments concernés ;
ils ne constituent ni Review finale, ni Verify global, ni CI ou Lead Tech.
Les échecs et corrections sont conservés ci-dessous ; aucun test applicatif n'a
été exécuté par les reviewers. Modèle/niveau hérités, coût exact non observable.

| Périmètre | Écart initial / correction | Verdict ciblé reçu |
|---|---|---|
| Migration0005 | Runner ne chargeait pas0005 et réserve wakeup sans lock gate ; chaîne cumulative/upgrade0004 seule et FOR SHARE gate corrigés | PASS avant application offline |
| Saga | Session locks manquants, backend inventory absent, effets sans autorité ; connexion unique, intentions et contrôles par effet ajoutés | PASS |
| Secrets/checkpoint | Double ENOENT pouvait régénérer ; création première réservée seulement/neverIssued prouvé, sinon refus. schema_version nu déplacé sous repo/J1/gate | PASS ; progression tardive Minor ensuite corrigée |
| Reconcile hôte | Parent seul, snapshot backends pré-stop, preuves non liées durablement, J1/readbacks incomplets ; instance/groupe arrêtés, inventaire final, readbacks complets, preuves fsync0400+SHA et autorité courante | PASS après corrections |
| Transport | Double lecteur SDK supprimé ; deadline absolue, aborted/error, root manifeste strict et native signatures conservées | PASS |
| Workers Inngest | worker1 ne scanne pas sous pin1.46.0 (minWorkersFree5) ; delta revu5 workers, PGmax4/idle2 et concurrence fonction1 inchangés | PASS avant restart |
| Incident host B | Pas de PID exact conservé ; aucune émission prouvée, CLOSED known-unissued au lieu de FENCED, locator/intents/provenance vérifiés | PASS ; confusion ultérieure A/B explicitement rectifiée par reviewer |
| PREPARE | Six intentions et locator autrefois committés séparément ; transaction atomique et barrières exactes ajoutées | PASS avant cut processus |
| Capacité technique | Contexte libre et course tâche détachée ; scope dérivé, tâches enregistrées avant await, fermeture/drain avant COMMIT/ROLLBACK, génération et rejets propagés | PASS |
| Routeur humain | Callback libre seul insuffisant ; factory concret central/J1, membership/agency/session/epoch/cookie/expiration, durée ALS fermée | Recheck explicite du factory actuel PASS ; aucun finding |
| CREATE sans réponse | DB fermée sans commentaire autrefois incertaine ; rôles puis commit précondition absence/OID avant nouveau run CREATE, adoption bornée, readbacks et ancien inventaire migration | PASS avant14 cuts |
| Manifestes | Crash après receipt pouvait classer T06 en T05 ; intentions tuple pré-BEGIN et scopes HTTP pré-POST, liaison centrale exhaustive, préflight et fsync | PASS après deux rechecks ; uid lecture ensuite ajouté |
| Budget pools | Plafond par instance devenu plafond processus ; inventaire/file sérialisés, aucun pool actif évincé, libération sur close/rotation/expiration | PASS avant preuve PG enrichie |

## Réserves conservées

La fermeture prudente d'un état ambigu n'est pas présentée comme preuve de reprise.
La garde de startup testée par fonction n'est pas présentée comme boot processus.
Les premiers auto-SIGSTOP PID1 ne sont pas comptés comme pauses ; les tests actuels
contrôlent PID hôte et état T. Les résultats globaux, revues finales et Ship restent
séparés dans [Verify](verify.md) et le futur rapport de livraison.

## Clarification de portée pendant Review globale

Le finding initial « création HTTP hors manifeste non consommée » a été retiré
après arbitrage de Design §9 : la tranche livrée est syntheticOnly, avec allowlist
T06 additionnelle obligatoire dans les launchers. La validation centrale existe
avant ce filtre ; `allowed` demeure obligatoire dans la configuration actuelle.
Aucune qualification du wiring nonsynthétique ni du déploiement n'est annoncée.
Aucun changement de code n'a été fait pour cet arbitrage. La [Review globale finale](review.md) est PASS_WITH_MINOR ; son verdict est distinct
de cette clarification non bloquante.
