# Qualification Q1 — B01 Cloud SQL, flotte et restauration isolée

Date de décision : **2026-10-04**. Issue [#52](https://github.com/issa-diallo/dossiercle/issues/52), après qualification initiale [#37](https://github.com/issa-diallo/dossiercle/issues/37) et abandon du mini-POC [#53](https://github.com/issa-diallo/dossiercle/issues/53). Travail documentaire uniquement : aucun compte fournisseur, ressource, secret, coût, donnée ou test Google Cloud.

La qualification Scaleway complète du 2026-10-02 est conservée sans réduction dans l'[annexe historique supersédée](ARCHITECTURE_Q1_B01_SCALEWAY_HISTORIQUE.md). Elle demeure la preuve datée des sources, contradictions, coûts indicatifs, limites de chiffrement/restauration et du protocole `B01-P-1` alors envisagé ; elle n'est plus la cible active.

## Verdict

`B01: CLOSED_BY_DECISION — ACCEPTED_WITH_RISK`

- `CLOSED_BY_DECISION` signifie que le choix structurel du produit PostgreSQL n'est plus ouvert : il est clos par décision humaine documentée.
- `ACCEPTED_WITH_RISK` signifie que la cible est adoptée malgré l'absence assumée de preuve opérationnelle DossierClé.
- Ce statut n'est **pas** un `PASS` technique, ne clôt pas B03 et ne rend pas l'Architecture globale `PASS`.

## Cible adoptée

La cible PostgreSQL de production est :

- **Google Cloud SQL for PostgreSQL natif** ;
- **PostgreSQL 17** ;
- édition **Enterprise** ;
- région Paris **`europe-west9`** ;
- configuration **HA régionale**, avec primaire et standby dans deux zones de la région ;
- failover automatique documenté par le fournisseur ;
- **PITR explicitement activé** et restauration vers une nouvelle instance isolée ;
- connexions chiffrées obligatoires : aucun mode autorisant les connexions non chiffrées ;
- chiffrement au repos et sauvegardes gérés par le service, avec politique de clés et d'accès à arrêter avant données réelles ;
- PostgreSQL, `pg`, Drizzle, `pg_dump` et `pg_restore` conservés pour limiter le lock-in moteur.

La règle D08 reste inchangée : une base logique et un utilisateur runtime dédiés par agence, sans imposer une instance physique par agence. Le registre et l'identité centraux restent séparés des données métier des agences selon D40/D54.

Cette décision remplace Scaleway Managed PostgreSQL comme cible active. Elle ne modifie pas les choix Scaleway relatifs aux fichiers privés, à Qwen/IA, au coffre candidat, à l'hébergement applicatif ou à Inngest auto-hébergé.

## Fondement documentaire

| Capacité | Preuve documentaire fournisseur | Ce qu'elle ne prouve pas |
|---|---|---|
| Région Paris | Cloud SQL liste `europe-west9` parmi les régions disponibles ; les zones exactes sont choisies/attribuées dans cette région. | Disponibilité de capacité, quotas ou prix au moment du déploiement. |
| HA régionale | Une instance HA est régionale, avec primaire et standby dans deux zones ; réplication synchrone et bascule automatique vers le standby sont documentées. | Temps maximal contractuel de failover, absence de transaction perdue dans notre usage, reconnexion réelle des pools DossierClé. |
| PITR | Cloud SQL permet une restauration à un instant choisi vers une nouvelle instance ; le PITR doit être activé et sa rétention configurée. | Succès d'une restauration DossierClé, granularité native par base d'agence, RPO/RTO < 4 h ou remise en HA de la cible restaurée. |
| TLS | Cloud SQL permet d'imposer les connexions chiffrées avec `ENCRYPTED_ONLY` ou un mode plus strict. | Configuration correcte des clients, certificats, proxy/connecteurs, rotation ou refus effectif de tout chemin non chiffré. |
| Chiffrement au repos et backups | Cloud SQL documente le chiffrement des tables, fichiers temporaires et sauvegardes ; les sauvegardes automatiques ou à la demande sont gérées séparément de l'instance et chiffrées par défaut avec clés gérées par Google ou CMEK. | Politique DossierClé de clés, rétention, fréquence, restauration, séparation des droits, coût et conformité contractuelle. |
| PostgreSQL 17 | Cloud SQL documente PostgreSQL 17 comme version majeure prise en charge. | Compatibilité des extensions, migrations, versions Drizzle/`pg` et procédures de sortie réellement nécessaires à DossierClé. |

Sources primaires consultées :

- [Cloud SQL — haute disponibilité](https://cloud.google.com/sql/docs/postgres/high-availability)
- [Cloud SQL — PITR](https://cloud.google.com/sql/docs/postgres/backup-recovery/pitr)
- [Cloud SQL — chiffrement en transit](https://cloud.google.com/sql/docs/postgres/configure-ssl-instance)
- [Cloud SQL — FAQ chiffrement des données et sauvegardes](https://cloud.google.com/sql/docs/postgres/faq)
- [Cloud SQL — vue d'ensemble des sauvegardes](https://cloud.google.com/sql/docs/postgres/backup-recovery/backups)
- [Cloud SQL — disponibilité des régions](https://cloud.google.com/sql/docs/postgres/region-availability-overview)
- [Cloud SQL — paramètres et versions PostgreSQL](https://cloud.google.com/sql/docs/postgres/instance-settings)

Ces pages établissent des capacités du service, pas des résultats mesurés dans l'environnement DossierClé. Aucun SLA fournisseur n'est transformé en SLA produit.

## Risque opérationnel accepté

Le propriétaire accepte explicitement de poursuivre sans mini-POC pré-Architecture. Les points suivants ne sont donc pas mesurés :

1. durée de failover entre zones et délai de reconnexion applicative ;
2. sort des transactions acquittées lors d'une bascule ;
3. RPO et RTO réels du PITR ;
4. restauration isolée d'une seule agence sans lecture, écrasement ou indisponibilité d'une autre ;
5. propriétaires, séquences, extensions et droits après restauration ;
6. `max_connections`, densité d'agences, pools API/workers, éviction et backpressure ;
7. migrations de flotte, canari, reprise après échec et portabilité de sortie ;
8. coût complet compute HA, stockage, journaux/PITR, sauvegardes, réseau, supervision, support et instance temporaire de restauration ;
9. comportement lors de la perte complète de la région Paris ;
10. conformité contractuelle, DPA, sous-traitants, transferts et politique de clés finale.

Aucune mesure opérationnelle n'est disponible. Aucun coût réel, plafond de restauration, SLA DossierClé ou survie à une perte régionale n'est prouvé.

## B01-P-1 abandonné

Le mini-POC [#53](https://github.com/issa-diallo/dossiercle/issues/53) avait été autorisé puis a été fermé **`not planned` le 2026-10-04** par décision humaine avant toute exécution.

Conséquences :

- aucune ressource Cloud SQL créée ;
- aucune dépense engagée ;
- aucune donnée synthétique chargée ;
- aucun secret ou compte de service utilisé ;
- aucun failover, PITR, test d'isolation, test de pools ou relevé de coût exécuté ;
- aucune preuve supprimée artificiellement : l'absence de mesure reste visible dans le risque accepté.

L'abandon de `B01-P-1` clôt le gate de sélection pré-Architecture ; il ne dispense pas des validations de livraison.

## Validations obligatoires reportées à Verify/QA

Avant toute Production, un environnement QA isolé doit au minimum prouver :

1. création HA régionale en `europe-west9`, PostgreSQL 17 Enterprise, PITR activé ;
2. refus des connexions non chiffrées et rotation contrôlée des credentials/certificats ;
3. bascule zonale, endpoint stable, reconnexion bornée et inventaire des transactions acquittées ;
4. PITR vers une nouvelle instance isolée, contrôle du point restauré et remise en HA ;
5. restauration d'une agence sans fuite ni écrasement d'une autre, avec schéma, données, séquences, propriétaires, extensions et droits conformes ;
6. isolation croisée des utilisateurs runtime et du rôle migration ;
7. budget de connexions mesuré aux paliers nominal, autoscaling maximal et maintenance/incident, avec éviction et backpressure avant saturation ;
8. migration de flotte canari, interruption, reprise idempotente et stratégie de sortie `pg_dump`/`pg_restore` ;
9. coût réel et limites de quotas/support ;
10. revue indépendante sans Critical/Major avant autorisation de Production.

Ces contrôles peuvent confirmer ou invalider le risque accepté. Un échec impose arrêt, correction ou nouvel ADR ; il ne peut pas être neutralisé par le statut documentaire B01.

## Séparation B01 / B03

B01 clôt uniquement le choix structurel du produit PostgreSQL avec risque accepté.

`B03: BLOCKED` demeure inchangé pour la reprise cohérente de l'ensemble **bases + fichiers + identité/registre + orchestration + secrets**, avec RPO strictement inférieur à 4 heures et RTO strictement inférieur à 4 heures. Le PITR Cloud SQL ne prouve pas à lui seul ces objectifs, la cohérence multi-services, l'absence de résurrection des droits ou la reprise après perte régionale.

## Alternatives écartées pour B01

- **Scaleway Managed PostgreSQL** : remplacé comme cible active faute de preuve documentaire équivalente de HA interzone à failover automatique et PITR natif pour les invariants retenus.
- **AWS RDS for PostgreSQL** : alternative de résilience considérée, non sélectionnée après décision humaine de prioriser le coût pour la cible documentaire ; aucune comparaison de coût équivalente n'a été exécutée.
- **Azure Database for PostgreSQL Flexible Server** : alternative de simplicité considérée, non sélectionnée après cette même priorisation humaine ; aucune comparaison de coût équivalente n'a été exécutée.
- **Amazon Aurora PostgreSQL et Google AlloyDB** : écartés pour préserver PostgreSQL natif et limiter le lock-in moteur.

Google Cloud a été priorisé par décision humaine au regard du coût, sans mesure comparable exécutée entre Google Cloud, AWS et Azure. Aucune de ces dispositions ne constitue donc une comparaison tarifaire mesurée, un rejet d'AWS/Azure pour coût démontré ou un jugement général sur les fournisseurs.

## Impact Architecture

- ADR-002 et l'Architecture utilisent désormais Cloud SQL comme cible PostgreSQL active.
- B01 n'est plus un choix structurel ouvert.
- B03, B04 et tous les autres blocs non clos restent ouverts selon leur statut propre.
- `ARCHITECTURE: BLOCKED` reste le verdict global.
- PRD, Stories et Story Review ne sont pas modifiés par cette décision documentaire.
