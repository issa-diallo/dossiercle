# Design — #50 B09-P-1 moteur temporel local

## Statut

`DESIGN: PASS`

## Inputs

- Research : `research.md` — PASS.
- Architecture de qualification : `docs/product/ARCHITECTURE_Q6_B09_B11.md`.
- ADR compatibles : 006 et 011, sans les modifier ni prétendre adopter un runtime produit.

## Interfaces du POC

### Résolution civile stricte

`resolve_local(naive_local, timezone_id)` retourne l'unique instant UTC ou lève une erreur typée `NONEXISTENT` / `AMBIGUOUS`. Aucun déplacement ou choix de fold implicite.

### Planning

`ScheduleConfig` porte la version, le fuseau IANA, les créneaux fixes dont la valeur produit par défaut est la constante de module `DEFAULT_SLOTS` (`08:45`, `13:30`, `16:00`) et les fenêtres d'action. La fabrique normale refuse tout créneau hors fenêtre. Elle accepte des slots synthétiques pour les preuves DST et D2. Chaque révision copie les slots effectivement matérialisés dans un tuple immuable afin que son historique et sa borne de retard soient reproductibles. Une fabrique `legacy_unchecked` permet seulement de tester qu'une ancienne incohérence empêche l'occurrence.

### Binding et curseur

Chaque activation crée un `RecipientBinding` distinct. Son curseur initial est la séquence d'activation ; aucun historique antérieur n'est couvert. Révocation puis réautorisation crée un nouvel identifiant et un nouveau curseur.

### Obligation et révisions

Clé stable : `(agency_id, report_type, local_date, local_slot, recipient_binding_id)`. `schedule_version`, fuseau, tzdb observée, fenêtres d'action, validité de configuration, slots fixes et instant résolu sont des attributs de révision. Les fenêtres et slots sont copiés dans des tuples immuables. Le store impose une obligation unique et exactement une révision active. Tout changement effectif ferme l'ancienne révision comme `SUPERSEDED_PLANNING` sans écraser ses autres attributs, même lorsqu'elle était encore `PLANNED`, puis crée la nouvelle révision. Une résolution gap/overlap rend cette nouvelle révision terminale et ajoute son état à l'audit. Aucun changement effectif signifie aucune révision artificielle.

### États

`PLANNED`, `READY_TO_SEND`, `PREVENTED_CLOSED`, `PREVENTED_TIME_NONEXISTENT`, `PREVENTED_TIME_AMBIGUOUS`, `PREVENTED_RIGHTS`, `PREVENTED_LATE`, `SUPERSEDED_PLANNING`, `FAILED_CERTAIN`, `RESULT_UNKNOWN`, `SEQUENCE_ROLLBACK`, `SENT_CONFIRMED`.

### Fermetures

Intervalles d'instants `[start,end)`, bornes locales strictement résolues. Les chevauchements sont évalués en union logique : une occurrence reçoit un seul état d'empêchement.

### Génération et livraison

La génération capture `from_exclusive` depuis le curseur confirmé et `to_inclusive` depuis la séquence courante. Le transport mémoire répond par un membre exact de `TransportOutcome` : `CONFIRMED`, `CERTAIN_FAILURE` ou `UNKNOWN`. Une exception ordinaire après `network_started=True`, ainsi que toute valeur hors enum (`None`, chaîne, objet), est convertie en `UNKNOWN`, journalisée et auditée sans retry. Les autorités et le planning sont recontrôlés juste avant l'appel. La branche `CONFIRMED` est explicite ; aucun `else` générique ne peut confirmer ou avancer le curseur.

### Retard D2

Toute occurrence refuse l'envoi avant son instant planifié. Elle est envoyable dans l'intervalle demi-ouvert `[scheduled_at_utc, next_fixed_slot)` si les autres contrôles passent. `next_fixed_slot` provient des slots conservés par la révision active. Au créneau fixe suivant, une occurrence non envoyée devient `PREVENTED_LATE`, qu'une tentative antérieure ait eu lieu ou non. Un échec certain ne peut donc rejouer que dans cette même borne D2.

### Résultat inconnu

Une tentative inconnue bloque tout renvoi de l'obligation et toute nouvelle livraison du même binding. La réconciliation valide elle aussi un membre exact de `TransportOutcome` : `CONFIRMED` avance au watermark figé et marque `SENT_CONFIRMED` ; `CERTAIN_FAILURE` revient à `FAILED_CERTAIN` sans avancer et autorise seulement le retry encore dans D2 ; `UNKNOWN` conserve le blocage. Toute autre valeur est auditée, journalisée comme `UNKNOWN` et ne mute ni confirmation, ni curseur, ni verrou du binding.

### Rollback de séquence

Une séquence visible inférieure au curseur confirmé place l'obligation en `SEQUENCE_ROLLBACK`, avec audit de détection. La correction de la source ne suffit pas : `reconcile_sequence_rollback` doit constater la séquence restaurée, auditer la réconciliation puis remettre l'obligation en `PLANNED`.

### Version tzdb

La version réellement utilisée est extraite de `TZPATH/tzdata.zi` au format concret `YYYYx` ou, en repli, normalisée depuis le metadata du paquet `tzdata`. Chaque révision la conserve. Un changement distinct est audité sur la même obligation ; il ne crée ni seconde obligation ni double envoi. Une course ancien/nouveau scheduler transmet les deux vues candidates : l'autorité planning et la tzdb courantes gouvernent, la vue périmée est auditée puis ignorée.

### Exception Sinistres

Une intention d'accusé distincte reçoit le `RecipientBinding` réel. L'agence est dérivée de `binding.agency_id`, jamais acceptée comme paramètre indépendant. La clé anti-doublon est `(agency_id, claim_id)` ; le journal immuable contient `binding_id`, `agency_id`, `claim_id` et le contenu déterministe : « Réception confirmée. Examen à la prochaine ouverture. Retour dans les meilleurs délais. » L'effet exige simultanément `binding.active`, `authority.binding_active`, droits, mandat et agence actifs. Un binding révoqué est donc refusé même si le snapshot d'autorité indique encore un binding actif, et un autre binding de la même agence ne contourne pas la déduplication. Le texte ne promet ni début d'intervention, ni « demain », ni astreinte, ni urgence inventée.

## Concurrence et changement de planning

- Verrou unique du store mémoire pour simuler l'atomicité locale.
- `new_schedule` est seulement la vue candidate du scheduler : si elle diffère de `authority.schedule`, elle est auditée comme périmée et ignorée.
- Toute résolution et toute nouvelle révision utilisent `authority.schedule` et la tzdb courante du moteur.
- Avant comme après préparation, tout changement effectif ferme l'ancienne révision `SUPERSEDED_PLANNING` et crée une seule nouvelle révision active ; aucun attribut historique n'est réécrit en place.
- Sans changement effectif de version, zone, tzdb, slots ou instant résolu : aucune nouvelle révision.
- Après début réseau ou résultat terminal/incertain : aucune nouvelle révision envoyable.
- Tout état de `TERMINAL_PREVENTED` est définitif pour l'obligation : aucun changement de fermeture, planning, fuseau ou tzdb ne modifie la révision, l'état ou l'audit. `RESULT_UNKNOWN` et `SEQUENCE_ROLLBACK` restent eux aussi inchangés jusqu'à leur réconciliation explicite.

## Edge cases couverts

Week-end, lundi après week-end, fermeture partielle/prolongée/chevauchée/raccourcie/supprimée, frontières demi-ouvertes, DST Paris et New York, double scheduler, double préparation, reprise d'une révision préparée dans le store mémoire avant réseau, échec certain, réponse perdue, droits/mandat/agence/binding révoqués, changement planning/fuseau, watermark figé, événement tardif, rollback de séquence, rapport généré non confirmé, exception Sinistres simultanée.

## Limites assumées

Le stockage, les transactions, les callbacks et le transport sont en mémoire. Le POC prouve des invariants algorithmiques locaux, pas la durabilité, la délivrabilité, l'HA, le SLA, le PRA ni l'intégration produit.

## Design Gate

- [x] critères B09 et D1/D2/D3 représentés
- [x] états importants couverts
- [x] ADR 006/011 respectés
- [x] isolation du produit et absence de dépendance
- [x] aucune ambiguïté bloquante

Verdict : **PASS**
