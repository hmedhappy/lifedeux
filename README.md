# LifeDeux

Plateforme de prise de rendez-vous pour une intervention chirurgicale en Tunisie, avec transfert aéroport, hébergement, paiement en ligne et suivi du patient par QR code. Interface en **français, anglais et arabe** (RTL).

L'étude fonctionnelle est dans [`docs/ETUDE.md`](docs/ETUDE.md).

## Fonctionnalités

| Espace | Ce qu'on y fait |
|---|---|
| **Patient** | Choisit le chirurgien et le créneau, envoie la demande, puis après confirmation choisit accompagnants, logement et transfert, paie en ligne et télécharge sa fiche avec QR code. |
| **Médecin** (`/doctor`) | Confirme ou refuse les demandes (et fixe la durée de convalescence), publie ses créneaux, suit ses patients, marque l'intervention réalisée, consulte ce que LifeDeux lui doit. |
| **Admin** (`/admin`) | Crée les comptes médecins (invitation par email), gère interventions, hébergements, réservations, remboursements, versements en espèces aux médecins, équipe et paramètres. Tableau de suivi en temps réel. |
| **Agent terrain** (`/scan`) | Scanne le QR code du patient (ou saisit la référence) et valide chaque étape : aéroport → logement → clinique → opéré → convalescence → départ. |

Règles métier principales :
- le créneau est bloqué dès la demande, libéré en cas de refus, d'annulation ou d'expiration ;
- le patient a **72 h** (paramétrable) pour payer après confirmation, et au plus tard 24 h avant l'intervention ;
- le logement inclut toujours le transfert ; un logement ne peut pas être réservé deux fois sur des dates qui se chevauchent ;
- le paiement n'est validé **que** par le prestataire (webhook Stripe signé, vérification API Konnect), jamais par le navigateur ;
- sur la fiche et dans les emails, les libellés restent neutres (discrétion).

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · PostgreSQL + Prisma · Tailwind CSS 4 · Stripe · Konnect · Nodemailer · Vitest · Playwright.

## Démarrage local

Prérequis : Node.js 20.9+ et PostgreSQL.

```bash
cp .env.example .env            # puis remplir DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npx prisma migrate dev          # crée les tables
npm run db:seed:demo            # admin + 3 médecins, 5 patients, agent, logements, créneaux, réservations d'exemple
npm run dev                     # http://localhost:3000
```

Pour essayer le paiement sans Stripe, mettez `PAYMENT_MOCK="true"` (développement uniquement).

Comptes de démo (mot de passe `Demo12345!`) :

| Rôle | Email | Ce qu'on y voit |
|---|---|---|
| Médecin | `dr.ben-salah@demo.lifedeux.com`, `dr.trabelsi@demo.lifedeux.com`, `dr.gharbi@demo.lifedeux.com` | demandes, créneaux, patients |
| Agent | `agent@demo.lifedeux.com` | scan et suivi |
| Patient | `patient@demo.lifedeux.com` | aucune réservation, pour tester le parcours |
| Patient | `sara@demo.lifedeux.com` | demande en attente (LD-DEMO01, Dr Trabelsi) |
| Patient | `luca@demo.lifedeux.com` | confirmé, à payer (LD-DEMO02, Dr Ben Salah) |
| Patient | `youssef@demo.lifedeux.com` | payé, villa + accompagnant, fiche QR (LD-DEMO03, Dr Gharbi) |
| Patient | `nadia@demo.lifedeux.com` | aucune réservation |

L'admin est celui défini par `ADMIN_EMAIL` / `ADMIN_PASSWORD`. La commande peut être relancée sans créer de doublons ; ne l'utilisez pas en production (utilisez `npm run db:seed`).

## Mise en production

**Sur un VPS avec Docker** (base, application, HTTPS automatique et tâche horaire en une commande) : voir [`deploy/DEPLOY.md`](deploy/DEPLOY.md).

Autres hébergements :

1. **Base de données** : créez une base PostgreSQL (Neon, Supabase, Railway, RDS…) et mettez son URL dans `DATABASE_URL`.
2. **Variables d'environnement** : voir [`.env.example`](.env.example). Au minimum : `DATABASE_URL`, `AUTH_SECRET` (`openssl rand -base64 48`), `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CRON_SECRET`, et `PAYMENT_MOCK="false"`.
3. **Stripe** :
   - `STRIPE_SECRET_KEY` = votre clé secrète (`sk_live_…`) ;
   - dans Stripe → *Developers → Webhooks*, ajoutez l'endpoint `https://VOTRE-DOMAINE/api/webhooks/stripe` avec les événements `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` ;
   - copiez le *signing secret* (`whsec_…`) dans `STRIPE_WEBHOOK_SECRET`.
4. **Konnect** (optionnel, cartes tunisiennes) : `KONNECT_API_KEY`, `KONNECT_WALLET_ID`, `KONNECT_API_URL`. Le moyen de paiement apparaît automatiquement dès que les variables sont renseignées.
5. **Emails** (recommandé) : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`. Sans SMTP, les emails sont seulement écrits dans les logs (le lien d'invitation reste affiché à l'admin).
6. **Déploiement** :
   - **Vercel** : importez le dépôt, ajoutez les variables, puis lancez une fois `npx prisma migrate deploy && npm run db:seed` avec la `DATABASE_URL` de production. `vercel.json` appelle `/api/cron/expire` chaque jour (les réservations expirées sont aussi libérées à chaque consultation des pages).
   - **Serveur / VPS** : `npm ci && npx prisma migrate deploy && npm run db:seed && npm run build && npm start`, derrière un proxy HTTPS. Planifiez `curl -H "Authorization: Bearer $CRON_SECRET" https://VOTRE-DOMAINE/api/cron/expire` toutes les heures.

## Tests

```bash
npm run lint && npm run typecheck
npm test                 # tests unitaires (tarifs, suivi, dates, traductions, sessions)
npm run build
npm run test:e2e         # parcours complet dans un vrai navigateur (base E2E_DATABASE_URL)
```

Les tests de bout en bout couvrent : pages publiques FR/EN/AR, contrôle d'accès par rôle, création d'un médecin par l'admin et activation par invitation, publication de créneaux, inscription patient, mot de passe oublié, envoi de photos (et rejet des faux fichiers image), demande, confirmation, choix accompagnant + logement, paiement, fiche QR, impossibilité de réserver deux fois un logement, suivi par l'agent et le médecin, versements en espèces, webhooks Stripe signés et falsifiés, tâche d'expiration.

## Limites connues

- Les photos envoyées sont stockées dans PostgreSQL (redimensionnées à 1600 px dans le navigateur). C'est simple et suffisant pour quelques centaines de photos ; au-delà, un stockage objet (S3, Vercel Blob) serait préférable.
- Paymee et Flouci ne sont pas branchés ; l'interface `PaymentProvider` (`src/lib/payments`) permet de les ajouter.
- La limitation des tentatives de connexion est en mémoire (une seule instance) ; utilisez Redis si vous en lancez plusieurs.
- Stripe et Konnect n'ont pas été testés avec de vraies clés : le webhook Stripe est testé avec des signatures générées localement, la création de session Checkout et Konnect ne l'ont pas été.
