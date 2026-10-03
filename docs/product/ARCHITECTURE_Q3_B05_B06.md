# Q3 — Qualification B05+B06 : messagerie et IA

Date de qualification : **2026-10-03** (recherche commencée le 2026-10-02). Issue [#39](https://github.com/issa-diallo/dossiercle/issues/39). Mode LARGE. Sources primaires publiques uniquement. Aucun compte, vraie boîte, donnée réelle, benchmark, POC, achat ou ressource cloud n'a été utilisé.

## Verdict

| Bloc | Verdict Q3 | Motif |
|---|---|---|
| **B05 — connecteurs mail** | **BLOCKED, contrat documentaire établi** | Gmail et Microsoft Graph ont les capacités nécessaires sur documentation. IMAP/SMTP reste dépendant du serveur et du client pour les keywords, la fraîcheur et le readback. Les limites d'exploitation réelles, l'onboarding OAuth publié et les comportements concurrents nécessitent une preuve synthétique autorisée `B05-P-1` avant Architecture PASS. |
| **B06 — IA/privacy/coûts** | **BLOCKED, catalogue et coûts publics établis** | Qwen via Scaleway et Mistral exposent texte/vision/sorties structurées ; Mistral expose un OCR tarifé. Les documents ne démontrent ni qualité DossierClé, ni extraction fidèle/provenance, ni purge bout-en-bout. Les garanties privacy ont des exceptions et réglages distincts. `B06-P-1` est nécessaire avant sélection finale du modèle et dimensionnement de l'enveloppe. |

Ces verdicts ne modifient pas ADR-007/008, n'autorisent pas les POC et ne débloquent pas l'Architecture.

# B05 — contrats de capacité mail

## Matrice commune

| Capacité | Gmail API | Microsoft Graph | IMAP/SMTP |
|---|---|---|---|
| Réception | `history.list` après synchronisation complète et curseur `historyId`; notification push = signal de changement, pas contenu ni autorisation.[2][5] | Delta par dossier avec `@odata.nextLink`/`@odata.deltaLink`; le jeton est scoped au dossier et opaque.[11] | `UIDVALIDITY` + UID par mailbox ; resynchronisation obligatoire après changement de validité. Inspecter version et `CAPABILITY` : IMAP4rev2 intègre certaines fonctions historiques, tandis que CONDSTORE/QRESYNC exigent les capacités définies par RFC 7162 ; IDLE doit être établi selon le protocole/capability réellement annoncé.[13][32][33] |
| Envoi | `messages.send`; coût quota 100 unités par appel.[4] | `Mail.Send`, permission distincte de `Mail.ReadWrite`; copie dans Sent possible même sans `Mail.ReadWrite`.[7] | SMTP submission séparé d'IMAP. TLS implicite recommandé ; STARTTLS reste à vérifier par profil fournisseur. OAuth SASL est normalisé mais sa disponibilité dépend du serveur.[14][15][17] |
| Marquage métier | Labels appliqués aux **messages** ; une opération thread touche les messages existants, mais un nouveau message du thread n'hérite pas automatiquement du label.[3] | `categories` modifiable par PATCH avec `Mail.ReadWrite`; préserver les catégories étrangères et `isRead`, puis relire la ressource.[7][8] | Keywords seulement si le serveur les accepte et les persiste ; `PERMANENTFLAGS` détermine les flags/keywords modifiables et `\*` autorise de nouveaux keywords.[13] |
| Readback | GET message/thread après modification ; vérifier chaque nouveau message du thread.[3] | GET avec `categories` après PATCH ; ne pas utiliser `isRead` comme vérité métier.[8][9] | FETCH des FLAGS après STORE, sur le même `UIDVALIDITY`/UID ; échec ou absence de keyword persistant bloque l'autonomie.[13] |
| Notification | Watch Gmail via Google Cloud Pub/Sub, renouvelé au moins tous les 7 jours, recommandé quotidiennement.[2] | Subscription renouvelable ; Outlook message max 10 080 minutes, ou 1 440 minutes avec rich resource data ; 1 000 subscriptions actives max par mailbox toutes apps confondues.[10] | IDLE si annoncé, sinon polling borné. Aucun webhook standard IMAP.[13] |
| Déduplication | Clé fournisseur scoped agence+boîte+message ; `historyId` n'est pas une preuve d'unicité métier globale.[5] | Identifiant Graph + dossier/cursor ; déplacement et delta par dossier doivent être réconciliés.[11] | `(mailbox, UIDVALIDITY, UID)` ; `Message-ID` reste une donnée du message, pas une clé de confiance globale.[13] |
| Authenticité expéditeur | Transport OAuth authentifie la boîte connectée, pas l'auteur déclaré du message. Lire les résultats d'authentification fournis par le domaine récepteur et contrôler From/Sender/Reply-To ; ne jamais faire confiance à un `Authentication-Results` forgé hors chaîne de confiance.[16] | `internetMessageHeaders` est en lecture seule avec `$select`; même règle de confiance sur le serveur ayant ajouté les résultats.[9][16] | Conserver/analyser les en-têtes reçus du serveur de confiance ; IMAP ne valide pas à lui seul SPF/DKIM/DMARC.[13][16] |
| Coût API public | Usage standard sans surcoût sous **80 000 000 unités/jour/projet** ; Google prévoit une facturation au-delà plus tard en 2026, détails futurs avec préavis ≥90 jours. Pub/Sub : 10 GiB/mois de débit Message Delivery Basic gratuits, puis 40 USD/TiB, plus transferts/rétention éventuels.[4][6] | Aucun tarif public par appel Outlook Graph identifié dans les sources ; licences Microsoft 365 et hébergement restent hors calcul. | Aucun tarif/quota universel : dépend du fournisseur de messagerie, du forfait et des limites SMTP/IMAP. |

## Gmail — contrat proposé

### OAuth et scopes

- **Connexion pilote déléguée par utilisateur**, état OAuth lié à session+agence+boîte, PKCE et callback exact ; pas de délégation domaine par défaut.
- Scope pratique minimal pour lire le corps, modifier les labels et envoyer : `https://www.googleapis.com/auth/gmail.modify`. Il est classé **restricted**, couvre lecture/compose/envoi sans suppression permanente. Ne pas demander `https://mail.google.com/`.[1]
- Si la séparation contractuelle envoi/réception doit être visible dans le consentement, étudier deux connexions/app-clients ; ajouter `gmail.send` à `gmail.modify` serait redondant et n'enlèverait pas la capacité d'envoi déjà accordée. La séparation obligatoire demeure donc applicative et auditée.
- Une application publique utilisant des scopes restricted et transmettant/stockant leurs données côté serveur est soumise à la vérification Google et à une évaluation de sécurité.[1]

### Quotas et garde-fous

Les limites publiées sont **1 200 000 unités/minute/projet**, **6 000 unités/minute/utilisateur/projet** et un seuil sans frais de **80 000 000 unités/jour/projet**. Google annonce que le dépassement des quotas de requêtes doit devenir facturable plus tard en 2026 ; le barème n'est pas encore publié et doit être surveillé comme coût variable inconnu. `messages.send` coûte 100, `messages.modify` 5 et `history.list` 2 unités.[4]

Proposition à Q5, sans en faire un quota commercial :

1. file séparée réception/marquage/envoi par boîte ;
2. budget fournisseur paramétrable inférieur aux limites publiées, sans convertir la limite maximale en cible ;
3. backoff sur `429`/`403`, reconciliation `history.list`, et aucune seconde émission quand le résultat d'envoi est inconnu ;
4. renouvellement `watch` quotidien, alerte avant expiration, polling de rattrapage par history cursor ;
5. coût Pub/Sub présenté comme coût plateforme variable, même si le faible volume pilote peut rester sous le palier gratuit.[2][4][6]
6. ledger journalisant les unités Gmail quotidiennes, alerte avant le seuil de 80 millions et aucune hypothèse de gratuité au-delà ; Q5 doit traiter le futur barème comme inconnu potentiellement facturable.[4]

### Expiration du curseur `historyId`

Les historiques sont généralement disponibles au moins une semaine, mais peuvent être indisponibles plus tôt. Un `startHistoryId` hors plage renvoie HTTP `404` et impose une synchronisation complète.[5]

Cette reprise complète reste confinée à la période choisie par l'agence : requête fournisseur bornée lorsque possible, filtre défensif avant ingestion, aucune lecture/affichage/notification hors période, déduplication avec les éléments déjà traités et aucune action rétroactive automatique. Si le confinement ne peut être démontré, la boîte passe en mode manuel et la reprise s'arrête.

### Conclusion Gmail

**Qualifiable documentairement pour réception/envoi/label.** Restent à prouver dans `B05-P-1` : app OAuth publiée/consentement restricted, push authentifié et anti-rejeu, course humain/IA, readback, messages ajoutés à un thread et résultat d'envoi inconnu.

## Microsoft Graph — contrat proposé

### OAuth et scopes

- Pilote : permissions **delegated** `offline_access`, `Mail.ReadWrite`, `Mail.Send` et identité de base nécessaire à l'OAuth ; pas de permission application tenant-wide par défaut.
- `Mail.ReadWrite` permet créer/lire/mettre à jour/supprimer mais **pas envoyer** ; `Mail.Send` est distinct. Les variantes `.Shared` sont nécessaires pour les boîtes partagées accessibles par l'utilisateur.[7]
- Si une permission application devient nécessaire, elle exige consentement administrateur et politique d'accès limitant explicitement les mailboxes ; ce changement est un arbitrage sécurité B04/B05, pas un détail d'implémentation.[7]

### Synchronisation, subscriptions et quotas

- Delta est **par dossier** : stocker séparément les curseurs Inbox/éventuels dossiers suivis et traiter les liens opaques sans les reconstruire.[11]
- Subscription Outlook : renouveler avant expiration ; durée max documentée 10 080 minutes, rich notifications 1 440 minutes. Une notification ne remplace jamais le delta de réconciliation.[10][11]
- Limites Outlook publiées par combinaison app ID + mailbox : **10 000 requêtes/10 minutes**, **4 requêtes concurrentes**, **150 MB upload/5 minutes**.[12]

Proposition à Q5 : limiter la concurrence applicative en dessous de 4 par boîte, réserver une marge au renouvellement/delta/readback, et traiter `Retry-After` comme autorité. Le quota commercial ne doit pas être dérivé directement du plafond Microsoft.

### Conclusion Graph

**Qualifiable documentairement pour réception/envoi/catégories.** `B05-P-1` doit confirmer subscription/clientState/anti-rejeu, delta après déplacement/suppression, PATCH préservant catégories étrangères et `isRead`, boîtes partagées, throttling et envoi à résultat inconnu.

## IMAP/SMTP — contrat proposé

### Profil obligatoire par boîte

Une connexion n'est activable qu'après découverte et enregistrement d'un profil : hôtes/ports, nom TLS/SNI, chaîne de certificat, mécanisme auth, extensions IMAP (`IDLE`, `MOVE`, `UIDPLUS`, `CONDSTORE`, `QRESYNC`), `PERMANENTFLAGS`, création/STORE/FETCH du keyword DossierClé, limites de taille et limites fournisseur SMTP.

- IMAP : TLS strict, aucun fallback clair ; OAuth SASL si disponible, sinon secret dédié en coffre. Distinguer IMAP4rev1/IMAP4rev2 et relever `CAPABILITY` à chaque connexion ; IDLE, CONDSTORE et QRESYNC ne sont jamais supposés à partir du seul nom commercial du serveur.[13][14][15][32][33]
- SMTP : submission distincte, TLS implicite préféré selon RFC 8314 ; aucun envoi de test à un vrai destinataire pendant la qualification documentaire.[14][17]
- Si `PERMANENTFLAGS` n'autorise pas un keyword persistant ou si le client masque/supprime le keyword, **réception et travail manuel seulement ; autonomie externe bloquée pour cette boîte**.[13]
- Un dossier dédié peut être une alternative seulement après preuve que déplacement, UIDs, clients et recherche restent sûrs ; ne jamais déplacer implicitement un message en production.

### Conclusion IMAP/SMTP

**BLOCKED sans `B05-P-1`** sur chaque famille serveur/client réellement envisagée. Le RFC définit le protocole mais ne prouve ni limites fournisseur, ni persistance/visibilité des keywords, ni interaction du client de l'agence.

## Frontière temporelle de reprise

Tous les adaptateurs doivent recevoir une période choisie sans défaut et appliquer le filtre côté requête lorsque possible, puis côté ingestion en défense. Aucun inventaire, aperçu, notification ou recherche hors période. Les références conservées sont descriptives : fournisseur, boîte, dossier, identifiant interne fournisseur, date, expéditeur/objet minimisés ; aucun `webLink` Graph ni URL Gmail cliquable. Déplacement/suppression de la source rend la référence potentiellement non résoluble et doit être indiqué sans copie durable cachée.

# B06 — IA, privacy, coûts, BYOK et OCR

## Catalogue daté proposé

| Route | Capacités documentées au 2026-10-02 | Tarif public | Statut DossierClé |
|---|---|---|---|
| Scaleway Serverless `qwen3.6-35b-a3b` | Texte, code, vision ; fenêtre 256k ; structured output, function calling et parallel tool-calling ; images PNG/JPEG/GIF, sortie serverless max 32k.[18] | **0,25 EUR/M tokens entrée ; 1,50 EUR/M tokens sortie**.[19] | **Principal candidat**, non qualifié. Bon contrat technique pour extraction/synthèse JSON et images ; pas de PDF natif ni preuve de fidélité métier. |
| Mistral API EU — Small 4 | Texte/multimodal selon modèle, sorties structurées et function calling disponibles dans la plateforme.[27][28] | **0,15 USD/M entrée ; 0,015 USD/M cached input ; 0,60 USD/M sortie**, puis **+10 %** sur endpoint régional UE.[25][26] | **Secours/candidat BYOK économique** ; disponibilité du modèle à vérifier par `models.list` sur la base régionale UE avant sélection ; identifiant versionné, jamais alias `latest`. |
| Mistral API EU Medium 3.5 | Modèle multimodal plus coûteux ; structured output/function calling selon catalogue.[25][27][28] | **1,50 USD/M entrée ; 0,15 USD/M cached input ; 7,50 USD/M sortie**, puis **+10 % UE**.[25][26] | Candidat seulement si présent dans `models.list` UE et si Small/Qwen échoue au protocole synthétique ; pas fallback global automatique. |
| Mistral OCR 4.1 | OCR/document extraction ; endpoint `/v1/ocr` éligible ZDR stateless.[25][29] | **4 USD/1 000 pages** standard ; **0,40 USD/1 000 pages** cached, puis +10 % si disponible/routé via endpoint régional UE à confirmer pour cette fonction.[25][26] | Candidat OCR explicite, mais sélection **BLOCKED** avant P06 ; ne pas confondre OCR et preuve d'authenticité. |

Les monnaies, taxes, remises, batch, cache et arrondis doivent rester séparés ; aucune conversion EUR/USD n'est figée par Q3. La facture fournisseur prévaut pour BYOK.

## Privacy et contrats

### Scaleway Generative APIs

- Serverless est actuellement hébergé à Paris chez OPCORE ; Scaleway annonce maintien en Europe si d'autres régions sont ajoutées. Le serverless ne garantit pas une région unique future ; Dedicated Deployment est recommandé par Scaleway pour l'imposer.[21]
- Les limites de consommation Serverless sont gérées par quotas d'organisation et doivent être relues pour le modèle/compte au moment du gel ; Q3 ne transforme pas une valeur vivante du tableau en plafond commercial.[22]
- ZDR par défaut ne signifie pas zéro donnée absolu : métadonnées de requête et compteurs de tokens sont collectés ; les données agrégées/anonymisées d'usage peuvent être gardées jusqu'à six mois. En cas d'erreur/abus affectant le service, le contenu HTTP complet peut être stocké et consulté jusqu'à deux semaines.[20]
- Scaleway affirme ne pas utiliser prompts/sorties pour entraîner ou améliorer les modèles et ne pas les rendre accessibles aux créateurs des modèles.[20]
- Le DPA public 2024 prévoit le rôle de sous-traitant, l'encadrement des sous-traitants et leur notification ; la liste publique inclut notamment OPCORE en France pour la colocation. La liste est générale à Scaleway et ne constitue pas seule une cartographie exhaustive spécifique Generative APIs.[23][24]

**Réserve B06/B08 :** accepter contractuellement l'exception de deux semaines ou choisir une route différente ; documenter données minimisées, erreurs, support et droit d'opposition aux changements de sous-traitants avant données réelles.

### Mistral direct / BYOK

- Le endpoint global ne garantit pas de lieu. `api.eu.mistral.ai` traite l'inférence dans plusieurs datacenters UE/EFTA, avec surcoût 10 %, mais le control plane (compte, clés, facturation, accès, analytics et métadonnées opérationnelles) peut rester hors de la géographie choisie.[26]
- La disponibilité varie par région : avant tout trafic, appeler `models.list` contre la base URL UE et enregistrer l'identifiant effectivement disponible. Un prix catalogue ne prouve pas qu'un modèle est servi dans la région.[26]
- ZDR est disponible en pay-as-you-go et seulement pour les endpoints stateless listés, dont chat, OCR, audio et classifications ; il n'est pas disponible pour agents, conversations, batch/files et autres produits stateful.[29]
- ZDR et opt-out d'entraînement sont des contrôles séparés. Le DPA autorise l'entraînement selon la Privacy Policy tant que le client n'a pas opt-out ; un feedback thumbs up/down et les entrées/sorties associées peuvent être utilisés comme Controller.[29][30]
- Le DPA maintient la liste des sous-traitants dans le Trust Center et permet l'abonnement aux notifications. La liste exacte et ses localisations doivent être capturées au moment de l'activation BYOK ; la page d'aide seule n'est pas une preuve figée du contenu de cette liste.[30][31]

**Condition d'activation BYOK :** preuve dans le compte de l'endpoint UE, pay-as-you-go, ZDR activé, training opt-out activé, DPA applicable, liste des sous-traitants datée, fonctions utilisées toutes stateless, aucune fonction de feedback.

## OCR et pièces temporaires

Pipeline candidat, non approuvé :

1. antivirus/quarantaine réussie ;
2. extraction locale du texte PDF lorsque disponible ;
3. vision Qwen sur images/pages sélectionnées ou OCR Mistral uniquement si nécessaire ;
4. schéma structuré : fait, valeur, source/page, confiance, contradiction, champ manquant ;
5. validation serveur puis humaine pour tout fait essentiel contradictoire/manquant ;
6. suppression de l'objet de travail et des dérivés temporaires selon une politique B08 encore à approuver.

Structured output impose une forme, **pas la vérité du contenu**.[18][27] Aucune route IA ne décide authenticité d'une pièce, solvabilité, acceptation/refus d'un candidat ou droit d'envoyer.

## Ledger, enveloppe et fallback

### Écriture de coût minimale

Chaque appel logique réserve avant réseau :

- `agency_id`, période mensuelle et `logical_call_id` unique ;
- fournisseur, endpoint/région, modèle **versionné**, tâche et version de prompt/schéma ;
- version tarifaire, monnaie, prix entrée/sortie/page/cache et multiplicateur régional ;
- maxima autorisés de tokens entrée/sortie, images/pages, retries et coût maximal calculable ;
- route incluse ou BYOK, consentement fallback et mandat courant.

Après réponse certaine : finaliser avec usage fournisseur, conserver estimation et facture comme autorités distinctes. Réponse inconnue : garder la réserve et réconcilier ; ne pas relancer vers un autre fournisseur. Échec certain avant traitement : libérer puis créer un nouvel essai audité. Changement de mois : aucune réserve déplacée ou créditée deux fois.

### Ordre de fallback

1. fournisseur/modèle choisi et autorisé ;
2. si BYOK invalide, épuisé ou indisponible, Qwen inclus seulement avec consentement initial et enveloppe disponible ;
3. Mistral ou autre fournisseur seulement avec consentement explicite par tâche et garanties privacy/capacités compatibles ;
4. sinon tâche IA en attente, mail et travail manuel continuent.

Le retour au fournisseur choisi concerne uniquement les futurs appels après vérification de clé/budget et stabilité. Aucun replay automatique d'un appel au résultat inconnu.

## Plafonds proposés à Q5

Ces valeurs sont des **bornes de sécurité à arbitrer**, pas une offre commerciale ni un dimensionnement validé :

| Sujet | Proposition Q3 à chiffrer/arbitrer dans Q5 |
|---|---|
| Appel IA | Définir un profil par tâche avec maximum entrée/sortie/pages et coût maximal. Refuser tout appel sans borne ; ne jamais utiliser la fenêtre 256k comme taille par défaut. |
| Triage d'un message | Une seule synthèse/extraction initiale par version de message ; nouveau calcul seulement si contenu ou schéma change, avec clé logique dédupliquée. |
| Synthèse dossier | Recalcul incrémental depuis faits structurés ; ne pas renvoyer tout l'historique par défaut. Plafond de coût/dossier et de recalculs/jour à fixer après P06. |
| OCR | Pages/images effectivement utiles seulement ; plafond par pièce et par dossier à aligner sur la politique 20 Mo/formats B08. Pas de batch stateful Mistral sous exigence ZDR. |
| Gmail | Réserver des unités sous les 6 000 unités/min/utilisateur, 1 200 000/min/projet et 80 000 000/jour/projet ; séparer budgets sync/tag/send, garder marge renouvellement/rattrapage et traiter le futur tarif de dépassement comme inconnu. |
| Graph | Concurrence applicative strictement sous 4/app/mailbox ; marge sous 10 000 requêtes/10 min et 150 MB/5 min ; `Retry-After` prioritaire. |
| IMAP/SMTP | Aucun chiffre générique. Profil fournisseur obligatoire ; si limites inconnues, polling et envoi autonome restent désactivés jusqu'à arbitrage. |
| Reprise historique | Période choisie sans défaut + plafond messages/pages/tokens/coût visible avant lancement ; arrêt ferme ou extension explicitement approuvée, jamais dépassement silencieux. |
| Enveloppe incluse | Ne pas promettre illimité. Calculer après P06 : somme des maxima par tâche × volumes Sinistres/Location × reprises/retries autorisés + marge d'exploitation ; renouvellement mensuel sans cumul. |

Aucun total par dossier n'est annoncé : les sources donnent des prix unitaires, mais le corpus ne fournit pas encore de distribution validée de tokens/pages/messages. Inventer un coût moyen créerait une fausse précision.

# Demandes pré-Architecture nécessaires, non autorisées

## `B05-P-1` — readback et concurrence connecteurs

**Nécessaire : oui.** Les RFC et API ne prouvent pas les combinaisons réelles serveur/client, les courses de tags ni l'onboarding publié.

**Statut : protocole documentaire non autorisé.**

### Hypothèse et préconditions

Chaque adaptateur peut reprendre uniquement la période explicitement choisie, dédupliquer les notifications et confirmer un marquage frais sans modifier l'état lu/non lu ni agir avec un auteur ou résultat d'envoi incertain.

Avant exécution : autorisation humaine distincte, durée/budget/quota plafonnés, comptes de test isolés, aucune adresse/client réel, messages synthétiques datés **dans et hors période**, un adaptateur à la fois et inventaire de nettoyage approuvé.

### Scénarios

1. OAuth state/PKCE/callback, renouvellement watch/subscription et révocation ;
2. double notification, notification tardive et reprise curseur ;
3. Gmail `historyId` valide puis expiré/HTTP 404, full sync bornée à la période ;
4. Graph delta après déplacement/suppression et boîte partagée ;
5. IMAP `UIDVALIDITY`, capacités rev1/rev2, keyword, dossier et client final ;
6. tag humain concurrent, catégorie/label étranger et readback ;
7. vérification que `isRead`/`\\Seen` reste inchangé par inventaire et marquage ;
8. auteur absent/ambigu ou en-tête non fiable ;
9. SMTP/API : réponse perdue après envoi simulé et réconciliation avant retry ;
10. tentative de lire, lister, afficher, notifier ou agir sur chaque fixture hors période.

### Succès mesurable

- zéro lecture de contenu, affichage, notification ou action hors période ;
- chaque événement dans la période produit au plus une ingestion logique ;
- full sync après 404 reste bornée, dédupliquée et sans action rétroactive ;
- label/catégorie/keyword attendu présent après readback, éléments étrangers et `isRead`/`\\Seen` inchangés ;
- auteur ambigu et résultat d'envoi inconnu bloquent l'autonomie ;
- aucun deuxième envoi avant réconciliation.

### Échec, arrêt, nettoyage et revue

Arrêt immédiat sur accès hors période, mutation lu/non lu, doublon d'effet, secret/log sensible, coût/durée hors plafond ou impossibilité de readback. Révoquer tokens/subscriptions, supprimer messages/boîtes/keywords de test, vérifier l'absence de ressources et publier résultats/limites pour revue indépendante. Un échec de marquage bloque l'autonomie pour la boîte sans retirer le connecteur manuel.

## `B06-P-1` — capacités, purge et coût borné

**Nécessaire : oui.** La documentation démontre des interfaces, pas la fidélité/provenance DossierClé ni la purge bout-en-bout.

**Statut : protocole documentaire non autorisé.**

### Hypothèse et préconditions

Un modèle n'est sélectionnable que s'il produit des objets structurés fidèles, chaque fait essentiel relié à une source/page, s'abstient sur les contradictions ou manques et laisse zéro résidu contraire à la politique approuvée.

Avant exécution : autorisation humaine distincte, corpus synthétique français versionné (Sinistres puis Location), gold set et seuils figés, modèles/endpoints/régions disponibles enregistrés, durée/budget/tokens/pages/retries plafonnés, aucun compte BYOK ou donnée réelle.

### Scénarios et seuils de sélection fail-closed

1. texte, PDF texte, scan, photo, champs manquants et contradictions ;
2. injection prompt et pièce simulée en quarantaine ;
3. Qwen principal, puis Mistral/OCR seulement si disponibilité UE et nécessité établies ;
4. extraction locale comparée avant OCR distant ;
5. panne, timeout, réponse perdue, budget épuisé et fallback interdit/non consenti ;
6. inspection objets, logs, traces, retries, cache et fournisseur après purge.

Minimum pour être candidat : **100 %** des schémas valides ; **zéro** fait essentiel non sourcé ou faux sur le gold set ; **100 %** des faits essentiels avec référence exacte au document/page ; **100 %** d'abstention ou signalement sur champ essentiel manquant/contradictoire ; **zéro** instruction issue de la pièce exécutée ; coût par cas sous le plafond approuvé. Les mesures non essentielles et seuils de performance complémentaires sont fixés avant essai, jamais après observation des résultats.

### Échec, arrêt, nettoyage et revue

Arrêt immédiat sur fait essentiel faux/non sourcé, action externe, fuite de contenu, fonction stateful contraire au ZDR, modèle absent de la région, coût/durée hors plafond ou résidu au-delà du délai approuvé. Supprimer objets de travail, fichiers, caches et credentials de test ; vérifier les journaux et preuves de suppression/rétention fournisseur ; publier matrice par modèle, coûts dans leur monnaie, échecs et limites pour revue indépendante. Tout défaut privacy/purge rejette la route, même si la qualité est bonne.

# Points à transmettre

## Q2 — flux final

- Gmail push ajoute une dépendance Google Cloud Pub/Sub hors Scaleway ; callback push authentifié ou pull authentifié à intégrer à la matrice B04.
- Graph notification exige endpoint public, validation et secret `clientState`; delta reste le mécanisme de réconciliation.[10][11]
- Mistral EU et Scaleway Serverless sont des endpoints publics ; Dedicated Deployment/Private Network est une option distincte, non chiffrée par Q3.[21][26]

## Q5 — coûts, quotas, privacy

- Q3 fournit uniquement prix unitaires publics et limites techniques ; Q5 doit fournir distributions synthétiques de messages/pages/tokens, change EUR/USD si comparaison consolidée, taxes, support et coût de supervision.
- Le coût Gmail inclut potentiellement Pub/Sub/transfert ; Graph/IMAP/SMTP n'ont pas de tarif API universel démontré.
- La conservation temporaire doit couvrir application, objets, scanners, logs, traces, retries, fournisseurs IA et backups ; « pas de copie durable » ne signifie pas « pas de traitement sensible ».
- Toute durée commune post-clôture reste B08 ; Q3 n'en propose aucune sans avis obligations/coûts.

## Arbitrages humains futurs

1. Accepter ou refuser l'exception Scaleway de contenu HTTP jusqu'à deux semaines en cas d'incident/abus.
2. Autoriser `B05-P-1` puis choisir les familles IMAP/clients réellement supportées.
3. Autoriser `B06-P-1`, son budget/durée et les seuils de sélection Qwen/Mistral/OCR.
4. Confirmer si Gmail restricted-scope verification/security assessment est acceptable commercialement.
5. Après Q5, fixer plafonds commercialisés de reprise, usage courant et complément payant.

## Sources

[1] https://developers.google.com/workspace/gmail/api/auth/scopes
[2] https://developers.google.com/workspace/gmail/api/guides/push
[3] https://developers.google.com/workspace/gmail/api/guides/labels
[4] https://developers.google.com/workspace/gmail/api/reference/quota
[5] https://developers.google.com/workspace/gmail/api/guides/sync
[6] https://cloud.google.com/pubsub/pricing
[7] https://learn.microsoft.com/en-us/graph/permissions-reference
[8] https://learn.microsoft.com/en-us/graph/api/message-update?view=graph-rest-1.0
[9] https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0
[10] https://learn.microsoft.com/en-us/graph/change-notifications-overview
[11] https://learn.microsoft.com/en-us/graph/delta-query-messages
[12] https://learn.microsoft.com/en-us/graph/throttling-limits
[13] https://www.rfc-editor.org/rfc/rfc9051.html
[14] https://www.rfc-editor.org/rfc/rfc8314.html
[15] https://www.rfc-editor.org/rfc/rfc7628.html
[16] https://www.rfc-editor.org/rfc/rfc8601.html
[17] https://www.rfc-editor.org/rfc/rfc5321.html
[18] https://www.scaleway.com/en/docs/generative-apis/reference-content/supported-models
[19] https://www.scaleway.com/en/pricing/model-as-a-service
[20] https://www.scaleway.com/en/docs/generative-apis/reference-content/data-privacy
[21] https://www.scaleway.com/en/docs/generative-apis/faq
[22] https://www.scaleway.com/en/docs/organizations-and-projects/organization/organization-quotas
[23] https://www.scaleway.com/en/subprocessorlist
[24] https://www-uploads.scaleway.com/DPA_2024_ENG_b0abb5cc26.pdf
[25] https://docs.mistral.ai/inference/pricing
[26] https://docs.mistral.ai/inference/regional-inference
[27] https://docs.mistral.ai/capabilities/structured-output/structured_output_overview
[28] https://docs.mistral.ai/studio/conversations/function-calling
[29] https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr
[30] https://legal.mistral.ai/terms/data-processing-addendum
[31] https://help.mistral.ai/en/articles/455208-who-are-your-subprocessors-and-how-can-i-stay-updated-on-changes
[32] https://www.rfc-editor.org/rfc/rfc2177.html
[33] https://www.rfc-editor.org/rfc/rfc7162.html
