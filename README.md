# L'Observatoire — Galerie d'illustrations Mélandria

Un site à part, séparé de votre écran du MJ et du Manuel des Joueurs :
- **Page d'accueil** (`index.html`) : la galerie, consultable par vos amis via un simple lien (non indexée sur Google).
- **Page `/admin.html`** : réservée à vous, protégée par un mot de passe, pour déposer et retirer des illustrations.

Les images sont stockées directement par Netlify (aucun service tiers comme Cloudinary requis).

## Déploiement — aucune ligne de commande nécessaire

### 1. Créer un dépôt GitHub (stockage du code, gratuit)
1. Allez sur [github.com](https://github.com) et créez un compte si besoin.
2. Cliquez sur **"New repository"**, nommez-le par exemple `melandria-galerie`, laissez-le **Private** ou **Public** (peu importe, ça ne concerne que le code, pas les images), puis **Create repository**.
3. Sur la page du dépôt vide, cliquez sur **"uploading an existing file"**.
4. Glissez-déposez **tous les fichiers et dossiers** de ce projet (en gardant la structure : `netlify/`, `css/`, `js/`, `index.html`, `admin.html`, `netlify.toml`, `package.json`).
5. Cliquez **"Commit changes"**.

### 2. Connecter le dépôt à Netlify
1. Allez sur [app.netlify.com](https://app.netlify.com) et connectez-vous (le même compte que pour le Manuel des Joueurs si vous en avez un).
2. **"Add new site" → "Import an existing project" → "Deploy with GitHub"**.
3. Autorisez Netlify à accéder à GitHub si demandé, puis sélectionnez `melandria-galerie`.
4. Laissez les réglages par défaut (aucune commande de build nécessaire) et cliquez **"Deploy"**.

### 3. Définir votre mot de passe d'accès admin
1. Une fois le site déployé, allez dans **"Site configuration" → "Environment variables"**.
2. Cliquez **"Add a variable"**, nommez-la `ADMIN_PASSWORD`, et donnez-lui la valeur de votre choix (un mot de passe que vous seul connaissez).
3. Retournez dans **"Deploys"** et cliquez **"Trigger deploy" → "Clear cache and deploy site"** pour que le mot de passe soit pris en compte.

### 4. C'est en ligne
- Votre site a une adresse du type `https://nom-aleatoire.netlify.app`.
- Vous pouvez personnaliser ce nom dans **"Site configuration" → "Change site name"** (par ex. `observatoire-melandria.netlify.app`).
- Partagez le lien de la page d'accueil à vos amis : ils consultent, ils ne peuvent rien modifier.
- Gardez `/admin.html` pour vous (ex. `https://observatoire-melandria.netlify.app/admin.html`) pour déposer vos illustrations.

## Utilisation au quotidien
- Sur `/admin.html`, entrez votre mot de passe une fois par session de navigateur.
- Renseignez éventuellement des tags par défaut (PNJ, lieu, arc...) avant de déposer un lot d'images.
- Glissez vos fichiers ou utilisez "parcourir" : chaque image est automatiquement redimensionnée dans le navigateur avant l'envoi (pour rester léger), puis stockée.
- La liste "Illustrations déposées" en bas de la page admin permet de retirer une image si besoin.

## Notes techniques
- Le stockage des images utilise **Netlify Blobs**, inclus gratuitement, sans compte ni service externe supplémentaire.
- Le site n'est pas indexé par les moteurs de recherche (balise `noindex` + en-tête `X-Robots-Tag`), mais reste accessible à quiconque a le lien — pas de mot de passe côté visiteurs, comme demandé.
- Poids : le plan gratuit Netlify Blobs couvre largement plusieurs centaines d'illustrations compressées.
