# Revue indépendante — arrêt acquisition tools B12

Date : 2026-10-11. Reviewer auth_tooling_temporal, distinct du builder infra_architecture. Lecture seule des preuves et de l'archive locale ; aucun GET, retry, installation ou exécution de Node/pnpm.

## Verdict

**PASS de fidélité des preuves d'arrêt ; gate tools et phase A restent BLOCKED fonctionnellement.** Aucun critère d'arrêt Q4 n'est établi par le HTTPError archivé. Aucun conflit engine/peer, egress imprévu, fuite, vulnérabilité ou dépassement quota ne peut être déduit de cette exception seule. Le helper a choisi fail-closed et interrompu la séquence ; il faut une décision de reprise ciblée après correction/revue, sans permission générale supplémentaire déduite de l'erreur.

Gel `/tmp/dossiercle-b12-tools-stop-manifest.json`, empreinte déclarée 388df70bd5594099d68c1593f6636f10010ac8a008a0fe976049af490cddeaf8. Les 13 fichiers correspondent tous aux SHA-256. Aucun finding documentaire Critical/Major/Minor nécessitant correction du dossier d'arrêt.

## Faits et limites

- Archive Node locale relue indépendamment : 31 890 184 octets, SHA-256 fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6, identiques au checksum officiel approuvé. Ledger événement VERIFIED et node-acquisition.exit=0 corroborent réception/vérification/extraction. Cela ne prouve pas encore une version exécutable, build ou compatibilité ; Node --version n'a pas été atteint.
- Événement suivant : registry.npmjs.org/pnpm/12.8.1, type HTTPError, compteur de corps 0. Aucun code HTTP/raison/headers n'a été conservé, pnpm-acquisition.log est vide. Ne pas dire 404, indisponibilité de version, refus rate limit ou erreur de Content Negotiation prouvée. Accept vnd.npm.install-v1+json n'est qu'une hypothèse de diagnostic.
- Ledger BLOCKED avec raison Acquisition failed:HTTPError ; aucune archive pnpm, installation workspace ou runtime applicatif revendiqué. Le fail-closed est conforme au choix du dispositif. Le retour parent 1 et l'auto-collect du scope sont rapportés dans Verify ; un fichier de retour parent autonome n'est pas présent dans le gel. Le retour Node 0 est directement archivé.
- Calcul confirmé : historique 2 302 268 + réserve 100 000 000 + max(RX 42 738 870, corps 31 890 184) = 145 041 138 ; solde 1 854 958 862. Mesure disque 233 270 486 sous 15 GiB. Aucun dépassement réseau/disque enregistré ; l'événement erreur survient environ 7 min 35 s après début de phase, sous 2 h. Le trafic tiers continue ensuite à consommer le budget sous baseline inchangée : le solde au stop n'est pas un solde disponible garanti à une reprise future.
- Le cgroup archivé pendant exécution décrit CPUQuota 1 s, cpu.max 100000/100000 et MemoryMax/memory.max 2147483648 : plafond 1 CPU / 2 GiB documenté. Il ne revendique pas un cgroup survivant après auto-collect ni des mesures de pic CPU/RAM.
- Inventaires avant/après et comparaison normalisée listent 2 containers, 14 images, 4 networks, 66 volumes inchangés sur les champs inspectés. Cela borne la preuve à ces identités/configurations ; ce n'est pas une preuve du contenu des données d'applications tierces. Aucun asset utilisateur nettoyé ni ressource Docker POC créée n'est revendiqué.

## Suite ciblée possible sous D69/D70

Le parent peut décider d'une reprise appropriée dans le mandat existant après correction du dispositif et revue d'un nouveau gel. Aucun retry automatique ni nouveau GET de diagnostic n'est requis par cette revue.

1. Corriger le logging HTTPError avant le watchdog : conserver code/raison normalisée, URL finale sans query sensible, type erreur et horodatage ; headers uniquement allowlist non sensibles, aucun token/cookie. Si un corps d'erreur est lu, le borner et l'imputer aux compteurs, sans supposer rétroactivement un corps déjà reçu.
2. Pour pnpm, réutiliser la métadonnée officielle exacte 200 déjà acquise dans `/tmp/dossiercle-poc-version-preflight.json` : pnpm 12.8.1, tarball https://registry.npmjs.org/pnpm/-/pnpm-12.8.1.tgz et SRI sha512-9kupB1B/XOr+BsjTjmBS0BeURFgOwSed3Vv8EctIqoomRLZlmOB+dh2oSHKp/FfV+QK4f6SdAkGY1VhhKqu+RQ==. Cette métadonnée est une source exacte existante, pas une nouvelle version ni latest. Le GET tarball déjà autorisé doit vérifier cet SRI avant extraction ; ne pas prétendre avoir résolu la cause du premier HTTPError.
3. Réutiliser l'archive Node vérifiée et les fichiers extraits plutôt que la télécharger à nouveau ; recontrôler leurs hashes/chemins avant la version executable. Garder les preuves d'arrêt sans les écraser, nouveaux logs/événements distincts.
4. Conserver phase_a_started et b12_started à 08:53:36 UTC, deadline phase A 10:53:36 UTC, baseline initiale, cumul historique, réserve et budget. Recalculer RX courant/solde/durée/place au préflight ; l'activation RUNNING doit être une transition ciblée tracée par décision parent, sans effacement des événements BLOCKED ni remise à zéro. Si une vraie limite ou autre critère Q4 est alors atteint, arrêter intégralement.
5. Faire revoir la nouvelle commande/launcher minimal pnpm + versions avant exécution. Les peers/manifest final restent à geler avant résolution lock ; aucune installation applicative ou gros asset ne découle de cette reprise limitée.

La reprise proposée traite l'échec fonctionnel et la lacune de diagnostic. Elle ne dispense d'aucun gate Q4, n'étend ni budget ni hosts, et ne qualifie pas B12/B07/Architecture.
