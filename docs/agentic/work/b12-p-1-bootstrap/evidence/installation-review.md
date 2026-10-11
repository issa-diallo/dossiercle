# Revue indépendante — installations frozen B12

2026-10-11. Reviewer auth_tooling_temporal, distinct du builder infra_architecture. Lecture seule ; aucun GET/installation/exécution parallèle.

**PASS limité à install-isolated.py : acquisition des archives exactes et deux installations frozen/ignore-scripts sous confinement revu.** Aucun Critical/Major/Minor nécessitant correction. Builder informé directement. Aucun build, app, serveur PG, navigateur, scanner ou PASS B12 couvert.

Gel `/tmp/dossiercle-b12-installation-manifest.json`, SHA-256 `9933f269ec7c974b6db7ca82aea0a4e26766becac874a5a99d1b82931291deac` ; 1 845 hashes conformes.

## Contrôles

- Allowlist = 530 paires URL/SRI identiques à l'audit validé, plus deux archives manager pnpm 12.8.1/native Linux déjà acquises à réutiliser. Aucune substitution/manquante ; 13 plateformes manager étrangères explicitement refusées. Lock SHA inchangé e13a6226b6b14e239c2fe6c66911f38f74a5c6cef3872e281cee48e788d8229b.
- download-server ne GET que ces archives exactes. Metadata uniquement cache déjà audité, aucune nouvelle requête metadata. Chaque archive/cache est rehashé SRI par chunks avant forwarding ; pas d'archive partielle acceptée. Réserve future 680 Mo prise dans le solde existant et contrôlée à chaque garde ; aucune garantie d'achever Q4 dans cette marge, prochains assets à vérifier contre solde réel.
- Guards temps/RX/disque/writer unique intacts. Docker network none/image cache exacte/pull never, UID 1000, root RO et task mounts seulement, client 1 CPU / 2 GiB + proxy 1 CPU / 2 GiB. Refus egress synthétique réel, version propre 12.8.1 et zéro HTTP requis avant install.
- Frozen/ignore-scripts/engine-peer strict/no auto peers ou manager/no retries ; store séparé/import copy. Install 1 garde lockSHA. Avant action, node_modules ne liste que index.db metadata de résolution, aucune dépendance matérialisée repérée. Seule fixture/node_modules est ensuite supprimée ; install 2 sans arbre modules, store réutilisé en --offline. Host marker refuse HTTP et client exige zéro HTTP + lockSHA inchangé. Deuxième installation propre ne signifie pas deux téléchargements indépendants.
- Logs/exit/inspect/argv à restituer ; cleanup uniquement CID créé + label/image vérifiés, aucun prune ou cache utilisateur. D69/D70, baseline/cumuls/deadlines initiaux restent inchangés. Worktree-environment décrit commandes setup/acquisition/install/stop et limites sans runtime produit.

## Limites

530 sources auditées ne signifie pas 530 binaires acquis/exécutés : les options étrangères peuvent être écartées par pnpm selon OS/CPU. Restituer matérialisation réelle, lock/SRI, compteurs, logs et scripts bloqués ; aucune activation lifecycle implicite si build demande ensuite génération. Tout conflit peer/engine, source imprévue, fuite ou plafond Q4 atteint impose arrêt intégral.

Succès des deux installs encore à démontrer. Les quatre transitifs dépréciés, licences/SBOM/vulnérabilités et matrice Q4 restent ouverts. Aucun auth B07 ni Architecture PASS induit.
