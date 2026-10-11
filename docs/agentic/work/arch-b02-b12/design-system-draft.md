# DossierClé — préparation du Design System

2026-10-11. **DRAFT, préparation anticipée ; aucun gate Design System PASS.**

## Périmètre et pipeline

D71 adopte la stack et arrête les POC. Pour avancer, ce brouillon prépare les choix visuels indépendants des fournisseurs pendant la finalisation d'Architecture. Justification de cette préparation anticipée : navigation, lisibilité et composants n'exigent ni déploiement, ni données réelles, ni résolution des codes de secours. Ce document ne démarre pas Execute et ne ferme aucun bloc sécurité ou exploitation. Le pipeline officiel reste Architecture PASS → Design System → Research/Design/Plan des stories. Le document produit DESIGN_SYSTEM reste inchangé jusqu'à cette gate.

Les 37 stories et leur DAG sont conservés. Aucun nouveau périmètre métier, portail client, bail, classement de candidats ou pouvoir d'autonomie n'est ajouté.

## Direction visuelle proposée

Un poste de travail sobre pour agences immobilières : dossiers lisibles, responsables identifiables et décisions humaines visibles. Palette papier et vert profond, accent cuivre ; priorité à la liste de travail, au fil des échanges et à la prochaine action. Les tableaux de bord présentent les informations autorisées utiles, sans métriques décoratives.

### Tokens proposés

| Token | Valeur | Usage |
|---|---|---|
| `canvas` | `#F5F3EE` | Fond de l'espace de travail |
| `surface` | `#FFFFFF` | Formulaires et listes |
| `text` | `#172C28` | Texte principal |
| `muted` | `#52635D` | Métadonnées |
| `primary` | `#225846` | Action principale et navigation active |
| `accent` | `#95502B` | Repères ponctuels, sans signification de droit |
| `border` | `#CDD5CF` | Séparations |
| `danger` | `#A22F36` | Erreur ou action destructive avec libellé |
| `warning` | `#7B5909` | Attention, accompagnée d'un texte |

Échelle d'espacement : 4/8/12/16/24/32/48 px. Rayons : 6 px contrôles, 10 px panneaux. Ombre réservée aux éléments superposés ; séparations discrètes pour les données.

Typographie proposée : Source Sans 3 pour les informations et les contrôles, Source Serif 4 pour les titres de dossiers et la marque. Polices auto-hébergées seulement après qualification licence/source ; aucun téléchargement dans cette préparation. Repli sans-serif/serif local. Corps 16 px, métadonnées 14 px minimum, nombres tabulaires dans les tableaux.

Les contrastes AA et les tailles réellement rendues devront être mesurés dans Verify ; ils ne sont pas déclarés vérifiés par ce brouillon.

## Structure des écrans

- Barre latérale desktop de 240 px, contexte agence et identité clairement affichés.
- Navigation proposée : travail à traiter, conversations, dossiers, artisans, catalogue de biens, rapports ; administration et journal selon les droits et modules existants.
- Conserver les interdictions R01 : aucune navigation supplémentaire ne confère de droit. UI et API filtrent selon leur responsabilité ; le serveur reste l'autorité.
- Liste de travail : objet, statut, responsable, prochaine action et date utile. Pas de note ou score de candidat locataire.
- Dossier : en-tête compact, contenu principal et panneau d'informations ; traces de provenance descriptives sans nouveau lien vers un original privé.
- Rapport : période couverte et destinataire visibles ; règles horaires/binding acquises inchangées.
- Mobile : navigation repliée, une colonne, tableaux adaptés en listes ; états et actions essentielles restent accessibles.

Largeur de travail cible 1440 px, formulaires 640 px ; liste/fil peuvent utiliser toute la largeur disponible. Les seuils responsive restent à affiner par vérification des parcours.

## Composants à spécifier

| Groupe | Composants | États indispensables |
|---|---|---|
| Actions | Button, IconButton, menu d'actions | repos, hover, focus, disabled, pending ; nom accessible |
| Saisie | Input, Select, Checkbox, Textarea, FormField | label, aide, erreur, disabled ; validation côté serveur |
| Données | Table/List, pagination, filtres, Badge, dossier/fil | vide, chargement, erreur, données partielles ; statut textuel |
| Superposition | Modal, Drawer, confirmation | focus maîtrisé, fermeture clavier, action dangereuse explicite |
| Retours | Alert, Toast, Skeleton | erreur persistante si action requise, succès annoncé, retry seulement autorisé |
| Contexte | AgencyContext, attribution, provenance, audit | droit limité, session expirée, action devenue invalide |

Un bouton désactivé explique la raison utile à l'utilisateur. Une opération encore en cours n'est pas présentée comme réussie. Une erreur conserve les informations saisies lorsque les règles de données l'autorisent ; aucun stockage local durable de pièces sensibles. Une action externe incertaine affiche son état sans bouton de renvoi aveugle.

## Accessibilité et mouvement

Ordre de tabulation naturel, focus visible, labels persistants, erreurs liées au champ et annonces accessibles. Les états ne dépendent jamais de la couleur seule. Cibles tactiles de 44 px lorsque pertinent. Transitions courtes de 120–180 ms et respect de `prefers-reduced-motion` ; aucune animation ne retarde une action.

## Revue et passage au document produit

Avant Design System PASS : Architecture applicable validée, cohérence avec PRD/R01 et stories, décisions visuelles revues, composants/états spécifiés et stratégie de vérification. La conformité des composants réels, les contrastes, le clavier et les parcours seront prouvés pendant Execute/Verify des stories UI. Les flux auth, connecteurs, IA et effets externes ne sont pas implémentés dans cette préparation.
