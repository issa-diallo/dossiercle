# Validation humaine B11 et mandat des POC

Date : 2026-10-11. Source : échange utilisateur de cette session. Question précédente : valider la consolidation B11 et le mandat des POC locaux auth/outillage selon le dossier de bornes. Réponse utilisateur : « oui je valide ».

## Portée approuvée

- B11 : consolidation D60–D68 et amendements PRD/Stories/ADR du corpus revu ; contrôle indépendant final PASS, aucun finding ouvert. **B11: PASS humain documentaire**.
- B07-P-1 : trois phases, 2 h maximum chacune, 6 h maximum cumulées.
- B12-P-1 : quatre phases, 2 h maximum chacune, 8 h maximum cumulées.
- Chaque POC : 2 000 000 000 octets téléchargés cumulés, 0 € de dépense externe, données fictives ; au plus 4 CPU, 8 Gio RAM, 15 Gio disque temporaire et les limites de processus du dossier. Aucun reset implicite de compteur entre phases.
- Runtime local sans Internet, faux mail sink ; installations isolées et vérification des versions/empreintes ; règle d’arrêt intégrale et nettoyage ciblé du dossier maintenus.

## Portée non approuvée par cette réponse

Pas de fermeture B09, pas de PASS Architecture/B07/B12, pas de choix Inngest/licence/topologie/réseau/PRA/privacy/rétention/SLO/budget commercial, pas de cloud/données réelles/dépense/envoi externe/pilote. Les URL finales de distribution navigateur, images et scanners doivent encore être arrêtées conformément au protocole avant leurs téléchargements. Aucun accord sur des URL non présentées n’est déduit du mandat général.

## Préflight

[Hôte](poc-host-preflight.md) : capacité disque insuffisante, arrêt avant installation. [Versions](poc-version-preflight.md) : métadonnées seulement, pas de lockfile/build/runtime. Les 568 200 octets de recherche sont imputés par prudence aux deux budgets : solde de téléchargement runtime au plus 1 999 431 800 octets par essai, sans doublonner le trafic réel.

La validation B11 prend effet ; l’exécution autorisée reste conditionnée à un préflight satisfaisant et à Research/Design/Plan PASS de chaque qualification. L’ancienne fiche reste proposition historique, son mandat est désormais établi par D69 et cette preuve.
