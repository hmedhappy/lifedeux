# LifeDeux — Étude de la plateforme

Plateforme de prise de rendez-vous pour la pose de prothèse pénienne en Tunisie,
destinée aux patients tunisiens et internationaux. La plateforme gère toute la
chaîne : réservation, paiement, transport, hébergement et suivi du patient.

> Statut : brouillon v1 — les points marqués **[HYPOTHÈSE]** sont à valider.

---

## 1. Acteurs

| Rôle | Qui | Ce qu'il fait |
|---|---|---|
| **Patient** | Toute personne, Tunisie ou étranger | Réserve, paie, télécharge sa fiche QR |
| **Médecin** | Chirurgiens partenaires | Gère ses créneaux, confirme/refuse les demandes, suit ses patients |
| **Admin** | L'équipe LifeDeux | Crée les comptes médecins, gère les logements, les paiements, le suivi |
| **Agent terrain** | Équipe aéroport / chauffeur | Scanne les QR codes et met à jour l'étape du patient |

## 2. Parcours patient

```
Choix opération → Choix médecin → Choix créneau → Demande envoyée
      → Confirmation du médecin → Choix des options (transport / logement)
      → Paiement en ligne → Fiche de réservation avec QR code
      → Arrivée aéroport (scan) → Bus → Logement → Clinique → Opération
      → Retour logement (récupération) → Bus → Aéroport → Départ
```

1. **Opération** : le patient choisit l'opération (une seule au départ, le modèle
   en accepte plusieurs).
2. **Médecin** : liste des médecins avec photo, langues parlées, clinique et prix.
3. **Créneau** : calendrier des disponibilités publiées par le médecin.
4. **Demande** : le patient crée son compte (nom, pays, téléphone, date de
   naissance) et envoie la demande. Le créneau est **bloqué temporairement**.
5. **Confirmation** : le médecin (ou l'admin) confirme ou refuse. Le patient est
   notifié par email.
6. **Options** :
   - *Transport aéroport* (aller + retour).
   - *Logement* : choix d'un appartement ou d'une maison (photos, prix/nuit,
     équipements). **Le logement inclut automatiquement le transport**
     (prise en charge complète).
7. **Paiement** : total = opération + options. Le patient doit payer dans un
   **délai de 72 h** après la confirmation, sinon le créneau est libéré. **[HYPOTHÈSE]**
8. **Fiche de réservation** : PDF + page web avec QR code, dates, médecin,
   clinique, logement, mention « Transport inclus » ou « Arrivée autonome ».

### Hypothèses sur le parcours

- **[HYPOTHÈSE] Transport sans logement** : possible (option seule).
  Logement sans transport : impossible, le logement inclut la prise en charge.
- **[HYPOTHÈSE] Durée du séjour** : chaque opération a une durée de
  récupération par défaut (ex. 7 nuits) que le médecin peut ajuster.
  Arrivée = veille de l'opération ; départ = opération + récupération.
  Le prix du logement est calculé sur ce nombre de nuits.
- **[HYPOTHÈSE] Suivi** : chaque scan du QR code par un agent fait avancer
  l'étape du patient, visible en temps réel par l'admin.

## 3. Statuts d'une réservation

```
DEMANDÉE → CONFIRMÉE → PAYÉE → EN_COURS → TERMINÉE
    ↓          ↓
 REFUSÉE    EXPIRÉE (non payée à temps)        ANNULÉE (à tout moment avant EN_COURS)
```

**Étapes de suivi** (pendant `EN_COURS`) :
`ARRIVÉ_AÉROPORT → AU_LOGEMENT → À_LA_CLINIQUE → OPÉRÉ → EN_RÉCUPÉRATION → PARTI`

## 4. Fonctionnalités par interface

### Patient
- Parcours de réservation guidé (4 étapes, barre de progression)
- Espace personnel : statut de la réservation, paiement, fiche QR à télécharger
- Notifications email (confirmation, rappel de paiement, rappel avant le voyage)

### Médecin
- Calendrier : publier / bloquer des créneaux
- Demandes en attente : confirmer ou refuser (avec motif)
- Liste de ses patients et de leur étape de suivi
- Relevé de ce que LifeDeux lui doit / lui a versé (cash)

### Admin
- Tableau de bord : réservations du jour, arrivées prévues, paiements
- **Médecins** : créer le compte → invitation envoyée par email au médecin
- **Logements** : créer / modifier (photos, prix, capacité, équipements, disponibilités)
- **Opérations** : prix, durée de récupération par défaut
- **Paiements** : suivi Stripe / Konnect, remboursements
- **Versements médecins** : enregistrer un paiement en cash (montant, date, reçu)
- **Suivi terrain** : liste des patients par étape, plan des transferts du jour

### Agent terrain
- Page mobile de scan QR → affiche la fiche patient → bouton « étape suivante »

## 5. Paiement

- **Stripe** pour les cartes internationales (nécessite une société hors Tunisie).
- **Konnect / Paymee / Flouci** pour les cartes tunisiennes et en solution de repli.
- Une **interface commune** (`PaymentProvider`) dans le code : on peut activer
  un ou plusieurs prestataires sans changer le reste de l'application.
- Devise d'affichage : EUR pour l'international, TND pour la Tunisie. **[À VALIDER]**
- Les montants dus aux médecins sont calculés par la plateforme puis versés
  **en cash** ; chaque versement est enregistré dans le système.
- Paiement confirmé **uniquement par webhook** du prestataire (jamais par le
  navigateur du patient).

## 6. QR code

- Le QR contient une URL avec un **jeton signé** (pas de données médicales).
- Seul un agent ou un admin connecté peut voir la fiche en scannant.
- Le jeton peut être révoqué (annulation).

## 7. Données de santé et sécurité

Les données sont sensibles : elles concernent la santé sexuelle et des patients de
plusieurs pays.

- **Minimisation** : on ne stocke que ce qui est utile à la logistique ; aucune
  donnée médicale détaillée sans besoin avéré.
- **Consentement explicite** au moment de l'inscription.
- **Conformité** : loi tunisienne (INPDP) et RGPD pour les patients européens.
- Chiffrement en transit (HTTPS) et au repos ; documents dans un stockage privé.
- Accès par rôle : un médecin ne voit que ses patients.
- Journal des accès aux fiches patients.
- **Discrétion** : intitulés neutres dans les emails et sur les relevés bancaires.

## 8. Langues

- Français, anglais, arabe (`next-intl`).
- L'arabe s'affiche **de droite à gauche** (`dir="rtl"`).
- Emails et fiche PDF dans la langue du patient.

## 9. Architecture technique

| Couche | Choix |
|---|---|
| Application | Next.js (App Router, TypeScript) |
| Base de données | PostgreSQL + Prisma |
| Authentification | Auth.js (email + mot de passe, lien magique pour les invitations) |
| UI | Tailwind CSS + shadcn/ui |
| i18n | next-intl |
| Paiement | Stripe + Konnect (adaptateurs) |
| QR / PDF | `qrcode` + `@react-pdf/renderer` |
| Emails | Resend (ou SMTP) |
| Stockage fichiers | S3 compatible (photos des logements) |
| Hébergement | Vercel + Postgres managé, ou VPS |

### Modèle de données (simplifié)

```
User(id, email, role: PATIENT|DOCTOR|ADMIN|AGENT, name, phone, country, locale)
Doctor(id, userId, bio, languages, clinic, photoUrl, active)
Operation(id, name, price, defaultRecoveryNights)
DoctorOperation(doctorId, operationId, price)
Slot(id, doctorId, startsAt, endsAt, status: FREE|HELD|BOOKED)
Accommodation(id, title, type: APARTMENT|HOUSE, pricePerNight, capacity, amenities, photos, active)
Booking(id, patientId, doctorId, operationId, slotId, status, trackingStep,
        withTransport, accommodationId?, nights, arrivalDate, departureDate,
        totalAmount, currency, qrToken, confirmedAt, paymentDeadline)
Payment(id, bookingId, provider, providerRef, amount, currency, status)
DoctorPayout(id, doctorId, amount, paidAt, note, recordedById)
TrackingEvent(id, bookingId, step, scannedById, at)
```

## 10. Découpage en étapes

1. **Socle** : projet Next.js, base, auth avec rôles, i18n FR/EN/AR.
2. **Admin** : médecins (invitation), opérations, logements.
3. **Médecin** : créneaux, confirmation des demandes.
4. **Patient** : parcours de réservation + espace personnel.
5. **Paiement** : Stripe + Konnect, webhooks, délai de paiement.
6. **Fiche QR + PDF** et page de scan agent, suivi des étapes.
7. **Versements médecins**, tableaux de bord, emails.
8. **Production** : sécurité, conformité, déploiement.

## 11. Questions ouvertes

- Transport seul sans logement : autorisé ?
- Qui fixe la durée de récupération ?
- Faut-il un suivi en temps réel des étapes du patient, ou le QR sert-il
  seulement à vérifier la réservation ?
- Devises : EUR + TND ? Prix des opérations différents selon le médecin ?
- Politique d'annulation et de remboursement ?
- Nombre de personnes accompagnantes (impact logement et bus) ?
- Le patient doit-il envoyer des documents médicaux avant la confirmation ?
