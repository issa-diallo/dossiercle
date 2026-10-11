# Arbitrage hébergement, Inngest, MFA et conservation

> **Décision humaine ultérieure D72 :** Keycloak et Mistral désormais adoptés, Inngest conservé. Les verdicts documentaires ci-dessous restent la preuve des réserves, mais les mentions de choix non adopté sont historiques. [D72](../../../product/ARCHITECTURE_DECISIONS.md#d72). Design System ne doit pas démarrer maintenant.

Date : 2026-10-11. Mode LARGE. Recherche documentaire sur sources officielles et code versionné ; aucune mesure de performance, dépense, compte, contact fournisseur ou reprise de POC. Mandat : comparer, recommander GO/NO GO et proposer un remplacement quand nécessaire. D71 conserve la stack approuvée tant qu'un changement n'est pas validé.

## Verdicts et choix recommandés

| Bloc | Verdict documentaire | Proposition concrète | Condition restante |
|---|---|---|---|
| Hébergement / réseau | GO pour ce chemin de conception | API Nest sur Serverless Containers/Private Network ; Inngest sur Instances actif/secours inter-AZ Paris ; Cloud SQL 17 Enterprise HA Paris conservé ; IPsec/IKEv2 + BGP vers GCP, PostgreSQL sans IP publique | Dimensionnement, routes/HA, IAM/rotation, coût et reprise à préciser ; capacités documentées ne sont pas mesures |
| Jobs / licence | Conserver Inngest ; GO technique conditionnel, avis licence non définitif | Self-hosted Scaleway, PG/Redis externes ; moteur interne uniquement, interfaces moteur privées | SSPL clause 13 et usage concret à qualifier ; exception runtime persistant et identité à acter ; ne pas assimiler SSPL à Apache 2.0 actuel ni affirmer que tout SaaS est interdit |
| MFA | NO GO du mécanisme natif Better Auth 1.7.7 sous nos exigences | Keycloak 26.8.0 candidat prioritaire en remplacement, backend OIDC+PKCE, cookie application opaque | Codes hashés confirmés ; protection TOTP selon D54 NON résolue. Donc aucun GO complet Keycloak ni changement tacite de stack |
| Conservation locale | GO de conception pour la politique recommandée | Temporaires purge dès fin, maximum 24 h ; export 24 h acquis ; audit 6 mois ; diagnostic30j ; backups 30 j ; PITR 7 j ; durées métier par finalité | Adoption documentaire proposée ; configurations et purge/restore seront prouvées dans les stories, pas un nouveau POC |
| Fournisseur IA | NO GO Scaleway GenAPI sous la politique stricte proposée | Mistral stateless ZDR prioritaire ; sinon inférence privée France ou traitement humain | Preuve ZDR compte, entraînement désactivé et région/contrat compatibles avant réel ; UE+EFTA ne signifie pas UE uniquement |

**GO de conception** signifie option documentée compatible dans les limites indiquées. Ce n'est ni une attestation de licence/conformité, ni une autorisation de production. Les NO GO sont limités au mécanisme et aux exigences examinés. Les remplacements proposés exigent la validation de l'ADR suivant les règles du dépôt.

## Comparatif et sources

- Hébergement / licence : [étude détaillée](benchmark-infra-licence.md), [ADR017](../../../adr/017-hebergement-reseau-prive.md), [ADR018](../../../adr/018-licence-usage-inngest.md).
- MFA : [comparatif de cinq outils et code immutable](benchmark-mfa.md), [ADR019](../../../adr/019-alternative-mfa-keycloak.md). Authentik et Kratos stockent les secours en brut dans les versions examinées ; ZITADEL chiffre TOTP et hashe les secours mais présente une réserve de concurrence dans sa source. Aucun remplaçant pleinement conforme n'est établi aujourd'hui.
- Données / IA : [politique complète, finalités et fournisseurs](benchmark-retention.md), [ADR020](../../../adr/020-conservation-finalites.md), [ADR021](../../../adr/021-ia-retention-fournisseur.md). Les24h sont un plafond proposé pour nos copies, pas une durée légale universelle ni une exigence historique déjà adoptée pour tout fournisseur. Le NO GO Scaleway GenAPI dépend de l'adoption de cette contrainte stricte ; D62 interdit déjà les originaux durables, mais ne fixait pas ce plafond.

## Politique retenue pour proposition

DossierClé garde les faits utiles ; les originaux restent dans la messagerie de l'agence. Les temporaires n'entrent pas dans PG, les backups, jobs durables ou logs. Retry ne renouvelle pas les24h. Rapports consultables 90 jours depuis génération de chaque version, sans renouvellement par consultation ; dossiers Sinistres et candidats non retenus : fin de finalité puis90j maximum, purge plus tôt si inutile. Gestion effective d'un bail : fin du bail et clôture des comptes pour les seuls faits nécessaires. Archive probatoire sélectionnée uniquement si nécessité documentée, selon finalité et responsabilité ; jamais une copie générale de tous les dossiers pendant cinq ans.

Suppression live cible24h après validation de la demande, puis expiration des backups sous30j ; ce délai interne ne remplace pas les délais légaux des droits. Fin d'abonnement : fenêtre export30j acquise, puis suppression live ; dernières copies30j plus tard au maximum. Journal de suppressions/révocations hors rollback, minimal, au moins horizon restaurable+5j ; minimum35j uniquement si aucune copie restaurable dépasse30j. Restore fermé jusqu'à réapplication des suppressions et droits. PITR Enterprise7j et backups 30 j sont distincts.

## Avancement et décision attendue

Le dossier remplace les demandes vagues par des options, verdicts et conséquences. La stack D71 demeure la référence ; aucune substitution MFA/IA ou détente D54 n'est adoptée. Les ADR017–021 sont PROPOSED. Une validation globale ne doit pas masquer les réserves TOTP, licence ou contrats. Architecture reste BLOCKED sur ces décisions critiques et les autres dépendances recensées ; Design System reste en brouillon, aucune story en Execute.

Suite : valider les choix documentaires compatibles ; résoudre le contrat de protection TOTP avant choix définitif d'IdP ; arrêter la voie IA compatible et qualifier les conditions contractuelles/licence. Les preuves runtime appartiennent aux futurs Execute/Verify autorisés ; le STOP POC reste applicable.

## Revue indépendante et preuves documentaires

PASS documentaire ciblé des deux reviewers, aucun finding ouvert après corrections : [infra/conservation/IA](evidence/arbitrage-review-auth.md) et [MFA/Inngest/statuts](evidence/arbitrage-review-privacy.md). Chaque reviewer exclut sa propre recherche des conclusions qu’il approuve. Les reviews ne sont ni décisions humaines ni qualifications runtime/contrat. Contrôles de structure et limites : [Verify](verify.md).
