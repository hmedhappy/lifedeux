# Relooking LifeDeux : décisions et spécification

Source : questionnaire de 145 questions (4 études UX/UI : patient, médecin, admin/terrain, design system), rempli par le product owner, plus 5 précisions. Livraison **en une seule fois**, patient mobile d'abord dans la conception.

Légende : ✅ recommandation suivie · ✏️ choix différent de la recommandation · 🔌 nécessite des identifiants externes (fonctionne en mode dégradé sans eux).

## 1. Identité et design system

| Décision | Mise en œuvre |
|---|---|
| ✅ Direction **Lagon** : primaire `#0F766E`, accent corail `#FF7A59` (jamais en texte sur blanc), neutres légèrement verdis | Tokens dans `globals.css` ; plus aucun dégradé décoratif |
| ✅ Émotion : chaleur et soin, confiance d'abord ; chirurgie avec une teinte secondaire | Accent « voyage » ambre pour le parcours chirurgie |
| ✅ Tuiles de spécialité à teinte unie, fond blanc cassé `#FAFBFA` | |
| ✅ Mode sombre préparé dans les tokens, non activé | |
| ✅ Plus Jakarta Sans + IBM Plex Sans Arabic, texte courant 16px sur mobile | Arabe : +1px, interligne 1,7 |
| ✅ Illustrations au trait (états vides), pas de mascotte | |
| ✏️ Photos de médecins facultatives (initiales sinon) ; ✏️ photos de logements fournies par les hôtes | |
| ✅ Animations subtiles ; ✏️ célébration = coche animée seulement | Respect de `prefers-reduced-motion` |
| ✅ Logo modernisé (cœur + croix) ; ✏️ logotype latin seul ; nom « LifeDeux » partout | |
| ✅ Même marque pour l'espace médecin, interface plus dense | |
| ✅ WCAG 2.2 AA, zones tactiles de 44px, vouvoiement chaleureux, ✏️ émojis autorisés | |
| ✅ Chiffres occidentaux, miroir RTL des éléments directionnels seulement | |

## 2. Navigation

- ✅ Barre d'onglets en bas sur mobile :
  - **patient** : Accueil · Rendez-vous · Messages · Documents ;
  - **médecin** : Aujourd'hui · Consultations · Agenda · Plus ✏️.
- ✅ Le médecin arrive sur **« Aujourd'hui »**. Les demandes à accepter y sont affichées en tête, en boîte de réception, avec un badge sur l'onglet (précision 5).
- ✅ Les liens marketing sont retirés de l'espace pro.
- ✅ Les confirmations passent par des feuilles aux couleurs du site : plus de `window.confirm`.
- ✅ Les messages de succès sont des toasts, avec « Annuler » quand c'est possible.
- ✅ Chat et paiement en écran « focus », sans pied de page.
- ✅ Accueil mobile raccourci. Le « i » s'ouvre au toucher. Au plus 3 bulles d'aide, montrées une seule fois.
- ✅ Recherche globale ⌘K pour l'admin et le médecin.

## 3. Patient

- ✅ Réservation **avant compte** : le patient choisit son créneau, donne son email, reçoit un code, puis la demande part. Le créneau choisi n'est jamais perdu.
- ✏️ Connexion : **Google** + email (code) ; 🔌 `GOOGLE_CLIENT_ID/SECRET`. Apple viendra plus tard (compte Apple Developer requis). Le mot de passe reste possible pour les comptes existants.
- ✅ Téléphone et pays demandés seulement pour la chirurgie. Consentement distinct selon le service.
- ✅ Recherche par symptôme reliée aux spécialités ; ✏️ les spécialités sans médecin restent cliquables.
- ✅ Chirurgie : on choisit **l'opération d'abord**, puis on compare les chirurgiens.
- ✅ Liste triée par disponibilité. Avis vérifiés après consultation.
- ✅ Créneaux en ligne de jours avec des pastilles d'heures. Barre fixe « prix · prochain créneau » sur la fiche médecin, bio repliée.
- ✅ Motif sous forme de puces + texte libre. Photos possibles dès la demande. Heure du patient affichée en plus de l'heure de Tunis.
- ✅ Langue du navigateur au premier accès.
- **Précision 3** : les prénoms et noms (patients, médecins, accompagnants), ainsi que les médicaments ajoutés en ligne libre, doivent être en **lettres latines**, accents compris. L'arabe est refusé dans ces champs avec un message clair. Le PDF reste en latin.

## 4. Paiement, annulation

- ✅ **Empreinte bancaire à la demande, débit à l'acceptation** pour la consultation : capture manuelle Stripe, et mode test simulé. La chirurgie garde le paiement après confirmation, car le total dépend des options choisies ensuite. Konnect, sans empreinte, reste en paiement après acceptation.
- ✅ Moyen de paiement proposé par défaut selon le pays. Apple Pay et Google Pay passent par Stripe Checkout.
- ✅ Annulation gratuite jusqu'à 24 h avant, affichée à côté du bouton Payer.
- ✅ Le patient peut **déplacer son créneau** jusqu'à 24 h avant, **avec l'accord du médecin** (note du PO).
- ✏️ Le délai de réponse du médecin est seulement affiché, sans expiration automatique. **Précision 1** : relance du médecin à 24 h, alerte admin à 48 h.
- ✅ Réservation instantanée en option côté médecin, désactivée par défaut.
- ✅ Consultation : l'empreinte est libérée si le médecin ne répond pas ou refuse.
- ✏️ Remboursements totaux seulement.
- ✅ Paiement encaissé mais impossible à honorer : **remboursement automatique** et alerte admin.

## 5. Consultation et chat

- ✏️ Appel et vidéo affichés avec un badge « bientôt ».
- ✅ Chat plein écran sur mobile, avec les statuts « a rejoint », « écrit… » et les coches de lecture.
- ✏️ Fermeture par le médecin ; **précision 2** : fermeture de secours après 24 h.
- ✅ Côté médecin :
  - mobile : onglets Chat · Ordonnance · Patient ;
  - ordinateur : 3 colonnes (patient + historique avec ce médecin | chat | ordonnance repliable).
- ✅ Bouton « Patient absent », messages rapides, bouton « Orienter » (cabinet ou chirurgie), bouton « Terminer » dans l'en-tête.
- ✅ Nouvelle consultation avec le même médecin en un clic.
- ✅ Son et compteur dans l'onglet quand un message arrive.

## 6. Ordonnance

- ✅ Ordonnances types personnelles. Posologie en puces rapides + texte. Aperçu en vignette, grand format au clic. « Plus d'options » pour les instructions et les remarques.
- ✅ « Annuler et remplacer » : l'ancienne ordonnance devient invalide au QR.
- ✅ Cachet manquant : alerte dès la connexion. Le médecin envoie son cachet, l'admin le valide. Cachet obligatoire pour activer la consultation en ligne.
- ✏️ Le patient retrouve ses ordonnances via un **badge sur la carte de consultation** ; l'onglet « Documents » de la navigation les liste aussi (C2).
- ✅ L'admin voit les métadonnées et peut révoquer ; ✏️ pour une ordonnance suspecte, il contacte d'abord le médecin.
- ✅ Le modèle turquoise est la référence de la charte ; ✏️ PDF en latin seulement.

## 7. Cockpit médecin

- ✅ Boîte de réception compacte avec détail au clic.
- ✅ Acceptation immédiate avec « Annuler » pendant 5 s. Motifs de refus prédéfinis. Balayage sur mobile.
- ✅ Contacts du patient masqués jusqu'au paiement.
- ✅ **Semaine type + exceptions**, ✏️ sur un horizon de 4 semaines, avec une pause de 0 à 15 min entre consultations. ✏️ Une vacance qui touche un créneau réservé est refusée. Pas de synchronisation d'agenda.
- ✅ Le médecin modifie son profil ; un changement de tarif est validé par l'admin.
- ✅ Gains par mois avec le détail par acte.
- ✅ Guide de démarrage avec barre de progression. Parrainage en 2 étapes.
- ✏️ Parrainage non rémunéré.
- ✅ Un médecin parrainé est visible **après vérification** de l'admin (numéro d'Ordre + cachet).

## 8. Chirurgie et agent terrain

- ✅ Simulateur de prix total avant la demande. Assistant d'options en étapes. Passeports à compléter jusqu'à J-7.
- ✅ Fiche QR en PDF, consultable hors ligne. Le Wallet Apple/Google demande des certificats (🔌, plus tard).
- ✅ Le patient voit l'agent qui lui est assigné dès J-3. ✏️ Vol facultatif. Retards de vol via une API plus tard.
- ✅ **C'est le médecin qui valide « Intervention réalisée »**, plus l'agent.
- ✅ L'admin assigne les agents. ✏️ Pas d'annulation d'étape. File hors ligne pour l'agent. « Signaler un incident » avec photo. Scanner compatible iPhone.
- ✏️ Logement indisponible : le patient choisit un autre logement. ✏️ Pas de calendrier de blocage par logement.

## 9. Admin

- ✏️ Un seul rôle ADMIN.
- ✅ Navigation en 4 groupes : Aujourd'hui · Activité · Catalogue · Finance.
- ✅ File **« À traiter »**. Fiche médecin en étapes avec l'indicateur « prêt à prescrire ».
- ✅ Import CSV : médicaments d'abord, puis médecins.
- ✏️ Prix modifiés ligne par ligne.
- ✅ Traductions : le FR est obligatoire. EN et AR sont facultatifs et retombent sur le FR ; la traduction automatique demande une API (🔌).
- ✅ Journal d'audit. Double validation (mot de passe) des remboursements de plus de 500 €.
- ✅ Versements en espèces et par virement, par lot mensuel avec relevé PDF. ✏️ Un versement supérieur au solde dû affiche seulement un avertissement. Export CSV mensuel.

## 10. Notifications

- ✅ WhatsApp + email pour le patient, WhatsApp pour le médecin. 🔌 `WHATSAPP_TOKEN` et `WHATSAPP_PHONE_ID` (Meta Cloud API) ; sans eux, repli sur l'email et les journaux.
- ✅ Rappels la veille et 10 min avant.
- ✅ Chaque étape du séjour notifiée.
- ✅ Alerte admin sur le tableau de bord + WhatsApp pour l'urgent.
- ✅ Relance du médecin après 24 h, escalade à 48 h.
- ✅ Planning envoyé à l'agent la veille.
- ✅ Bouton WhatsApp de support discret.

## 11. Corrections d'office

- Paiement impossible à honorer rendu visible et remboursé.
- Confirmation avant tout remboursement.
- Fiche et remboursement des consultations côté admin.
- Contraste AA.
- La carte d'un chirurgien ouvre l'onglet Intervention.
- Libellé « Médecins » au lieu de « Chirurgiens ».
- Consultations en attente de paiement et gains des consultations visibles.
- Traduction arabe « الأطباء ».
- Pluriels corrects.
- Chevauchements de créneaux bloqués.
- Infobulles utilisables au toucher.
