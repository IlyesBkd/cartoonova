# Stockage privé VPS — staging isolé

Aucune installation, aucun service système, aucune modification Next.js, nginx ou production. Python 3.10+ / Linux, bibliothèque standard uniquement. Les fichiers de ce dossier ne mettent rien en ligne.

## Exécution et tests

Depuis `/home/hermes/projects/cartoonova` :

```sh
python3 -B -m unittest discover -s storage-vps -p 'test_*.py' -v
```

Les tests exécutent un vrai serveur HTTP loopback et le point d'entrée dans un sous-processus, sans connexion extérieure. Secret aléatoire généré en mémoire, jamais sauvegardé. Répertoires de test privés créés uniquement ici, nettoyés ensuite.

Pour un futur lancement **manuel et explicitement autorisé** : `python3 -B storage-vps/server.py`, avec environnement injecté par le lanceur :

- `STORAGE_HMAC_SECRET` : chaîne UTF-8 aléatoire de minimum 32 octets, partagée exclusivement avec le serveur Next.js ; jamais `NEXT_PUBLIC_*`, argument CLI, fichier `.env`, document ou log. Pour éviter les différences d'encodage, choisir une chaîne aléatoire ASCII de haute entropie. Aucun secret n'est fourni dans ce dépôt.
- `STORAGE_ROOT` : chemin absolu canonique explicite, sans liens symboliques dans ses ancêtres. Dernier répertoire créé en `0700` si absent ; parent déjà existant. Répertoire final obligatoirement privé et possédé par l'UID du processus. Aucun défaut implicite.
- `STORAGE_PORT` : facultatif, `8765` par défaut ; adresse toujours `127.0.0.1`.
- `STORAGE_CORS_ORIGINS` : origines HTTPS exactes séparées par virgules, sans espaces (ex. origine réelle du site), vide par défaut. Pas de cookies CORS ni de wildcard. CORS ne remplace pas l'autorisation.

`nginx-location.conf.example` et `nginx-cartoonova-files.conf` sont des configurations **non installées**. Le test `test_nginx.py` exerce réellement le proxy nginx HTTPS vers le service Python sur loopback avec certificat synthétique uniquement en mémoire ; il ne valide pas l'installation publique ni le certificat réel. `install-root.sh activate` prépare uniquement les fichiers Cartoonova dédiés, refuse d'écraser une installation existante et exige le compte administrateur du VPS ainsi qu'un secret préalablement provisionné. Aucun accès statique au stockage.

## Contrat HMAC v1

Objet = `/v1/files/{orders|retouches|final|extras}/{id}` ; `id` = 32 caractères hexadécimaux minuscules aléatoires, choisi côté serveur. Aucun nom client, extension, chemin libre, `%` ou segment supplémentaire. Identifiant opaque, **pas une URL publique**.

Grant = `base64url(JSON UTF-8 sans padding).base64url(HMAC-SHA256 sans padding)`.

Message HMAC exact : octets ASCII `cartoonova-storage-v1.` suivis de la partie payload base64url **telle que transmise**. Pas de canonicalisation nécessaire à la vérification ; le helper Python `server.sign(secret_bytes, claims)` utilise JSON compact avec clés triées. Ne pas signer le JSON décodé ni le domaine HTTPS.

Claims obligatoires, sans autre champ :

```json
{"v":1,"method":"PUT","path":"/v1/files/orders/0123456789abcdef0123456789abcdef","exp":1000060,"sha256":"<empreinte SHA-256 lowercase, 64 caractères>","type":"image/jpeg","maxbytes":10485760}
```

L'exemple d'expiration est illustratif, pas un grant utilisable. `exp` = secondes Unix entières, `now < exp <= now + 120` ; synchroniser les horloges. `method` = méthode exacte `PUT` ou `GET`. `maxbytes` entier `1..10485760` ; peut être réduit (PDF compris). Type MIME exact parmi JPEG/PNG/WebP/HEIC/HEIF, `application/pdf`, `application/octet-stream`. **Le service valide le type signé déclaré, pas le format interne, l'innocuité ou la structure PDF/image** : pas de scan antivirus ni transcodage.

### Upload direct navigateur

1. Navigateur calcule le SHA-256 du fichier et transmet taille, MIME et empreinte à une route **Next.js authentifiée**, qui applique autorisation métier, quotas et validation du type. Taille navigateur limitée à 10 MiB avant hachage.
2. Next choisit un nouvel ID et signe le grant PUT, durée recommandée 60 s, `maxbytes` = taille exacte attendue ou plafond autorisé <= 10 MiB. Le secret reste uniquement dans les environnements des deux serveurs. Ne jamais signer un chemin choisi librement par le navigateur.
3. Navigateur fait `PUT https://<stockage>/v1/files/...`, `Authorization: Bearer <grant>`, `Content-Type` signé et corps **binaire brut** (pas multipart/FormData). Fetch fixe Content-Length ; pas de chunked. Grant PUT interdit dans la query string. TLS indispensable hors loopback.
4. `201` renvoie JSON `{path,sha256,bytes}`. Next vérifie l'objet via GET signé puis rattache un descripteur `{provider:'vps',path,sha256,bytes,contentType}` à la commande **après nouvelle autorisation**. Ne pas accepter une déclaration de succès client seule.

Première requête PUT valide réserve définitivement l'ID via `O_CREAT|O_EXCL` et fsync avant lecture du corps. Même un abandon, une empreinte fausse, une expiration en cours ou un crash consomme cet ID ; il faut réautoriser un nouvel ID et décompter un nouveau quota, sans remboursement automatique. Une réservation survit au redémarrage. Aucun overwrite, même avec un nouveau grant. Le `.blob` n'est publié atomiquement qu'après réception complète et vérification SHA-256. Les `.claim` restent ; un crash brutal peut laisser un `.pending` privé (pas de tâche de suppression dans ce prototype).

### Lecture privée / Vercel

- **Chemin recommandé utilisateurs :** navigateur → route de téléchargement Next.js → vérification du droit à cette commande → GET serveur-à-serveur au VPS avec grant GET dans `Authorization` → réponse binaire streamée au navigateur. Le VPS authentifie Vercel par HMAC ; il ne connaît pas l'utilisateur final et ne remplace jamais l'autorisation Next.js.
- Alternative explicitement déléguée : après la même autorisation, Next émet `https://<stockage>/v1/files/...?...` avec **unique** query `grant=<grant GET>`. Cette URL est un bearer token valable au maximum 120 s (30–60 s recommandé), réutilisable pendant ce délai, non publique de manière permanente. Pas de partage/log/analytics ; `Referrer-Policy: no-referrer`. Aucun grant GET ne permet PUT, ni un autre ID.
- GET signe les mêmes champs, avec `method:'GET'`, empreinte/type/taille provenant du descripteur validé. Réponse attachment, `private, no-store`, `nosniff`, pas de rendu HTML ni de liste de fichiers. Chaque lecture recalcule SHA-256 avant réponse. Pas de Range, HEAD ou suppression. Une expiration interdit le début de la lecture ; un transfert déjà autorisé reste borné à 15 s, il n'est pas interrompu précisément à `exp`.

Signature côté Next (Node, **serveur seulement**, après les contrôles métier) :

```js
import { createHmac } from 'node:crypto';
const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
const signature = createHmac('sha256', Buffer.from(process.env.STORAGE_HMAC_SECRET, 'utf8'))
  .update('cartoonova-storage-v1.' + payload, 'ascii').digest('base64url');
const grant = payload + '.' + signature;
```

Codes : `201` upload, `200` lecture, `204` preflight ; `400` chemin/framing/symlink/partiel, `403` auth/expiration, `404` objet non publié, `409` ID consommé ou existant, `411` Content-Length manquant/ambigu, `413` plafond dépassé, `415` type incohérent, `422` SHA-256 incorrect. Timeout = `408` ou connexion fermée ; capacité atteinte = connexion refusée/fermée, pas de file d'attente applicative illimitée. Le client doit traiter les erreurs réseau comme un résultat ambigu et réautoriser un nouvel ID.

## Branchement Cartoonova (non effectué)

Lecture du code existant : `lib/uploadPolicy.ts` impose déjà 10 MiB, images JPEG/PNG/WebP/HEIC/HEIF, quotas transactionnels et réservation 120 s. `createUploadContext` vérifie checkout/session, dépôt/commande payée via `parseOrderTrackingToken`, poster/jeton de confirmation ou admin via `refuserSiPasAdmin`. Reprendre ces contrôles et les quotas **avant de signer**, pas seulement vérifier qu'un utilisateur est connecté ; aucun endpoint générique de signature sans ces contrôles. Pour les lectures, vérifier à nouveau l'appartenance à la commande (ou le jeton métier autorisé/admin), ne pas se contenter de connaître l'ID.

`app/api/upload/route.ts` reste actuellement connecté à Vercel Blob ; `app/api/orders/extras/route.ts` génère des PDF déposés en Blob `access: 'public'`. Cette livraison ne change ni ces routes, ni les URL stockées, ni leurs dépendances (`uploadClient`, `finalImage`, photos, emails). Le futur raccordement doit accepter les descripteurs VPS, assurer autorisation lecture et téléchargement proxy, puis adapter ces consommateurs sans invalider les anciennes commandes.

Cible (décision du 08/11/2026) : **les nouveaux fichiers n'existent que sur le VPS**. Aucune copie de secours n'est faite chez Vercel Blob ni ailleurs : Next.js termine un fichier une fois écrit sur le VPS puis relu et vérifié (SHA-256), et la lecture n'a aucun repli. Une perte du disque du VPS ferait donc perdre ces fichiers, sauf sauvegarde du VPS mise en place à part ; ne pas annoncer de sauvegarde tant qu'elle n'existe pas. Les anciens fichiers déjà sur Vercel Blob restent lisibles à leurs URL publiques actuelles. Ne pas publier d'URL Blob aux utilisateurs comme contournement des contrôles VPS.

## Bornes et limites vérifiées

Lecture/écriture par blocs de 64 KiB, maximum 8 requêtes actives, 16 connexions en backlog, deadline absolue 15 s (headers/corps/réponse), taille 10 MiB par objet, aucune journalisation de requêtes/grants/secrets. Ouvertures Linux par dirfd + `O_NOFOLLOW`, répertoires `0700`, blobs `0400`, réservation exclusive et publication sans remplacement. Le processus et son UID sont de confiance ; un attaquant sous ce même UID peut modifier ses fichiers et lire son environnement. Pas de quota disque global, de rétention ni de nettoyage automatique : conserver les quotas Next et dimensionner le disque avant production. Le service standard-library n'est exposable qu'à travers le reverse proxy HTTPS durci, jamais directement à Internet.
