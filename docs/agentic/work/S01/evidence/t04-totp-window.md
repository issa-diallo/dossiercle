# Correction N2 du paramètre de fenêtre TOTP — 2026-10-12

Constat natif : Keycloak rejette le code frais, et un appel PI direct de diagnostic
sur la même fixture (sous verrou/J1, sans création de session applicative) le
rejette ou l’accepte selon la phase temporelle. Un seul appel provider est observé ;
realm/resolver/policy PIN attendus. La graine correspond à celle native, comparaison
RAM dans le service PI, sans export de clé ni valeur d’OTP. Les horloges host/PI/KC
concordent. Il ne s’agit ni d’un changement de clé ni d’un double appel.

La source PI3.14 `totptoken.py` applique `floor((time + timeShift)/30)`, puis un succès
écrit `timeShift = compteur*30 - temps`, négatif de zéro à 29 secondes. `HMAC.py`
parcourt `range(c-window, c+window)` avec borne supérieure exclue. La candidate
Execute `timeWindow=30` (un pas) exclut c+1 : un code UTC courant tombe à c+1 après
ce décalage quantifié en début de période. La vérification initiale réussit, puis
un code frais peut être refusé ; le même code devient acceptable plus tard.

Correction explicite N2 : `timeWindow=60` (deux pas), soit les quatre compteurs
c−2, c−1, c, c+1. Ce n’est pas une fenêtre symétrique ±60 s. Les compteurs déjà
consommés restent refusés. Pas de fallback automatique, modification fournisseur,
calcul TOTP applicatif, AutoResync ou changement SHA1/6 chiffres/pas30 s.
Les anciens tokens d’essai conservent leur fenêtre30 ; aucune mutation implicite.

Research/Design/Plan/ADR029/ARCHITECTURE_OTP ne fixent pas de borne numérique de
fenêtre ; le contrat OTP affecte explicitement cette qualification à N2.
La revue source indépendante /root/s01_environment_review confirme cause et portée.
Preuves native positive, limites, rejeu et throttling encore requises avant PASS.
