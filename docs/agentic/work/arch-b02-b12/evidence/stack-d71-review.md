# Revue indépendante D71 / arrêt B12

## Verdict

**PASS avec deux corrections textuelles mineures recommandées.** Le choix humain est clairement distingué des preuves techniques, et aucun nouveau gate POC n’est autorisé. La qualification produit complète n’est pas déduite de D71.

Périmètre : candidat canonique128fichiers, empreinte `b09a8156853a5dd190256451e15f058b8f64a4bf7e61053bb7b4e66061e0535c1` ; arrêt builder1890fichiers, empreinte `2a9c4e242d9789a3e362f379d54edd3dc4c2f8ebcd42da2d1b44380d1ccdea77`. Tous les hashes des fichiers ont été recalculés en lecture seule : aucun écart. Aucun GET ni runtime POC exécuté.

## Résultat

D71 fixe les outils et versions majeures approuvés, pas les patchs du lock expérimental ; pnpm et GitHub Actions ne sont pas adoptés implicitement. D69/D70 sont révoqués pour toute nouvelle acquisition/reprise. B12 ferme le choix stack par décision, sans PASS runtime. Builds, PostgreSQL, tests/scans, offline2, promotion/PRA restent explicitement non qualifiés, avec preuves reportées aux stories avant livraison. Inngest moteur est choisi, licence et topologie non résolues. Architecture globale n’est pas déclarée PASS ; les exigences sécurité/livraison persistent.

R-B07-01 demeure visible dans Architecture/ADR003 : le contrat natif Better Auth1.7.7 ne qualifie pas hash/non-relecture des codes. Aucun chiffrement récupérable ni extension auth maison n’est adopté pour remplacer l’exigence. Cette disposition doit être traitée concrètement en préparation des stories auth via mécanisme supporté/ADR si nécessaire, sans transformer la décision humaine en fullMFA PASS.

La preuve user-stop canonique est identique à celle du builder. Elle conserve scopes tâche inactifs, zéro conteneur au label tâche, socket absent et compteur final495538247octets, réserve incluse, baseline/horloges inchangées. Le ledger est STOPPED_BY_USER. Première installation frozen étayée ; deuxième interrompue ; cause watchdog inconnue conservée comme telle. Archives et ressources utilisateur sont préservées selon les inventaires/handoff, sans purge générale. La correction offline proposée n’a pas été exécutée.

## Findings

### Minor D71-01 — ADR005, Autorité technique courante

La fin de l’addendum dit encore « Inngest reste PROPOSED », malgré le choix ACCEPTED du moteur par D71. Remplacer par : « Le moteur Inngest est ACCEPTED par D71 ; les modalités de licence, déploiement et topologie restent PROPOSED ou à finaliser. » Conserver le protocole SDK canonique et les preuves restantes.

### Minor D71-02 — registre, Propositions non approuvées

Le paragraphe courant inclut encore Vitest/Playwright/k6/OpenTelemetry dans les outils proposés. D71 les adopte explicitement. Préciser ces outils ACCEPTED D71 ; pnpm, GitHub Actions, arborescence détaillée et modalités du collecteur privé demeurent des propositions. Les lignes historiques de supersession restent traçables et ne nécessitent pas réécriture.

Aucun Critical/Major identifié dans cette revue ciblée. Les contradictions mineures sont bornées par l’autorité D71 placée en tête, mais leur correction évite de réintroduire une concurrence de stack lors des futures Research.
