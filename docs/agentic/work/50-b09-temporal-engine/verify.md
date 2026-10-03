# Verify — #50 B09-P-1 moteur temporel local

## Statut

`VERIFY: PASS`

Date : 2026-10-03
Environnement : Python 3.14.7, bibliothèque standard uniquement. La valeur tzdb de cet hôte est `2026c`, lue dans `/usr/share/zoneinfo/tzdata.zi`; cette constatation datée n'est pas une exigence CI.

## Correction finale bornée — 2 Major restants

### RED — synchronisation intégrale et obligation préexistante

Commande : suite ciblée de six reproductions couvrant la zone à version identique, fenêtres/slots, tzdb, fingerprint complet, obligation préexistante et course `materialize_candidate()`.

Résultat observé : exit `1`, **6 tests exécutés**, `FAILED (failures=12)`.

- `deliver()` transportait encore une révision `v1/Europe-Paris` lorsque l'autorité courante était `v1/UTC` ; aucune révision historique autoritaire n'était créée ;
- `evaluate()` et `prepare()` ne synchronisaient ni fenêtres, ni slots, ni tzdb ;
- `_authority_status()` ne rejetait que la version et ignorait zone, tzdb, fenêtres, slots, validité et instant résolu ;
- `materialize_candidate()` retournait silencieusement une obligation préexistante `v1/Paris` sous autorité `v2/UTC`, y compris dans la course.

Un RED ciblé supplémentaire sur une révision `FAILED_CERTAIN` a produit **1 test, 1 failure** : le retry non terminal restait sur l'ancienne autorité et finissait `PREVENTED_RIGHTS`.

### GREEN ciblé

La suite ciblée finale exécute **7/7 PASS**, sans erreur ni warning. Elle prouve :

- fingerprint unique sur version, zone, tzdb moteur, fenêtres, slots, validité et instant résolu ;
- synchronisation par nouvelle révision historique avant `evaluate()`, `prepare()` et `deliver()`, y compris après échec certain ;
- reproduction exacte `v1/Europe-Paris` -> autorité `v1/UTC`, ancienne `SUPERSEDED_PLANNING`, contenu et transport uniquement sur la révision UTC, un seul envoi ;
- obligation préexistante `v1/Paris` + candidat/autorité `v2/UTC` mise à jour immédiatement, puis candidat distinct périmé audité sans révision no-op ;
- course sur la même clé : une obligation, deux révisions au total, une active et un seul transport ;
- empêchement terminal conservé par `materialize_candidate()`.

### GREEN complet final

```text
python3 -W error -m unittest discover -s tests/poc -v
python3 -W error -m unittest discover -s tests/poc -v
```

Résultat observé : **63/63 PASS**, puis **63/63 PASS**, aucune erreur ni warning.

## Preuve TDD de la correction de revue courante

Les tests ciblés ont été ajoutés avant les changements de `engine.py`.

### RED — autorité courante, historique et slots D2

Commande :

```text
python3 -W error -m unittest -v \
  tests.poc.test_b09_temporal.ClosureAndCoverageTests.test_s08_friday_afternoon_to_monday_noon_closure_has_no_reopening_occurrence \
  tests.poc.test_b09_temporal.DeliveryAndAuthorityTests.test_d2_uses_materialized_revision_slots_for_late_boundary \
  tests.poc.test_b09_temporal.BindingAndConcurrencyTests.test_old_and_new_schedulers_racing_apply_current_authority_once \
  tests.poc.test_b09_temporal.BindingAndConcurrencyTests.test_schedule_change_ignores_stale_candidate_and_uses_current_authority \
  tests.poc.test_b09_temporal.BindingAndConcurrencyTests.test_planned_schedule_change_preserves_history_and_audits_dst_terminal_revision \
  tests.poc.test_b09_temporal.BindingAndConcurrencyTests.test_schedule_change_with_no_effective_attribute_change_creates_no_revision
```

Résultat observé : exit `1`, **6 tests exécutés**, `FAILED (failures=2, errors=3)`.

- `apply_schedule_change()` utilisait le candidat `v2/Europe-London` au lieu de l'autorité `v3/UTC` et écrasait une révision `PLANNED` en place ;
- les révisions ne conservaient pas leurs slots, rendant impossible la preuve D2 `02:30/03:30` ;
- les cas UTC -> Paris ne pouvaient pas vérifier la conservation des slots historiques ;
- S08 exact et le no-op passaient déjà et resserraient respectivement la preuve et l'absence de révision artificielle.

Deux tests voisins ajoutés ensuite ont chacun produit un RED ciblé de **1 test, 1 failure** : `materialize_candidate()` ne détectait pas une vue périmée de même version mais de zone différente, et `apply_schedule_change()` ne détectait pas des fenêtres d'action modifiées à version/zone/slots identiques.

### GREEN ciblé — 2 Major et 2 Minor

Commandes identiques après correction.

Résultat observé : **6/6 PASS**, puis **1/1 PASS** et **1/1 PASS**, aucune erreur ni warning.

### GREEN complet courant

```text
python3 -W error -m unittest discover -s tests/poc -v
```

Résultat observé deux fois : **56/56 PASS**, puis **56/56 PASS**, aucune erreur ni warning.

## Fermeture des 2 Major et 2 Minor courants

| Finding | Preuve | Résultat |
|---|---|---|
| Major — autorité courante | tests exact `v1`/candidat `v2 Europe/London`/autorité `v3 UTC`, course concurrente et voisin `materialize_candidate` | candidat audité/ignoré, nouvelle révision `v3/UTC` avec tzdb moteur, une active, préparation/envoi possibles, aucun `PREVENTED_RIGHTS` candidat, un seul transport |
| Major — historique/audit | test UTC -> Paris gap/overlap, changement de fenêtres à version identique et no-op | ancienne `PLANNED` fermée `SUPERSEDED_PLANNING` sans écrasement des attributs, nouvelle terminale unique, état DST dans l'audit, changement de planning complet détecté, aucune résurrection/transport, aucune révision artificielle sans changement |
| Minor — slots D2 | `test_d2_uses_materialized_revision_slots_for_late_boundary` | tuple `02:30/03:30` conservé dans la révision ; `02:30` devient `PREVENTED_LATE` à `03:30` locale, zéro transport ; slots produit inchangés |
| Minor — S08 | `test_s08_friday_afternoon_to_monday_noon_closure_has_no_reopening_occurrence` | vendredi `[PLANNED, CLOSED, CLOSED]`, lundi `[CLOSED, PLANNED, PLANNED]`, aucune occurrence au reopening, couverture depuis le dernier confirmé |

## Preuves des corrections précédentes conservées

### RED — quatre Major et course S21

Commande :

```text
python3 -W error::ResourceWarning -m unittest -v tests.poc.test_b09_temporal
```

Résultat observé : exit `1`, **44 tests exécutés**, `FAILED (failures=8)`.

- `None`, la chaîne `"CONFIRMED"` et un objet arbitraire confirmaient à tort dans `deliver()` ;
- les mêmes valeurs confirmaient à tort dans `reconcile_unknown()` ;
- `acknowledge_claim()` acceptait `binding_active=False` ;
- la course ancien/nouveau scheduler échouait parce que `materialize_candidate()` ne recevait pas la vue tzdb candidate ; les deux threads ont levé le `TypeError` attendu et le test a constaté zéro résultat.

Les renforcements S07/S08, S18/S19 et la reformulation précise de S24 passaient déjà avec les primitives présentes : ils resserrent la preuve et la matrice, sans nécessiter de comportement supplémentaire.

### RED — fallback metadata tzdata

Commande ciblée :

```text
python3 -W error::ResourceWarning -m unittest -v tests.poc.test_b09_temporal.StrictLocalResolutionTests.test_tzdata_package_fallback_is_normalized_to_concrete_tzdb_release
```

Résultat observé : exit `1`, **1 test exécuté**, `FAILED (failures=1)` : la valeur package `2026.3` ressortait telle quelle au lieu de la version tzdb concrète `2026c`.

### GREEN ciblé

Commande : suite ciblée des neuf tests nouveaux ou renforcés avec warnings stricts.

Résultat observé : **9/9 PASS**, aucune erreur ni warning.

### GREEN complet et déterminisme

```text
python3 -W error -m unittest discover -s tests/poc -v
python3 -W error -m unittest discover -s tests/poc -v
```

Résultat observé : **45/45 PASS** puis **45/45 PASS**, aucune erreur ni warning.

## Fermeture des quatre Major

| Major | Preuve | Résultat |
|---|---|---|
| Validation stricte de `deliver()` | `test_invalid_transport_results_fail_closed_without_cursor_advance_or_retry` injecte `None`, string et objet | `RESULT_UNKNOWN`, curseur inchangé, journal normalisé `UNKNOWN`, audit `TRANSPORT_OUTCOME_INVALID`, binding bloqué, aucun second appel |
| Validation stricte de `reconcile_unknown()` | `test_invalid_unknown_reconciliation_outcomes_remain_blocked_without_mutation` | aucune confirmation, mutation de curseur ou déblocage ; journal `UNKNOWN`, audit `RECONCILIATION_OUTCOME_INVALID` |
| Binding actif requis pour l'accusé | ancien test `binding_active=False`, désormais renforcé par `test_claim_ack_refuses_revoked_real_binding_even_when_authority_snapshot_is_active` | refus et journal vide, y compris lorsque le binding réel est révoqué mais que le snapshot d'autorité reste actif |
| Test tzdb portable | test hôte dynamique + test fallback package injecté | format concret `^\d{4}[a-z]$`, correspondance au metadata sélectionné ; aucun littéral `2026c` exigé pour l'hôte CI |

`TransportOutcome.CONFIRMED` est traité par une branche explicite dans la livraison et la réconciliation. Aucune branche `else` générique ne confirme.

## Fermeture des deux Minor

| Minor | Preuve | Résultat |
|---|---|---|
| S21 course de matérialisation | `test_materialize_candidates_racing_use_current_schedule_and_tzdb_once` | candidats planning/tzdb `v1/2026b` et `v2/2026c`, autorité courante `v2/2026c`, vue périmée auditée et ignorée, une obligation et une révision active uniques |
| Matrice resserrée précédente | tests S07, S18/S19 et S24 renommé | trois slots d'une journée fermée empêchés puis reprise de couverture ; curseur DST inchangé et événement repris au prochain instant valide ; S24 limité à la reprise d'une révision préparée dans le store mémoire |

## Matrice B09-S01 à B09-S38

| Scénario | Test(s) nommé(s) |
|---|---|
| S01–S03 | `test_three_weekday_slots_send_in_order_without_duplicate_coverage` |
| S04 | `test_weekend_creates_no_fixed_occurrence` |
| S05 | `test_monday_report_covers_since_friday_confirmed_including_weekend` |
| S06, S12, S16 | `test_closed_slot_is_visible_terminal_and_does_not_move_cursor` |
| S07, S37 | `test_full_closed_day_prevents_three_slots_and_next_open_occurrence_covers_since_confirmation` |
| S08 | `test_s08_friday_afternoon_to_monday_noon_closure_has_no_reopening_occurrence` |
| S09 | `test_overlapping_closures_create_one_prevention_and_one_audit` |
| S10 | `test_latest_closure_version_before_start_governs_unstarted_occurrence` |
| S11 | `test_closure_added_after_generation_blocks_final_delivery` |
| S13 | tests D1 configuration et legacy |
| S14 | `test_closed_report_and_sinistres_ack_are_distinct_and_deduplicated` |
| S15 | `test_half_open_closure_ending_at_slot_does_not_cover_slot` |
| S17 | `test_ambiguous_closure_boundary_is_refused` |
| S18, S19 | `test_dst_gap_and_overlap_materialize_terminal_obligations_without_transport` |
| S20, S21 | `test_old_and_new_schedulers_racing_apply_current_authority_once`, test candidat périmé exact et test changement planning/tzdb |
| S22 | `test_two_schedulers_create_one_obligation_with_schedule_independent_key` |
| S23 | `test_duplicate_prepare_and_callback_do_not_duplicate_generation_or_send` |
| S24 | `test_prepared_revision_in_memory_store_resumes_same_hash_and_sends_once` |
| S25 | tests confirmation, échec certain, D2 produit et `test_d2_uses_materialized_revision_slots_for_late_boundary` |
| S26, S27, S36 | blocage résultat inconnu, réconciliations valides et entrées invalides |
| S28, S29 | recontrôle droits/mandat/agence/binding/planning + accusé binding inactif |
| S30–S32 | test activation/réautorisation D3 |
| S33 | `test_event_after_frozen_watermark_waits_for_next_report` |
| S34 | `test_late_discovered_event_uses_sequence_and_is_not_silently_lost` |
| S35 | `test_sequence_rollback_blocks_delivery_for_reconciliation` |
| S38 | accusé Sinistres distinct, contenu exact, autorités et dédoublonnage |

## Validations finales

| Commande | Résultat |
|---|---|
| deux fois `python3 -W error -m unittest discover -s tests/poc -v` | 63/63 PASS à chaque exécution |
| `python3 -m compileall -q poc/b09_temporal tests/poc` | PASS |
| suppression Python des `__pycache__` puis recherche | PASS, zéro cache restant |
| `git diff --cached --check` | PASS |
| `git diff --check` | PASS |
| `bash scripts/agentic-check.sh` | PASS, `Agentic method check passed.` |
| état Git | exactement huit fichiers staged, aucun fichier unstaged ou hors scope |

## Limites et risques résiduels

- Store, verrou, journaux et transport restent en mémoire : aucune preuve de transaction PostgreSQL, persistance après arrêt de processus, reconstruction de processus, HA, SLA ou PRA.
- S24 prouve seulement la reprise de la même révision préparée encore présente dans le store mémoire.
- La réconciliation est une API locale explicite ; aucun fournisseur réel ni workflow opérateur n'est intégré.
- La capture tzdb prouve la version active ou le fallback package normalisé ; le POC ne vendore ni ne gèle une tzdb de production.
- Les slots synthétiques servent uniquement à exercer les états DST et la borne D2 ; les slots produit restent `DEFAULT_SLOTS`.
- Aucun résultat ne change automatiquement les verdicts canoniques B09/B11/Architecture.

## Nettoyage

Aucun compte, secret, donnée réelle, socket, réseau, cloud ou ressource externe. Les caches Python générés par la compilation ont été supprimés.

## Verify Gate

- [x] 2 Major finaux de synchronisation intégrale et matérialisation préexistante corrigés et prouvés
- [x] correction précédente des 2 Major et 2 Minor conservée
- [x] corrections précédentes (4 Major, 2 Minor) conservées sans régression
- [x] RED observé avant correction
- [x] 63 tests PASS deux fois avec warnings stricts
- [x] contrôles dépôt PASS
- [x] périmètre limité aux 8 fichiers autorisés
- [x] aucune affirmation de persistance ou de reconstruction de processus

Verdict : **PASS**
