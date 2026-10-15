# Revue indépendante Worktree Setup0a — #71 / S01 T05

2026-10-15. Reviewer indépendant `/root/setup_reviewer`, implementer
`/root/implementer`. Retour transmis par l’orchestrateur `/root`.
Revue du delta0a avant tout service ; base `71c4536981aa61656b3b7ad0df42ed9c14facd00`.
Cette transcription préserve les findings reçus ; elle ne remplace pas l’avis
de revalidation du reviewer.

## Verdict initial reçu

**CHANGES_REQUIRED — Major2.** Aucun démarrage0b autorisé par ce verdict.

| Finding | Fait et risque | Correction implementer soumise |
|---|---|---|
| M1 Major | `abspath` retirait les composants `scripts/..` avant inspection ; un symlink traversé pouvait disparaître du chemin contrôlé. Le checker pouvait être chargé via un répertoire scripts symlink avant son propre contrôle. | Préflight Python inline inspecte chaque composant lexical avant réduction de `..`, vérifie fichier setup et checker et leur appartenance au répertoire scripts canonique avant chargement repo. Checker réutilisé suit le même algorithme et valide aussi les chemins script/checker du root. CLI refuse un checker invoqué hors du root. |
| M2 Major | `.local`0777 était accepté ; `mkdir(exist_ok=True)` ne corrige pas les modes retenus. Métadonnées et namespace pouvaient être ouverts à un autre UID. | Contrôle UID/type/modes exacts avant lectures/écritures : `.local`0700, environment.json0600, compose.env0600, private0700 et synthetic.json0400. Dérive refusée sans chmod de ressource retenue. Init clé contrôle le parent avant toute génération ; coordinator standalone passe la garde avant lecture de l’état. |

## Résultat des corrections soumises

Les15 cas Git initiaux,20 cas clés initiaux et16 cas SQL initiaux sont conservés.
Exécution complète après corrections : Git23/23, privacy29/29 cas réels,
UID étrangers5/5 simulations stat identifiées séparément, clés21/21, SQL simulée16/16.
Syntaxe shell, identité réelle et `git diff --check` PASS.

Les tests vérifient les refus des deux modes avant leur corps, l’absence de
réparation silencieuse, les symlinks script/checker/scripts et un parent traversé
avant `..`, ainsi qu’un appel depuis un cwd externe. Les seules métadonnées
supprimées sont celles des fixtures temporaires créées par ces tests.
Aucun service/Docker ni setup synthétique admissible lancé, aucune `.local` du
worktree71 créée. PG réel et Node24 restent hors de cette preuve déterministe.

**Revalidation indépendante : EN ATTENTE.** M1/M2 corrigés selon l’implementer,
pas encore levés par le reviewer.0b reste bloquée jusqu’à son avis favorable.

## Revalidation indépendante reçue avant0b

**PASS — Critical0/Major0/Minor0.** Reviewer `/root/setup_reviewer`,
2026-10-15, verdict transmis par `/root` avant lancement des services.
M1/M2 levés après inspection et reproduction des23 cas Git réels,29 cas privacy
réels,5 UID étrangers simulés distincts,21 cas clés et16 cas SQL simulés.
Aucune réserve ouverte au gate0a. Les limites PG/Node24/runtime restent à0b.
L’orchestrateur autorise maintenant0b ; aucun service n’a précédé ce verdict.
