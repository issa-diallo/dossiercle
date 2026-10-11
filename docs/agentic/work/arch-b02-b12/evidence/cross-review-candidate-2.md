# Revue croisée 2 — corrections POC et ADR-005

Date : 2026-10-11. Verdict de ce volet documentaire : **PASS**. Aucun Critical/Major/Minor ouvert dans les corrections relues. Architecture reste **BLOCKED** ; ce PASS ne qualifie ni B07/B12 ni Inngest/network/PRA et n’accorde aucune autorisation d’installation ou de dépense.

Candidat gelé `6f6d24c859a308e398f08da04f25ca9b8b5e087278a5f0915806f6590b67d87c`, manifeste `/tmp/dossiercle-arch-candidate2.json`. Les SHA-256 des 32 fichiers ont été recomparés aux fichiers du worktree : aucune divergence. Revue en lecture seule ; seul ce rapport est écrit dans /tmp. Aucun test runtime/cloud.

## Findings précédents clôturés

- **CR-01 Major — CLOSED.** `ARCHITECTURE_POC_PROPOSAL.md:65` distingue l’échec fonctionnel sans critère d’arrêt des arrêts sécurité/réseau/dépense/plafond. La continuation indépendante exige périmètre/mandat/budgets cumulatifs déjà approuvés. Tout arrêt termine l’essai, exige nettoyage/rapport/correction et nouvelle autorisation avant reprise ; aucun téléchargement/processus nouveau ni remise à zéro du budget après arrêt. La règle couvre B12 aussi.
- **CR-02 Minor — CLOSED.** `ADR-005:9–11` introduit un addendum technique d’autorité courante : ancien corps brut non universel, adaptateur SDK exact/canonicalisation/méthodes, aucun HMAC maison, sync non authentifiée refusée et signature distincte d’autorisation métier. Le texte historique est explicitement délimité et une autre famille fournisseur peut conserver son contrat raw body. Inngest reste PROPOSED, qualification B02/B04 future.
- **CR-03 Minor — CLOSED.** POC lignes 59/61 ajoutent refus du mauvais mot de passe sans énumération ; régénération codes après session fraîche/TOTP, invalidation atomique de tous anciens codes et absence de valeurs dans logs.

## Absence de régression dans le périmètre relu

Le POC maintient Q4 complet, versions candidates non adoptées, plafond 2 h de tentative sans promesse de PASS, propositions de total 6 h/8 h à approuver, plafond réseau cumulatif mesuré et coût limité à zéro dépense externe. Sources/manifestes/allowlists préalables, runtime local sans Internet/fournisseur/cloud, nettoyage ciblé et reviewer indépendant restent exigés. PASS phase A ne vaut pas PASS B12 ; charges/PRA/promotion cloud et production restent Verify futures.

L’addendum ADR-005 ne change pas SSPL/licence, moteur ou stack. Il ne prouve pas signature/runtime/rotation. Il corrige uniquement le contrat technique historique et conserve PROPOSED/BLOCKED.

## Limites de cette revue

Cette relecture porte sur corrections POC/ADR-005. Les autres fichiers changés dans le second candidat sont couverts par reviewer global et vérifications root ; leur intégrité a été contrôlée ici, pas leur contenu réapprouvé intégralement. Mes contributions `ARCHITECTURE_PROTOCOL_PROPOSAL.md` et `ARCHITECTURE_REMEDIATION.md` restent exclues de toute auto-approbation. B09/B11 conservent leur gate humain et Architecture son gate global.
