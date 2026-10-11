# Hébergement, réseau et licence Inngest — décision documentaire

Consolidation du 11 octobre 2026. Lecture seule du corpus canonique et consultation de sources officielles ; aucun POC, runtime, achat ou changement de stack. Le ledger du POC arrêté reste inchangé. Le choix humain D71 demeure acquis ; les preuves techniques de production restent à produire dans les stories.

## Conclusion proposée

**GO documentaire pour conserver Inngest et pour relier Scaleway Paris à Cloud SQL Paris en réseau privé par VPN IPsec/BGP.** D59 reste inchangée : PostgreSQL 17 Enterprise, HA régionale `europe-west9`, PITR/TLS, aucune IP PostgreSQL publique. **NO GO** pour présenter Serverless Containers seul comme hébergement durable du serveur Inngest, Redis managé Scaleway comme garantie de récupération des jobs, ou la HA régionale comme PRA démontré sous quatre heures.

Pour démarrer avec une exploitation limitée, préférence : API Nest sur Serverless Containers connecté au Private Network ; serveur Inngest persistant sur Instances avec un actif et un secours restaurable dans une autre AZ parisienne ; PostgreSQL technique séparé logiquement sur Cloud SQL ; Redis externe persistant sauvegardé hors du nœud. Cette préférence exige une exception explicite à la cible « tout serverless/managé » pour la plateforme jobs. Elle n'adopte ni Inngest Cloud ni un nouvel outil.

## Capacités et verdicts

| Capacité | Verdict documentaire | Conséquence précise |
|---|---|---|
| Scaleway → Cloud SQL privé | GO | VPN IPsec/IKEv2/BGP, routes explicites aller/retour ; aucun endpoint PG public. |
| Serverless Containers → routes privées/VPN | GO | Private Network et routes personnalisées documentés ; tests futurs DNS, routage, reprise et saturation. |
| Inngest durable sur Serverless seul | NO GO | Processus persistant, Redis et PostgreSQL externes ; éviter stockage temporaire et arrêt du serveur. |
| Inngest auto-hébergé pour jobs métier internes | GO documentaire sous frontière d'usage | Conserver le moteur ; traiter explicitement la clause 13 SSPL, sans certificat juridique inventé. |
| Multiréplicas Inngest = HA prouvée | NO GO pour cette affirmation | Chart et PostgreSQL permettent une conception évolutive ; compatibilité de la version et comportement de panne restent à qualifier. |
| Redis managé Scaleway seul = PRA durable | NO GO | La documentation ne garantit pas récupération ; choisir persistance et sauvegardes maîtrisées pour l'état des jobs. |
| Identité native Scaleway automatiquement fédérée Google | NO GO pour cette affirmation | WIF exige un émetteur et des assertions vérifiables ; Kubernetes fournit une voie documentée. |
| Secret Manager Scaleway CSI sans clé statique | NO GO actuellement | Le provider demande access/secret key et ne supporte pas l'authentification ServiceAccount Kubernetes. |
| RPO/RTO < 4 h déjà démontrés | NO GO | Objectifs maintenus ; qualification ultérieure de bout en bout, incluant autorité de révocation et reprise métier. |

Le rattachement des containers au Private Network supporte les routes personnalisées, mais ne supprime pas leur accès Internet. Une politique d'egress et des destinations autorisées restent nécessaires. Les limites comprennent mise à zéro, disque temporaire, requêtes limitées et absence de rollback/versioning automatique : elles justifient de réserver ce service à l'API et aux fonctions HTTP bornées. Sources : [réseau privé Containers](https://www.scaleway.com/en/docs/serverless-containers/reference-content/containers-private-networks/), [limites Containers](https://www.scaleway.com/en/docs/serverless-containers/reference-content/containers-limitations/).

## Topologie préférée : précise, sans promesse de HA fictive

1. VPC/Private Network Scaleway `fr-par` avec CIDR disjoint des plages Google et Cloud SQL. API publique limitée à l'interface métier ; endpoint des fonctions Inngest et administration/metrics privés. Pool PostgreSQL plafonné par agence et capacité totale.
2. Deux passerelles Site-to-Site VPN dans deux AZ Scaleway différentes, avec connexions redondantes vers Google HA VPN/Cloud Router. IKEv2 et BGP ; politiques de routage autorisant seulement les préfixes nécessaires. Le transport traverse Internet sous IPsec : le service PostgreSQL demeure privé. La redondance de deux tunnels sur une seule passerelle ne constitue pas une HA inter-AZ. [Scaleway VPN](https://www.scaleway.com/en/docs/site-to-site-vpn/reference-content/understanding-s2svpn/).
3. Cloud SQL via Private Services Access. Cloud Router annonce explicitement la plage allouée Cloud SQL ; le peering exporte les routes personnalisées de retour vers Scaleway. TLS reste exigé au-dessus du VPN. Auth Proxy/Connector sécurise l'authentification et le transport mais ne crée pas ce chemin réseau. [Configuration IP privée](https://docs.cloud.google.com/sql/docs/postgres/configure-private-ip), [Auth Proxy](https://docs.cloud.google.com/sql/docs/postgres/sql-proxy).
4. Un serveur Inngest actif, un secours préparé dans une autre AZ ; pas de revendication active-active. Redis est un composant externe à l'état du processus, avec disque persistant, AOF et snapshots exportés chiffrés. PostgreSQL contient configuration/historique dans une base technique distincte des bases agence. Le mécanisme de bascule doit garantir un seul actif et respecter le cut d'autorité actuel d'ADR006/010 ; aucun effet SMTP déjà lancé ne peut être annulé rétroactivement.
5. Proposition de sauvegarde Redis horaire avec surveillance de l'âge du dernier point réellement récupérable et sauvegarde indépendante du nœud. Cette fréquence laisse une marge sous quatre heures mais ne prouve ni sauvegarde cohérente PostgreSQL+Redis ni RPO métier. AOF et sauvegardes demandent notamment de maîtriser les réécritures ; simple copie arbitraire d'un AOF multi-fichier peut être invalide. [Persistance Redis](https://redis.io/docs/latest/management/persistence/). Version et licence du backend Redis exact à fixer avant implémentation ; aucun remplacement silencieux par Valkey.

Le Redis managé Scaleway décrit snapshots et réplication asynchrone, puis précise que cette persistance ne garantit pas la récupération en incident. Il convient donc comme cache, mais ne suffit pas comme fondement unique des jobs durables. [Source officielle](https://www.scaleway.com/en/docs/managed-databases-for-redis/reference-content/ensuring-data-persistence/).

Le serveur Inngest supporte PostgreSQL et Redis externes ; les défauts SQLite/Redis en mémoire ne sont pas la proposition de production. La documentation indique l'absence de purge PostgreSQL automatique et de support direct garanti en self-host ; le support entreprise est à négocier séparément. [Self-hosting Inngest](https://www.inngest.com/docs/self-hosting). Les fonctions s'exécutent dans l'application via HTTP ou Connect ; ne pas confondre serveur durable et fonction métier courte. [Guide plateforme](https://www.inngest.com/docs/platform-and-operations/self-host-inngest).

### Identités : choix restant explicite

Sur Instances/Serverless, WIF nécessite un émetteur OIDC/SAML de confiance et une preuve de bootstrap, d'audience et de rotation. Aucun émetteur natif Scaleway approprié n'a été démontré par cette étude. La préférence Instances implique donc de cadrer l'émetteur ou d'accepter explicitement des credentials restreints et rotatifs ; elle ne livre pas une promesse « sans aucune clé ».

Alternative d'hébergement : Kapsule avec jetons ServiceAccount projetés et JWKS chargés dans Google WIF, scopes/audiences et rotation dédiés. Cette voie évite une clé de service Google longue durée, sans résoudre les credentials du Secret Manager Scaleway. [WIF Kubernetes](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-kubernetes?hl=en), [WIF autres fournisseurs](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-other-providers), [CSI Scaleway](https://www.scaleway.com/en/docs/secret-manager/api-cli/deploying-secret-manager-csi-provider-kubernetes/).

Kapsule Dedicated et pools multi-AZ sont une option d'exploitation plus structurée, avec le [chart officiel Inngest](https://github.com/inngest/inngest-helm). Ils ajoutent coût et maintenance ; les volumes sont zonaux et le load balancer du control plane demeure dans la zone primaire régionale, même en HA. Ce n'est pas une garantie d'insensibilité à toute panne AZ. [Limites multi-AZ Kapsule](https://www.scaleway.com/en/docs/kubernetes/reference-content/multi-az-clusters/).

## Licence Inngest : frontière et options de remplacement

Artefact examiné : serveur **v1.45.1**, [LICENSE.md exact](https://github.com/inngest/inngest/blob/v1.45.1/LICENSE.md). Il est sous SSPL v1 ; la concession Apache future dépend du troisième anniversaire de mise à disposition du logiciel concerné. Elle ne rend pas cette version Apache aujourd'hui. Les SDK ont un régime Apache distinct.

La clause 13 vise les fonctionnalités du Program offertes à des tiers comme service, avec des exemples plus larges qu'une simple console publique : interaction distante, service dont la valeur dérive principalement du moteur ou qui accomplit son objectif principal. Si déclenchée, elle demande publication de Service Source Code incluant l'infrastructure logicielle permettant ce service.

**Analyse, non avis juridique :** DossierClé vend un processus métier immobilier ; Inngest orchestre ses jobs internes. Interdire accès client au dashboard/API du moteur et toute offre de workflow générique est une frontière raisonnable pour conserver Inngest. Le seul mot « SaaS » ne suffit pas à interdire cet usage ; dashboard privé seul ne suffit pas non plus à prouver exemption. Documenter ce profil dans ADR005, licence/version et obligations de distribution. En cas d'ambiguïté persistante sur le produit commercial exact, obtenir une interprétation écrite du concédant ou une revue juridique avant production ; aucune affirmation de GO légal définitif.

Si cette frontière est refusée ou l'obligation SSPL incompatible avec le produit :

| Alternative | Licence officielle | Adéquation / coût de changement |
|---|---|---|
| **Temporal auto-hébergé — préférence de remplacement** | [Serveur MIT](https://github.com/temporalio/temporal/blob/main/LICENSE) | Workflows durables et persistance PostgreSQL possibles, mais plusieurs services et exploitation plus lourde ; réécriture des workflows et nouvel ADR/validation. [Déploiement officiel](https://docs.temporal.io/production-deployment). |
| **BullMQ OSS** | [MIT](https://github.com/taskforcesh/bullmq/blob/master/LICENSE) | Adapté aux queues/jobs simples ; Redis durable et logique métier de reprise à maîtriser, pas équivalence automatique aux workflows Inngest. [Production](https://docs.bullmq.io/guide/going-to-production). |

Ces licences sont celles des dépôts examinés ; une adoption future doit figer release et dépendances. Les options commerciales ont leurs propres conditions. La documentation BullMQ présente aussi un backend PostgreSQL actuel ; aucune maturité/version exacte n'est qualifiée ici. Aucun remplacement n'est adopté.

## Coûts : composants observés, pas devis

Tarifs publics consultés le **11 octobre 2026**, hors taxes pour Scaleway, hors remises/change. Base illustrative de 730 h, sans dimensionnement de charge :

- Scaleway PAR-1 BASIC3-X2C-4G : 0,03945 €/h, soit environ **28,80 €/mois par instance**, hors stockage et IPv4 ; deux instances illustrent environ 57,60 € de compute, sans constituer un devis ni certifier cette taille. [Instances](https://www.scaleway.com/en/pricing/virtual-instances/).
- Private Networks gratuits ; LB-S PAR-1 0,023 €/h, environ **16,79 €/mois par LB**. [Réseau Scaleway](https://www.scaleway.com/en/pricing/network/).
- VPN Scaleway : passerelles, IPv4 et stockage PSK facturés séparément. La page tarifaire est partiellement accessible ; prix de l'offre VPN exacte non extrait, donc montant non inventé.
- Google VPN : table affichée par défaut Iowa à 0,05 USD/tunnel/h, soit **73 USD pour deux tunnels/730 h**, plus egress Internet. C'est un repère publié, **pas un tarif Paris confirmé** : sélectionner `europe-west9` dans le calculateur/SKU avant chiffrage. [Tarif Google VPN](https://cloud.google.com/vpn/pricing).
- Cloud SQL HA représente deux fois le coût CPU/RAM/stockage d'une instance autonome comparable ; volume, taille, backup et trafic manquent pour un montant. [HA Cloud SQL](https://docs.cloud.google.com/sql/docs/postgres/high-availability).

La cible privée intercloud HA possède donc un socle fixe et des frais d'egress ; « faible budget » ne signifie pas tout gratuit. Aucun budget total crédible ne peut être annoncé sans charge, stockage et SKU Paris. Aucun coût historique Q2 n'est réutilisé comme devis actuel.

## Décisions maintenant / preuves plus tard

Pour Architecture : acter cette topologie documentaire, l'exception runtime persistant, le profil SSPL et la stratégie d'identité acceptée. Clarifier si « incident majeur » inclut disparition de toute la région Paris : HA parisienne seule ne couvre pas cela. Si oui, prévoir sauvegardes et capacité de reprise dans une autre région UE ; cela n'annule pas D59 pour le service principal.

Pour les stories/QA avant production : version Redis/licence, routage aller-retour et DNS, TLS/IAM/WIF ou rotation credentials, quotas et coûts réels, bascule/cut sans double actif, restauration PostgreSQL+Redis+objets et autorité actuelle, purges/rétention, perte de zone/région, durée complète jusqu'au service utilisable. Aucune nouvelle exécution n'est autorisée par ce rapport ; le POC reste interrompu par l'utilisateur.
