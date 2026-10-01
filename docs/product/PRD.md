# PRD — DossierClé

## Status

`PRD: PASS`

- **Nom de travail :** DossierClé
- **Mode projet :** LARGE
- **Dernière mise à jour :** 2026-09-29
- **Source :** décisions de cadrage validées avec le porteur du projet
- **Décision de cadrage :** agence mixte, Sinistres d’abord puis Biens, agent IA autonome sur les tâches autorisées, périmètre fonctionnel délimité par l’agence depuis un formulaire simple et validation humaine réservée aux engagements, exceptions et cas sensibles

## Vision

Permettre à une agence immobilière de transformer ses e-mails entrants en dossiers suivis, structurés et actionnables, sans perdre le contrôle humain sur les décisions sensibles.

## Problème

Les demandes reçues par une agence immobilière sont réparties entre plusieurs boîtes e-mail et collaborateurs. Un même contact peut écrire depuis plusieurs adresses, répondre dans plusieurs fils ou contacter différents services de l’agence.

Cette fragmentation entraîne notamment :

- des demandes oubliées ou traitées en retard ;
- des doublons et des réponses incohérentes ;
- une difficulté à retrouver l’historique complet d’un dossier ;
- des informations importantes enfermées dans les messages et pièces jointes ;
- un suivi manuel des demandes liées aux biens ;
- un suivi manuel des sinistres, artisans, devis et relances ;
- un manque de visibilité pour le responsable d’agence ;
- un risque d’action inadaptée si un agent agit hors des règles, limites ou autorisations définies par l’agence.

DossierClé doit centraliser ces flux, les rattacher aux bons contacts et dossiers, puis les traiter de façon autonome lorsque les tâches et limites ont été définies par l’agence, sans devenir un logiciel immobilier généraliste.

## Utilisateurs

### Principal

Le persona principal est le collaborateur opérationnel d’une **agence mixte** qui traite à la fois :

- les demandes de location liées aux biens ;
- les sinistres de gestion locative et la coordination des artisans.

La V1 contient les deux workflows. Le workflow Sinistres est construit et validé en premier, puis le workflow Biens est ajouté dans la même V1. L’utilisateur consulte les messages, qualifie la demande, prépare une réponse et suit le dossier jusqu’à sa prochaine étape.

### Secondaires

- responsable ou administrateur de l’agence ;
- autres collaborateurs autorisés de l’agence ;
- prospects, clients, propriétaires, locataires et occupants écrivant à l’agence ;
- artisans référencés par l’agence ;
- administrateur de la plateforme DossierClé, limité aux opérations techniques autorisées.

### Hors cible directe en V1

- particuliers gérant seuls leurs biens ;
- réseaux immobiliers nécessitant immédiatement une gouvernance multi-filiales complexe ;
- artisans utilisant un portail permanent ;
- prestataires externes ayant un accès direct à toutes les données de l’agence.

## Jobs / besoins

L’agence doit pouvoir :

- créer son espace isolé sans gérer de serveur ;
- connecter plusieurs boîtes e-mail réelles et déclarer leurs alias ;
- choisir la destination fonctionnelle de chaque boîte ou laisser le système classifier la demande ;
- voir l’état de connexion et de synchronisation de chaque boîte ;
- recevoir chaque message une seule fois, même lorsqu’il cible plusieurs adresses surveillées ;
- retrouver un contact malgré plusieurs adresses e-mail ;
- conserver des conversations distinctes lorsque les dossiers sont différents ;
- rattacher un message à un bien, une demande ou un sinistre ;
- identifier les informations manquantes ;
- préparer une réponse cohérente avec l’historique ;
- suivre les prochaines actions, délais et relances ;
- savoir immédiatement si une demande est traitée par l’agent IA, par un collaborateur ou attend une action ;
- recevoir aux moments clés de la journée une synthèse des actions réalisées, des tâches restantes et des blocages ;
- constituer et maintenir son propre annuaire d’artisans ;
- obtenir une liste d’artisans compatibles avec un sinistre ;
- valider toute action qui engage l’agence, un artisan ou une dépense ;
- comprendre ce que le système a fait, pourquoi et à partir de quelles données ;
- corriger une classification ou un rattachement erroné ;
- retrouver une erreur de traitement sans perdre le message original.

## Proposition de valeur

DossierClé transforme les boîtes e-mail de l’agence en un espace de travail structuré :

- **une entrée unifiée** pour plusieurs adresses e-mail ;
- **un historique exploitable** par contact, conversation et dossier ;
- **deux parcours métier guidés** pour les Biens et les Sinistres ;
- **un agent IA opérationnel** capable d’extraire, classer, décider et exécuter les tâches autorisées ;
- **des règles déterministes** pour les décisions métier contrôlables ;
- **une escalade humaine** pour les engagements, ambiguïtés, exceptions et cas sensibles ;
- **une isolation forte** entre les agences ;
- **une infrastructure à l’usage**, sans administration de CPU, RAM ou serveurs par les agences.

## Principes produit obligatoires

1. **L’e-mail original reste la source reçue.** Toute extraction ou classification doit être corrigeable.
2. **L’IA décide et agit dans le mandat défini par l’agence.** Elle escalade toute action hors mandat, ambiguë ou engageante.
3. **Les règles métier déterministes priment sur une réponse générative.**
4. **Chaque action externe est traçable.**
5. **Une agence ne peut jamais accéder aux données d’une autre agence.**
6. **Un échec de traitement ne doit pas provoquer la perte du message.**
7. **Les agences ne gèrent pas l’infrastructure technique.**
8. **Le produit reste spécialisé dans le traitement des demandes et dossiers issus des communications.**
9. **L’autonomie est bornée et révocable.** L’agence peut suspendre l’agent globalement, par boîte, par module ou par dossier.
10. **L’agence délimite les fonctions de l’agent.** Pour chaque tâche configurable, elle choisit si l’agent agit seul, prépare une action pour validation ou ne réalise pas la tâche ; les limites de sécurité non modifiables restent prioritaires.

### Portée catastrophe de l’invariant de non-perte — 2026-10-01

Amendement utilisateur [D58](ARCHITECTURE_DECISIONS.md#d58), issue #30 : « Oui, perte de données et remise en service : chacune sous 4 heures ». Pour catastrophe/incident majeur seulement, la perte de données tolérée est strictement inférieure à 4 heures (**RPO < 4 heures**) et le service doit redevenir effectivement utilisable en moins de 4 heures depuis l’incident (**RTO < 4 heures**). Les formulations de non-perte du présent PRD s’entendent avec cette seule exception explicite ; elles restent entières en fonctionnement normal, retries et tests de charge. Aucune perte silencieuse normale, aucun doublon ou rétablissement de droits révoqués n’est autorisé. Les pertes/écarts de catastrophe doivent être signalés et la reprise cohérente bases/fichiers/jobs prouvée. Rétention des sauvegardes 30 jours selon D41 inchangée. Objectifs à vérifier, sans fournisseur choisi ni preuve PRA acquise. Le PASS historique et Story Review ne valident pas cet amendement ; revue indépendante requise.

## Scope V1

### Ordre de livraison V1

1. Le socle commun et le workflow Sinistres sont construits et validés en premier.
2. Le workflow Biens est ensuite construit et validé sur le même socle.
3. La V1 n’est complète que lorsque les deux workflows satisfont leurs critères d’acceptation.

L’ordre des sections fonctionnelles ci-dessous ne modifie pas cette séquence de livraison.

### 1. Espace agence

- création et activation d’une agence ;
- espace de données distinct pour chaque agence ;
- administration minimale de l’agence et de ses connexions ;
- utilisateurs authentifiés et accès limités à leur agence ;
- journal des actions importantes ;
- aucune administration d’infrastructure exposée à l’agence.

Les rôles détaillés et leur matrice d’autorisation seront définis pendant l’Architecture et les Stories.

### 2. Connexion de plusieurs boîtes e-mail

- plusieurs boîtes surveillées pour une même agence ;
- connexion Gmail par OAuth ;
- connexion Microsoft 365 / Outlook par OAuth ;
- connexion IMAP lorsque le fournisseur ne propose pas d’intégration OAuth compatible ;
- distinction entre une boîte réelle et un alias ;
- activation ou désactivation indépendante de chaque connexion ;
- état visible : connectée, synchronisation en cours, autorisation expirée, erreur ou désactivée ;
- règles de routage par boîte vers Biens, Sinistres ou classification automatique ;
- déduplication des messages reçus sur plusieurs adresses surveillées ;
- révocation indépendante des autorisations d’une boîte.

### 3. Contacts et conversations

- création ou rapprochement d’un contact à partir d’un message ;
- plusieurs adresses e-mail possibles pour un même contact ;
- conservation de l’adresse et de la boîte d’origine de chaque message ;
- regroupement par identifiants de fil et en-têtes e-mail lorsqu’ils sont disponibles ;
- recherche par contact, adresse, référence ou conversation ;
- correction manuelle d’un rapprochement ;
- séparation de deux dossiers même lorsqu’ils concernent le même contact ;
- historique chronologique lisible par les collaborateurs autorisés.

Un rapprochement automatique ambigu doit être proposé à l’utilisateur et non imposé silencieusement.

### 4. Traitement commun des messages

- conservation du message et de ses métadonnées utiles ;
- détection des doublons ;
- classification Biens, Sinistres ou À vérifier ;
- extraction structurée des informations utiles ;
- indication du niveau de confiance ;
- liste des informations manquantes ;
- résumé du contexte ;
- proposition de prochaine action ;
- préparation d’une réponse ;
- responsable et statut de prise en charge visibles ;
- possibilité de corriger la classification et les données extraites ;
- reprise automatique ou manuelle après échec ;
- aucune disparition silencieuse d’un message en erreur.

#### Coordination entre l’agent IA et les collaborateurs

DossierClé est la source de vérité de la prise en charge. Le statut lu ou non lu d’un e-mail ne permet jamais de conclure qu’une demande est traitée.

La prise en charge s’applique à la conversation ou au dossier, et non au seul message, afin d’éviter que deux réponses d’un même échange soient traitées séparément. Elle affiche au minimum :

- le responsable actuel : Agent IA ou collaborateur identifié ;
- la date et l’heure de prise en charge ;
- le statut courant ;
- la prochaine action prévue et son échéance ;
- la dernière action externe exécutée.

Les statuts visibles sont :

- `NOUVEAU` ;
- `PRIS_EN_CHARGE_IA` ;
- `PRIS_EN_CHARGE_HUMAIN` ;
- `EN_ATTENTE_REPONSE_EXTERNE` ;
- `ACTION_HUMAINE_REQUISE` ;
- `TRAITE` ;
- `ECHEC_A_REPRENDRE`.

Un seul acteur peut détenir la prise en charge à un instant donné. Son acquisition est atomique et temporaire : une expiration contrôlée permet la reprise après panne, sans autoriser un deuxième envoi. Avant chaque e-mail, relance ou changement d’état externe, le système vérifie de nouveau le responsable, le statut et la version courante du dossier.

Un collaborateur autorisé peut utiliser **Prendre la main**. Cette action transfère la responsabilité au collaborateur, suspend l’agent sur le dossier et invalide ses envois ou relances encore en attente. L’agent ne reprend le dossier qu’après une libération explicite, une nouvelle autorisation humaine ou une règle de reprise préalablement configurée.

Les statuts de prise en charge sont affichés simultanément dans DossierClé et dans la boîte e-mail d’origine. Les libellés visibles sont :

- `DossierClé/Nouveau` ;
- `DossierClé/IA en cours` ;
- `DossierClé/Humain en cours` ;
- `DossierClé/Action humaine requise` ;
- `DossierClé/En attente` ;
- `DossierClé/Traité` ;
- `DossierClé/Erreur`.

DossierClé utilise un libellé Gmail, une catégorie Microsoft 365 / Outlook, ou un mot-clé ou dossier dédié IMAP selon les capacités vérifiées de la boîte. Le même libellé et le responsable correspondant sont visibles dans l’application sans ouvrir le dossier.

Avant la première action autonome externe sur une conversation, l’agent pose `DossierClé/IA en cours` dans l’application et confirme sa synchronisation dans la boîte e-mail. Si cette confirmation échoue ou si la boîte ne permet aucun marqueur fiable, l’agent suspend l’action externe, passe le dossier en `ACTION_HUMAINE_REQUISE` et signale l’incident. Il ne répond pas silencieusement sans tag visible.

Lorsqu’un collaborateur applique `DossierClé/Humain en cours` depuis la boîte e-mail, ce changement constitue une demande de prise en main : l’agent est suspendu avant sa prochaine action et les tâches externes en attente sont invalidées. Si le fournisseur ne permet pas d’identifier précisément l’auteur du changement, la prise en charge reste bloquante pour l’agent et l’identité doit être confirmée dans DossierClé.

DossierClé reste la source de vérité, journalise les changements et réconcilie les écarts entre l’application et la boîte. Le statut lu ou non lu n’est jamais utilisé comme statut métier.

### 5. Workflow Biens

La V1 doit permettre de :

- identifier le bien ou la demande concernée lorsque les informations le permettent ;
- indiquer lorsque le bien reste à identifier ;
- enregistrer les critères exprimés par le contact ;
- vérifier ou faire vérifier la disponibilité du bien ;
- suivre la qualification de la demande ;
- proposer une réponse et la prochaine étape ;
- proposer des biens similaires lorsque les données disponibles le permettent ;
- préparer ou suivre une proposition de visite ;
- envoyer la liste des justificatifs attendus à l’étape concernée ;
- collecter les pièces du dossier locatif dans un espace privé ;
- contrôler leur présence, leur lisibilité et leur validité apparente ;
- signaler les pièces manquantes, expirées, illisibles ou incohérentes ;
- effectuer les relances autorisées pour compléter le dossier ;
- transmettre un dossier complet à un collaborateur pour validation ;
- conserver l’historique des décisions et échanges.

En V1, le contrôle du dossier locatif porte uniquement sur des éléments documentaires objectifs de complétude : présence, lisibilité, date de validité apparente et cohérence d’identité entre les pièces. Il ne vérifie pas leur authenticité et ne produit ni notation ni appréciation financière. DossierClé et l’agent n’évaluent pas la solvabilité, ne notent, ne classent ni ne comparent les candidats, ne choisissent aucun candidat, n’acceptent ou ne refusent aucune candidature et ne préparent ni ne signent le bail. Ces fonctions ne sont pas proposées dans le formulaire, même en mode **L’agent prépare et demande une validation** ; elles restent entièrement prises en charge par l’agence hors du workflow de l’agent.

#### Catalogue des biens en V1

Chaque agence alimente le catalogue de sa base isolée par :

- saisie manuelle ;
- import CSV ;
- import Excel au format `.xlsx` ;
- connecteur API lorsque son logiciel dispose d’une API documentée et exploitable avec des droits minimaux.

L’import CSV ou Excel permet de mapper les colonnes, prévisualiser les changements, vérifier les champs obligatoires, afficher les erreurs ligne par ligne et détecter les doublons avant validation. Il est idempotent : réimporter la même source ne crée pas de deuxième bien. L’absence d’un bien dans un fichier ou une réponse API ne provoque jamais sa suppression silencieuse.

La V1 accepte uniquement les formats `.csv` et `.xlsx` dans les limites de taille définies par l’Architecture. Elle rejette les fichiers chiffrés ou protégés et n’exécute aucune macro, formule, lien externe ni contenu actif ; les valeurs sont analysées comme des données non fiables avant leur prévisualisation et leur import.

Chaque bien conserve au minimum une référence stable dans l’agence, son adresse normalisée, les précisions disponibles de bâtiment, étage ou lot, son statut utile au parcours Location, sa source et la date de dernière mise à jour. Les liens confirmés avec des contacts ou dossiers sont conservés séparément et restent corrigeables.

Un connecteur API est autorisé seulement si l’agence l’active explicitement et si l’Architecture confirme l’authentification, le périmètre de lecture, les identifiants stables, les champs nécessaires, la pagination, les limites d’usage et la reprise sur erreur. Un connecteur indisponible ne bloque pas la saisie manuelle ni les imports.

#### Identification contrôlée du bien

Le modèle IA n’accède jamais directement à SQL ni aux identifiants de la base ou du logiciel immobilier. Il appelle un service DossierClé autorisé pour l’agence courante, qui limite les résultats et les champs retournés aux informations nécessaires.

Le rapprochement recherche dans cet ordre :

1. référence exacte du bien ou du dossier ;
2. adresse normalisée complétée par le bâtiment, l’étage ou le lot lorsqu’ils sont disponibles ;
3. lien déjà confirmé entre le contact et le bien ;
4. conversation ou dossier antérieur déjà rattaché ;
5. candidats approchants présentés comme tels.

Un rattachement autonome est permis uniquement lorsqu’un résultat unique satisfait les règles déterministes et le seuil de confiance défini. En cas de résultats multiples, d’information insuffisante ou de contradiction, l’agent demande les précisions manquantes ou passe en `ACTION_HUMAINE_REQUISE` ; il ne choisit jamais arbitrairement un bien.

L’intégration à un logiciel immobilier reste optionnelle en V1 et passe uniquement par un connecteur API validé ; DossierClé ne se connecte pas directement à la base de données externe.

### 6. Workflow Sinistres

La V1 doit permettre de :

- enregistrer une déclaration de sinistre issue d’un e-mail ;
- identifier le logement ou dossier concerné lorsque les informations le permettent ;
- classifier le type de sinistre ;
- signaler les informations et pièces manquantes ;
- proposer un niveau d’urgence avec justification ;
- identifier la spécialité artisan nécessaire ;
- classer les artisans compatibles et recommander le mieux adapté avec justification ;
- décider de la prochaine action lorsque les règles et le niveau de confiance le permettent ;
- envoyer les demandes d’informations, accusés de réception et messages opérationnels autorisés ;
- transmettre une demande d’intervention non engageante à un artisan actif sélectionné selon les règles de l’agence ;
- effectuer les relances autorisées jusqu’à réponse, échéance ou condition d’arrêt ;
- suivre les devis, rendez-vous et l’état de résolution ;
- conserver l’historique des décisions autonomes, escalades et validations humaines.

Le système ne doit pas promettre une indemnisation, accepter un devis, engager une dépense, confirmer une affectation contractuelle ou clôturer un litige sans validation humaine.

### 7. Annuaire artisans V1

L’agence doit pouvoir :

- ajouter un artisan manuellement ;
- importer un annuaire par fichier CSV ;
- enregistrer l’entreprise, le contact, les coordonnées et le SIRET lorsque disponible ;
- associer plusieurs spécialités ;
- associer plusieurs zones d’intervention ;
- indiquer l’acceptation des urgences et les informations de disponibilité utiles ;
- ajouter des notes internes ;
- enregistrer les justificatifs demandés et leur date d’expiration ;
- utiliser les statuts Brouillon, À vérifier, Actif, Suspendu et Archivé ;
- détecter les doublons probables par SIRET, e-mail, téléphone, nom et adresse ;
- empêcher la proposition d’un artisan non actif ;
- valider humainement une affectation avant tout engagement.

Le RIB et les paiements artisans sont exclus de la V1.

### 8. Proposition d’artisans

La présélection repose d’abord sur des critères contrôlables :

1. spécialité ;
2. zone d’intervention ;
3. statut actif ;
4. disponibilité connue ;
5. acceptation des urgences ;
6. validité des justificatifs requis ;
7. priorité définie par l’agence ;
8. historique d’intervention lorsque disponible.

L’IA explique la recommandation et peut déclencher l’action autorisée par l’agence. Elle ne contourne jamais les filtres métier, les limites du mandat ni les règles d’escalade.

### 9. Supervision fonctionnelle

- vue des messages en attente, en cours, terminés et en erreur ;
- responsable Agent IA ou collaborateur visible sans ouvrir le dossier ;
- filtre par responsable et statut de prise en charge ;
- action **Prendre la main** réservée aux collaborateurs autorisés ;
- même tag de prise en charge visible dans l’application et dans la boîte e-mail ;
- alerte et suspension des actions autonomes lorsque la synchronisation du tag échoue ;
- vue des validations humaines en attente ;
- indication claire de la boîte, du contact et du dossier concernés ;
- journal des actions externes et changements d’état ;
- possibilité de relancer une tâche échouée sans créer de doublon ;
- alertes de connexion e-mail expirée ou défaillante.

### 10. Mandat d’autonomie de l’agent

Le périmètre de l’agent est configuré depuis un formulaire destiné à être compris sans compétence technique par une secrétaire, un gestionnaire ou un responsable d’agence. Ce formulaire est la source de vérité des fonctions que l’agent est autorisé à exécuter.

Pour chaque fonction configurable, l’agence choisit exactement un mode :

1. **L’agent fait seul** : la tâche peut être décidée et exécutée automatiquement dans les limites configurées ;
2. **L’agent prépare et demande une validation** : l’agent prépare la prochaine action, mais aucune action externe n’est exécutée avant validation humaine ;
3. **L’agent ne fait pas** : la fonction est désactivée et toute demande correspondante est transmise à un collaborateur.

Les fonctions sont regroupées dans des catégories métier lisibles :

- **Location** : compréhension de la demande, recherche de biens, réponses courantes et organisation des visites ;
- **Dossiers locatifs** : envoi de la liste autorisée, collecte des pièces, contrôle de complétude et relances pour pièces manquantes ;
- **Sinistres** : qualification, collecte d’informations, recommandation d’artisan, demandes non engageantes et relances ;
- **Communications** : accusés de réception, informations d’avancement, horaires, destinataires et rapports.

La configuration générale appartient à l’agence. Elle peut être restreinte par boîte ou par module, mais une règle locale ne peut jamais élargir le périmètre autorisé au niveau de l’agence. Sur un dossier, **Prendre la main** ou suspendre l’agent arrête son autonomie sans modifier la configuration générale.

Avant l’activation, le formulaire affiche un résumé en langage courant de ce que l’agent fera seul, préparera pour validation et ne fera pas. Une nouvelle fonction est désactivée par défaut tant qu’un collaborateur autorisé ne lui a pas attribué explicitement un mode.

Les paramètres techniques ou avancés ne sont pas exposés dans le parcours principal. Lorsque nécessaire, ils sont placés dans des options supplémentaires avec des valeurs sûres et une explication métier.

L’agence configure et peut révoquer notamment :

- tâches et types de messages que l’agent peut traiter seul ;
- boîtes, modules et dossiers concernés ;
- destinataires et artisans actifs pouvant être contactés ;
- modèles, ton et informations obligatoires des messages ;
- délai, cadence, nombre maximal et conditions d’arrêt des relances ;
- seuil de confiance minimal pour décider sans intervention humaine ;
- horaires autorisés et limite de volume d’envoi ;
- situations imposant une escalade immédiate.

Le formulaire ne propose pas les fonctions Location exclues de la V1 de l’agent : évaluation de solvabilité, notation, classement ou comparaison des candidats, choix d’un candidat, acceptation ou refus d’une candidature et préparation ou signature du bail. DossierClé ne les exécute ni ne les prépare.

Les autres décisions ou actions protégées peuvent être préparées seulement lorsque le mode **L’agent prépare et demande une validation** est disponible, mais ne peuvent jamais être exécutées de manière autonome : affectation contractuelle d’un artisan, acceptation ou refus d’un devis, dépense, indemnisation, engagement contractuel, clôture d’un litige ou exception hors politique. Elles restent en validation humaine obligatoire avec une explication visible.

Chaque modification de configuration conserve l’agence, la version, la date, l’auteur, les valeurs précédentes et les nouvelles valeurs. Elle prend effet avant toute nouvelle action externe selon des transitions déterministes :

- le passage de **L’agent fait seul** à **L’agent prépare et demande une validation** annule toute exécution autonome non réalisée et crée, si l’action reste pertinente, une nouvelle demande de validation liée à la version courante du mandat ;
- le passage à **L’agent ne fait pas**, la désactivation d’une fonction ou la suspension de l’agent invalide toutes les tâches non exécutées concernées et transfère leur prise en charge à un collaborateur ; aucune de ces tâches ne peut être transformée automatiquement en brouillon ou en validation ;
- une reprise exige une nouvelle décision explicite fondée sur la configuration et la version du mandat alors en vigueur.

Une modification n’autorise jamais rétroactivement une action déjà refusée ou expirée et n’annule pas une action externe déjà exécutée ; son historique reste consultable.

Toute action autonome doit enregistrer la version du mandat appliqué, les éléments ayant conduit à la décision, le message envoyé, sa date et son résultat. Une réponse, un refus, une erreur permanente, un doute sur le contact ou l’atteinte d’une limite arrête les relances automatiques et déclenche la suite prévue ou une escalade.

### 11. Rapports opérationnels automatiques

DossierClé génère et envoie trois rapports du lundi au vendredi selon le fuseau horaire configuré pour l’agence :

1. **8h45 — Ouverture de journée**
   - résumé du dernier jour ouvré couvert ;
   - tâches terminées et éléments restés ouverts ;
   - urgences, échéances et tâches à réaliser aujourd’hui ;
   - le lundi, le dernier jour ouvré couvert est le vendredi précédent.
2. **13h30 — Reprise de l’après-midi**
   - actions réalisées depuis le rapport de 8h45 ;
   - tâches non terminées ou bloquées le matin ;
   - priorités et tâches à traiter l’après-midi.
3. **16h00 — Bilan de journée**
   - actions et relances réalisées pendant la journée ;
   - tâches terminées, non terminées ou bloquées ;
   - alertes nécessitant une intervention humaine ;
   - prochaines actions et éléments à reporter au prochain jour ouvré.

Les rapports de 12h et 13h30 initialement envisagés sont fusionnés à 13h30 afin de limiter la fatigue de notification. Le produit envoie donc trois rapports par jour au lieu de quatre.

Pour chaque agence :

- les destinataires et rôles autorisés sont configurables ;
- le rapport est envoyé par e-mail et conservé dans un historique consultable dans DossierClé ;
- pour chaque destinataire, le contenu est filtré selon son rôle et ses autorisations et limité aux informations nécessaires à ses tâches ;
- l’objet, le corps et les éventuels liens ou pièces jointes ne contiennent aucune donnée personnelle ni détail sensible non nécessaire ;
- un rapport est produit même lorsqu’aucune action n’a eu lieu, avec un état explicite « aucune activité » ;
- chaque rapport possède un état visible : Programmé, Généré, Envoyé, Échec ou Relancé ;
- un échec d’envoi est visible et peut être relancé sans régénérer ni envoyer deux fois le même rapport.

L’unicité d’un rapport repose au minimum sur l’agence, le type de rapport et la date locale couverte. Un changement de fuseau horaire ou d’heure d’été ne doit créer ni omission ni double envoi.

## Scope V2

La V2 ajoute l’invitation sécurisée d’un artisan :

- invitation envoyée par l’agence ;
- lien temporaire, à usage limité et stocké sous forme non exploitable directement ;
- formulaire permettant à l’artisan de compléter ou corriger sa fiche ;
- dépôt des justificatifs demandés ;
- expiration et révocation du lien ;
- vérification puis activation par l’agence ;
- aucun accès aux autres artisans, sinistres ou données de l’agence.

La V2 ne comprend pas de compte artisan permanent.

## Version ultérieure

Un portail artisan permanent pourra être étudié après la V2 :

- compte artisan ;
- tableau de bord ;
- acceptation ou refus d’une intervention ;
- dépôt de devis ;
- suivi des rendez-vous ;
- mise à jour autonome des documents ;
- échanges structurés avec l’agence.

Cette version nécessite un cadrage produit, une autorisation dédiée et une nouvelle analyse de sécurité.

## Non-scope / cimetière

Sont explicitement hors V1 :

- éditeur de workflows généraliste ;
- n8n embarqué ou exposé aux agences ;
- portail artisan permanent ;
- paiement des artisans ;
- stockage de RIB ;
- acceptation automatique des devis ;
- engagement automatique d’une dépense ;
- promesse automatique d’indemnisation ;
- clôture autonome d’un sinistre litigieux ;
- comptabilité mandant ou gestion locative comptable complète ;
- quittancement et encaissement des loyers ;
- multidiffusion des annonces immobilières ;
- signature électronique ;
- application mobile native ;
- remplacement complet du CRM ou logiciel immobilier de l’agence ;
- accès transversal d’un artisan aux données de plusieurs agences ;
- entraînement d’un modèle sur les données d’une agence sans décision et consentement applicables ;
- infrastructure dédiée payée systématiquement pour chaque agence inactive.

## Parcours principaux

### Parcours A — Créer une agence et connecter ses boîtes

1. Un administrateur crée l’agence.
2. Le système provisionne son espace isolé.
3. L’administrateur ajoute une première boîte e-mail.
4. Il autorise la connexion auprès du fournisseur ou configure l’accès IMAP compatible.
5. Il choisit les modules et règles de routage de la boîte.
6. Il ajoute éventuellement d’autres boîtes et alias.
7. Le système vérifie la connexion sans envoyer de message externe.
8. La surveillance est activée et son état reste visible.

### Parcours B — Traiter une demande liée à un bien

1. Un e-mail est reçu et dédupliqué.
2. Le contact et la conversation sont recherchés.
3. Le système classe la demande ; en cas d’ambiguïté, il la place dans À vérifier.
4. Les critères, le bien et les informations manquantes sont extraits.
5. Dans le mandat autorisé, l’agent décide de la prochaine action et envoie la réponse opérationnelle adaptée.
6. Si la confiance est insuffisante ou si l’action sort du mandat, l’agent prépare le contexte et escalade vers un collaborateur.
7. Le dossier, l’action, le message envoyé et le résultat sont mis à jour dans l’historique.

### Parcours C — Traiter un sinistre

1. Une déclaration est reçue et rattachée à un contact et un dossier.
2. L’agent extrait le type de sinistre, le lieu, l’urgence et les informations disponibles.
3. Si des éléments manquent et que l’action est autorisée, l’agent les demande directement au déclarant et programme la relance prévue.
4. Si l’urgence, le rattachement ou la qualification est ambiguë ou hors règle, l’agent escalade immédiatement avec le contexte collecté.
5. L’agent filtre et classe les artisans actifs selon la spécialité, la zone, la disponibilité, l’urgence, la validité des justificatifs, les priorités de l’agence et l’historique.
6. Il sélectionne l’artisan le mieux adapté et enregistre les raisons de cette décision.
7. Lorsque le mandat l’autorise, il transmet à cet artisan une demande d’intervention non engageante contenant uniquement les informations nécessaires ; sinon, il demande une validation humaine.
8. Il analyse les réponses et effectue les relances autorisées jusqu’à réponse, échéance, refus ou limite configurée.
9. Il met à jour le dossier et peut clôturer un sinistre routinier lorsque les conditions définies par l’agence sont toutes satisfaites.
10. Il demande obligatoirement une validation humaine avant toute affectation contractuelle, acceptation de devis, dépense, promesse d’indemnisation ou clôture litigieuse.

### Parcours D — Importer un annuaire artisans

1. L’agence télécharge ou consulte le format CSV attendu.
2. Elle importe son fichier.
3. Le système affiche l’aperçu, les erreurs et les doublons probables.
4. L’agence corrige ou accepte les lignes valides.
5. Les fiches sont créées avec un statut contrôlé.
6. L’agence vérifie puis active les artisans utilisables.

### Parcours E — Gérer un échec

1. Un traitement échoue sans supprimer le message original.
2. La tâche est retentée selon une politique bornée.
3. En cas d’échec persistant, elle devient visible dans une file d’erreurs.
4. Un collaborateur ou opérateur autorisé consulte la cause exploitable.
5. La tâche est corrigée ou relancée avec une protection contre les doublons.

### Parcours F — Coordonner l’agent IA et un collaborateur

1. Une nouvelle conversation ou un nouveau dossier apparaît avec le statut `NOUVEAU`.
2. L’agent ou un collaborateur acquiert la prise en charge de façon atomique ; l’autre voit immédiatement le responsable et ne peut pas exécuter une action externe concurrente.
3. Avant d’agir à l’extérieur, l’agent affiche `DossierClé/IA en cours` dans l’application et confirme la présence du même tag dans la boîte d’origine ; sans confirmation, il suspend l’action et demande une intervention humaine.
4. Un collaborateur autorisé peut sélectionner **Prendre la main** dans l’application ou appliquer `DossierClé/Humain en cours` dans la boîte e-mail ; les tâches autonomes encore en attente sont alors invalidées avant le transfert.
5. Avant tout envoi, le système revalide la responsabilité et la version du dossier ; une tâche devenue obsolète s’arrête sans envoyer.
6. À la fin du traitement, le statut passe à `TRAITE` ou à l’état d’attente ou d’escalade approprié, avec une trace horodatée.

## Capacités principales

- multi-agence avec isolation stricte ;
- multi-boîtes par agence ;
- ingestion et déduplication d’e-mails ;
- contacts multi-adresses ;
- conversations et dossiers séparés ;
- classification et extraction assistées ;
- workflow Biens ;
- catalogue des biens par saisie manuelle, import CSV ou Excel `.xlsx` ;
- connecteurs API optionnels vers les logiciels disposant d’une API exploitable ;
- identification contrôlée d’un bien sans accès SQL direct du modèle IA ;
- workflow Sinistres ;
- annuaire artisans ;
- import CSV contrôlé ;
- présélection déterministe d’artisans ;
- validation humaine ;
- journal d’audit fonctionnel ;
- traitements asynchrones reprenables ;
- supervision des connexions et erreurs.

## Contraintes

### Métier

- les règles de qualification doivent rester compréhensibles et corrigeables ;
- une erreur de rattachement ne doit pas contaminer silencieusement d’autres dossiers ;
- les statuts des dossiers doivent être explicites ;
- les termes visibles doivent correspondre au vocabulaire des agences immobilières ;
- la V1 cible une agence mixte ; le workflow Sinistres est validé avant le workflow Biens.

### Légales et conformité

- approche RGPD dès la conception ;
- minimisation des données collectées ;
- finalités, durées de conservation et droits des personnes à formaliser ;
- sous-traitants et transferts de données à documenter ;
- hébergement sur Scaleway Paris ;
- aucune promesse « 100 % conforme RGPD » sans revue juridique et preuves ;
- le contenu libre des e-mails peut contenir des données sensibles non sollicitées.

### Sécurité

- séparation des données et secrets de chaque agence ;
- authentification obligatoire pour l’espace agence ;
- autorisation vérifiée côté serveur sur chaque accès ;
- refus systématique des accès inter-agences ;
- chiffrement des communications ;
- secrets OAuth et mots de passe d’application hors base métier en clair ;
- pièces jointes et justificatifs privés ;
- liens temporaires non prédictibles et révocables ;
- journalisation sans secret ni contenu inutile ;
- validation humaine pour les engagements ;
- tests automatisés d’isolation multi-tenant.

### Techniques

Ces contraintes guident l’Architecture sans la remplacer :

- moteur propriétaire TypeScript, sans dépendance à n8n ;
- exécution managée et serverless à l’usage sur Scaleway Paris ;
- base de données distincte par agence ;
- plusieurs boîtes e-mail par agence ;
- traitements longs exécutés de manière asynchrone ;
- opérations idempotentes et retentables ;
- stockage privé des documents ;
- compatibilité réelle du moteur de base, de l’accès aux données et des migrations avec l’exécution serverless à prouver ;
- possibilité de remplacer un composant serverless incompatible sans réécrire le domaine métier.

### Charge, fiabilité et performance

La V1 doit être validée avec des scénarios reproductibles à 1, 50 et 200 connexions simultanées.

Dans ce PRD, une **connexion simultanée** désigne une session utilisateur authentifiée qui exécute des requêtes sur l’interface et l’API publiques pendant la même fenêtre de test. Elle ne désigne ni une boîte e-mail connectée, ni une connexion physique à la base de données.

Le jeu de charge minimal contient, pour chaque agence testée :

- 200 utilisateurs authentifiables ;
- 5 boîtes e-mail réelles ou simulées, plus 5 alias ;
- 5 000 contacts ;
- 10 000 conversations ;
- 50 000 messages, dont 10 % avec au moins une pièce jointe référencée ;
- 2 000 dossiers : exactement 1 000 Sinistres et 1 000 Biens ;
- 500 artisans couvrant plusieurs spécialités et zones.

Les données sont synthétiques et recréées avec la graine UTF-8 canonique `dossiercle-load-v1-20260928`. Le générateur sera versionné sous `tests/performance/generate-load-fixtures` et son export canonique sous `tests/performance/fixtures/load-v1`. Avant tout verdict de performance, la preuve Verify enregistrera le commit du générateur et le SHA-256 de l’export ; une exécution utilisant un autre commit, une autre graine ou un autre hash n’est pas comparable. Aucun contenu réel d’agence n’est utilisé pour le test de charge.

Chaque utilisateur virtuel exécute en boucle le catalogue exact suivant avec un temps d’attente pseudo-aléatoire déterministe de 1 à 3 secondes, dérivé de la même graine, entre deux actions :

1. 15 % — afficher une page de 50 messages triés du plus récent au plus ancien ;
2. 15 % — afficher une page de 50 dossiers triés du plus récent au plus ancien ;
3. 20 % — ouvrir une conversation de 20 messages avec les métadonnées de ses pièces jointes ;
4. 7 % — rechercher un contact par adresse e-mail exacte ;
5. 7 % — rechercher une conversation par référence exacte ;
6. 6 % — rechercher un dossier par référence ;
7. 10 % — appliquer une transition d’état valide à un dossier ;
8. 10 % — ajouter une note interne de 200 caractères à un dossier ;
9. 5 % — soumettre une classification asynchrone d’un message non traité ;
10. 5 % — soumettre la préparation asynchrone d’un brouillon pour un message classifié.

Chaque palier suit le même profil : montée linéaire pendant 2 minutes, charge maintenue pendant 10 minutes, puis attente maximale de 5 minutes pour résorber la file asynchrone. La graine, le catalogue, les volumes, la cadence et les résultats bruts sont conservés avec les preuves de validation. L’outil de génération de charge sera choisi pendant l’Architecture.

Les répartitions suivantes sont obligatoires :

1. 1 connexion dans une agence ;
2. 50 connexions dans une agence ;
3. 50 connexions réparties à parts égales entre 5 agences ;
4. 200 connexions dans une agence ;
5. 200 connexions réparties à parts égales entre 10 agences.

Pour chacun de ces cinq scénarios :

- aucune erreur HTTP 500 causée par l’application ;
- aucun message ni traitement accepté perdu ;
- aucun effet métier produit deux fois ;
- aucune donnée accessible depuis une autre agence ;
- 95 % des actions interactives ordinaires répondent en moins de 2 secondes ;
- les tâches longues sont acceptées en moins de 2 secondes puis suivies en arrière-plan ;
- tout échec persistant est visible et récupérable.

Le réveil à froid du serverless est mesuré dans un test séparé et publié avec les résultats ; il n’est pas masqué dans la mesure stabilisée. Ces objectifs ne constituent pas une promesse d’absence absolue de panne d’un fournisseur cloud.

### Budget et opérations

- pas de VPS ni de cluster à administrer par agence en V1 ;
- coût initial faible lorsque peu d’agences et peu d’activité existent ;
- calcul facturé principalement à l’usage ;
- stockage, sauvegardes, domaine, observabilité et services externes peuvent créer un socle de coût non nul ;
- limites et alertes de coût à prévoir avant le pilote ;
- aucun serveur complet systématiquement réservé pour une agence inactive ;
- l’agence ne choisit ni CPU ni RAM.

## Données sensibles

DossierClé traite des données personnelles et potentiellement sensibles selon le contenu libre reçu :

- identité et coordonnées des contacts ;
- plusieurs adresses e-mail pour une même personne ;
- contenu des e-mails et pièces jointes ;
- adresses de biens et logements ;
- informations liées à l’occupation ou à un sinistre ;
- échanges, rendez-vous et historique d’actions ;
- coordonnées et justificatifs professionnels des artisans ;
- identifiants techniques de messages et conversations ;
- jetons OAuth ou secrets d’accès aux boîtes, conservés dans un coffre adapté ;
- journaux techniques et d’audit minimisés.

Le produit ne doit pas supposer que les utilisateurs éviteront d’envoyer des informations sensibles. Les règles de rétention, suppression, export et accès devront couvrir ce risque.

## Autonomie, escalade et validation humaine

### Fonctions Location hors périmètre de l’agent en V1

DossierClé et l’agent ne réalisent ni ne préparent :

- l’évaluation de solvabilité ou toute appréciation financière ;
- la notation, le classement ou la comparaison des candidats ;
- le choix d’un candidat ou l’attribution d’un logement ;
- l’acceptation ou le refus d’une candidature ;
- la préparation, la modification ou la signature d’un bail.

Ces fonctions ne figurent pas dans le formulaire de périmètre. Elles sont prises en charge entièrement par l’agence en dehors du workflow de l’agent.

### Actions nécessitant toujours une confirmation en V1

- confirmer une affectation contractuelle à un artisan ;
- envoyer un engagement contractuel à un artisan ;
- accepter ou refuser un devis ;
- engager une dépense ;
- promettre une indemnisation ou une prise en charge ;
- clôturer un sinistre litigieux ;
- fusionner des contacts lorsque le rapprochement est ambigu ;
- activer un artisan dont les informations nécessitent une vérification ;
- rendre utilisable un import comportant des erreurs ou doublons non résolus.

### Actions autonomes dans le mandat de l’agence

- recevoir, conserver et dédupliquer un message ;
- extraire les informations et qualifier une demande avec un niveau de confiance suffisant ;
- décider de la prochaine action parmi les tâches autorisées ;
- demander au déclarant les informations ou pièces manquantes ;
- envoyer un accusé de réception ou une information d’avancement prévue ;
- sélectionner un artisan actif à l’aide des règles déterministes ;
- lui transmettre une demande d’intervention non engageante avec les données strictement nécessaires ;
- effectuer les relances selon la cadence, le maximum et les conditions d’arrêt configurés ;
- mettre à jour les états et clôturer un dossier routinier lorsque toutes les conditions définies sont satisfaites ;
- retenter une tâche technique idempotente.

### Cas imposant une escalade

- niveau de confiance inférieur au seuil de l’agence ;
- contact, conversation, bien ou dossier impossible à rattacher avec certitude ;
- urgence non couverte par une règle validée ;
- réponse contradictoire, refus, litige ou réclamation ;
- absence d’artisan compatible ou dépassement du nombre maximal de relances ;
- action, destinataire, donnée ou horaire hors du mandat configuré ;
- toute action figurant dans la liste des confirmations obligatoires ;
- toute demande relative à une fonction Location hors périmètre de l’agent, sans que l’agent prépare ou exécute cette fonction.

### Politique des e-mails sortants en V1

- l’agent peut envoyer seul un e-mail lorsque la tâche, le destinataire, le contenu, les limites et les conditions d’arrêt ont été autorisés par l’agence ;
- un e-mail hors mandat reste en brouillon et déclenche une demande de validation ;
- avant chaque envoi, le système vérifie l’identité du destinataire, le dossier, l’absence de doublon et l’état courant de la conversation ;
- chaque décision et chaque envoi sont tracés avec la règle appliquée, sans exposer de secret ;
- l’agence peut suspendre immédiatement les envois automatiques globalement, par boîte, par module ou par dossier.

## Critères de succès

### Succès fonctionnel du pilote

- une agence pilote connecte au moins deux boîtes réelles et indépendantes ;
- les alias sont testés séparément sans être comptés comme une deuxième boîte ;
- chaque message de test apparaît une seule fois ;
- les messages sont rattachables à un contact, une conversation et un dossier ;
- les erreurs de classification et rapprochement sont corrigeables ;
- les parcours Biens et Sinistres atteignent une prochaine action claire ;
- un catalogue de biens peut être alimenté manuellement et par des imports CSV et Excel `.xlsx` avec aperçu, erreurs et déduplication ;
- réimporter la même source ne crée pas de doublon et l’absence d’une ligne ne supprime pas silencieusement un bien ;
- une référence exacte et unique permet le rattachement attendu, tandis que plusieurs candidats déclenchent une demande de précision ou `ACTION_HUMAINE_REQUISE` ;
- le modèle IA ne reçoit ni accès SQL ni identifiant de base externe et ne peut rechercher que dans l’agence courante ;
- un collaborateur autorisé peut configurer chaque fonction configurable avec les trois modes prévus et obtient avant activation un résumé fidèle en langage courant ;
- une fonction nouvelle ou non configurée reste désactivée et ne produit aucune action externe ;
- passer une fonction en mode **L’agent prépare et demande une validation** annule l’exécution autonome non réalisée et exige une nouvelle validation humaine sous le mandat courant ;
- passer une fonction en mode **L’agent ne fait pas**, la désactiver ou suspendre l’agent invalide toutes les tâches non exécutées concernées et en transfère la prise en charge à un collaborateur ;
- aucune fonction Location exclue de la V1 de l’agent n’apparaît dans le formulaire ni ne produit de préparation ou d’action de l’agent ;
- aucune action protégée ne peut être placée en mode autonome depuis le formulaire ;
- l’historique permet d’identifier la version, la date, l’auteur et le contenu de chaque changement de périmètre ;
- un sinistre routinier est traité de bout en bout par l’agent dans son mandat, avec demande d’informations, sélection d’artisan et relances ;
- toute action hors mandat ou ambiguë est escaladée sans envoi non autorisé ;
- deux prises en charge concurrentes d’un même dossier produisent un seul responsable et au plus une action externe ;
- **Prendre la main** empêche l’exécution des envois et relances de l’agent devenus obsolètes ;
- après une panne ou l’expiration d’une prise en charge, la reprise ne produit aucune double réponse ;
- chaque statut de prise en charge est visible avec le même sens dans DossierClé et dans la boîte e-mail ;
- aucun premier envoi autonome n’est exécuté tant que `DossierClé/IA en cours` n’est pas confirmé dans la boîte d’origine ;
- appliquer `DossierClé/Humain en cours` depuis la boîte suspend l’agent et invalide ses tâches externes en attente ;
- une panne de synchronisation des tags produit une alerte et une action humaine requise, sans réponse autonome non signalée ;
- le statut lu/non lu n’est jamais utilisé comme source de vérité ;
- les rapports de 8h45, 13h30 et 16h00 sont générés une seule fois au bon jour et à la bonne heure locale, envoyés par e-mail et retrouvables dans DossierClé ;
- un échec d’envoi d’un rapport est visible et récupérable sans double envoi ;
- un annuaire artisans peut être créé manuellement et importé par CSV ;
- aucun artisan n’est engagé sans validation humaine ;
- les actions importantes sont auditables ;
- une sauvegarde et une restauration d’une agence sont démontrées ;
- les tests d’isolation inter-agences sont sans fuite ;
- les tests de charge 1, 50 et 200 respectent les critères définis.

### Succès utilisateur à mesurer pendant le pilote

Avant l’activation sur des données réelles, un protocole pilote doit fixer pour chaque indicateur : la source, la période d’observation, l’échantillon représentatif, la valeur de référence, la cible, le seuil minimal acceptable et le responsable de la mesure. La situation initiale est mesurée sur le processus manuel, puis la mesure est répétée sur une période comparable avec DossierClé :

- réduction du délai de première réponse ;
- réduction du nombre de demandes oubliées ;
- réduction du temps passé à rechercher l’historique ;
- réduction du temps de qualification d’un sinistre ;
- réduction du temps de recherche d’un artisan ;
- part des propositions du système acceptées sans correction majeure ;
- taux d’erreurs de classification et de rattachement ;
- satisfaction des collaborateurs ;
- volonté de payer et prix acceptable.

### Succès commercial

Le pilote ne sera pas considéré comme une validation commerciale sur la seule base d’un prototype fonctionnel. Les seuils numériques de GO, PIVOT et KILL doivent être écrits dans le protocole pilote avant l’activation, afin de ne pas être adaptés après observation des résultats. Le pilote doit produire :

- un usage sur un workflow réel atteignant la fréquence minimale préalablement déclarée ;
- un gain de temps ou de qualité mesuré contre la valeur de référence et le seuil préalablement déclaré ;
- un décideur identifié ;
- une intention de poursuivre ou de payer ;
- une estimation des coûts variables par agence active.

### Gate initial GO / PIVOT / KILL du pilote

Le pilote de référence dure quatre semaines consécutives après l’onboarding et la mesure de référence. Ces seuils peuvent être modifiés uniquement avant l’activation du pilote, par une décision tracée dans le PRD ; ils ne peuvent pas être réécrits après observation des résultats.

**Préconditions obligatoires pour tout GO ou PIVOT :**

- aucun accès inter-agences observé ;
- aucun message ou traitement accepté perdu ;
- aucun e-mail envoyé hors du mandat configuré et aucune relance après une condition d’arrêt ;
- sauvegarde et restauration démontrées ;
- cinq scénarios de charge conformes aux seuils du PRD ;
- aucun finding de sécurité Critical ou Major ouvert.

**GO** si toutes les préconditions sont satisfaites et si :

- au moins deux collaborateurs utilisent DossierClé pendant au moins trois jours distincts par semaine sur chacune des quatre semaines ;
- le temps médian de traitement diminue d’au moins 25 % pour les Sinistres et d’au moins 25 % pour les demandes de Biens, à échantillon comparable ;
- au moins 70 % des actions routinières autonomes exécutées ne nécessitent ni correction rétrospective, ni annulation, ni reprise manuelle ;
- au plus 10 % des messages nécessitent une correction de classification ou de rattachement ;
- le décideur confirme par écrit son intention de poursuivre avec une offre payante dont le prix a été présenté.

**PIVOT** si toutes les préconditions sont satisfaites, mais qu’un seul des deux workflows atteint les seuils d’usage et de gain. Le produit est alors recentré sur ce workflow avant toute extension.

**KILL** si une précondition de sécurité ou d’intégrité reste en échec après un cycle correctif, ou si, après un cycle d’amélioration du pilote, aucun workflow n’atteint 25 % de réduction du temps médian et que le décideur ne confirme aucune intention de poursuivre avec une offre payante.

## Risques

### Produit

- vouloir servir simultanément la transaction et la gestion locative dilue la V1 ;
- ajouter un nouvel outil au lieu de remplacer une tâche manuelle ;
- manque de confiance dans les classifications et réponses proposées ;
- coût de correction supérieur au gain de temps ;
- annuaire artisans incomplet ou rapidement périmé ;
- absence de volonté de payer malgré l’intérêt déclaré.

### Métier

- rattachement d’un message au mauvais contact ou dossier ;
- urgence mal évaluée ;
- artisan inadapté proposé ;
- réponse envoyée avec un contexte incomplet ;
- confusion entre recommandation et engagement contractuel.

### Sécurité et données

- fuite inter-agences ;
- exposition d’un jeton de messagerie ;
- accès excessif aux boîtes e-mail ;
- pièce jointe malveillante ;
- lien d’invitation artisan intercepté ou réutilisé ;
- conservation excessive du contenu ;
- contenu sensible recopié dans les logs ou vers un fournisseur IA.

### Technique et fournisseur

- limitations du service de base managé retenu incompatibles avec l’accès aux données ou les migrations ;
- réveil serverless dégradant la première requête ;
- quota ou panne d’un fournisseur e-mail ;
- doublons créés par les webhooks, synchronisations ou reprises ;
- coûts variables mal plafonnés ;
- dépendance excessive à un fournisseur cloud ou IA.

### Juridique et conformité

- base légale, information des personnes ou durées de conservation mal définies ;
- fournisseur IA incompatible avec les engagements de résidence ou confidentialité ;
- pièces jointes contenant des catégories de données non anticipées ;
- positionnement commercial promettant une conformité non démontrée.

## Hypothèses à tester

- les agences acceptent de connecter plusieurs boîtes au service ;
- les deux problèmes Biens et Sinistres peuvent partager une expérience commune sans la complexifier ;
- une base distincte par agence apporte le niveau d’isolation attendu à un coût viable ;
- le traitement serverless reste économiquement avantageux avec des boîtes surveillées en continu ;
- l’agence possède déjà un annuaire artisans exploitable ou accepte de le constituer ;
- les collaborateurs acceptent une étape de validation humaine sans recréer trop de travail ;
- l’agence pilote peut fournir des exemples anonymisés ou synthétiques suffisants ;
- le gain de temps est assez fréquent pour justifier un abonnement.

## Questions ouvertes

Les questions restantes ne bloquent pas le passage aux Stories. Elles deviennent des décisions d’Architecture ou de préparation du pilote.

### À décider avant l’Architecture PASS

- méthode d’authentification des utilisateurs de l’agence ;
- rôles et permissions V1 ;
- fournisseur de queue ou mécanisme de jobs ;
- framework TypeScript et organisation interne du moteur propriétaire ;
- moteur de base, accès aux données et stratégie de migrations compatibles avec les contraintes serverless ;
- coffre de secrets ;
- fournisseur IA, région de traitement et politique de minimisation ;
- stratégie de sauvegarde, restauration et export par agence ;
- objectifs de disponibilité et de reprise ;
- ordre de prise en charge Gmail, Microsoft 365 et IMAP ;
- limites maximales de boîtes, utilisateurs et stockage par offre.

### À décider avant le pilote réel

- agence pilote et décideur ;
- données utilisables pour le pilote ;
- durées de conservation ;
- conditions d’utilisation et information des personnes ;
- prix, quotas et dépassements ;
- métriques de référence avant activation ;
- canaux de support ;
- procédure d’incident et de révocation d’une boîte ;


## Décisions enregistrées

- **GO :** moteur propriétaire TypeScript sans n8n ; le framework précis sera formalisé en Architecture.
- **GO :** hébergement sur Scaleway Paris.
- **GO :** infrastructure managée et serverless à l’usage, sans gestion CPU/RAM par les agences.
- **GO :** base distincte par agence.
- **GO :** plusieurs boîtes surveillées par agence.
- **GO V1 :** agence mixte comme persona principal.
- **GO V1 :** workflow Sinistres construit et validé avant Biens, les deux restant inclus dans la V1.
- **GO V1 :** catalogue des biens alimenté par saisie manuelle et imports CSV/Excel `.xlsx`, avec connecteur API optionnel lorsqu’une API exploitable est validée.
- **GO V1 :** autonomie encadrée pour les tâches et e-mails autorisés par l’agence ; escalade hors mandat et validation humaine des engagements et cas sensibles.
- **GO V1 :** l’agence délimite le périmètre de l’agent depuis un formulaire simple proposant, pour chaque fonction configurable, les modes **L’agent fait seul**, **L’agent prépare et demande une validation** et **L’agent ne fait pas** ; les limites de sécurité restent non modifiables.
- **GO V1 :** le workflow Location inclut la collecte des pièces, le contrôle documentaire objectif de complétude et les relances autorisées, mais DossierClé et l’agent n’évaluent pas la solvabilité, ne notent, ne classent ni ne choisissent les candidats, n’acceptent ou ne refusent aucune candidature et ne préparent ni ne signent le bail.
- **GO V1 :** prise en charge exclusive par conversation ou dossier, responsable Agent IA ou humain visible, et transfert sécurisé avec **Prendre la main**.
- **GO V1 :** tags de prise en charge visibles et synchronisés dans DossierClé et dans la boîte e-mail avant toute action autonome externe.
- **GO V1 :** trois rapports opérationnels du lundi au vendredi à 8h45, 13h30 et 16h00, envoyés par e-mail et archivés dans DossierClé.
- **GO V1 :** annuaire artisans administré par saisie manuelle et import CSV.
- **GO V2 :** invitation sécurisée permettant à l’artisan de compléter sa fiche.
- **DEFER :** compte artisan permanent et tableau de bord après la V2.
- **KILL V1 :** n8n comme moteur du SaaS.
- **KILL V1 :** engagement financier ou affectation artisan entièrement autonome.

## PRD Gate

- [x] problème clair
- [x] utilisateurs clairs
- [x] scope clair
- [x] non-scope explicite
- [x] valeur claire
- [x] succès mesurable
- [x] risques listés
- [x] aucune question bloquante

**Verdict : PASS**

Le PRD peut être transformé en Stories. Les décisions restantes doivent être traitées dans l’Architecture ou avant le pilote, sans modifier silencieusement le scope, le persona ni la politique de validation humaine définis ici.
