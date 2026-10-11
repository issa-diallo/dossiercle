# Revue corrective — acquisition B12, candidat2

Date : 2026-10-11. Reviewer auth_tooling_temporal, distinct du builder infra_architecture. Lecture seule, aucune acquisition/installation ni exécution de script.

## Verdict et portée

**PASS du gate limité aux outils Node24.21.0/pnpm12.8.1 et leur identification, via phase-a.py tools sous le scope systemd prévu.** A01–A04 corrigés dans cette portée ; aucun Critical ou Major restant pour ce gate. Baseline et phase A initiales restent inchangées.

**La résolution lock/proxy attend le prochain gel des peers exacts et des métadonnées de compatibilité.** Le package candidat ne contient pas encore rxjs/reflect-metadata. Ce n'est pas un conflit runtime avéré ; ne pas démarrer la résolution destinée à les qualifier avant le freeze promis. Les gros assets, installations applicatives et runtime Docker auront leurs gates séparés. Ce PASS ne ferme ni phaseA, ni B12, ni B07, ni Architecture.

Gel : `/tmp/dossiercle-b12-acquisition-manifest2.json`, empreinte déclaréefd1b13aee5000f5cf9bc880312604048355eb0c248bb44e32f3e4a6d8d523ad1. Les10 inputs/scripts correspondent aux hashes, y compris ledger initial, assets/HEAD, approval et manifests fixture.

## Corrections

- A01 : REDIRECTS associe l'URL initiale au chemin final exact HEAD ; plus de wildcard release-assets. Les requêtes restent HTTPS sans credentials/port alternatif, proxy environnement désactivé. Les requêtes Node/pnpm du premier gate n'acquièrent aucun gros asset.
- A02 : expansion déclarée prévalidée contre quota et espace libre, liens/chemins contrôlés, fichiers spéciaux/hardlinks refusés, copie par chunks avec guard avant/après et modes limités0777. Watchdog indépendant interrompt parsing/décompression/I/O bloqués. Le coût compressé et décompressé reste inclus dans le même quota ; pas d'extractall sans surveillance.
- A03 : flock non bloquant impose un writer interprocessus, STATE rechargé après lock ; status est lecture seule. RLock protège les mises à jour internes. Watchdog contrôle même proxy idle ; launcher surveille ledger/timebox et propage TERM puis KILL au groupe enfant sur stop. Aucun reset prévu entre actions.
- A04 : ledger/input initial, assets/HEAD et commandes outils sont gelés. Guard applique phase7200s et total28800s. Scope de lancement expliciteCPUQuota100%/MemoryMax2G, incluant helpers/enfants ; aucune fixture runtime concomitante. Env process local, HOME/cache fixture, pas Corepack réseau, pas navigateur download implicite.
- Node possède taille31890184 et checksum exact avant extraction. PNPM_SRI correspond au préflight officiel archivé ; identité/version/integrity metadata doivent rester identiques avant tarball/extraction. Seules commandes --version sont exécutées après vérification. Aucun lifecycle/application exécuté dans ce gate.
- Le futur launcher lock contient ignore-scripts, strict peers, engine-strict, auto-install-peers=false et fetch-retries=0 ; registre loopback, compteur unique. Les manifests/peers finaux restent à revoir avant son lancement, puis installations frozen et résultats feront l'objet de preuves séparées.

## Limites et arrêts

L'efficacité réelle du scope/guards, le contenu acquis et les versions exécutables seront prouvés par les résultats ; cette revue ne simule pas leur exécution. Tout retour non nul ou stop du superviseur doit être enregistré BLOCKED et signalé immédiatement ; pas de relance automatique. Les budgets2Go dont100Mo réservés, 4CPU/8GiB/15GiB et horloges initiales ne changent pas. Aucune violation Q4 réelle ni GET n'est déclaré dans le snapshot.
