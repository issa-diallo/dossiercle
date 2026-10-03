# Handoff — #50 B09-P-1 moteur temporel local

## État

`IMPLEMENTATION_COMPLETE — READY_FOR_INDEPENDENT_REVIEW`

## Résumé

Les 2 derniers Major de la revue B09-P-1 sont corrigés par TDD dans le POC Python standard-library. Une empreinte unique compare désormais l'intégralité de la révision à l'autorité courante ; les obligations non terminales sont resynchronisées historiquement avant évaluation, préparation ou transport. `materialize_candidate()` met aussi à jour une obligation préexistante périmée sous verrou. Les corrections précédentes restent couvertes.

Aucun canon produit, ADR, PRD, Stories, STATUS ou document Q1–Q6 n'a été modifié. Aucun commit, push, PR ou appel GitHub.

## Fichiers du ticket

- `poc/b09_temporal/__init__.py`
- `poc/b09_temporal/engine.py`
- `tests/poc/test_b09_temporal.py`
- `docs/agentic/work/50-b09-temporal-engine/research.md`
- `docs/agentic/work/50-b09-temporal-engine/design.md`
- `docs/agentic/work/50-b09-temporal-engine/plan.md`
- `docs/agentic/work/50-b09-temporal-engine/verify.md`
- `docs/agentic/work/50-b09-temporal-engine/handoff.md`

## Corrections livrées

- Empreinte autoritaire commune : version, zone IANA, tzdb moteur, fenêtres, slots, validité de configuration et instant résolu. `_authority_status()`, la synchronisation et `apply_schedule_change()` partagent cette comparaison ; un no-op ne crée aucune révision.
- Avant `evaluate()`, `prepare()` et `deliver()`, toute obligation non terminale périmée est alignée sur `authority.schedule` par fermeture `SUPERSEDED_PLANNING` puis nouvelle révision active. Une révision `FAILED_CERTAIN` reste retryable mais est resynchronisée avant retry ; `SENT_CONFIRMED`, `RESULT_UNKNOWN`, `SEQUENCE_ROLLBACK` et les empêchements terminaux restent intouchables.
- Reproduction exacte : révision `v1/Europe-Paris`, autorité `v1/UTC` produit deux révisions, conserve l'ancienne sans contenu préparé, génère et transporte uniquement sous UTC, une fois, sans `PREVENTED_RIGHTS` artificiel.
- Les variantes même version/zone avec fenêtres ou slots différents, ainsi qu'une tzdb moteur différente, créent exactement la nouvelle révision nécessaire. Le test direct de `_authority_status()` couvre chaque composant de l'empreinte.
- `materialize_candidate()` sur clé existante appelle immédiatement le mécanisme historique autoritaire. Le cas exact obligation `v1/Paris`, candidat `v2/UTC`, autorité `v2/UTC` conserve l'ancienne, crée une seule active `v2/UTC`, puis envoie une fois.
- Un candidat distinct périmé est audité puis ignoré. La course de deux candidats sur l'obligation préexistante conserve une obligation logique, deux révisions au total, une active et un transport unique.

- `apply_schedule_change()` traite `new_schedule` comme une vue candidate : obligation `v1`, candidat `v2/Europe-London`, autorité `v3/UTC` produit une nouvelle révision active `v3/UTC`, audite/ignore `v2`, puis autorise préparation et envoi sans `PREVENTED_RIGHTS` artificiel.
- La course concurrente candidats `v1`/`v2` sous autorité `v3/UTC` conserve une obligation, deux révisions historiques, une seule active et un seul transport.
- Tout changement effectif ferme même une révision `PLANNED` en `SUPERSEDED_PLANNING` sans écraser version, zone, tzdb, fenêtres, validité, instant ou slots, puis crée la nouvelle active. Un changement de fenêtres à version identique est détecté. Les gaps/overlaps UTC -> Paris sont terminaux, audités et non ressuscitables ; un no-op ne crée aucune révision.
- Chaque révision conserve les slots matérialisés ; D2 utilise ces slots. La fixture `02:30/03:30` devient `PREVENTED_LATE` exactement à `03:30` locale, sans transport. Les slots produit restent `08:45/13:30/16:00`.
- S08 exact : fermeture vendredi 12:00 -> lundi 12:00, statuts vendredi `[PLANNED, CLOSED, CLOSED]`, lundi `[CLOSED, PLANNED, PLANNED]`, aucune occurrence au reopening et couverture depuis le dernier confirmé.
- `apply_schedule_change()` retourne sans mutation pour chaque membre de `TERMINAL_PREVENTED`, ainsi que pour `RESULT_UNKNOWN` et `SEQUENCE_ROLLBACK` ; révision, état, audit, curseur et absence de transport sont préservés.
- Le test paramétré couvre `PREVENTED_CLOSED`, `PREVENTED_RIGHTS`, `PREVENTED_LATE`, `PREVENTED_TIME_NONEXISTENT` et `PREVENTED_TIME_AMBIGUOUS`, avec fermeture retirée, nouveau planning, nouvelle zone et changement tzdb.
- `acknowledge_claim(binding, claim_id, authority)` dérive l'agence du binding, vérifie `binding.active`, `authority.binding_active`, droits, mandat et agence, puis journalise `binding_id`, `agency_id`, `claim_id` et contenu.
- La révocation réelle via `revoke_binding()` bloque l'accusé même si `authority.binding_active=True`; aucun journal n'est écrit.
- La déduplication reste `(agency_id, claim_id)` : un autre binding de la même agence ne peut pas contourner l'effet déjà produit, tandis que le binding auteur reste audité.
- Envoi interdit avant `scheduled_at_utc`; `PREVENTED_LATE` au créneau fixe suivant même sans première tentative; fenêtre D2 demi-ouverte prouvée.
- Exception ordinaire du transport après `network_started=True` convertie en `RESULT_UNKNOWN`, journalisée, binding bloqué, sans second appel.
- Réconciliation explicite `CONFIRMED` / `CERTAIN_FAILURE` / `UNKNOWN` avec effets de curseur et déblocage stricts.
- Valeurs transport/réconciliation invalides (`None`, chaîne, objet) : `RESULT_UNKNOWN`, curseur inchangé, binding bloqué, audit et journal explicites, aucun retry.
- Accusé Sinistres refusé lorsque `binding_active=False`, sans écriture journal.
- S07 : journée fermée complète avec trois occurrences empêchées ; la prochaine occurrence ouverte reprend tous les événements depuis le dernier confirmé. S08 est couvert séparément par le scénario exact vendredi après-midi -> lundi midi.
- S18/S19 : obligations DST réelles avec curseur inchangé, zéro transport et événements repris dans l'occurrence valide suivante.
- S21 : la course de matérialisation candidats/tzdb `v1/2026b` et `v2/2026c` reste couverte ; une seconde course `apply_schedule_change()` sous autorité `v3/UTC` prouve l'historique unique actif et l'absence de double envoi.
- S24 : reprise de la même révision préparée dans le store mémoire, même hash, un seul envoi ; aucune reconstruction de processus ou preuve de persistance.
- S35 : état `SEQUENCE_ROLLBACK`, audits dédiés, reprise après correction et réconciliation explicite.
- S38 : contenu déterministe exact, sans promesse d'intervention, « demain », astreinte ou urgence inventée; dédoublonnage conservé.
- `DEFAULT_SLOTS` est une constante de module.
- Les preuves RED sont présentées honnêtement comme journal de session; aucune immuabilité Git rétrospective revendiquée.

## TDD et validations

- RED courant : 6 tests, 2 failures et 3 errors ; candidat appliqué à la place de l'autorité, révision `PLANNED` écrasée et slots absents. Deux RED voisins de 1 test/1 failure couvrent une vue candidate de même version mais de zone différente et des fenêtres modifiées sans changement de version.
- GREEN courant ciblé : 6/6 puis 1/1 et 1/1 PASS sans warning.
- RED final : 6 tests, 12 failures ; zone, fenêtres, slots, tzdb, fingerprint complet et obligation préexistante n'étaient pas synchronisés. RED séparé `FAILED_CERTAIN` : 1 test, 1 failure.
- GREEN ciblé final : 7/7 PASS sans warning.
- GREEN complet final : 63/63 PASS deux fois sans warning.
- RED des deux derniers Major : 4 tests, 6 failures et 2 errors. Les cinq empêchements terminaux et `SEQUENCE_ROLLBACK` créaient une seconde révision ; l'ancienne API Sinistres ne pouvait pas recevoir le binding réel et ne voyait pas sa révocation.
- GREEN ciblé : 5/5 PASS sans warning.
- GREEN complet de cette boucle précédente : 48/48 PASS sans warning.
- RED 1 : exit 1, import de `CLAIM_ACK_CONTENT` absent, 1 erreur de chargement.
- RED correction finale : 44 tests, 8 failures ; valeurs invalides confirmées à tort, binding inactif accepté et interface de vue tzdb candidate absente. RED fallback séparé : `2026.3` non normalisé en `2026c`.
- GREEN ciblé : 9/9 PASS sans warning.
- GREEN complet de la boucle précédente : 45/45 PASS sans warning.
- Suite complète exécutée deux fois.
- `compileall`, nettoyage `__pycache__`, `git diff --check` et `scripts/agentic-check.sh` PASS.
- État Git limité aux 8 fichiers ci-dessus.

Les commandes et sorties détaillées sont dans `verify.md`.

## Limites

- Preuve algorithmique locale en mémoire, sans durabilité, fournisseur, réseau, cloud, donnée réelle, HA, SLA ou PRA.
- Réconciliation locale explicite, sans workflow opérateur réel.
- Tzdb auditée depuis l'hôte, non vendored ; constat local daté `2026c`, jamais exigence CI littérale.
- Slots DST synthétiques réservés à la preuve.
- Aucun verdict canonique B09/B11/Architecture n'est modifié.

## Revue attendue

Le reviewer doit recalculer lui-même l'identité logique de l'index et le diff après gel. Ce handoff ne publie ni hash final ni identité prétendument définitive.

## Git

- branche : `poc/50-b09-temporal-engine`
- base déclarée du ticket : `a9679531cb88032e3ed570f6d33da156e7d8c2b5`
- commit : aucun
- push/PR/issue : aucun
