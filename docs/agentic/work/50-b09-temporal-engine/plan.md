# Plan — #50 B09-P-1 moteur temporel local

## Statut

`PLAN: PASS`

## Résultat attendu

Un POC Python standard-library, reproductible et sans réseau démontre les invariants B09 et D1/D2/D3. Les 38 scénarios Q6 sont reliés à des tests nommés. Deux exécutions complètes produisent le même résultat.

## Séquence TDD obligatoire

### 1. Préparer les tests uniquement

- créer `tests/poc/test_b09_temporal.py` avant tout module de production ;
- exprimer l'API souhaitée, les transitions, les cas DST, fermetures, watermarks, autorités et concurrence ;
- lancer `python3 -m unittest discover -s tests/poc -v` ;
- consigner le RED attendu causé par l'absence du module.

### 2. Implémenter le minimum

- créer `poc/b09_temporal/__init__.py` et `poc/b09_temporal/engine.py` ;
- utiliser uniquement la bibliothèque standard ;
- garder l'état et le transport en mémoire ;
- ne toucher à aucun runtime ou canon produit.

### 3. Passer GREEN puis stabiliser

- corriger uniquement le code jusqu'au passage de la suite ;
- exécuter deux fois la suite complète ;
- vérifier déterminisme, absence de réseau et inventaire exact des fichiers.

### 4. Vérifier les gates du dépôt

- `git diff --check` ;
- `bash scripts/agentic-check.sh` ;
- compiler les modules Python avec `python3 -m compileall -q poc/b09_temporal tests/poc` ;
- inspecter l'état Git sans commit.

### 5. Documenter les preuves

- produire `verify.md` avec RED/GREEN, commandes réelles, matrice B09-S01..S38, limites et nettoyage ;
- produire `handoff.md` pour la revue indépendante.

### 6. Boucle de correction de revue B09-P-1

- ajouter d'abord les tests ciblés des bornes d'envoi, exception transport, réconciliation inconnue, obligations DST, changement tzdb, reprise d'une révision préparée en mémoire avant réseau, rollback de séquence et contenu Sinistres ;
- exécuter la suite ciblée et conserver les sorties RED exactes de la session ;
- modifier seulement `engine.py` et ses exports, puis corriger les anciennes fixtures qui envoyaient avant l'heure en avançant explicitement l'horloge ;
- repasser la suite avec `ResourceWarning` traité en erreur, puis les validations finales obligatoires.

### 7. Correction finale des 4 Major et 2 Minor

- ajouter avant code les tests des résultats transport/réconciliation hors enum, du binding inactif pour l'accusé, de la détection tzdb portable et du fallback package ;
- renforcer S07/S08, S18/S19 et reformuler S24 comme reprise d'une révision préparée dans le store mémoire ;
- exécuter une vraie course ancien/nouveau scheduler avec vues tzdb candidates, autorité courante, obligation unique, révision active unique et zéro double envoi ;
- observer RED, corriger seulement les frontières et la matérialisation candidate dans `engine.py`, puis exécuter GREEN ciblé et complet ;
- mettre à jour les cinq documents de travail sans toucher aux canons produit.

### 8. Dernière correction des 2 Major indépendants

- écrire d'abord un test paramétré qui matérialise chaque membre de `TERMINAL_PREVENTED`, y compris fermeture ensuite retirée, DST gap/overlap puis changement de zone, nouveau planning et nouvelle tzdb ; exiger même objet, même révision active, même état, même audit, même curseur et zéro transport ;
- ajouter les cas `RESULT_UNKNOWN` et `SEQUENCE_ROLLBACK` pour interdire tout remplacement avant leur réconciliation explicite ;
- observer le RED de `apply_schedule_change()` avant d'ajouter la garde générique sur `TERMINAL_PREVENTED` et `SEQUENCE_ROLLBACK` ;
- refactorer les tests Sinistres vers une API recevant le `RecipientBinding`, puis observer le refus manquant après `revoke_binding()` ;
- journaliser `binding_id`, dériver `agency_id` du binding, recontrôler binding réel et autorité, et conserver la déduplication `(agency_id, claim_id)` ;
- prouver qu'un autre binding de la même agence ne produit pas un second accusé ; mettre à jour Research, Design, Verify et Handoff.

### 9. Correction de revue : autorité, historique, D2 et S08

- écrire avant code la reproduction obligation `v1`, candidat `v2/Europe-London`, autorité `v3/UTC`, ainsi que la course ancien/nouveau scheduler ; exiger audit du candidat, révision active `v3/UTC`, préparation/envoi possibles et aucune prévention de droits induite par le candidat ;
- écrire les cas UTC -> Paris gap/overlap et exiger ancienne révision `SUPERSEDED_PLANNING` conservée, nouvelle révision terminale unique, audit explicite, zéro résurrection/transport ; ajouter le no-op sans révision artificielle ;
- écrire le test D2 à slots synthétiques `02:30/03:30`, conserver ces slots dans la révision et exiger `PREVENTED_LATE` à `03:30` locale sans transport ;
- écrire le scénario S08 exact vendredi après-midi -> lundi midi et limiter la matrice Verify à cette preuve ;
- observer RED ciblé, modifier seulement le moteur, obtenir GREEN ciblé puis suite complète stricte deux fois et gates dépôt.

## Données / migrations

- schéma produit : aucun ;
- migration : aucune ;
- données : fixtures synthétiques en mémoire ;
- rollback : supprimer les seuls chemins POC et dossier de travail du ticket.

## Sécurité

- aucun secret, compte, donnée réelle, socket ou fournisseur ;
- autorités synthétiques recontrôlées avant effet ;
- résultat inconnu fail-closed ;
- identifiant agence dans les clés.

## Tests prévus

- unitaires : résolution IANA, intervalles, planning D1, D2, D3, clés/révisions, curseurs, autorités ;
- intégration locale : scheduling -> génération -> transport mémoire -> confirmation ;
- concurrence : deux threads et changement de planning ;
- reproductibilité : suite complète deux fois ;
- dépôt : compileall, diff-check, agentic-check.

## Risques et mitigations

- tzdb hôte différente : lecture robuste de la version réellement utilisée, échec explicite si elle est indéterminable, aucun téléchargement.
- test trop agrégé : noms explicites et matrice scénario -> méthode.
- faux exactly-once : limites en mémoire documentées ; aucune revendication de production.

## Fichiers prévus

- create : `poc/b09_temporal/__init__.py`, `poc/b09_temporal/engine.py`, `tests/poc/test_b09_temporal.py`, cinq artefacts sous `docs/agentic/work/50-b09-temporal-engine/`.
- modify : aucun fichier existant.
- delete : aucun.

## Plan Gate

- [x] étapes actionnables
- [x] stratégie TDD et tests définies
- [x] sécurité et isolation couvertes
- [x] dépendances résolues
- [x] aucun blocker

Verdict : **PASS**
