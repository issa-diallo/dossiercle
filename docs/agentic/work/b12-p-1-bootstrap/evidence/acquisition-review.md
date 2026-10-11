# Revue indépendante — scripts acquisition B12

Date : 2026-10-11. Reviewer auth_tooling_temporal, distinct du builder infra_architecture. Lecture seule ; aucun GET runtime, installation ou exécution du script. Snapshot `/tmp/dossiercle-b12-acquisition-manifest.json`, empreinte déclarée401016e1bf34276064a85451c53380cf4f807806627c24a420f9e786bce372d7 ; les8 hashes correspondent.

## Verdict

**BLOCKED avant acquisition : 0 Critical, 3 Major, 1 Minor.** Il s'agit de défauts du dispositif détectés avant utilisation, pas de la preuve d'un stop Q4 effectivement rencontré pendant un essai. Aucun download/runtime commencé d'après les preuves présentes. Ne pas effectuer le premier GET avant correction et nouvelle revue.

## Findings

### A01 — Major : redirection vers tout objet GitHub autorisée

`.poc-b12/scripts/acquire.py:71` accepte toute URL release-assets.githubusercontent.com dont le chemin commence par /github-production-release-asset/. D70 approuve les objets exacts et leurs chemins observés, pas toutes les releases de ce host. Une redirection vers un autre objet passe le contrôle avant lecture du corps. L'intégrité finale limite l'acceptation d'un binaire, mais ne répare pas une acquisition hors allowlist.

Correction : associer chaque URL initiale à son chemin final exact autorisé ; valider scheme/host/path avant nouvelle requête, en tolérant seulement les paramètres de signature éphémères attendus. Toute autre cible => STOP avant corps. Le gate Node/pnpm n'a pas besoin d'autoriser les gros assets anticipativement.

### A02 — Major : extraction sans garde de durée ou disque

`acquire.py:130–142` vérifie les chemins et utilise filter=data, mais extractall ne vérifie ni guard, ni expansion cumulée, ni durée. La limite disque n'est mesurée que lors du fetch/guard ; une extraction peut donc franchir15GiB ou la timebox entre deux appels, notamment avec des fichiers volumineux compressés.

Correction : prévalider taille totale/membres et capacité résiduelle, puis extraire avec garde pendant les copies par chunks et entre membres. Refuser fichiers spéciaux/chemins ou liens sortants, éviter modes/setuid et vérifier les chemins au moment de l'écriture. Inclure downloads + fichiers décompressés dans le même quota. Le coût des étapes de parsing/décompression doit être interrompable ou surveillé par watchdog indépendant du thread de travail. Préserver l'horloge initiale de phase : pas de reset dû à la revue.

### A03 — Major : état du ledger concurrent et absence de surveillance du proxy

`acquire.py:9` charge STATE une fois ; save remplace atomiquement le fichier sans verrou ni relecture. Le mode proxy conserve cette copie en mémoire. L'action status, ou une autre acquisition, peut réécrire un état périmé pendant que proxy reçoit des corps : new_body_bytes/events peuvent régresser et deux actions peuvent se concurrencer sur execute-ledger.tmp. Aucun contrat interdisant ce cas n'est appliqué. De plus serve_forever sans watchdog ne ferme pas le proxy au terme de phase en l'absence d'une requête ; le guard ne s'exécute qu'au prochain fetch.

Correction : imposer un writer ledger unique par verrou interprocessus ; status doit être lecture seule ou passer par ce writer, sans save d'un snapshot périmé. Un superviseur doit surveiller temps/compteurs/routes/disque et interrompre le proxy et ses opérations dépendantes sur arrêt. La séquence acquisition Node/pnpm puis proxy/résolution doit être explicite et empêcher les actions simultanées. Conserver baseline/cumul et journal ; pas de remise à zéro lors d'une relance.

### A04 — Minor : ledger et commandes de résolution hors snapshot

Le script dépend de execute-ledger.json et distribution-assets.json, absents du manifeste acquisition. Le ledger observé contient phase_started, phase_seconds7200, total_seconds28800, baseline/routes, budget2Go, réserve100Mo, historique2302268, mais n'est pas couvert par le gel. Le calcul total_seconds n'est pas appliqué dans guard, ce qui est sans conséquence immédiate en phase A mais doit être assuré pour les phases suivantes. Aucun launcher de pnpm lockfile-only/ignore-scripts/engine-strict ni bornes cgroup acquisition n'est fourni dans ce snapshot.

Correction : inclure les inputs immuables du gate et la commande/launcher exact de qualification Node/pnpm/peers dans le prochain gel ; enregistrer le ledger initial/hash puis ses mutations comme preuve. Pour le premier gate limiter la portée Node/pnpm/acquisition à ce qui est réellement revu. Les guards de durée totale et quotas agrégés seront exigés pour tout launcher concerné ; le futur runtime Docker aura son propre gel avant exécution.

## Points acquis et portée

Le compteur utilise historique + réserve + max(deltaRX physique,nouveaux corps), avec interfaces physiques et routes contrôlées, aucun proxy environnement implicite. Node exact possède taille/SHA avant extraction, pnpm identité exacte et SRI SHA512 sont vérifiés. Proxy loopback seulement, tarball hors npm refusé, JSON réécrit vers le proxy, pas de POST audit. Le script n'exécute aucun lifecycle/application. La lecture des sources reste distincte d'une preuve de Node/pnpm/peers qualifiés ; privilégier ces petits éléments avant gros assets.

Les pointeurs canonique ont aussi été relus : Architecture intro D69/D70 indique disque levé et phase A sans PASS technique ; ADR003 addendum R-B07-01 conserve exigence/stack et distingue contrat natif de qualification. Ces deux ajouts sont cohérents et n'appellent pas de correction.

Après correction : nouveau snapshot et revue du gate limité. Tous arrêts Q4/budgets/authorisations D69/D70 restent applicables ; aucune nouvelle permission générale ni dépense demandée par cette revue.
