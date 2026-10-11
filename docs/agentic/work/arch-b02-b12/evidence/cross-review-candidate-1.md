# Revue croisée indépendante — POC et cohérence infra

Date : 2026-10-11. Candidat gelé `577e372cbb8d960a05e1c0c3fb3fcdfd90f368fc220561128ddc88860bc4500b`, manifeste `/tmp/dossiercle-arch-candidate.json`, base `54967be6ff915822779230bae01ca5eec615f972`. Les SHA-256 des 32 fichiers du manifeste ont été recomparés aux octets du worktree : aucune divergence.

Portée : contribution auth `ARCHITECTURE_POC_PROPOSAL.md` comparée à Q4 original, cohérence canonique ARCHITECTURE/ADR-002/005/006/010 et gates. Exclusion : mes propres propositions PROTOCOL/REMEDIATION ne reçoivent aucune auto-approbation ; un autre reviewer est responsable de leur revue. Lecture seule du worktree. Écriture de ce rapport dans /tmp uniquement. Aucun POC/runtime/cloud exécuté.

## Verdict : BLOCKED pour rédaction du POC, correction limitée nécessaire

Un finding Major, deux Minor. Le statut Architecture reste BLOCKED indépendamment de cette revue. Aucun PASS B02/B03/B04/B07/B12 ni clôture humaine B09/B11 acquis. Une nouvelle comparaison sur le candidat corrigé est nécessaire ; ceci ne nécessite aucune exécution runtime.

## Finding CR-01 — Major — continuation après échec ambiguë

Fichier `docs/product/ARCHITECTURE_POC_PROPOSAL.md:47` : « Si une phase échoue, B07 demeure BLOCKED ; phases suivantes peuvent explorer des points indépendants ». Cette permission globale inclut littéralement les échecs que Q4 classe arrêt immédiat (fuite, accès imprévu, dépassement budget/quota, contournement MFA). La section Arrêts ligne 65 est restrictive mais les deux règles contradictoires laissent une continuation possible après déclenchement de safety/quota.

Correction demandée : distinguer échec de résultat fonctionnel et déclencheur d’arrêt. Toute fuite, contournement, réseau imprévu, résultat non reproductible ou dépassement de plafond impose arrêt, nettoyage ciblé et rapport ; reprise seulement après correction et nouvelle autorisation appropriée. Une exploration indépendante peut continuer uniquement sans critère d’arrêt et dans scope/budgets cumulatifs déjà approuvés. Aucun nouveau téléchargement ni fractionnement de plafond ne doit découler de cette phrase.

## Finding CR-02 — Minor — authenticité Inngest contradictoire dans ADR

Fichier `docs/adr/005-inngest-scaleway-conditionnel.md:71` conserve « Authentifier chaque callback sur corps brut ». L’Architecture courante ligne 440 prescrit signature selon canonicalisation du SDK/version épinglés, conformément à Q2. Il faut un addendum actuel dans ADR-005 distinguant callbacks fournisseur nécessitant raw body et callback Inngest validé par adaptateur officiel/JSON canonique, sans HMAC maison. Le texte ancien peut être conservé comme historique avec portée supersédée. Cette incohérence n’est pas une preuve de vulnérabilité runtime, puisqu’aucune intégration n’est installée.

## Finding CR-03 — Minor — résumés auth à rendre explicites

Fichier `docs/product/ARCHITECTURE_POC_PROPOSAL.md:41–45` résume Q4 en maintenant son gate intégral, mais deux critères importants ne sont pas visibles : mot de passe erroné refusé sans différence d’énumération ; régénération codes secours seulement après session fraîche + TOTP courant, avec invalidation atomique et absence de valeur dans logs. Ajouter ces critères ou une référence explicite aux critères mesurables Q4 afin qu’une exécution ne se limite pas aux résumés. Le gate intégral Q4 étant explicitement requis, il s’agit d’une amélioration de précision documentaire, pas d’une réduction déjà adoptée.

## Contrôles satisfaisants dans ce périmètre

- B07/B12 indispensables avant PASS, NON ADOPTÉS/NON EXÉCUTÉS ; aucune installation autorisée par le dossier.
- Plafond de tentative 2 h distingué des propositions de phasage total 6 h/8 h ; aucune promesse de clôture depuis environnement vierge. Phasage et revue supplémentaire restent à approuver.
- 0 EUR qualifié dépense externe uniquement ; aucun CPU/temps humain gratuit supposé. 2 Go cumulatifs, mesure/CDN/redirections, caches traçables et approbation des extensions : pas de taille exacte inventée.
- Préflight et quotas 4 CPU/8 GiB/15 GiB explicitement proposés, jamais capacité hôte présumée. Node 24 isolé, Node 22 ne constitue pas preuve du candidat Q4.
- Allowlist distribution navigateur/scanner/images distincte des registres ; runtime fixture sans Internet ni fournisseur/cloud. Manifeste versions/digests/checksums exigé ; outils externes candidats à revalider.
- Gate Q4 complet conservé : deux installations/builds/typechecks, auth+deux agences, MFA/idle/absolu/révocation/récupération, rate limits multi-processus ; Inngest/OTel/OpenAPI/PG/test/SBOM/scan et promotion/rollback simulés. PASS phase A ≠ PASS B12 ; livraisons cloud/charge/PRA clairement futures.
- Nettoyage limité aux ressources de l’essai ; aucune purge Docker globale ni outil utilisateur supprimé.
- Canonique : D59 Cloud SQL HA Paris/PITR/TLS conserve risque accepté, aucune connectivité inter-cloud ni coût prouvé ; SSPL et Inngest PROPOSED, Redis/rétention/PRA non qualifiés. D58 strict <4 h conservé ; HA PG seule ne prouve pas reprise globale.
- ADR-010 addendum marque export EML/originaux historique, export dérivé actuel ; auth et capacités restaurées réconciliées, sessions invalidées, tombstones/générations hors rollback restent obligations ouvertes.
- B09 qualification mémoire limitée et PENDING_HUMAN ; B11 consolidation/review/PENDING_HUMAN, aucune approbation automatique après preuves documentaires.

## Suite

Corriger CR-01 avant PASS de ce volet de review ; CR-02/03 recommandés dans le même gel documentaire. Regeler le manifeste, transmettre le nouveau hash, vérifier les lignes corrigées et l’intégrité. Les choix structurants/humains et essais non autorisés restent ouverts.
