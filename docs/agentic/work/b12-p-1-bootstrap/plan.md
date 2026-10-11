# Execute autorisé — D70

2026-10-11T08:53:36.594064+00:00. Research, Design, Plan et revue corrective indépendante PASS. **DoR Execute B12 : PASS**, autorisation utilisateur D70 consignée dans [distribution-approval](evidence/distribution-approval.md). Phase A démarrée ; aucun résultat technique PASS à ce stade. Les mentions préexécution suivantes sont conservées comme historique de préparation, et sont supersédées pour les seules approbations et readiness par ce paragraphe. Budget et arrêts Q4 inchangés.

# Plan — B12-P-1 préparation

2026-10-11. **PLAN: PASS de conception documentaire sous revue indépendante. DoR Execute: BLOCKED** par approbation des nouveaux hosts navigateur/DB et revue sécurité du manifeste. [Research](research.md)/[Design](design.md) préparés ; aucun package, code fixture ou runtime créé.

## Séquence préexécution

1. Reviewer relit Research/Design/manifeste contre Q4 complet et D69. Décision reviewer reçue : bootstrap stable/claims étroits permet B12 sans fullMFA B07 ; incompatibilité/critique partagée empêche B12. Aucun workaround auth maison ni changement stack.
2. Confirmer SHA256/provenance PG17.11 cache, cache navigateur revision1243 ; image utilisateur conservée. Vérifier DB Trivy digest/taille proposés et freshness postextraction, figer les règles d’acquisition pour peers exacts/lifecycle. La résolution frozen, les builds et les deps runtime sont preuves objectifs de phase A/B, pas conditions exigeant un POC déjà terminé.
3. Présenter URLs initiales/finales exactes et digests au parent. D69/budgets déjà approuvés ; seul flux distribs non présenté nécessite décision spécifique. Les objets GitHub exacts/redirections officielles sont couverts par revue du manifeste ; les nouveaux hosts navigateur et DB requièrent décision concrète.
4. Refaire préflight place/ports/quota/provenance immédiatement avant acquisition. Journal de compteurs cumulatif B12 ; solde théorique des corps actuel 1 997 697 732 octets avant nouvelles métadonnées. Timebox chaque phase2h, cumul8h ; pas reset entre phases. Démarrage seulement Research/Design/Plan PASS, reviewer sans Critical/Major et manifest approved.

## Exécution future — quatre phases, non commencées

A ≤2h : acquisition bornée autorisée, checksums avant extraction, Node/pnpm isolés, monorepo minimal, unique lock, deux installs frozen ignore-scripts ; lifecycle allowlist strict si nécessaire. Trois DB isolées/migrations et auth minimal adapté au contrat B07. Enregistrer engines/peers/versions/commandes. Zéro conflit pour passer A ; A PASS n’est pas B12 PASS.

B ≤2h : TS/Nest/React/Vite/frontières, OpenAPI généré deux fois/canonical hashes, rupture et addition oasdiff, client regen, Vitest/intégration PG/Playwright/k6 sur service API B12 interne. Pas de flow métier ni test production.

C ≤2h : SDK Inngest local fail-closed ; OTel singleton/Collector exact/canaris ; Syft SBOM source/binaires/image, licences et scans Gitleaks/Trivy cache DB qualifié. Critical/High/inconnue licence/plage Prometheus bloquants selon Q4. Scan ne remplace pas sûreté auth B07.

D ≤2h : deux builds propres/digests et métadonnées expliquées, source maps privées, simulation QA→prod mêmes digests et rollback sans rebuild, compatibilité PG/contrats N-1, smoke. Inventaire/nettoyage ciblé puis Verify/revue indépendante. Aucun push/commit/PR/CI cloud ; preuves futures non revendiquées.

## Arrêts et restitution

Arrêt immédiat sur peer/engine conflict, Critical/High sans dérogation, plugin interdit, fuite canari/inter-agence, réseau imprévu, lifecycle non approuvé, migration croisée, non déterminisme inexpliqué, plafond temps/réseau/CPU/RAM/disque ou dépense. Stop processus créés, fermer ports, nettoyer uniquement ressources fixture identifiées ; jamais prune/rmi/images préexistantes/cache utilisateur ou worktree d’un autre agent. Rapport BLOCKED avec compteur/horodatage/résultat, aucun recommencement automatique. Continuer point indépendant seulement échec fonctionnel sans critère d’arrêt, dans scope/budget déjà approuvés. Toute reprise après arrêt nécessite correction et décision appropriée.

Verify future : outputs bruts expurgés, lock/package/manifest hashes, exit codes, SBOM/advisory DB version/date/digest, PNG navigateur si utile, quotas/time phases, inventaire avant/après et absence données réelles. Reviewer indépendant tranche PASS/BLOCKED ; aucune auto-approval. Handoff conserve architecture BLOCKED et claims B12 étroits.

## Précondition isolation réelle

Avant Execute, valider conception de l’isolation et limites agrégées4CPU/8Gio. Qualifier bases/libs au cours des étapes POC avec arrêt sur incompatibilité. Unshare non autorisé selon parent : Docker internal/none pour API/runner/navigateur/Collector/scans, ports127.0.0.1, aucun runtime host non isolé. Contrôler réseau et refus egress sans fournisseur réel. Node/API dans image PGbookworm avec override/nonroot/mountreadonly ; Chromium/libs restent inconnus explicites, aucun apt acquis. Acquisition autorisée et runtime hermétique séparés ; assets préexistants préservés.

Décision dépendance reviewer reçue : B12 peut être préparé/exécuté sous coreauth/type/runtime/schéma/absence plugins stables, sans PASS global B07 ; fullMFA/codes/récupération hors claim B12. Toute remédiation B07 changeant version/schéma/frontière déclenche nouvelle qualification B12. La simple absence PASS B07 n’est plus blocker. Distributions Node/npm/GitHub exactes déjà couvertes initialement : revue provenance/redirects, pas consentement par objet. Restent décision URI navigateur/DB, revue sécurité isolation et review DoR ; compatibilité base/runtime à prouver dans POC.

### Ledger réseau retenu — BR01

Le cumul historique 2 302 268 octets est la somme mesurée des **corps HTTP seulement** ; TLS/IP/en-têtes/HEAD historiques ne sont pas mesurés rétroactivement. Réserver 100 000 000 octets dans le même budget de 2 000 000 000, pour transport/erreurs/inconnues ; aucune extension ni remise à zéro. Solde opérationnel initial au plus **1 897 697 732 octets**, inférieur au solde théorique des corps 1 997 697 732. Le sous-total des tailles de distributions ne constitue pas une mesure consommée.

Dès acquisition, conserver baseline et mesures de rx_bytes dans /sys/class/net des interfaces physiques actives, aujourd’hui wlp59s0 et interface physique Ethernet à surveiller si activation. Exclure lo, docker0, bridges et veth pour éviter double compte Docker. La somme des deltas inclut conservativement le trafic utilisateur sans l’inspecter ni le bloquer. Garder aussi compteur des corps/chunks HTTP, erreurs et retries reçus. Décompte conservateur futur = maximum(delta physique agrégé, nouveaux corps reçus) ; additionner une fois au cumul historique + réserve. Mesure interface ≠ mesure filaire exhaustive ; la réserve demeure. Si delta/compteur/tailles ou réserve atteignent le plafond : arrêt souverain avant nouveau chunk/download. Interface ajoutée/changement route/compteur remis à zéro ou indisponible : arrêter plutôt qu’omettre trafic. Baseline/ledger persistent entre phases, jamais reset ; transferts en cours restent interruptibles et margés par réserve.

### Cible k6 retenue — BR02

Runner et API sont deux containers distincts sur le réseau Docker internal créé pour B12. k6 cible uniquement http://b12-api:3000 par DNS de ce réseau ; ce n’est pas le 127.0.0.1 du runner. API bind interne 0.0.0.0:3000, publication éventuelle hôte uniquement127.0.0.1:3000. Aucun host-gateway, host networking, privileged ou fournisseur Internet. DNS/proxy hôte ne devient pas allowlist runtime. Smoke synthétique local Q4 conservé, mêmes cgroups agrégés.
