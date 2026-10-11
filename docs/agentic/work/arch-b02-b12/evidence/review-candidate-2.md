# Revue indépendante ARCH-B02-B12 — candidat 2

Date : 2026-10-11. **Verdict documentaire : PASS. 0 Critical, 0 Major, 0 Minor ouverts.**

Candidat gelé : `6f6d24c859a308e398f08da04f25ca9b8b5e087278a5f0915806f6590b67d87c`, 32 fichiers, manifeste `/tmp/dossiercle-arch-candidate2.json`. Les 32 empreintes de fichiers ont été recalculées : aucune divergence. Dix fichiers changés depuis le candidat 1, relus en ciblant corrections et contexte. Aucun fichier du worktree modifié par reviewer.

## Fermeture des findings

| Finding candidat 1 | Correction constatée | Résultat |
|---|---|---|
| FR01 Major — export EML | Architecture:214 contrôle seuls fichiers dérivés CSV/JSON et archive autorisée, sans EML/original ; sécurité et droits conservés | CLOSED |
| FR02 Major — horaires ouverts | Architecture:213 applique D66/D67/ADR016, aucune exception implicite ; preuve voisine:219 actualisée | CLOSED |
| FR03 / CR01 Major — poursuite après arrêt | POC:65 distingue échec fonctionnel borné et arrêt sécurité/réseau/dépense/plafond ; ce dernier termine essai, nettoyage/rapport, aucune reprise/reset implicite | CLOSED |
| FR04 Minor — re-MFA ambiguë | ADR014:41 maintient explicitement le refus de re-MFA spécifique export D42/D44 | CLOSED |
| FR05 Minor — réautorisation | D67, ADR016, PRD, Architecture, S25/S26 explicitent destinataire nouveau ou réautorisé, nouveau binding, activation et aucun ancien curseur | CLOSED |
| FR06 / CR02 Minor — SDK callback | ADR005 addendum technique rend ancienne injonction raw body historique ; SDK exact épinglé/canonicalisation/méthodes qualifiées, signature/anti-rejeu conservés | CLOSED |
| FR07 / CR03 Minor — lisibilité/auth | Matrice paquet/version lisible, espaces des ajouts corrigés ; password correct/incorrect avec anti-énumération explicite ; régénération atomique des anciens codes sous session fraîche et TOTP courant | CLOSED |
| FR08 Minor — rapport versus EML | PRD:422/954 et S27 conservent artefact de synthèse générée, révision/hash/état/provenance, sans archive SMTP/EML ; reprise même contenu sans régénération préservée | CLOSED |

Les corrections restent bornées à la consolidation. Aucune nouvelle décision d’architecture, acceptation de risque, réduction du gate Q4, durée métier, quota, fournisseur, installation ou POC n’a été introduit. Aucune régression documentaire substantive constatée dans les deltas.

## Portée et limites du PASS

La lecture globale du candidat 1 et les contrôles de ce candidat 2 couvrent les décisions/supersessions, le corpus courant et les protocoles proposés. Le recalcul indépendant au candidat 1 a trouvé 37 stories, DAG acyclique et dépendances identiques ; les deltas S25–S27 de ce candidat ne touchent aucune dépendance. Les checks root du candidat 2 confirment identifiants, D01–D59, corpus historique, liens/anchors et diff propres.

Node 22.23.1 satisfait les engines déclarés Vitest 5.0.3 `^22.12.0 || ^24.0.0 || >=26.0.0` ; le contrat Q4 exige séparément Node `>=24.21.0 <25`. La fiche ne confond pas compatibilité de paquet et qualification de la cible.

B09 reste preuve algorithmique en mémoire avec transport factice et revue narrative indépendante ; le double 63/63 sous Python 3.12.3 n’est pas preuve de PG, crash de processus, HA, fournisseur, PRA ou CI produit. La revue narrative ne perd pas sa valeur parce que GitHub n’enregistre pas de review native ; son attribution reste explicitement limitée.

Le PASS permet la transition documentaire **B11 READY_FOR_HUMAN**, après archivage de Verify/Review/preuves. Il ne vaut pas accord humain **B11: PASS**, fermeture officielle **B09**, ni **ARCHITECTURE: PASS**. Les gates humains et les autres blocages demeurent visibles. Ship et nouveaux essais ne sont pas autorisés par cette revue.

Indépendance : reviewer non writer ; contribution initiale POC exploratoire relue séparément par reviewer infra (CR01–CR03), corrections vérifiées ici. Rapport original `/tmp/dossiercle-arch-final-review.md` conservé comme journal du BLOCKED et de ses findings. Aucun test supplémentaire relancé, aucune installation/ressource/dépense.
