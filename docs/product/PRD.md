# PRD — DossierClé

## Status

`PRD: PASS`

- **Nom de travail :** DossierClé
- **Mode projet :** LARGE
- **Dernière mise à jour :** 2026-09-28
- **Source :** décisions de cadrage validées avec le porteur du projet
- **Décision de cadrage :** agence mixte, Sinistres d’abord puis Biens, validation humaine de tous les e-mails sortants en V1

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
- un risque d’action inadaptée si une automatisation agit sans validation humaine.

DossierClé doit centraliser ces flux, les rattacher aux bons contacts et dossiers, puis assister l’agence dans leur traitement sans devenir un logiciel immobilier généraliste.

## Utilisateurs

### Principal

Le persona principal est le collaborateur opérationnel d’une **agence mixte** qui traite à la fois :

- les demandes de transaction ou location liées aux biens ;
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
- **une assistance opérationnelle** pour extraire, classer, résumer et rédiger ;
- **des règles déterministes** pour les décisions métier contrôlables ;
- **une validation humaine** pour les engagements et cas sensibles ;
- **une isolation forte** entre les agences ;
- **une infrastructure à l’usage**, sans administration de CPU, RAM ou serveurs par les agences.

## Principes produit obligatoires

1. **L’e-mail original reste la source reçue.** Toute extraction ou classification doit être corrigeable.
2. **L’IA assiste, elle ne décide pas seule d’un engagement.**
3. **Les règles métier déterministes priment sur une réponse générative.**
4. **Chaque action externe est traçable.**
5. **Une agence ne peut jamais accéder aux données d’une autre agence.**
6. **Un échec de traitement ne doit pas provoquer la perte du message.**
7. **Les agences ne gèrent pas l’infrastructure technique.**
8. **Le produit reste spécialisé dans le traitement des demandes et dossiers issus des communications.**

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
- possibilité de corriger la classification et les données extraites ;
- reprise automatique ou manuelle après échec ;
- aucune disparition silencieuse d’un message en erreur.

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
- conserver l’historique des décisions et échanges.

L’intégration à un logiciel immobilier existant n’est pas présumée en V1 et devra faire l’objet d’une décision séparée.

### 6. Workflow Sinistres

La V1 doit permettre de :

- enregistrer une déclaration de sinistre issue d’un e-mail ;
- identifier le logement ou dossier concerné lorsque les informations le permettent ;
- classifier le type de sinistre ;
- signaler les informations et pièces manquantes ;
- proposer un niveau d’urgence avec justification ;
- identifier la spécialité artisan nécessaire ;
- proposer des artisans compatibles ;
- préparer les messages à envoyer ;
- suivre les relances, devis, rendez-vous et état de résolution ;
- conserver l’historique des validations humaines.

Le système ne doit pas promettre une indemnisation, accepter un devis, engager une dépense, confirmer un artisan ou clôturer un litige sans validation humaine.

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

L’IA peut expliquer ou résumer la proposition, mais elle ne remplace pas les filtres métier ni la validation de l’agence.

### 9. Supervision fonctionnelle

- vue des messages en attente, en cours, terminés et en erreur ;
- vue des validations humaines en attente ;
- indication claire de la boîte, du contact et du dossier concernés ;
- journal des actions externes et changements d’état ;
- possibilité de relancer une tâche échouée sans créer de doublon ;
- alertes de connexion e-mail expirée ou défaillante.

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
3. Le système classe la demande ou la place dans À vérifier.
4. Les critères, le bien et les informations manquantes sont proposés.
5. Le collaborateur corrige ou valide les informations utiles.
6. Le système prépare la prochaine action et une réponse.
7. Un humain valide obligatoirement le brouillon avant l’envoi, puis l’envoi est tracé.
8. Le dossier et l’historique sont mis à jour.

### Parcours C — Traiter un sinistre

1. Une déclaration est reçue et rattachée à un contact et un dossier.
2. Le système extrait le type de sinistre, le lieu et les informations disponibles.
3. Les informations manquantes et l’urgence proposée sont affichées.
4. Le collaborateur valide ou corrige la qualification.
5. Le système filtre les artisans compatibles.
6. L’agence choisit et valide l’artisan à contacter.
7. Les échanges, relances, devis et rendez-vous sont suivis.
8. La résolution est confirmée par un humain avant clôture dans les cas définis.

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

## Capacités principales

- multi-agence avec isolation stricte ;
- multi-boîtes par agence ;
- ingestion et déduplication d’e-mails ;
- contacts multi-adresses ;
- conversations et dossiers séparés ;
- classification et extraction assistées ;
- workflow Biens ;
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

- moteur propriétaire, sans dépendance à n8n ;
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

## Validation humaine

### Actions nécessitant toujours une confirmation en V1

- affecter définitivement un artisan ;
- envoyer un engagement à un artisan ;
- accepter ou refuser un devis ;
- engager une dépense ;
- promettre une indemnisation ou une prise en charge ;
- clôturer un sinistre litigieux ;
- fusionner des contacts lorsque le rapprochement est ambigu ;
- activer un artisan dont les informations nécessitent une vérification ;
- rendre utilisable un import comportant des erreurs ou doublons non résolus.

### Actions automatisables

- recevoir et conserver un message ;
- détecter un doublon ;
- extraire des informations structurées ;
- proposer une classification, un résumé et une prochaine action ;
- préparer un brouillon de réponse ;
- filtrer des artisans avec des règles déterministes ;
- signaler une information manquante ou un justificatif expirant ;
- préparer une relance selon une règle validée, sans l’envoyer avant confirmation humaine ;
- retenter une tâche technique idempotente.

### Politique des e-mails sortants en V1

- tous les e-mails sortants nécessitent une validation humaine avant envoi ;
- le système peut préparer un brouillon, mais ne l’envoie pas seul ;
- la décision, l’auteur de la validation et l’envoi sont tracés ;
- toute automatisation future de l’envoi exige une nouvelle décision produit et une analyse de risque.

## Critères de succès

### Succès fonctionnel du pilote

- une agence pilote connecte au moins deux boîtes réelles et indépendantes ;
- les alias sont testés séparément sans être comptés comme une deuxième boîte ;
- chaque message de test apparaît une seule fois ;
- les messages sont rattachables à un contact, une conversation et un dossier ;
- les erreurs de classification et rapprochement sont corrigeables ;
- les parcours Biens et Sinistres atteignent une prochaine action claire ;
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
- aucun envoi d’e-mail sans validation humaine ;
- sauvegarde et restauration démontrées ;
- cinq scénarios de charge conformes aux seuils du PRD ;
- aucun finding de sécurité Critical ou Major ouvert.

**GO** si toutes les préconditions sont satisfaites et si :

- au moins deux collaborateurs utilisent DossierClé pendant au moins trois jours distincts par semaine sur chacune des quatre semaines ;
- le temps médian de traitement diminue d’au moins 25 % pour les Sinistres et d’au moins 25 % pour les demandes de Biens, à échantillon comparable ;
- au moins 70 % des brouillons envoyés après validation ne nécessitent pas de correction du destinataire, du dossier, de la classification ou de l’action proposée ;
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
- langage et framework du moteur propriétaire ;
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

- **GO :** moteur propriétaire sans n8n ; le langage et le framework seront formalisés en Architecture.
- **GO :** hébergement sur Scaleway Paris.
- **GO :** infrastructure managée et serverless à l’usage, sans gestion CPU/RAM par les agences.
- **GO :** base distincte par agence.
- **GO :** plusieurs boîtes surveillées par agence.
- **GO V1 :** agence mixte comme persona principal.
- **GO V1 :** workflow Sinistres construit et validé avant Biens, les deux restant inclus dans la V1.
- **GO V1 :** validation humaine obligatoire de tous les e-mails sortants.
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
