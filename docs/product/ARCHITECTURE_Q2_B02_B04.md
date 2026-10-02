# Q2 — Qualification B02+B04 : Inngest, réseau et IAM

Date de qualification : **2026-10-02**. Issue [#38](https://github.com/issa-diallo/dossiercle/issues/38). Mode LARGE. Sources primaires publiques uniquement.

Aucun compte fournisseur, ressource cloud, mini-POC, achat, secret ou donnée réelle n'a été utilisé. Les candidats décrits ne sont ni adoptés ni autorisés à être déployés.

## Verdict

| Bloc | Verdict Q2 | Motif principal |
|---|---|---|
| B02 — Inngest, persistance et barrière d'effets | `BLOCKED` | licence SSPL à qualifier, Redis non garanti récupérable, rétention non automatisée et sûreté multi-réplicas/non-doublon non prouvée |
| B04 — réseau, callback, Secret Manager et IAM | `BLOCKED` | callback public à vérifier, topologie HA/egress non choisie et absence de workload identity native sans clé statique démontrée |

Candidat documentaire prioritaire : **Inngest serveur v1.45.1 avec SDK TypeScript 4.21.1, PostgreSQL et Redis externes privés, répliqué sur Instances ou Kapsule Scaleway Paris**. Ce candidat reste `PROPOSED` conformément à l'ADR-005.

## Versions et licences Inngest

| Élément | Observation datée | Licence / contrainte | Disposition |
|---|---|---|---|
| Serveur `inngest/inngest` | `v1.45.1`, release publique du 2026-09-17, commit `9059f14a79317d977b627730a0f770b710520cc7` | SSPL v1 avec transition future vers Apache 2.0 selon le texte et la date du logiciel | candidat seulement ; avis juridique écrit requis |
| SDK npm `inngest` | `4.21.1` | Apache-2.0 ; Node `>=20`, TypeScript peer `>=5.8.0` | candidat transmis à B12, pas version gelée |
| Chart Helm officiel | dépôt `inngest/inngest-helm` | images et dépendances à inventorier au gel | candidat Kapsule uniquement |

Sources : [licence v1.45.1](https://github.com/inngest/inngest/blob/v1.45.1/LICENSE.md), [release v1.45.1](https://github.com/inngest/inngest/releases/tag/v1.45.1), [métadonnées npm](https://registry.npmjs.org/inngest/latest), [chart Helm](https://github.com/inngest/inngest-helm).

La section 13 de la SSPL vise le cas où la fonctionnalité du programme est rendue disponible à des tiers comme service. La licence prévoit aussi une prise d'effet Apache 2.0 au troisième anniversaire du logiciel concerné. Cette transition future ne permet pas de traiter la version courante entière comme Apache 2.0 aujourd'hui, ni de décider seul si l'usage interne à DossierClé déclenche les obligations SSPL.

Arbitrage futur, après avis juridique :

1. accepter la SSPL et ses obligations pour l'usage exact ;
2. obtenir une licence commerciale ou une exception ;
3. figer un corpus dont la transition Apache est démontrée fichier par fichier, avec risque d'ancienneté ;
4. écarter Inngest et ouvrir un ADR d'alternative auto-hébergée.

## Persistance Inngest

| État | Stockage documenté | Exigence DossierClé |
|---|---|---|
| queue et état courant des runs | Redis | Redis externe ; aucun fallback mémoire en production |
| configuration, apps, fonctions et historique | PostgreSQL | PostgreSQL externe ; SQLite interdit en production multi-réplicas |
| événements, résultats, erreurs et traces | Redis et/ou PostgreSQL | références opaques et payloads minimisés |
| vérité métier et autorité d'effet | bases agence, inbox/outbox, `action_intent`, versions et fences | ne dépend jamais du seul état Inngest |

La [documentation self-hosting](https://www.inngest.com/docs/self-hosting) décrit PostgreSQL et Redis externes pour sortir du service local mono-nœud. Elle donne notamment un défaut de **100 connexions PostgreSQL maximales par serveur**, 10 idle, durée de vie maximale 30 minutes et idle maximal 5 minutes. Trois réplicas non configurés pourraient donc réclamer jusqu'à 300 connexions. Le budget B01 doit réserver explicitement les connexions Inngest par replica.

### Rétention

Inngest ne purge pas automatiquement ses anciennes lignes PostgreSQL d'événements, runs et traces ; la documentation présente encore les guides/commandes de rétention comme une capacité future. Conséquences :

- aucune pièce, corps d'e-mail, secret, URL signée ou donnée métier complète dans les événements/runs/traces ;
- durée de conservation, purge supportée, index, vacuum, audit et restauration restent ouverts ;
- aucun `DELETE` SQL périodique inventé sans procédure supportée et test de cohérence ;
- les coûts de stockage/observabilité ne peuvent pas être consolidés.

## Redis Scaleway

Scaleway documente :

- HA à deux nœuds avec réplication asynchrone et bascule ;
- cluster de trois à six nœuds, chaque primaire ayant une réplique ;
- Private Network ;
- snapshots déclenchés selon des règles de temps et de nombre de clés modifiées.

La [documentation de persistance](https://www.scaleway.com/en/docs/managed-databases-for-redis/reference-content/ensuring-data-persistence/) précise toutefois que ce mécanisme ne garantit pas la récupération après incident et positionne principalement le service pour le cache. Or Inngest place dans Redis la queue et l'état des runs, pas uniquement un cache reconstructible.

| Option | Intérêt | Limite bloquante |
|---|---|---|
| `RED1-MICRO` HA, deux nœuds | coût fixe minimal et bascule | réplication asynchrone, récupération non garantie |
| cluster Redis, trois nœuds minimum | capacité et distribution | récupération toujours non garantie |
| Redis auto-opéré avec AOF/backups | contrôle théorique accru | nouvelle charge d'exploitation et qualification complète |
| autre moteur/orchestrateur | peut éviter la dépendance | nécessite nouvel ADR et réévaluation B02/B03/B04 |

Aucune option Redis ne reçoit un PASS documentaire avant restauration, pannes, réconciliation et bornes RPO/RTO.

## Multi-réplicas Inngest

Les sources officielles présentent simultanément :

- `inngest start` comme service mono-nœud bêta ;
- SQLite comme impropre au dépassement d'un nœud ;
- PostgreSQL et Redis externes ;
- un chart Helm présenté pour la production, avec replicas configurables, KEDA et autoscaling horizontal.

Cela autorise un candidat multi-réplicas, mais ne prouve pas :

- l'absence de double dispatch lors d'un crash ou d'une partition ;
- la sûreté des migrations concurrentes ;
- la continuité du gateway Connect ;
- la cohérence après perte Redis ou PostgreSQL ;
- une restauration conjointe PG/Redis ;
- la survie à la perte d'une AZ ;
- le respect de D58.

Le minimum de qualification proposé est trois réplicas sur au moins deux AZ. Pour Kapsule, un cluster **multi-AZ** conserve un control plane dans une zone ; seul un cluster **regional**, disponible avec un control plane HA Dedicated, répartit les replicas du control plane entre plusieurs zones. Cette distinction est obligatoire pour toute comparaison D58.[Concepts Kubernetes](https://www.scaleway.com/en/docs/kubernetes/concepts/)

## Annulation, replay et barrière d'effets

La [documentation d'annulation](https://www.inngest.com/docs/features/inngest-functions/cancellation) indique qu'une étape déjà en cours termine, que les étapes suivantes sont arrêtées et qu'un run annulé peut être rejoué. L'annulation ne défait donc jamais un effet externe déjà parti.

L'ADR-006 reste normative :

- `cancel` n'est pas une barrière d'autorisation ;
- les workers de calcul n'ont aucun credential d'effet ;
- le dispatcher distinct vérifie l'autorité courante juste avant l'émission ;
- chaque intention porte une clé logique unique, les versions utiles et un fence monotone ;
- stop/takeover et passage à `EN_COURS_EXTERNE` sont sérialisés ;
- un crash après début réseau produit `RESULTAT_INCONNU` ;
- aucun replay dashboard ne vaut réautorisation ;
- un résultat inconnu est réconcilié avant toute nouvelle tentative.

## Matrice des topologies Scaleway Paris

| Topologie | Ingress | PG/Redis | HA/egress | Verdict |
|---|---|---|---|---|
| Serverless Containers pour le serveur Inngest | endpoint public ; aucun ingress privé | egress privé vers un Private Network | scale-to-zero, disque temporaire, requête HTTP ≤60 min | **rejeté** pour le serveur persistant |
| Instances trois AZ | un `LB-S` par AZ + DNS health checks | Private Network direct | 3 replicas minimum ; IP publiques ou Gateway/NAT ; opérations manuelles | **candidat A** de simplicité, résilience à prouver |
| Kapsule multi-AZ, control plane zonal | un Service/LB par AZ + DNS health checks | Private Network | nodes répartis, mais accès control plane via LB de zone primaire | écarté du candidat D58 |
| Kapsule regional HA Dedicated | un Service/LB par AZ + DNS health checks | Private Network | replicas control plane répartis, mais accès réseau au control plane encore dépendant du LB de zone primaire | **candidat B** d'orchestration, D58 encore BLOCKED |
| Kapsule regional full isolation | mêmes trois LB ingress | Private Network | Gateway/NAT unique requis ; IP egress stable | **candidat B2**, mais gateway zonal reste SPOF documenté |
| serveur Inngest unique | direct ou LB | PG/Redis externes | aucune HA runtime | rejeté en production, fixture locale seulement |

Sources : [Private Networks Containers](https://www.scaleway.com/en/docs/serverless-containers/reference-content/containers-private-networks/), [limites Containers](https://www.scaleway.com/en/docs/serverless-containers/reference-content/containers-limitations/), [concepts zonal/multi-AZ/regional](https://www.scaleway.com/en/docs/kubernetes/concepts/), [Kapsule privé](https://www.scaleway.com/en/docs/kubernetes/reference-content/secure-cluster-with-private-network/), [limites multi-AZ et ingress par zone](https://www.scaleway.com/en/docs/kubernetes/reference-content/multi-az-clusters/), [offres control plane](https://www.scaleway.com/en/docs/kubernetes/reference-content/kubernetes-control-plane-offers/), [Load Balancer Kubernetes](https://www.scaleway.com/en/docs/kubernetes/reference-content/kubernetes-load-balancer/).

La documentation multi-AZ demande des Load Balancers placés par zone et un DNS avec health checks pour retirer la zone indisponible. Elle précise aussi que l'accès réseau au control plane Kapsule dépend d'un Load Balancer dans la zone primaire, y compris avec un control plane HA Dedicated. Le control plane régional améliore la réplication de ses composants, mais ne permet donc pas de déclarer D58 satisfait sans essai de perte de zone et procédure opératoire hors control plane.

Serverless Containers reste un candidat pour l'API NestJS si le callback Inngest est un endpoint HTTPS public signé. Il n'est pas un runtime admissible pour le serveur Inngest continuellement actif.

## Matrice des flux B04

| Source → destination | Chemin candidat | Authentification | Comportement d'échec |
|---|---|---|---|
| API/dispatcher → PostgreSQL agence | Private Network | credential limité à la base et au rôle | fail closed, aucune autre agence essayée |
| Inngest → PostgreSQL technique | Private Network | rôle Inngest dédié | nouveaux runs bloqués et alerte |
| Inngest → Redis | Private Network | credential Redis dédié | aucun fallback mémoire |
| application → Event API Inngest | privé si possible, sinon HTTPS | event key par environnement | refus si clé absente/invalide |
| Inngest → `/api/inngest` NestJS | HTTPS public si NestJS Serverless | configuration SDK fail-closed par méthode | `401`/`405`, aucune intention créée |
| workers → fournisseurs mail/IA | Internet via IP publique ou NAT | credential par adaptateur | backoff borné, état visible |
| workload → Secret Manager | API Scaleway | IAM application + API key scoped | fail closed, aucune clé plateforme globale |
| opérateur → dashboard Inngest | VPN/ACL privée | identité opérateur séparée | replay/pause audités et restreints |

Aucun port PostgreSQL, Redis, dashboard ou API d'administration Inngest ne doit être public.

## Callback signé et anti-rejeu

La [documentation des signing keys](https://www.inngest.com/docs/platform/signing-keys) décrit des requêtes signées avec timestamp. L'artefact officiel du SDK `4.21.1` vérifie les exécutions signées, mais son option `enableUnauthedSync` autorise par défaut une synchronisation `PUT` non authentifiée. La configuration de production doit donc imposer explicitement `enableUnauthedSync: false`.

Le SDK vérifie :

- `x-inngest-signature` ;
- paramètres `t` et `s` ;
- HMAC-SHA256 sur le payload JSON parsé puis canonicalisé JCS et le timestamp ;
- fenêtre d'expiration par défaut de cinq minutes ;
- comparaison timing-safe ;
- clé courante puis clé fallback pendant rotation.

Matrice de méthodes obligatoire :

| Méthode | Usage candidat | Exigence production |
|---|---|---|
| `GET` | introspection/handshake du serve endpoint | aucun effet ; réponse minimisée, comportement exact vérifié |
| `PUT` | synchronisation d'app/fonctions | `enableUnauthedSync: false` et signature valide obligatoire |
| `POST` | exécution de fonction | signature valide obligatoire avant résolution métier |
| autre | aucun | `405`, aucun effet |

Contrat DossierClé :

1. le handler transmet au SDK le JSON selon l'adaptateur officiel, sans transformation sémantique métier ;
2. proxy et body parser NestJS/Express sont vérifiés avec le SDK épinglé ; l'ordre des clés ou les espaces seuls ne doivent pas être traités comme une altération, car le SDK canonicalise le JSON ;
3. la signature n'est pas réimplémentée localement ;
4. les modes dev et le bypass de signature sont interdits en production ;
5. la fenêtre de timestamp ne remplace pas la déduplication inbox ;
6. une signature valide authentifie Inngest, pas l'autorité métier ;
7. pour `PUT` et `POST`, signature absente, invalide, expirée ou ancienne après rotation : `401`, aucun effet ;
8. `enableUnauthedSync` reste explicitement `false` dans configuration, déploiement et tests de régression.

## Secret Manager et IAM

Secret Manager documente : stockage régional, versions, sélection `latest_enabled`, chiffrement géré ou Key Manager, politiques IAM jusqu'au secret individuel et conditions par `resource.id`, `resource.name` ou `resource.locality`. `resource.id` est préférable au nom mutable.

| Principal | Permission sets candidats | Portée et interdictions |
|---|---|---|
| Inngest runtime | `SecretManagerReadOnly` + `SecretManagerSecretAccess` | règle Project + conditions `resource.id` des seuls secrets Inngest ; aucun create/write/delete/restore |
| API NestJS | mêmes deux sets | IDs exacts des secrets applicatifs nécessaires ; aucun secret d'effet non utilisé |
| dispatcher | mêmes deux sets | IDs des credentials de son seul adaptateur/environnement |
| migration/provisioning | sets temporaires séparés selon opération | jamais montés dans le runtime métier ; expiration et retrait vérifiés |
| CI/CD rotation | `SecretManagerSecretCreate` et, si nécessaire, `SecretManagerSecretWrite` | Project et IDs/chemins approuvés ; aucun `SecretManagerSecretAccess`, delete ou restore |
| opérateur break-glass | permissions explicites limitées à l'incident | MFA, audit, durée bornée ; aucun `SecretManagerFullAccess` permanent |

`SecretManagerReadOnly` permet de lister/lire les métadonnées ; `SecretManagerSecretAccess` lit les valeurs de versions. `SecretManagerSecretCreate`, `Write`, `Delete` et `Restore` sont séparés. Le test B04 doit donc vérifier non seulement la valeur d'un secret voisin, mais aussi l'impossibilité de lister ses métadonnées lorsque la condition resource-level est censée l'exclure.[Permission sets](https://www.scaleway.com/en/docs/iam/policies-permissions/permission-sets/)

Sources : [Secret Manager](https://www.scaleway.com/en/docs/secret-manager/quickstart/), [IAM applications](https://www.scaleway.com/en/docs/identity-and-access-management/iam/concepts/), [resource-level IAM](https://www.scaleway.com/en/docs/identity-and-access-management/iam/policies-permissions/supported-products-resource-level/), [conditions IAM](https://www.scaleway.com/en/docs/identity-and-access-management/iam/policies-permissions/understanding-resource-level-conditions/).

### Workload identity non démontrée

Le [provider CSI officiel](https://www.scaleway.com/en/docs/secret-manager/api-cli/deploying-secret-manager-csi-provider-kubernetes/) monte les valeurs sans créer de Kubernetes Secret intermédiaire pour celles-ci, mais exige au bootstrap une access key et une secret key stockées dans un Kubernetes Secret. Il indique que l'authentification par Kubernetes Service Account n'est pas supportée.

La cible « workload identity sans clé statique » n'est donc pas démontrée. Une API key distincte par workload, limitée par secret et tournée fréquemment réduit le risque sans le supprimer.

### Rotation et suppression

Séquence proposée : créer une version, rendre le consommateur compatible avec ancien/nouveau, activer, vérifier, révoquer l'ancien credential chez le fournisseur, désactiver l'ancienne version puis programmer sa suppression. La [suppression Secret Manager](https://www.scaleway.com/en/docs/secret-manager/how-to/delete-secret/) reste récupérable pendant sept jours et ne remplace jamais la révocation fournisseur.

## Coûts publics calculables

Hypothèses : Paris, 730 heures/mois, tarifs publics HT observés le 2026-10-02. Aucun total n'est un devis ou budget adopté.

| Composant | Tarif | Mensuel indicatif |
|---|---:|---:|
| Instance `DEV1-M`, 3 vCPU / 4 Go | 0,0202 €/h | 14,75 € |
| 3 × `DEV1-M` | — | 44,24 € |
| Load Balancer `LB-S` | 0,023 €/h | 16,79 € |
| 3 × `LB-S`, un par AZ | — | 50,37 € |
| Public Gateway `VPC-GW-S` | 0,026 €/h | 18,98 € |
| Redis `RED1-MICRO` HA | 0,048 + 0,027 €/h | 54,75 € |
| Redis `RED1-MICRO`, cluster trois nœuds | 0,048 + 2 × 0,027 €/h | 74,46 € |
| Kapsule Dedicated-4 | 0,11 €/h | 80,30 € |
| PG Q1 `DB-POP2-2C-8G` HA historique | résultat Q1 | 160,16 € |

| Scénario | Total HT/mois indicatif |
|---|---:|
| Instances candidat A : 3 replicas + 3 LB zonaux + Redis cluster + PG | **329,23 €** |
| Instances candidat A + egress fixe Gateway | **348,21 €** |
| Kapsule regional candidat B : Dedicated-4 + 3 nodes + 3 LB zonaux + Redis cluster + PG | **409,53 €** |
| Kapsule regional full isolation B2 : précédent + Gateway | **428,51 €** |

Sources : [Instances](https://www.scaleway.com/en/pricing/virtual-instances/), [Kapsule](https://www.scaleway.com/en/pricing/containers/), [réseau](https://www.scaleway.com/en/pricing/network/), [bases/Redis](https://www.scaleway.com/en/pricing/managed-databases/).

Exclusions : stockage et snapshots, trafic/IP additionnelles, registry, observabilité, coût du DNS et de ses health checks, certificats/WAF, Secret/Key Manager, QA/reprise, support, temps d'exploitation/astreinte et marge d'autoscaling. Ces montants intègrent désormais trois `LB-S`, mais restent des **planchers incomplets et non une preuve D58** : le Load Balancer d'accès au control plane Kapsule, le Gateway zonal, Redis et PostgreSQL conservent des limites documentées. Les scénarios à deux replicas, à un seul LB ingress et les control planes Mutualized/zonal sont exclus de cette comparaison, même s'ils seraient moins chers. Le PostgreSQL pourrait éventuellement partager une instance technique déjà payée, mais un coût marginal nul ne peut être supposé sans capacité, connexions, isolation, restauration et blast radius qualifiés.

## Contradictions et inconnues

| Sujet | Constat | Effet |
|---|---|---|
| licence | serveur SSPL, SDK Apache, transition future datée | avis juridique et choix humain |
| mono-nœud / horizontal | CLI bêta mono-nœud, Helm/HPA documentés | multi-réplicas à tester |
| Redis | queue/run-state durables, récupération Scaleway non garantie | restore/failover bloquants |
| rétention PG | aucune purge automatique supportée | coût et conformité ouverts |
| ingress multi-AZ | un LB par zone + DNS health checks nécessaires | coûts ajoutés ; failover/TTL à tester |
| Kapsule | regional HA Dedicated réplique le control plane, mais son accès réseau dépend du LB de zone primaire | opérations et D58 restent bloquées lors de perte de cette zone |
| Kapsule full isolation | egress fixe mais Gateway zonal potentiellement SPOF | D58 non démontré |
| Serverless | egress privé, pas ingress privé | callback public signé |
| callback | `enableUnauthedSync` vrai par défaut ; canonicalisation JCS ; intégration proxy/body parser non exécutée | configuration explicite et `B04-P-1` requis |
| anti-rejeu | timestamp, mais doublon identique possible dans la fenêtre | inbox/idempotence obligatoire |
| workload identity | API key statique nécessaire au CSI | cible sans secret long terme non atteinte |
| coût | compute/réseau/Redis calculables, reste incomplet | budget humain ouvert |
| PRA | restauration cohérente PG+Redis+outbox non documentée | B03 reste bloqué |

## `B02-P-1` proposé — non autorisé

Hypothèse : aucun effet externe ne part sous une autorité ou un fence périmé, même après annulation, replay, réveil d'un ancien worker, crash ou partition.

Préconditions obligatoires avant toute exécution : autorisation humaine distincte, environnement isolé, données/fournisseurs synthétiques, versions exactes épinglées, durée/coût/quota plafonnés et destruction approuvée.

Scénarios minimum :

1. annulation avant et pendant étape ;
2. prise humaine ou révocation avant/après fence ;
3. coupure entre dispatcher et autorité centrale ;
4. crash avant/après `EN_COURS_EXTERNE` ;
5. réponse fournisseur perdue après succès ;
6. ancien worker réveillé ;
7. replay dashboard ;
8. doubles événement/callback ;
9. bascule Redis et perte d'un replica Inngest ;
10. restauration PG/Redis désalignée.

Succès : aucun effet sous autorité invérifiable, aucun doublon, ancien fence rejeté, résultat incertain visible et réconciliation avant retry. Tout droit ressuscité ou effet ambigu reclassé en échec invalide le protocole.

## `B04-P-1` proposé — non autorisé

Hypothèse : seuls les flux nécessaires fonctionnent, avec callback authentifié, anti-rejeu, IAM minimal, rotation et aucun background serverless supposé durable.

Scénarios minimum :

1. egress privé PG/Redis et DNS au cold start ;
2. matrice `GET`/`PUT`/`POST`/autres avec `enableUnauthedSync: false` ;
3. callback dont seuls espaces/ordre des clés changent, puis modification sémantique du JSON ;
4. signature absente/invalide/expirée sur `PUT` et `POST` ;
5. replay dedans/dehors fenêtre et double identifiant ;
6. rotation current/fallback puis retrait ;
7. lecture du seul secret autorisé, tentative de valeur voisine et listing de métadonnées ;
8. révocation API key, redémarrage pod/node et panne Secret Manager ;
9. timeout et travail après réponse ;
10. perte successive de chaque LB/AZ, retrait DNS par health check, TTL et retour de zone ;
11. perte de la zone primaire du Load Balancer d'accès control plane, avec mesure du data plane restant et des opérations devenues impossibles ;
12. perte node/Gateway et vérification du blast radius inter-AZ ;
13. vérification qu'aucun port technique n'est public et qu'aucun secret/payload n'est loggé.

Succès : flux requis uniquement, callbacks/replays invalides sans effet, secrets voisins inaccessibles, aucune clé globale, délai de révocation mesuré, aucun travail durable après réponse Serverless, ingress maintenu après perte d'une AZ, limites du control plane mesurées et tout SPOF éliminé ou explicitement arbitré.

## Décisions documentaires acquises

- rejeter Serverless Containers comme runtime du serveur Inngest ;
- conserver Serverless Containers comme candidat API avec callback public signé ;
- conserver Instances multi-AZ et Kapsule **regional HA Dedicated** comme candidats concurrents ;
- imposer PostgreSQL et Redis externes ;
- interdire SQLite et Redis mémoire en production ;
- interdire les données sensibles dans events/runs/traces ;
- conserver l'ADR-006 comme autorité des effets ;
- exiger IAM application distincte, permissions par secret et aucune clé globale ;
- considérer la workload identity native comme non démontrée ;
- maintenir `B02-P-1` et `B04-P-1` comme prérequis proposés, non autorisés.

## Arbitrages humains obligatoires

1. avis juridique et acceptabilité SSPL ;
2. budget fixe et coût d'exploitation ;
3. Instances ou Kapsule ;
4. acceptation du surcoût et de l'engagement du control plane Kapsule regional HA Dedicated ;
5. acceptation temporaire d'une API key statique scoped ;
6. Managed Redis malgré l'absence de garantie de récupération, autre Redis ou autre orchestrateur ;
7. exception au principe tout-serverless ;
8. ADR alternatif si Inngest/Redis échoue.

Ces décisions ne sont pas sollicitées maintenant : Q2 livre les options et s'arrête au statut `BLOCKED` sans POC ni dépense.