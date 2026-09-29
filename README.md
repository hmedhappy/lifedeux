# LifeDeux

Plateforme médicale tunisienne pour les patients du monde entier : **consultation en ligne** (chat texte et photo, ordonnance numérique certifiée par QR code) dans plus de 40 spécialités, et **intervention chirurgicale** en Tunisie avec transfert aéroport, hébergement, paiement en ligne et suivi du patient par QR code. Interface en **français, anglais et arabe** (RTL).

L'étude fonctionnelle est dans [`docs/ETUDE.md`](docs/ETUDE.md).

## Fonctionnalités

| Espace | Ce qu'on y fait |
|---|---|
| **Patient** | Choisit une spécialité (cartes avec icônes, recherche) puis un médecin, et réserve **une consultation en ligne** ou **une intervention**. Consultation : le médecin accepte le créneau, le patient paie, puis discute avec lui par chat (texte + photos) à l'heure prévue et reçoit son ordonnance PDF certifiée. Intervention : après confirmation, choisit accompagnants, logement et transfert, paie et télécharge sa fiche QR. |
| **Médecin** (`/doctor`) | Accepte ou refuse les demandes, publie ses créneaux (consultation ou intervention), mène la consultation dans le chat avec un panneau d'ordonnance (recherche de médicaments, aperçu, signature et envoi), la termine, suit ses patients opérés, consulte ce que LifeDeux lui doit. |
| **Super-médecin** | Un médecin avec en plus une page **Parrainage** : il partage son lien, les médecins qui s'inscrivent avec sont actifs immédiatement et rattachés à lui. |
| **Admin** (`/admin`) | Crée les comptes médecins (spécialité, n° d'Ordre, tarif de consultation, **cachet** et signature, statut super-médecin), gère spécialités, médicaments, interventions, hébergements, réservations, consultations, remboursements, versements en espèces, équipe et paramètres. |
| **Pharmacien** (`/verify/…`) | Scanne le QR de l'ordonnance : la page confirme qu'elle est authentique et non modifiée (empreinte SHA-256). |
| **Agent terrain** (`/scan`) | Scanne le QR code du patient (ou saisit la référence) et valide chaque étape : aéroport → logement → clinique → opéré → convalescence → départ. |

Règles métier principales :
- le créneau est bloqué dès la demande, libéré en cas de refus, d'annulation ou d'expiration ;
- le patient a **72 h** (paramétrable) pour payer après confirmation, et au plus tard 24 h avant l'intervention ;
- le logement inclut toujours le transfert ; un logement ne peut pas être réservé deux fois sur des dates qui se chevauchent ;
- le paiement n'est validé **que** par le prestataire (webhook Stripe signé, vérification API Konnect), jamais par le navigateur ;
- sur la fiche et dans les emails, les libellés restent neutres (discrétion) ;
- consultation : demande au moins 2 h avant, paiement **après** acceptation et au plus tard 30 min avant ; le chat s'ouvre 10 min avant le créneau et se ferme quand le médecin termine (ou 24 h après) ; appel audio/vidéo affichés mais désactivés pour l'instant ;
- les photos du chat, les cachets et signatures sont **privés** (jamais servis par l'URL publique des images) ;
- pas d'ordonnance sans cachet téléversé ; une ordonnance envoyée n'est plus modifiable et toute modification en base est détectée par la page de vérification ;
- la recherche de médicaments passe par `src/lib/medications.ts` (PostgreSQL aujourd'hui), prévu pour être remplacé par Elasticsearch sans toucher au reste.

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · PostgreSQL + Prisma · Tailwind CSS 4 · Stripe · Konnect · Nodemailer · Vitest · Playwright.

## Démarrage local

Prérequis : Node.js 20.9+ et PostgreSQL.

```bash
cp .env.example .env            # puis remplir DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npx prisma migrate dev          # crée les tables
npm run db:seed:demo            # référentiel + médecins de 10 spécialités, patients, agent, logements, créneaux, réservations et consultations
npm run dev                     # http://localhost:3000
```

Pour essayer le paiement sans Stripe, mettez `PAYMENT_MOCK="true"` (développement uniquement).

Comptes de démo (mot de passe `Demo12345!`) :

| Rôle | Email | Ce qu'on y voit |
|---|---|---|
| Super-médecin | `dr.mansour@demo.lifedeux.com` (médecine générale) | page Parrainage, lien `/fr/join/DR-DEMOSUPER` ; consultation terminée avec ordonnance (LC-DEMO05) |
| Médecin | `dr.amira@demo.lifedeux.com` (dermatologie) | **chat ouvert maintenant** avec Sara (LC-DEMO03, replacé à l'heure actuelle à chaque seed) |
| Médecin | `dr.jaziri@demo.lifedeux.com` (cardiologie) | demande de consultation à accepter (LC-DEMO01) |
| Médecin | `dr.khelifi@demo.lifedeux.com` (pédiatrie) | consultation payée demain (LC-DEMO04) |
| Médecin | `dr.chaabane@demo.lifedeux.com` (psychologie) | **sans cachet** : ne peut pas prescrire |
| Médecin | `dr.karoui@demo.lifedeux.com` (neurologie) | parrainé par Dr Mansour |
| Médecin | `dr.mejri@…`, `dr.hamdi@…` (cataracte), `dr.bouaziz@…` (implant dentaire) | consultation + intervention |
| Médecin | `dr.ben-salah@…`, `dr.trabelsi@…`, `dr.gharbi@demo.lifedeux.com` (urologie) | demandes d'intervention, créneaux, patients |
| Agent | `agent@demo.lifedeux.com` | scan et suivi |
| Patient | `sara@demo.lifedeux.com` | chat en cours (LC-DEMO03) ; demande d'intervention (LD-DEMO01) |
| Patient | `patient@demo.lifedeux.com` | consultation acceptée à payer (LC-DEMO02), consultation refusée (LC-DEMO06) |
| Patient | `youssef@demo.lifedeux.com` | ordonnance certifiée à télécharger (LC-DEMO05) ; intervention payée avec fiche QR (LD-DEMO03) |
| Patient | `luca@demo.lifedeux.com` | consultation payée demain (LC-DEMO04), expirée (LC-DEMO07) ; intervention à payer (LD-DEMO02) |
| Patient | `nadia@demo.lifedeux.com` | demande en attente (LC-DEMO01), consultation annulée (LC-DEMO08) |

Scripts de données :

| Commande | Effet |
|---|---|
| `npm run db:seed` | paramètres, admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) et référentiel. Sans danger en production. |
| `npm run db:seed:reference` | seulement le référentiel : 43 spécialités (icône, noms FR/EN/AR, tarif), 7 interventions, 58 médicaments d'exemple. |
| `npm run db:seed:demo` | tout ce qui précède + les comptes et scénarios de démo ci-dessus. |
| `npm run db:reset-users -- --yes` | **supprime tous les utilisateurs** et leurs données (réservations, consultations, messages, ordonnances, paiements, créneaux, images privées), garde spécialités, médicaments, interventions, logements et paramètres, puis recrée l'admin. À utiliser avant l'ouverture en production. |

L'admin est celui défini par `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Les seeds peuvent être relancés sans créer de doublons ; n'utilisez pas `db:seed:demo` en production.

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

Les tests de bout en bout couvrent : pages publiques FR/EN/AR, contrôle d'accès par rôle, création d'un médecin par l'admin et activation par invitation, publication de créneaux, inscription patient, mot de passe oublié, envoi de photos (et rejet des faux fichiers image), demande, confirmation, choix accompagnant + logement, paiement, fiche QR, impossibilité de réserver deux fois un logement, suivi par l'agent et le médecin, versements en espèces, webhooks Stripe signés et falsifiés, tâche d'expiration ; et côté consultation : navigation et recherche par spécialité (FR/EN/AR), demande, acceptation, paiement, chat texte + photo (photos privées, accès refusé aux tiers), ordonnance (recherche de médicament, lignes incomplètes refusées, aperçu, brouillon invisible au patient, signature, PDF), vérification publique par QR (et détection d'une modification), fin de consultation (chat en lecture seule), médecin sans cachet, parrainage par un super-médecin, gestion admin des spécialités, médicaments et consultations.

## Limites connues

- Les photos envoyées sont stockées dans PostgreSQL (redimensionnées à 1600 px dans le navigateur). C'est simple et suffisant pour quelques centaines de photos ; au-delà, un stockage objet (S3, Vercel Blob) serait préférable.
- Paymee et Flouci ne sont pas branchés ; l'interface `PaymentProvider` (`src/lib/payments`) permet de les ajouter.
- La limitation des tentatives de connexion est en mémoire (une seule instance) ; utilisez Redis si vous en lancez plusieurs.
- Le chat interroge le serveur toutes les 3 s (pas de WebSocket) : simple et fiable derrière nginx, suffisant pour du texte et des photos.
- Le PDF d'ordonnance utilise les polices standard (caractères latins) : les noms en arabe y sont remplacés par « ? ». Une police arabe embarquée sera nécessaire pour les ordonnances en arabe.
- Stripe et Konnect n'ont pas été testés avec de vraies clés : le webhook Stripe est testé avec des signatures générées localement, la création de session Checkout et Konnect ne l'ont pas été.
