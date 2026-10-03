# Research — #50 B09-P-1 moteur temporel local

## Statut

`RESEARCH: PASS`

## Objectif

Qualifier l'exécution locale et isolée du mini-POC B09-P-1 sans refaire la recherche externe de Q6, sans dépendance, réseau, cloud, donnée réelle ni modification du produit.

## Entrées et autorité

- Base : `main@a9679531cb88032e3ed570f6d33da156e7d8c2b5`.
- Contrat source : `docs/product/ARCHITECTURE_Q6_B09_B11.md`, sections 2 à 6 et matrice B09-S01 à B09-S38.
- Barrière d'effets : `docs/adr/006-effets-idempotence-fencing.md`.
- Horaires/fermetures : `docs/adr/011-horaires-fermetures-rapports.md`.
- Arbitrages autorisés par le brief utilisateur : D1 = validation de configuration, puis empêchement de l'incohérence historique ; D2 = retry strictement avant le créneau fixe suivant ; D3 = nouveau binding au point d'activation, sans historique automatique.

## État actuel du repo

- Le dépôt ne contient aucun runtime produit ; seulement le corpus documentaire et les scripts de contrôle agentique.
- Aucun test ou module temporel n'existe.
- Le POC peut donc rester strictement isolé sous `poc/b09_temporal/` et `tests/poc/`.
- Les canons produit, ADR, PRD, Stories, STATUS et Q1–Q6 ne seront pas modifiés.

## Dépendances

- Internes : aucune dépendance au produit.
- Externes : aucune.
- Standard library seulement : `datetime`, `zoneinfo`, `dataclasses`, `enum`, `threading`, `pathlib`, `importlib.metadata`, `unittest`.
- La tzdb disponible via `zoneinfo` est une ressource système en lecture seule. Le POC lit d'abord un marqueur concret `YYYYx` dans `TZPATH/tzdata.zi`, puis normalise le metadata PEP 440 du paquet `tzdata` (`YYYY.N` -> `YYYYx`) en repli. Le 2026-10-03, cet hôte expose réellement `2026c`, sans que cette valeur soit une exigence CI.

## Modèle de preuve retenu

```text
horloge contrôlée + autorités synthétiques
    -> matérialisation sous clé logique stable
    -> résolution civile stricte IANA
    -> contrôles fermeture/planning/droits/mandat/binding
    -> génération bornée par watermarks
    -> transport factice confirmé / échec certain / inconnu
    -> curseur CAS uniquement après confirmation
```

## Sécurité et isolation

- Authentification : hors scope du POC ; une autorité synthétique représente l'identité de service.
- Autorisation : droits, mandat Communications, agence et binding sont recontrôlés avant génération et avant effet.
- Tenant : `agency_id` est inclus dans chaque clé logique et chaque binding synthétique.
- Données sensibles : aucune ; identifiants et événements artificiels.
- Effet externe : transport mémoire uniquement, sans socket ni fournisseur.
- Validation humaine : `RESULT_UNKNOWN` reste bloqué et exige une réconciliation explicite non automatisée.

## Risques et réponses

- Ambiguïtés `fold` de `zoneinfo` : résolution par aller-retour UTC pour compter exactement les instants valides ; zéro ou deux sont refusés.
- Concurrence : stockage mémoire protégé par verrou et contraintes logiques explicites ; cela démontre l'invariant, pas une transaction de production.
- Couverture des 38 scénarios : tests nommés et matrice de traçabilité dans `verify.md`.
- Incohérence historique D1 : construction legacy permise uniquement pour la fixture, mais occurrence empêchée à l'exécution.
- Bornes d'envoi : aucune première tentative avant `scheduled_at_utc` ; toute occurrence non envoyée devient `PREVENTED_LATE` au créneau fixe suivant, même sans tentative antérieure.
- Résultat inconnu : blocage de la même occurrence et des occurrences suivantes du binding jusqu'à réconciliation explicite `CONFIRMED`, `CERTAIN_FAILURE` ou `UNKNOWN`.
- Frontières non fiables : les retours transport et réconciliation sont validés par type exact. `None`, chaînes et objets arbitraires sont normalisés en inconnu, audités et ne peuvent ni confirmer, ni avancer le curseur, ni débloquer le binding.
- Course scheduler/tzdb : chaque candidat annonce sa vue planning/tzdb ; toute différence de version, zone, fenêtres ou slots est auditée puis ignorée au profit de l'autorité courante et de la tzdb courante du moteur, y compris dans `apply_schedule_change()`.
- Historique : un changement effectif ne réécrit jamais une révision `PLANNED` ; l'ancienne est fermée `SUPERSEDED_PLANNING`, ses attributs de preuve restent intacts et une seule nouvelle révision devient active. Une résolution DST terminale est aussi inscrite dans l'audit de l'obligation. Aucun changement effectif ne crée de révision.
- Reproductibilité D2 : chaque révision conserve son tuple immuable de slots matérialisés ; la borne de retard est calculée depuis ce tuple, pas depuis la constante produit globale.
- S08 : la fermeture synthétique vendredi 12:00 -> lundi 12:00 doit produire vendredi `[PLANNED, CLOSED, CLOSED]`, lundi `[CLOSED, PLANNED, PLANNED]`, aucune occurrence au reopening et une couverture reprise depuis le dernier envoi confirmé.
- Rollback de séquence : état `SEQUENCE_ROLLBACK` et audit dédiés ; aucune reprise sans correction de la source puis réconciliation explicite.
- Finalité des empêchements : tout état listé dans `TERMINAL_PREVENTED` conserve sa révision, son état et son audit malgré un retrait de fermeture ou un changement ultérieur de planning, fuseau ou tzdb. `RESULT_UNKNOWN` et `SEQUENCE_ROLLBACK` sont soumis à la même interdiction de remplacement tant que leur API de réconciliation explicite n'a pas abouti.
- Accusé Sinistres : l'autorité ne se réduit pas à un identifiant agence fourni par l'appelant. L'API reçoit le `RecipientBinding` réel, vérifie son drapeau `active` ainsi que droits, mandat, agence et snapshot d'autorité du binding, déduit l'agence du binding et journalise son identifiant. La déduplication reste contractuellement portée par `(agency_id, claim_id)` afin qu'un second binding de la même agence ne reproduise pas l'effet.

## Questions ouvertes

Aucune question bloquante dans le périmètre autorisé. Les choix runtime, stockage durable, fournisseur, SLA/PRA et adoption produit restent explicitement hors scope.

## Research Gate

- [x] repo et sources d'autorité inspectés
- [x] dépendances identifiées
- [x] fichiers impactés identifiés
- [x] risques documentés
- [x] D1/D2/D3 fixées par l'autorisation utilisateur
- [x] aucun blocker ni besoin externe

Verdict : **PASS**
