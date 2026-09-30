# Story Review — DossierClé

## Status et périmètre

`STORY_REVIEW: PASS`

- Reviewer : agent indépendant de l’auteur des Stories ; 2026-09-30.
- Ticket #25, branche `docs/stories-v1`, mode LARGE ; revue produit documentaire uniquement.
- Lecture intégrale par lots : `PRD.md` lignes 1–951 et `STORIES.md` lignes 1–963, sans portion omise. Lecture des règles AGENTS/COMMITS, README, METHOD/WORKFLOW/SCALING/SAFETY et des deux checklists du brief.
- La matrice utilisateur du 2026-09-30 complète le PRD, qui reportait les rôles aux Stories/Architecture. Elle ne constitue pas une décision technique nouvelle.
- Empreintes SHA-256 du contenu effectivement revu (ce rapport ne se hache pas lui-même) :
  - `docs/product/PRD.md` : `1ef211f79b9e29af0ac61c00046aa984b0e8c706e6c530ec8fbcd58a85c57d6d`
  - `docs/product/STORIES.md` : `8fb03181226799932765e5391cf772674b5f827bd911119ad8fad090c0d474d8`

## Verdict argumenté

**PASS : aucun Critical ni Major identifié.** Les 37 stories couvrent les 12 groupes demandés et le connecteur API conditionnel, avec critères observables, refus, dépendances et tests attendus. Le socle de sécurité, la validation humaine et la traçabilité précèdent les actes concernés ; Sinistres est validé avant Location. Les exclusions locatives ne sont pas réintroduites sous couvert de validation humaine.

Ce PASS autorise le passage au gate Architecture, **pas Execute, le pilote réel, un merge ou un déploiement**. Les preuves applicatives restent à produire ; la taille documentaire n’est pas un motif de blocage dans ce périmètre autorisé.

## Findings

### Critical / Major

Aucun finding ouvert dans ces catégories.

### Minor — précisions à reprendre dans la préparation

1. **Fenêtre historique du week-end encore ouverte.** `STORIES.md:604–616,950` préserve le vendredi dans le rapport du lundi et la visibilité des dossiers ouverts, mais ne fixe pas où apparaissent les actions terminées du week-end. Le PRD « §11 Rapports opérationnels automatiques » (`PRD.md:390–419`) ne tranche pas non plus ce cas. **Non bloquant pour Stories**, car explicitement reporté : avant Design PASS de S26, fixer la fenêtre sans modifier les horaires ni perdre les tâches ouvertes, et ajouter un scénario vendredi/samedi/dimanche/lundi.
2. **Sizing S30 à surveiller.** `STORIES.md:683–703` réunit qualification Location, biens similaires, proposition/suivi de visite et réponse courante sous M. La tranche reste bornée et testable grâce au catalogue, au traitement commun et aux contrôles déjà livrés ; elle n’ajoute ni agenda externe ni réservation. Avant Plan PASS, confirmer ce périmètre réel ; si les visites exigent un parcours autonome substantiel, séparer la réponse/recherche et le suivi des visites en conservant S21 comme prérequis. Aucun découpage obligatoire identifié au présent gate.

Aucune correction bloquante demandée à STORIES ; les deux points ci-dessus ne doivent pas être arbitrés silencieusement pendant Execute.

## Couverture indépendante du PRD

« Couverte » signifie obligation documentée, non fonctionnalité exécutée. Les intitulés renvoient aux sections du PRD canonique.

| Source PRD et obligation | Couverture vérifiée | Résultat |
|---|---|---|
| Vision ; Problème ; Utilisateurs ; Jobs ; Proposition de valeur | S01–S36, R01, G08 ; agence mixte et spécialisation conservées | Couverte |
| Principes produit obligatoires ; Scope V1 / Ordre de livraison | R02–R05, S21 avant S30 ; original conservé, règles déterministes, autonomie révocable | Couverte |
| §1 Espace agence ; Sécurité | S01–S06, R01/R02/R04, G01 ; accès serveur, isolation, révocation et bootstrap | Couverte |
| §2 Connexion de plusieurs boîtes e-mail ; Parcours A | S07–S09/S13 ; Gmail, Microsoft 365, IMAP, alias distincts, test sans envoi, révocation indépendante | Couverte |
| §3 Contacts et conversations | S14/S35 ; multi-adresses, recherche, chronologie, séparation et correction des rapprochements | Couverte |
| §4 Traitement commun des messages ; Parcours E | S13–S15/S34 ; original, déduplication multiboîtes, qualification corrigeable, échec visible et reprise bornée | Couverte |
| §4 Coordination ; Parcours F | S16–S18 ; prise exclusive, expiration, transfert, sept statuts/tags, contrôle avant effet | Couverte |
| §5 Catalogue ; Identification contrôlée | S28/S29/S15 ; saisie, CSV/XLSX, mapping/aperçu, idempotence, non-suppression, ordre de recherche et absence de SQL IA | Couverte |
| §5 Connecteur API | S37 conditionnelle : validation Architecture et activation explicite ; aucun blocage de la V1 saisie/import | Couverte, optionnelle |
| §5 Workflow Biens ; Parcours B | S30–S33 ; disponibilité, similaires, visites, collecte privée, complétude objective et transmission humaine | Couverte |
| §6 Workflow Sinistres ; Parcours C | S19–S21/S24/S35 ; urgence justifiée, compléments, relances/arrêts, résolution et clôture routinière | Couverte |
| §7 Annuaire artisans ; Parcours D | S22/S23/S35 ; champs, statuts, justificatifs, doublons, CSV contrôlé, vérification humaine | Couverte |
| §8 Proposition d’artisans | S24 ; critères déterministes, actifs seulement, justification, demande non engageante | Couverte |
| §9 Supervision fonctionnelle | S09/S18/S34–S36 ; files, responsables, erreurs, validations et audit | Couverte |
| §10 Mandat d’autonomie | S10–S12, R01–R04, S35/S36 ; trois modes, restrictions, versions, suspension et reprise sans rejeu | Couverte |
| §11 Rapports opérationnels | S25–S27 ; trois horaires locaux lundi–vendredi, lundi/vendredi, droits, aucune activité, états, unicité et reprise | Couverte ; précision mineure ci-dessus |
| Autonomie, escalade et validation humaine | R03/R04, S12/S18–S24/S31–S35 ; actes protégés, arrêts, destinataire et mandat recontrôlés | Couverte |
| Contraintes métier/légales/sécurité/techniques/budget ; Données sensibles | R01–R05, S03, G01–G07 et registre Architecture ; contraintes techniques préexistantes conservées, aucune stack nouvelle | Couverte au gate documentaire |
| Charge, fiabilité et performance | G05 : cinq scénarios, sessions authentifiées, fixtures/graine/chemins/hash, catalogue, durées et seuils PRD conservés | Couverte, preuve future |
| Succès fonctionnel, utilisateur, commercial ; Gate GO/PIVOT/KILL | S07/S21/S29–S33 et G01–G08 ; deux boîtes indépendantes, restauration, mesures préalables et seuils du pilote | Couverte, preuve future |
| Risques ; Hypothèses ; Questions ouvertes | G01–G08, tests fournisseurs, décisions reportées avant Architecture/Design/pilote | Couverte sans prétendre les hypothèses validées |
| Scope V2 ; Version ultérieure ; Non-scope ; Décisions enregistrées | R03, hors périmètres et matrice : invitation/portail, paiements/RIB, bail, solvabilité et sélection exclus | Respectée |

## Dépendances, ordre et sécurité

- Contrôle automatique : **37 identifiants uniques, aucune référence inconnue, DAG acyclique**. La séquence proposée (`STORIES.md:863–883`) respecte les dépendances déclarées ; les groupes éditoriaux ne prétendent pas être l’ordre de livraison.
- S28 précède S15 : le rattachement Sinistres n’attend pas Location. S22/S23 puis S24 précèdent S21 : le parcours Sinistres complet inclut les artisans. S21 précède S30, les deux workflows restant obligatoires en V1.
- S35 est livré après S12 et avant S14/S22 et les envois métier ; il fournit une décision à usage unique, pas un exécuteur autonome prématuré. S16–S18 précèdent les effets autonomes consommateurs. R04 impose l’audit dès S01 et bloque l’acte sensible non traçable ; S36 ne retarde que la consultation consolidée.
- R01/S05/S06 définissent attribution, habilitation et action attribuée ; R02 recontrôle côté serveur les droits courants. L’habilité ne configure pas le mandat, ne l’élargit pas et ne lève pas la suspension administrateur. Le standard ne prend que ses dossiers ; libérer sa prise ne réactive pas globalement l’agent.
- S12 invalide sans conversion automatique lors de désactivation/suspension ; autonome → préparation exige une nouvelle validation courante. Les tâches invalidées ne ressuscitent pas via réactivation ou reprise d’erreur.
- S18 exige la confirmation du tag avant la première action autonome et bloque après panne de synchronisation ; le tag humain reste bloquant même sans auteur connu. Lu/non lu n’est pas un état métier.
- R03/S10/S30/S32/S35 excluent les décisions locatives même en brouillon. Les engagements Sinistres restent soumis à validation ; la demande non engageante ne permet pas de les contourner.

## Taille et testabilité

Les critères décrivent des résultats vérifiables et des contre-exemples, complétés par R02/R05 pour les refus, entrées invalides, échecs, concurrence et répétition. Les valeurs techniques et règles configurables non encore fixées ont un gate explicite avant exécution ; aucun test applicatif n’est annoncé passé.

S03 (récupération/export), S07 (même contrat OAuth pour deux fournisseurs), S12 (transitions de mandat) et S18 (contrat de tags multi-fournisseurs) sont justement signalées L : capacités cohérentes, pas workflows métier entiers dissimulés. S21 ajoute clôture et preuve d’intégration de prérequis déjà livrés, sans refaire tout Sinistres. S30 mérite le contrôle de taille noté ci-dessus. S03 et les rapports doivent être revérifiés sur toutes les données/modules V1 au gate pilote ; une fixture précoce ne suffit pas.

## Preuves documentaires exécutées

| Commande | Résultat réel | Portée |
|---|---|---|
| `python3 /root/project/dossiercle-worktrees/verify-stories.py docs/product/STORIES.md` | Code 0, PASS : 37 stories, DAG acyclique, références/sections valides, aucun marqueur vide | Structure seulement ; pas validation sémantique ou runtime. Aucun auto-test temporaire retenté. |
| `bash scripts/agentic-check.sh` | Code 0, `Agentic method check passed.` | Script lu : vérifie uniquement la présence des fichiers ; ne valide pas Architecture ou Design System. |
| `git diff --check` | Code 0, aucune sortie | Hygiène du diff. |
| `git diff -- docs/product/PRD.md` | Aucune sortie | PRD inchangé dans le worktree. |
| `sha256sum docs/product/STORIES.md docs/product/PRD.md` | Empreintes ci-dessus | Version exacte revue. |

Aucun runtime, test de charge, preuve pilote ou résultat CI revendiqué. Aucun commit, push, merge ou déploiement réalisé par le reviewer. Seul `docs/product/STORY_REVIEW.md` est écrit par cette revue.

## Story Review Gate

- Critical ouverts : **0**.
- Major ouverts : **0**.
- Minor ouverts : **2**, affectés à la préparation des stories concernées.
- **Verdict final : PASS**, pour les seules empreintes indiquées. Toute modification substantielle des Stories appelle une nouvelle revue du contenu modifié.
