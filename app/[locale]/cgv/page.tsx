import type { Metadata } from "next";
import { metadataPageLegale } from "@/lib/seo";

export function generateMetadata(params: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return metadataPageLegale(params, "cgv", "/cgv");
}

export default function CGV() {
  return (
    <div className="section">
      <div className="enveloppe prose">
      <h1>Conditions Générales de Vente</h1>
      <p>Dernière mise à jour : 1er octobre 2026</p>

      <div>

        <section>
          <h2>Article 1 — Objet</h2>
          <p>Les présentes Conditions Générales de Vente (CGV) régissent les ventes de produits et services effectuées par la société Cartoonova SAS, au capital de 10 000 €, dont le siège social est situé au 42 rue du Faubourg Saint-Honoré, 75008 Paris, France, immatriculée au RCS de Paris sous le numéro 912 345 678, ci-après dénommée « Cartoonova ».</p>
          <p>Elles s&apos;appliquent à toute commande passée sur le site <strong>cartoonova.com</strong> (ci-après « le Site ») par un client particulier ou professionnel (ci-après « le Client »).</p>
          <p>Le fait de passer commande sur le Site implique l&apos;acceptation pleine et entière des présentes CGV.</p>
        </section>

        <section>
          <h2>Article 2 — Produits et services</h2>
          <p>Cartoonova propose un service de création de caricatures et portraits personnalisés de style cartoon, réalisés à partir des photos fournies par le Client. Les produits proposés comprennent :</p>
          <ul>
            <li>Fichiers numériques (JPG, PNG haute résolution)</li>
            <li>Impressions sur poster</li>
            <li>Impressions sur canvas (toile)</li>
            <li>Impressions sur poster encadré</li>
            <li>Impressions sur mug</li>
            <li>Impressions sur Alu-Dibond</li>
          </ul>
          <p>Les photographies et illustrations présentées sur le Site sont aussi fidèles que possible. Toutefois, de légères variations peuvent exister entre le produit commandé et le produit reçu, chaque caricature étant une création unique et artisanale.</p>
        </section>

        <section>
          <h2>Article 3 — Prix</h2>
          <p>Les prix sont indiqués en euros (€), toutes taxes comprises (TTC). Cartoonova se réserve le droit de modifier ses prix à tout moment. Les produits seront facturés au tarif en vigueur au moment de la validation de la commande.</p>
          <p>Les frais de livraison, le cas échéant, sont indiqués et calculés avant la validation finale de la commande.</p>
        </section>

        <section>
          <h2>Article 4 — Commande</h2>
          <p>Le Client sélectionne les options de personnalisation souhaitées (format, nombre de personnes/animaux, arrière-plan, support d&apos;impression) et téléverse les photos nécessaires à la réalisation de la caricature.</p>
          <p>La commande est confirmée par le paiement intégral du prix. Un email de confirmation est envoyé au Client à l&apos;adresse email fournie lors de la commande.</p>
          <p>Cartoonova se réserve le droit de refuser ou d&apos;annuler toute commande en cas de litige existant, de photos inappropriées ou d&apos;informations manifestement erronées.</p>
        </section>

        <section>
          <h2>Article 5 — Paiement</h2>
          <p>Le paiement s&apos;effectue en ligne par carte bancaire (Visa, Mastercard, American Express) ou via PayPal. Le paiement est sécurisé par un système de cryptage SSL.</p>
          <p>Le montant total est débité au moment de la validation de la commande. Aucune commande ne sera traitée avant réception complète du paiement.</p>
        </section>

        <section>
          <h2>Article 6 — Délais de réalisation et livraison</h2>
          <p>Les délais de réalisation d&apos;une caricature sont généralement de <strong>2 jours ouvrés</strong> à compter de la réception du paiement et des photos. Ce délai peut varier en fonction de la complexité de la commande et de la charge de travail des artistes.</p>
          <p><strong>Produits numériques :</strong> Le fichier haute définition est envoyé par email au Client dès que la caricature est terminée. Le Client peut ensuite demander des retouches (article 7).</p>
          <p><strong>Produits imprimés :</strong> Un aperçu est soumis au Client, qui le valide avant l&apos;impression. L&apos;impression et l&apos;expédition prennent ensuite un délai de 3 à 7 jours ouvrés selon la destination. Les frais et délais de livraison sont indiqués lors de la commande.</p>
          <p><strong>Option express :</strong> lorsque le Client l&apos;a choisie, la caricature est livrée sous 24 heures, y compris le week-end, à compter de la réception du paiement et des photos. Pour un produit imprimé, ce délai porte sur le dessin ; l&apos;impression et l&apos;expédition suivent les délais ci-dessus.</p>
          <p>Cartoonova ne saurait être tenue responsable des retards de livraison imputables au transporteur ou à un cas de force majeure.</p>
        </section>

        <section>
          <h2>Article 7 — Révisions et satisfaction</h2>
          <p>Cartoonova s&apos;engage à fournir un travail de qualité et fidèle aux photos fournies. Le Client dispose de <strong>révisions gratuites et illimitées</strong> jusqu&apos;à satisfaction complète.</p>
          <p>Les demandes de révision doivent être formulées de manière claire et précise par email à{" "}
            <a href="mailto:support@cartoonova.com">support@cartoonova.com</a>.
          </p>
          <p>Les révisions portent sur des ajustements raisonnables (ressemblance, couleurs, détails). Elles ne couvrent pas un changement complet du style ou de la composition initialement validée.</p>
          <p><strong>Garantie de satisfaction.</strong> Si, après les révisions, la caricature ne convient toujours pas au Client, Cartoonova lui rembourse l&apos;intégralité du prix payé, sur simple demande à{" "}
            <a href="mailto:support@cartoonova.com">support@cartoonova.com</a>.
            Pour un produit imprimé, la demande doit être faite <strong>avant la validation de l&apos;aperçu</strong> : une fois l&apos;aperçu validé, l&apos;impression est lancée et le produit relève alors de l&apos;article 9.
          </p>
        </section>

        <section>
          <h2>Article 8 — Droit de rétractation</h2>
          <p>Conformément à l&apos;article L221-28 du Code de la consommation, le droit de rétractation <strong>ne peut être exercé</strong> pour les contrats de fourniture de biens confectionnés selon les spécifications du consommateur ou nettement personnalisés.</p>
          <p>Chaque caricature étant une œuvre unique réalisée sur mesure à partir des photos et instructions du Client, les commandes de produits numériques ne sont pas éligibles au droit de rétractation une fois le travail de création commencé.</p>
          <p>Pour les produits imprimés, si le produit reçu est endommagé ou non conforme à la commande, le Client peut contacter le service client dans un délai de 14 jours suivant la réception pour obtenir un échange ou un remboursement.</p>
        </section>

        <section>
          <h2>Article 9 — Remboursement</h2>
          <p>Un remboursement est accordé dans deux cas : au titre de la garantie de satisfaction de l&apos;article 7, ou lorsqu&apos;un produit imprimé est reçu défectueux ou non conforme. Dans ce second cas, Cartoonova procède, au choix du Client, à un remplacement ou à un remboursement intégral.</p>
          <p>Le remboursement est effectué sur le moyen de paiement utilisé lors de la commande, dans un délai de 14 jours suivant la demande validée.</p>
          <p>Les demandes de remboursement doivent être adressées à{" "}
            <a href="mailto:support@cartoonova.com">support@cartoonova.com</a>
            {" "}accompagnées du numéro de commande et d&apos;une description du problème.</p>
        </section>

        <section>
          <h2>Article 9 bis — Bons cadeaux</h2>
          <p>Cartoonova propose des bons cadeaux d&apos;un montant fixe, payés en ligne et remis par email sous la forme d&apos;un code et d&apos;une version imprimable.</p>
          <p>Le bon est valable <strong>12 mois</strong> à compter de son achat, dans la devise de l&apos;achat. Il peut être utilisé en une ou plusieurs commandes, jusqu&apos;à épuisement de son solde. Chaque commande comporte un minimum de 1 (dans la devise de la commande) restant à la charge du Client ; le solde non utilisé reste disponible.</p>
          <p>Le bon n&apos;est ni remboursable ni échangeable contre des espèces. Le droit de rétractation de 14 jours s&apos;applique à l&apos;achat du bon tant qu&apos;il n&apos;a pas été utilisé : le remboursement peut alors être demandé à{" "}
            <a href="mailto:support@cartoonova.com">support@cartoonova.com</a>.
          </p>
        </section>

        <section>
          <h2>Article 10 — Propriété intellectuelle</h2>
          <p>Les caricatures créées par Cartoonova sont des œuvres originales protégées par le droit d&apos;auteur. Après paiement intégral, le Client reçoit un <strong>droit d&apos;usage personnel et non commercial</strong> de l&apos;œuvre.</p>
          <p>Cartoonova se réserve le droit d&apos;utiliser les caricatures réalisées à des fins de promotion (portfolio, réseaux sociaux), sauf demande contraire explicite du Client.</p>
        </section>

        <section>
          <h2>Article 11 — Responsabilité</h2>
          <p>Cartoonova ne saurait être tenue responsable de l&apos;utilisation faite par le Client des caricatures livrées. Le Client garantit qu&apos;il dispose des droits nécessaires sur les photos transmises et qu&apos;il ne les utilise pas à des fins diffamatoires ou illégales.</p>
        </section>

        <section>
          <h2>Article 12 — Protection des données</h2>
          <p>Les données personnelles collectées dans le cadre des commandes sont traitées conformément à notre <a href="/politique-de-confidentialite">Politique de Confidentialité</a>.</p>
          <p>Les photos transmises par le Client sont utilisées exclusivement pour la réalisation de la commande et sont supprimées dans un délai de 90 jours après livraison, sauf demande de conservation du Client.</p>
        </section>

        <section>
          <h2>Article 13 — Médiation et litiges</h2>
          <p>En cas de litige, le Client est invité à contacter en premier lieu le service client de Cartoonova à{" "}
            <a href="mailto:support@cartoonova.com">support@cartoonova.com</a>
            {" "}afin de rechercher une solution amiable.</p>
          <p>Conformément aux articles L611-1 et suivants du Code de la consommation, le Client peut recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable du litige.</p>
          <p>À défaut de résolution amiable, les tribunaux compétents de Paris seront seuls compétents. Les présentes CGV sont soumises au droit français.</p>
        </section>

        <section>
          <h2>Article 14 — Contact</h2>
          <p>Pour toute question relative à votre commande ou aux présentes CGV :</p>
          <div>
            <p><strong>Cartoonova SAS</strong></p>
            <p>42 rue du Faubourg Saint-Honoré, 75008 Paris</p>
            <p>Tél. : 01 42 68 93 17</p>
            <p>Email :{" "}
              <a href="mailto:support@cartoonova.com">support@cartoonova.com</a>
            </p>
          </div>
        </section>

      </div>
    </div>
    </div>
  );
}
