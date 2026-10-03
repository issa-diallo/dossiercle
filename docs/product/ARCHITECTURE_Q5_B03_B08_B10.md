# Q5 — Qualification B08, B10 et B03

**Date de qualification : 2026-10-03. Issue cible : [#41](https://github.com/issa-diallo/dossiercle/issues/41). Mode : LARGE — recherche documentaire en lecture seule. Statut global : `BLOCKED`.**

## 0. Portée, limites et règle de preuve
Ce document consolide Q1 à Q4 pour qualifier :
- **B08** — quotas, formats, coûts, conservation, droits, sous-traitants et export ; **B10** — disponibilité interne, support, astreinte, capacité opératoire et runbooks ; **B03** — faisabilité de D58, avec RPO et RTO chacun strictement inférieurs à quatre heures pour la perte d'un datacenter/AZ, et chiffrage séparé du risque régional.
La qualification s'appuie uniquement sur les documents existants du dépôt et sur les sources primaires officielles déjà relevées ou vérifiées le 3 octobre 2026.[1][2][3][4][5][6][7][8][9][10][11][12][13][14] Aucun compte fournisseur, compte mail, environnement QA, devis, contact commercial, ressource cloud, dépense, POC, installation, benchmark, restauration, donnée réelle ou secret n'a été créé ou utilisé.
Les montants publics sont des observations datées, hors taxes lorsqu'indiqué par le fournisseur, et non des devis. Les scénarios de volumes sont synthétiques. Ils ne décrivent ni la consommation d'une agence réelle, ni un prix de vente, ni une capacité promise. Les montants en euros et en dollars restent séparés. Aucun taux de change EUR/USD n'est retenu. Une conclusion documentaire ne prouve pas :
- la qualité réelle d'un modèle IA ; la purge bout-en-bout ; la restauration d'une agence ; l'absence de doublon externe ; une disponibilité mesurée ; une organisation 24/7 engagée ; un RPO ou RTO de production.
Les propositions privacy et juridiques de ce document sont des hypothèses de travail. Elles exigent une revue privacy/juridique humaine avant adoption. Aucune durée n'est présentée comme une obligation légale universelle. Aucune règle de prescription ne suffit, à elle seule, à fixer une durée de conservation.
---
## 1. Tableau de verdict
| Bloc | Verdict | Résultat documentaire | Bloqueur décisif |
|---|---|---|---|
| **B08** | **`BLOCKED`** | prix unitaires, scénarios synthétiques, options de quotas, formats, rétention et droits consolidés | quotas commerciaux, durée commune, bases légales, rôles, politique de sauvegarde et contrats sous-traitants non approuvés |
| **B10** | **`BLOCKED`** | options 99,5/99,9/99,95 %, coûts support publics, modèles opératoires et runbooks définis | aucune rotation, aucun prestataire, aucun budget, aucun engagement 24/7 et aucune cible interne adoptée |
| **B03** | **`BLOCKED`** | états persistés, limites Scaleway, formules RPO/RTO, modes AZ/région, ordre de reprise et protocole P définis | point récupérable cohérent absent, Redis non garanti récupérable, anti-résurrection non stockée indépendamment et aucune preuve chronométrée |
Un résultat `BLOCKED` est le résultat correct tant que les décisions et preuves manquent. Il ne doit pas être converti en PASS par report implicite à la future phase Verify.
---
## 2. Décisions héritées et contraintes normatives
### 2.1 Produit et messagerie
- L'offre de lancement inclut **deux boîtes par agence** : une boîte Sinistres et une boîte Location.[2] ; Sinistres précède Location dans le séquençage produit.[2] ; L'offre inclut **trois comptes individuels par agence**, administrateur compris, partagés entre les modules.[2] ; Des comptes supplémentaires peuvent être vendus, mais leur prix et leur plafond ne sont pas fixés.[2]
- Les limites techniques Gmail, Graph ou IMAP ne deviennent jamais directement des quotas commerciaux.[5] ; La période de reprise historique est choisie par l'agence, sans valeur par défaut.[2][3] ; Aucun contenu hors période ne doit être lu, listé, affiché, notifié ou utilisé pour une action.[2][3]
- Une extension exige une demande expresse d'un collaborateur habilité puis un nouveau périmètre choisi par l'agence.[2][3]
### 2.2 Données conservées
- DossierClé ne conserve pas durablement les e-mails originaux ni les pièces jointes originales.[2] ; Les originaux restent dans la messagerie de l'agence.[2] ; DossierClé peut conserver les faits utiles structurés, de courts résumés, la synthèse de dossier, le suivi et la provenance nécessaire.[2] ; Un résumé ne doit pas devenir un substitut déguisé de l'original.[2]
- La référence à un e-mail est descriptive et non un lien cliquable.[2] ; Une source supprimée de la messagerie peut devenir irrécupérable ; le produit ne promet pas sa reconstruction.[2] ; Les pièces peuvent être traitées temporairement après quarantaine et antivirus, puis doivent être purgées selon une politique encore à approuver.[2][10]
### 2.3 Export et résiliation
- L'export DossierClé contient uniquement les données dérivées détenues par DossierClé : suivi, faits, résumés, synthèses et références descriptives.[2][3] ; Il ne contient ni EML ni pièces d'origine.[2][3] ; L'agence exporte elle-même les originaux depuis sa messagerie.[2][3] ; L'ancien contenu de D43 reste historique mais est supplanté sur cette portée.[2][3][11]
- L'archive d'export reste privée, temporaire, auditée et disponible pendant 24 heures selon la décision héritée, sous réserve de validation de sa mise en œuvre.[11] ; La fin d'abonnement coupe IA, connexions mail et tâches autonomes ; elle ne doit pas être annulée par une restauration ancienne.[11]
### 2.4 IA, coûts et fallback
- Qwen via Scaleway reste le candidat principal par défaut, non adopté.[5][9] ; Mistral direct reste un candidat BYOK ou de secours soumis au consentement explicite.[5][9] ; Le fallback ne s'applique qu'aux futurs appels. ; Une réponse fournisseur inconnue ne doit jamais être rejouée automatiquement vers un autre fournisseur.[5][9] ; L'enveloppe incluse se renouvelle mensuellement sans cumul.[9]
- L'épuisement de l'enveloppe suspend l'IA mais ne bloque ni le mail reçu ni le travail manuel.[9] ; Une réservation atomique du coût maximal précède chaque appel.[5][9]
### 2.5 Audit, reprise et exploitation
- L'audit métier est distinct des logs et traces techniques.[12] ; Les logs techniques ne doivent pas contenir de corps d'e-mail, document, secret, prompt ou résultat IA brut.[12][13] ; Les actes sensibles échouent en mode fermé si l'audit préalable n'est pas disponible.[12] ; D58 fixe un RPO et un RTO chacun **strictement inférieurs à quatre heures** pour catastrophe/incident majeur.[3][11]
- Le scénario explicitement inclus est la perte d'un datacenter/AZ.[2][3] ; La perte complète d'une région reste un risque distinct à chiffrer.[2][3] ; La disponibilité de lancement est un objectif interne, sans SLA client communiqué.[2][3] ; La prise en charge des incidents critiques vise 24 h/24 et 7 j/7, mais aucune organisation n'est engagée.[2]
---
# Partie I — B08 : quotas, formats, coûts, privacy, rétention et droits
## 3. Verdict B08
**`B08: BLOCKED`** La recherche permet de construire un modèle de coût et des options de politique. Elle ne permet pas de fixer un quota commercial ou une durée de conservation sans décision du propriétaire et revue privacy/juridique. Les points acquis sont :
- trois comptes et deux boîtes inclus ; absence de copie durable des originaux ; export dérivé uniquement ; prix unitaires publics datés ; scénarios synthétiques bas, médian et haut ; options 20 000 000 octets et 20 MiB ; options de conservation deux, trois ou cinq ans ; procédure anti-résurrection exigée.
Les points bloqués sont :
- plafond initial de reprise ; plafond mensuel d'usage ; supplément de compte ; formats e-mail autorisés ou analysables ; taille exacte ; durée commune après clôture ; durées audit/sécurité/backups/tombstones ; rôles privacy et bases légales ; sous-traitants contractuellement acceptés ; preuve de purge et d'exercice des droits.
---
## 4. Prix unitaires actuels et règle de version
### 4.1 IA Qwen / Scaleway
Le prix public utilisé pour `qwen3.6-35b-a3b` est :
```text
entrée : 0,25 € / million de tokens
sortie : 1,50 € / million de tokens
```
Le modèle reste un candidat documentaire ; sa présence au catalogue et son prix ne prouvent pas sa qualité DossierClé.[5][15][16]
### 4.2 Mistral Small et OCR
Le prix public utilisé est :
```text
Mistral Small : 0,15 $ / million de tokens entrée
Mistral Small : 0,60 $ / million de tokens sortie
Mistral OCR : 4,00 $ / 1 000 pages
```
Pour les estimations régionales standard Q5, la documentation Mistral vérifiée le **3 octobre 2026** impose un surcoût de **+10 %** sur les entrées, sorties, lectures et écritures de cache.[18] Les calculs principaux conservent donc la valeur datée de Q3 :
```text
coût régional standard Mistral Q5 = coût catalogue × 1,10
```
Mistral publie séparément une offre **Enterprise APIs** à **+75 %** du prix catalogue sur certaines API, avec contrôles régionaux, SLA système, limites accrues et support premium.[17] Cette offre commerciale sélective n'est pas assimilée à l'inférence régionale standard : les API éligibles, le contrat et le devis doivent être confirmés avant tout calcul ou adoption Enterprise.
### 4.3 Monnaies
Les coûts Qwen restent en euros. Les coûts Mistral et OCR restent en dollars. Aucun total EUR+USD n'est présenté. Aucun taux de change, frais de carte, taxe, remise, engagement ou arrondi de facture n'est supposé.
### 4.4 Observabilité et Registry
Les échantillons utilisent :
```text
logs/traces Cockpit : 0,35 € / Go
métriques Cockpit : 0,15 € / million d'échantillons
règle d'alerte : 0,015 € / règle / jour
Private Registry : 0,027 € / Go / mois
```
Ces coûts sont partagés par la plateforme, pas attribués directement à une agence sans règle de ventilation.[19][20]
### 4.5 Planchers runtime hérités de Q2
| Topologie candidate | Plancher mensuel HT |
|---|---:|
| Instances, trois AZ, trois LB, Redis cluster, PostgreSQL | **329,23 €** |
| Même topologie avec Gateway | **348,21 €** |
| Kapsule regional, trois nodes/LB, Redis cluster, PostgreSQL | **409,53 €** |
| Kapsule regional full isolation avec Gateway | **428,51 €** |
Ces montants sont hérités de Q2 et restent des planchers incomplets.[4] Ils excluent notamment stockage, backups, trafic, DNS health checks, certificats/WAF, Secret Manager, observabilité, Registry, QA, restauration temporaire, support, astreinte, autoscaling et région secondaire.[4]
---
## 5. Hypothèses synthétiques de volumes
### 5.1 Scénario bas
```text
reprise initiale :
- 1 000 messages
- 300 pages
- 1,5 M tokens entrée
- 0,25 M tokens sortie

usage mensuel :
- 500 messages
- 150 pages
- 0,75 M tokens entrée
- 0,125 M tokens sortie
```
### 5.2 Scénario médian
```text
reprise initiale :
- 5 000 messages
- 3 000 pages
- 8 M tokens entrée
- 1,25 M tokens sortie

usage mensuel :
- 2 000 messages
- 1 200 pages
- 3,2 M tokens entrée
- 0,5 M tokens sortie
```
### 5.3 Scénario haut
```text
reprise initiale :
- 20 000 messages
- 12 000 pages
- 40 M tokens entrée
- 6 M tokens sortie

usage mensuel :
- 8 000 messages
- 4 800 pages
- 16 M tokens entrée
- 2,4 M tokens sortie
```
### 5.4 Enveloppe de sécurité
Tous les coûts IA ci-dessous incluent une enveloppe de sécurité de **25 %**. Elle couvre une marge synthétique de variation et ne remplace pas :
- les retries autorisés ; les réponses inconnues conservant leur réservation ; les écarts de tokenisation ; les pages non traitables ; le cache éventuel ; le support ; les taxes ; les erreurs de qualité ; les changements tarifaires.
---
## 6. Coûts IA synthétiques exacts
### 6.1 Reprise initiale
| Scénario | Qwen, EUR | Mistral Small régional, USD | OCR, USD |
|---|---:|---:|---:|
| Bas | **0,94 €** | **0,52 $** | **1,65 $** |
| Médian | **4,84 €** | **2,68 $** | **16,50 $** |
| Haut | **23,75 €** | **13,20 $** | **66,00 $** |
### 6.2 Usage mensuel
| Scénario | Qwen, EUR/mois | Mistral Small régional, USD/mois | OCR, USD/mois |
|---|---:|---:|---:|
| Bas | **0,47 €** | **0,26 $** | **0,83 $** |
| Médian | **1,94 €** | **1,07 $** | **6,60 $** |
| Haut | **9,50 €** | **5,28 $** | **26,40 $** |
Ces chiffres ne doivent pas être interprétés comme le coût total d'une agence. Ils ne comprennent pas le runtime, PostgreSQL, stockage, réseau, connecteurs mail, observabilité, support, exploitation ou marge commerciale. Ils ne prouvent pas que toutes les pages nécessitent OCR. L'extraction locale doit rester prioritaire lorsqu'elle est sûre et suffisante.[5][9]
---
## 7. Observabilité partagée — échantillons
| Scénario | Données custom | Échantillons | Alertes actives | Registry privé | Total mensuel |
|---|---:|---:|---:|---:|---:|
| Bas | 5 Go | 5 M | 5 | 5 Go | **4,89 €** |
| Médian | 20 Go | 20 M | 10 | 20 Go | **15,04 €** |
| Haut | 100 Go | 100 M | 20 | 50 Go | **60,35 €** |
Le total regroupe Cockpit et Private Registry selon les prix unitaires ci-dessus.[19][20] Il suppose 30 jours pour les règles d'alerte et applique un arrondi monétaire au centime, au demi-supérieur. Il ne comprend pas l'export des données, la rétention étendue, le trafic sortant ou un second backend. La minimisation reste obligatoire : aucune donnée métier brute ne doit être envoyée aux logs pour réduire un coût de diagnostic.[12][13]
---
## 8. Modèle de coût à conserver
Le coût mensuel complet doit être représenté au minimum par :
```text
coût_runtime_partagé
+ PostgreSQL central et agences
+ PostgreSQL technique Inngest
+ Redis ou alternative
+ stockage dérivé
+ sauvegardes et copies PRA
+ Object Storage temporaire
+ trafic et DNS/LB/Gateway
+ observabilité et Registry
+ IA incluse en EUR
+ BYOK/OCR en USD, séparés
+ support fournisseur
+ astreinte et interventions humaines
+ QA et exercices PRA
+ marge incident/autoscaling
+ coûts de suppression, export et restauration
```
Le coût par agence nécessite ensuite une règle de ventilation explicite :
```text
coût_agence = part_fixe_commerciale
+ part_runtime_allouée
+ stockage/rétention mesurés
+ usage IA réservé/finalisé
+ connecteurs et support spécifiques
+ marge de risque approuvée
```
Aucune règle de ventilation n'est adoptée par Q5.
---
## 9. Quotas commerciaux — options sans adoption
### 9.1 Socle déjà décidé
```text
comptes inclus : 3
boîtes incluses : 2
modules : Sinistres + Location
```
Les comptes supplémentaires exigent un supplément explicite. Aucune boîte supplémentaire n'est proposée au lancement. Les alias ne sont pas arbitrés.
### 9.2 Reprise initiale
**Option A — plafond ferme**
- l'agence choisit sa période ; le système affiche messages, pages, tokens et coût maximal estimé ; la reprise s'arrête au plafond ; une extension exige un accord explicite ; aucun dépassement silencieux.
**Option B — lots successifs**
- la période reste la frontière absolue ; les messages sont traités par lots bornés ; chaque lot exige une capacité restante ; une validation humaine peut autoriser le lot suivant ; aucune lecture hors période pour estimer ce qui reste.
**Option C — supplément commercial**
- le plafond inclus est fixe ; un supplément est proposé avant consommation additionnelle ; aucune facturation automatique ; l'agence peut rester en mode manuel.
**Orientation de méthode :** combiner plafond ferme et lots visibles. La quantité exacte reste une décision humaine après P06 et simulation de marge.
### 9.3 Usage mensuel
Le quota vendu ne doit pas être exprimé seulement en tokens. Il doit borner au moins :
- messages nouveaux analysés ; pages effectivement envoyées à OCR/vision ; appels par tâche ; recalculs de synthèse ; retries certains ; réservations inconnues ; coût maximal par appel ; coût maximal mensuel ; durée de file lorsque l'IA est suspendue.
### 9.4 Gmail
Les limites documentées restent :
- 1 200 000 unités/minute/projet ; 6 000 unités/minute/utilisateur/projet ; 80 000 000 unités/jour/projet avant le futur mécanisme de facturation annoncé ; coût par méthode distinct.[5][21]
Le tarif de dépassement quotidien n'est pas publié dans le corpus vérifié. La plateforme doit conserver une marge pour `watch`, `history.list`, readback et rattrapage.
### 9.5 Microsoft Graph
Les limites Outlook documentées comprennent :
- 10 000 requêtes par 10 minutes pour la combinaison application + mailbox ; 4 requêtes concurrentes ; 150 MB upload par 5 minutes.[5][22]
La concurrence applicative doit rester strictement sous quatre par boîte. `Retry-After` gouverne la reprise.
### 9.6 IMAP/SMTP
Aucun quota universel n'est retenu. Chaque famille fournisseur/client exige un profil :
- capacités IMAP ; `PERMANENTFLAGS` ; limites de taille ; limites d'envoi ; fréquence polling/IDLE ; authentification ; TLS ; comportement du client final.
Limites inconnues = autonomie bloquée pour la boîte concernée.[5]
---
## 10. Limite de taille : 20 000 000 octets ou 20 MiB
```text
20 000 000 octets = 20 Mo décimaux
20 MiB = 20 × 1 024 × 1 024 = 20 971 520 octets
écart = 971 520 octets
écart relatif = 4,8576 %
```
### Option A — 20 000 000 octets
- libellé : **20 Mo** ; seuil simple à communiquer ; légèrement plus restrictif ; comparaison directe avec certains fournisseurs utilisant le décimal.
### Option B — 20 MiB
- libellé : **20 Mio** ou **20 MiB** ; seuil binaire exact ; accepte 971 520 octets supplémentaires ; exige un libellé sans ambiguïté.
### Règles communes
- la vérification se fait en octets côté serveur ; la taille déclarée par le client n'est pas l'autorité ; dépassement visible, sans troncature silencieuse ; la pièce n'est ni analysée ni envoyée à l'IA ; le message et la provenance du refus restent visibles ; les limites pages, archives, temps, mémoire et décompression restent séparées.
**Décision humaine obligatoire :** choisir A ou B.
---
## 11. Formats reçus par e-mail
L'ancien formulaire externe PDF/JPEG/PNG est retiré du produit.[2] Sa liste de formats ne devient pas automatiquement la politique des e-mails.[2][10]
### Option 1 — allowlist stricte
- PDF ; JPEG ; PNG ; texte simple ; autres formats refusés ou laissés au traitement humain sans IA.
**Avantage :** surface de parsing réduite. **Limite :** davantage de dossiers passent en manuel.
### Option 2 — analyse conditionnelle élargie
- types précédents ; formats bureautiques sélectionnés ; extraction dans sandbox ; profondeur, taille, pages, temps et mémoire bornés ; macros, exécutables, archives imbriquées et contenus actifs refusés.
**Avantage :** couverture métier accrue. **Limite :** coût sécurité, exploitation et validation nettement supérieur.
### Option 3 — réception large, IA étroite
- le message est ingéré ; la pièce reste une référence temporaire ; seuls les types explicitement qualifiés entrent dans le pipeline IA ; les autres nécessitent une décision humaine.
**Orientation proposée :** Option 3, puis allowlist progressive prouvée par type. Aucune liste finale n'est adoptée.
---
## 12. Privacy — rôles proposés, non conclusifs
### 12.1 Modèle principal proposé
- **Agence immobilière : responsable du traitement** pour les dossiers, échanges, finalités métier, période historique, durée et réponse aux personnes. ; **DossierClé : sous-traitant** lorsqu'il héberge, structure, analyse ou restitue les données sur instruction documentée de l'agence.
- **DossierClé : responsable distinct éventuel** pour ses finalités propres strictement définies, par exemple sécurité de son service, facturation, défense de droits et gestion de comptes plateforme. ; **Fournisseurs cloud/IA/mail : sous-traitants ultérieurs ou responsables distincts selon le service et le contrat exact**, à cartographier avant données réelles.
Ce partage est une proposition. Il doit être validé par une revue privacy/juridique sur les contrats, interfaces et traitements réels.[23][24][25][26]
### 12.2 Finalités proposées
- fournir le suivi de dossiers demandé par l'agence ; analyser temporairement les messages/pièces utiles ; produire faits, résumés et synthèses ; préparer ou exécuter les actions autorisées ; sécuriser le service ; produire l'audit ; gérer support, facturation et incidents ; permettre export, suppression et reprise contrôlée.
Toute finalité d'entraînement, amélioration générale, profilage commercial ou réutilisation des contenus est exclue par défaut.
### 12.3 Bases légales — matrice à construire
Pour chaque finalité, la fiche de décision doit contenir :
```text
finalité
catégories de personnes
catégories de données
responsable/sous-traitant
base légale proposée par l'agence
source de l'obligation ou du besoin
nécessité et proportionnalité
recipients/sous-traitants
transferts
rétention
mesures de sécurité
procédure de droits
```
Les bases légales possibles doivent être évaluées au cas par cas. Ce document ne conclut ni contrat, ni obligation légale, ni intérêt légitime. Le consentement BYOK ou commercial n'est pas automatiquement une base légale pour le contenu traité.
---
## 13. Rétentions différenciées
Une seule durée globale serait incorrecte. Les catégories suivantes doivent être gérées séparément.
### 13.1 Copies de travail et quarantaine
- objectif : heures ou jours, pas années ; purge après succès, échec terminal ou expiration ; hard cap explicite ; aucun original dans les logs ; traitement distinct des erreurs AV et objets suspects ; preuve de suppression et inventaire des retries.
### 13.2 Données métier dérivées
- faits structurés ; courts résumés ; synthèse de dossier ; provenance descriptive ; suivi et décisions.
La durée commune post-clôture reste à choisir entre les options étudiées ci-dessous.
### 13.3 Audit métier
L'audit peut nécessiter une durée différente des données métier. Il doit rester append-only au niveau applicatif, corrigeable par événement lié, exportable selon droits, et purgé par procédure réglementaire hors UI.[12] La durée exacte reste à décider après revue privacy/juridique et analyse des besoins de preuve.
### 13.4 Logs et données de sécurité
Les logs de sécurité doivent être minimisés et séparés. Une option de travail entre six et douze mois peut être soumise à la revue, sans être présentée comme règle universelle.[27] La durée doit être liée aux capacités de détection, enquête, contestation et coût.
### 13.5 Backups
Les 30 jours hérités de l'ADR-010 restent une proposition d'architecture, pas une conclusion juridique.[11] La politique doit préciser :
- fréquence ; rétention ; chiffrement ; emplacement ; immutabilité éventuelle ; accès ; suppression logique ; tombstones ; expiration ; restore anti-résurrection.
### 13.6 Tombstones et générations
Les tombstones de suppression/résiliation et la génération de révocation doivent survivre à la restauration d'un ancien backup. Ils ne doivent pas être conservés uniquement dans le snapshot susceptible de ressusciter les données. Leur contenu doit être minimal : identifiant opaque, portée, génération, horodatage, motif de politique et preuve de traitement.
### 13.7 Archives d'export
- contenu dérivé uniquement ; fenêtre 24 heures héritée ; URL privée et droit relu au téléchargement ; suppression à expiration ; régénération seulement tant que le droit existe ; aucun original, secret ou pièce cachée.
---
## 14. Options de conservation après clôture
### Option A — deux ans
**Avantages :**
- minimisation forte ; exposition et stockage réduits ; dossiers anciens supprimés plus tôt.
**Risques :**
- peut être trop courte pour certaines finalités ou obligations documentées ; davantage de demandes de récupération auprès de la messagerie ; historique métier plus court.
### Option B — trois ans
**Avantages :**
- compromis entre continuité, minimisation et coût ; cohérence potentielle avec certains besoins locatifs à examiner ; exposition inférieure à cinq ans.
**Risques :**
- peut rester trop courte pour certaines situations ; ne couvre pas automatiquement toutes les obligations ; exige des exceptions ciblées et documentées.
### Option C — cinq ans
**Avantages :**
- historique plus long ; moins de suppressions précoces ; peut faciliter certaines défenses ou continuités si elles sont réellement nécessaires.
**Risques :**
- exposition et coût supérieurs ; conflit possible avec la minimisation si aucune finalité active ne le justifie ; davantage de données dans backups et restaurations.
### Recommandation de méthode uniquement
1. inventorier les finalités réelles ; 2. faire qualifier les obligations applicables ; 3. distinguer activité courante, archive intermédiaire éventuelle et gel contentieux ciblé ; 4. choisir la durée la plus courte qui satisfait les besoins documentés ; 5. chiffrer stockage, backups, export, purge et PRA ; 6. faire approuver la règle commune ; 7. tester suppression et anti-résurrection.
**Aucune option n'est recommandée comme conclusion légale par ce document.**
---
## 15. Droits, export, suppression et restauration
### 15.1 Accès
La réponse doit distinguer :
- données détenues par DossierClé ; originaux détenus par la messagerie ; données d'audit ; données techniques minimisées ; données fournisseur ; secrets exclus.
### 15.2 Rectification
Une correction ne doit pas réécrire silencieusement l'historique. Elle ajoute une version ou un événement lié et indique la source de la correction.
### 15.3 Effacement
La procédure doit :
1. authentifier la demande et vérifier l'autorité ; 2. identifier agences, dossiers, faits, synthèses, index, exports et temporaires ; 3. appliquer les exceptions validées ; 4. créer le tombstone/génération avant suppression active ; 5. supprimer ou rendre inaccessible l'actif ; 6. propager aux sous-traitants selon contrat ; 7. laisser expirer les backups selon politique ;
8. empêcher toute résurrection au restore ; 9. produire une preuve d'exécution minimisée.
### 15.4 Portabilité
La portabilité individuelle et l'export contractuel de l'agence sont deux mécanismes distincts.[28] Le périmètre de portabilité doit être qualifié par la revue privacy/juridique. Les données inférées ne sont pas automatiquement assimilées aux données fournies.
### 15.5 Anti-résurrection
Après restauration :
- toutes les sessions restaurées sont invalidées ; la génération courante doit être supérieure à celle du snapshot ; les suppressions, résiliations, retraits de rôle, remplacements MFA et révocations de boîtes sont réconciliés ; les exports expirés ne sont pas restaurés ; les objets temporaires expirés ne sont pas restaurés ; tout état actuel inconnu reste fermé ;
- la réouverture exige une décision humaine.
---
## 16. Décisions humaines obligatoires B08
1. Choisir 20 000 000 octets ou 20 MiB. ; 2. Choisir la politique de formats e-mail. ; 3. Fixer le plafond de reprise initiale. ; 4. Fixer le plafond mensuel. ; 5. Fixer le traitement des dépassements et suppléments. ; 6. Fixer le prix et le plafond des comptes supplémentaires. ; 7. Choisir deux, trois ou cinq ans, ou une autre durée justifiée, après revue.
8. Fixer les durées audit, sécurité, temporaires, exports et backups. ; 9. Valider les rôles privacy. ; 10. Valider la matrice finalité/base légale. ; 11. Valider les sous-traitants, régions, DPA, ZDR et opt-out applicables. ; 12. Accepter ou refuser l'exception de rétention Scaleway jusqu'à deux semaines lors d'incidents/abus.[5][16]
13. Accepter ou refuser l'inférence régionale Mistral standard à +10 % et, séparément, décider s'il faut demander une qualification commerciale Enterprise à +75 % sur les seules API éligibles.[17][18] ; 14. Choisir le stockage indépendant des tombstones et générations. ; 15. Autoriser ultérieurement B08-P-1 si la purge reste indécidable sur papier.
---
# Partie II — B10 : disponibilité interne et capacité d'exploitation
## 17. Verdict B10
**`B10: BLOCKED`** La disponibilité de lancement est un objectif interne. Aucun SLA client n'est communiqué. La prise en charge critique 24/7 reste une cible non financée. Le fondateur seul ne constitue pas une rotation. Des amis développeurs non engagés ne constituent pas une rotation. Un support cloud ne remplace ni l'exploitation applicative, ni la connaissance métier, ni l'autorité de reprise.
---
## 18. Options de disponibilité interne
La disponibilité est calculée sur une année civile de 365 jours et un mois moyen de 43 800 minutes.
| Cible interne | Indisponibilité mensuelle moyenne | Indisponibilité annuelle | Positionnement |
|---|---:|---:|---|
| **99,5 %** | **219 min = 3 h 39** | **2 628 min = 43 h 48** | option de lancement la moins coûteuse, incompatible avec une attente implicite de quasi-haute disponibilité |
| **99,9 %** | **43,8 min** | **525,6 min = 8 h 45 min 36 s** | option intermédiaire exigeant vraie redondance, alerting et relais |
| **99,95 %** | **21,9 min** | **262,8 min = 4 h 22 min 48 s** | aspiration exigeante, peu compatible avec un bus factor 1 et des composants encore non qualifiés |
Ces budgets ne sont pas des SLA. Ils ne prouvent pas la disponibilité réelle. Ils ne remplacent pas D58 : disponibilité agrégée et RTO d'un sinistre sont deux mesures différentes.
### Orientation proposée
- mesurer un SLI end-to-end dès QA ; soumettre 99,5 % et 99,9 % au propriétaire avec coût réel ; conserver 99,95 % comme option ultérieure tant que l'organisation et l'architecture ne la rendent pas crédible ; ne publier aucune valeur client sans décision contractuelle séparée.
---
## 19. Support Scaleway actuel
### Business
```text
prix mensuel = max(250 €, 10 % de la dépense nette)
IRT public du plan = 30 minutes
hotline = 24/7
```
### Enterprise
```text
prix mensuel = max(990 €, 20 % de la dépense nette)
IRT public du plan = 15 minutes
hotline = 24/7
```
Ces valeurs sont les conditions publiques relevées le 3 octobre 2026.[29] **IRT signifie délai initial de réponse.** L'IRT n'est ni un délai de résolution, ni un RTO, ni un SLA de disponibilité applicative. Le support fournisseur ne garantit pas :
- la détection DossierClé ; l'accusé humain interne ; le diagnostic métier ; la restauration multi-stores ; la réconciliation mail ; l'absence de doublon ; la rotation des secrets ; la décision de réouverture.
---
## 20. Modèles opératoires
### Option A — propriétaire seul
**Coût apparent :** faible. **Défauts :**
- pas de relais ; indisponibilité personnelle ; fatigue ; connaissance concentrée ; aucun 24/7 crédible ; incompatible avec un RTO borné si l'incident survient sans réponse.
**Disposition :** rejetée pour toute affirmation 24/7.
### Option B — rotation interne
Conditions minimales :
- au moins deux personnes capables par composant critique ; primaire et secondaire par plage ; règles de compensation et temps travaillé ; accès sécurisés ; transfert de garde ; runbooks testés ; exercices ; autorité de déclaration/réouverture ; couverture congés, maladie et chevauchements.
Le coût humain ne peut pas être calculé sans personnes, contrat, convention et volume d'interventions.[30]
### Option C — prestataire d'astreinte
Le prestataire doit fournir par contrat :
- supervision et accusé 24/7 ; délais par sévérité ; suppléance ; limites d'action ; accès audités ; exécution de runbooks approuvés ; escalade vers le propriétaire ; protection des données ; restitution et révocation des accès ; exercices et rapports.
Aucun devis ni prestataire n'a été obtenu.
### Option D — hybride
- support Scaleway Business ou Enterprise ; prestataire de première réponse ; relais interne propriétaire + second opérateur ; spécialistes applicatifs en heures étendues ; procédures break-glass.
**Orientation proposée :** option D pour étude, sans adoption.
---
## 21. Sévérités et objectifs opératoires proposés
| Sévérité | Exemple | Couverture proposée | Mesure principale |
|---|---|---|---|
| SEV1 | indisponibilité large, risque de perte, fuite, doublons externes, auth compromise | 24/7 | détection, accusé humain, décision de confinement, restauration/réouverture |
| SEV2 | fonctionnalité majeure dégradée sans perte immédiate | heures étendues ou 24/7 selon coût | triage et mode dégradé |
| SEV3 | défaut limité, contournement sûr | heures ouvrées | backlog et correction planifiée |
| SEV4 | demande, amélioration, bruit | heures ouvrées | traitement normal |
Les délais de résolution ne sont pas fixés. Ils ne doivent pas être inventés à partir des IRT support.
---
## 22. Chaîne d'alerte et escalade proposée
```text
sonde critique ou corrélation de deux signaux
→ création incident
→ appel/push/SMS au primaire
→ absence d'accusé dans la borne approuvée
→ secondaire
→ prestataire/on-call
→ propriétaire / autorité sécurité
→ support fournisseur si composant concerné
→ communication interne
→ confinement
→ reprise contrôlée
```
Les alertes e-mail seules sont insuffisantes pour SEV1. Les notifications CI ne sont pas une supervision de production.[31] Chaque escalade doit être testée sans données réelles.
---
## 23. Runbooks minimaux obligatoires
1. compromission compte ou session ; 2. perte ou rotation de secret ; 3. panne PostgreSQL central ; 4. panne d'une base agence ; 5. saturation connexions/pools ; 6. perte Redis ou incohérence Inngest ; 7. queue bloquée ou jobs dupliqués ; 8. résultat d'envoi inconnu ; 9. Gmail `historyId` expiré ; 10. Graph delta/subscription expiré ; 11. IMAP `UIDVALIDITY` changé ;
12. échec antivirus/quarantaine ; 13. budget IA épuisé ou fournisseur indisponible ; 14. observabilité indisponible ; 15. Object Storage indisponible ; 16. export expiré ou suppression échouée ; 17. perte d'une AZ/datacenter ; 18. perte régionale ; 19. restauration ancienne et anti-résurrection ; 20. incident privacy/sécurité et notification à qualifier.
Chaque runbook contient :
- déclencheurs ; périmètre ; autorité ; prérequis ; étapes réversibles ; points d'arrêt ; commandes ou consoles exactes ; preuves à conserver ; communication ; procédure de réouverture ; nettoyage ; post-incident.
---
## 24. Bus factor et exercices
### Critères proposés
- bus factor **au moins 2** pour chaque composant critique ; aucun secret, accès console, connaissance PRA ou droit de déploiement détenu par une seule personne ; un suppléant capable d'exécuter chaque runbook ; revue d'accès périodique ; exercice d'alerte ; exercice de perte de primaire ; exercice de restauration ; exercice de résultat inconnu ; exercice de révocation après backup puis restore ;
- post-mortem sans blâme et actions suivies.
Une véritable rotation 24/7 peut nécessiter davantage que deux personnes. Le nombre final dépend des plages, repos, compensation, compétences et prestataire.
---
## 25. Décisions humaines obligatoires B10
1. Choisir 99,5 %, 99,9 %, 99,95 % ou une autre cible interne. ; 2. Choisir support Business, Enterprise ou aucun, en comprenant que l'IRT n'est pas une résolution. ; 3. Identifier un prestataire et obtenir un devis. ; 4. Définir primaire, secondaire, suppléants et autorité de réouverture. ; 5. Financer l'astreinte et les interventions. ; 6. Définir les sévérités et canaux. ; 7. Approuver la liste de runbooks.
8. Fixer les exercices et leur fréquence. ; 9. Fixer les accès break-glass et la révocation. ; 10. Vérifier le bus factor. ; 11. Refuser toute communication client de SLA tant qu'aucun SLA n'est décidé. ; 12. Maintenir B10 `BLOCKED` si la couverture 24/7 n'est pas réellement engagée.
---
# Partie III — B03 : PRA, D58 et cohérence des états
## 26. Verdict B03
**`B03: BLOCKED`** D58 est défini, mais non démontré. Les principaux bloqueurs sont :
1. absence de cut cohérent entre central, agences, Inngest PostgreSQL, Redis, objets et états externes ; 2. Redis managé non garanti récupérable après incident ; 3. HA PostgreSQL historique dans le même datacenter ; 4. réplication Multi-AZ asynchrone et promotion manuelle ; 5. absence de tombstones et générations indépendants du rollback ; 6. reconstruction Inngest après perte Redis non spécifiée ;
7. secrets, IAM, réseau et artefacts non restaurables de manière prouvée ; 8. mobilisation humaine non bornée ; 9. aucune restauration chronométrée.
---
## 27. Carte des états persistés
| État | Autorité | Reprise candidate | Règle fail-closed |
|---|---|---|---|
| registre agences/abonnements/localisation | PostgreSQL central | snapshot ou backup | aucune agence non réconciliée ne rouvre |
| identité, MFA, sessions, rôles | PostgreSQL central + clé hors DB | restore central | toutes sessions invalidées ; ancien MFA non présumé valide |
| faits, résumés, suivi, intentions | base PostgreSQL agence | snapshot ou backup logique | restore sous nouvel endpoint, droits vérifiés |
| audit métier | bases centrale/agences | restore avec base | correction par événement, pas réécriture |
| tombstones | stockage indépendant à choisir | non défini | indisponible = suppression/résiliation reste fermée |
| génération de révocation/reprise | compteur monotone indépendant | non défini | génération restaurée insuffisante = accès refusé |
| Inngest configuration/historique | PostgreSQL technique | backup/snapshot | historique non autorité d'effet |
| Inngest queue/runs | Redis | snapshot ou reconstruction | traiter Redis comme perdu sans preuve |
| inbox/outbox/intention/fence | base agence | restore + réconciliation | `RESULTAT_INCONNU` ne redevient pas `À_ENVOYER` |
| objets temporaires/quarantaine | Object Storage privé | versioning si retenu | expirés/interdits non restaurés |
| exports | objet temporaire | régénération | anciennes URLs invalides |
| artefacts/SBOM/source maps | registry/stockage/Git | digest immuable | pas de rebuild différent pendant PRA |
| secrets | Secret Manager + fournisseur | versions ou rotation | recréer/révoquer, pas supposer copie régionale |
| IAM/réseau/DNS/LB | IaC futur | réapplication | console seule insuffisante |
| curseurs mail | base agence + fournisseur | restore puis reconciliation | période choisie toujours opposable |
| tags/catégories | fournisseur mail | readback courant | confirmation restaurée non autorité |
| originaux reçus | messagerie agence | fournisseur externe | aucune copie DossierClé cachée |
| envois | boîte Sent/fournisseur | recherche fournisseur | inconnu = humain, jamais renvoi automatique |
| ledger IA/OCR | base agence | restore + facture/usage | réserve inconnue conservée |
| logs/traces/métriques | backend d'observabilité | rétention fournisseur | jamais autorité métier |
| alertes/incidents | observabilité + processus | config/runbooks | recréer et auditer |
| code/contrats/schémas | Git + artefacts | commit/digests | version compatible avec données restaurées |
Le point récupérable global n'est donc pas le dernier snapshot PostgreSQL.[6][11]
---
## 28. Limites Scaleway pertinentes
### 28.1 PostgreSQL
- la HA historique est documentée avec principal et standby synchrones dans le même datacenter ; la Read Replica Multi-AZ est asynchrone ; sa promotion est manuelle ; les snapshots Block restaurent l'instance entière ; le backup logique peut viser une base sous les conditions documentées ; les backups logiques ne sont pas couverts par le chiffrement natif décrit ;
- une restauration importante peut durer plusieurs heures ; aucun PITR arbitraire n'est établi dans le corpus.[4][6][32][33][34][35]
### 28.2 Redis
Managed Redis propose snapshots et HA, mais la documentation indique que la persistance ne garantit pas la récupération après incident.[4][6][36] Deux voies restent possibles :
1. rendre Redis entièrement reconstructible depuis des autorités PostgreSQL ; 2. remplacer ou auto-opérer le composant avec une durabilité qualifiée.
### 28.3 Object Storage
Standard Multi-AZ est une piste pour perte AZ. Le versioning et les lifecycle rules doivent être testés avec delete markers.[37][38][39] Aucune réplication cross-region native active n'est prouvée dans le corpus. Une copie applicative inter-région exige manifestes, hashes et propagation des suppressions.
### 28.4 Secret Manager
Les secrets sont régionaux et dupliqués entre AZ de la région. La suppression différée est récupérable sept jours.[40][41] Aucune réplication inter-région automatique n'est établie. La perte régionale exige rotation/recréation et bootstrap séparé.
### 28.5 Kapsule et réseau
Un control plane regional HA Dedicated améliore la résilience, mais reste dans une région. L'accès au control plane dépend du Load Balancer de zone primaire. Les gateways et volumes peuvent rester zonaux. L'ingress multi-AZ exige plusieurs Load Balancers et DNS health checks.[4][42][43][44][45]
---
## 29. Formules RPO
Pour un store sauvegardé périodiquement :
```text
RPO_store_max =
intervalle entre points valides
+ durée de création/copie
+ retard de planification
+ délai de détection d'échec
+ délai de vérification du point
```
Avec tolérance d'un cycle raté :
```text
RPO_store_max =
2 × intervalle
+ durée de création/copie
+ retard de planification
+ délai de détection
+ délai de vérification
```
Condition D58 :
```text
RPO_store_max < 240 minutes
```
Un intervalle exactement égal à quatre heures est insuffisant. Un cut cohérent n'est pas une date obtenue par le minimum de timestamps indépendants. Il est un **tuple de points réellement restaurables** :
```text
T = (
point_central,
points_agences,
point_inngest_pg,
point_tombstones_revocations,
point_objets_nécessaires,
point_redis_ou_reconstruction_prouvée
)
```
`T` est valide seulement si un manifeste vérifié démontre que ses schémas, watermarks, générations, fences, intentions et dépendances causales sont compatibles, ou qu'un mécanisme de réconciliation borné rend chaque divergence visible et sûre. Des snapshots désalignés et sans PITR ne sont pas supposés restaurables à une date commune.

Pour chaque tuple valide, le cut `C(T)` est le dernier watermark métier causal démontré comme récupérable. La borne globale est :
```text
RPO_cohérent = heure_incident - max(C(T) pour chaque tuple T valide)
```
S'il n'existe aucun tuple valide et vérifié :
```text
RPO cohérent non bornable — BLOCKED
```
La reconstruction depuis les boîtes peut recréer certaines entrées reçues. Elle ne recrée pas automatiquement validations humaines, révocations, mandats, appels téléphoniques, résultats d'envoi ou timers perdus.
---
## 30. Formule RTO
Le runbook de reprise doit être représenté comme un graphe orienté de dépendances `G_restore`. Un `max` n'est permis qu'entre branches dont le parallélisme est démontré ; les étapes dépendantes s'additionnent sur le chemin critique. La borne est :
```text
RTO =
détection
+ mobilisation et décision d'incident
+ durée_du_chemin_critique(G_restore)
+ décision humaine de réouverture
```
`G_restore` impose notamment : isolement et coupure des effets ; récupération des tombstones/générations ; restauration puis invalidation du central ; restauration des agences ; restauration contrôlée des objets et de l'orchestrateur ; réconciliation sécurité, mail et effets ; smoke tests ; DNS ; réouverture progressive. Réseau/runtime, bases, objets, Inngest et secrets ne peuvent être parallélisés que si leurs prérequis, autorités et points de jonction sont prouvés.
Condition D58 :
```text
RTO < 240 minutes
```
Le temps de support initial n'est qu'une composante éventuelle. L'IRT Business de 30 minutes ou Enterprise de 15 minutes n'est pas le RTO.[29] B10 laisse aujourd'hui la mobilisation humaine non bornée. Ce seul fait bloque le RTO.
---
## 31. Mode perte datacenter/AZ
### Éléments potentiellement survivants
- Object Storage Standard Multi-AZ ; Secret Manager dans les autres AZ de la région ; runtime réparti si LB, DNS et dépendances sont réellement multi-AZ ; Read Replica PostgreSQL Multi-AZ, avec ses limites asynchrones.
### Éléments non démontrés
- HA PostgreSQL historique hors datacenter ; lag maximal de replica ; promotion sous borne ; récupération Redis ; control plane/gateway sans SPOF ; tombstones/génération indépendants ; cut PG/Redis/objets cohérent ; opérateur disponible ; absence de doublon.
### Verdict AZ
```text
RPO < 4 h : NON PROUVÉ
RTO < 4 h : NON PROUVÉ
B03 : BLOCKED
```
---
## 32. Mode perte régionale
### Mode froid
```text
backups logiques hors région
+ copies objets hors région
+ manifestes/hashes
+ IaC
+ artefacts immuables
+ bootstrap secrets
+ rotation credentials
+ exercices périodiques
```
Le coût fixe est plus faible. Le RTO < 4 h est peu crédible sans preuve, car services, import, réseau et secrets commencent après l'incident.
### Mode tiède ou chaud
| Topologie secondaire | Surcoût mensuel minimal | Plancher deux régions |
|---|---:|---:|
| Instances | **329,23 €** | **658,46 €** |
| Instances + Gateway | **348,21 €** | **696,42 €** |
| Kapsule regional | **409,53 €** | **819,06 €** |
| Kapsule regional + Gateway | **428,51 €** | **857,02 €** |
Ces montants excluent la plupart des coûts PRA.[4] Ils ne comprennent pas réplication de toutes les bases, stockage/copies, Object Storage, Secret Manager, DNS, observabilité, support, astreinte, restauration temporaire et trafic.
### Verdict régional distinct de D58
```text
RPO régional < 4 h : NON PROUVÉ
RTO régional < 4 h : NON PROUVÉ
coût froid : non consolidable sans volumes et cadence
coût tiède/chaud : plancher incomplet uniquement
```
La perte régionale reste un objectif PRA distinct à chiffrer et arbitrer. Elle ne réduit ni ne rouvre D58 : **D58 couvre obligatoirement la perte d'un datacenter/AZ**.
---
## 33. Ordre de restauration proposé
1. déclarer l'incident et distinguer incident, détection et mobilisation ; 2. couper dispatcher, callbacks, rapports, IA, mail et exports ; 3. préserver preuves externes et dernier manifest vérifié ; 4. démarrer un environnement isolé sans egress d'effet ; 5. charger la génération de reprise et les tombstones indépendants ; 6. restaurer registre/auth central ; 7. invalider toutes les sessions restaurées ;
8. réconcilier comptes, MFA, rôles, memberships, boîtes et résiliations ; 9. restaurer chaque base agence sous nouvel endpoint ; 10. vérifier schéma, contraintes, séquences, droits, comptages et isolation ; 11. restaurer uniquement les objets encore autorisés ; 12. ne pas restaurer les exports expirés ; 13. restaurer Inngest PostgreSQL sans relancer les runs comme autorisations ;
14. traiter Redis comme perdu tant que sa récupération n'est pas prouvée ; 15. reconstruire seulement les timers dérivables d'intentions autoritaires ; 16. réconcilier Gmail par history ou full sync bornée ; 17. réconcilier Graph par delta de dossier ; 18. réconcilier IMAP par `UIDVALIDITY` et UID ; 19. respecter toujours la période historique choisie ; 20. réconcilier chaque effet externe incertain ;
21. maintenir `RESULTAT_INCONNU` sans preuve ; 22. rouvrir d'abord en lecture ; 23. passer ensuite au mode manuel ; 24. réactiver chaque autonomie séparément après validation indépendante ; 25. publier RPO réel, RTO réel, pertes, écarts, coûts et actions.
---
## 34. Contrôles anti-résurrection et anti-doublon
### Droits
- session restaurée invalide ; ancien rôle non autorité ; ancien TOTP non autorité ; boîte révoquée non réactivée ; validation restaurée non autorité ; génération courante supérieure au snapshot ; état actuel inconnu = fermeture ; aucune configuration restaurée ne peut élargir un droit.
### Effets
- clé logique unique préservée ; fence restauré comparé au fence courant ; `EN_COURS_EXTERNE` reste incertain ; `RESULTAT_INCONNU` reste bloqué ; aucun replay Inngest ne crée une autorisation ; recherche fournisseur avant retry ; SMTP non réconciliable = décision humaine ; aucune perte silencieuse.
---
# B03-P-1 — protocole complet proposé, non exécuté
## 35. Statut
`PROPOSÉ — NON AUTORISÉ — NON EXÉCUTÉ`
## 36. Hypothèse structurelle
Les autorités PostgreSQL permettent de restaurer central et agences à des points distincts, de calculer un cut cohérent, d'invalider les droits restaurés et de reconstruire les travaux techniques sans second effet externe, même si Redis est entièrement perdu.
## 37. Pourquoi la recherche ne suffit pas
La documentation ne prouve pas :
- l'ordre réel inter-stores ; la reconstruction des timers/runs ; l'effet d'un désalignement central/agences ; la survie d'une génération hors rollback ; la réconciliation d'un envoi inconnu ; la non-résurrection ; la reproductibilité du nettoyage.
## 38. Autorisation humaine préalable
Le propriétaire doit approuver séparément :
- durée maximale ; plafond monétaire ; CPU, RAM, disque et conteneurs ; réseau autorisé ; versions exactes ; volume maximal de preuves ; reviewer indépendant.
Sans ces valeurs, l'essai est refusé.
## 39. Environnement synthétique
- répertoire ou worktree jetable ; PostgreSQL local central ; deux bases agences ; PostgreSQL technique Inngest ; Redis local jetable ; stockage S3 local ou filesystem versionné ; fournisseur mail factice avec journal immuable ; inventaire de secrets factice ; horloge contrôlée ; utilisateurs, boîtes, messages et pièces synthétiques ; aucun compte Scaleway, Gmail, Microsoft ou Mistral.
## 40. Périmètre
- registre/auth central ; deux agences ; audit ; tombstones ; générations ; inbox/outbox/intention/fence ; Inngest PostgreSQL ; perte complète Redis ; objets temporaires ; export dérivé ; curseurs mail factices ; effet confirmé ; échec certain ; résultat inconnu ; points de restauration désalignés ; calcul du cut et des pertes.
## 41. Exclusions
- aucune mesure Scaleway ; aucune preuve AZ/région ; aucun fournisseur réel ; aucune charge représentative ; aucun SLA ; aucun RPO/RTO production ; aucune restauration V complète ; aucune conclusion juridique/privacy.
## 42. Étapes reproductibles
1. geler versions, schémas, seed et manifestes ; 2. créer central, agences, PostgreSQL technique, Redis et objets ; 3. créer un point `P0` avec hashes et comptages ; 4. créer après `P0` un message entrant ; 5. enregistrer une validation humaine ; 6. changer un rôle ; 7. révoquer session, facteur et boîte ; 8. créer un tombstone agence ; 9. créer une intention `EN_COURS_EXTERNE` ;
10. faire accepter l'envoi par le fournisseur factice sans rendre la réponse ; 11. créer des points `P1` désalignés selon les stores ; 12. supprimer les stores actifs ; 13. restaurer sans egress ; 14. charger génération et tombstones avant le central ; 15. invalider les sessions ; 16. réconcilier les révocations post-backup ; 17. restaurer les agences sous nouveaux endpoints ;
18. perdre Redis définitivement ; 19. reconstruire uniquement depuis les autorités ; 20. restaurer Inngest PG sans lancer les anciens runs ; 21. rapprocher messages et effets avec le fournisseur factice ; 22. vérifier que l'envoi accepté n'est jamais rejoué ; 23. identifier chaque perte non reconstructible ; 24. calculer le cut cohérent ; 25. calculer la borne RPO synthétique ;
26. mesurer la chronologie locale sans extrapolation cloud ; 27. rouvrir lecture puis manuel ; 28. tester une reprise d'autonomie explicitement approuvée ; 29. produire manifestes, journaux expurgés, hashes et matrice ; 30. rejouer le protocole une seconde fois.
## 43. Réussite mesurable
- zéro accès inter-agence ; zéro session ressuscitée ; zéro ancien TOTP réaccepté ; zéro membership ou boîte révoquée restaurée ; zéro second envoi ; exactement une intention logique par effet ; résultat inconnu bloqué jusqu'à réconciliation ; aucun ancien run traité comme autorisation ; tous les écarts identifiés ; toutes les pertes visibles et auditées ; cut cohérent calculable ;
- borne synthétique du scénario strictement sous 240 minutes ; nettoyage vérifié ; résultat reproductible ; revue indépendante sans Critical/Major.
Le temps local ne constitue pas un PASS D58.
## 44. Échec ou arrêt immédiat
- deuxième envoi ; réouverture avec autorité invérifiable ; résurrection d'un droit, facteur, boîte ou agence ; job sans intention autoritaire ; accès mail hors période ; original interdit conservé ; perte silencieuse ; résultat non reproductible ; réseau imprévu ; donnée ou secret réel ; dépassement de plafond.
## 45. Nettoyage
- arrêter et supprimer processus/conteneurs ; supprimer bases et volumes ; supprimer Redis ; supprimer objets, archives, caches et mails synthétiques ; supprimer credentials locaux ; vérifier ports et processus ; vérifier volumes et répertoires ; conserver uniquement les preuves expurgées approuvées ; produire inventaire avant/après ; attester zéro ressource cloud et zéro donnée réelle.
## 46. Restitution indépendante
Le reviewer reçoit :
- versions ; manifestes ; seeds ; timestamps ; points `P0/P1` ; hashes ; comptages ; journal fournisseur factice ; chronologie ; cut retenu ; pertes et inconnues ; preuve de nettoyage.
Un PASS B03-P-1 démontre uniquement la mécanique locale de cohérence et de sûreté. Il ne reclassifie pas B03 en PASS.
---
# B03-V-1 — preuve future de restauration complète
## 47. Statut et portée
`FUTUR — NON EXÉCUTÉ` B03-V-1 doit :
- utiliser la topologie finale QA équivalente production ; restaurer central, agence complète, objets, orchestrateur, secrets et réseau ; injecter une perte AZ/datacenter réaliste ou équivalente fournisseur ; mesurer le dernier point réellement récupérable ; chronométrer incident, détection et mobilisation ; tester l'indisponibilité des fournisseurs mail ; tester les droits révoqués après backup ;
- prouver l'absence de doublon externe ; inclure DNS, LB, promotion, restore, réconciliation, smoke et réouverture ; répéter assez pour établir une borne et non un meilleur temps isolé.
Seul B03-V-1 peut établir les RPO/RTO opérationnels.
---
## 48. Décisions humaines consolidées obligatoires
### B08
1. unité de taille ; 2. formats ; 3. quotas de reprise et mensuels ; 4. supplément comptes ; 5. durée métier commune ; 6. durées temporaires/audit/sécurité/backups/exports ; 7. rôles et bases légales ; 8. sous-traitants et contrats ; 9. stockage tombstones/générations ; 10. autorisation éventuelle B08-P-1.
### B10
11. cible interne de disponibilité ; 12. plan support Business/Enterprise ; 13. prestataire ; 14. budget d'astreinte ; 15. rotation et suppléance ; 16. sévérités et runbooks ; 17. exercices ; 18. bus factor ; 19. accès break-glass.
### B03
20. niveau de couverture PRA régionale distinct de D58 — froid, tiède, chaud ou risque explicitement accepté — sans modifier l'obligation D58 sur la perte datacenter/AZ ; 21. Instances ou Kapsule ; 22. preuve fournisseur HA `multiple_zone` ; 23. fréquence et marge backups ; 24. acceptation ou remplacement des backups logiques non chiffrés nativement ; 25. Redis reconstructible, auto-opéré ou remplacé ; 26. reconstruction Inngest ; 27. Object Storage multi-AZ et cross-region ; 28. stratégie secrets régionale ;
29. autorisation plafonnée B03-P-1 ; 30. financement et autorisation B03-V-1.
---
## 49. Handoff vers Q6 / B11
Q6 doit intégrer ces résultats sans transformer les propositions en décisions. Le corpus final doit :
- conserver `B08: BLOCKED`, `B10: BLOCKED` et `B03: BLOCKED` ; reporter trois comptes et deux boîtes ; reporter l'export dérivé sans EML/pièces ; dater la supersession de D43 sans effacer l'historique ; distinguer 20 Mo et 20 MiB ; conserver les coûts EUR et USD séparés ; utiliser +10 % pour l'inférence régionale Mistral standard et traiter l'offre Enterprise à +75 % comme une option commerciale distincte limitée aux API éligibles ;
- présenter deux, trois et cinq ans comme options, non comme obligations ; distinguer temporaires, métier, audit, sécurité, backups, tombstones et exports ; ne publier aucun SLA client ; ne confondre aucun IRT avec résolution ; conserver les options 99,5/99,9/99,95 % comme décisions ouvertes ; reporter les limites PostgreSQL, Redis, Kapsule, Object Storage et Secret Manager ;
- inscrire B03-P-1 comme non exécuté ; classer B03-V-1 comme preuve future ; exiger revue indépendante sans Critical/Major ; maintenir Architecture et Design System bloqués tant que les choix manquent.
---
## 50. Sources
### Évidence interne du dépôt
[1] `AGENTS.md` — règles de pipeline, preuves et gate Architecture.
[2] `docs/product/ISSUE_33_DECISIONS.md` — arbitrages produit du 2 octobre 2026.
[3] `.hermes/plans/2026-10-02_145323-qualification-b01-b12.md` — mandat et matrice Q5/Q6.
[4] `docs/product/ARCHITECTURE_Q2_B02_B04.md` — topologies, coûts runtime et limites Redis/Kapsule.
[5] `docs/product/ARCHITECTURE_Q3_B05_B06.md` — contrats mail, IA, prix historiques et privacy.
[6] `docs/product/ARCHITECTURE_Q1_B01.md` — PostgreSQL, backups, HA, restauration et coûts.
[7] `docs/product/ARCHITECTURE_Q4_B07_B12.md` — auth, outillage, artefacts et télémétrie.
[8] `docs/product/ARCHITECTURE_RESEARCH.md` — registre de recherche F01–F14.
[9] `docs/adr/008-ia-catalogue-budget-byok.md` — catalogue, ledger, BYOK et fallback.
[10] `docs/adr/009-documents-quarantaine-depot.md` — quarantaine, formats et limite 20 Mo historique.
[11] `docs/adr/010-pra-export-resiliation.md` — D58, export, résiliation et anti-résurrection.
[12] `docs/adr/012-audit-observabilite-alertes.md` — audit séparé et alertes minimisées.
[13] `docs/adr/013-qa-livraison-tests.md` — QA isolée, artefacts et rollback.
[14] `docs/adr/003-identite-centrale-better-auth-mfa.md`, `005-inngest-scaleway-conditionnel.md`, `006-effets-idempotence-fencing.md`, `007-messagerie-tags-connecteurs.md` — identité, orchestration, effets et connecteurs.
### Sources primaires externes
[15] https://www.scaleway.com/en/pricing/model-as-a-service/
[16] https://www.scaleway.com/en/docs/generative-apis/reference-content/data-privacy
[17] https://mistral.ai/pricing/api/
[18] https://docs.mistral.ai/inference/regional-inference
[19] https://www.scaleway.com/en/pricing/managed-services/
[20] https://www.scaleway.com/en/pricing/containers/
[21] https://developers.google.com/workspace/gmail/api/reference/quota
[22] https://learn.microsoft.com/en-us/graph/throttling-limits
[23] https://eur-lex.europa.eu/eli/reg/2016/679/oj
[24] https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4
[25] https://www-uploads.scaleway.com/DPA_2024_ENG_b0abb5cc26.pdf
[26] https://legal.mistral.ai/terms/data-processing-addendum
[27] https://www.cnil.fr/fr/securite-tracer-les-operations
[28] https://www.cnil.fr/fr/le-droit-la-portabilite-obtenir-et-reutiliser-une-copie-de-vos-donnees
[29] https://www.scaleway.com/en/docs/account/support/understanding-support-plans/
[30] https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006902581/
[31] https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs
[32] https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/concepts/
[33] https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/faq/
[34] https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-backups/
[35] https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-read-replicas/
[36] https://www.scaleway.com/en/docs/managed-databases-for-redis/reference-content/ensuring-data-persistence/
[37] https://www.scaleway.com/en/docs/object-storage/concepts/
[38] https://www.scaleway.com/en/docs/object-storage/faq/
[39] https://www.scaleway.com/en/docs/object-storage/how-to/manage-lifecycle-rules/
[40] https://www.scaleway.com/en/docs/secret-manager/concepts/
[41] https://www.scaleway.com/en/docs/secret-manager/how-to/delete-secret/
[42] https://www.scaleway.com/en/docs/kubernetes/concepts/
[43] https://www.scaleway.com/en/docs/kubernetes/reference-content/multi-az-clusters/
[44] https://www.scaleway.com/en/docs/kubernetes/reference-content/kubernetes-control-plane-offers/
[45] https://www.scaleway.com/en/docs/kubernetes/reference-content/kubernetes-load-balancer/
---
**Conclusion :** Q5 fournit un modèle de décision et des protocoles vérifiables, mais aucune adoption. B08, B10 et B03 restent `BLOCKED`. Aucun POC, compte, devis, contact, ressource, dépense ou donnée réelle n'a été utilisé.
