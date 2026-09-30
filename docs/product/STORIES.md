# Stories — DossierClé

## Status

`STORIES: PASS`

- Date : 2026-09-30. Mode : LARGE. Ticket documentaire : #25.
- Sources : [PRD](PRD.md), version du 2026-09-29 (`main@f4d7499`), et matrice de rôles demandée le 2026-09-30.
- PASS signifie que le découpage est proposé complet pour la Story Review, pas que le logiciel est réalisé. Toutes les stories sont **BACKLOG** ; aucun critère d’acceptation applicatif n’est encore exécuté.
- La Story Review indépendante reste le gate suivant. Architecture, Design System, puis Research → Design → Plan → Execute → Verify → Review restent obligatoires.
- Les 12 groupes suivent l’ordre demandé. L’ordre de réalisation est topologique : quelques prérequis du catalogue et de la validation sont réalisés plus tôt que leur écran complet. Sinistres est validé avant le parcours Location.

## Règles transverses

### R01 — Matrice des rôles et périmètre d’accès

| Action | Administrateur agence | Collaborateur habilité | Collaborateur standard |
|---|---|---|---|
| Définir les fonctions, modes, limites, boîtes et modules du mandat | Oui | Non | Non |
| Lire le mandat applicable | Oui | Oui, périmètre autorisé | Oui, périmètre autorisé |
| Lire l’historique des changements du mandat | Oui | Non par défaut | Non par défaut |
| Gérer utilisateurs, rôles, attributions et connexions | Oui | Non | Non |
| Suspendre/réactiver globalement, par boîte ou module | Oui | Seulement dans son habilitation explicite | Non |
| Prendre la main sur un dossier | Oui dans son agence | Dossier explicitement autorisé | Ses dossiers attribués |
| Valider une action protégée | Oui si autorisé et action attribuée | Seulement une action explicitement attribuée | Non |
| Consulter dossiers, rapports et audit fonctionnel | Dans son agence | Périmètre autorisé | Ses dossiers attribués |

Un rôle ne donne jamais accès à une autre agence. « Ses dossiers » désigne une attribution enregistrée par l’administrateur, non une adresse e-mail correspondante ni un dossier simplement ouvert. L’attribution de travail est distincte de la prise en charge temporaire : un dossier attribué au collaborateur peut être momentanément traité par l’IA. « Habilité » exige un périmètre explicite enregistré par l’administrateur (boîtes/modules/dossiers et droit de suspension/reprise) ; aucun joker implicite. « Action attribuée » désigne une demande de validation liée à un destinataire humain autorisé, une action précise et une version courante. Un utilisateur ne s’attribue pas de droits lui-même. Un dossier sans attribution exploitable va dans la file administrateur.

La réactivation par un habilité ne lève pas une suspension administrateur ni une restriction de mandat. Elle ne ressuscite jamais une tâche invalidée ; toute reprise exige une nouvelle décision explicite sous le mandat courant. Le standard peut arrêter l’autonomie de son dossier par Prendre la main, mais ne peut pas réactiver globalement l’agent. L’administrateur technique de plateforme n’est pas un administrateur d’agence : aucun accès métier implicite ; opérations de support à définir et auditer en Architecture.

### R02 — Autorisation à chaque effet

Authentification, agence, rôle, habilitation, attribution, état du dossier, responsable, version et mandat sont contrôlés côté serveur avant lecture sensible, mutation et effet externe. Une interface masquée n’est jamais la protection. Les tests de chaque story incluent accès anonyme, rôle interdit, autre agence et révocation pendant une tâche. Un refus ne révèle aucune donnée ni existence de ressource étrangère.

### R03 — Mandat et interdictions

Les trois modes sont exactement **L’agent fait seul**, **L’agent prépare et demande une validation**, **L’agent ne fait pas**. Toute fonction nouvelle ou non configurée reste désactivée ; une restriction locale ne peut élargir le mandat agence. Une action protégée ne devient jamais autonome, même par API ou contenu d’un e-mail. Une instruction reçue dans un message, une pièce ou une réponse IA n’est pas une autorisation.

Solvabilité, appréciation financière, notation/classement/comparaison de candidats, choix, acceptation/refus de candidature et préparation/modification/signature de bail sont entièrement hors DossierClé et agent V1 : pas même de brouillon, suggestion ou bouton dans le formulaire. Une demande correspondante est transférée à l’agence sans préparation de la décision. Complétude documentaire ≠ authenticité ou admissibilité d’une candidature.

### R04 — Traçabilité et effets externes dès le socle

Chaque story enregistre dès sa livraison ses événements : agence, acteur, date, objet, changement, résultat et corrélation ; mandat/version/règle et validation lorsque pertinents. S36 ajoute la consultation consolidée, pas la première écriture d’audit. L’échec de journalisation d’une action sensible empêche son exécution non traçable. Les journaux techniques ne recopient ni secrets ni documents bruts ; les messages envoyés restent dans l’historique métier privé.

S35 fournit la validation humaine minimale avant tout acte protégé. Chaque effet externe vérifie destinataire, dossier, absence de doublon, prise en charge, mandat courant et conditions d’arrêt. En cas de résultat fournisseur incertain, réconcilier avant de retenter : ne jamais renvoyer à l’aveugle. Une action déjà exécutée n’est pas annulée par un changement de mandat.

### R05 — Définition de fini commune

Pour chaque story : démonstration du parcours heureux, refus d’accès, entrée invalide, échec/récupération, concurrence et répétition lorsque pertinents ; preuves Verify avec fixtures synthétiques, versions et résultats ; aucun Critical/Major ouvert. Tests unitaires des règles, intégration des frontières et scénario navigateur du parcours concerné. Les critères ci-dessous sont des tests à implémenter, pas des résultats acquis. S/M/L mesure la complexité relative, pas un engagement de durée ; toute story L doit être recontrôlée en Plan, sans changer ses obligations.

## 1. Créer et sécuriser l’espace d’une agence

### Story S01 — Créer et activer un espace isolé

**En tant que** responsable, **je veux** créer mon agence, **afin de** disposer d’un espace indépendant sans administrer un serveur.

**Source PRD :** §1 Espace agence ; Parcours A ; Sécurité ; Techniques.

#### Critères d’acceptation
- [ ] Étant donné une création autorisée, quand elle réussit, alors l’agence dispose d’un espace distinct, d’un premier administrateur vérifié et d’un état actif ; aucune fonction IA n’est activée implicitement.
- [ ] Quand la même création est répétée ou échoue en cours, alors aucun second espace actif ni activation partielle n’est présenté ; l’état et la reprise sont explicites.
- [ ] Quand un identifiant d’agence étrangère est substitué, alors aucune donnée, aucun fichier ni secret ne devient accessible.
- [ ] Quand l’administrateur consulte l’activation, alors il voit l’état et les erreurs utiles, pas de choix CPU/RAM ni de secrets.

#### Dépendances
Aucune. Le bootstrap du premier administrateur et ses contrôles d’identité font partie de cette story, selon l’Architecture approuvée.
#### Hors périmètre
Facturation SaaS et gouvernance multi-filiales.
#### Complexité
M.
#### Tests attendus
Création nominale, double soumission, panne de provisionnement, isolation de deux agences.

### Story S02 — Accéder à son espace et fermer sa session

**En tant que** utilisateur, **je veux** m’authentifier et me déconnecter, **afin de** protéger mon espace.

**Source PRD :** §1 ; Sécurité ; Questions ouvertes/authentification.

#### Critères d’acceptation
- [ ] Quand une identité active s’authentifie avec la méthode retenue en Architecture, alors elle accède seulement à son agence et à ses droits courants.
- [ ] Quand l’identité est invalide, inactive ou non authentifiée, alors l’accès est refusé sans divulgation de compte, secret ou donnée métier.
- [ ] Quand une session expire, est révoquée ou déconnectée, alors elle ne permet plus de consulter ni de modifier l’espace ; un ancien onglet ne contourne pas ce refus.
- [ ] Quand des tentatives abusives surviennent, alors les protections définies en Architecture s’appliquent sans erreur serveur ni fuite.

#### Dépendances
S01.
#### Hors périmètre
Choix du fournisseur d’identité ou d’un protocole dans les Stories.
#### Complexité
M.
#### Tests attendus
Connexion/déconnexion navigateur, expiration, accès direct API, session révoquée.

### Story S03 — Récupérer et exporter les données de son agence

**En tant que** administrateur, **je veux** disposer d’une récupération vérifiable de mes données, **afin de** ne pas perdre mes dossiers.

**Source PRD :** Données sensibles ; Succès fonctionnel ; Questions ouvertes/sauvegarde et export.

#### Critères d’acceptation
- [ ] Quand une sauvegarde puis restauration sont réalisées dans un environnement isolé, alors les messages, liens, dossiers, documents et traces attendus de l’agence sont retrouvés sans données étrangères.
- [ ] Quand un export autorisé est demandé, alors son périmètre est explicite, privé et accessible seulement à l’agence autorisée ; aucun secret messagerie n’est exporté.
- [ ] Quand la récupération échoue ou qu’une sauvegarde est inutilisable, alors l’échec est visible, tracé et n’écrase pas les données actives.
- [ ] Quand des tâches externes sont restaurées, alors elles ne rejouent aucun envoi automatiquement avant réconciliation et contrôle du mandat courant.

#### Dépendances
S02.
#### Hors périmètre
Choix stockage, objectifs RPO/RTO ou restauration destructive de production ; à décider et autoriser avant Execute.
#### Complexité
L.
#### Tests attendus
Restauration et export synthétiques par agence ; refus inter-agences ; absence de rejeu d’envoi. À répéter avec toutes les données V1 au gate pilote.

## 2. Gérer les utilisateurs et leurs rôles

### Story S04 — Ajouter et activer un collaborateur

**En tant que** administrateur, **je veux** donner un accès à un collaborateur, **afin de** travailler en équipe.

**Source PRD :** §1 ; Utilisateurs ; Sécurité ; matrice R01.

#### Critères d’acceptation
- [ ] Quand l’administrateur ajoute un collaborateur, alors son agence et son rôle explicites sont enregistrés sans héritage de droits d’une autre agence.
- [ ] Quand l’activation est absente, invalide, expirée ou réutilisée, alors aucun accès n’est accordé ; le mécanisme retenu est défini en Architecture.
- [ ] Quand l’ajout est répété, alors il ne produit pas deux habilitations actives contradictoires.
- [ ] Quand un standard ou habilité tente de créer un compte ou d’élever son rôle, alors le serveur refuse et trace l’essai sans effet.

#### Dépendances
S02.
#### Hors périmètre
Portail artisan et invitation artisan V2.
#### Complexité
M.
#### Tests attendus
Ajout/activation nominale, répétition, activation invalide, élévation de rôle interdite.

### Story S05 — Attribuer rôles, dossiers et validations

**En tant que** administrateur, **je veux** attribuer les responsabilités explicitement, **afin de** limiter chaque action à la bonne personne.

**Source PRD :** §1, §9, §10 ; matrice R01.

#### Critères d’acceptation
- [ ] Quand l’administrateur définit un rôle et un périmètre, alors les droits résultants correspondent exactement à R01 ; une habilitation sans périmètre ne donne aucun droit étendu.
- [ ] Quand un dossier est attribué à un standard, alors il peut le consulter et en prendre la main sans pouvoir consulter un autre dossier non attribué.
- [ ] Quand une validation est attribuée à un habilité, alors seule l’action identifiée et autorisée est validable ; le changement du destinataire exige un administrateur.
- [ ] Quand un utilisateur tente de s’attribuer un dossier, une validation ou une habilitation, alors la requête est refusée. Un dossier non attribué reste visible à l’administrateur pour attribution.

#### Dépendances
S04.
#### Hors périmètre
Rôles personnalisables, groupes multi-filiales et délégation implicite par e-mail.
#### Complexité
M.
#### Tests attendus
Matrice croisée trois rôles/deux agences, attribution distincte de la prise en charge, falsification de destinataire.

### Story S06 — Révoquer les accès d’un collaborateur

**En tant que** administrateur, **je veux** retirer des droits, **afin de** rendre leur révocation effective immédiatement.

**Source PRD :** Sécurité ; §9–10 ; R01–R02.

#### Critères d’acceptation
- [ ] Quand un compte est désactivé ou son rôle réduit, alors ses anciens droits ne fonctionnent plus au prochain accès ni à l’exécution d’une tâche différée.
- [ ] Quand il détenait des dossiers ou validations, alors ceux-ci deviennent à réattribuer par l’administrateur, sans validation ou envoi automatique en son nom.
- [ ] Quand une validation et une révocation sont concurrentes, alors l’effet externe recontrôle les droits courants et refuse une autorisation devenue invalide.
- [ ] Quand la dernière administration active serait supprimée, alors l’opération est refusée avec une explication et sans perte d’accès administratif.

#### Dépendances
S05.
#### Hors périmètre
Effacement des traces historiques d’un ancien collaborateur.
#### Complexité
M.
#### Tests attendus
Session déjà ouverte, tâche différée, concurrence validation/révocation, dernier administrateur.

## 3. Connecter plusieurs boîtes e-mail

### Story S07 — Connecter des boîtes Gmail et Microsoft 365

**En tant que** administrateur, **je veux** autoriser mes boîtes par OAuth, **afin de** les réunir dans mon agence.

**Source PRD :** §2 ; Parcours A ; Sécurité.

#### Critères d’acceptation
- [ ] Pour chacun des fournisseurs Gmail et Microsoft 365/Outlook, quand une autorisation aboutit, alors la boîte réelle est liée uniquement à l’agence initiatrice et son état est visible.
- [ ] Quand le consentement est refusé, expiré ou le retour d’autorisation falsifié, alors aucune liaison active n’est créée.
- [ ] Quand deux boîtes indépendantes sont connectées, alors elles restent administrables séparément ; un alias n’est pas compté comme seconde boîte.
- [ ] Quand la connexion est testée, alors aucun e-mail externe n’est envoyé et aucun jeton n’apparaît dans l’interface, les journaux ou la base métier en clair.

#### Dépendances
S05.
#### Hors périmètre
Ordre des deux fournisseurs et bibliothèque OAuth, à décider en Architecture.
#### Complexité
L.
#### Tests attendus
Même contrat d’intégration décliné pour les deux fournisseurs, retour croisé entre agences, refus, expiration, absence d’envoi.

### Story S08 — Connecter une boîte IMAP et déclarer les alias

**En tant que** administrateur, **je veux** utiliser une boîte compatible sans OAuth et ses alias, **afin de** couvrir ma messagerie existante.

**Source PRD :** §2 ; §4 tags ; Sécurité.

#### Critères d’acceptation
- [ ] Quand une boîte sans OAuth compatible est ajoutée par IMAP sécurisé, alors la connexion est vérifiée sans envoyer de message et ses secrets sont protégés.
- [ ] Quand un alias est déclaré, alors il référence une boîte réelle existante de l’agence et ne crée ni connexion indépendante ni double traitement.
- [ ] Quand l’accès ou le chiffrement est invalide, alors la connexion n’est pas activée et l’erreur utile ne contient aucun secret.
- [ ] Quand aucun marqueur fiable n’est disponible chez le fournisseur, alors la capacité est signalée et les actions autonomes externes restent interdites.

#### Dépendances
S05.
#### Hors périmètre
Compatibilité universelle IMAP, mécanisme d’envoi présumé sans preuve ; Architecture doit vérifier réception, envoi et marquage séparément.
#### Complexité
M.
#### Tests attendus
Boîte compatible/incompatible, alias dupliqué, secret absent des sorties, fournisseur sans marqueur.

### Story S09 — Piloter routage, état et révocation des connexions

**En tant que** administrateur, **je veux** contrôler chaque boîte séparément, **afin de** maîtriser ses traitements.

**Source PRD :** §2, §9 ; Parcours A/E.

#### Critères d’acceptation
- [ ] Quand une boîte est configurée, alors son routage est Biens, Sinistres ou classification automatique et reste soumis au mandat courant.
- [ ] Quand la connexion évolue, alors les états connectée, synchronisation en cours, autorisation expirée, erreur et désactivée sont visibles, avec une action de correction.
- [ ] Quand une boîte est désactivée ou révoquée, alors les tâches non exécutées la concernant sont bloquées sans couper les autres boîtes ; l’historique reçu n’est pas supprimé.
- [ ] Quand l’accès est rétabli, alors la reprise conserve le point de synchronisation utile sans pertes ni doublons ni réactivation implicite du mandat.

#### Dépendances
S07, S08.
#### Hors périmètre
Changement automatique des droits consentis auprès du fournisseur.
#### Complexité
M.
#### Tests attendus
Routage par boîte, révocation indépendante, expiration puis reprise, isolation.

## 4. Configurer le périmètre de l’agent IA

### Story S10 — Définir les fonctions et les trois modes

**En tant que** administrateur, **je veux** délimiter le mandat dans un formulaire métier, **afin de** comprendre ce que l’agent pourra faire.

**Source PRD :** §10 ; Fonctions Location hors périmètre ; R01/R03.

#### Critères d’acceptation
- [ ] Quand le formulaire est ouvert, alors les fonctions sont regroupées en Location, Dossiers locatifs, Sinistres et Communications, avec les trois modes exacts et un défaut désactivé.
- [ ] Quand une action protégée est affichée, alors le mode autonome est indisponible ; les fonctions Location exclues n’apparaissent jamais, même pour préparer une validation.
- [ ] Quand la configuration est activée, alors un résumé fidèle indique ce que l’agent fera seul, préparera ou ne fera pas ; l’administrateur confirme ce résumé.
- [ ] Quand un habilité ou standard consulte le formulaire, alors il lit le périmètre applicable sans pouvoir modifier le mandat, y compris via une requête directe.

#### Dépendances
S05.
#### Hors périmètre
Paramètres techniques dans le parcours principal et éditeur de workflows.
#### Complexité
M.
#### Tests attendus
Trois rôles, trois modes, fonction nouvelle, fonction exclue, cohérence formulaire/résumé/règle serveur.

### Story S11 — Fixer limites et restrictions locales

**En tant que** administrateur, **je veux** borner l’autonomie, **afin de** limiter destinataires, volumes et relances.

**Source PRD :** §10 ; Politique des e-mails sortants.

#### Critères d’acceptation
- [ ] Quand des limites sont enregistrées, alors tâches, boîtes/modules, destinataires, modèles/ton/informations obligatoires, seuil de confiance, horaires, volumes, cadence/maximum/arrêts des relances et escalades sont explicitement contrôlables.
- [ ] Quand une restriction par boîte ou module est plus permissive que le mandat agence, alors elle est rejetée ; l’absence de règle locale n’accorde aucun droit supplémentaire.
- [ ] Quand une valeur est invalide ou laisse une fonction sans limites nécessaires, alors l’activation de cette fonction est refusée avec explication métier.
- [ ] Quand une action excède une limite, vise un destinataire non autorisé ou un artisan non actif, alors elle n’est pas envoyée et la raison d’escalade est visible.

#### Dépendances
S10, S09.
#### Hors périmètre
Valeurs maximales commerciales et choix techniques de rate limiting, à arrêter avant Execute.
#### Complexité
M.
#### Tests attendus
Bornes, héritage restrictif, seuil inférieur/égal/supérieur, horaires et volume, destinataire hors mandat.

### Story S12 — Modifier, suspendre et réactiver sans rejeu

**En tant que** administrateur ou habilité autorisé, **je veux** arrêter et reprendre l’agent en sécurité, **afin de** garder le contrôle.

**Source PRD :** §10 transitions déterministes ; Succès fonctionnel ; R01.

#### Critères d’acceptation
- [ ] Quand l’administrateur passe autonome → préparation, alors les exécutions autonomes non réalisées sont annulées et seules les actions encore pertinentes créent une nouvelle validation sous la version courante.
- [ ] Quand une fonction passe à Ne fait pas, est désactivée ou suspendue, alors toutes ses tâches non exécutées sont invalidées et transférées à un collaborateur ou à la file administrateur, jamais converties automatiquement en brouillon/validation.
- [ ] Quand un habilité suspend/réactive, alors seul son périmètre explicite est touché ; une suspension administrateur et toute restriction courante restent opposables. Le standard n’a que Prendre la main sur ses dossiers.
- [ ] Quand une reprise est explicitement décidée, alors de nouvelles actions sont évaluées sous le mandat courant ; aucune tâche expirée/refusée/invalidée ne ressuscite et les actions déjà envoyées restent historiques.
- [ ] Quand deux modifications sont concurrentes, alors une version obsolète ne remplace pas silencieusement l’autre ; chaque changement conserve auteur/date/version/avant/après.

#### Dépendances
S11, S06.
#### Hors périmètre
Annuler un e-mail déjà remis au fournisseur.
#### Complexité
L.
#### Tests attendus
Toutes transitions, tâches en attente et en course, habilité face suspension admin, conflit de versions.

## 5. Recevoir, classer et rattacher les e-mails

### Story S13 — Recevoir chaque message une seule fois

**En tant que** collaborateur, **je veux** retrouver les messages originaux, **afin de** ne perdre aucune demande.

**Source PRD :** §2–4 ; Parcours E.

#### Critères d’acceptation
- [ ] Quand un message arrive par plusieurs boîtes/alias ou plusieurs notifications, alors il apparaît une seule fois comme message métier, avec toutes ses provenances utiles conservées.
- [ ] Quand il est reçu, alors original, métadonnées, adresse et boîte d’origine sont conservés et les pièces restent privées ; un contenu suspect n’est pas exécuté.
- [ ] Quand le fournisseur ou un traitement échoue, alors le message accepté n’est pas perdu ; les reprises sont bornées et l’échec persistant est visible avec relance autorisée sans double effet.
- [ ] Quand le même identifiant externe existe dans deux agences, alors aucune fusion ni exposition inter-agences ne se produit.

#### Dépendances
S09, S02.
#### Hors périmètre
Envoi automatique et interprétation d’instructions reçues comme autorisations.
#### Complexité
M.
#### Tests attendus
Webhook répété, multiboîtes/alias, panne à chaque étape d’acceptation, pièces hostiles et doublons inter-agences.

### Story S14 — Retrouver contacts et conversations distinctes

**En tant que** collaborateur, **je veux** retrouver l’historique pertinent, **afin de** répondre au bon dossier.

**Source PRD :** §3 ; §4 ; confirmation obligatoire des fusions ambiguës.

#### Critères d’acceptation
- [ ] Quand un fil possède des en-têtes/identifiants exploitables, alors ses messages sont présentés chronologiquement sans mélanger deux dossiers d’un même contact.
- [ ] Quand un contact a plusieurs adresses confirmées, alors chacune permet de le retrouver tout en conservant l’adresse originale de chaque message.
- [ ] Quand un rapprochement est ambigu, alors il est proposé à un humain autorisé via S35, jamais fusionné silencieusement ; une correction conserve la trace des liens précédents sans modifier d’autres dossiers.
- [ ] Quand l’utilisateur recherche par contact, adresse, référence ou conversation, alors seuls ses résultats autorisés apparaissent, y compris dans les compteurs et aperçus.

#### Dépendances
S13, S05, S35.
#### Hors périmètre
CRM généraliste et fusion destructive irréversible.
#### Complexité
M.
#### Tests attendus
Contact multi-adresses, deux dossiers même contact, fil sans en-têtes, fusion ambiguë, correction et recherche cloisonnée.

### Story S15 — Classer, extraire et rattacher une demande

**En tant que** collaborateur, **je veux** une qualification corrigeable, **afin de** préparer la prochaine action sans perdre le contexte.

**Source PRD :** §4 ; §5 Identification contrôlée ; §6.

#### Critères d’acceptation
- [ ] Quand la fonction est autorisée, alors le message est classé Biens, Sinistres ou À vérifier avec confiance, éléments extraits, informations manquantes, résumé et prochaine action ; chaque donnée dérivée reste corrigeable.
- [ ] Quand le bien est recherché, alors l’ordre est référence exacte, adresse normalisée avec lot/bâtiment/étage, lien contact confirmé, dossier/conversation déjà rattaché, puis candidats approchants.
- [ ] Quand un résultat unique satisfait règles et seuil, alors le rattachement peut être confirmé ; sinon précision ou ACTION_HUMAINE_REQUISE, sans choix arbitraire ni contamination d’autres dossiers.
- [ ] Quand le modèle demande des données, alors il utilise seulement un service limité à l’agence et aux champs nécessaires, jamais SQL ni identifiants d’une base externe ; une instruction malveillante ne change pas ce périmètre.
- [ ] Quand le mandat interdit la fonction, alors aucun traitement IA correspondant n’est préparé et la demande est transférée à un humain.

#### Dépendances
S14, S12, S28.
#### Hors périmètre
Envoi de la prochaine action avant les contrôles S16–S18 ; décision locative exclue.
#### Complexité
M.
#### Tests attendus
Règles de priorité, seuils, ambiguïtés/contradictions, correction, injection dans message et tentative de recherche étrangère.

## 6. Gérer la prise en charge IA ou humaine et les tags

### Story S16 — Acquérir une prise en charge exclusive

**En tant que** collaborateur, **je veux** voir qui traite le dossier, **afin de** ne pas répondre en double.

**Source PRD :** §4 Coordination ; Parcours F.

#### Critères d’acceptation
- [ ] Quand IA et humain acquièrent simultanément une conversation ou un dossier, alors un seul responsable obtient la prise ; l’autre ne peut produire un effet externe concurrent.
- [ ] Quand la prise est affichée, alors responsable, date/heure, statut, prochaine action/échéance et dernière action externe sont visibles sans ouvrir chaque dossier.
- [ ] Quand une prise expire après panne, alors la reprise est possible sans deuxième envoi ; responsable, état et version sont revérifiés avant chaque effet.
- [ ] Quand plusieurs messages du même échange arrivent, alors ils partagent la prise conversation/dossier, pas des responsabilités concurrentes par message.

#### Dépendances
S13, S05, S12.
#### Hors périmètre
Choix d’un moteur de verrouillage ou de queue.
#### Complexité
M.
#### Tests attendus
Course humain/IA et IA/IA, expiration, ancien worker, reprise après envoi au résultat incertain.

### Story S17 — Prendre la main et restituer un dossier

**En tant que** collaborateur autorisé, **je veux** reprendre un dossier, **afin de** arrêter l’autonomie lorsqu’une intervention est nécessaire.

**Source PRD :** §4 Coordination ; §10 ; R01.

#### Critères d’acceptation
- [ ] Quand un standard prend un dossier qui lui est attribué, alors la responsabilité lui est transférée et les tâches IA non exécutées sont invalidées avant tout nouvel effet externe.
- [ ] Quand il tente la même action sur un dossier non attribué, alors elle est refusée côté serveur ; l’habilité reste limité à son périmètre explicite.
- [ ] Quand l’humain libère explicitement la prise, alors la reprise IA exige une nouvelle autorisation ou une règle préalablement configurée et tous les contrôles courants ; libérer ne réactive pas un agent suspendu par ailleurs.
- [ ] Quand un ancien worker tente un envoi après transfert, alors son action obsolète s’arrête sans envoyer ; les actions déjà exécutées restent visibles.

#### Dépendances
S16, S06.
#### Hors périmètre
Réactivation générale par un standard.
#### Complexité
M.
#### Tests attendus
Prise pendant relance, standard sur ses/autres dossiers, libération sous suspension, worker obsolète.

### Story S18 — Synchroniser les tags sans autonomie silencieuse

**En tant que** collaborateur, **je veux** le même état dans l’application et la boîte, **afin de** coordonner mon travail depuis les deux outils.

**Source PRD :** §4 Coordination ; §9 ; Parcours F.

#### Critères d’acceptation
- [ ] Quand l’état change, alors l’application et la boîte présentent le sens correspondant : NOUVEAU/Nouveau, PRIS_EN_CHARGE_IA/IA en cours, PRIS_EN_CHARGE_HUMAIN/Humain en cours, EN_ATTENTE_REPONSE_EXTERNE/En attente, ACTION_HUMAINE_REQUISE/Action humaine requise, TRAITE/Traité, ECHEC_A_REPRENDRE/Erreur ; les tags portent le préfixe `DossierClé/`.
- [ ] Avant la première action autonome externe, quand `DossierClé/IA en cours` n’est pas confirmé dans la boîte d’origine, alors aucun envoi n’a lieu ; une panne ultérieure de synchronisation bloque également l’autonomie et alerte.
- [ ] Quand `DossierClé/Humain en cours` est appliqué dans la boîte, alors l’agent est suspendu et ses tâches en attente invalidées avant sa prochaine action ; si l’auteur est inconnu, l’identité est à confirmer dans DossierClé sans lever le blocage.
- [ ] Quand un écart est réconcilié, alors DossierClé garde l’autorité et la trace des corrections ; un passage lu/non lu ne change jamais le statut métier.

#### Dépendances
S17, S09.
#### Hors périmètre
Contournement des contrôles faute de marqueur fournisseur fiable.
#### Complexité
L.
#### Tests attendus
Gmail/libellés, Microsoft/catégories, IMAP/marqueur vérifié ; panne, retard, auteur inconnu et course tag humain/envoi.

## 7. Traiter les sinistres routiniers

### Story S19 — Qualifier une déclaration et demander les éléments manquants

**En tant que** gestionnaire, **je veux** structurer un sinistre et sa prochaine action, **afin de** réduire les échanges incomplets.

**Source PRD :** §6 ; Parcours C ; Escalades.

#### Critères d’acceptation
- [ ] Quand une déclaration est qualifiée, alors logement/dossier, type, urgence justifiée, spécialité et pièces/informations manquantes sont affichés avec les sources utiles.
- [ ] Quand mandat, confiance et tags permettent l’action, alors la demande d’informations ou l’accusé autorisé part vers le bon déclarant une seule fois ; en mode préparation, S35 précède l’envoi.
- [ ] Quand urgence, identité, rattachement ou règle sont incertains, alors le dossier est escaladé avec contexte, sans promesse de prise en charge ni envoi non autorisé.
- [ ] Quand un collaborateur corrige l’extraction, alors la prochaine action est réévaluée et l’ancienne proposition ne s’exécute plus telle quelle.

#### Dépendances
S15, S18, S35.
#### Hors périmètre
Diagnostic technique certain et promesse d’indemnisation.
#### Complexité
M.
#### Tests attendus
Déclaration complète/incomplète, urgence hors règle, trois modes, mauvaise identité, correction concurrente.

### Story S20 — Suivre les réponses et borner les relances

**En tant que** gestionnaire, **je veux** suivre les échanges du sinistre, **afin de** ne pas relancer à tort.

**Source PRD :** §6 ; §10 ; Parcours C.

#### Critères d’acceptation
- [ ] Quand une réponse, un devis, un rendez-vous ou une information de résolution arrive, alors elle est liée au bon sinistre avec prochaine action et échéance explicites.
- [ ] Quand une relance est due, alors cadence, maximum, horaires, destinataire, prise et mandat sont recontrôlés ; une répétition de tâche ne produit pas un second envoi.
- [ ] Quand une réponse, refus, litige, erreur permanente, doute ou limite survient, alors la relance s’arrête et la suite ou l’escalade prévue est visible.
- [ ] Quand un devis nécessite une décision, alors aucune acceptation/refus ni dépense n’est envoyée sans S35 ; les brouillons ne constituent pas un engagement.

#### Dépendances
S19.
#### Hors périmètre
Paiements, réservation calendrier externe et signature contractuelle automatique.
#### Complexité
M.
#### Tests attendus
Horloge contrôlée, réponse juste avant relance, quota atteint, refus/permanent error, devis protégé.

### Story S21 — Clôturer un sinistre routinier et prouver le parcours complet

**En tant que** gestionnaire, **je veux** terminer les dossiers résolus, **afin de** distinguer le travail restant des dossiers traités.

**Source PRD :** §6 ; Parcours C ; Succès fonctionnel.

#### Critères d’acceptation
- [ ] Quand toutes les conditions de clôture routinière configurées sont satisfaites, alors la clôture autorisée conserve raisons, échanges, responsable et résultat.
- [ ] Quand le dossier est litigieux, contradictoire ou incomplet, alors aucune clôture autonome n’a lieu ; la décision protégée est soumise à S35.
- [ ] Quand le parcours complet est démontré, alors déclaration, complément, sélection déterministe, demande non engageante, réponse/relances et résolution sont liés au même dossier sans perte ni double effet.
- [ ] Quand l’envoi ou la clôture échoue, alors l’état n’est pas annoncé terminé à tort et la reprise reste possible sans répéter un acte externe.

#### Dépendances
S20, S24.
#### Hors périmètre
Clôture automatique des litiges et engagement financier autonome.
#### Complexité
M.
#### Tests attendus
E2E sinistre routinier complet, litige, information manquante, échec final et reprise.

## 8. Rechercher, classer et contacter les artisans

### Story S22 — Maintenir les fiches et statuts des artisans

**En tant que** administrateur, **je veux** maintenir mon annuaire, **afin de** proposer seulement des artisans utilisables.

**Source PRD :** §7 ; §8.

#### Critères d’acceptation
- [ ] Quand une fiche est saisie, alors entreprise, contact, coordonnées, SIRET si disponible, spécialités, zones, disponibilité, urgences, notes et justificatifs/expiration sont conservés dans l’agence.
- [ ] Quand son statut évolue parmi Brouillon, À vérifier, Actif, Suspendu, Archivé, alors l’auteur et la raison sont tracés ; une activation nécessitant vérification exige une confirmation humaine.
- [ ] Quand un doublon probable de SIRET/e-mail/téléphone/nom/adresse est détecté, alors il est signalé sans fusion automatique incertaine.
- [ ] Quand un artisan n’est pas actif ou un justificatif requis est invalide, alors il n’est pas proposé comme compatible ; ses documents restent privés.

#### Dépendances
S05, S35.
#### Hors périmètre
RIB, paiements, invitation V2 et compte artisan permanent.
#### Complexité
M.
#### Tests attendus
Champs et statuts, doublons, expiration, document étranger, activation non vérifiée.

### Story S23 — Importer un annuaire CSV avec contrôle

**En tant que** administrateur, **je veux** importer mon annuaire, **afin de** éviter une ressaisie tout en contrôlant sa qualité.

**Source PRD :** §7 ; Parcours D ; Confirmations obligatoires.

#### Critères d’acceptation
- [ ] Quand un CSV conforme est présenté, alors le format attendu, aperçu, erreurs par ligne et doublons probables sont visibles avant confirmation.
- [ ] Quand les lignes valides sont confirmées, alors elles créent des fiches au statut contrôlé, sans rendre automatiquement actifs des artisans à vérifier.
- [ ] Quand des erreurs ou doublons restent non résolus, alors les lignes concernées ne deviennent pas utilisables sans décision humaine explicite ; le rapport distingue acceptées, rejetées et à vérifier.
- [ ] Quand un fichier malformé, trop volumineux ou à contenu actif est soumis, alors il est rejeté ou neutralisé selon les limites d’Architecture ; le réessai ne duplique pas les fiches déjà acceptées.

#### Dépendances
S22.
#### Hors périmètre
Import Excel artisans non demandé par le PRD.
#### Complexité
M.
#### Tests attendus
CSV valide/malformé, doublons, import partiel puis reprise, contrôle d’activation.

### Story S24 — Classer les artisans et envoyer une demande non engageante

**En tant que** gestionnaire, **je veux** une sélection justifiée, **afin de** contacter un artisan adapté sans engager l’agence automatiquement.

**Source PRD :** §8 ; §6 ; Parcours C.

#### Critères d’acceptation
- [ ] Quand des artisans sont recherchés, alors spécialité, zone, statut actif, disponibilité connue, urgences, justificatifs requis, priorité agence et historique disponible déterminent les résultats ; l’IA explique sans contourner ces règles.
- [ ] Quand plusieurs résultats sont équivalents ou aucun n’est compatible, alors la règle déterministe validée est appliquée ou l’humain est sollicité ; aucun classement arbitraire par le modèle.
- [ ] Quand l’artisan sélectionné est contacté dans le mandat, alors la demande reste non engageante et ne transmet que les données nécessaires ; état actif, justificatifs, droits et tags sont revérifiés avant envoi.
- [ ] Quand l’action devient une affectation/engagement, une acceptation/refus de devis, une dépense ou indemnisation, alors S35 est obligatoire ; un libellé « non engageant » ne suffit pas à contourner le contenu protégé.

#### Dépendances
S19, S22, S23.
#### Hors périmètre
Marketplace et choix contractuel autonome.
#### Complexité
M.
#### Tests attendus
Filtres déterministes, ex aequo, absence de candidat, suspension artisan entre sélection/envoi, contenu engageant.

## 9. Produire les rapports opérationnels

### Story S25 — Configurer destinataires et horaires locaux des rapports

**En tant que** administrateur, **je veux** configurer les destinataires et le fuseau, **afin de** recevoir les synthèses utiles aux bons moments.

**Source PRD :** §11 ; §10 Communications.

#### Critères d’acceptation
- [ ] Quand les rapports sont autorisés, alors trois rendez-vous sont programmés lundi–vendredi à 8h45, 13h30 et 16h00 dans le fuseau agence ; aucun quatrième rapport à midi.
- [ ] Quand un destinataire est défini, alors son rôle/périmètre est explicite et son contenu est limité à ses droits ; une adresse ajoutée sans autorisation ne reçoit rien.
- [ ] Quand le fuseau ou l’heure d’été change, alors aucune occurrence attendue n’est oubliée ni envoyée deux fois.
- [ ] Quand le mandat Communications interdit ou suspend les rapports, alors aucun rapport autonome n’est envoyé ; l’occurrence empêchée reste explicite, sans rattrapage automatique contraire à S12.

#### Dépendances
S12, S05.
#### Hors périmètre
Calendrier de jours fériés, horaires supplémentaires et décisions implicites sur les jours non ouvrés ; PRD = lundi–vendredi.
#### Complexité
M.
#### Tests attendus
Fuseau valide/invalide, DST, vendredi/lundi, suspension à l’échéance, destinataire révoqué.

### Story S26 — Générer les trois synthèses avec les bonnes périodes

**En tant que** collaborateur, **je veux** une synthèse des actions et blocages, **afin de** prioriser ma journée.

**Source PRD :** §11 Rapports.

#### Critères d’acceptation
- [ ] À 8h45, quand le rapport est généré, alors il couvre le dernier jour ouvré (vendredi pour le lundi), restes ouverts, urgences, échéances et tâches du jour.
- [ ] À 13h30, alors les actions depuis 8h45, blocages du matin et priorités de l’après-midi sont distingués ; à 16h00, alors bilan du jour, relances, tâches restantes et report au prochain jour ouvré sont distingués.
- [ ] Quand aucune activité n’existe, alors un rapport « aucune activité » est produit ; les tâches courantes restent évaluées sans inventer d’action.
- [ ] Quand un rapport est généré pour un destinataire, alors texte, objet, liens et éventuelles pièces sont minimisés et filtrés à ses droits ; aucune information étrangère n’apparaît.

#### Dépendances
S25, S21.
#### Hors périmètre
Promesse d’une règle particulière pour les actions du week-end : leur synthèse historique doit être précisée en Design, sans masquer les tâches encore ouvertes le lundi.
#### Complexité
M.
#### Tests attendus
Horloges figées aux trois horaires, lundi/vendredi, aucun événement, tâches toujours ouvertes et deux destinataires de droits différents.

### Story S27 — Envoyer, archiver et reprendre un rapport en échec

**En tant que** collaborateur, **je veux** retrouver mes rapports et leur livraison, **afin de** ne pas perdre une synthèse en cas d’erreur.

**Source PRD :** §11 ; Succès fonctionnel.

#### Critères d’acceptation
- [ ] Quand un rapport est traité, alors ses états Programmé, Généré, Envoyé, Échec ou Relancé sont visibles et une copie privée est consultable dans DossierClé.
- [ ] Quand deux déclenchements concernent même agence/type/date locale couverte, alors un seul rapport logique existe et chaque destinataire ne reçoit pas deux fois le même rapport.
- [ ] Quand l’envoi échoue, alors une relance autorisée réutilise le rapport sans régénération ; un résultat fournisseur incertain est réconcilié avant renvoi.
- [ ] Quand les droits du destinataire changent après génération, alors l’ancien contenu plus permissif n’est pas envoyé ; il est bloqué pour intervention, pas régénéré et renvoyé silencieusement.

#### Dépendances
S26, S18.
#### Hors périmètre
Accès public par lien d’archive.
#### Complexité
M.
#### Tests attendus
Double déclenchement, échec partiel multi-destinataires, délai fournisseur, révocation après génération, archive interdite.

## 10. Traiter les demandes de location et organiser les visites

### Story S28 — Maintenir le catalogue minimal des biens

**En tant que** administrateur, **je veux** saisir et corriger les biens, **afin de** rattacher les demandes à un logement identifiable.

**Source PRD :** §5 Catalogue ; Identification ; §6 logement du sinistre.

#### Critères d’acceptation
- [ ] Quand un bien est créé, alors référence stable dans l’agence, adresse normalisée, bâtiment/étage/lot disponibles, statut Location utile, source et date de mise à jour sont enregistrés.
- [ ] Quand une référence est dupliquée ou des données obligatoires manquent, alors la création est refusée ou soumise à résolution explicite sans écrasement silencieux.
- [ ] Quand les liens avec contacts ou dossiers sont corrigés, alors ils restent distincts de la fiche et leur historique est conservé.
- [ ] Quand le service de recherche est appelé, alors il retourne seulement les biens et champs nécessaires de l’agence autorisée ; aucune connexion SQL du modèle n’est possible.

#### Dépendances
S05.
#### Hors périmètre
Parcours Location complet. Ce prérequis commun est réalisé avant S15 et les Sinistres.
#### Complexité
M.
#### Tests attendus
Saisie/correction, référence unique par agence, homonymes d’adresse/lot, recherche cloisonnée.

### Story S29 — Alimenter le catalogue par CSV et Excel

**En tant que** administrateur, **je veux** importer mes biens, **afin de** disposer de données à jour sans ressaisie.

**Source PRD :** §5 Catalogue ; Succès fonctionnel.

#### Critères d’acceptation
- [ ] Pour `.csv` et `.xlsx`, quand un fichier valide est soumis, alors mapping des colonnes, aperçu des changements, champs obligatoires, erreurs par ligne et doublons sont présentés avant confirmation.
- [ ] Quand la même source est réimportée, alors aucun bien supplémentaire n’est créé ; une ligne absente ne provoque jamais de suppression silencieuse.
- [ ] Quand un fichier est chiffré/protégé, invalide ou dépasse les limites d’Architecture, alors il est rejeté ; macros, formules, liens externes et contenu actif ne sont jamais exécutés.
- [ ] Quand des lignes sont acceptées, alors source/date/référence restent traçables et une reprise après échec ne double pas les changements déjà appliqués.

#### Dépendances
S28.
#### Hors périmètre
Autres formats, connexion directe à une base de logiciel immobilier.
#### Complexité
M.
#### Tests attendus
Deux formats, mapping, formule/lien externe, fichier protégé, réimport identique, suppression implicite interdite, échec partiel.

### Story S30 — Répondre aux demandes de location et suivre les visites

**En tant que** collaborateur, **je veux** faire avancer une demande de location, **afin de** proposer une prochaine étape utile au contact.

**Source PRD :** §5 ; Parcours B ; Fonctions Location exclues.

#### Critères d’acceptation
- [ ] Quand une demande est qualifiée, alors critères exprimés, bien identifié ou à identifier, disponibilité vérifiée ou à faire vérifier et informations manquantes sont visibles.
- [ ] Quand des biens similaires sont proposés, alors les propositions se fondent sur les critères du contact et des données disponibles, sans noter ni comparer des candidats ; une disponibilité inconnue n’est pas affirmée.
- [ ] Quand une visite est proposée ou suivie, alors participants, bien, proposition et réponse sont enregistrés ; aucun créneau n’est présenté comme confirmé sans confirmation effective.
- [ ] Quand une réponse courante est envoyée, alors le mode du mandat et les contrôles externes s’appliquent ; une demande de solvabilité, sélection, refus ou bail est transférée sans préparation de cette fonction.
- [ ] Quand Sinistres n’a pas passé son parcours E2E S21, alors cette story ne passe pas en livraison du workflow Location.

#### Dépendances
S21, S15, S18, S29, S35.
#### Hors périmètre
Synchronisation de calendrier, réservation automatique, annonce immobilière, décision sur la candidature et bail.
#### Complexité
M.
#### Tests attendus
Disponibilité connue/inconnue, demande sans référence, biens similaires, échanges de visite, trois modes et exclusions locatives.

## 11. Collecter et contrôler la complétude des dossiers locatifs

### Story S31 — Envoyer la liste autorisée et collecter les pièces en privé

**En tant que** collaborateur, **je veux** collecter les pièces attendues à l’étape concernée, **afin de** constituer le dossier sans collecte excessive.

**Source PRD :** §5 ; Sécurité ; Données sensibles.

#### Critères d’acceptation
- [ ] Quand la liste de pièces est demandée, alors seule la liste autorisée pour l’étape est utilisée, selon le mode courant ; aucune pièce financière supplémentaire n’est exigée pour évaluer une solvabilité hors scope.
- [ ] Quand un document est déposé ou reçu, alors il est lié au bon dossier dans un espace privé, avec état de réception/contrôle et droits vérifiés avant consultation.
- [ ] Quand un lien temporaire est utilisé, alors il est non prédictible et révocable ; expiration, révocation, autre dossier ou autre agence entraînent un refus sans exposition.
- [ ] Quand une pièce est invalide, suspecte ou dépasse les limites, alors elle n’est pas ouverte/exécutée/transmise à l’IA sans contrôle ; le demandeur voit une erreur utile et aucune réception réussie fictive.

#### Dépendances
S30.
#### Hors périmètre
Liste juridique définitive et durées de conservation non arbitrées ; à valider avant données réelles, pas inventées ici.
#### Complexité
M.
#### Tests attendus
Dépôt privé nominal, liens expirés/révoqués, fichier hostile, mauvais dossier, collecte limitée à l’étape.

### Story S32 — Contrôler la complétude documentaire objective

**En tant que** collaborateur, **je veux** connaître les pièces manquantes ou à revoir, **afin de** corriger le dossier sans automatiser un choix locatif.

**Source PRD :** §5 contrôle documentaire ; Fonctions Location exclues.

#### Critères d’acceptation
- [ ] Quand les pièces sont contrôlées, alors chaque constat porte uniquement sur présence, lisibilité, date de validité apparente et cohérence d’identité entre pièces, avec éléments observables.
- [ ] Quand une pièce manque, est expirée, illisible ou incohérente, alors elle est signalée précisément ; une incertitude reste à vérifier et n’est pas présentée comme une fraude.
- [ ] Quand une pièce est remplacée ou le constat corrigé, alors la complétude est recalculée et la correction historisée sans écraser silencieusement la précédente conclusion.
- [ ] Quand une demande ou un contenu tente d’obtenir authenticité, revenu suffisant, score, classement ou éligibilité, alors aucun résultat correspondant n’est produit, même en brouillon.

#### Dépendances
S31.
#### Hors périmètre
Authentification des pièces, appréciation financière et comparaison des candidats.
#### Complexité
M.
#### Tests attendus
Chaque type d’anomalie, identité contradictoire, remplacement, faux positif corrigé, interdictions locatives.

### Story S33 — Relancer les pièces manquantes et transmettre le dossier complet

**En tant que** collaborateur, **je veux** recevoir un dossier documentaire complet, **afin de** poursuivre moi-même les décisions locatives hors agent.

**Source PRD :** §5 ; §10 relances ; Succès fonctionnel.

#### Critères d’acceptation
- [ ] Quand des pièces autorisées manquent, alors la relance mentionne uniquement les manques courants et respecte cadence, maximum, horaires, destinataires, mandat et prise en charge.
- [ ] Quand une réponse, refus, erreur permanente, limite, doute ou suspension survient, alors les relances concernées cessent et la suite humaine est visible.
- [ ] Quand tous les éléments documentaires attendus sont présents et contrôlés, alors le dossier est transmis au collaborateur attribué pour validation de complétude, jamais annoncé « candidat accepté ».
- [ ] Quand le contenu change après la transmission, alors le constat de complétude précédent est marqué obsolète et ne vaut pas validation des nouvelles pièces ; aucun bail ni décision de candidature n’est préparé.

#### Dépendances
S32, S35.
#### Hors périmètre
Attribution de logement, acceptation/refus et préparation du bail.
#### Complexité
M.
#### Tests attendus
Pièce arrivée juste avant relance, arrêt, maximum atteint, dossier complet puis pièce remplacée, transmission à la mauvaise personne.

## 12. Consulter les décisions, validations et journaux d’audit

### Story S34 — Superviser les dossiers et reprendre les échecs

**En tant que** collaborateur, **je veux** une file opérationnelle lisible, **afin de** repérer ce qui attend mon intervention.

**Source PRD :** §9 ; Parcours E/F.

#### Critères d’acceptation
- [ ] Quand la file est ouverte, alors messages/dossiers en attente, en cours, traités et en erreur sont filtrables par responsable et statut ; boîte, contact, dossier et prochaine action sont identifiables.
- [ ] Quand une connexion expire, un tag échoue ou un traitement épuise ses reprises, alors l’alerte conduit à une cause exploitable et à une action autorisée, sans secret affiché.
- [ ] Quand une tâche est relancée, alors mandat, droits et état sont recontrôlés et les effets déjà réalisés ne sont pas répétés ; une tâche invalidée par suspension ne devient pas relançable via ce raccourci.
- [ ] Quand un standard consulte les compteurs ou recherches, alors seuls ses dossiers attribués y figurent ; les files non attribuées restent à l’administrateur.

#### Dépendances
S18, S15, S35.
#### Hors périmètre
Dashboard technique d’administration des serveurs.
#### Complexité
M.
#### Tests attendus
Filtres, erreurs persistantes, relance répétée, tâche révoquée, compteurs cloisonnés.

### Story S35 — Examiner et décider une validation humaine

**En tant que** humain autorisé et destinataire d’une validation, **je veux** comprendre puis autoriser ou rejeter une action précise, **afin de** garder la maîtrise des engagements.

**Source PRD :** §9 ; §10 ; Confirmations obligatoires ; Politique sortante.

#### Critères d’acceptation
- [ ] Quand une validation est présentée, alors contexte, données nécessaires, règle, mandat/version, proposition exacte, destinataire, conséquences et motif d’escalade sont lisibles ; valider/rejeter et demander une correction sont distincts.
- [ ] Quand un habilité ou administrateur décide, alors seule l’action explicitement attribuée et toujours autorisée est concernée ; standard, autre humain, autre agence et identité révoquée sont refusés.
- [ ] Quand contenu, destinataire, état, droits ou mandat changent, alors l’ancienne validation ne vaut plus autorisation ; un double clic ou une course ne produit qu’une décision et au plus un effet externe.
- [ ] Quand une action protégée est demandée (engagement/affectation artisan, devis, dépense, indemnisation, litige, fusion ambiguë, activation à vérifier, import non résolu), alors elle ne s’exécute pas sans confirmation humaine explicite et tracée ; le rejet n’envoie rien.
- [ ] Quand une fonction Location exclue est demandée, alors aucune validation ne sert de contournement : aucune proposition d’acceptation/refus, score ou bail n’est préparée.

#### Dépendances
S05, S06, S12.
#### Hors périmètre
Cette story livre la décision et son autorisation à usage unique, pas un nouvel exécuteur métier. Chaque story consommatrice assure prise, tags et idempotence avant son effet ; aucune exécution externe autonome dans S35 seule.
#### Complexité
M.
#### Tests attendus
Décision acceptée/rejetée/corrigée, attribution falsifiée, version obsolète, double décision, droits retirés et toutes familles protégées.

### Story S36 — Consulter l’historique métier et les changements de mandat

**En tant que** collaborateur autorisé, **je veux** retrouver les décisions et leurs raisons, **afin de** comprendre et contrôler ce qui a été fait.

**Source PRD :** §1, §9–10 ; Données sensibles ; Principes produit.

#### Critères d’acceptation
- [ ] Quand l’historique d’un dossier autorisé est consulté, alors décisions IA/humaines, sources utiles, règle, mandat/version, dates, messages envoyés, résultats, corrections et validations sont reliés chronologiquement.
- [ ] Quand l’administrateur consulte le mandat, alors chaque changement affiche version, auteur, date et avant/après ; un habilité ou standard ne peut lire l’historique général réservé à l’administrateur.
- [ ] Quand un utilisateur filtre les événements, alors les contrôles de droits s’appliquent aussi aux exports et liens ; aucun secret ni contenu personnel inutile n’est exposé.
- [ ] Quand une trace doit être corrigée, alors l’événement initial n’est pas réécrit silencieusement ; une correction liée est ajoutée selon les règles de conservation et de droits validées avant pilote.

#### Dépendances
S34, S27, S33.
#### Hors périmètre
Une création tardive des journaux : l’écriture minimale est obligatoire dès S01 via R04. Ne remplace pas la politique de rétention.
#### Complexité
M.
#### Tests attendus
Historique synthétique de bout en bout, ancienne version, droits croisés, redaction des secrets, correction tracée.

## Extension optionnelle V1 — Connecteur API du catalogue

### Story S37 — Lire un catalogue depuis une API validée

**En tant que** administrateur, **je veux** activer un connecteur compatible, **afin de** éviter les imports manuels lorsqu’une API exploitable existe.

**Source PRD :** §5 Catalogue/API optionnelle ; Techniques.

#### Critères d’acceptation
- [ ] Quand une API documentée est validée en Architecture et activée explicitement par l’agence, alors le connecteur respecte authentification, droits de lecture minimaux, identifiants stables, champs nécessaires, pagination et limites fournisseur.
- [ ] Quand une synchronisation est répétée ou reprise après erreur, alors elle ne crée aucun doublon ; l’absence d’un bien dans la réponse ne le supprime pas silencieusement.
- [ ] Quand l’API est indisponible, non compatible ou révoquée, alors l’état et l’erreur sont visibles sans secret ; saisie manuelle et imports restent utilisables.
- [ ] Quand le modèle sollicite une recherche, alors il ne reçoit aucun identifiant fournisseur/base ni accès direct SQL ; les données restent limitées à l’agence courante.

#### Dépendances
S28, S29.
#### Hors périmètre
Connecteur universel ou fournisseur imposé. BACKLOG conditionnel : aucun connecteur non validé ne doit être annoncé livré. Ne bloque pas la V1 par saisie/import.
#### Complexité
M par connecteur validé.
#### Tests attendus
Pagination, quotas, reprise, révocation, identifiants stables, disparition d’une ligne et isolation.

## Dependency map et ordre de réalisation

Les rubriques Dépendances de chaque story sont la source du graphe. Les dépendances techniques internes sont précisées en Architecture, sans supprimer les prérequis fonctionnels. Chaque story se teste avec fixtures de ses prérequis ; elle n’exige pas d’attendre toutes les stories ultérieures pour démontrer son résultat.

Ordre topologique proposé, sans parallélisme avant Architecture et Design System PASS :

```text
Socle : S01 → S02 → S04 → S05 → S06
Connexions : S07, S08 → S09
Mandat : S10 → S11 → S12
Validation minimale : S35
Catalogue minimal : S28
Entrée : S13 → S14 → S15
Coordination : S16 → S17 → S18
Artisans : S22 → S23
Sinistres : S19 → S20 → S24 → S21
Supervision : S34
Rapports : S25 → S26 → S27
Location : S29 → S30 → S31 → S32 → S33
Consultation consolidée : S36
Récupération : S03 après S02, puis vérification complète avant pilote
Option catalogue API : S37 après S29, seulement si connecteur validé
```

Les flèches de cette vue sont un ordre de lecture par vague, non la totalité des arêtes ; les rubriques Dépendances donnent toutes les arêtes. S35 est placé tôt parce que ses consommateurs ne peuvent pas attendre le groupe 12. S28 sert aux deux workflows et précède S15. S24 est nécessaire à S21 : la validation Sinistres de bout en bout ne précède pas les artisans. Les rapports seront revalidés après Location pour couvrir les deux modules. S03 est répétée sur le modèle V1 final : une preuve sur un espace vide ne suffit pas.

## Gates non fonctionnels et préparation du pilote

Ces gates sont des obligations de livraison et de preuve, pas des stories techniques présentées comme réalisées. Leur propriétaire est indiqué ; l’Architecture doit affecter chaque contrôle à un composant et chaque Plan doit reprendre les contrôles pertinents. Ils bloquent le pilote réel tant que la preuve manque.

| Gate | Source PRD | Stories porteuses | Preuve attendue / responsable |
|---|---|---|---|
| G01 Isolation et accès | Sécurité, Données sensibles | S01–S06, S13, S28, S31, S36 | QA/Sécurité : deux agences, refus sur API, fichiers, recherches, jobs, archives, exports et accès support ; zéro fuite, même après remplacement d’identifiants. |
| G02 Secrets, fichiers et contenu non fiable | Sécurité, Risques | S07–S09, S13, S23, S29, S31 | Sécurité : TLS, secrets hors clair métier/logs, stockage privé, liens temporaires révocables, limites de taille/type, contenus actifs non exécutés, commandes reçues non assimilées à des droits. |
| G03 Intégrité et reprise | Principes, Parcours E/F | S03, S09, S12–S18, S20, S27, S34–S35 | QA : interruptions aux frontières d’envoi/validation, doublons, événements désordonnés et concurrence ; aucune perte acceptée ni double effet ; échec visible après reprises bornées. |
| G04 Sauvegarde/restauration | Succès fonctionnel, Questions ouvertes | S03, S36 | Exploitation/QA : sauvegarde et restauration d’une agence V1 complète, intégrité des liens/documents et non-rejeu des sorties ; objectifs de reprise décidés en Architecture et mesurés. |
| G05 Charge reproductible | Charge, fiabilité et performance | Toutes ; parcours S13–S21, S28–S36 | QA : protocole exact ci-dessous, résultats bruts, versions et hashes ; aucun PASS sur une charge simplifiée non comparable. |
| G06 Coûts et opérations | Budget et opérations | S01, S09, S11, S34 | Exploitation : limites/alertes de coût avant pilote, suivi par agence active, quota/panne fournisseur visibles ; coût de stockage/sauvegarde/observabilité inclus, pas de serveur réservé systématique à une agence inactive. |
| G07 Données réelles et droits | Légales et conformité, Données sensibles, Questions ouvertes | S03, S31–S33, S36 | Responsable pilote/conseil : finalités, données utilisables, durées, information, sous-traitants/flux, rétention/suppression/export et droits formalisés ; aucune promesse de conformité déduite du PASS produit. L’audit juridique additionnel différé n’est pas intégré ou réputé validé ici. |
| G08 Succès du pilote | Succès utilisateur/commercial, GO/PIVOT/KILL | S21, S30, S33, S34, S36 | Responsable pilote : protocole préalable avec source/période/échantillon/référence/cible/seuil/responsable ; suivi des gains, erreurs, adoption, volonté de payer et coûts ; seuils PRD inchangés. |

### G05 — Protocole de charge à conserver exactement

- Sessions utilisateur authentifiées, pas connexions DB ni boîtes. Cinq scénarios : 1 dans une agence ; 50 dans une agence ; 50 à parts égales dans 5 agences ; 200 dans une agence ; 200 à parts égales dans 10 agences.
- Par agence : 200 utilisateurs authentifiables, 5 boîtes + 5 alias, 5 000 contacts, 10 000 conversations, 50 000 messages dont 10 % avec pièce référencée, 2 000 dossiers dont exactement 1 000 Sinistres et 1 000 Biens, 500 artisans.
- Données synthétiques ; graine `dossiercle-load-v1-20260928` ; générateur `tests/performance/generate-load-fixtures` et export `tests/performance/fixtures/load-v1`. Verify enregistre le commit du générateur et le SHA-256 de l’export. Ces chemins sont des livrables futurs, inexistants à cette phase documentaire.
- Catalogue : 15 % page de 50 messages ; 15 % page de 50 dossiers (tous deux plus récents d’abord) ; 20 % conversation de 20 messages et métadonnées pièces ; 7 % recherche e-mail exact ; 7 % recherche référence conversation ; 6 % référence dossier ; 10 % transition valide ; 10 % note interne de 200 caractères ; 5 % classification asynchrone ; 5 % préparation asynchrone d’un brouillon pour message classifié.
- Attente pseudo-aléatoire déterministe 1–3 secondes entre actions ; montée linéaire 2 minutes, maintien 10 minutes, résorption de queue au plus 5 minutes ; conserver cadence, graine, volumes et résultats bruts.
- Pour chaque scénario : aucune HTTP 500 applicative, aucune perte acceptée, aucun double effet, aucune fuite ; 95 % des actions interactives ordinaires en moins de 2 secondes ; tâches longues acceptées en moins de 2 secondes, suivies en arrière-plan ; échec persistant visible et récupérable. Réveil à froid mesuré et publié séparément.

### G08 — Conditions de pilote, sans nouveau seuil inventé

Avant activation, le responsable pilote fixe agence/décideur, données utilisables, canaux de support, procédure d’incident et révocation boîte, prix/quotas/dépassements et mesure manuelle de référence. Il définit les mesures de délai première réponse, demandes oubliées, recherche d’historique, qualification sinistre, recherche artisan, corrections, satisfaction et volonté de payer.

Référence : quatre semaines après onboarding/référence. Pour GO ou PIVOT : zéro fuite, perte ou sortie hors mandat/relance après arrêt ; restauration démontrée ; cinq scénarios charge conformes ; aucun Critical/Major sécurité. GO : au moins deux collaborateurs, trois jours distincts par semaine sur chaque semaine ; réduction médiane d’au moins 25 % pour chacun des deux workflows ; au moins 70 % d’actions routinières sans correction/annulation/reprise ; au plus 10 % de messages corrigés en classification/rattachement ; intention écrite de poursuivre avec offre payante présentée. PIVOT si un seul workflow satisfait usage et gain, avec toutes les préconditions. KILL si une précondition sécurité/intégrité reste en échec après correction, ou si aucun workflow n’atteint le gain de 25 % après amélioration et sans intention payante. Aucun ajustement a posteriori des seuils.

## Matrice de couverture du PRD

| Capacité / section PRD | Couverture Stories / gates |
|---|---|
| Vision, problème, utilisateurs, jobs, valeur | S01–S37 ; R01 ; G08 |
| Principes obligatoires et ordre V1 | R02–R05 ; S21 avant S30 ; G01–G04 |
| §1 Espace agence | S01–S06 ; R04 ; G01/G04 |
| §2 Multiboîtes et alias | S07–S09, S13 ; G02/G03 |
| §3 Contacts, conversations, recherche/corrections | S14–S15, S34 ; S35 pour ambiguïté |
| §4 Traitement commun | S13–S20, S34–S35 |
| §4 Coordination et tags | S16–S18 ; R02/R04 ; G03 |
| §5 Catalogue manuel/CSV/XLSX/API | S28–S29, S37 optionnelle ; G02 |
| §5 Identification contrôlée | S15, S28 ; R02/R03 |
| §5 Location, disponibilité, biens similaires, visites | S30 |
| §5 Dossiers locatifs, complétude, collecte/relances | S31–S33 ; R03 ; G07 |
| §6 Sinistres | S19–S21, S24, S35 |
| §7 Annuaire et CSV | S22–S23 ; G02 |
| §8 Proposition artisans déterministe | S24 |
| §9 Supervision, erreurs et validations | S09, S18, S34–S36 |
| §10 Mandat/formulaire, versions/révocation | S10–S12 ; R01–R04 ; S35–S36 |
| §11 Rapports | S25–S27 ; revalidation après S33 |
| Parcours A/B/C/D/E/F | A : S01/S07–S09 ; B : S13–S15/S30–S33 ; C : S19–S24/S35 ; D : S22–S23 ; E : S09/S13/S34 ; F : S16–S18 |
| Capacités principales | Correspondance §§1–11 ci-dessus ; G01–G06 |
| Contraintes métier/légales/sécurité/techniques/charge/budget | R01–R05 ; G01–G08 ; registre Architecture ci-dessous |
| Données sensibles et autonomie/escalade/confirmation/sortants | R02–R04 ; S12, S18–S24, S31–S36 ; G02/G07 |
| Succès fonctionnel/utilisateur/commercial | Scénarios S21/S30/S33 ; G01–G08 |
| Risques et hypothèses à tester | G01–G08 ; validations fournisseurs S07–S09/S37 ; pilote G08 |
| Questions ouvertes | Registre suivant, à résoudre au gate concerné |
| Scope V2/version ultérieure/non-scope | Exclus : invitation/portail artisan, RIB/paiement, CRM généraliste, signature, comptabilité, application native, n8n, infrastructure dédiée systématique et entraînement sans décision applicable ; R03 pour exclusions Location |
| Décisions enregistrées et PRD Gate | Sources conservées ; aucune décision technique nouvelle dans ce document |

## Décisions reportées au bon gate

Avant Architecture PASS : authentification ; mécanisme concret des rôles/permissions R01 ; queue/jobs ; framework TypeScript ; DB distincte par agence, accès/migrations compatibles serverless ; coffre ; fournisseur IA/région/minimisation ; stockage/sauvegarde/export/RPO-RTO/disponibilité ; ordre Gmail/Microsoft/IMAP et preuve de leurs capacités ; limites boîtes/utilisateurs/stockage et taille des imports ; outillage des tests. Contraintes déjà arrêtées : TypeScript sans n8n, Scaleway Paris, managé/serverless à l’usage. Ne pas remplacer ces contraintes silencieusement.

Avant le Design/Plan concerné : valeurs des limites et règles métier configurables, correspondance capacités tags des fournisseurs, règle déterministe des ex aequo artisans, formats d’import et états détaillés. Les jours fériés ne constituent pas un calendrier produit supplémentaire dans la V1 actuelle ; la fenêtre historique des événements de week-end est à expliciter pour S26 sans perdre la visibilité des dossiers ouverts. Ces détails ne rendent aucune story Ready for Execute aujourd’hui.

Avant pilote réel : décisions et preuves G01–G08, rétention/droits/information et fournisseurs validés. Le cadrage juridique différé reste ouvert ; ni Stories PASS ni Story Review PASS ne vaut autorisation d’ingérer des données réelles.

## Stories Gate

- [x] Les 12 groupes demandés sont présents ; le connecteur API optionnel est isolé et relié au groupe catalogue.
- [x] Chaque story a un résultat fonctionnel, des critères observables, des refus, des dépendances, une complexité, une source et des tests attendus.
- [x] Matrice des trois rôles, suspensions et limites de reprise explicites.
- [x] Couverture PRD et gates non fonctionnels identifiés ; aucune fonctionnalité Location exclue réintroduite.
- [x] Ordre éditorial distingué du graphe de réalisation ; audit et validation ne sont pas reportés après les actes sensibles.
- [x] Aucune implémentation, Architecture ou validation applicative prétendue réalisée.

**Verdict de rédaction : PASS — à soumettre à la Story Review indépendante.**
