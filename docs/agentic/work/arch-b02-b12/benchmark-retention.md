# Décision proposée — conservation et fournisseurs IA

Date : **2026-10-11**. Sources publiques primaires relues. **Propositions pour arbitrage, aucune adoption ni autorisation de données réelles.** Aucun POC, runtime, compte, contact fournisseur ou dépense. D62/D63/ADR014 restent l’autorité : pas de copie durable des originaux reçus/envoyés ou pièces dans DossierClé, dérivés minimisés, provenance descriptive sans lien ; export CSV/JSON dérivé seulement.

## Décision courte recommandée

1. **GO pour arrêter la politique ci-dessous comme contrat de conception.** Les durées sont des plafonds par finalité, pas une permission de tout garder jusque-là. Supprimer plus tôt si la donnée n’est plus nécessaire. Pas de durée métier universelle de deux, trois ou cinq ans. Les originaux et obligations documentaires de l’agence restent dans sa messagerie/son système d’archives ; DossierClé n’en devient pas l’archive réglementaire.
2. **NO GO Scaleway Generative APIs serverless pour envoyer des données réelles sous la contrainte “aucune rétention de contenu fournisseur après réponse” ou “24 h maximum partout”.** La documentation autorise deux semaines de contenu HTTP dans certains incidents/abus. Une configuration locale n’annule pas cette exception. Ni un modèle différent sur cette API ni une offre dédiée, seule, ne prouvent sa suppression.
3. **Alternative prioritaire à instruire : Mistral stateless avec ZDR réellement activé, entraînement désactivé et région contractuellement compatible.** **NO GO réel aujourd’hui**, faute de preuves de compte/contrat et de périmètre UE strict. Alternative si ces conditions échouent : inférence privée auto-hébergée en France avec modèle open-weight à licence qualifiée, ou traitement humain sans IA. Aucun fallback automatique vers un fournisseur non conforme.

Le GO documentaire permet de préparer les stories avec ces invariants. Le GO d’exploitation nécessite contrats et configurations vérifiables, puis les preuves des stories avant mise en service. STOP POC demeure applicable ; les vérifications futures ne sont pas lancées par cette note.

## Principes officiels à appliquer

Le RGPD borne les données à la finalité et à leur nécessité ; rectification, limitation et effacement restent applicables aux dérivés identifiants. Une durée doit être fixée en amont et l’archive intermédiaire séparée de l’usage courant. [RGPD, principes CNIL](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre2), [cycle de vie CNIL](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees), [droits CNIL](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3).

Le référentiel gestion locative propose, selon finalité, trois mois pour l’appréciation de solvabilité, conservation active pendant le bail et jusqu’à clôture des comptes, puis archives pertinentes généralement trois ou cinq ans selon gestion et responsabilités. Il ne prescrit pas cinq ans pour tout. DossierClé exclut l’évaluation de solvabilité ; sa politique de suivi ne doit pas réintroduire cette finalité. Les pièces de préavis/fin de solidarité demandent une minimisation spécifique, parfois seulement jusqu’à validation. Les exemples CNIL et exceptions contentieuses ne dispensent pas de justifier chaque conservation. [Référentiel CNIL, §8, pages 9–10](https://www.cnil.fr/sites/default/files/atoms/files/referentiel_relatif_aux_traitements_de_donnees_personnelles_mis_en_oeuvre_dans_le_cadre_de_la_gestion_locative.pdf).

## Politique chiffrée proposée

| Données / finalité | Durée et déclencheur proposés | Restriction indispensable |
|---|---|---|
| Original email/pièce de travail, AV/quarantaine, extraction et sortie IA brute | Purge dès fin du traitement ou abandon ; **24 h maximum depuis première acquisition**, erreur/quarantaine/retry compris | Hors PG, backups, journaux, outbox durable et fichiers de diagnostic. Pas de renouvellement du TTL par retry ; échec d’extraction visible, travail humain dans messagerie |
| Buffers/prefixes/KV cache applicatifs d’inférence | Durée de requête uniquement ; aucun cache contenu persistant | Cache fournisseur distinct soumis contrat ; pas de promesse d’effacement que nous ne contrôlons pas |
| Archive export dérivée CSV/JSON | **24 h depuis génération**, acquis D63/D44 | Privée, droits relus au téléchargement, aucun original/EML encodé ou caché ; ancienne archive expirée ne revit pas par restore |
| Rapport/synthèse générée consultable | **90 jours depuis génération de chaque version**, sans prolongation par consultation, pour consultation opérationnelle ; supprimer plus tôt sur droit/finalité | Conserver l’artefact dérivé, révision et hash pendant sa durée, avec états/provenance livraison ; aucune archive SMTP/EML. Les faits nécessaires au dossier suivent leur propre durée |
| Dérivés Sinistres : faits, résumé court, tâches et provenance | Jusqu’à clôture effective ; **90 jours après clôture** pour suivi/corrections, puis suppression ou anonymisation réelle | Réouverture justifiée ne conserve pas indéfiniment un dossier mort. Archive probatoire seulement pour éléments nécessaires et justification spécifique, pas une prescription d’assurance inventée |
| Dérivés Location : candidat non retenu/retiré, suivi de complétude | Jusqu’à décision/abandon ; **90 jours maximum après clôture**, purge antérieure si inutile | Proposition interne de suivi, pas reprise d’une règle de solvabilité. Aucun classement/évaluation financière |
| Dérivés Location : locataire retenu et dossier encore nécessaire à gestion | Jusqu’à fin du bail **et clôture des comptes** si finalité de gestion confiée ; éléments non nécessaires supprimés avant | Hors simple collecte ponctuelle, ne pas imposer cette durée à tous les dossiers. L’agence précise son mandat et ses finalités |
| Archive intermédiaire métier/probatoire sélectionnée | **3 ou 5 ans** selon catégorie, finalité et responsabilités effectives ; la gestion semi-déléguée dépend de la répartition des tâches, depuis événement de fin pertinent ; uniquement si nécessité documentée | Pas d’archive automatique de toute synthèse. Accès dédié restreint, aucun usage IA/prospection. Pour Sinistres ou autre litige, durée justifiée séparément ; aucun cinq ans universel |
| Audit d’accès/action/sécurité : qui, quand, quoi, référence opaque, refus/validation | **6 mois glissants** par défaut | Aucun contenu, email, prompt, secret, cookie ou hash de mot de passe. Prolongation ciblée d’un incident/contentieux avec nouvelle finalité, responsable et date de fin |
| Diagnostic technique non sensible : latence, codes, corrélation opaque | **30 jours** | Les événements nécessaires à sécurité restent dans l’audit six mois ; ces traces ne remplacent pas l’audit. Agrégation réellement anonymisée possible, simple ID pseudonyme ne suffit pas |
| Historique de correction des faits | Valeur actuelle et provenance tant que fait nécessaire ; anciennes valeurs **30 jours** pour correction, puis métadonnée minimale de correction dans l’audit | Ancienne donnée fausse/sensible non figée dans un journal permanent ; contestation suspend l’usage et recalcule synthèses/actions concernées |
| Backups dérivés/identités, snapshots et copies de reprise | **30 jours maximum d’âge**, toutes copies/snapshots/final-backups inclus ; PITR **7 jours** proposé dans D59 Enterprise | Aucun original temporaire dans sauvegarde. Backups non consultables en exploitation ; rotation mesurée, suppression à expiration, restore fermé puis réapplication des suppressions/revocations |
| Tombstones / refus / générations indispensables au restore | Pendant **tout horizon réellement restaurable + marge 5 jours**, minimum proposé **35 jours** si toutes copies sont bornées à 30 jours | Hors ensemble restaurable, contenu minimal. Ne jamais expirer après 35 jours si une ancienne copie/import existe encore ; restaurations plus anciennes doivent être impossibles ou rester fermées |

Les valeurs nouvelles sont des **recommandations non adoptées**, sauf export 24 h acquis. L’audit six mois suit le bas de la recommandation CNIL six mois à un an, sans transformer une recommandation en obligation uniforme. [CNIL, tracer les opérations](https://www.cnil.fr/fr/securite-tracer-les-operations).

**Point Cloud SQL :** D59 adopte Enterprise, pas Enterprise Plus. La documentation borne les journaux PITR Enterprise à 1–7 jours ; 30 jours de backups ne signifient pas 30 jours de PITR. Conserver 30 jours de backups est une proposition de cycle de reprise à configurer/chiffrer, sans changer silencieusement l’édition. [Google, restauration/PITR PostgreSQL](https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/restore?hl=en).

## Suppression, exactitude et fin d’abonnement

Proposition opérationnelle : dès demande recevable/instruction agence, bloquer utilisation et nouveaux effets ; cible interne de suppression live **24 h après validation**, sans prétendre que le RGPD fixe ce délai. Le traitement des droits respecte délais et exceptions du RGPD ; nécessité légale/contentieuse justifiée peut limiter l’effacement, avec accès restreint et information, pas conservation générale.

Effacement couvre PG dérivés, recherche, caches, jobs, sorties temporaires/export, traces contenant une référence devenue inutile et sous-traitants concernés. Il faut distinguer suppression live et disparition physique des backups à rotation : ne pas promettre effacement immédiat de chaque WAL/snapshot. Aucune donnée effacée ne redevient accessible après restore ; appliquer tombstones, droits/révocations et corrections avant toute réouverture. Échec du journal fiable = restore fermé.

À fin abonnement, fenêtre export admin **30 jours acquise D42**, aucun accès mail/IA rétabli. Proposer suppression live des données métier au terme de cette fenêtre, puis disparition des dernières copies backup au plus tard **30 jours supplémentaires** ; traces de sécurité nécessaires jusqu’à leur expiration propre. Des obligations de conservation de l’agence ne justifient pas de garder ses archives chez le SaaS après fin du service sans base/contrat spécifique. Les originaux de sa messagerie ne sont jamais supprimés par DossierClé.

Version des faits : distinguer extraction proposée, confirmé, contesté, corrigé, obsolète et source perdue. Garder référence descriptive et date de vérification, pas full email “pour preuve”. Une correction invalide les synthèses/actions dépendantes ; faits essentiels contestés bloquent l’action concernée. Cela respecte l’exactitude sans réintroduire archive originale ou historique infini.

## GO / NO GO fournisseurs et alternatives

### Scaleway Generative APIs serverless — NO GO sous l’invariant strict

Scaleway annonce absence d’entraînement, usage agrégé/anonymisé jusqu’à six mois et cache éphémère intermédiaire automatique, isolé par projet, non désactivable. Il peut garder/accesser le HTTP complet jusqu’à deux semaines pour erreurs/abus. L’offre dédiée est recommandée pour isolation supplémentaire ; la page ne garantit pas suppression de cette exception ou TTL de cache conforme à notre plafond. Changer de modèle ou pseudonymiser ne garantit pas anonymisation d’un dossier immobilier. [Privacy officielle Scaleway](https://www.scaleway.com/en/docs/generative-apis/reference-content/data-privacy/), [FAQ dédiés/cache](https://www.scaleway.com/en/docs/generative-apis/faq/).

**Condition de réexamen :** contrat de la variante exacte excluant stockage de contenu après réponse/incident et bornant caches, sous-traitants/région/support ; en absence de cette preuve, ne pas router de données réelles. Ce verdict vise ce traitement/service, pas l’hébergement Scaleway dans son ensemble.

### Mistral API stateless ZDR — alternative conditionnelle, NO GO d’exploitation actuel

ZDR exige pay-as-you-go, demande approuvée et confirmation dans Admin Privacy. Il couvre notamment chat completions et OCR ; pas agents, conversations, batch/files ou libraries. ZDR et training opt-out sont distincts. La preuve du compte cible est obligatoire, y compris BYOK ; la clé seule ne suffit pas. [Mistral, activation ZDR](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr), [doc ZDR](https://docs.mistral.ai/admin/monitor-comply/zero-data-retention).

Cette alternative demande de modifier explicitement la décision d’hébergement IA/ADR008 ; elle n’est pas un fallback déjà adopté. Configurer uniquement endpoints stateless, sans upload `/v1/files`, feedback thumbs up/down ou observabilité contenant contenu ; opt-out entraînement vérifié séparément. Le DPA décrit des finalités propres fournisseur et l’usage de feedback associé : contrat applicable et sous-traitants doivent être revus. [DPA Mistral, §2.3](https://legal.mistral.ai/terms/data-processing-addendum/). La privacy publique décrit 30 jours d’input/output sans ZDR ; elle précise toutefois ne pas régir le traitement business : elle n’est pas un substitut au DPA/contrat cible. [Privacy Mistral](https://legal.mistral.ai/terms/privacy-policy/).

`api.eu.mistral.ai` couvre **UE et EFTA** ; le control plane/usage/compte peuvent être traités ailleurs. **Si “UE uniquement pour toute donnée personnelle” est strict, cet endpoint public ne suffit pas : NO GO sans engagement supplémentaire.** Si seule l’inférence est ciblée et UE+EFTA expressément acceptable, le propriétaire doit préciser cette portée ; aucune détente implicite. Modèle/OCR exact disponible dans la région et contrat à vérifier, sans benchmark inventé. [Mistral, inférence régionale](https://docs.mistral.ai/inference/regional-inference).

### Si Mistral ne satisfait pas la contrainte : inférence privée ou humain

Option à comparer : modèle open-weight Qwen/Mistral sous licence adéquate, serveur d’inférence privé en France, réseau maîtrisé et aucun log de contenu, caches RAM bornés et buffers purgés. Mistral documente le self-hosting de modèles ouverts ; cela change exploitation/coûts et ne prouve ni capacité ni qualité. Aucun modèle exact, GPU, coût ou runtime adopté ici. [Mistral, options d’inférence/self-hosting](https://mistral.ai/products/ai-cloud/inference/).

Option immédiate sans fournisseur IA : collecte email limitée et suivi préparés par l’humain, sans transmettre contenu à une API incompatible. Cela peut permettre les fonctions manuelles conformes ; ce n’est pas un GO pour l’autonomie IA annoncée. Un proxy/cache local ou une instance Generative dédiée ne sont pas des garanties de ZDR amont.

## Preuves avant données réelles et décisions à donner

**Choisir la politique chiffrée**, avec matrice finalités agence/SaaS et archive sélectionnée ; **confirmer le périmètre exact “UE” et zéro rétention contenu fournisseur** ; **retenir la voie Mistral conditionnelle ou privée**. Pas besoin de POC pour constater l’écart documentaire Scaleway.

Avant GO réel : accord sous-traitance article 28, chaîne de sous-traitants/transferts/support, réglages ZDR/entraînement de l’organisation cible, services exclus explicites, durées/caches/backup versions documentées, purge/restore/droits testés dans les stories, information des personnes et responsables affectés. Le DPA Mistral mentionne “special categories: none” : données santé/violences/pénales ou autres sensibles découvertes dans email doivent être exclues/traitées humainement tant que base/contrat appropriés ne sont pas établis. Ce n’est pas une attestation de conformité ni un jugement d’illégalité générale d’un fournisseur.

Dossier source repo lu : D62/D63/D59/D42/D44, ADR014, PRD données/reprise, dossier remediation. Les anciens nombres ouverts ne sont pas devenus décisions par cette note. Aucune modification canonique/worktree.
