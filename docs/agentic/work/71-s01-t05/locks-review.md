# Revue indépendante étapes1–4 et graphe T05

2026-10-15. Reviewer `/root/lock_reviewer`, distinct de l’implementer.
**PASS — Critical0/Major0/Minor0**, avis transmis par l’orchestrateur avant reprise5–8.
Build complet, unités87/87 et contrats5/5 (92 ensemble), intégration ciblée53/53
reproduits. Invariants SQL/J1, deny natif, prélocks, restauration audit et preuves
owner examinés ; aucun finding ouvert. Historique des échecs conservé dans Execute.

Autorise l’implémentation des services suivant ce graphe ; n’est pas un PASS des
endpoints, huit AC, Verify complet ou revue finale. Nouvelle prise root/authority
après J1, transaction imbriquée ou changement de graphe exige revue avant exposition.


## Réouverture du gate — décisions pré-refresh

2026-10-15 : fait nouveau décrit dans addenda Design/Plan et Execute. Le PASS initial
reste historique ; revalidation indépendante du delta `T05LockPlan<Decision>.validate`
**PENDING**, avant exposition API. Concept discuté avec l’orchestrateur et reviewer,
mais aucun avis conceptuel ne vaut PASS du code. Preuves implementer : build0,
unit87, contrats5, PG57 (16 locks), aucun skip. Rapport reviewer à ajouter après
réception ; aucun finding ne peut être clos par l’implementer seul.


### Revalidation indépendante du correctif — CHANGES_REQUIRED, Major1

Rapport reçu de `/root/lock_reviewer` via orchestrateur,2026-10-15 : concept wrapper
conforme, zéro autre finding, PG57 et unités/contrats92 reproduits. **M1** : `issue`
appelait `preparation.prepare` sur PENDING avant refus If-Match ou key/body ; un
refus normal pouvait donc intervenir après refresh/import. Le PASS initial et cet
avis CHANGES_REQUIRED sont conservés ; aucun gate suivant autorisé par cet avis.

Correction soumise (revalidation **PENDING**) : suppression du GET/probe préalable ;
`issue` transmet à la vraie transaction de préparation un guard privé en lecture
seule. Sous ses mêmes prélocks et après auth/CSRF/natif courant, le guard vérifie
key/body, replay durable avant stale If-Match, version/source/terminalité, ACTIVE et
preuve owner avant tout refresh/import. Replay complet saute toute préparation
native. Pas de nouvel ordre locks, pool, transaction ou effet dans le guard.

Tests ajoutés `apps/api/test/t05-invitations.integration.spec.ts` : quatre tests de
service réel PG/J1/Ed25519/BFF avec frontières natives explicitement instrumentées.
PENDING/version périmée et key déjà utilisée pour autre invitation : zéro refresh,
zéro readback/import de préparation, J1 owner/invité et ligne session intégrale
(tokens chiffrés/idle inclus) inchangés ; session réutilisable. Le contrôle natif
d’autorisation reste exécuté. Replay complet staleIfMatch retourne projection
courante sans lien ni répétition native ; replay d’une commande durable PENDING
après interruption entre transactions reprend avant staleIfMatch.

Preuves implementer : build complet PASS0 ; intégration ciblée61/61,7 fichiers,
aucun skip (57 précédents conservés +4 services). Les unités87 et contrats5 du gel
précédent sont conservés, non modifiés. Revue indépendante finale attendue.

### Revalidation indépendante M1 — PASS

Avis reçu de `/root/lock_reviewer` via orchestrateur,2026-10-15 : **PASS,
Critical0/Major0/Minor0**. M1 levé après examen du guard de la transaction réelle,
services et quatre tests supplémentaires ; build complet et PG61 reproduits.
Les avis CHANGES_REQUIRED précédents restent historiques. Autorise la suite5–8 et
le câblage sur ce graphe, sans constituer Verify final ou revue finale des huit AC.
