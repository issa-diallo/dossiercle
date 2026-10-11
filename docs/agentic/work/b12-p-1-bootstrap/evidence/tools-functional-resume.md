# B12 — reprise ciblée après échec fonctionnel

2026-10-11. Décision de l'orchestrateur dans le mandat D69/D70 existant, après revue indépendante du gel d'arrêt `388df70bd5594099d68c1593f6636f10010ac8a008a0fe976049af490cddeaf8`.

L'archive Node a été acquise et contrôlée : 31 890 184 octets, SHA256 conforme au manifeste. La requête des métadonnées pnpm a échoué avec `HTTPError` ; son code HTTP n'a pas été conservé et ne peut être déduit. Le helper a arrêté son scope. La revue confirme la fidélité des preuves et ne constate aucun déclencheur Q4 de sécurité, compatibilité, réseau imprévu ou quota à partir de cet échec seul. Le gate tools et la phase A ne sont pas PASS.

Reprise limitée autorisée après correction et revue : conserver Node ; utiliser les métadonnées exactes pnpm 12.8.1 déjà vérifiées (réponse 200 et SRI archivés) pour son tarball officiel, sans nouvelle requête de métadonnées ; journaliser précisément les futurs échecs HTTP. Aucun remplacement de version ni assouplissement des critères Q4. Les preuves de l'arrêt sont conservées, le nouveau gel doit être revu avant exécution.

Baseline réseau, compteur cumulé, réserve, début de phase A à 08:53:36 UTC et échéance à 10:53:36 UTC conservés. Le solde conservateur au point d'arrêt était de 1 854 958 862 octets ; il doit être recalculé avant reprise, en incluant le trafic tiers. Budget total 2 Go, 0 €, 4 CPU/8 Gio/15 Gio et total 8 h inchangés. Aucun nouveau consentement utilisateur n'est nécessaire pour cette correction fonctionnelle déjà comprise dans le POC autorisé.
