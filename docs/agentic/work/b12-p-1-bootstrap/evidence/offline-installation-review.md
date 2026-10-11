# Revue indépendante — arrêt installation B12

## Verdict

**REPRISE ANNULÉE SUR INSTRUCTION UTILISATEUR.** Ce rapport ne donne aucune autorisation d’exécution. La qualification B12 complète demeure non prouvée ; le choix humain de la stack est une décision distincte.

## Périmètre vérifié

Candidat 1852 fichiers, empreinte annoncée `18f141c2a300197c8acff9e9e7b02b968af8b7ef2940382cd0a15181a0eff7c7`. Vérification indépendante des 1852 hashes : aucun écart. Lecture seule des scripts, preuves installation, arrêt et ledger ; aucune installation, acquisition ou exécution du candidat par le reviewer. Le STOP utilisateur est arrivé pendant la revue ; aucun gate de reprise délivré au builder.

## Faits acquis et limites

- Le log conserve `Done in 5m 4s using pnpm v12.8.1`, puis `FROZEN_INSTALL_1_PASS LOCK_SHA256 e13a6226b6b14e239c2fe6c66911f38f74a5c6cef3872e281cee48e788d8229b`. Le client n’imprime ce marqueur qu’après succès de la commande et vérification du lock. Cela étaye le premier frozen install avec lifecycle désactivé, sans qualifier le runtime produit.
- La deuxième installation offline a commencé ; aucun marqueur de succès n’est conservé. Le superviseur est sorti 1 après disparition du proxy/watchdog. Le ledger historique demeure RUNNING sans stop_reason : cause non conservée. FileNotFoundError pendant suppression de node_modules est une hypothèse, pas une cause démontrée. Aucun arrêt Q4 pour engine, peer, source, egress ou quota n’est établi par cette preuve seule.
- La preuve `installation-stop.json` conserve le CID exact et un inspect après cleanup sorti 1 avec « No such object ». Cela étaye la suppression de ce conteneur, sans constituer un inventaire général actuel de toutes les ressources.
- Le lock et les sources candidates du gel restent identiques. La correction non exécutée ne modifie que le guard et ajoute trois scripts offline ; les archives et les 530 sources produit auditées ne changent pas.
- Le guard ignore uniquement FileNotFoundError sur stat d’une entrée disparue lors d’un inventaire, conserve les autres erreurs et les contrôles quotas/routes/compteurs. Le watchdog journalise désormais type/reason bornés, préserve les vrais motifs BLOCKED et sort après erreur. Ces propriétés sont une revue statique, sans preuve runtime du correctif.
- Le nouveau helper offline ne fait aucun appel fetch et refuse tout GET. Le client proposé supprime seulement `/work/fixture/node_modules`, conserve le store, demande frozen/offline/ignore-scripts/strict engine-peer et vérifie lock et zéro HTTP. Ces scripts restent **non exécutés**, reprise annulée.

## Dernier ledger lu, non compteur final du STOP utilisateur

Baseline et horloges initiales conservées : unix1791708816.596302, phase7200s, total28800s. Corps acquis299758793octets ; charge conservatrice485680993octets ; solde opérationnel1514319007octets ; disque tâche1243520623octets. Le builder doit figer le relevé final, les inventaires et le handoff après interruption utilisateur ; ces valeurs ne remplacent pas cette preuve finale.

## Handoff attendu

Documenter STOP utilisateur, absence de processus/conteneurs encore actifs et aucun nouveau GET/runtime depuis arrêt. Conserver premier succès et deuxième résultat non prouvé ; marquer correction offline non exécutée. D71 peut valider humainement le choix de stack sans inventer un PASS technique complet et sans maintenir les POCs interrompus comme prérequis imposé à la suite. L’exigence produit B07 de codes de secours hashés reste ouverte : préciser une disposition visible via extension supportée/ADR et implémentation qualifiée, sans adopter le mécanisme natif chiffré ni relâcher silencieusement l’exigence.
