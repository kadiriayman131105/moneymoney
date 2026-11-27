# Moneymoney

Application personnelle pour suivre l’argent au jour le jour. Elle est en français, les montants sont en dirhams (DH), et les chiffres restent sur le téléphone : rien n’est envoyé sur un serveur.

Adresse : [kadiriayman131105.github.io/moneymoney](https://kadiriayman131105.github.io/moneymoney/)

## Mot de passe

La page demande un mot de passe avant d’afficher quoi que ce soit. Le mot de passe n’est pas écrit dans ce fichier. Sur l’iPhone, Safari peut le garder dans le trousseau après la première saisie.

## Deux espaces

Le choix est au milieu de la barre du haut.

**Moi** — l’argent personnel.

- Un crédit, c’est de l’argent à rendre. La carte est rouge.
- Un prêt, c’est de l’argent qui doit revenir. La carte est verte.
- Chaque ligne a une date, une raison, et des acomptes. Chaque acompte a sa propre date.
- « C’est réglé » ferme la ligne et garde l’historique. « Supprimer » l’efface.
- La recherche filtre les noms et les raisons. Les totaux du haut restent ceux de tout ce qui est encore ouvert.

**Nouran** — la caisse de Nouran Parfums.

- Le montant de départ est l’argent déjà dans la caisse. On le change en touchant la carte bleue.
- Une vente payée tout de suite entre dans la caisse.
- Un achat (parfum, flacons, emballage) sort de la caisse.
- Une vente à crédit n’entre pas tant que le client n’a pas payé. Un acompte entre. « C’est réglé » fait entrer le reste.
- Un prêt au personnel sort tout de suite. Un remboursement revient. « C’est réglé » fait revenir le reste.
- Sous le total : le départ, l’argent entré, et l’argent sorti.

## Sur l’iPhone

1. Ouvrir le lien dans Safari.
2. Entrer le mot de passe.
3. Partager, puis **Sur l’écran d’accueil**, puis **Ajouter**.
4. Ouvrir l’icône ensuite. Avec « Se souvenir de moi », le mot de passe n’est plus redemandé sur cet appareil.

Ce qui est noté sur l’ordinateur ne se copie pas sur le téléphone. Chaque appareil garde sa propre liste.

## Technique

React, TypeScript et Vite. Les listes sont enregistrées dans le navigateur (`localStorage`). Le site public est une page statique sur GitHub Pages.
