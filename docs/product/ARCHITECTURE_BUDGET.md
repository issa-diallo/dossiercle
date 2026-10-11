# Budget Architecture — Scaleway Paris

Estimation documentaire au 2026-10-11, issue#63. EUR HT,730 h/mois, sans
promotion. Aucune commande, aucun devis accepté, aucun achat. Cible 100 €/mois,
plafond indicatif 150 €, **pas plafond garanti d’une production conforme**.

## A — sans client

Local/synthétique : **0 € de cloud**, électricité/matériel local exclus.
Un hébergement synthétique permanent est optionnel, jamais nécessaire pour
Architecture ou développement. Proposition 8 Go RAM partagés à qualifier, pas
exigence matérielle imposée au poste.

| Poste optionnel | Tarif public / hypothèse | EUR/mois HT |
|---|---|---:|
| VM DEV1-L 8 Go | 0,04284 €/h ×730 | 31,27 |
| PG DB-DEV-M 4 Go standalone | 0,0382 €/h ×730 | 27,89 |
| Volume DB 50 Go 5K | 0,0993 €/Go/mois ×50 | 4,97 |
| Volume VM 100 Go 5K (boot+persistants) | 0,000130 €/Go/h ×100×730 | 9,49 |
| Snapshots/backups 100 Go conservés | 0,03 €/Go/mois ×100 | 3,00 |
| Object Storage Multi-AZ 100 Go moyens | 0,01606 €/Go/mois ×100 | 1,61 |
| Secrets 20 versions | 0,04 €/version/mois ×20 | 0,80 |
| **Sous-total hypothétique** | Arrondi par ligne | **79,03** |

Ajouter IPv4, accès secrets, trafic/transferts, métriques et variations volumes :
**enveloppe 85–110 €/mois HT**, non devis ni consommation constatée. IA séparée,
plafond 30 €/mois sans client ; aucune utilisation payante autorisée par ce dossier.
Pas de HA, prestataire ou SLA pour cette option synthétique.

## B — scénario commercial prudent, non qualifié

| Poste | Hypothèse | EUR/mois HT |
|---|---|---:|
| VM PRO2-XS 16 Go | 0,1122 €/h ×730 | 81,91 |
| PG DB-PRO2-XXS HA | (0,11+0,0583)€/h ×730 | 122,86 |
| Volumes/snapshots/objets/secrets | Hypothèses précédentes, volume DB minimum seulement | 19,87 |
| **Sous-total** | Réplication stockage à confirmer au devis | **224,64** |

Enveloppe **230–300 €/mois HT**, hors IA, TVA, support/astreinte, licence Inngest
commerciale éventuelle, solution Keycloak OTP, machine/DB temporaire de restauration
et croissance. Aucune capacité/HA interzone/RPO/RTO n’est prouvée par ce SKU.
L’option HA n’est pas une garantie que l’AZ survivra ; exports Multi-AZ et reprise
hors zone restent nécessaires. Le minimum prudence peut être plus élevé après QA.

Alternative basse capacité non sélectionnée commercialement : DB-PLAY2-NANO HA
(0,0432+0,0376)×730 =58,98 €/mois ; sous-total160,76€, enveloppe170–210 € HT,
mêmes exclusions et compatibilité/charge à qualifier. Ne pas prétendre conformité
pour rentrer dans 150 €. Aucun cluster Kubernetes ni réplica applicatif permanent
ne sont ajoutés à ce chiffrage.

## Volumes, autres coûts et conditions

100 Go de backup est une **occupation moyenne conservée**, pas une taille de
base ou une garantie. Hypothèse horaire48 h + quotidien 30 j : sans déduplication,
occupation ≈ (48+30)×taille compressée d’un jeu complet, plus versions/manifests.
Pour un jeu5 Go cela donne390 Go et non100 Go. Retention native snapshot différente
à compter séparément. Prix objets0,01606×occupationGo/mois, snapshots0,03×Go/mois ;
Object Lock journal versionné augmente les versions facturées ; retention par objet
35 j journal,48 h horaire et30 j quotidien, pas lock30 j appliqué à tous les dumps horaires.
Transfert et téléchargements à ajouter suivant consommations/tarifs au devis.
Clés supplémentaires facturées par version ; accès secrets0,03 €/10000accès.
IPv4 publique et standby/storage réellement facturés à figer avant acquisition.
QA fournisseur et restore peuvent être temporaires mais sont des coûts distincts.

5 €/agence/mois IA et 30 € plateforme sont des plafonds indicatifs avec suspension,
pas quantité garantie ni prix de vente. Tarifs listés Mistral : Small 4
0,15/0,60 USD par million tokens entrée/sortie, OCR 4.1 4 USD/1000 pages sans
annotation. RouteEU annonce +10 % ; conversion EUR/USD et taxes à calculer
à réservation, aucun taux de change inventé ici. Faible budget peut réduire
les traitements et impose mode manuel, pas dépassement automatique.

Avant commerce : calcul réel volumes/tokens/agences, région/SKU/quotas, prix
actuels et devis, licence/support, coûts QA/restore/observabilité, performance
G05 et PRA conformes, puis accord propriétaire si plafond indicatif dépassé.
Aucune vente viable ni rentabilité n’est déduite de ce tableau.

## Sources primaires

- [Scaleway VM](https://www.scaleway.com/en/pricing/virtual-instances/)
- [Scaleway Managed DB](https://www.scaleway.com/en/pricing/managed-databases/)
- [Scaleway Storage](https://www.scaleway.com/en/pricing/storage/)
- [Object Lock](https://www.scaleway.com/en/docs/object-storage/how-to/use-object-lock/) et [coût des versions](https://www.scaleway.com/en/docs/object-storage/how-to/create-a-bucket/)
- [Secret Manager](https://www.scaleway.com/en/pricing/security-and-account/)
- [Facturation IP](https://www.scaleway.com/en/docs/ipam/reference-content/understanding-ip-billing/)
- [Mistral prix](https://docs.mistral.ai/inference/pricing) et [EU](https://docs.mistral.ai/inference/regional-inference)

Les pages VM/DB peuvent être trop volumineuses pour le lecteur web ; le relevé
spécialisé de cette mission a lu les tarifs officiels, sans API authentifiée.
Prix publics indicatifs, pas tests matériels, réservation ou devis fournisseur.
