# Revue indépendante — audit offline lock B12

2026-10-11. Lecture seule ; aucune exécution du code audité, GET, proxy ou installation par le reviewer.

**PASS limité à charger resolve-isolated.py par importlib et appeler selected_audit() seulement.** Aucun main, launcher, container ni acquisition couvert. Builder informé directement. Aucun finding bloquant.

Gel `/tmp/dossiercle-b12-lock-audit-manifest.json`, SHA-256 `7d69fd22ac7a51fc310fad31fe915ce89646de12388e1b8de5e1592112bb3edd` ; 1 837 hashes conformes, incluant lock, sources raw/transforms et preuves des essais.

- Parser safe_load_all exige exactement deux mappings v9.0 : manager pnpm 12.8.1 exact et graphe produit autoInstallPeers false. Fusion seulement des packages identiques ; ambiguïté rejetée. Le lock n'est pas réécrit.
- Audit garde les contrôles hashes/provenance raw, transformation strictement transport dist.tarball, versions réellement choisies, URL npm, SRI lock = dist.integrity, sources des specs sélectionnées, root pins. Ni graphe ni specs historiques filtrés.
- Vérification indépendante du lock gelé : 35 bindings importer root, tous specifier et version de base correspondent exactement aux 35 pins du package.json. Manager 15 entrées, graphe produit 530 ; ce décompte n'est pas une analyse de vulnérabilités. Les snapshots peer multiples ne sont pas confondus avec des versions supplémentaires.
- Résolution réelle exit 0 et log conservé ne signalent pas de conflit peer/engine ; 4 transitifs dépréciés restent à qualifier. Cela ne constitue ni scan security ni validation runtime/type/build de la stack.
- L'appel offline peut produire selected-version-audit.json après succès ; il ne reçoit pas permission d'acquérir des archives. Root/lock/metadata restent gelés. Toute erreur d'audit doit être rapportée précisément, sans modifier le lock ou des sources pour obtenir PASS.

Étape suivante après preuve d'audit : gate séparé allowlist archives exactes + SRI + deux installations propres frozen/ignore-scripts sous confinement réel. Aucun PASS B12/Architecture ou auth B07 ne découle du lock.
