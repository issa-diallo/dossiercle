# Revue indépendante — reprise ciblée pnpm-tool

2026-10-11. Reviewer auth_tooling_temporal, distinct du writer infra_architecture. Lecture seule ; aucun GET/installation/exécution par ce reviewer.

**PASS uniquement pour `phase-a.py pnpm-tool` dans le scope systemd 1 CPU / 2 GiB prévu, conformément à la décision root.** Aucun Critical/Major/Minor restant dans cette portée. Pas de gate lock/peers, gros assets ou runtime applicatif. Aucun PASS tools/phase A/B12/B07/Architecture anticipé.

Gel `/tmp/dossiercle-b12-acquisition-manifest3.json`, empreinte déclarée 20ae86de24a8e9b67bc8f0d7385cb6b4972148527dd612853092730e537e9c80. Les 9 fichiers correspondent au manifeste.

- pnpm-tool acquiert uniquement https://registry.npmjs.org/pnpm/-/pnpm-12.8.1.tgz depuis le record préflight officiel 200 archivé. Identité 12.8.1, URL et SRI SHA512 exacts sont contrôlés avant extraction. Le record correspond au préflight indépendant antérieur. Aucune requête metadata ni redownload Node dans cette action.
- Logging des HTTPError futurs conserve code et reason bornée 160 caractères avant fail-closed ; le code passé reste inconnu, sans correction rétroactive inventée.
- Launcher contrôle cpu.max et memory.max effectifs avant travail, refuse absence/limite supérieure à 1 CPU / 2 GiB. Configuration/cache/store task local et env limitée ; pas de HOME utilisateur réassigné. Version Node et pnpm seulement après acquisition/validation, aucun lifecycle/application.
- execute-ledger-tools-stop.json est identique au gel d'arrêt précédent. Événements Node VERIFIED et HTTPError ERROR restent inchangés ; transition ciblée root tracée, functional_stops conserve motif/autorité. Aucun reset historique/réserve/new_body/baseline/début de phase ou total. RX recalculé 47 832 993 ; consommation 150 135 261 et solde 1 849 864 739 cohérents, à surveiller continûment pendant reprise.
- Extraction bornée/guard/watchdog, writer ledger unique et compteur conservateur restent en place. Logs nouveaux pnpm-archive-acquisition évitent écrasement des logs arrêt. Le runtime Docker garde un gate distinct.

Builder informé directement du PASS limité. Toute erreur/arrêt sera propagé, enregistré et revu ; aucun retry automatique ni modification de budget, versions, hosts ou critères Q4 autorisé par ce verdict. Deadline phase A 10:53:36 UTC et baseline initiale conservées.
