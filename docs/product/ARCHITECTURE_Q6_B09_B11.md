# Q6 — Qualification B09 et préparation de consolidation B11

**Date de qualification : 2026-10-03**
**Issue : #42**
**Périmètre : Q6 — B09 calendrier, fermetures, horaires et rapports ; B11 couverture et consolidation contrôlée de B01 à B12.**
**Mode : LARGE — qualification documentaire en lecture seule.**

Aucun fichier canonique n’est modifié par ce livrable. Aucun compte, installation, fournisseur, cloud, ressource, dépense, donnée réelle, secret, environnement de test ou mini-POC n’a été utilisé. Les candidats techniques cités dans Q1 à Q5 restent des candidats : ce document n’en adopte aucun et ne transforme aucune preuve future en résultat acquis.

## 1. Verdict Q6

- **`B09: BLOCKED`**
- **`B11: BLOCKED`**
- **`ARCHITECTURE: BLOCKED`**

La décision produit principale sur les fermetures et les rapports est **acquise et ne doit pas être rouverte** :

1. **aucun rapport pendant une fermeture de l’agence** ;
2. toute occurrence empêchée reste **visible et auditée** ;
3. il n’existe **aucun décalage**, **aucun rapport séparé de rattrapage** et **aucun rattrapage automatique** ;
4. les créneaux restent **lundi–vendredi à 08:45, 13:30 et 16:00, heure locale de l’agence** ;
5. la **prochaine occurrence autorisée** couvre toute la période depuis le **dernier rapport effectivement envoyé**, fermeture et week-end compris ;
6. les rapports sont un type d’effet **distinct des horaires d’action de l’agent** ; l’arbitrage étroit B09-D1 porte seulement sur la règle de précédence à appliquer hors fermeture, pas sur la réouverture de cette distinction ;
7. l’exception Sinistres reste **déterministe et bornée** : accusé unique sous contrôles, indiquant réception, examen à la prochaine ouverture et retour dans les meilleurs délais, sans promettre un début d’intervention, sans « demain » absolu, sans astreinte ni consigne d’urgence inventée.

B09 reste `BLOCKED` parce que trois arbitrages étroits B09-D1 à B09-D3 ne sont pas décidés et parce que le protocole `B09-P-1`, nécessaire avant PASS sauf preuve équivalente, n’est ni autorisé ni exécuté. B11 reste `BLOCKED` parce que le corpus canonique n’a pas été consolidé, que ses supersessions ne sont pas encore enregistrées dans chaque source d’autorité et qu’aucune revue indépendante du corpus consolidé n’existe.

La revue documentaire de ce candidat peut conclure que le livrable Q6 est cohérent. Elle ne peut pas, à elle seule, produire `B09: PASS`, `B11: PASS` ou `ARCHITECTURE: PASS`.

## 2. Autorité produit préservée

### 2.1 Fermetures

Une fermeture est un intervalle administratif versionné, commun à l’agence, saisi par un administrateur habilité. Aucun calendrier de jours fériés automatique n’est supposé. Plusieurs fermetures actives se composent par union d’intervalles ; leur chevauchement ne crée ni double occurrence empêchée ni double audit.

L’ajout, la modification ou la suppression d’une fermeture ne réécrit pas l’historique. La version active au moment du contrôle d’autorité gouverne une occurrence non commencée. Une occurrence déjà empêchée n’est jamais ressuscitée par une suppression ultérieure de fermeture.

### 2.2 Rapports fixes

Chaque jour autorisé du lundi au vendredi possède trois créneaux logiques : `08:45`, `13:30` et `16:00`, interprétés dans la zone locale de l’agence. Une fermeture couvrant le créneau empêche l’occurrence. Elle ne la déplace pas avant ou après la fermeture.

Le curseur de couverture n’avance qu’après un rapport **effectivement envoyé avec résultat confirmé**. Une occurrence empêchée, un échec certain ou un résultat inconnu ne fait pas avancer ce curseur. À la prochaine occurrence autorisée, le rapport couvre depuis le dernier envoi confirmé ; il ne crée pas un document séparé « rattrapage ».

Le rapport du lundi matin suit la même règle générale : il couvre depuis le dernier rapport confirmé du vendredi, ou depuis un envoi confirmé antérieur si une fermeture a empêché les occurrences intermédiaires, et inclut l’activité du week-end ainsi que les dossiers ouverts selon les règles déjà acquises.

### 2.3 Rapports et horaires d’action

Les horaires d’action régissent les effets autonomes métier de l’agent. Les rapports fixes sont une catégorie d’effet distincte avec leurs propres occurrences. Une fermeture est opposable aux deux. L’exception Sinistres déterministe reste la seule exception horaire explicitement acquise ; elle ne devient ni un rapport, ni un début d’intervention, ni une astreinte.

B09-D1 doit encore décider si, **hors fermeture**, un créneau fixe de rapport situé hors de la fenêtre d’action reste exécutable du seul fait de son horaire fixe, ou si la fenêtre d’action lui est également opposable. Dans tous les cas, le système doit conserver des politiques, états et audits distincts ; il ne doit jamais déduire silencieusement une règle de l’autre.

## 3. Contrat temporel fail-closed

### 3.1 Zone, tzdb et planning

Chaque agence possède un identifiant de zone **IANA** explicite ; un simple offset UTC ou une abréviation locale ne suffit pas. Le registre IANA fournit les identifiants de zones et les distributions de la base de données des fuseaux horaires.[1] La théorie IANA décrit pourquoi les règles locales et leur historique doivent être traités comme des données susceptibles d’évoluer, plutôt que comme un décalage fixe.[6]

Chaque décision de calcul conserve au minimum :

- `agency_id` ;
- `timezone_id` IANA ;
- `tzdb_version` réellement utilisée ;
- `schedule_version` ;
- date locale et créneau logique ;
- temps local demandé ;
- instant UTC résolu, s’il est unique ;
- versions de fermeture, mandat et destinataire utilisées ;
- motif d’empêchement ou résultat de livraison.

Une modification de zone, de version tzdb, de planning ou de fermeture crée une nouvelle version ; elle ne recalcule pas silencieusement les occurrences historiques. Les instants persistés ou échangés utilisent une représentation RFC 3339 explicite avec offset ; cette représentation ne remplace pas l’identifiant de zone nécessaire au raisonnement civil futur.[3] Quand une forme étendue transporte aussi le nom de zone, elle suit le modèle d’annotations défini par RFC 9557, sans considérer qu’un offset suffit à reconstruire toutes les règles de la zone.[7]

### 3.2 Temps local et instant

Le moteur construit d’abord le temps civil attendu :

```text
(date_locale, 08:45 | 13:30 | 16:00, timezone_id, tzdb_version, schedule_version)
```

Il demande ensuite les instants possibles :

- **un instant** : l’occurrence peut être planifiée ;
- **zéro instant** — gap DST ou règle locale inexistante : `PREVENTED_TIME_NONEXISTENT` ;
- **plusieurs instants** — overlap DST ou ambiguïté locale : `PREVENTED_TIME_AMBIGUOUS`.

Aucun gap n’est déplacé automatiquement vers « l’heure suivante ». Aucun overlap ne choisit implicitement la première ou la seconde occurrence. Les API Temporal documentent précisément que les temps locaux ambigus ou sautés exigent une politique de désambiguïsation ; DossierClé impose ici le refus fail-closed plutôt qu’un choix implicite.[8]

### 3.3 Intervalles

Tous les intervalles temporels internes suivent la convention **`[start, end)`** : début inclus, fin exclue.

Conséquences :

- une fermeture `[08:00, 08:45)` ne couvre pas le créneau `08:45` ;
- une fermeture `[08:45, 09:00)` couvre le créneau `08:45` ;
- deux fermetures adjacentes peuvent être fusionnées sans double comptage ;
- une fin égale au début d’une occurrence ne l’empêche pas ;
- une date de fin antérieure ou égale au début est refusée à la saisie.

Les bornes sont d’abord validées en temps civil et zone versionnée, puis résolues en instants. Toute borne inexistante ou ambiguë est refusée ; le système ne corrige pas automatiquement l’entrée administrative.

### 3.4 Clé logique et unicité

Une obligation de rapport possède une clé logique stable, indépendante de la version de planning :

```text
(agency_id, report_type, local_date, local_slot, recipient_binding_id)
```

`schedule_version`, `timezone_id`, `tzdb_version`, `scheduled_at_utc` et les versions d’autorité sont des attributs audités de cette obligation, jamais des composants permettant de créer une seconde intention. Un conflit d’unicité impose de relire l’occurrence existante ; il n’autorise jamais la création d’une deuxième occurrence.

Si une nouvelle version de planning affecte une obligation future déjà matérialisée, la mise à jour doit verrouiller cette obligation stable et appliquer l’un des trois résultats suivants dans une même transaction :

1. tant qu’aucun traitement n’a commencé, remplacer ses attributs temporels par la nouvelle résolution tout en conservant la même clé et l’historique des versions ;
2. si une génération ou préparation a commencé mais qu’aucun réseau ni effet externe n’a débuté, terminer l’ancienne révision en `SUPERSEDED_PLANNING`, puis créer au plus une nouvelle révision rattachée à la même obligation stable après recontrôle ;
3. si le réseau ou un effet externe a commencé, préserver l’état réel (`SENDING`, `RESULT_UNKNOWN`, `SENT_CONFIRMED` ou échec certain), interdire toute seconde matérialisation et réconcilier avant toute suite.

Au plus une révision active peut donc exister pour une obligation, sous contrainte transactionnelle distincte de l’historique des révisions terminales. Une nouvelle version de destinataire crée un nouveau `recipient_binding_id` seulement après révocation explicite de l’ancien binding ; elle ne duplique pas une livraison déjà engagée.

### 3.5 États

États minimaux proposés, à consolider sans les présenter comme schéma adopté :

```text
PLANNED
ELIGIBILITY_CHECK
PREVENTED_CLOSED
PREVENTED_TIME_NONEXISTENT
PREVENTED_TIME_AMBIGUOUS
PREVENTED_RIGHTS
PREVENTED_LATE
SUPERSEDED_PLANNING
READY
GENERATING
READY_TO_SEND
SENDING
SENT_CONFIRMED
FAILED_CERTAIN
RESULT_UNKNOWN
CANCELLED_ADMIN
```

Règles :

- tous les états `PREVENTED_*` sont terminaux pour l’occurrence ;
- `SUPERSEDED_PLANNING` est terminal et ne peut jamais être envoyé ;
- un état empêché reste visible mais ne crée aucun envoi ultérieur ;
- `SENT_CONFIRMED` est le seul état qui avance le curseur de couverture ;
- `FAILED_CERTAIN` peut autoriser un retry de la même occurrence dans la limite B09-D2, jamais une occurrence de rattrapage ;
- `RESULT_UNKNOWN` bloque tout nouvel envoi logique jusqu’à réconciliation ;
- un changement administratif ne transforme pas rétroactivement un état terminal.

### 3.6 Curseur par recipient binding

Le curseur appartient à un **recipient binding versionné**, pas seulement à une adresse e-mail textuelle. Le binding relie agence, type de rapport, destinataire, rôle/mandat, configuration et période de validité.

Chaque binding conserve au minimum :

- `last_confirmed_sent_at` ;
- `last_confirmed_logical_key` ;
- `coverage_watermark` ;
- version de filtre/droits utilisée ;
- dernière séquence incluse ;
- statut actif, révoqué ou remplacé.

Le curseur n’est jamais avancé par une génération, une mise en file, un début de réseau ou un accusé local. Il avance par compare-and-swap transactionnel après confirmation de livraison et association à la clé logique. Une révocation gèle le binding. Une réautorisation ou un nouveau destinataire relève de B09-D3 : aucun héritage de curseur n’est implicite.

### 3.7 Watermarks et séquences

Le rapport doit être borné par des watermarks reproductibles, et non par une requête vague « depuis telle heure ». Chaque source autoritaire expose une séquence monotone ou un couple ordonné stable. La génération capture un `from_exclusive` issu du dernier envoi confirmé et un `to_inclusive` figé pour l’occurrence.

Les événements arrivés après `to_inclusive` restent pour l’occurrence suivante. Les événements tardifs dont la séquence appartient à une fenêtre déjà envoyée sont traités selon une règle explicite et auditable ; ils ne provoquent pas la réémission silencieuse d’un ancien rapport. Une restauration ou un changement de source ne doit jamais faire reculer le watermark sans décision de réconciliation.

### 3.8 Idempotence et résultat inconnu

L’intention d’envoi porte :

- la clé logique ;
- une clé d’idempotence fournisseur si le transport la supporte ;
- un fence monotone ;
- les versions d’autorité ;
- le hash du contenu généré ;
- les watermarks couverts ;
- le nombre de tentative et la cause.

Un crash avant tout début réseau peut revenir à `READY_TO_SEND` si les autorités sont toujours valides. Un crash après début réseau, ou une réponse perdue, donne `RESULT_UNKNOWN`. Le système recherche alors une preuve fournisseur ou une preuve locale d’acceptation. À défaut, aucune deuxième émission automatique n’est permise. L’incertitude est visible et demande réconciliation ou décision humaine.

### 3.9 Recontrôle des droits et du mandat

Les droits, l’appartenance, le rôle, le mandat Communications, l’état de l’agence, la fermeture, le binding destinataire, la suspension, la résiliation, la version active du planning et les fences sont rechargés :

1. avant génération ;
2. avant matérialisation du contenu ;
3. juste avant tout début réseau ;
4. avant chaque retry autorisé.

Un rapport généré sous d’anciens droits ne peut pas être envoyé après réduction des droits. Une session utilisateur ancienne n’autorise pas un job. Si l’autorité courante est indisponible ou contradictoire, l’envoi échoue fermé en `PREVENTED_RIGHTS` ou reste bloqué, selon qu’aucun réseau n’a commencé ou qu’un résultat est déjà inconnu.

Si la `schedule_version` portée par l’occurrence ne correspond plus à la version active lors d’un recontrôle, aucun envoi ne commence. Le système verrouille la clé d’obligation indépendante de la version, puis remplace l’occurrence encore future ou la termine en `SUPERSEDED_PLANNING` selon les règles de la section 3.4. Il ne crée jamais en parallèle une occurrence « ancienne version » et une occurrence « nouvelle version » pour le même binding, créneau et jour local.

## 4. Matrice de scénarios B09

| ID | Scénario | Résultat attendu fail-closed |
|---|---|---|
| **B09-S01** | Jour ouvré, agence ouverte, créneau 08:45 unique | Une seule occurrence ; droits et mandat recontrôlés ; couverture depuis le dernier envoi confirmé ; curseur avancé seulement après `SENT_CONFIRMED`. |
| **B09-S02** | Jour ouvré, créneau 13:30 après rapport 08:45 confirmé | Couverture à partir du watermark confirmé de 08:45 ; aucune répétition due au scheduler ; événements après le watermark inclus une seule fois. |
| **B09-S03** | Jour ouvré, créneau 16:00 après rapport 13:30 confirmé | Même contrat ; une clé logique unique ; aucune dépendance aux horaires d’action déduite sans décision B09-D1. |
| **B09-S04** | Samedi ou dimanche | Aucune occurrence fixe créée ou envoyée ; l’activité reste disponible pour la prochaine occurrence autorisée. |
| **B09-S05** | Lundi 08:45 après vendredi 16:00 confirmé | Rapport unique couvrant depuis le vendredi confirmé, week-end compris, et dossiers ouverts ; aucun rapport « week-end » séparé. |
| **B09-S06** | Fermeture couvrant exactement un créneau | Occurrence `PREVENTED_CLOSED`, visible ; aucun envoi, décalage ou rattrapage ; curseur inchangé. |
| **B09-S07** | Fermeture couvrant toute une journée ouvrée | Trois occurrences empêchées visibles ; aucune émission ce jour ; prochaine occurrence autorisée couvre depuis le dernier rapport confirmé. |
| **B09-S08** | Fermeture vendredi après-midi jusqu’à lundi midi | Vendredi 13:30/16:00 et lundi 08:45 empêchés selon bornes ; lundi 13:30, si autorisé, couvre depuis le dernier envoi confirmé antérieur. |
| **B09-S09** | Deux fermetures se chevauchent | Union des intervalles ; une seule qualification d’empêchement par occurrence ; pas de double état ni de double audit. |
| **B09-S10** | Fermeture raccourcie avant l’échéance | La dernière version active gouverne l’occurrence non commencée ; historique des versions conservé. |
| **B09-S11** | Fermeture ajoutée après génération mais avant appel fournisseur | Recontrôle final : livraison bloquée ; contenu périmé non envoyé à la réouverture ; occurrence empêchée visible. |
| **B09-S12** | Fermeture supprimée après occurrence empêchée | Aucune résurrection, exécution tardive ou rattrapage de l’occurrence terminale. |
| **B09-S13** | Horaires d’action fermés, agence ouverte, créneau rapport fixe | Politiques distinctes ; comportement final selon B09-D1 ; aucune règle implicite ni changement des horaires fixes. |
| **B09-S14** | Agence fermée, exception Sinistres reçue | Aucun rapport ; seul l’accusé Sinistres déterministe borné peut être envisagé sous ses contrôles propres ; il ne devient pas une intervention. |
| **B09-S15** | Fermeture `[08:00,08:45)` | Le créneau 08:45 n’est pas couvert par l’intervalle demi-ouvert ; autres contrôles restent obligatoires. |
| **B09-S16** | Fermeture `[08:45,09:00)` | Le créneau 08:45 est empêché ; aucun déplacement à 09:00. |
| **B09-S17** | Début ou fin de fermeture ambigu pendant un overlap DST | Saisie refusée ou occurrence empêchée explicitement ; jamais de choix automatique du premier ou second instant. |
| **B09-S18** | Créneau local inexistant pendant un gap DST | `PREVENTED_TIME_NONEXISTENT` ; aucune translation automatique ; prochaine occurrence autorisée applique le curseur inchangé. |
| **B09-S19** | Créneau local ambigu pendant un overlap DST | `PREVENTED_TIME_AMBIGUOUS` ; aucune double émission et aucun choix implicite. |
| **B09-S20** | Changement de zone IANA pendant qu’une occurrence future de l’ancienne version existe | Verrouillage de la clé d’obligation indépendante du planning ; remplacement transactionnel si aucun traitement n’a commencé, `SUPERSEDED_PLANNING` avant réseau, ou blocage/réconciliation si un effet a commencé ; jamais deux occurrences actives ou deux envois. |
| **B09-S21** | Mise à jour tzdb modifiant une règle future, avec ancien et nouveau scheduler concurrents | La contrainte sur l’obligation stable absorbe la course ; une seule version active est retenue après validation, l’autre relit ou termine son candidat sans effet ; passé et occurrences déjà terminales restent inchangés. |
| **B09-S22** | Deux schedulers créent la même occurrence | Contrainte d’unicité sur clé logique ; un seul enregistrement gagne, l’autre relit ; aucune seconde intention. |
| **B09-S23** | Double callback ou retry avant génération | Même clé logique et même fence ; une seule génération autoritaire ; doublon technique absorbé. |
| **B09-S24** | Crash avant début réseau | Reprise possible de la même occurrence après recontrôle complet, dans la limite B09-D2 ; aucun nouveau rapport logique. |
| **B09-S25** | Fournisseur refuse avec échec certain | `FAILED_CERTAIN` ; retry borné de la même occurrence seulement si B09-D2 l’autorise et si droits/fermeture restent valides. |
| **B09-S26** | Fournisseur accepte mais réponse perdue | `RESULT_UNKNOWN` ; aucune nouvelle émission automatique ; réconciliation obligatoire. |
| **B09-S27** | Résultat inconnu toujours non résolu au créneau suivant | Ancienne occurrence reste bloquée ; le système ne présume ni succès ni échec ; risque de chevauchement signalé et décision humaine selon contrat de réconciliation. |
| **B09-S28** | Droits du destinataire retirés après génération | Envoi bloqué au recontrôle ; ancien contenu jamais livré ; curseur inchangé. |
| **B09-S29** | Mandat Communications suspendu ou agence résiliée | Toute nouvelle émission est bloquée ; aucune session, queue ou restauration ne réactive le mandat. |
| **B09-S30** | Destinataire remplacé avant le créneau | Ancien binding révoqué ; nouveau binding traité selon B09-D3 ; aucun transfert implicite du contenu ou curseur. |
| **B09-S31** | Nouveau destinataire ajouté après plusieurs jours d’activité | Aucun historique envoyé tant que B09-D3 n’a pas fixé le curseur initial ; fail-closed par absence d’envoi. |
| **B09-S32** | Destinataire réautorisé après révocation | Nouveau binding ou nouvelle génération ; aucun héritage silencieux de l’ancien curseur ; décision B09-D3 requise. |
| **B09-S33** | Événement arrive après le watermark figé pendant la génération | Exclu de ce rapport et repris par l’occurrence suivante ; le contenu déjà figé n’est pas modifié silencieusement. |
| **B09-S34** | Événement tardif est découvert pour une période déjà couverte | Visible dans la prochaine synthèse selon règle de provenance ; aucune réémission de l’ancien rapport et aucune perte silencieuse. |
| **B09-S35** | Restauration fait reculer une séquence ou un curseur | Envoi bloqué ; divergence auditée ; réconciliation avant reprise ; aucun doublon produit par le rollback. |
| **B09-S36** | Le dernier rapport a été généré mais pas confirmé envoyé | Il ne constitue pas le point de départ ; la prochaine occurrence autorisée part du dernier `SENT_CONFIRMED`, sous réserve de réconciliation de tout résultat inconnu. |
| **B09-S37** | Fermeture prend fin avant le créneau suivant | Aucun rapport à l’instant de réouverture ; seule l’occurrence fixe suivante peut partir et couvre depuis le dernier envoi confirmé. |
| **B09-S38** | Exception Sinistres et rapport fixe deviennent simultanément éligibles | Deux intentions, clés, contenus et politiques distincts ; aucun couplage implicite ; fermeture bloque le rapport, l’accusé reste soumis à son exception déterministe et à tous les contrôles d’autorité. |

## 5. Arbitrages humains étroits B09

La décision principale de fermeture est close. Les trois questions suivantes ne doivent pas servir à la rouvrir.

### B09-D1 — Interaction des rapports fixes avec les horaires d’action hors fermeture

**Question :** lorsque l’agence n’est pas fermée mais qu’un créneau fixe de rapport tombe hors de la fenêtre d’action de l’agent, quelle politique prévaut ?

- **Option A — horaire fixe autonome :** le rapport peut partir à 08:45/13:30/16:00 même hors fenêtre d’action, car les rapports sont une catégorie distincte. Avantage : respecte littéralement les créneaux. Risque : envoi externe alors que les autres actions sont interdites.
- **Option B — double condition :** le créneau fixe n’est exécutable que si la fenêtre d’action est également ouverte. L’occurrence devient empêchée, visible et sans rattrapage. Avantage : politique externe uniforme. Risque : certains créneaux fixes peuvent être durablement empêchés si la configuration est incohérente.
- **Option C — validation de configuration :** imposer que les trois créneaux appartiennent aux horaires d’action ; refuser toute configuration incohérente. Avantage : élimine le conflit à l’exécution. Risque : contraint les horaires et exige une migration des configurations existantes.

**Recommandation fail-closed : Option C**, puis Option B si une incohérence historique subsiste. Cette recommandation n’est pas une décision.

**Statut : `À DÉCIDER`.**

### B09-D2 — Limite d’envoi technique tardif

**Question :** jusqu’à quand une occurrence dont l’envoi a été retardé par une panne technique, mais non empêchée par fermeture, peut-elle encore être envoyée ?

- **Option A — jusqu’au créneau fixe suivant :** retry de la même occurrence possible avant l’échéance logique suivante ; ensuite `PREVENTED_LATE`.
- **Option B — fenêtre bornée dédiée :** durée maximale fixée par politique après le créneau, nécessairement inférieure à l’intervalle vers le créneau suivant.
- **Option C — aucun retard :** passé l’instant du créneau et une tolérance purement transactionnelle, l’occurrence est empêchée ; la suivante couvre depuis le dernier envoi confirmé.

Dans toutes les options : aucun retry après fermeture devenue active, aucun second envoi sur résultat inconnu, aucun rapport séparé de rattrapage et aucun avancement de curseur avant confirmation.

**Recommandation fail-closed : Option A**, avec borne stricte au créneau logique suivant et passage irréversible à `PREVENTED_LATE`. Aucun nombre de minutes n’est inventé.

**Statut : `À DÉCIDER`.**

### B09-D3 — Curseur initial d’un nouveau destinataire ou d’un destinataire réautorisé

**Question :** quel début de couverture appliquer à un nouveau recipient binding ?

- **Option A — activation seulement :** premier rapport couvre les événements postérieurs à l’activation confirmée du binding.
- **Option B — dernier rapport confirmé du même type pour l’agence :** le nouveau destinataire reçoit la prochaine synthèse depuis le dernier envoi agence, sans reprendre l’historique antérieur.
- **Option C — point explicite choisi par un administrateur :** date/watermark borné et prévisualisé, sous droits et audit, sans accès implicite à une période antérieure.
- **Option D — héritage de l’ancien binding réautorisé :** uniquement si la continuité d’identité, de mandat et de finalité est démontrée et explicitement approuvée ; sinon interdit.

**Recommandation fail-closed : Option A par défaut**, avec Option C uniquement après choix administratif explicite et contrôle des droits. Une réautorisation crée par défaut un nouveau binding ; aucun héritage silencieux.

**Statut : `À DÉCIDER`.**

## 6. B09-P-1 — simulation temporelle bornée

**Statut : `NON AUTORISÉ — NON EXÉCUTÉ`.**

`B09-P-1` est nécessaire avant `B09: PASS`, sauf preuve primaire ou formelle équivalente, datée, reproductible et reclassée par décision humaine. La recherche documentaire ne prouve pas à elle seule l’atomicité des états, la non-duplication sous crash, les transitions DST, la cohérence des watermarks ou la reprise après résultat inconnu.

### Hypothèse

Un moteur local peut produire exactement une occurrence logique par binding et créneau, refuser les gaps/overlaps, respecter les fermetures `[start,end)`, ne jamais rattraper une occurrence empêchée, avancer les curseurs seulement sur envoi confirmé et résister aux crashes/retries sans second effet.

### Conditions préalables obligatoires

Avant toute exécution, une autorisation humaine distincte doit fixer le périmètre, les versions, la durée maximale, les quotas techniques, les critères d’arrêt et le reviewer. **Aucune installation, aucun compte, aucune donnée réelle, aucun fournisseur, aucune dépense et aucun cloud ne sont autorisés par le présent document.**

### Environnement proposé, non créé

- fixture locale jetable ;
- horloge contrôlée ;
- tzdb explicitement versionnée ;
- agence, destinataires, événements et fermetures synthétiques ;
- transport mail factice avec journal immuable ;
- concurrence et crashes injectés ;
- aucun accès réseau nécessaire ;
- nettoyage intégral et inventaire avant/après.

### Scénarios minimum

Les 38 scénarios B09-S01 à B09-S38, plus : concurrence de deux schedulers, crash avant/après début réseau, réponse factice perdue, changement de zone/tzdb, rollback de curseur, droits retirés entre génération et livraison, et répétition complète du protocole.

### Succès

- zéro rapport pendant fermeture ;
- zéro déplacement/rattrapage ;
- zéro double occurrence ou double envoi ;
- gaps/overlaps refusés ;
- une clé logique stable ;
- curseur avancé uniquement sur confirmation ;
- résultat inconnu bloqué ;
- droits et mandat recontrôlés ;
- toutes les occurrences empêchées visibles ;
- résultats reproductibles et revue indépendante sans Critical/Major.

### Échec et arrêt

Arrêt immédiat sur : envoi pendant fermeture, choix implicite DST, doublon, curseur avancé trop tôt, droit périmé utilisé, résultat inconnu rejoué, événement perdu, réseau/fournisseur réel, donnée réelle, installation non approuvée, dépense, dépassement de la borne autorisée ou résultat non reproductible.

Même réussi, `B09-P-1` ne prouverait ni exploitation de production, ni délivrabilité fournisseur, ni SLA, ni PRA complet. Les preuves d’environnement réel resteraient classées Verify.

## 7. Matrice B01–B12 après Q1–Q6

| Bloc | Verdict | Décisions acquises à préserver | Décisions ou preuves encore obligatoires | Impact futur B11 |
|---|---|---|---|---|
| **B01** | **`BLOCKED`** | PostgreSQL managé Scaleway Paris, Production Optimized/HA/Block est une voie prioritaire sous conditions ; base et utilisateur runtime dédiés par agence sur instance potentiellement mutualisée. Aucun SKU n’est adopté. | Offre/SKU/topologie HA exacts ; disponibilité/prix de `multiple_zone` ; PITR ; fréquence et marge de backup ; restauration individuelle isolée ; chiffrement du chemin logique ; densité/pools/flotte/coût ; autorisation puis preuve `B01-P-1`. | ADR-002, Architecture données/PRA, registre et gate doivent distinguer candidat, limites et D58. |
| **B02** | **`BLOCKED`** | Inngest auto-hébergé chez Scaleway reste `PROPOSED`; Inngest Cloud exclu ; PostgreSQL/Redis externes ; ADR-006 reste autorité des effets. | Avis licence SSPL/transition ; version finale ; runtime Instances ou Kapsule ; Redis récupérable/reconstructible ou alternative ; rétention ; HA ; coût ; exception au tout-serverless ; autorisation et preuve `B02-P-1`. | ADR-005/006, Architecture persistance/reprise, décisions D52 et gate ; aucune adoption implicite. |
| **B03** | **`BLOCKED`** | D58 impose RPO et RTO chacun strictement <4 h pour perte datacenter/AZ ; perte régionale distincte à chiffrer ; aucun droit ni effet ne doit ressusciter. | Cut récupérable cohérent ; tombstones/générations hors rollback ; stratégie Redis/Inngest/objets/secrets ; ordre de reprise ; mobilisation ; `B03-P-1` local autorisé puis `B03-V-1` réel ; choix PRA régional. | ADR-010, Architecture PRA, D58, Stories de reprise et STATUS. |
| **B04** | **`BLOCKED`** | Flux privés autant que possible ; callbacks publics signés et anti-rejeu si nécessaires ; IAM minimal par workload/secret ; aucun port technique public ni secret global. | Topologie réseau finale ; callback exécuté ; perte AZ/LB/control plane ; egress/NAT ; workload identity ou acceptation de clés scoped ; rotation/révocation ; `B04-P-1`. | ADR-001/005/012, Architecture infra/sécurité, D09/D52 et gates. |
| **B05** | **`BLOCKED`** | Trois familles pilotes Gmail, Microsoft Graph et IMAP/SMTP ; période historique strictement choisie sans défaut ; tags/readback avant autonomie ; référence descriptive sans lien ; originaux restent dans la messagerie. | Autoriser `B05-P-1` ; onboarding OAuth et vérification Gmail ; scopes/permissions finaux ; familles IMAP/clients ; tags, déplacements, throttling, curseurs et résultat d’envoi inconnu ; coûts/capacités. | ADR-007, Architecture messagerie, D13/D56, PRD et Stories S07–S09/S13–S18/S34/S37. |
| **B06** | **`BLOCKED`** | Qwen/Scaleway est candidat principal, Mistral/OCR candidats de secours/BYOK ; aucune copie durable des pièces ; faits/provenance et abstention sur contradiction ; fallback futur seulement et consenti. | Autoriser `B06-P-1` ; modèles/version/région finaux ; qualité/gold set ; privacy, purge, ZDR/opt-out, DPA, sous-traitants ; exception de rétention ; coûts et enveloppe ; seuils de fallback. | ADR-008/009, Architecture IA/privacy, D14–D25/D31–D34/D49, PRD/Stories. |
| **B07** | **`BLOCKED`** | Session serveur ; idle humain 30 min ; durée absolue 15 jours ; polling non activité ; TOTP obligatoire ; plugins Organization/cookie cache/trusted device non autorisés par défaut. | Autoriser `B07-P-1` ; versions finales ; consommation atomique codes ; récupération/invitations ; guards ; rate limits ; révocation multi-onglets/jobs ; tests de compatibilité. | ADR-003/004, D01–D11/D53–D54, Architecture auth, Stories S01–S06. |
| **B08** | **`BLOCKED`** | Trois comptes et deux boîtes inclus ; originaux non conservés ; export dérivé sans EML/pièces ; durée métier commune aux agences mais valeur ouverte ; dépassement jamais silencieux. | Unité de taille ; formats ; quotas reprise/mensuels ; suppléments ; durées métier/temporaire/audit/sécurité/backups/export ; rôles/bases légales ; fournisseurs/régions/contrats ; tombstones ; éventuel `B08-P-1`. | ADR-009/010, D12/D41–D44/D49–D51, Architecture fichiers/rétention/export, PRD/Stories. |
| **B09** | **`BLOCKED`** | Décision principale de fermeture close ; créneaux fixes ; occurrence empêchée ; aucun rattrapage ; couverture depuis dernier envoi confirmé ; exception Sinistres bornée. | B09-D1/D2/D3 ; preuve `B09-P-1` ou équivalent ; tests DST, concurrence, curseurs, résultat inconnu et droits. | ADR-011/006, D45–D48, Architecture horaires/rapports, S11/S12/S25–S27/S33. |
| **B10** | **`BLOCKED`** | Disponibilité de lancement interne seulement ; aucun SLA client ; objectif de prise en charge critique 24/7 non financé ; support fournisseur ≠ résolution. | Cible interne ; support ; prestataire/devis ; budget/rotation/suppléance ; sévérités/canaux/runbooks ; exercices/bus factor/break-glass. | ADR-012/013, Architecture exploitation, D58, STATUS et critères futurs. |
| **B11** | **`BLOCKED`** | Les supersessions explicites de l’atelier #33 doivent prévaloir sans effacer l’historique ; tout bloc non prouvé reste `BLOCKED`. | Autorisation de modifier les canons ; matrice ancien→nouveau complète ; consolidation de tous fichiers ; revue indépendante sans Critical/Major ; décision humaine séparée sur le verdict final Architecture. | Tous les fichiers listés en section 9. |
| **B12** | **`BLOCKED`** | Matrice de candidats documentée ; build reproductible, mêmes digests QA/prod, SBOM, OpenAPI et télémétrie minimisée sont des exigences, pas des preuves acquises. | Autoriser `B12-P-1` ; lockfile/build/tests réels ; résolution peers ; licences/avis/SBOM exacts ; Collector final ; pipeline, artefacts et rollback sans rebuild ; puis preuves V. | ADR-001/003/005/012/013, Architecture testing/deployment, toutes les gates de livraison. |

## 8. Contradictions et supersessions à enregistrer par B11

1. **D11 — durée absolue de session.** Le registre historique dit que la durée absolue n’est pas décidée. L’arbitrage ultérieur fixe **15 jours absolus**, avec maintien des 30 minutes d’inactivité réelle et polling non prolongateur. D11 doit être amendée/supplantée sur ce point sans effacer son historique.
2. **Stockage d’e-mails et pièces.** Les formulations proposant EML ou pièces durables sont remplacées par : aucun original durable dans DossierClé ; seulement faits utiles, courts résumés, synthèse, suivi et provenance ; traitement temporaire borné des pièces.
3. **Référence descriptive sans lien vers l’e-mail.** L’ancienne suggestion de lien cliquable vers l’e-mail est supplantée par une référence descriptive seulement, sans URL, deep link ou accès automatique à la messagerie. Cette portée doit être reportée dans Architecture, ADR-007, PRD et Stories concernées ; elle ne doit pas être masquée par la simple absence de copie durable.
4. **D43 — export.** L’export EML/pièces originales est supplanté par un export des seules données dérivées détenues par DossierClé. L’agence exporte ses originaux depuis sa messagerie. Ne pas inventer une copie cachée ni un export automatique de la boîte.
5. **D50/D51 — dépôt externe sans compte.** Ce parcours est retiré. D50/D51 restent dans l’historique mais deviennent supplantées pour le dépôt externe. Leur retrait ne supprime ni MFA collaborateurs, ni antivirus/quarantaine des pièces reçues par e-mail, ni import catalogue interne.
6. **Formats et limite 20 Mo.** Les formats PDF/JPEG/PNG et la limite historique de l’ancien formulaire ne deviennent pas automatiquement la politique des pièces reçues par e-mail. L’unité 20 000 000 octets ou 20 MiB et les formats restent à décider.
7. **Multi-boîtes et offre commerciale.** La capacité technique multi-boîtes ne vaut pas offre illimitée. Le lancement prévoit une boîte Sinistres et une boîte Location par agence ; les scénarios de charge restent dimensionnés séparément.
8. **Comptes.** Trois comptes individuels, administrateur compris, sont inclus. Prix/plafond des comptes additionnels restent ouverts ; aucune limite de connexions simultanées ou affectation de rôle n’est inventée.
9. **Reprise historique.** La période est choisie strictement par l’agence, sans défaut. Aucun accès, inventaire, affichage, notification ou suggestion d’élargissement hors période. La confirmation est in-app, jamais un mandat d’envoi, et le silence ne vaut pas accord.
10. **Horaires et fermetures.** L’ouverture antérieure de l’ADR-011 entre maintien et empêchement des rapports est supplantée par la décision acquise : aucun rapport pendant fermeture, occurrence empêchée visible, aucun rattrapage, prochaine occurrence autorisée couvrant depuis le dernier envoi confirmé.
11. **Calendrier Stories.** L’exclusion historique d’un calendrier supplémentaire doit être précisée : les fermetures manuelles versionnées sont autorisées ; aucun calendrier férié automatique n’est ajouté.
12. **Inngest/tout-serverless.** Le candidat Inngest auto-hébergé introduit une exception potentielle au principe tout-serverless mais reste `PROPOSED`; aucune formulation ne doit le présenter comme architecture adoptée.
13. **PRA.** D58 couvre obligatoirement la perte d’un datacenter/AZ. Le PRA régional est un risque distinct à chiffrer, pas une réduction ni une preuve de D58.
14. **Disponibilité.** L’objectif est interne au lancement ; aucun SLA client. Les options chiffrées et les IRT fournisseurs ne sont pas des engagements adoptés.
15. **Candidats techniques Q1–Q5.** Versions, offres, régions, topologies, outils et modèles restent candidats jusqu’aux décisions et preuves correspondantes. Les reporter comme faits de recherche, jamais comme choix définitifs.
16. **PASS historiques.** `PRD: PASS` et `STORY_REVIEW: PASS` restent attachés à leurs empreintes historiques. La consolidation ajoute un addendum et une nouvelle revue ; elle ne réécrit pas rétroactivement ces PASS.

## 9. Fichiers canoniques futurs à consolider

Aucun de ces fichiers n’est modifié maintenant. Sous autorisation B11, le writer unique devra consolider précisément :

### Registre, architecture et statut

- `docs/product/ARCHITECTURE_DECISIONS.md`
- `docs/product/ARCHITECTURE.md`
- `docs/product/ARCHITECTURE_RESEARCH.md`
- `docs/agentic/STATUS.md`

### Produit et stories

- `docs/product/PRD.md`
- `docs/product/STORIES.md`
- `docs/product/STORY_REVIEW.md` — uniquement pour enregistrer la portée de la nouvelle revue/addendum, sans réécrire le PASS historique
- `docs/product/ISSUE_33_DECISIONS.md`

### ADR

- `docs/adr/001-monolithe-stack-contrats.md`
- `docs/adr/002-postgresql-par-agence-drizzle.md`
- `docs/adr/003-identite-centrale-better-auth-mfa.md`
- `docs/adr/004-autorisation-mandat-support.md`
- `docs/adr/005-inngest-scaleway-conditionnel.md`
- `docs/adr/006-effets-idempotence-fencing.md`
- `docs/adr/007-messagerie-tags-connecteurs.md`
- `docs/adr/008-ia-catalogue-budget-byok.md`
- `docs/adr/009-documents-quarantaine-depot.md`
- `docs/adr/010-pra-export-resiliation.md`
- `docs/adr/011-horaires-fermetures-rapports.md`
- `docs/adr/012-audit-observabilite-alertes.md`
- `docs/adr/013-qa-livraison-tests.md`

### Qualifications à conserver comme preuves documentaires, sans réécriture d’adoption

- `docs/product/ARCHITECTURE_Q1_B01.md`
- `docs/product/ARCHITECTURE_Q2_B02_B04.md`
- `docs/product/ARCHITECTURE_Q3_B05_B06.md`
- `docs/product/ARCHITECTURE_Q4_B07_B12.md`
- `docs/product/ARCHITECTURE_Q5_B03_B08_B10.md`
- `docs/product/ARCHITECTURE_Q6_B09_B11.md` — présent livrable de qualification, à conserver comme preuve documentaire

### Plan et traçabilité

- `.hermes/plans/2026-10-02_145323-qualification-b01-b12.md` — référence organisationnelle approuvée ; ne pas le transformer en preuve technique
- toute nouvelle preuve/revue sous `.hermes/team/runs/` selon les conventions du dépôt

## 10. Checklist de consolidation B11, sans invention

- [ ] Obtenir l’autorisation humaine explicite de consolider les canons.
- [ ] Geler l’empreinte de Q1–Q6 relue et la base Git du candidat.
- [ ] Reporter les statuts B01–B12 : tous restent `BLOCKED` tant que leurs décisions/preuves manquent.
- [ ] Conserver séparément : décision produit acquise, candidat technique, preuve documentaire, protocole non exécuté et preuve Verify future.
- [ ] Enregistrer D11/15 jours sans effacer l’historique idle30.
- [ ] Supplanter tout lien vers l’e-mail par une référence descriptive sans URL, deep link ni accès automatique, dans Architecture, ADR-007, PRD et Stories.
- [ ] Enregistrer D43 supplantée sur EML/pièces, export dérivé seulement.
- [ ] Enregistrer D50/D51 supplantées sur dépôt externe seulement.
- [ ] Conserver quarantaine/antivirus des pièces e-mail et import catalogue interne.
- [ ] Reporter la reprise historique stricte et la confirmation in-app.
- [ ] Reporter trois comptes et deux boîtes sans inventer prix/plafond.
- [ ] Reporter unité, formats, quotas et durées comme décisions ouvertes.
- [ ] Reporter Qwen, Mistral, Inngest, PostgreSQL, Better Auth et outils comme candidats non adoptés.
- [ ] Reporter les réserves licences, avis, régions, DPA, ZDR, IAM, Redis et PRA.
- [ ] Mettre à jour ADR-011 avec la décision de fermeture acquise et B09-D1/D2/D3 `À DÉCIDER`.
- [ ] Mettre à jour ADR-006 avec états empêchés, curseur confirmé, watermarks, résultat inconnu et absence de retry aveugle.
- [ ] Mettre à jour S11/S12/S25–S27/S33 et les critères DST/fermetures, sans changer silencieusement les horaires.
- [ ] Lister chaque supersession avec date, ancien texte, nouveau statut, source et impacts.
- [ ] Ne pas réécrire `PRD: PASS` ou `STORY_REVIEW: PASS` historiques ; ajouter une nouvelle portée de revue.
- [ ] Vérifier la cohérence croisée registre ↔ Architecture ↔ PRD ↔ Stories ↔ ADR ↔ STATUS.
- [ ] Vérifier qu’aucune durée, coût, SLA, offre, version, fournisseur ou POC n’est présenté comme décidé sans autorité.
- [ ] Vérifier qu’aucun original e-mail/pièce n’est promis dans le stockage ou l’export DossierClé.
- [ ] Vérifier que toute occurrence B09 empêchée reste visible et sans rattrapage.
- [ ] Exécuter les contrôles documentaires du dépôt et les contrôles de liens/citations prévus.
- [ ] Faire relire le corpus consolidé par un reviewer indépendant sur une empreinte figée.
- [ ] Corriger tout Critical/Major, regeler l’empreinte et refaire la revue.
- [ ] Demander séparément le verdict humain `B11: PASS` ou maintien `BLOCKED`.
- [ ] Demander séparément le verdict humain final `ARCHITECTURE: PASS` ou maintien `BLOCKED`.

## 11. Dossier final des décisions humaines obligatoires Q1–Q6

La liste ci-dessous est un dossier de décision, pas un questionnaire déjà répondu. Toute option reste ouverte jusqu’à validation explicite et preuve requise.

### 11.1 Autorisations de POC et protocoles

- [ ] Autoriser ou refuser `B01-P-1` : restauration individuelle et budget de connexions PostgreSQL.
- [ ] Autoriser ou refuser `B02-P-1` : barrière d’effets, annulation, partition, résultat inconnu et ancien fence.
- [ ] Autoriser ou refuser `B04-P-1` : flux, callbacks signés, IAM, rotation et pertes AZ/LB/control plane.
- [ ] Autoriser ou refuser `B05-P-1` : connecteurs mail, readback, concurrence, curseurs et période stricte.
- [ ] Autoriser ou refuser `B06-P-1` : qualité IA, provenance, purge et coût borné.
- [ ] Autoriser ou refuser `B07-P-1` : auth, MFA, sessions, révocation, récupération et invitations.
- [ ] Autoriser ou refuser `B08-P-1` si la purge/rétention demeure indécidable sur papier.
- [ ] Autoriser ou refuser `B09-P-1` : moteur temporel local, DST, fermetures, curseurs et crash/résultat inconnu.
- [ ] Autoriser ou refuser `B12-P-1` : bootstrap, lockfile, build, SBOM, OpenAPI, télémétrie et rollback simulé.
- [ ] Autoriser ou refuser `B03-P-1` local puis financer/autoriser séparément `B03-V-1` en environnement représentatif.
- [ ] Pour chaque autorisation : fixer préalablement durée, budget, quotas, réseau, versions, données synthétiques, arrêt, nettoyage et reviewer. Sans valeurs approuvées, l’essai est refusé.

### 11.2 PostgreSQL, HA, sauvegardes et PITR

- [ ] Choisir l’offre, le SKU, la région et la topologie PostgreSQL exacts, ou maintenir B01 bloqué.
- [ ] Obtenir une preuve fournisseur sur HA `multiple_zone`, disponibilité Paris, réplication, failover, perte AZ/datacenter et prix.
- [ ] Décider si une Read Replica Multi-AZ fait partie de la relève et sous quelles limites de lag/promotion.
- [ ] Confirmer ou remplacer le chemin de backup logique individuel non chiffré nativement.
- [ ] Fixer fréquence, rétention et marge garantissant le RPO visé ; ne pas présumer PITR.
- [ ] Décider le mécanisme PITR ou accepter explicitement qu’il manque et choisir une alternative.
- [ ] Fixer densité d’agences, budget de connexions, pools, migrations de flotte et coût complet.

### 11.3 Inngest, licence, runtime et Redis

- [ ] Obtenir l’avis juridique sur SSPL et l’usage exact ; choisir acceptation, licence commerciale, version devenue Apache démontrée ou alternative.
- [ ] Choisir Instances, Kapsule regional HA Dedicated ou une alternative, sans présenter une topologie candidate comme adoptée.
- [ ] Approuver ou refuser l’exception au principe tout-serverless.
- [ ] Choisir Redis managé malgré ses limites, Redis auto-opéré, reconstruction prouvée ou autre orchestrateur.
- [ ] Fixer rétention/purge Inngest, capacité, nombre de réplicas, migrations et coût.
- [ ] Ouvrir un ADR alternatif si Inngest/Redis échoue ; aucun basculement implicite vers Inngest Cloud.

### 11.4 Réseau, callbacks, IAM et secrets

- [ ] Choisir le schéma ingress/egress, DNS, LB par zone, NAT/Gateway et stratégie de perte de zone.
- [ ] Accepter ou refuser une API key statique scoped tant qu’une workload identity native n’est pas démontrée.
- [ ] Fixer les principals, permission sets, conditions par ressource, rotation, révocation et break-glass.
- [ ] Valider le contrat de signature/anti-rejeu et l’exposition publique minimale des callbacks.
- [ ] Décider comment supprimer chaque SPOF documenté, ou maintenir B04 bloqué.

### 11.5 Connecteurs e-mail

- [ ] Autoriser l’onboarding Gmail avec scope restricted, vérification et éventuelle évaluation de sécurité.
- [ ] Fixer les permissions Graph delegated/shared/application et les restrictions de mailbox.
- [ ] Choisir les familles de serveurs et clients IMAP/SMTP réellement supportées.
- [ ] Valider la politique tags/categories/keywords, readback, concurrence humain/IA et mode manuel par boîte.
- [ ] Valider curseurs, full sync bornée, déplacements/suppressions, throttling et résultat d’envoi inconnu.
- [ ] Confirmer les coûts/capacités Pub/Sub, Graph et fournisseurs IMAP/SMTP sans les transformer directement en quotas commerciaux.

### 11.6 IA, fournisseurs, privacy et coûts

- [ ] Choisir les modèles/version/région finaux après preuve, ou conserver Qwen/Mistral/OCR comme candidats seulement.
- [ ] Accepter ou refuser l’exception Scaleway de conservation de contenu HTTP jusqu’à deux semaines en incident/abus.
- [ ] Valider DPA, sous-traitants, régions, ZDR, opt-out et conditions contractuelles de chaque route.
- [ ] Décider la route Mistral régionale standard et, séparément, l’éventuelle étude Enterprise ; aucun surcoût ou SLA n’est adopté par défaut.
- [ ] Fixer seuils de qualité, provenance, abstention, OCR et fallback consenti.
- [ ] Fixer l’enveloppe IA, les suppléments, réservations et traitement des dépassements après chiffrage.
- [ ] Valider purge application/objets/scanner/logs/retries/fournisseur/backups.

### 11.7 Authentification et outillage

- [ ] Adopter ou rejeter les versions candidates après `B07-P-1`/`B12-P-1` et nouveau gel des avis.
- [ ] Valider invitations, récupération, codes de secours, chiffrement TOTP, rate limits et révocation.
- [ ] Maintenir 15 jours absolus + 30 minutes d’inactivité réelle comme exigences consolidées.
- [ ] Choisir les composants finaux du monorepo, du CI, des tests, de l’OpenAPI, du SBOM et de l’observabilité.
- [ ] Décider l’allowlist Collector/OTel, le backend télémétrique, la rétention et les source maps.
- [ ] Valider licences, advisories, dépendances transitives, images et politique de dérogation.

### 11.8 Quotas, formats, conservation et rétention

- [ ] Choisir **20 000 000 octets** ou **20 MiB**.
- [ ] Fixer la politique de formats des pièces reçues par e-mail.
- [ ] Fixer plafond de reprise initiale, plafond mensuel et comportement de dépassement.
- [ ] Fixer prix et plafond des comptes supplémentaires.
- [ ] Fixer la durée métier commune post-clôture après analyse obligations/coûts ; aucune option documentaire n’est adoptée.
- [ ] Fixer séparément les durées des temporaires, audits, sécurité, exports, backups, tombstones et journaux.
- [ ] Valider rôles privacy, finalités, bases légales, droits, effacement, portabilité et sous-traitants.
- [ ] Choisir le stockage indépendant des tombstones et générations anti-résurrection.

### 11.9 B09 — calendrier et rapports

- [ ] **B09-D1 :** décider l’interaction des rapports fixes avec les horaires d’action hors fermeture.
- [ ] **B09-D2 :** décider la limite d’envoi technique tardif.
- [ ] **B09-D3 :** décider le curseur initial d’un nouveau destinataire ou d’un destinataire réautorisé.
- [ ] Autoriser ou remplacer par preuve équivalente `B09-P-1`.
- [ ] Ne pas rouvrir : aucun rapport pendant fermeture, occurrence empêchée visible, aucun rattrapage, créneaux fixes et couverture depuis dernier envoi confirmé.

### 11.10 SLA, astreinte, support et exploitation

- [ ] Choisir une cible interne de disponibilité ou maintenir B10 bloqué.
- [ ] Choisir support Business, Enterprise ou aucun, sans confondre IRT, résolution, RTO et SLA.
- [ ] Identifier un prestataire, obtenir un devis et définir ses responsabilités.
- [ ] Financer rotation, astreinte, suppléance et interventions.
- [ ] Fixer sévérités, canaux, escalades, runbooks, exercices et autorité de réouverture.
- [ ] Vérifier le bus factor et les accès break-glass.
- [ ] Maintenir l’absence de SLA client tant qu’aucun engagement contractuel n’est décidé.

### 11.11 PRA régional et D58

- [ ] Choisir une couverture régionale froide, tiède, chaude ou un risque explicitement accepté et chiffré.
- [ ] Ne pas modifier implicitement D58 : perte datacenter/AZ avec RPO et RTO chacun strictement <4 h.
- [ ] Choisir stratégie Object Storage multi-AZ/cross-region, secrets régionaux, DNS, artefacts et observabilité.
- [ ] Définir le cut cohérent, la reconstruction Redis/Inngest et la réconciliation des fournisseurs mail.
- [ ] Financer et exécuter les preuves de restauration appropriées avant toute affirmation opérationnelle.

### 11.12 Consolidation B11 et verdict Architecture

- [ ] **Autoriser explicitement la consolidation B11** des fichiers canoniques listés en section 9.
- [ ] Nommer un writer unique et un reviewer indépendant.
- [ ] Valider la matrice des supersessions sans effacer l’historique.
- [ ] Exiger qu’aucun candidat, POC futur, durée, coût ou SLA ne soit présenté comme adopté.
- [ ] Après consolidation et revue sans Critical/Major, rendre une décision humaine séparée sur `B11: PASS` ou maintien `BLOCKED`.
- [ ] Après examen de tous B01–B12, des décisions, preuves et risques résiduels, rendre une décision humaine séparée sur **`ARCHITECTURE: PASS`** ou maintien **`ARCHITECTURE: BLOCKED`**.

La consolidation B11 et `ARCHITECTURE: PASS` sont des **gates humaines**. Elles ne sont pas des conséquences automatiques d’une revue documentaire PASS de Q6, ni du fait que Q1–Q6 ont été rédigés.

## 12. Verdict de campagne Q1–Q6

Après revue du candidat final, les **travaux documentaires Q1–Q6 sont terminés** au sens de la campagne de recherche et de préparation des décisions. Cette terminaison signifie que les bloqueurs, options, protocoles, contradictions, supersessions et décisions humaines requises sont explicités ; elle ne signifie pas que les fournisseurs sont qualifiés, que les POC ont réussi, que les choix ont été adoptés ou que l’architecture est exécutable.

**Verdict de campagne : travaux documentaires Q1–Q6 terminés après revue du candidat, mais Architecture reste `BLOCKED` jusqu’aux décisions humaines, autorisations, consolidations et preuves exigées.**

## Sources

[1] https://www.iana.org/time-zones
[3] https://www.rfc-editor.org/rfc/rfc3339
[6] https://www.iana.org/time-zones/theory
[7] https://www.rfc-editor.org/info/rfc9557
[8] https://tc39.es/proposal-temporal/docs/timezone.html
