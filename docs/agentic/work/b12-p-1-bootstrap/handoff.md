# POC interrompu à la demande de l’utilisateur

2026-10-11T09:57:01Z. L’utilisateur a explicitement arrêté le POC et validé le choix de stack. Aucune reprise, acquisition ni phase B/C/D n’est lancée. Le choix humain ne constitue pas un PASS technique B12 ni fullMFA B07.

Preuves acquises : Node24.21.0/pnpm12.8.1 réellement exécutés ; lock résolu sous confinement ;530packages produit audités sources/SRI et35pins directs ; première installation frozen ignore-scripts réussie avec lock immuable. Deuxième installation offline interrompue par sortie du helper watchdog, cause non capturée ; correction préparée, non exécutée. PG3DB/migrations, builds, tests applicatifs, scanners, navigateur, OTel/Inngest et promotion/rollback restent non qualifiés.

Arrêt vérifié : scopes tâche inactifs, zéro container au labelB12, socket absent. Archives, worktree, preuves, images et assets préexistants conservés. Cumul conservateur 495538247octets sur2Go (réserve100Mo incluse), corps nouveaux 299758793octets. Baseline et départ08:53:36UTC préservés. État ledgerSTOPPED_BY_USER ; voir [preuve arrêt](evidence/user-stop.json).

La préparation produit suivante relève du parent ; aucune installation/app POC n’est déclarée prête à exploiter.

---

# Execute autorisé — D70

2026-10-11T08:53:36.594064+00:00. Research, Design, Plan et revue corrective indépendante PASS. **DoR Execute B12 : PASS**, autorisation utilisateur D70 consignée dans [distribution-approval](evidence/distribution-approval.md). Phase A démarrée ; aucun résultat technique PASS à ce stade. Les mentions préexécution suivantes sont conservées comme historique de préparation, et sont supersédées pour les seules approbations et readiness par ce paragraphe. Budget et arrêts Q4 inchangés.

# Handoff — préparation B12-P-1

2026-10-11. Préparation terminée dans worktree exclusif B12, writer unique. [Research](research.md) et [Design](design.md) PASS documentaires proposés sous revue ; [Plan](plan.md) PASS conception proposé sous revue ; **DoR Execute BLOCKED** aux URI manquantes et revue. [Manifeste de distributions](distribution-manifest.md) et preuves metadata/HEAD disponibles. Ancien blocker disque levé (~71,3 Gio libres), quota15Gio inchangé.

Aucun runtime téléchargé, installé ou lancé, aucun code fixture créé, aucun commit/PR ; aucune modification autre worktree. Recherche primaire1 734 068 octets <5Mo imputés à B12 ; avec568200 historique, solde théorique des corps B12 1 997 697 732 octets. Six archives officielles exactes+digests/taille, source Playwright et SHASUMS Node vérifiés documentairement ; pas vérification de contenus binaires.

Readiness : prêt pour revue indépendante de la préparation et demande concrète d’approbation des URLs de distribution manquantes. Ne pas redemander D69/budget déjà validés. PG17.11/cache navigateur1243 à provenance/scan à qualifier en POC ; DB digest/taille proposés et résolution transitive cible de phase A. Reviewer a conclu que B12 bootstrap peut avancer sans fullMFA B07 ; contrat partagé stable/claims étroits et absence critique incompatible requis, requalification si B07 change version/schéma/frontière.

Tous assets utilisateur préexistants préservés, notamment factory-backend-db-1, images/caches/outils globaux. Reprise : revue → manifeste approuvé → préflight → Plan PASS → Execute borné → Verify → Review. Architecture/B09/B07 restent leurs gates distincts.

### Ledger réseau retenu — BR01

Le cumul historique 2 302 268 octets est la somme mesurée des **corps HTTP seulement** ; TLS/IP/en-têtes/HEAD historiques ne sont pas mesurés rétroactivement. Réserver 100 000 000 octets dans le même budget de 2 000 000 000, pour transport/erreurs/inconnues ; aucune extension ni remise à zéro. Solde opérationnel initial au plus **1 897 697 732 octets**, inférieur au solde théorique des corps 1 997 697 732. Le sous-total des tailles de distributions ne constitue pas une mesure consommée.

Dès acquisition, conserver baseline et mesures de rx_bytes dans /sys/class/net des interfaces physiques actives, aujourd’hui wlp59s0 et interface physique Ethernet à surveiller si activation. Exclure lo, docker0, bridges et veth pour éviter double compte Docker. La somme des deltas inclut conservativement le trafic utilisateur sans l’inspecter ni le bloquer. Garder aussi compteur des corps/chunks HTTP, erreurs et retries reçus. Décompte conservateur futur = maximum(delta physique agrégé, nouveaux corps reçus) ; additionner une fois au cumul historique + réserve. Mesure interface ≠ mesure filaire exhaustive ; la réserve demeure. Si delta/compteur/tailles ou réserve atteignent le plafond : arrêt souverain avant nouveau chunk/download. Interface ajoutée/changement route/compteur remis à zéro ou indisponible : arrêter plutôt qu’omettre trafic. Baseline/ledger persistent entre phases, jamais reset ; transferts en cours restent interruptibles et margés par réserve.
