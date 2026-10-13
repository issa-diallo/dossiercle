# DossierClé

DossierClé est un projet de plateforme SaaS destiné aux agences immobilières.

Son objectif est de centraliser et automatiser le traitement des demandes reçues par e-mail, notamment pour :

- les demandes liées aux biens immobiliers ;
- le suivi des sinistres ;
- l’orientation vers les artisans adaptés ;
- les réponses, relances et validations par l’agence.

## Principes du projet

- Plusieurs adresses e-mail peuvent être surveillées par agence.
- Chaque agence conserve un espace de données isolé.
- Les actions sensibles restent soumises à une validation humaine.
- L’infrastructure évolue automatiquement selon l’utilisation réelle.
- Le service est conçu pour fonctionner sans gestion manuelle des serveurs par les agences.

## Périmètre envisagé

### V1

- Connexion de plusieurs boîtes e-mail par agence ;
- gestion des contacts et des conversations ;
- workflows Biens et Sinistres ;
- annuaire des artisans par saisie manuelle ou import CSV ;
- proposition d’artisans selon la spécialité et la zone ;
- validation humaine avant affectation ou engagement.

### V2

- Invitation sécurisée permettant à un artisan de compléter sa fiche et ses justificatifs.

### Version ultérieure

- Compte artisan permanent avec tableau de bord et suivi des interventions.

## État du projet

Le socle local synthétique S01 couvre T00–T04 : services isolés, migrations,
journal d’autorité et authentification native avec MFA. La création et
l’activation d’agence (T05 et suivantes) restent à réaliser. S01 n’est pas DONE.

Voir [le suivi T04](docs/agentic/work/S01/t04-delivery-handoff.md) pour les gates
et [la préparation validée](docs/agentic/work/S01/plan.md) pour le périmètre.

### Exécution locale synthétique

Créer un worktree nommé `s01-espace-isole` sur `feat/s01-espace-isole`.
Depuis ce worktree :

```sh
bash scripts/worktree-setup.sh --synthetic
export PATH="$PWD/.local/node/bin:$PWD/.local/pnpm-native/package:$PATH"
pnpm build
node scripts/s01-control-migrate.mjs
pnpm test:unit
pnpm test:integration
pnpm test:auth
pnpm dev
```

Le setup vérifie les distributions et le lock, installe sans scripts de lifecycle,
génère des credentials propres en tmpfs et prépare les services et l’identité
native. Les ports loopback sont affichés au setup. Le navigateur utilise la CA
synthétique ; les tests Firefox la chargent dans un profil NSS privé.
`pnpm dev` démarre le coordinateur TLS et le frontend Vite minimal.
Les interfaces d’enrôlement et MFA sont celles de privacyIDEA/Keycloak maintenues.
Aucune invitation publique ou agence ACTIVE n’est créée par ces commandes.

`pnpm test:auth:upstream` est une expérience privée de concurrence fournisseur.
Elle échoue lorsque Keycloak accepte deux fois le secours ; ce résultat n’est
pas transformé en réussite native. La suite `test:auth` qualifie séparément
les protections publiques de l’application.

Les ressources, bases et versions de clés sont conservées.
`bash scripts/worktree-down.sh` arrête uniquement les services identifiés ;
aucun volume, worktree ou secret n’est supprimé automatiquement.

## Méthode de développement

Lire [AGENTS.md](AGENTS.md), puis [l’index de méthode](docs/agentic/README.md).
Le pipeline produit reste PRD → Stories → Story Review → Architecture → Design
System, puis Research → Design → Plan → Execute → Verify → Review → Ship.
Un ticket de maintenance cadré suit [EXISTING_PROJECT](docs/agentic/EXISTING_PROJECT.md).

Architecture fixe une direction courte, respecte les outils validés et affecte
les validations différées avec responsable et échéance. Les preuves viennent
en Execute/Verify ; une contradiction concrète ou un risque critique sans
mitigation reste bloquant. Les documents et décisions du projet sont conservés.

Les PR passent une revue indépendante, la CI et l’examen final Lead Tech avant
validation humaine. READY_FOR_HUMAN ne signifie pas DONE ni autorisation de fusion.
Vérification du socle : `bash scripts/agentic-check.sh` ; le contrôle de présence
ne démontre ni les gates ni le comportement d’un modèle.

Mises à jour selon [INSTALL](docs/agentic/INSTALL.md), par comparaison et sauvegarde.
Source de ce report : agentic-dev-system `fcdc55f`, [traçabilité #65](docs/agentic/work/65-update-agentic-method/migration.json).
