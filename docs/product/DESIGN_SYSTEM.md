# Design System — DossierClé

## Statut et portée

`DESIGN_SYSTEM: PASS documentaire — revue indépendante PASS, 2026-10-11`

Cette spécification fixe la direction et les contrats d’interface communs pour le socle, le workflow Sinistres, puis le workflow Location. Elle ne démarre aucune story applicative. Architecture est `PASS` au niveau N1 après D81, avec les preuves N2/N3 conservées comme conditions d’activation ; voir [vérification courante du gate](../agentic/work/design-system-v1/architecture-gate.md). La revue indépendante finale du passage de phase est consignée dans [la revue de transition](../agentic/work/design-system-v1/transition-review.md).

La stack de référence est celle validée par D71/D72 : React 19, TypeScript 6 et Vite 8 côté interface ; NestJS 12, Node.js 24, Express 5, PostgreSQL 17 avec Drizzle ; Keycloak, Mistral et Inngest. Les choix ne sont pas rouverts ici. La conception ne dépend d’aucun fournisseur pour les motifs visuels ou les composants.

Le périmètre métier suit le PRD et les stories existants. Sinistres est construit et validé avant Location. Aucun portail artisan V2, compte artisan, paiement, notation ou classement financier des candidats, comparaison de candidats, choix de candidat, décision d’acceptation/refus ou préparation/signature de bail n’est introduit. La complétude locative décrit uniquement présence, lisibilité, date de validité apparente et cohérence d’identité des pièces.

## Direction visuelle et principes UX

DossierClé est un poste de travail pour une équipe d’agence : précis, calme et humain. L’interface rend immédiatement lisibles le dossier, son responsable, son état, la prochaine étape et la raison d’un blocage. Elle évite l’esthétique immobilière de vitrine et les tableaux de bord décoratifs. La densité sert le travail quotidien sans sacrifier la lecture.

1. **Le dossier avant le tableau de bord.** Commencer par une file priorisée et des listes opérables ; réserver les graphiques aux questions précises qu’ils aident à résoudre.
2. **Une action, une responsabilité.** Montrer qui peut agir, sous quel mandat et si une validation est requise. Une affordance ne confère jamais de droit ; le serveur décide toujours.
3. **Les faits et leur provenance restent lisibles.** Séparer faits confirmés, éléments à vérifier, résumé et prochaine action. Ne jamais suggérer qu’un résumé est la copie de l’e-mail ou de la pièce source.
4. **L’incertitude est formulée.** Distinguer « À vérifier », « En attente » et « Bloqué », expliquer l’étape nécessaire et préserver les saisies lorsqu’elles peuvent l’être.
5. **La validation humaine est une décision explicite.** Présenter l’action exacte, le destinataire, le contenu, la version et le mandat courant avant confirmation. Aucun envoi ni effet externe ne découle d’une simple consultation.
6. **Les listes restent sobres et comparables.** Utiliser colonnes stables, dates explicites et unités ; aucun score de personne ni indicateur qui transforme une complétude documentaire en jugement sur une candidature.
7. **L’interface est française et directe.** Libellés en français courant, dates localisées, montants avec devise, messages concrets. Les statuts conservent une forme textuelle même avec une icône ou une couleur.

## Tokens

Les valeurs ci-dessous sont des références de conception en CSS pixels. Les contrastes des paires de texte prévues ont été calculés depuis les valeurs hexadécimales pour orienter le choix des couleurs ; ils devront être recontrôlés sur les composants réellement rendus, y compris états, polices, transparence et focus, pendant Verify.

### Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `color.canvas` | `#F5F7F5` | Fond global légèrement teinté |
| `color.surface` | `#FFFFFF` | Panneaux, formulaires et lignes sélectionnées |
| `color.surface-subtle` | `#EDF2EF` | Survol neutre, regroupement secondaire |
| `color.text` | `#1B2924` | Texte principal ; contraste calculé 15.1:1 sur blanc |
| `color.text-secondary` | `#4B5D54` | Métadonnées et aide ; 7.1:1 sur blanc |
| `color.text-muted` | `#59675F` | Information secondaire ; 5.9:1 sur blanc |
| `color.border` | `#C8D2CC` | Bordures et séparateurs |
| `color.border-strong` | `#829189` | Contrôles nécessitant une bordure plus visible |
| `color.primary` | `#185C4B` | Action principale, lien actif et navigation ; blanc 7.9:1 |
| `color.primary-hover` | `#124638` | Survol d’action primaire |
| `color.primary-soft` | `#E2F1EB` | Sélection, arrière-plan de focus secondaire |
| `color.accent` | `#80500D` | Accent éditorial rare, jamais seul pour exprimer un état ; blanc 6.8:1 |
| `color.info-text` / `color.info-bg` | `#174C73` / `#E8F2F9` | Information et état informatif ; texte/fond 8.0:1 |
| `color.success-text` / `color.success-bg` | `#17613A` / `#E8F4EC` | Succès confirmé ; texte/fond 6.6:1 |
| `color.warning-text` / `color.warning-bg` | `#704700` / `#FFF3D8` | Attention nécessitant lecture ou action ; 7.4:1 |
| `color.danger-text` / `color.danger-bg` | `#9C252D` / `#FCEAEC` | Erreur ou danger ; texte/fond 6.7:1 |
| `color.focus` | `#1167A8` | Anneau 2 px ; sur fond sombre, ajouter liseré clair `#D8F0FF` contrasté à 12.8:1 |

Les statuts portent toujours un libellé explicite. Les couleurs s’emploient en paire texte/fond, jamais comme unique différence entre lignes ou boutons. Une couleur de marque ou d’accent ne doit pas coder une autorisation, une gravité ou un résultat métier.

### Typographie

Utiliser les polices système pour éviter un chargement externe et garder une bonne couverture des accents :

```css
:root {
  --font-ui: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-reading: Georgia, "Times New Roman", serif;
  --font-mono: ui-monospace, "SFMono-Regular", Consolas, monospace;
}
```

| Rôle | Taille / hauteur de ligne | Graisse |
|---|---|---|
| Titre d’écran | 28/36 px desktop, 24/32 px mobile | 650–700 |
| Titre de section | 20/28 px | 600–650 |
| Titre de panneau | 16/24 px | 600 |
| Corps et contrôles | 16/24 px | 400–500 |
| Libellé compact | 14/20 px, ponctuel | 550–600 |
| Aide et métadonnée | 14/20 px minimum | 400 |
| Données tabulaires | 14–16/20–24 px | 400–600 |

Le serif est réservé à la marque ou aux intertitres éditoriaux, jamais aux contrôles, statuts ou colonnes denses. Les chiffres alignés (`font-variant-numeric: tabular-nums`) conviennent aux dates, durées et comptes. Le zoom navigateur à 200 % ne doit ni couper ni superposer le texte.

### Espacements, dimensions et formes

Échelle : `space-1 4`, `space-2 8`, `space-3 12`, `space-4 16`, `space-5 20`, `space-6 24`, `space-8 32`, `space-10 40`, `space-12 48`, `space-16 64` px. Garder au moins 8 px entre contrôles distincts et 16 px entre groupes de formulaire.

| Mesure | Référence |
|---|---|
| Contrôle de formulaire | 44 px de haut par défaut ; jamais moins de 40 px |
| Cible interactive | 44 × 44 px visée ; minimum WCAG 2.2 AA 24 × 24 px sauf exception de critère |
| Barre supérieure | 64 px |
| Navigation latérale | 248 px ouverte, 72 px compacte |
| Contenu formulaire | largeur maximale 720 px |
| Lecture dossier | largeur maximale 1280 px ; le fil peut utiliser l’espace restant |
| Rayon contrôle | 6 px |
| Rayon panneau/carte | 10 px |
| Rayon pastille | 999 px, uniquement pour les statuts courts |
| Bordure standard | 1 px ; séparation de table 1 px |

| Élévation | Référence |
|---|---|
| `elevation-0` | `none` — contenu courant |
| `elevation-1` | `0 1px 2px rgb(27 41 36 / 8%)` — menu ou panneau flottant léger |
| `elevation-2` | `0 8px 24px rgb(27 41 36 / 14%)` — dialogue ou tiroir |

Une bordure ou un changement de fond sépare les données ; les ombres sont réservées aux menus, dialogues et panneaux flottants. Les cartes ne doivent pas encapsuler chaque champ : regrouper par tâche.

### Mouvements

Les changements d’état utilisent 120–180 ms, principalement opacité et couleur ; ouverture/fermeture de dialogue peut aller jusqu’à 200 ms. Pas de mouvement parallèle au défilement, de clignotement, ni d’animation qui retarde une action. Avec `prefers-reduced-motion: reduce`, supprimer translation et transition non essentielles. Les indicateurs de progression ont un texte équivalent et ne dépendent pas d’une animation continue.

## Structure et navigation

Sur écran large, une barre latérale regroupe le travail quotidien ; une barre haute conserve le nom de l’agence courante, un indicateur de contexte, la recherche autorisée et le compte utilisateur. La navigation propose les espaces V1 pertinents : **À traiter**, **Conversations**, **Dossiers**, **Artisans**, **Biens**, puis **Rapports**. **Administration** et **Journal d’activité** n’apparaissent qu’aux rôles qui peuvent les consulter. Les modules et boîtes sont visibles selon le périmètre autorisé.

Un contrôle de changement d’agence n’existe que pour un compte ayant plusieurs appartenances explicites. Le contexte d’agence reste visible sur chaque écran métier et avant une action protégée. Aucun lien de navigation ni recherche ne révèle l’existence d’un élément interdit. Un refus ne confirme pas si un dossier d’une autre agence existe.

À largeur étroite, la navigation devient un panneau accessible ouvert par un bouton nommé ; le contenu demeure dans le flux principal. Sur très petit écran, les destinations essentielles peuvent utiliser une barre basse seulement si les libellés restent visibles et les droits compréhensibles. Ne pas réduire la taille du texte pour faire tenir le menu.

## Composants et contrats d’usage

| Famille | Composants | Règles |
|---|---|---|
| Navigation | `AppShell`, barre latérale, fil d’Ariane, onglets, pagination | Liens pour naviguer, boutons pour agir ; courant indiqué par texte/icône et `aria-current` ; ordre clavier identique à l’ordre visuel |
| Actions | `Button`, `IconButton`, menu d’actions, lien | Primaire unique par zone ; libellé verbal pour action risquée ; icône seule avec nom accessible et cible 44 px ; état en cours empêche le doublon |
| Saisie | `TextField`, `TextArea`, `Select`, `Checkbox`, `RadioGroup`, `Search`, `DateField`, `FormField` | Label persistant, unité et format près du champ, aide reliée, erreur reliée ; placeholder n’est jamais le seul label |
| Liste et données | `Table`, `List`, `FilterBar`, filtre actif, tri, pagination, `EmptyState`, `Skeleton` | En-têtes nommés, tri annoncé, filtres retirables individuellement, compte de résultats ; préserver filtres et position après retour de dossier |
| Dossier | en-tête dossier, fil d’activité, carte « prochaine étape », provenance | État du dossier distinct de l’état d’un message et du statut de prise en charge ; aucune URL vers une source originale privée |
| État | `StatusBadge`, `InlineStatus`, `Alert`, bannière persistante | Texte descriptif obligatoire ; annoncer dynamiquement le changement sans déplacer le focus |
| Notification | toast, centre de notifications, confirmation de sauvegarde | Toast pour succès non bloquant seulement ; erreur ou validation requise reste visible dans le contexte jusqu’à résolution |
| Superposition | `Dialog`, `Drawer`, menu contextuel | Titre explicite, focus contenu/retour, fermeture au clavier, clic extérieur non destructif ; confirmer avant fermeture si saisie perdue |
| Validation humaine | `ApprovalPanel` | Afficher action, destinataire, contenu/version, dossier, mandat et effet attendu ; seule une personne habilitée voit les commandes ; approbation explicite et révocable tant que non exécutée |

### États visuels des composants

| Composant | Survol | Focus clavier | Désactivé / indisponible | En cours | Résultat / erreur |
|---|---|---|---|---|---|
| Bouton / lien d’action | Fond ou soulignement renforcé | Anneau visible sans déplacer la mise en page | Contraste lisible et raison visible si l’action est connue mais interdite | Libellé conservé, progression annoncée, doublon empêché | Retour succès seulement après confirmation serveur ; erreur près de l’action |
| Champ / sélection | Bordure renforcée sans perte d’état | Anneau visible ; ouverture native ou widget clavier documenté | Valeur et libellé lisibles ; pas d’interaction trompeuse | Soumission associée indiquée dans le formulaire | Erreur texte reliée au champ ; succès seulement si une confirmation est utile |
| Ligne / carte dossier | Fond `surface-subtle` | Toute la zone interactive focalisable avec nom compréhensible | Aucun faux lien ; contenu accessible selon autorisation | Skeleton ou actualisation locale sans saut | Statut textuel conservé ; erreur ou changement près du dossier |
| Filtre actif / badge | Contraste renforcé si interactif | Retrait activable au clavier et nommé | Badge informatif non présenté comme action | Compte de résultats actualisé et annoncé | Filtre invalide expliqué ; retrait individuel disponible |
| Alerte / toast | Aucun changement sémantique | Fermeture et action éventuelle accessibles | Succès non bloquant peut disparaître ; avertissement requis persiste | Message de progression stable | Erreur/validation requise persiste dans le contexte |
| Dialogue / tiroir | — | Focus contenu, boucle dans le dialogue modal, retour à l’initiateur | Arrière-plan inerte si modal ; fermeture sûre | Contrôle pendant action non répétable | Résultat affiché avant fermeture si une décision est requise |
| `ApprovalPanel` | Les commandes ne changent pas le destinataire ou le contenu | L’approbateur peut relire tout le contenu et atteindre les décisions au clavier | Commandes absentes si non habilité ; demande consultable seulement si autorisée | Décision enregistrée avec action/version en attente | Obsolescence ou incertitude invalide le geste et demande réconciliation |

### Boutons et actions

Styles : primaire plein pour la prochaine action recommandée, secondaire bordé pour action parallèle, tertiaire texte pour action faible, danger pour suppression/désactivation. Une page garde une action primaire visuellement dominante. Le verbe nomme l’effet (« Enregistrer les modifications », « Valider cet envoi »). Un spinner seul ne remplace pas le texte. Pendant un envoi, conserver le libellé et ajouter « Envoi en cours… » avec `aria-busy`; ne signaler le succès qu’après confirmation serveur.

Un bouton interdit est masqué si sa seule présence révélerait une capacité inaccessible ; lorsqu’une action est connue mais temporairement impossible pour cet utilisateur, afficher une explication sûre et générique. Ne jamais utiliser un contrôle désactivé comme unique explication d’une règle importante.

### Formulaires

Chaque champ possède un label visible. Les champs obligatoires sont indiqués dans le label et expliqués une seule fois au début du formulaire. Aide et erreur sont reliées par `aria-describedby`; erreur ajoute `aria-invalid="true"`. À soumission invalide, conserver les valeurs, déplacer le focus vers un résumé d’erreurs lié aux champs puis permettre leur correction. Ne valider agressivement qu’après interaction ou soumission. L’erreur serveur précise quoi corriger sans exposer détails internes.

Pour les pièces locatives, les contrôles décrivent seulement : **reçue/non reçue**, **lisible/à vérifier**, **date apparente valide/expirée/absente**, **cohérence d’identité à vérifier**. Ne pas présenter une pièce comme authentifiée ou une candidature comme admissible. Les pièces ne sont pas mises en cache locale durablement.

### Tableaux, listes et filtres

La table desktop expose colonnes, intitulés et actions cohérents ; elle ne piège pas la navigation clavier. En vue mobile, convertir chaque ligne en bloc de données avec intitulés visibles (« Responsable », « Prochaine étape ») et ordre de lecture équivalent ; ne jamais masquer la seule donnée qui explique le statut. Le changement de tri est annoncé avec direction. Pagination conserve les filtres.

Les filtres utilisent des champs nommés, affichent le nombre de résultats et les filtres actifs sous forme de contrôles supprimables. Le bouton « Effacer les filtres » est disponible dès qu’un filtre est appliqué. L’absence de résultats distingue « Aucun dossier ne correspond aux filtres » de « Aucun dossier pour le moment ».

### Statuts et notifications

Un statut combine libellé, contexte et éventuellement icône. Les états génériques sont **À traiter**, **En cours**, **En attente**, **À vérifier**, **Action humaine requise**, **Bloqué**, **Terminé** ; une story peut définir des termes métier précis sans réutiliser une couleur comme sémantique globale. Le statut de prise en charge (agent/humain) reste séparé du cycle de vie du dossier.

Les annonces asynchrones utilisent une région `role="status"`/`aria-live="polite"`; les erreurs urgentes uniquement utilisent `role="alert"` avec parcimonie. Un toast disparaît après un délai confortable, est atteignable au clavier et peut être fermé ; toute information ou décision requise reste dans la page.

### Dialogues et confirmation humaine

Un dialogue de confirmation destructive nomme la cible et l’effet (« Désactiver la boîte X »), place l’action sûre comme bouton principal et ne présélectionne jamais l’option destructive. Échap ferme seulement si aucune action n’est en cours ou donnée à perdre ; sinon demander confirmation et proposer de revenir.

Le panneau de validation affiche : demandeur, dossier et agence, action exacte, destinataire(s), contenu à transmettre, date/version, règle ou mandat applicable, conséquences et date limite si définie par le métier. L’approbateur relit puis choisit explicitement **Valider** ou **Refuser**. Les changements du contenu, destinataire, dossier, droits ou mandat invalident l’approbation et exigent une nouvelle revue. Un résultat fournisseur incertain conduit à **Résultat à vérifier** et à réconciliation ; aucun bouton de renvoi immédiat n’est proposé.

## États communs

| État | Présentation et comportement |
|---|---|
| Chargement initial | Skeleton de la structure attendue avec libellé de chargement ; éviter un écran vide ; mouvement réduit respecté |
| Mise à jour locale | Garder les données précédentes, signaler « Actualisation… », éviter le saut de mise en page |
| Vide initial | Dire ce qui peut être fait ensuite, et proposer une action seulement si le rôle en a le droit |
| Aucun résultat filtré | Dire qu’aucun résultat ne correspond et offrir retrait des filtres |
| Erreur récupérable | Message contextualisé, données saisies préservées ; action de réessai seulement si la requête précédente est connue sans effet ou réconciliée |
| Erreur d’autorisation | Message générique « Vous n’avez pas accès à cet élément ou il n’est plus disponible » ; aucune donnée, titre, agence ou existence révélée |
| Session expirée | Interrompre les écritures, expliquer la reconnexion et préserver uniquement les brouillons métier autorisés côté serveur ; jamais de pièce sensible durable en stockage navigateur |
| Accès refusé | Page/état de refus avec retour sûr vers une destination autorisée ; pas de lien exploitable vers l’objet refusé |
| Sauvegarde incertaine | Conserver les données à l’écran, indiquer « Vérification nécessaire » et réconcilier l’état avant toute répétition |
| Validation humaine requise | Présenter l’action exacte, les informations à relire et les rôles qui peuvent décider ; pas de présélection ni d’approbation implicite |
| Contenu devenu obsolète | Signaler les champs/version modifiés, invalider la décision en attente et faire relire l’état courant |
| Quarantaine ou pièce illisible | Expliquer que la pièce n’est pas disponible pour traitement automatique et indiquer la prochaine étape humaine sans exposer son contenu |

## Responsive

Les mises en page changent selon l’espace disponible, pas selon un appareil supposé. Points de rupture de départ : 640 px (petit/moyen), 900 px (navigation), 1200 px (panneau secondaire). Ils seront ajustés aux parcours et mesurés en Verify.

- **≥ 1200 px :** navigation complète, liste et détail côte à côte si cela évite les retours ; formulaire centré, contenu dossier jusqu’à 1280 px.
- **640–1199 px :** navigation compacte ou panneau, un panneau de dossier à la fois lorsque les colonnes nuisent à la lecture ; filtres dans un tiroir accessible.
- **< 640 px :** une colonne, actions importantes persistantes seulement si elles ne masquent pas le contenu, lignes transformées en blocs étiquetés, tableaux sans défilement horizontal obligatoire pour l’action principale.
- **Tous formats :** zoom 200 %, reflow à 320 CSS px et orientation portrait/paysage sans perte ; contenu sensible jamais relégué derrière un survol.

## Clavier, focus et WCAG 2.2 AA

La cible est [WCAG 2.2 niveau AA (W3C)](https://www.w3.org/TR/WCAG22/). Ce document fixe les exigences ; il ne certifie aucune implémentation.

- Parcours complet au clavier avec Tab/Shift+Tab, Entrée/Espace et flèches pour widgets composites ; aucune trappe clavier.
- Focus visible : anneau 2 px, contraste distinctif, décalage d’au moins 2 px ; élément focalisé au moins partiellement visible, sans masquage total par l’en-tête ou le pied fixe (2.4.11 AA).
- Ordre DOM cohérent avec l’ordre visuel ; lien d’évitement au contenu ; titres hiérarchisés et landmarks nommés.
- Contraste minimal : texte normal 4.5:1 ; grand texte 3:1 ; composants graphiques et indicateurs de focus 3:1 contre les couleurs adjacentes (1.4.3, 1.4.11).
- Couleur jamais seule porteuse de sens ; grossissement et reflow ; espacement de texte utilisateur sans perte (1.4.10, 1.4.12).
- Tous les contrôles ont un nom, rôle et valeur accessibles ; nom visible inclus dans le nom accessible ; icônes décoratives ignorées par les technologies d’assistance.
- Erreurs identifiées en texte, suggestion utile lorsqu’elle est connue, résumé après soumission et annonce dynamique (3.3.1–3.3.3, 4.1.3).
- Dialogues nommés, modalité correctement exposée, focus contenu à l’ouverture puis rendu à l’initiateur à la fermeture ; pas d’activation automatique.
- Cible interactive recommandée 44 × 44 px ; respecter le minimum WCAG 2.2 AA de 24 × 24 px et ses exceptions (2.5.8).
- Authentification compatible gestionnaire de mots de passe, collage et autofill ; aucune tâche cognitive inutile dans les étapes de connexion (3.3.8).
- Respecter `prefers-reduced-motion`; pas d’information révélée seulement au survol ou au mouvement.

## Exemples visuels de référence

Ces maquettes textuelles illustrent la hiérarchie et le contenu, pas un écran de story déjà conçu. Les contrôles restent soumis aux rôles et aux droits serveur.

### File « À traiter » — écran large

```text
┌ DossierClé ─────────────── Agence Rivoli ───── Recherche ─── IS ┐
│ À traiter    │ À traiter                                      │
│ Conversations│ 8 dossiers · 2 actions humaines requises        │
│ Dossiers     │ [Tous modules ▾] [Responsable ▾] [Échéance ▾]   │
│ Artisans     │ Filtres : Sinistres ×  Ouvert ×                 │
│ Biens        │ ┌──────────────────────────────────────────────┐│
│ Rapports     │ │ SINISTRES · Action humaine requise  Aujourd’hui│
│              │ │ Fuite cuisine · dossier DC-1042               │
│              │ │ Responsable : Léa M. · Prochaine étape : relire│
│              │ ├──────────────────────────────────────────────┤│
│              │ │ LOCATION · Pièce à vérifier       14 octobre  │
│              │ │ Demande Tilleuls · dossier DC-1036            │
│              │ │ Responsable : Vous · 1 document illisible     │
│              │ └──────────────────────────────────────────────┘│
│ Administration · Journal (selon les droits)                    │
└─────────────────────────────────────────────────────────────────┘
```

La liste met en avant le travail et la prochaine étape. Elle ne note aucune personne. En vue mobile, chaque rangée devient une carte nommée avec module, libellé, état, responsable et échéance dans cet ordre.

### Dossier sinistre — écran large

```text
← Dossiers / Sinistres       Agence Rivoli                   Version 12
Fuite cuisine · DC-1042      ACTION HUMAINE REQUISE
Locataire : Mme Martin       Bien : 18 rue des Écoles · Bât. B
Responsable : Léa M.         Prochaine étape : valider le message

┌ Activité et faits confirmés ─────────────────┐ ┌ Prochaine étape ───┐
│ 10:42  Déclaration reçue                     │ │ Demande de devis   │
│        Résumé : fuite sous évier signalée    │ │ À valider par un   │
│        Provenance : message entrant, 11 oct. │ │ rôle habilité      │
│ 11:05  Visite demandée · résultat en attente │ │ [Examiner]         │
└─────────────────────────────────────────────┘ └────────────────────┘

Pièces de travail : aucune pièce originale affichée dans le fil historique.
```

Un état « Résultat en attente » ne propose pas d’envoyer une deuxième demande. La décision d’engager l’artisan garde son propre contrôle et sa validation obligatoire.

### Validation d’un message — panneau de revue

```text
Valider une demande de devis
Action préparée par l’agent · dossier DC-1042 · version 12
Destinataire : Atelier du Centre <adresse autorisée>
Mandat : demande non engageante autorisée · dépense non autorisée

Message à transmettre
┌───────────────────────────────────────────────────────────────┐
│ Bonjour, pouvez-vous proposer un créneau pour constater…      │
└───────────────────────────────────────────────────────────────┘
Conséquence : transmet une demande, sans confirmer d’affectation.

[Refuser]                            [Valider l’envoi]
```

L’approbation exige un rôle autorisé, la version toujours courante et une activation explicite. Après validation, résultat incertain mène à réconciliation avant toute reprise.

### Complétude documentaire Location — écran étroit

```text
← Dossier Tilleuls · DC-1036
COMPLÉTUDE À VÉRIFIER

Documents attendus (4)
✓  Justificatif d’identité
   Lisible · date apparente valide
!  Justificatif de domicile
   À vérifier · document illisible
✓  Justificatif de ressources
   Reçu · contrôle de complétude effectué
○  Document complémentaire demandé
   Non reçu

Résumé : 2 présents et vérifiés · 1 à vérifier · 1 manquant
[Demander une correction]

Cette vue n’évalue pas la solvabilité et ne compare pas les candidats.
```

Le résumé exprime uniquement la complétude documentaire objective. Toute donnée ou pièce reste visible uniquement à un utilisateur autorisé dans son agence.

## Vérification attendue lors des stories UI

Avant de déclarer un composant conforme, Verify doit couvrir au minimum les contrastes réellement rendus, focus et ordre clavier, lecteur d’écran sur contrôles/erreurs/dialogues/annonces, zoom 200 % et reflow 320 CSS px, cibles tactiles, mouvement réduit, états autorisation/expiration, persistance des saisies et droits par rôle. Les parcours Sinistres passent avant ceux de Location ; les captures sont synthétiques et ne contiennent aucun e-mail ou document réel.

## Gate Design System

- [x] Direction visuelle et principes UX définis.
- [x] Tokens couleur, typographie, espacement, dimensions, formes et mouvement documentés.
- [x] Navigation et composants requis décrits avec leurs contrats d’usage.
- [x] États chargement, vide, erreur, refus, incertitude et validation humaine spécifiés.
- [x] Responsive, clavier, focus et cible WCAG 2.2 AA couverts.
- [x] Exemples représentatifs pour socle, Sinistres, validation et Location fournis.
- [x] Restrictions PRD/R01 respectées ; aucune story applicative commencée.
- [x] Gate Architecture `PASS` — matrice N1/N2/N3 D73–D82 et revue indépendante.
- [x] Revue indépendante `PASS` ; zéro finding Critical, Major ou Minor ouvert.

**Verdict de phase : PASS documentaire.** La couverture ne prétend pas prouver l’accessibilité d’une UI non implémentée ; contrastes rendus, clavier, lecteur d’écran, responsive et droits restent à vérifier dans les stories UI.
