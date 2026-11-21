# Notifications Telegram progressives Cartoonova

- Spécification : `docs/specs/2026-11-21-telegram-notifications-progressives.md`.
- Signal PostgreSQL : `cartoonova_support_incoming`, contenu fermé `chat` ou `email`. Envoyé après stockage validé ; aucun message client dans le signal.
- Service : `cartoonova-telegram-listener.service`, unité source dans ce dossier. Le lanceur Python charge la configuration existante en mémoire ; aucune valeur secrète dans l'unité.
- Réception : wrappers existants avec `TELEGRAM_RECEIVE_ONLY=1` ; enrichissement : mêmes wrappers sans ce drapeau, sur une voie indépendante.
- Secours : tâches Hermes chat toutes les minutes et support toutes les cinq minutes conservées. Elles réutilisent les mêmes registres durables que le service.
- Réception email : relève IMAP et classement préalables inchangés ; le réveil instantané intervient **après l'enregistrement** dans `support_messages`, pas directement à la réception Gmail.

## Installation locale
Après tests indépendants des travailleurs et du listener, copier l'unité vers `~/.config/systemd/user/cartoonova-telegram-listener.service`, puis :

```
systemctl --user daemon-reload
systemctl --user enable --now cartoonova-telegram-listener.service
systemctl --user is-active cartoonova-telegram-listener.service
```

Vérifier le journal du service sans afficher de configuration (`journalctl --user -u cartoonova-telegram-listener.service`). Les erreurs volontairement génériques ne contiennent ni texte client ni URL de connexion.

Pour revenir au seul fonctionnement périodique : arrêter le service ; les deux tâches existantes restent actives. Ne jamais réinitialiser leurs registres pour réessayer un envoi incertain.
