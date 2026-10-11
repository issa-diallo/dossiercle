# Revue ciblée — résolution candidat 2

2026-10-11. Lecture seule ; aucun GET/exécution reviewer.

**PASS limité au même gate lock**, sous conditions du rapport résolution1 et mandat root inchangé.

Gel `/tmp/dossiercle-b12-resolution-manifest2.json`, empreinte 8f7f6de26ce1828f548bacbe496cae29ae129c38f72304a9aa2482e2f757c51a ; 27 hashes conformes. Sources/peers/acquire.py/manifests candidats inchangés. Deux clés YAML non reconnues supprimées ; .npmrc/CLI manage-package-manager-versions=false et pin 12.8.1 conservés. Le warning réel de l'essai 1 reste archivé, sans le renommer en conflit engine/peer.

run() réserve un nouveau log par suffixe de tentative et retour assorti ; l'assertion version lit le log retourné courant. Aucun écrasement des preuves. L'exigence sortie 12.8.1 seule et zéro événements HTTP avant lock reste active. Ignore-scripts, engine/peer strict, no auto peers et limites cgroup persistent.

Baseline et débuts phase/total restent identiques ; compteur cumulatif augmente, pas de reset. Ni installation workspace, ni gros asset/runtime, ni PASS B12 autorisé. Builder informé directement du PASS ciblé.
