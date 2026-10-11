# POC interrompu à la demande de l’utilisateur

2026-10-11T09:57:01Z. L’utilisateur a explicitement arrêté le POC et validé le choix de stack. Aucune reprise, acquisition ni phase B/C/D n’est lancée. Le choix humain ne constitue pas un PASS technique B12 ni fullMFA B07.

Preuves acquises : Node24.21.0/pnpm12.8.1 réellement exécutés ; lock résolu sous confinement ;530packages produit audités sources/SRI et35pins directs ; première installation frozen ignore-scripts réussie avec lock immuable. Deuxième installation offline interrompue par sortie du helper watchdog, cause non capturée ; correction préparée, non exécutée. PG3DB/migrations, builds, tests applicatifs, scanners, navigateur, OTel/Inngest et promotion/rollback restent non qualifiés.

Arrêt vérifié : scopes tâche inactifs, zéro container au labelB12, socket absent. Archives, worktree, preuves, images et assets préexistants conservés. Cumul conservateur 495538247octets sur2Go (réserve100Mo incluse), corps nouveaux 299758793octets. Baseline et départ08:53:36UTC préservés. État ledgerSTOPPED_BY_USER ; voir [preuve arrêt](evidence/user-stop.json).

La préparation produit suivante relève du parent ; aucune installation/app POC n’est déclarée prête à exploiter.

---

# Execute autorisé — D70

2026-10-11T08:53:36.594064+00:00. Research, Design, Plan et revue corrective indépendante PASS. **DoR Execute B12 : PASS**, autorisation utilisateur D70 consignée dans [distribution-approval](evidence/distribution-approval.md). Phase A démarrée ; aucun résultat technique PASS à ce stade. Les mentions préexécution suivantes sont conservées comme historique de préparation, et sont supersédées pour les seules approbations et readiness par ce paragraphe. Budget et arrêts Q4 inchangés.

# Goal — B12-P-1 bootstrap

2026-10-11. **GOAL: BLOCKED avant Execute** pour l’objectif Q4 complet. Objectif : satisfaire tous les critères de qualification, Verify et revue indépendante, dans D69. Préparation Research/Design et manifeste terminée, prête à revue DoR ; aucun critère runtime satisfait.

L’ancien blocker disque est levé : observation 76 564 443 136 octets disponibles (~71,3 Gio), quota temporaire 15 Gio maintenu. Les blockers actuels sont précis : revue DoR, approbation des nouveaux hosts navigateur/DB Trivy, conception sûre de l’isolation et du téléchargement. Provenance cache/résolution frozen/build/deps sont preuves de qualification du POC, pas exigence d’un POC déjà réussi. Aucune nouvelle autorisation de budget ou de POC général n’est nécessaire ; D69 persiste.

Le reviewer autorise le bootstrap B12 sans fullMFA B07 sous contrat coreauth/type/runtime/schéma et absence plugins stable. Toute remédiation B07 changeant version/schéma/frontière impose requalification B12. Aucun PASS auth B07 ou Architecture déduit.

Aucun outil/runtime installé ou lancé ; aucune donnée réelle, ressource cloud ou dépense. Métadonnées cumulatives imputées à B12 : 2 302 268 octets, solde 1 997 697 732 sur 2 Go avant acquisition future. Reprise selon [plan](plan.md), même budget et timebox, aucun reset ni suppression d’assets utilisateur.

### Ledger réseau retenu — BR01

Le cumul historique 2 302 268 octets est la somme mesurée des **corps HTTP seulement** ; TLS/IP/en-têtes/HEAD historiques ne sont pas mesurés rétroactivement. Réserver 100 000 000 octets dans le même budget de 2 000 000 000, pour transport/erreurs/inconnues ; aucune extension ni remise à zéro. Solde opérationnel initial au plus **1 897 697 732 octets**, inférieur au solde théorique des corps 1 997 697 732. Le sous-total des tailles de distributions ne constitue pas une mesure consommée.

Dès acquisition, conserver baseline et mesures de rx_bytes dans /sys/class/net des interfaces physiques actives, aujourd’hui wlp59s0 et interface physique Ethernet à surveiller si activation. Exclure lo, docker0, bridges et veth pour éviter double compte Docker. La somme des deltas inclut conservativement le trafic utilisateur sans l’inspecter ni le bloquer. Garder aussi compteur des corps/chunks HTTP, erreurs et retries reçus. Décompte conservateur futur = maximum(delta physique agrégé, nouveaux corps reçus) ; additionner une fois au cumul historique + réserve. Mesure interface ≠ mesure filaire exhaustive ; la réserve demeure. Si delta/compteur/tailles ou réserve atteignent le plafond : arrêt souverain avant nouveau chunk/download. Interface ajoutée/changement route/compteur remis à zéro ou indisponible : arrêter plutôt qu’omettre trafic. Baseline/ledger persistent entre phases, jamais reset ; transferts en cours restent interruptibles et margés par réserve.
