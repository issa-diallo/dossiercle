# Revue indépendante — hébergement, conservation et IA

Date :2026-10-11. Lecture seule des artefacts root : arbitrage-go-no-go.md, benchmark-retention.md, ADR017/020/021, pointeurs Architecture/STATUS. Le benchmark MFA écrit par ce reviewer n’est pas relu ni approuvé dans cette revue. Sources primaires externes ciblées relues ; aucun POC, runtime, compte ou appel fournisseur avec données.

## Verdict

**BLOCKED pour complétude documentaire tant que le lien infra manque ; fond conservation/IA PASS avec deux Minor.** Aucun Critical. L’intégration du benchmark infra est attendue séparément ; son contenu n’est pas qualifié par cette revue. Aucune approbation de stack alternative, licence, contrat ou exploitation n’est attribuée à l’utilisateur.

## Findings

### Major AR01 — annexe infra absente à la lecture

`arbitrage-go-no-go.md` référence `benchmark-infra-licence.md`, absent au moment de lecture. ADR017 renvoie au détail infra pour runtime et HA. Le GO réseau n’est donc pas entièrement reviewable à travers le dossier actuel. Ajouter l’étude attendue et son lien existant ; relecture indépendante infra séparée nécessaire. Ce finding est un défaut d’intégration documentaire provisoire, pas un NO GO technique ni une demande de POC.

### Minor AR02 — durées CNIL semi-déléguées

`benchmark-retention.md` tableau archive : «3ans gestion directe ou5ans déléguée/semi-déléguée» simplifie deux catégories du référentiel. §8.1 distingue données du candidat retenu (3ans directe/5ans déléguée ou semi-déléguée) et données collectées pendant le bail (3ou5ans en semi-déléguée selon répartition des tâches). Le texte dit «selon responsabilités», mais ne montre pas cette bifurcation. Proposition : «3ou5ans selon catégorie de données, gestion directe/déléguée et répartition des tâches en semi-déléguée ; justification sélectionnée par finalité». Conserver plafonds et aucune conservation globale. [CNIL §8.1, page11 imprimée/page PDF10](https://www.cnil.fr/sites/default/files/atoms/files/referentiel_relatif_aux_traitements_de_donnees_personnelles_mis_en_oeuvre_dans_le_cadre_de_la_gestion_locative.pdf).

### Minor AR03 — point de départ rapports

«90jours glissants» ne précise pas création/livraison ou dernière consultation. Une consultation ne devrait pas prolonger indéfiniment le plafond proposé. Préciser90jours depuis génération de chaque version dérivée (ou autre événement explicite choisi), sans renouvellement par consultation ; les faits nécessaires au dossier restent distincts. Ce point évite une mise en œuvre permissive, sans modifier une exigence historique puisqu’il s’agit de la proposition nouvelle.

## Constats positifs vérifiés

- Tous les nouveaux ADR sont PROPOSED. D71 et STOP POC restent applicables ; Architecture BLOCKED et Design System draft. GO conception n’est pas GO production ; NO GO Scaleway dépend explicitement de l’adoption d’une nouvelle politique fournisseur stricte, pas présenté comme décision historique ni illégalité générale.
- D62/D63 restent préservées : originaux reçus/envoyés hors PG/backups/jobs/logs, export dérivé24h, pas lien d’accès original, aucun archiveSMTP/EML. Nouveau plafond temporaire24h non adopté, retry ne réinitialise pas ; purge dès fin, quarantaine/erreur bornées.
- Politique par finalité, données minimisées, sauvegardes et live séparés ; extinction30j des copies bornée à toutes copies/snapshots/final-backups ; tombstones horizon réel+5j, pas35j universels si archive plus ancienne ; restore fermé tant que suppressions/révocations non réappliquées.
- D59 Enterprise et PITR sont distingués des backups30j : source Google confirme configuration1–7j Enterprise, pas30j de PITR. [Google restauration](https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/restore?hl=en).
- Source Scaleway confirme cache intermédiaire automatique par projet/non désactivable et contenu HTTP conservable2semaines sur incidents/abus ; anonymisés agrégés6mois distincts. Une variante dédiée ne donne pas à elle seule exemption contractuelle ni ZDR. [Privacy Scaleway](https://www.scaleway.com/en/docs/generative-apis/reference-content/data-privacy/), [FAQ cache](https://www.scaleway.com/en/docs/generative-apis/faq/).
- Mistral : docs confirment approbation ZDR du compte, stateless chat/OCR couverts, Labs exclus et APIs stateful/files hors couverture ; entraînement distinct. RégionEU inclutEFTA et control-plane non intégralement régional. Le dossier maintient NO GO exploitation tant que preuve d’organisation/contrat/région manque, y compris BYOK ; pas fallback automatique. [ZDR](https://docs.mistral.ai/admin/monitor-comply/zero-data-retention), [activation](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr), [régions](https://docs.mistral.ai/inference/regional-inference).
- DPA Mistral liste special categories:none, correctement traité comme limite à résoudre avant traitement sensible, sans prétendre attestation juridique générale. [DPA](https://legal.mistral.ai/terms/data-processing-addendum/).
- ADR021 renvoie changement explicite d’ADR008 ; Mistral/privateFrance/humain restent propositions, pas remplacement adopté ni fausse autonomie IA du mode manuel.

## Limites

Revue documentaire ciblée, aucune vérification runtime/purge/restore/réseau ni preuve de compte ZDR. Aucun avis juridique définitif licence/RGPD. Détail infra et licence confié à reviewer séparé ; ce rapport n’approuve pas un chemin VPN/PSA particulier. Les résultats doivent être reportés au gel final et au périmètre exact de ses sources, sans attribuer un PASS humain aux propositions.

## Addendum final — corrections et intégration infra

**Verdict final : PASS documentaire ciblé, zéro Critical/Major/Minor ouvert.** Ce verdict remplace le BLOCKED provisoire de complétude ci-dessus ; il ne constitue pas Architecture PASS humain ni GO production.

AR01 résolu : benchmark-infra-licence.md désormais présent et relu en entier ; ADR017 reprend API Serverless PN, Inngest actif/secours deuxAZ, Redis externe sauvegardé, identité et coûts encore ouverts. AR02 résolu : archive3ou5ans selon catégorie/finalité/responsabilités, semi-déléguée selon répartition des tâches. AR03 résolu dans benchmark-retention et arbitrage : rapports90jours depuis génération de chaque version, aucune prolongation par consultation.

Extension de revue indépendante infra :

- Source Scaleway actuelle confirme routes VPC personnalisées et endpoint privé activable pour ingress PN ; attach PN seul ne coupe pas endpoint public. La conception exige callbacks/admin/metrics privés et politiques egress, sans prétendre isolation automatique. Lors de la préparation des stories, montrer explicitement comment le chemin callbacks est inaccessible sur l’interface API publique (endpoint privé dédié ou règle ingress supportée), pas simplement une autre URL du même handler public. Ce détail est un critère de conception restant, pas une incompatibilité documentée. [Containers PN](https://www.scaleway.com/en/docs/serverless-containers/reference-content/containers-private-networks/).
- Scaleway documente IKE/BGP et passerelles redondantes interAZ ; Google CloudSQL documente VPN externe, annonces explicites plage allouée et export custom routes du peering. La topologie proposée couvre ces conditions ; AuthProxy n’est pas prétendu créer le réseau. [VPN Scaleway](https://www.scaleway.com/en/docs/site-to-site-vpn/reference-content/understanding-s2svpn/), [Google privateIP externe](https://docs.cloud.google.com/sql/docs/postgres/configure-private-ip).
- Inngest self-host source primaire confirme PG/Redis externes, absence purge PostgreSQL automatique et support direct non garanti. La note ne confond pas serverless HTTP et serveur jobs persistant, ni active/secours avec active-active ou PRA mesuré. État temporaire et absence pause/stockage durable sont correctement distingués. [Inngest self-host](https://www.inngest.com/docs/self-hosting).
- Licence SSPLv1 du serveur exactv1.45.1 reste conditionnelle quant à usage commercial concret : clause13 pas limitée à console publique, ni interdiction universelle du SaaS, aucun avis légal définitif. Le passage Apache futur n’est pas présenté comme actuel. [Licence exacttag](https://github.com/inngest/inngest/blob/v1.45.1/LICENSE.md).
- Identité intercloud reste explicitement non résolue pour préférenceInstances/Serverless ; WIF exige émetteur/bootstrap vérifiés et pas clefless garanti. AlternativeKapsule ne prétend pas résoudre credentialsCSI. Backup Redis horaire ne qualifie pas cohérencePG/Redis/RPO métier ; perte région reste périmètre d’incident à arbitrer.
- Chiffrage présenté en composants illustratifs avec hypothèses730h et prixGoogleIowa nonParis confirmé ; aucun budgettotal/devise/SLA inventé. Les prix exacts et versionRedis ne sont pas qualifiés par ma revue ciblée : coûtParis/dimensionnement/licenceRedis demeurent critères ouverts avant exploitation.

Aucune mutation de repo, exécution ou compte. Le benchmark MFA n’a toujours pas été revu par son auteur dans ce rapport. Les éléments de conformité/contrats restent à résoudre selon le dossier ; PASS de revue signifie fidelité documentaire dans cette portée.
