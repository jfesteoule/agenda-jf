# agenda-jf

- Travailler directement sur la branche `main`.
- À chaque modification de `index.html`, mettre à jour le numéro de version
  (`<div id="appVersion">` sous la légende, format « Version AAAA-MM-JJ HH:MM », heure de Paris) avant le commit.
- Ne jamais modifier le contenu d'une image (ou autre fichier chargé par la page) en
  gardant son nom : le navigateur la garde en cache. Toujours lui donner un nouveau
  nom de fichier et mettre à jour la référence dans `index.html`.
- Tests visuels et de fluidité : simuler en priorité des appareils Android (téléphone
  « Galaxy S24 », tablette « Galaxy Tab S9 landscape » dans Playwright) — ce sont ceux
  utilisés au quotidien.
