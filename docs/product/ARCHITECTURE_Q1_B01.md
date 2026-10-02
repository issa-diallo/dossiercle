# Qualification Q1 — B01 PostgreSQL, flotte et restauration isolée

Date de qualification : **2026-10-02**. Issue [#37](https://github.com/issa-diallo/dossiercle/issues/37). Recherche documentaire primaire uniquement : aucun compte fournisseur, aucune ressource, dépense, donnée réelle ou exécution de mini-POC.

## Verdict

`B01: BLOCKED`

La documentation permet de retenir un candidat prioritaire pour la suite de la qualification :

- Scaleway Managed Database for PostgreSQL and MySQL ;
- région Paris `fr-par` ;
- PostgreSQL 17 ;
- gamme Production Optimized ;
- nœud initial `DB-POP2-2C-8G` ;
- Block Storage 5K ;
- configuration High Availability ;
- plusieurs bases logiques isolées sur une instance, avec une base et un utilisateur runtime dédiés par agence.

Ce candidat n'est pas adopté. La recherche ne démontre pas :

1. un PITR natif ;
2. un RPO strictement inférieur à 4 heures ;
3. une restauration individuelle d'agence à la fois isolée et chiffrée ;
4. la survie à la perte d'un datacenter/AZ ;
5. le budget de connexions et la densité d'agences ;
6. le coût complet de la flotte ;
7. la migration multi-base ;
8. le temps réel de restauration.

Une qualification `B01-P-1` est nécessaire avant tout PASS B01. Elle doit rester séparément autorisée, plafonnée et synthétique.

## Candidat et alternatives

| Candidat | Capacité | Compute indicatif à 730 h* | Sauvegarde native | Résilience documentée | Disposition |
|---|---|---:|---|---|---|
| Production Optimized `DB-POP2-2C-8G`, Standalone | 2 vCPU / 8 Go | 104,68 € HT/mois | snapshots/autobackups ; backup logique sous conditions | un nœud | cible temporaire possible pour restauration, pas cible Production principale |
| Production Optimized `DB-POP2-2C-8G`, HA `single_zone`/historique | 2 vCPU / 8 Go par nœud | 160,16 € HT/mois | mêmes mécanismes | principal + standby synchrones dans le même datacenter selon la FAQ historique | candidat de référence, insuffisant pour D58 perte datacenter |
| Production Optimized `DB-POP2-2C-8G`, HA `multiple_zone` | 2 vCPU / 8 Go par nœud | non consolidable depuis les pages publiques | à confirmer | mode exposé par l'API, topologie/réplication/failover/disponibilité Paris non documentés | **candidat prioritaire à confirmer**, encore BLOCKED |
| Production Optimized HA + une Read Replica Multi-AZ | même primaire, replica 2 vCPU / 8 Go | 260,03 € HT/mois | backups du primaire à qualifier séparément du replica | replica asynchrone dans une autre AZ, promotion manuelle | alternative D58 à qualifier ; lag et RTO non garantis |
| Cost Optimized `DB-PRO2-XXS`, HA `single_zone`/historique | 2 vCPU / 8 Go par nœud | 122,86 € HT/mois | mêmes mécanismes | principal + standby synchrones dans le même datacenter selon la FAQ historique | alternative coût ; insuffisante pour D58 perte datacenter |
| Cost Optimized HA + une Read Replica Multi-AZ | même primaire, replica 2 vCPU / 8 Go | 199,44 € HT/mois | mêmes réserves | replica asynchrone dans une autre AZ, promotion manuelle | alternative coût/D58, encore BLOCKED |
| Serverless SQL | capacité variable | non consolidé ici | quotidien, 7 jours selon la documentation consultée | aucune preuve D58 | écarté pour B01/D58 |

\* Hors stockage, sauvegardes, supervision, trafic et ressources temporaires de restauration. Les lignes avec Read Replica Multi-AZ additionnent le nœud principal, le standby HA, le tarif d'un nœud additionnel et l'option Multi-AZ affichée pour le SKU. La page tarifaire officielle observée le 2026-10-02 affiche : `DB-POP2-2C-8G` à 0,1434 €/h + 0,076 €/h par nœud additionnel + 0,0608 €/h pour l'option Multi-AZ ; `DB-PRO2-XXS` à 0,11 €/h + 0,0583 €/h + 0,0466 €/h. Elle réserve explicitement l'option tarifaire Multi-AZ aux Read Replicas, tandis que l'API expose séparément une HA `multiple_zone` sans tarif public associé clairement identifiable. Elle affiche également Block Storage 5K à 0,0993 €/Go/mois, Block Storage 15K à 0,1489 €/Go/mois et backups/snapshots à 0,03 €/Go/mois. Ces valeurs sont des observations datées, pas un devis.[Tarifs](https://www.scaleway.com/en/pricing/managed-databases/) [Schéma API](https://www.scaleway.com/en/developers/api/managed-database-postgre-mysql/~schemas) [Read Replicas](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-read-replicas/)

`B01-A-1` reste explicitement **incomplet** : le schéma API officiel expose `disabled`, `single_zone` et `multiple_zone`, mais les pages produit, FAQ et tarifs ne décrivent pas de façon cohérente la disponibilité, la topologie et le prix de la HA `multiple_zone` en `fr-par`. Cette contradiction doit être levée par preuve fournisseur ou POC autorisé avant toute sélection.[Schéma API](https://www.scaleway.com/en/developers/api/managed-database-postgre-mysql/~schemas)

Le coût documentable suit donc au minimum :

```text
compute mensuel
+ stockage provisionné
+ volume et rétention des backups/snapshots
+ ressources temporaires de restauration
+ supervision et exploitation
```

Aucun total crédible n'est possible avant décision sur la capacité initiale, la rétention, le nombre d'agences par instance et la stratégie de relève.

À hypothèse purement comparative de 100 Go de Block 5K et 100 Go de backups, chaque option ajoute 9,93 € + 3,00 € HT/mois. Cette illustration n'est ni une capacité recommandée ni un devis ; la formule doit être rejouée avec les volumes approuvés.

## Base distincte par agence sur instance mutualisée

Une Database Instance peut héberger plusieurs bases PostgreSQL. Les API et guides permettent de créer des bases, utilisateurs et permissions par base. Cela rend possible la topologie suivante sans imposer une instance physique par agence :

```text
Instance RDB mutualisée
├── agence_001 — base + credential runtime dédiés
├── agence_002 — base + credential runtime dédiés
└── agence_NNN — base + credential runtime dédiés
```

Cette possibilité documentaire ne prouve pas l'isolation opérationnelle. Les bases partagent CPU, RAM, stockage, maintenance, `max_connections` et domaine de panne. Un snapshot de volume capture l'instance et ne constitue pas une restauration native d'une seule agence.

Les permissions Scaleway portent sur les objets existants. Les futurs objets PostgreSQL imposent de qualifier les `default privileges`, propriétaires, séquences et droits recréés par les migrations. L'utilisateur `admin` ne doit jamais être remis au runtime métier.[API Managed Database](https://www.scaleway.com/en/developers/api/managed-database-postgre-mysql) [Gestion des utilisateurs](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-users/)

Une instance par agence ferait croître le coût fixe linéairement et dépendrait des quotas du compte. La mutualisation de plusieurs bases par instance est donc le candidat initial, mais aucune densité d'agences n'est arrêtée.

## HA, perte de datacenter et perte d'AZ

Les sources officielles se contredisent et doivent être conservées comme telles :

- la FAQ décrit la HA historique avec principal et standby synchrones dans le **même datacenter**, sur deux racks distincts ; ce mode ne survit donc pas à la perte complète de ce datacenter ;
- l'API actuelle remplace le booléen historique par `high_availability_mode` et expose `single_zone` et `multiple_zone`, mais sans décrire sur la page de schéma le placement exact, le protocole de réplication, le failover, la disponibilité commerciale par région ni le prix ;
- la page tarifaire réserve son option Multi-AZ explicite aux Read Replicas.

La HA historique/`single_zone`, l'éventuelle HA `multiple_zone` et la Read Replica Multi-AZ sont donc trois options distinctes. La première est insuffisante pour D58 perte datacenter ; la seconde est un candidat primaire non qualifié ; la troisième est une relève asynchrone manuelle.[FAQ](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/faq/) [Schéma API](https://www.scaleway.com/en/developers/api/managed-database-postgre-mysql/~schemas) [Tarifs](https://www.scaleway.com/en/pricing/managed-databases/)

La fonction Multi-AZ documentée concerne les **Read Replicas** : le replica est placé dans une autre AZ, reçoit les changements de manière asynchrone et doit être promu manuellement. Scaleway demande de vérifier que le lag est revenu à zéro avant promotion ; une panne brutale du primaire ne garantit donc ni lag nul, ni RPO strictement inférieur à 4 heures, ni RTO strictement inférieur à 4 heures.[Gestion des Read Replicas](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-read-replicas/)

Cette alternative est directement pertinente pour D58 mais reste `BLOCKED` tant que ne sont pas qualifiés :

- lag maximal et alerte associée ;
- promotion et changement d'endpoint ;
- cohérence des bases d'agences lors de la promotion ;
- interaction avec sauvegardes, chiffrement et réplication logique ;
- comportement lors d'une perte de datacenter distincte d'une perte d'AZ ;
- coût complet et capacité opérateur.

La HA `multiple_zone` reste elle aussi `BLOCKED` tant que Scaleway n'a pas établi sa disponibilité en Paris, sa réplication, son failover automatique, son comportement en perte d'AZ/datacenter, sa compatibilité avec le SKU/stockage retenu et son coût.

## Sauvegardes et restauration

### Snapshots Block Storage

Pour une instance Block Storage, les autobackups sont des snapshots. La fréquence et la rétention sont configurables ; le défaut documenté est quotidien avec sept jours de rétention. Un snapshot restaure une **nouvelle Database Instance** dans la même localisation. Il ne restaure pas nativement une base d'agence seule.[Gestion des backups](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-backups/) [Gestion des snapshots](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-snapshots/)

### Backup logique individuel

Une instance Block Storage dont le stockage est inférieur ou égal à **585 Go** peut produire manuellement un backup logique d'une base précise. La documentation permet ensuite de restaurer vers une base existante ou nouvelle et vers une instance choisie. Les restaurations importantes peuvent durer plusieurs heures.[Gestion des backups](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-backups/)

C'est le seul chemin public identifié correspondant directement à une restauration individuelle d'agence. Il reste à démontrer que la procédure :

- ne lit ni n'écrase une autre agence ;
- ne provoque pas une indisponibilité non bornée des autres bases ;
- restaure schéma, données, séquences, propriétaires et droits ;
- permet une bascule applicative contrôlée ;
- respecte les objectifs RPO/RTO.

### Conflit chiffrement/granularité

Lorsque le chiffrement au repos est activé, Scaleway indique que bases, logs et snapshots sont chiffrés, mais que le chiffrement des backups logiques n'est pas disponible.[Création d'une Database Instance](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/create-a-database/)

Le conflit est bloquant :

- le snapshot respecte mieux le chiffrement, mais restaure l'instance entière ;
- le backup logique fournit la granularité agence, mais n'est pas documenté comme chiffré.

Une réponse contractuelle du fournisseur ou une chaîne complémentaire d'export chiffré, exploitée et surveillée par DossierClé, serait nécessaire. Cette seconde voie introduirait un nouveau composant à qualifier.

### PITR et RPO

Aucun endpoint ou guide officiel consulté ne décrit une restauration à un instant arbitraire ni une chaîne WAL administrée équivalente à un PITR. Cette absence documentaire ne prouve pas l'absence interne d'une fonction, mais interdit de la déclarer disponible.

Statut : `PITR BLOCKED — confirmation Scaleway requise`.

Le réglage quotidien ne satisfait pas D58. La documentation permet de modifier la fréquence, mais ne publie pas clairement :

- la fréquence minimale garantie ;
- le délai entre planification et point réellement restaurable ;
- la conduite après backup long ou échoué ;
- les chevauchements et retries ;
- la marge garantissant un RPO strictement inférieur à 4 heures.

Statut : `RPO < 4 h NON PROUVÉ`.

## Connexions, pools et densité

Scaleway recommande le pooling applicatif. Le nombre maximal de connexions dépend des paramètres et du nœud exact ; aucune valeur stable publiquement exploitable n'a été retenue pour `DB-POP2-2C-8G`.[Endpoints RDB](https://www.scaleway.com/en/developers/api/managed-database-postgre-mysql/endpoints) [Supervision](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/monitor-databases-cockpit/)

Le budget devra être mesuré ainsi :

```text
max_connections réel
- réserve PostgreSQL/Scaleway
- central identité/registre
- supervision
- migrations
- marge incident
= budget API + workers
```

Contraintes à préserver :

- aucun pool pré-ouvert par agence inactive ;
- cache LRU par instance/base/version de credential ;
- fermeture à l'éviction et après rotation ;
- plafond global par processus et instance ;
- backpressure avant saturation ;
- rôle migration séparé ;
- métriques de saturation et d'attente.

Les valeurs numériques, la densité d'agences et le comportement sous autoscaling restent `BLOCKED B01-P-1`, puis à revalider par la charge future B01-V-1.

## Flotte et migrations

Scaleway documente la création et la gestion des bases/utilisateurs/permissions par API, `pg_dump`/`pg_restore`, la réplication logique PostgreSQL 17 et les changements de volume. Aucun orchestrateur natif de migrations de schéma sur une flotte de bases d'agences n'est fourni par ces sources.[API Managed Database](https://www.scaleway.com/en/developers/api/managed-database-postgre-mysql) [Réplication logique PostgreSQL 17](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/api-cli/logical-replication-as-publisher/) [Migration de bases](https://www.scaleway.com/en/docs/tutorials/migrate-databases-instance/)

DossierClé devra au minimum gérer :

1. le registre agence/instance/base/version ;
2. l'inventaire avant campagne ;
3. un point de retour vérifié ;
4. un canari synthétique/QA ;
5. un verrou par base ;
6. des lots bornés ;
7. l'arrêt au premier échec ;
8. une fenêtre explicite de versions compatibles ;
9. une reprise idempotente ;
10. un rapport par base ;
11. l'absence du rôle migration dans le runtime métier.

La réplication logique est une piste de déplacement entre instances, pas une orchestration de DDL ou une preuve de reprise complète.

## Matrice de sortie documentaire

| Question | Résultat Q1 |
|---|---|
| Produit Paris candidat | Managed PostgreSQL/MySQL, Production Optimized |
| SKU de départ | `DB-POP2-2C-8G`, candidat non adopté |
| Base distincte par agence sur instance partagée | possible documentairement |
| Credentials par base | possible, droits futurs à qualifier |
| Snapshot Block | instance entière |
| Backup individuel | base précise, manuel, stockage ≤585 Go |
| Chiffrement snapshot | documenté avec chiffrement au repos |
| Chiffrement backup logique | non disponible selon le guide |
| HA historique/`single_zone` | principal + standby synchrones, même datacenter selon FAQ ; perte datacenter non couverte |
| HA `multiple_zone` | enum API documenté ; topologie, disponibilité Paris, réplication, failover et coût non qualifiés |
| Read Replica Multi-AZ | replica asynchrone autre AZ, promotion manuelle et lag à qualifier |
| PITR | non documenté |
| RPO <4 h | non démontré |
| Pooling | responsabilité applicative |
| Migration flotte | responsabilité DossierClé |
| Coût complet | non calculable sans hypothèses et arbitrages |

## Demande `B01-P-1` — non autorisée par ce document

### Hypothèse

Une instance candidate peut héberger deux bases d'agences cloisonnées et permettre la restauration de l'une dans un espace isolé, sans lire, écraser ni indisponibiliser l'autre, avec un budget de connexions maîtrisé.

### Préconditions humaines

- autorisation distincte ;
- SKU et topologie confirmés ;
- durée maximale, plafond monétaire et quotas approuvés ;
- projet de qualification isolé ;
- données exclusivement synthétiques ;
- inventaire et destruction contrôlée ;
- décision préalable sur le traitement du backup logique non chiffré.

### Environnement proposé

- instance `DB-POP2-2C-8G`, HA, PostgreSQL 17, Block 5K, chiffrement au repos ;
- instance Standalone temporaire éventuelle pour la restauration ;
- bases synthétiques `agency_alpha` et `agency_beta` ;
- utilisateurs runtime distincts ;
- utilisateur migration séparé ;
- schémas, versions et empreintes divergents ;
- client `pg` avec pools bornés.

### Matrice connexions et autoscaling à paramétrer avant exécution

Le protocole ne peut pas se limiter à ouvrir quelques pools. Après lecture du `max_connections` réel, il doit calculer puis enregistrer :

```text
budget_utilisable = max_connections
  - reserve_postgresql_scaleway
  - reserve_centrale_identite_registre
  - reserve_supervision
  - reserve_migration
  - reserve_incident

agences_pools_api = min(agences_actives_api, capacite_lru_pools_api_par_replica)
agences_pools_workers = min(agences_actives_workers, capacite_lru_pools_workers_par_replica)

demande = replicas_api * (pool_api_central
    + agences_pools_api * pools_par_agence_api * connexions_par_pool_api)
  + replicas_workers * (pool_workers_central
    + agences_pools_workers * pools_par_agence_worker * connexions_par_pool_worker)
  + connexions_migration_actives
  + connexions_operations_restauration
```

La fiche d'autorisation devra fixer au moins trois paliers reproductibles :

| Palier | API | Workers | Agences actives | Migration | Attendu |
|---|---:|---:|---:|---|---|
| nominal | nombre de réplicas approuvé | nombre de réplicas approuvé | densité candidate initiale | aucune | latence et attente sous seuils approuvés |
| autoscaling maximal | maximum de réplicas autorisé | maximum autorisé | même densité | aucune | demande totale sous `budget_utilisable` |
| maintenance/incident | autoscaling maximal | maximum autorisé | même densité | une migration ou restauration bornée | backpressure avant saturation, marge incident préservée |

Chaque palier fixe explicitement le nombre d'agences simultanément actives par type de processus, le nombre maximal de pools d'agences conservés par replica, le nombre de pools par agence/base/credential et leur taille. Il inclut agences inactives, LRU, rotation/éviction, une rampe progressive jusqu'au seuil puis une tentative contrôlée au-delà. Le seuil d'arrêt est le premier de : 80 % du budget utilisable, attente de pool au-dessus de la borne approuvée, refus PostgreSQL, fuite de connexion ou coût/durée hors plafond. La densité candidate est le plus grand nombre d'agences respectant tous les paliers ; elle reste une mesure de qualification, pas une limite commerciale.

### Étapes

1. relever `max_connections`, paramètres, endpoints et topologie HA ;
2. créer les deux bases et leurs utilisateurs ;
3. vérifier les refus croisés, y compris catalogues et séquences ;
4. charger des jeux synthétiques distincts ;
5. déclencher un snapshot et confirmer sa granularité ;
6. créer un backup logique de `agency_alpha` ;
7. recréer sur la cible les propriétaires requis ;
8. restaurer sous un nouveau nom ou sur l'instance temporaire ;
9. comparer schéma, données, séquences, droits et empreintes ;
10. vérifier que `agency_beta` n'a été ni lue, ni modifiée, ni indisponible hors borne ;
11. simuler une migration N→N+1, échec et reprise ;
12. exécuter les trois paliers API/workers/agences de la matrice, avec rampe et backpressure ;
13. ajouter une migration ou restauration concurrente, puis tester éviction, agences inactives et rotation de credential ;
14. publier durée, coût, métriques et limites ;
15. supprimer les ressources et vérifier leur disparition.

### Succès

- aucune lecture/écriture croisée ;
- restauration conforme au point attendu ;
- autre agence inchangée ;
- propriétaires et droits valides ;
- aucun pool permanent pour agence inactive ;
- budget de connexions respecté aux paliers nominal, autoscaling maximal et maintenance/incident ;
- backpressure avant saturation et densité d'agences reproductible ;
- migration reprenable ;
- coût et durée mesurés ;
- conflit de chiffrement explicitement traité.

### Échec

- restauration imposant d'écraser la source ;
- impact non borné sur une autre base ;
- privilège croisé ou propriétaire orphelin ;
- pool obsolète non révocable ;
- saturation avant la borne approuvée ;
- temps ou coût hors plafond ;
- sauvegarde impossible à protéger selon la politique ;
- résultat non reproductible.

### Limite de preuve

Même réussi, `B01-P-1` ne prouverait pas le PITR, le PRA complet, la perte d'AZ/région, les cinq charges, la flotte finale, la conformité juridique ou les RPO/RTO de Production.

## Sources primaires

- [Tarifs Managed Databases](https://www.scaleway.com/en/pricing/managed-databases/)
- [Produit Managed PostgreSQL/MySQL](https://www.scaleway.com/en/managed-postgresql-mysql/)
- [Création et chiffrement](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/create-a-database/)
- [Gestion des backups](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-backups/)
- [Gestion des snapshots](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-snapshots/)
- [FAQ Managed Database](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/faq/)
- [API Managed Database](https://www.scaleway.com/en/developers/api/managed-database-postgre-mysql)
- [Gestion des utilisateurs](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/manage-users/)
- [Stratégies de sauvegarde](https://www.scaleway.com/en/docs/tutorials/backup-strategies/)
- [Quotas d'organisation](https://www.scaleway.com/en/docs/organizations-and-projects/organization/organization-quotas/)
- [Endpoints RDB](https://www.scaleway.com/en/developers/api/managed-database-postgre-mysql/endpoints)
- [Supervision Cockpit](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/how-to/monitor-databases-cockpit/)
- [Réplication logique PostgreSQL 17](https://www.scaleway.com/en/docs/managed-databases-for-postgresql-and-mysql/api-cli/logical-replication-as-publisher/)
- [Migration de bases](https://www.scaleway.com/en/docs/tutorials/migrate-databases-instance/)
- [Serverless SQL backups](https://www.scaleway.com/en/docs/serverless-sql-databases/how-to/manage-backups/)
