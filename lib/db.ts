import postgres from "postgres";
import { timingSafeEqual } from "node:crypto";
import type { Duplex } from "node:stream";
import { Client as SshClient } from "ssh2";
import type { Prices, PriceSet, PricesByCurrency } from "./types";
import { DEFAULT_PRICES, DEFAULT_PRICES_BY_CURRENCY } from "./types";
import type { Currency } from "./currency";
import { convertPrice, currencies, exchangeRates } from "./currency";
import type { OrigineVisite } from "./origineVisite";

// ─── Connexion PostgreSQL sur le VPS ─────────────────────────────────
/* Le quota Neon a bloque l'admin (HTTP 402). En production, le PostgreSQL du
   VPS reste lie a localhost et chaque instance Vercel ouvre un tunnel SSH
   epingle vers lui. Les jobs GitHub ouvrent le meme tunnel avant de lancer
   leurs scripts. Une connexion PostgreSQL par instance limite la charge du
   VPS. Le mot de passe PostgreSQL protege aussi le tunnel SSH. Une URL locale
   sans tunnel convient aux runners GitHub et au developpement via `ssh -L`;
   les URL distantes directes conservent TLS pour les environnements locaux. */
type ClientSql = ReturnType<typeof postgres>;
let clientSql: ClientSql | undefined;

function openDatabaseTunnel(hosts: string[], ports: number[]): Promise<Duplex> {
  const [databaseHost] = hosts;
  const [databasePort] = ports;
  const sshHost = process.env.DATABASE_SSH_HOST;
  const sshUser = process.env.DATABASE_SSH_USER;
  const privateKey = process.env.DATABASE_SSH_PRIVATE_KEY;
  const expectedFingerprint = process.env.DATABASE_SSH_HOST_KEY_SHA256?.toLowerCase();

  if (!databaseHost || !databasePort || !sshHost || !sshUser || !privateKey) {
    throw new Error("Configuration du tunnel SSH PostgreSQL manquante.");
  }
  if (!expectedFingerprint || !/^[a-f0-9]{64}$/.test(expectedFingerprint)) {
    throw new Error("DATABASE_SSH_HOST_KEY_SHA256 doit contenir l'empreinte SHA-256 hexadecimale de la cle SSH du VPS.");
  }

  return new Promise((resolve, reject) => {
    const ssh = new SshClient();
    let settled = false;
    let forwardedSocket: Duplex | undefined;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      ssh.end();
      reject(error);
    };

    ssh.once("error", fail);
    ssh.once("close", () => {
      if (!settled) {
        fail(new Error("La connexion SSH a ferme avant l'ouverture du tunnel PostgreSQL."));
      } else if (forwardedSocket && !forwardedSocket.destroyed) {
        forwardedSocket.destroy(new Error("La connexion SSH PostgreSQL a ete fermee."));
      }
    });
    ssh.once("ready", () => {
      ssh.forwardOut("127.0.0.1", 0, databaseHost, databasePort, (error, socket) => {
        if (error) return fail(error);
        settled = true;
        forwardedSocket = socket;
        ssh.removeListener("error", fail);
        ssh.on("error", (sshError) => {
          if (!socket.destroyed) socket.destroy();
        });
        socket.once("close", () => ssh.end());
        resolve(socket);
      });
    });

    const sshPort = Number(process.env.DATABASE_SSH_PORT || 22);
    if (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65_535) {
      fail(new Error("DATABASE_SSH_PORT doit etre un port valide."));
      return;
    }

    ssh.connect({
      host: sshHost,
      port: sshPort,
      username: sshUser,
      privateKey,
      hostHash: "sha256",
      algorithms: { serverHostKey: ["ssh-ed25519"] },
      hostVerifier: (fingerprint) => {
        if (typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/i.test(fingerprint)) return false;
        return timingSafeEqual(Buffer.from(fingerprint, "hex"), Buffer.from(expectedFingerprint, "hex"));
      },
      readyTimeout: 10_000,
      keepaliveInterval: 15_000,
      keepaliveCountMax: 2,
    });
  });
}

function getClientSql(): ClientSql {
  if (clientSql) return clientSql;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL manquante.");
  const databaseHost = new URL(databaseUrl).hostname;
  const usesSshTunnel = Boolean(process.env.DATABASE_SSH_HOST);
  const databaseIsLocal = ["127.0.0.1", "localhost", "::1"].includes(databaseHost);
  const options = {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    ssl: usesSshTunnel || databaseIsLocal ? false : "verify-full",
    ...(usesSshTunnel
      ? { socket: (connection: { host: string[]; port: number[] }) => openDatabaseTunnel(connection.host, connection.port) }
      : {}),
  } as NonNullable<Parameters<typeof postgres>[1]> & {
    socket?: (connection: { host: string[]; port: number[] }) => Promise<Duplex>;
  };
  clientSql = postgres(databaseUrl, options);
  return clientSql;
}

/* L'interface actuelle n'utilise que les requetes taguees. Garder le client
   paresseux evite qu'un build Next sans secrets d'execution tente de se
   connecter a la base. */
export const sql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  getClientSql()(strings, ...values)) as ClientSql;

// ─── Orders ──────────────────────────────────────────────────────────
/** Options cadeau saisies au paiement. Absentes quand ce n'est pas un cadeau. */
export interface GiftOptions {
  message: string | null;
  recipientEmail: string | null;
  /** Date AAAA-MM-JJ avant laquelle le portrait ne doit pas etre envoye. */
  deliverAfter: string | null;
}

export interface OrderOptions {
  format: string;
  people: number;
  animals: number;
  background: string;
  printOption: string;
  gift?: GiftOptions | null;
  style?: string;
  description?: string;
  phone?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  addressLine2?: string;
}

export interface DbOrder {
  id: string;
  payment_intent_id: string;
  customer_email: string;
  customer_name: string | null;
  customer_address: string | null;
  total_price: number;
  currency: string;
  options: OrderOptions;
  photo_urls: string[];
  status: string;
  created_at: string;
  detected_country: string | null;
  final_image_url: string | null;
  final_image_sent_at: string | null;
  /** Date a laquelle l'e-mail d'illustration finale doit partir.
      Null = rien de programme (jamais programme, annule, ou deja parti). */
  final_image_scheduled_at: string | null;
  poster_confirmation_token: string | null;
  poster_confirmation_sent_at: string | null;
  poster_confirmation_status: "confirmed" | "changes_requested" | null;
  poster_confirmation_responded_at: string | null;
  poster_confirmation_note: string | null;
  poster_confirmation_photos: string[] | null;
  /** Cout de revient en euros. Null tant qu'il n'a pas ete saisi. */
  cout: number | null;
  /** Ce que ce cout recouvre — impression, port, sous-traitance. */
  cout_note: string | null;
  /** Numero de commande chez l'imprimeur (Optimal Print). Usage interne. */
  fournisseur_ref: string | null;
  /** Lien de suivi du colis, tel que le transporteur le fournit. */
  suivi_url: string | null;
  /** Nom du transporteur, saisi librement. Null quand il n'est pas connu. */
  suivi_transporteur: string | null;
  /** Date de remise au transporteur. Null tant que le colis n'est pas parti. */
  expedie_le: string | null;
  /** Date du dernier envoi de l'e-mail d'expedition au client. */
  expedition_email_envoye_le: string | null;
  /* Ajoutees par `ensureOrderPromoSchema` dans app/api/order/create : les
     colonnes existaient en base mais pas dans le type, donc toute lecture les
     ignorait silencieusement. */
  promo_code: string | null;
  discount_amount: number | null;
  /* Posee par `ensureLifecycleSchema`, meme oubli que ci-dessus : le tableau
     de bord ne pouvait pas savoir qu'un avis avait deja ete demande. */
  review_request_sent_at: string | null;
  /** Date a laquelle l'absence de photos a ete signalee. Null = jamais. */
  photos_alerte_le: string | null;
  /** Origine de la premiere visite. Null pour les commandes anterieures. */
  origine: OrigineVisite | null;
}

export async function getOrders(): Promise<DbOrder[]> {
  /* `SELECT *` ne ramene que les colonnes qui existent. Sans cette garantie,
     le tableau de bord d'une base pas encore migree afficherait un bloc
     Expedition vide et sans explication. */
  await ensureExpeditionSchema();
  await ensureEnvoiProgrammeSchema();
  const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
  return rows as unknown as DbOrder[];
}

export async function getOrderByPaymentId(paymentIntentId: string): Promise<DbOrder | null> {
  const rows = await sql`
    SELECT * FROM orders WHERE payment_intent_id = ${paymentIntentId}
  `;
  return (rows[0] as unknown as DbOrder) || null;
}

/** Lecture d'une commande par identifiant, pour la page de suivi client. */
export async function getOrderById(orderId: string): Promise<DbOrder | null> {
  const rows = await sql`SELECT * FROM orders WHERE id = ${orderId}::uuid`;
  return (rows[0] as unknown as DbOrder) || null;
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  await sql`
    UPDATE orders SET status = ${status} WHERE id = ${orderId}::uuid
  `;
}

/**
 * Passe une commande en PAID — au plus une fois, quoi qu'il arrive.
 *
 * C'est la piece qui rend le webhook Stripe sur : deux appelants tentent
 * desormais cette transition en meme temps. Stripe emet
 * `payment_intent.succeeded` a l'instant meme ou il redirige le navigateur
 * vers /success, et les deux chemins courent l'un contre l'autre.
 *
 * La verification etait jusqu'ici un `SELECT` suivi d'un `UPDATE` — deux
 * requetes separees. Avec un seul appelant cela passait. Avec deux, les deux
 * lisent PENDING avant que l'un des deux n'ecrive, et les deux se croient
 * legitimes : deux e-mails de confirmation au client, deux notifications
 * Discord, un chiffre d'affaires double.
 *
 * Ici la lecture et l'ecriture sont la meme requete. La condition
 * `status <> 'PAID'` est evaluee par PostgreSQL au moment de l'ecriture, sous
 * le verrou de ligne : le second appelant ne trouve plus rien a mettre a jour
 * et repart avec `false`. Un seul declenche les effets de bord.
 *
 * Renvoie `true` au gagnant, `false` a tous les autres.
 */
export async function marquerPayee(orderId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE orders
    SET status = 'PAID'
    WHERE id = ${orderId}::uuid AND status <> 'PAID'
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Enregistre les photos deposees apres paiement.
 *
 * La liste remplace la precedente plutot que de s'y ajouter : la page de depot
 * envoie toujours l'etat complet de ce que le client a choisi, et un ajout
 * cumulatif rendrait impossible de retirer une photo envoyee par erreur.
 *
 * Renvoie la commande mise a jour, ou null si l'identifiant n'existe pas — ce
 * qui laisse a l'appelant le soin de distinguer un lien perime d'un echec.
 */
export async function enregistrerPhotosCommande(
  orderId: string,
  photoUrls: string[]
): Promise<DbOrder | null> {
  const rows = await sql`
    UPDATE orders
    SET photo_urls = ${JSON.stringify(photoUrls)}::jsonb
    WHERE id = ${orderId}::uuid
    RETURNING *
  `;
  return (rows[0] as unknown as DbOrder) || null;
}

/** Commandes payees dont les photos manquent encore, pour la relance. */
/**
 * Commandes payees sans photo, dans une fenetre bornee des DEUX cotes.
 *
 * La borne haute manquait, et c'est ce qui a produit une alerte quotidienne
 * pendant cinq mois : une commande de 159 jours ressortait a chaque passage,
 * franchissait le seuil, declenchait le signalement, et recommencait le
 * lendemain. Meme raison que pour le panier abandonne — au-dela d'un certain
 * age le contexte a disparu, et un rappel de plus ne sauve rien.
 */
export async function getOrdersAwaitingPhotos(
  minHours: number,
  maxJours = 30
): Promise<DbOrder[]> {
  const rows = await sql`
    SELECT * FROM orders
    WHERE status = 'PAID'
      AND (photo_urls IS NULL OR jsonb_array_length(photo_urls) = 0)
      AND created_at < NOW() - (${minHours} || ' hours')::interval
      AND created_at > NOW() - (${maxJours} || ' days')::interval
    ORDER BY created_at
  `;
  return rows as unknown as DbOrder[];
}

/** Marque qu'on a signale cette commande, pour ne pas le refaire chaque nuit. */
export async function marquerAlertePhotos(orderId: string): Promise<void> {
  await sql`UPDATE orders SET photos_alerte_le = NOW() WHERE id = ${orderId}::uuid`;
}

/**
 * Enregistre le cout de revient d'une commande.
 *
 * `null` efface la saisie plutot que d'ecrire zero : « pas encore renseigne »
 * et « ne m'a rien coute » sont deux choses differentes, et les confondre
 * fausserait toute moyenne.
 */
export async function enregistrerCoutCommande(
  orderId: string,
  cout: number | null,
  note: string | null
): Promise<void> {
  await ensurePosterConfirmationSchema();
  await sql`
    UPDATE orders SET cout = ${cout}, cout_note = ${note}
    WHERE id = ${orderId}::uuid
  `;
}

// ─── Expedition (commandes physiques) ────────────────────────────────

/**
 * Les colonnes du suivi de colis.
 *
 * Posees a part plutot qu'ajoutees a `ensurePosterConfirmationSchema` : ce
 * bloc-la porte deja trois sujets etrangers a son nom, et chaque ajout rend
 * plus difficile de savoir quelle migration a pose quoi.
 */
let expeditionSchemaReady: Promise<void> | null = null;

async function ensureExpeditionSchema(): Promise<void> {
  if (expeditionSchemaReady) return expeditionSchemaReady;
  expeditionSchemaReady = (async () => {
    /* Le numero de commande chez l'imprimeur. Il ne part JAMAIS au client :
       c'est la reference qui permet de retrouver le dossier chez le
       sous-traitant quand un colis se perd, rien d'autre. */
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS fournisseur_ref TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS suivi_url TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS suivi_transporteur TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS expedie_le TIMESTAMPTZ`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS expedition_email_envoye_le TIMESTAMPTZ`;
  })().catch((e) => {
    expeditionSchemaReady = null;
    throw e;
  });
  return expeditionSchemaReady;
}

/**
 * Enregistre le dossier d'expedition, sans rien envoyer au client.
 *
 * Les trois champs s'ecrivent ensemble parce qu'ils se saisissent ensemble :
 * le tableau de bord les presente dans le meme bloc et poste toujours l'etat
 * complet. `null` efface — c'est ainsi qu'on corrige une faute de frappe.
 */
export async function enregistrerExpedition(
  orderId: string,
  fournisseurRef: string | null,
  suiviUrl: string | null,
  transporteur: string | null
): Promise<void> {
  await ensureExpeditionSchema();
  await sql`
    UPDATE orders
    SET fournisseur_ref = ${fournisseurRef},
        suivi_url = ${suiviUrl},
        suivi_transporteur = ${transporteur}
    WHERE id = ${orderId}::uuid
  `;
}

/**
 * Marque le colis comme parti et l'e-mail comme envoye.
 *
 * `expedie_le` ne se reecrit pas a chaque renvoi : la date d'expedition est
 * celle du premier depart, meme si le client redemande le lien trois jours
 * plus tard. La date d'e-mail, elle, suit le dernier envoi.
 *
 * Le statut passe a `shipped` dans la foulee. C'est le meme evenement dit deux
 * fois — un colis dont le client a recu le lien de suivi EST expedie — et le
 * laisser a une seconde manipulation garantissait qu'il resterait a « Terminée ».
 */
export async function marquerExpediee(orderId: string): Promise<void> {
  await ensureExpeditionSchema();
  await sql`
    UPDATE orders
    SET expedie_le = COALESCE(expedie_le, NOW()),
        expedition_email_envoye_le = NOW(),
        status = 'shipped'
    WHERE id = ${orderId}::uuid
  `;
}

export async function updateOrderFinalImage(orderId: string, finalImageUrl: string): Promise<void> {
  await sql`
    UPDATE orders SET final_image_url = ${finalImageUrl} WHERE id = ${orderId}::uuid
  `;
}

export async function markFinalImageSent(orderId: string): Promise<void> {
  await ensureEnvoiProgrammeSchema();
  /* Le rendez-vous est efface en meme temps : il est tenu. Le laisser en place
     ferait ressortir la commande au passage suivant du cron, qui renverrait le
     meme portrait au meme client. */
  await sql`
    UPDATE orders
    SET final_image_sent_at = NOW(), final_image_scheduled_at = NULL
    WHERE id = ${orderId}::uuid
  `;
}

// ─── Envoi differe de l'illustration finale ──────────────────────────
/* Voir lib/envoiProgramme.ts pour le calcul de la date, et le cron
   `lifecycle-emails` pour l'envoi lui-meme. */

let envoiProgrammeSchemaReady: Promise<void> | null = null;

async function ensureEnvoiProgrammeSchema(): Promise<void> {
  if (envoiProgrammeSchemaReady) return envoiProgrammeSchemaReady;
  envoiProgrammeSchemaReady = (async () => {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_image_scheduled_at TIMESTAMPTZ`;
    /* Le cron balaie la table entiere a chaque passage pour trouver les quelques
       commandes echues. L'index partiel ne porte que sur celles en attente. */
    await sql`
      CREATE INDEX IF NOT EXISTS orders_final_image_scheduled_idx
      ON orders (final_image_scheduled_at)
      WHERE final_image_scheduled_at IS NOT NULL
    `;
  })().catch((e) => {
    envoiProgrammeSchemaReady = null;
    throw e;
  });
  return envoiProgrammeSchemaReady;
}

/** Pose ou deplace le rendez-vous d'envoi. Ecrase une programmation existante. */
export async function programmerEnvoiImageFinale(orderId: string, quand: Date): Promise<void> {
  await ensureEnvoiProgrammeSchema();
  await sql`
    UPDATE orders
    SET final_image_scheduled_at = ${quand.toISOString()}
    WHERE id = ${orderId}::uuid
  `;
}

/** Retire le rendez-vous sans rien envoyer. */
export async function annulerEnvoiImageFinale(orderId: string): Promise<void> {
  await ensureEnvoiProgrammeSchema();
  await sql`
    UPDATE orders SET final_image_scheduled_at = NULL WHERE id = ${orderId}::uuid
  `;
}

/**
 * Programme l'envoi seulement si rien n'est deja prevu ni deja parti.
 *
 * Le depot d'image passe par ici, et « Remplacer » emprunte exactement le meme
 * chemin que le premier depot : sans cette condition, corriger un detail apres
 * coup repousserait l'envoi d'un ou deux jours de plus a chaque correction, et
 * remplacer l'image d'une commande deja livree en programmerait un second envoi.
 *
 * Renvoie la date retenue, ou null si rien n'a ete pose.
 */
export async function programmerEnvoiImageFinaleSiLibre(
  orderId: string,
  quand: Date
): Promise<Date | null> {
  await ensureEnvoiProgrammeSchema();
  const rows = await sql`
    UPDATE orders
    SET final_image_scheduled_at = ${quand.toISOString()}
    WHERE id = ${orderId}::uuid
      AND final_image_scheduled_at IS NULL
      AND final_image_sent_at IS NULL
    RETURNING final_image_scheduled_at
  `;
  return rows.length ? quand : null;
}

/** Commande dont l'illustration finale doit partir maintenant. */
export interface CommandeAEnvoyer {
  id: string;
  customer_email: string;
  customer_name: string | null;
  detected_country: string | null;
  final_image_url: string;
  options: OrderOptions;
}

/**
 * Commandes echues : la date est passee et l'image est toujours la.
 *
 * `final_image_url IS NOT NULL` n'est pas de la prudence de facade — l'admin
 * peut remplacer l'image entre la programmation et l'envoi, et une commande
 * sans image produirait un e-mail avec une balise `img` vide.
 */
export async function getOrdersDueForFinalImage(): Promise<CommandeAEnvoyer[]> {
  await ensureEnvoiProgrammeSchema();
  const rows = await sql`
    SELECT id, customer_email, customer_name, detected_country, final_image_url, options
    FROM orders
    WHERE final_image_scheduled_at IS NOT NULL
      AND final_image_scheduled_at <= NOW()
      AND final_image_sent_at IS NULL
      AND final_image_url IS NOT NULL
      AND customer_email IS NOT NULL
    ORDER BY final_image_scheduled_at ASC
  `;
  return rows as unknown as CommandeAEnvoyer[];
}

// ─── Poster confirmation ─────────────────────────────────────────────

let posterConfirmationSchemaReady: Promise<void> | null = null;

async function ensurePosterConfirmationSchema(): Promise<void> {
  if (posterConfirmationSchemaReady) return posterConfirmationSchemaReady;
  posterConfirmationSchemaReady = (async () => {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS poster_confirmation_token TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS poster_confirmation_sent_at TIMESTAMPTZ`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS poster_confirmation_status TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS poster_confirmation_responded_at TIMESTAMPTZ`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS poster_confirmation_note TEXT`;
    /* Photos jointes a une demande de retouche. Une demande sur un portrait est
       presque toujours visuelle — un tatouage oublie, une coupe de cheveux, une
       photo de reference — et sans ce champ le client devait sortir de la page
       pour envoyer un e-mail. C'est exactement ce qui s'est passe en mai. */
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS poster_confirmation_photos JSONB`;
    /* Ce que la commande a coute, EN EUROS.
       Le chiffre d'affaires arrive en neuf devises ; la depense, elle, se
       fait dans une seule — imprimeur, expedition, illustrateur. Stocker les
       deux dans la meme unite rendrait la marge incalculable sans connaitre
       le taux du jour de la commande, qu'on ne garde pas. */
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cout NUMERIC`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cout_note TEXT`;
    /* D'ou vient le client, retenu au premier contact. La question s'est posee
       sur une vente reelle sans pouvoir etre tranchee : rien n'etait garde ici,
       et la reponse dormait dans un outil tiers. */
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS origine JSONB`;
    /* Date du signalement « photos jamais envoyees ». Sans elle, l'alerte
       repartait a chaque passage du cron pour la meme commande. */
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS photos_alerte_le TIMESTAMPTZ`;
  })().catch((e) => {
    posterConfirmationSchemaReady = null;
    throw e;
  });
  return posterConfirmationSchemaReady;
}

export async function setPosterConfirmationToken(orderId: string, token: string): Promise<void> {
  await ensurePosterConfirmationSchema();
  await sql`
    UPDATE orders
    SET poster_confirmation_token = ${token},
        poster_confirmation_sent_at = NOW(),
        poster_confirmation_status = NULL,
        poster_confirmation_responded_at = NULL,
        poster_confirmation_note = NULL,
        poster_confirmation_photos = NULL
    WHERE id = ${orderId}::uuid
  `;
}

export async function getOrderByConfirmationToken(token: string): Promise<DbOrder | null> {
  await ensurePosterConfirmationSchema();
  const rows = await sql`
    SELECT * FROM orders WHERE poster_confirmation_token = ${token}
  `;
  return (rows[0] as unknown as DbOrder) || null;
}

export async function recordPosterConfirmationResponse(
  token: string,
  status: "confirmed" | "changes_requested",
  note?: string | null,
  photos?: string[] | null,
  previousRespondedAt?: string | null
): Promise<{ order: DbOrder | null; changed: boolean; conflict: boolean }> {
  await ensurePosterConfirmationSchema();
  const normalizedNote = note?.trim() || null;
  const normalizedPhotos = photos?.length ? JSON.stringify(photos) : null;
  const rows = await sql`
    UPDATE orders
    SET poster_confirmation_status = ${status},
        poster_confirmation_responded_at = NOW(),
        poster_confirmation_note = ${normalizedNote},
        poster_confirmation_photos = ${normalizedPhotos}::jsonb
    WHERE poster_confirmation_token = ${token}
      AND (
        (${previousRespondedAt ?? null}::timestamptz IS NULL AND poster_confirmation_responded_at IS NULL)
        OR poster_confirmation_responded_at = ${previousRespondedAt ?? null}::timestamptz
      )
      AND (
        poster_confirmation_status IS DISTINCT FROM ${status}
        OR poster_confirmation_note IS DISTINCT FROM ${normalizedNote}
        OR poster_confirmation_photos IS DISTINCT FROM ${normalizedPhotos}::jsonb
      )
    RETURNING *
  `;
  const updated = (rows[0] as unknown as DbOrder) || null;
  if (updated) return { order: updated, changed: true, conflict: false };

  const current = await getOrderByConfirmationToken(token);
  if (!current) return { order: null, changed: false, conflict: false };

  const currentPhotos = current.poster_confirmation_photos ?? null;
  const samePhotos = JSON.stringify(currentPhotos) === JSON.stringify(photos?.length ? photos : null);
  const sameResponse =
    current.poster_confirmation_status === status &&
    (current.poster_confirmation_note || null) === normalizedNote &&
    samePhotos;

  return { order: current, changed: false, conflict: !sameResponse };
}

// ─── Support inbox (IMAP sync) ────────────────────────────────────────

export type SupportMessageCategory = "customer" | "notification" | "spam";

export interface SupportMessage {
  id: number;
  message_id: string;
  from_email: string;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  order_id: string | null;
  read_at: string | null;
  created_at: string;
  category: SupportMessageCategory | null;
  /** Ce qui est PARTI en reponse a ce message, du plus ancien au plus recent. */
  replies: SupportReply[];
}

/**
 * Une reponse envoyee depuis l'admin.
 *
 * ── Pourquoi une table et pas un `replied_at` sur le message ─────────────
 *
 * Une colonne de date dirait qu'on a repondu, pas CE QU'ON A REPONDU. Or
 * c'est la seule chose qui compte quand le client relance trois jours plus
 * tard : sans le texte parti, on relit sa question et on redige une deuxieme
 * fois, parfois autrement. Le fil est la matiere du support, pas son
 * horodatage.
 *
 * Et une reponse n'est pas unique. Un echange de retouches en compte trois ou
 * quatre sur le meme message d'origine — exactement la raison qui a fait
 * naitre la table `retouches` a cote de `poster_confirmation_note`.
 */
export interface SupportReply {
  id: number;
  /**
   * Le message auquel on repond — null quand c'est nous qui ouvrons le fil.
   *
   * Une question posee dans la case « instructions » a la commande n'est
   * arrivee par aucun e-mail : il n'y a rien a quoi se rattacher, et pourtant
   * il faut y repondre. C'etait le dernier endroit du tableau de bord ou un
   * `mailto:` restait la seule issue.
   */
  support_message_id: number | null;
  /**
   * La commande concernee. Recopiee du message parent quand il y en a un.
   *
   * Sans cette colonne, un courrier ouvert depuis une fiche commande
   * n'appartiendrait a rien : ni a un fil, ni a une commande. Il faudrait le
   * chercher par l'adresse du client, ce qui est exactement le repli fragile
   * que la synchro IMAP n'utilise qu'en dernier recours.
   */
  order_id: string | null;
  to_email: string;
  subject: string;
  body_text: string;
  /**
   * Vrai quand un brouillon IA a servi de base — meme corrige a la main
   * avant l'envoi.
   *
   * Ce n'est pas une statistique pour le plaisir. Le jour ou un client
   * conteste une promesse qu'on lui aurait faite par e-mail, savoir si la
   * phrase vient d'un modele ou d'une personne change la lecture de
   * l'echange.
   */
  assistee_ia: boolean;
  /** Identifiant Resend de l'envoi. Null si le fournisseur n'en a pas rendu. */
  provider_id: string | null;
  sent_at: string;
}

let supportInboxSchemaReady: Promise<void> | null = null;

async function ensureSupportInboxSchema(): Promise<void> {
  if (supportInboxSchemaReady) return supportInboxSchemaReady;
  supportInboxSchemaReady = (async () => {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_outbound_message_id TEXT`;
    await sql`
      CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        message_id TEXT UNIQUE NOT NULL,
        from_email TEXT NOT NULL,
        subject TEXT,
        body_text TEXT,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        order_id UUID REFERENCES orders(id),
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS category TEXT`;
    await sql`
      CREATE TABLE IF NOT EXISTS support_replies (
        id                 SERIAL PRIMARY KEY,
        support_message_id INTEGER REFERENCES support_messages(id) ON DELETE CASCADE,
        order_id           UUID REFERENCES orders(id),
        to_email           TEXT NOT NULL,
        subject            TEXT NOT NULL,
        body_text          TEXT NOT NULL,
        assistee_ia        BOOLEAN NOT NULL DEFAULT FALSE,
        provider_id        TEXT,
        sent_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    /* Les deux assouplissements qui suivent portent sur une table peut-etre
       deja creee par la version precedente : `CREATE TABLE IF NOT EXISTS` ne
       la modifie pas, ces deux lignes si. */
    await sql`ALTER TABLE support_replies ALTER COLUMN support_message_id DROP NOT NULL`;
    await sql`ALTER TABLE support_replies ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id)`;
    /* La lecture se fait par message dans l'onglet Support, par commande dans
       la fiche : les deux chemins ont leur index. */
    await sql`
      CREATE INDEX IF NOT EXISTS support_replies_message
      ON support_replies (support_message_id, sent_at)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS support_replies_commande
      ON support_replies (order_id, sent_at)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS imap_sync_state (
        id TEXT PRIMARY KEY DEFAULT 'singleton',
        last_uid INTEGER NOT NULL DEFAULT 0,
        last_synced_at TIMESTAMPTZ
      )
    `;
    await sql`INSERT INTO imap_sync_state (id, last_uid) VALUES ('singleton', 0) ON CONFLICT (id) DO NOTHING`;
  })().catch((e) => {
    supportInboxSchemaReady = null;
    throw e;
  });
  return supportInboxSchemaReady;
}

export async function setOrderLastOutboundMessageId(orderId: string, messageId: string): Promise<void> {
  await ensureSupportInboxSchema();
  await sql`UPDATE orders SET last_outbound_message_id = ${messageId} WHERE id = ${orderId}::uuid`;
}

export async function findOrderByOutboundMessageId(messageId: string): Promise<{ id: string } | null> {
  await ensureSupportInboxSchema();
  const rows = await sql`SELECT id FROM orders WHERE last_outbound_message_id = ${messageId} LIMIT 1`;
  return (rows[0] as { id: string }) || null;
}

export async function findOrderByCustomerEmail(email: string): Promise<{ id: string } | null> {
  const rows = await sql`
    SELECT id FROM orders WHERE lower(customer_email) = lower(${email}) ORDER BY created_at DESC LIMIT 1
  `;
  return (rows[0] as { id: string }) || null;
}

export async function getImapSyncState(): Promise<{ lastUid: number }> {
  await ensureSupportInboxSchema();
  const rows = await sql`SELECT last_uid FROM imap_sync_state WHERE id = 'singleton'`;
  return { lastUid: Number(rows[0]?.last_uid ?? 0) };
}

export async function setImapSyncState(lastUid: number): Promise<void> {
  await ensureSupportInboxSchema();
  await sql`
    UPDATE imap_sync_state SET last_uid = ${lastUid}, last_synced_at = NOW() WHERE id = 'singleton'
  `;
}

export async function insertSupportMessage(msg: {
  messageId: string;
  fromEmail: string;
  subject: string | null;
  bodyText: string | null;
  receivedAt: Date;
  orderId: string | null;
  category: SupportMessageCategory | null;
}): Promise<{ isNew: boolean }> {
  await ensureSupportInboxSchema();
  const rows = await sql`
    INSERT INTO support_messages (message_id, from_email, subject, body_text, received_at, order_id, category)
    VALUES (
      ${msg.messageId}, ${msg.fromEmail}, ${msg.subject}, ${msg.bodyText}, ${msg.receivedAt.toISOString()},
      ${msg.orderId ? msg.orderId : null}::uuid, ${msg.category}
    )
    ON CONFLICT (message_id) DO NOTHING
    RETURNING id
  `;
  return { isNew: rows.length > 0 };
}

/* Les reponses voyagent AVEC les messages, dans la meme requete.

   L'alternative — une seconde route que le tableau de bord appellerait en
   plus — reproduirait le defaut que le fil de la fiche commande vient de
   corriger : une information deja en base, mais invisible faute d'etre
   chargee. Ici le cout est nul, le sous-select ne ramenant que les reponses
   des deux cents messages affiches. */
export async function getSupportMessages(): Promise<SupportMessage[]> {
  await ensureSupportInboxSchema();
  const rows = await sql`
    SELECT
      m.*,
      COALESCE(
        (
          SELECT json_agg(r ORDER BY r.sent_at)
          FROM support_replies r
          WHERE r.support_message_id = m.id
        ),
        '[]'::json
      ) AS replies
    FROM support_messages m
    ORDER BY m.received_at DESC
    LIMIT 200
  `;
  return rows as unknown as SupportMessage[];
}

/** Un message et son fil, pour les routes qui repondent. */
export async function getSupportMessageById(id: number): Promise<SupportMessage | null> {
  await ensureSupportInboxSchema();
  const rows = await sql`
    SELECT
      m.*,
      COALESCE(
        (
          SELECT json_agg(r ORDER BY r.sent_at)
          FROM support_replies r
          WHERE r.support_message_id = m.id
        ),
        '[]'::json
      ) AS replies
    FROM support_messages m
    WHERE m.id = ${id}
  `;
  return (rows[0] as unknown as SupportMessage) || null;
}

export async function insertSupportReply(reply: {
  supportMessageId: number | null;
  orderId: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
  assisteeIa: boolean;
  providerId: string | null;
}): Promise<SupportReply> {
  await ensureSupportInboxSchema();
  const rows = await sql`
    INSERT INTO support_replies (support_message_id, order_id, to_email, subject, body_text, assistee_ia, provider_id)
    VALUES (
      ${reply.supportMessageId}, ${reply.orderId ? reply.orderId : null}::uuid, ${reply.toEmail},
      ${reply.subject}, ${reply.bodyText}, ${reply.assisteeIa}, ${reply.providerId}
    )
    RETURNING *
  `;
  return rows[0] as unknown as SupportReply;
}

/**
 * Tout ce qui est parti du support, recemment.
 *
 * La fiche commande ne peut pas se contenter des reponses portees par les
 * messages recus : un courrier qu'on a ouvert soi-meme n'est accroche a aucun
 * message, et resterait invisible la ou on vient justement verifier si on a
 * ecrit au client. C'est la meme lecon que le fil de la fiche commande — une
 * donnee deja en base ne sert a rien tant qu'elle n'est pas chargee.
 */
export async function getSupportOutbox(): Promise<SupportReply[]> {
  await ensureSupportInboxSchema();
  const rows = await sql`SELECT * FROM support_replies ORDER BY sent_at DESC LIMIT 200`;
  return rows as unknown as SupportReply[];
}

export async function markSupportMessageRead(id: number): Promise<void> {
  await ensureSupportInboxSchema();
  await sql`UPDATE support_messages SET read_at = NOW() WHERE id = ${id}`;
}

export async function getUnclassifiedSupportMessages(limit: number): Promise<SupportMessage[]> {
  await ensureSupportInboxSchema();
  const rows = await sql`
    SELECT * FROM support_messages WHERE category IS NULL ORDER BY received_at DESC LIMIT ${limit}
  `;
  return rows as unknown as SupportMessage[];
}

export async function countUnclassifiedSupportMessages(): Promise<number> {
  await ensureSupportInboxSchema();
  const rows = await sql`SELECT COUNT(*)::int AS c FROM support_messages WHERE category IS NULL`;
  return Number(rows[0]?.c ?? 0);
}

export async function setSupportMessageCategory(id: number, category: SupportMessageCategory): Promise<void> {
  await ensureSupportInboxSchema();
  await sql`UPDATE support_messages SET category = ${category} WHERE id = ${id}`;
}

// ─── Prices ──────────────────────────────────────────────────────────

let pricesSchemaReady: Promise<void> | null = null;

async function ensurePricesSchema(): Promise<void> {
  if (pricesSchemaReady) return pricesSchemaReady;
  pricesSchemaReady = (async () => {
    await sql`ALTER TABLE prices ADD COLUMN IF NOT EXISTS data JSONB`;
    const rows = await sql`SELECT data, base, fullbody_extra, extra_person, extra_animal, digital, canvas, poster, poster_simple FROM prices WHERE id = 'singleton'`;
    if (!rows.length) return;
    const r = rows[0] as Record<string, unknown>;
    if (r.data) return;
    const eur: PriceSet = {
      base: Number(r.base),
      fullbodyExtra: Number(r.fullbody_extra),
      extraPerson: Number(r.extra_person),
      extraAnimal: Number(r.extra_animal),
      digital: Number(r.digital),
      canvas: Number(r.canvas),
      poster: Number(r.poster),
      posterSimple: Number(r.poster_simple),
    };
    const scale = (rate: number): PriceSet =>
      Object.fromEntries(
        Object.entries(eur).map(([k, v]) => [k, k === "digital" ? v : Math.ceil((v as number) * rate)])
      ) as unknown as PriceSet;
    /* Les taux venaient d'etre recopies ici, en dur, a cote de ceux de
       lib/currency.ts. Deux tables pour la meme chose finissent par diverger,
       et c'est le prix affiche qui en paie le prix. Une seule source, et le
       jeu se remplit tout seul quand une devise s'ajoute. */
    const seeded = Object.fromEntries(
      currencies.map((devise) => [
        devise,
        devise === "EUR" ? eur : scale(exchangeRates[devise]),
      ])
    ) as PricesByCurrency;
    await sql`UPDATE prices SET data = ${JSON.stringify(seeded)}::jsonb WHERE id = 'singleton'`;
  })().catch((e) => {
    pricesSchemaReady = null;
    throw e;
  });
  return pricesSchemaReady;
}

export async function getPrices(): Promise<Prices> {
  return getPricesForCurrency("EUR");
}

export async function getPricesForCurrency(currency: Currency): Promise<PriceSet> {
  await ensurePricesSchema();
  const rows = await sql`SELECT data FROM prices WHERE id = 'singleton'`;
  if (!rows.length || !rows[0].data) {
    const eur = DEFAULT_PRICES_BY_CURRENCY.EUR;
    return currency === "EUR" ? eur : DEFAULT_PRICES_BY_CURRENCY[currency];
  }
  const data = rows[0].data as PricesByCurrency;
  const set = data[currency];
  if (set) return set;
  const eur = data.EUR;
  return Object.fromEntries(
    Object.entries(eur).map(([k, v]) => [k, k === "digital" ? v : convertPrice(v as number, currency)])
  ) as unknown as PriceSet;
}

export async function getAllPrices(): Promise<PricesByCurrency> {
  await ensurePricesSchema();
  const rows = await sql`SELECT data FROM prices WHERE id = 'singleton'`;
  if (!rows.length || !rows[0].data) return DEFAULT_PRICES_BY_CURRENCY;
  return rows[0].data as PricesByCurrency;
}

export async function updateAllPrices(data: PricesByCurrency): Promise<void> {
  await ensurePricesSchema();
  await sql`UPDATE prices SET data = ${JSON.stringify(data)}::jsonb WHERE id = 'singleton'`;
}

// ─── Newsletter ──────────────────────────────────────────────────────

export interface NewsletterSubscriber {
  id: number;
  email: string;
  locale: string | null;
  source: string | null;
  created_at: string;
  unsubscribed_at: string | null;
  /** Nombre d'emails de la sequence de bienvenue deja envoyes (0 = aucun). */
  welcome_step: number;
}

let newsletterSchemaReady: Promise<void> | null = null;

async function ensureNewsletterSchema(): Promise<void> {
  if (newsletterSchemaReady) return newsletterSchemaReady;
  newsletterSchemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        locale TEXT,
        source TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        unsubscribed_at TIMESTAMPTZ
      )
    `;
    await sql`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS welcome_step INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS welcome_last_sent_at TIMESTAMPTZ`;
  })().catch((e) => {
    newsletterSchemaReady = null;
    throw e;
  });
  return newsletterSchemaReady;
}

/**
 * Enregistre un email. Idempotent : une re-inscription du meme email met a jour
 * la locale/source et annule une eventuelle desinscription, sans erreur.
 * Retourne true si c'est une premiere inscription.
 */
export async function subscribeToNewsletter(params: {
  email: string;
  locale?: string | null;
  source?: string | null;
}): Promise<{ created: boolean }> {
  await ensureNewsletterSchema();
  const email = params.email.trim().toLowerCase();
  const rows = await sql`
    INSERT INTO newsletter_subscribers (email, locale, source)
    VALUES (${email}, ${params.locale ?? null}, ${params.source ?? null})
    ON CONFLICT (email) DO UPDATE SET
      locale = COALESCE(EXCLUDED.locale, newsletter_subscribers.locale),
      source = COALESCE(EXCLUDED.source, newsletter_subscribers.source),
      unsubscribed_at = NULL
    RETURNING (xmax = 0) AS created
  `;
  return { created: Boolean(rows[0]?.created) };
}

export async function getNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  await ensureNewsletterSchema();
  const rows = await sql`
    SELECT * FROM newsletter_subscribers
    WHERE unsubscribed_at IS NULL
    ORDER BY created_at DESC
  `;
  return rows as unknown as NewsletterSubscriber[];
}

/**
 * Abonnes en attente de l'etape `step` de la sequence de bienvenue, inscrits
 * depuis au moins `days` jours. Un desabonnement sort definitivement de la file.
 */
export async function getSubscribersDueForWelcome(
  step: number,
  days: number
): Promise<NewsletterSubscriber[]> {
  await ensureNewsletterSchema();
  const rows = await sql`
    SELECT * FROM newsletter_subscribers
    WHERE unsubscribed_at IS NULL
      AND welcome_step = ${step - 1}
      AND created_at < NOW() - (${days} * INTERVAL '1 day')
    ORDER BY created_at ASC
  `;
  return rows as unknown as NewsletterSubscriber[];
}

/** Avance le compteur uniquement si l'etape attendue est bien la precedente. */
export async function markWelcomeStepSent(email: string, step: number): Promise<void> {
  await ensureNewsletterSchema();
  await sql`
    UPDATE newsletter_subscribers
    SET welcome_step = ${step}, welcome_last_sent_at = NOW()
    WHERE lower(email) = lower(${email}) AND welcome_step = ${step - 1}
  `;
}

export async function unsubscribeFromNewsletter(email: string): Promise<void> {
  await ensureNewsletterSchema();
  // Upsert : un client qui se desabonne sans s'etre jamais inscrit doit quand
  // meme entrer dans la liste de suppression, sinon les emails de cycle de vie
  // continueraient de partir.
  await sql`
    INSERT INTO newsletter_subscribers (email, source, unsubscribed_at)
    VALUES (${email.trim().toLowerCase()}, 'unsubscribe', NOW())
    ON CONFLICT (email) DO UPDATE SET unsubscribed_at = NOW()
  `;
}

// ─── Emails de cycle de vie (post-achat) ─────────────────────────────

export interface LifecycleOrder {
  id: string;
  customer_email: string;
  customer_name: string | null;
  detected_country: string | null;
  final_image_sent_at: string;
}

let lifecycleSchemaReady: Promise<void> | null = null;

async function ensureLifecycleSchema(): Promise<void> {
  if (lifecycleSchemaReady) return lifecycleSchemaReady;
  lifecycleSchemaReady = (async () => {
    await ensureNewsletterSchema();
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_request_sent_at TIMESTAMPTZ`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS reorder_email_sent_at TIMESTAMPTZ`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS abandoned_email_sent_at TIMESTAMPTZ`;
  })().catch((e) => {
    lifecycleSchemaReady = null;
    throw e;
  });
  return lifecycleSchemaReady;
}

/** Commandes livrees depuis au moins `days` jours et jamais relancees pour un avis. */
export async function getOrdersDueForReviewRequest(days: number): Promise<LifecycleOrder[]> {
  await ensureLifecycleSchema();
  const rows = await sql`
    SELECT id, customer_email, customer_name, detected_country, final_image_sent_at
    FROM orders o
    WHERE o.final_image_sent_at IS NOT NULL
      AND o.final_image_sent_at < NOW() - (${days} * INTERVAL '1 day')
      AND o.review_request_sent_at IS NULL
      AND o.customer_email IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM newsletter_subscribers n
        WHERE lower(n.email) = lower(o.customer_email) AND n.unsubscribed_at IS NOT NULL
      )
    ORDER BY o.final_image_sent_at ASC
  `;
  return rows as unknown as LifecycleOrder[];
}

/** Commandes livrees depuis au moins `days` jours et jamais relancees pour un autre style. */
export async function getOrdersDueForReorderEmail(days: number): Promise<LifecycleOrder[]> {
  await ensureLifecycleSchema();
  const rows = await sql`
    SELECT DISTINCT ON (lower(o.customer_email))
      o.id, o.customer_email, o.customer_name, o.detected_country, o.final_image_sent_at
    FROM orders o
    WHERE o.final_image_sent_at IS NOT NULL
      AND o.final_image_sent_at < NOW() - (${days} * INTERVAL '1 day')
      AND o.reorder_email_sent_at IS NULL
      AND o.customer_email IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM newsletter_subscribers n
        WHERE lower(n.email) = lower(o.customer_email) AND n.unsubscribed_at IS NOT NULL
      )
    ORDER BY lower(o.customer_email), o.final_image_sent_at DESC
  `;
  return rows as unknown as LifecycleOrder[];
}

/** Commande restee en PENDING : le client a saisi son e-mail puis n'a pas fini. */
export interface AbandonedOrder {
  id: string;
  payment_intent_id: string;
  customer_email: string;
  customer_name: string | null;
  detected_country: string | null;
  total_price: number;
  currency: string;
  options: OrderOptions;
  created_at: string;
}

/**
 * Commandes abandonnees depuis au moins `hours` heures et jamais relancees.
 *
 * La fenetre haute (`maxDays`) evite de reveiller un panier vieux de six mois :
 * passe un certain delai, la relance ressemble a du harcelement et le contexte
 * d'achat a disparu.
 */
export async function getOrdersDueForAbandonedEmail(
  hours: number,
  maxDays: number
): Promise<AbandonedOrder[]> {
  await ensureLifecycleSchema();
  const rows = await sql`
    SELECT o.id, o.payment_intent_id, o.customer_email, o.customer_name,
           o.detected_country, o.total_price, o.currency, o.options, o.created_at
    FROM orders o
    WHERE o.status = 'PENDING'
      AND o.created_at < NOW() - (${hours} * INTERVAL '1 hour')
      AND o.created_at > NOW() - (${maxDays} * INTERVAL '1 day')
      AND o.abandoned_email_sent_at IS NULL
      AND o.customer_email IS NOT NULL
      -- Un client qui a fini par payer, meme sur une autre tentative, ne doit
      -- pas recevoir « vous avez oublie quelque chose ».
      AND NOT EXISTS (
        SELECT 1 FROM orders p
        WHERE lower(p.customer_email) = lower(o.customer_email)
          AND p.status = 'PAID'
          AND p.created_at >= o.created_at - INTERVAL '1 day'
      )
      AND NOT EXISTS (
        SELECT 1 FROM newsletter_subscribers n
        WHERE lower(n.email) = lower(o.customer_email) AND n.unsubscribed_at IS NOT NULL
      )
    ORDER BY o.created_at ASC
  `;
  return rows as unknown as AbandonedOrder[];
}

export async function markAbandonedEmailSent(orderId: string): Promise<void> {
  await ensureLifecycleSchema();
  await sql`UPDATE orders SET abandoned_email_sent_at = NOW() WHERE id = ${orderId}::uuid`;
}

export async function markReviewRequestSent(orderId: string): Promise<void> {
  await ensureLifecycleSchema();
  await sql`UPDATE orders SET review_request_sent_at = NOW() WHERE id = ${orderId}::uuid`;
}

/**
 * Marque toutes les commandes de ce client, pas seulement celle qui a declenche
 * l'envoi : sinon un client ayant plusieurs anciennes commandes recevrait la
 * meme relance une fois par commande.
 */
export async function markReorderEmailSent(email: string): Promise<void> {
  await ensureLifecycleSchema();
  await sql`
    UPDATE orders SET reorder_email_sent_at = NOW()
    WHERE lower(customer_email) = lower(${email}) AND reorder_email_sent_at IS NULL
  `;
}
