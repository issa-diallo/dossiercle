# Revue indépendante — pnpm natif, candidat 4

2026-10-11. Reviewer auth_tooling_temporal, distinct du builder infra_architecture ; lecture seule, aucun GET ni exécution parallèle.

**PASS limité à `phase-a.py pnpm-native-tool` dans le scope contrôlé 1 CPU / 2 GiB.** Aucun Critical/Major/Minor restant pour cette action. Le bin sera qualifié par son résultat futur ; ni lock/peers, ni application, ni gate phase A/B12/Architecture ne sont déjà PASS.

Gel `/tmp/dossiercle-b12-acquisition-manifest4.json`, empreinte déclarée `cef4e60721d411745bd0cd4b6a7e5a937929bbc17fcf4b513d2e7e1e104fa518` ; 13 fichiers conformes aux hashes.

## Constats

- pnpm wrapper 12.8.1 vérifié déclare le bin pnpm et optionalDependency @pnpm/exe.linux-x64 12.8.1. native-binary.mjs sélectionne le fichier pnpm Linux/x64/glibc. install.js sait effectuer des liens et npm rebuild ; il est source-lu et reste non exécuté. Le placeholder pnpm peut lancer bin/pnpm.mjs avec acquisition implicite : cette voie est exclue du launcher retenu.
- Le lancement antérieur bin/pnpm.cjs est un chemin supposé erroné, avec MODULE_NOT_FOUND archivé et exit 1 ; Node --version v24.21.0/exit0 est archivé. Ce défaut d'entrypoint ne démontre ni incompatibilité engine/peer ni arrêt Q4 de sécurité/quotas.
- Metadata native exacte reçue par helper mesuré : 1417 octets, SHA-256 c890c6b39456f1e645c9e91103c844d6db8a67181fd1a5166c3788926d1e601e, événement VERIFIED. Nom/version, URL tarball et SRI correspondent au script ; os linux, cpu x64, libc glibc, aucun scripts. Taille décompressée déclarée 59 761 264, pas de taille comprimée ou checksum primaire SHA256 inventé.
- GET autorisé uniquement https://registry.npmjs.org/@pnpm/exe.linux-x64/-/exe.linux-x64-12.8.1.tgz, même registre déjà autorisé, SRI sha512-8bDZ0lZlCdi2rvnFul7EYgcC7zKeWSe76y8JV2oXobaS8p9i9d6PSf6LgLtTM0fI7R9Oh4eLCbveXyNDMmvZ+g== contrôlé avant extraction bornée. Aucune nouvelle metadata retry ni redownload Node.
- Launcher appelle directement .poc-b12/tools/pnpm-native/package/pnpm --version après acquisition/extraction. Aucun wrapper ou lifecycle. Cgroup effectif vérifié, config/cache/store locaux, surveillance des enfants et guards inchangés.
- Baseline/début 08:53:36 / deadline 10:53:36 restent identiques. Corps 32 914 091 = Node 31 890 184 + wrapper 1 022 490 + metadata native 1 417 ; RX 51 528 025 ; historique + réserve + maximum = 153 830 293 et solde 1 846 169 707. Le futur solde dépend du RX courant, sans reset. Les événements et logs des deux défauts fonctionnels restent conservés.

Builder informé directement du PASS limité. Après cette qualification : prochain gel groupé des peers exacts/proxy/lock avant résolution ; aucun gros asset ou runtime applicatif autorisé par cette revue. Tout retour non nul/stop doit être tracé, propagé et rapporté sans retry automatique.
