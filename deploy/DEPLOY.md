# Déployer LifeDeux sur un VPS

Objectif : `https://lifedeux.afdev.site`, avec la base PostgreSQL, l'application, le HTTPS automatique et la tâche horaire, le tout lancé par Docker.

Prérequis : un VPS Linux (Ubuntu/Debian) avec au moins **2 Go de RAM** (ou de la swap, voir en bas), un accès SSH, et l'accès à la zone DNS de `afdev.site`.

---

## 1. DNS (une fois)

Chez le fournisseur du domaine `afdev.site`, ajoutez un enregistrement :

| Type | Nom | Valeur |
|---|---|---|
| A | `lifedeux` | adresse IP publique du VPS |

Vérifiez depuis votre Mac (cela peut prendre quelques minutes) :

```bash
dig +short lifedeux.afdev.site     # doit afficher l'IP du VPS
```

## 2. Préparer le VPS (une fois)

```bash
ssh votre-user@IP_DU_VPS

# Docker + Docker Compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit                                # puis reconnectez-vous pour que le groupe docker soit pris en compte
ssh votre-user@IP_DU_VPS
docker compose version              # doit répondre

# Pare-feu (si ufw est actif)
sudo ufw allow 80,443/tcp
```

**Les ports 80 et 443 sont-ils déjà utilisés ?** (par exemple par un nginx qui sert vos autres sites)

```bash
sudo ss -tlnp | grep -E ':(80|443)\s'
```

- Rien ne s'affiche → gardez `USE_CADDY=1` (Caddy gère le HTTPS tout seul).
- `nginx` s'affiche → mettez `USE_CADDY=0` et suivez l'étape 5 bis.

## 3. Récupérer le code

```bash
git clone -b claude/amazing-galileo-fg93rs https://github.com/hmedhappy/lifedeux.git
cd lifedeux
```

Si le dépôt est privé, GitHub demande un identifiant : utilisez votre nom d'utilisateur et un **token** (GitHub → Settings → Developer settings → Personal access tokens, droit « Contents: read ») à la place du mot de passe.

## 4. Configurer

```bash
cp deploy/.env.production.example .env.production
openssl rand -hex 24      # lancez-le 3 fois : POSTGRES_PASSWORD, AUTH_SECRET, CRON_SECRET
nano .env.production
```

Remplacez chaque `CHANGE_ME` (les 3 secrets, `ADMIN_EMAIL`, `ADMIN_PASSWORD`). Pour une première mise en ligne de test, vous pouvez mettre `SEED_DEMO=true` et garder `PAYMENT_MOCK=true`.

## 5. Lancer

```bash
./deploy/deploy.sh
```

La première fois, la construction prend quelques minutes. À la fin, le script affiche les comptes créés puis `Done. Open https://lifedeux.afdev.site`. Le certificat HTTPS est obtenu automatiquement au premier accès (quelques secondes).

## 5 bis. Si nginx est déjà installé (`USE_CADDY=0`)

```bash
sudo cp deploy/nginx-lifedeux.conf /etc/nginx/sites-available/lifedeux
sudo ln -s /etc/nginx/sites-available/lifedeux /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx   # si certbot n'est pas installé
sudo certbot --nginx -d lifedeux.afdev.site
```

---

## Mettre à jour

```bash
cd lifedeux
./deploy/deploy.sh        # récupère le code (git pull), reconstruit, redémarre ; les données sont conservées
```

## Passer en vrai paiement (Stripe)

1. Dans `.env.production` : `PAYMENT_MOCK=false`, `STRIPE_SECRET_KEY=sk_live_…`.
2. Stripe → Developers → Webhooks → ajouter l'endpoint `https://lifedeux.afdev.site/api/webhooks/stripe` avec les événements `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
3. Copier le *signing secret* dans `STRIPE_WEBHOOK_SECRET`, puis relancer `./deploy/deploy.sh`.
4. Avant l'ouverture au public, lance `./deploy/go-live.sh` (voir plus bas).

## Commandes utiles

```bash
C="docker compose --env-file .env.production -f docker-compose.prod.yml"
$C ps                                  # état des services
$C logs -f app                         # journaux de l'application (Ctrl+C pour quitter)
$C restart app                         # redémarrer l'application
```

## Sauvegardes, restauration, ouverture au public

À lancer depuis le dossier LifeDeux sur le VPS. Si Node.js est installé sur le VPS, `npm run vps:…` marche aussi. Sinon, utilise `./deploy/…`, qui ne demande que Docker.

| Commande | Ce qu'elle fait |
|---|---|
| `./deploy/backup.sh` (`npm run vps:backup`) | Sauvegarde toute la base dans `backups/lifedeux-DATE_HEURE.sql.gz` ; garde les 30 dernières (`BACKUP_KEEP=60 ./deploy/backup.sh` pour en garder plus). L'app continue de tourner. |
| `./deploy/restore.sh backups/lifedeux-….sql.gz` (`npm run vps:restore -- backups/…`) | Remet la base dans l'état de cette sauvegarde. Demande de taper `OUI` et fait d'abord une sauvegarde de l'état actuel. |
| `./deploy/go-live.sh` (`npm run vps:go-live`) | **Ouverture au public** : demande `OUI`, sauvegarde, passe `SEED_DEMO=false`, supprime **tous** les comptes de test et leurs données, garde spécialités, médicaments, interventions, logements et paramètres, puis recrée l'admin de `.env.production`. |

Sauvegarde automatique chaque nuit à 3 h (`crontab -e`, puis ajouter la ligne) :

```bash
0 3 * * * cd /CHEMIN/VERS/lifedeux && mkdir -p backups && ./deploy/backup.sh >> backups/backup.log 2>&1
```

Copie aussi de temps en temps le dossier `backups/` hors du VPS, par exemple avec `scp` depuis ton ordinateur.

Ordre conseillé : `deploy.sh`, puis tu testes avec les comptes de démo. Quand tout est bon, tu lances `go-live.sh`, **une seule fois**. Ensuite, chaque mise à jour se fait avec `deploy.sh`.

Repartir d'une base **vide** (efface toutes les données, irréversible) : `$C down -v` puis `./deploy/deploy.sh`.

## En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| La construction s'arrête (« Killed », « JavaScript heap out of memory ») | VPS avec moins de 2 Go de RAM | Ajouter 2 Go de swap : `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` puis relancer |
| Pas de HTTPS / erreur de certificat | DNS pas encore propagé, ou ports 80/443 fermés | Vérifier `dig +short lifedeux.afdev.site` et le pare-feu, puis `$C restart caddy` |
| `port is already allocated` pour 80/443 | nginx déjà présent | Mettre `USE_CADDY=0` et faire l'étape 5 bis |
| Le conteneur `app` redémarre en boucle (`is restarting`) | Mot de passe PostgreSQL avec `/`, `+` ou `=` | Voir les journaux (`$C logs --tail 40 app`) ; sur une installation neuve : `$C down -v`, régénérer `POSTGRES_PASSWORD` avec `openssl rand -hex 24`, relancer le script |
| Impossible de se connecter, la page revient au login | `APP_URL` n'est pas en `https://…` | Corriger `APP_URL` et relancer le script |
