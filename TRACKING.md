# Tracking convention — observatoire public

## Architecture retenue

Toutes les pages HTML publiques de l’observatoire utilisent un seul conteneur Google Tag Manager :

- GTM : `GTM-5ZZ27N8W`
- GA4 : `G-JPQKQ9JKW8`

La règle est :

`page publique → Google Tag Manager → Google Analytics 4`

Le tag GA4 direct (`gtag.js` chargé avec `G-JPQKQ9JKW8`) ne doit pas être ajouté directement dans les pages HTML lorsque GA4 est déclenché depuis le conteneur GTM, afin d’éviter un double envoi de `page_view` ou d’autres événements.

## Snippet obligatoire dans `<head>`

```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5ZZ27N8W');</script>
<!-- End Google Tag Manager -->
```

## Snippet obligatoire immédiatement après `<body>`

```html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5ZZ27N8W"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
```

## Règle pour les futures pages

Toute nouvelle page HTML publiée (`/dpe/`, `/justice/`, `/rgpd/`, `/politiques-publiques/`, `/argent-dette/`, `/information/`, `/champ-reflexion/`, etc.) doit reprendre ces deux blocs avant publication.

Aucun autre identifiant GTM ou GA4 ne doit être ajouté sans décision explicite et synchronisation avec le dépôt canonique privé.
