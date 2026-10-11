# Ship — livraison documentaire Architecture

Date : 2026-10-11. Issue [#55](https://github.com/issa-diallo/dossiercle/issues/55). Branche `chore/arch-b02-b12-architecture`.

## Autorisation

L'utilisateur demande explicitement de fusionner avant d'arrêter les travaux : « C'est à toi de fusionner avant d'arrêter tes travaux ». Cette instruction autorise la livraison Git du corpus préparé et revu, sans nouvelle demande de confirmation. Elle ne lance ni Design System, ni POC, ni cloud, ni application.

## Périmètre

Consolidation des décisions D60–D72, ADR, benchmarks et preuves arrêtées. Keycloak/Mistral acceptés et Inngest conservé. Choix fermes ; limites sécurité/licence/contrats/production préservées. La livraison documentaire ne transforme pas Architecture BLOCKED en PASS.

## Vérification de livraison

- Comparaison des 37 stories/dépendances et des décisions historiques ; liens/ancres locaux contrôlés.
- Revue indépendante pré-Ship, sans Critical/Major ouvert, avant fusion.
- Snapshot brut Better Auth `docs-2fa.mdx` SHA-256 `cc09ba56f0b069460ff3cef435eb22ba104ebf977298b62997b955d57ac464ad` préservé. `.gitattributes` exempte uniquement son whitespace importé ; diff textuel visible et règles ordinaires inchangées pour les documents rédigés.
- CI documentaire requise sur la PR ; son résultat effectif et le SHA de fusion seront ceux de GitHub, non supposés ici.
- Synchroniser main local après fusion ; aucune suppression des worktrees, ressources ou preuves.

## Rollback

En cas de problème documentaire, PR de revert du commit livré ; aucun reset/force-push ni migration de données. Les décisions historiques et les preuves demeurent accessibles dans Git.

## États

Ce fichier prépare Ship. PR/CI/fusion seront attestées par GitHub ; pas de déclaration anticipée de fusion. Design System non démarré. Les preuves runtime et le gate Architecture restent distincts de cette livraison.

[Revue indépendante finale](evidence/ship-review.md) : PASS pré-Ship, aucun finding ouvert ; ajout de la configuration ciblée et bookkeeping de livraison relus. Les empreintes du reviewer sont des snapshots datés de leur périmètre, pas une affirmation que les copies du présent rapport en faisaient déjà partie. Contrôles documentaires locaux effectivement exécutés : présence des artefacts et syntaxe du script PASS ; comparaison historique et liens/ancres PASS ; diff check global PASS après exception unique de source brute.
