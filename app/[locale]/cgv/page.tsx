import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales de Vente — Cartoonova",
  description: "CGV du site Cartoonova.com — Vente de caricatures personnalisées en ligne.",
};

export default function CGV() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 text-gray-800">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">Conditions Générales de Vente</h1>
      <p className="text-sm text-gray-400 mb-10">Dernière mise à jour : 21 mars 2024</p>

      <div className="space-y-8 leading-relaxed">

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Article 1 — Objet</h2>
          <p>Les présentes Conditions Générales de Vente (CGV) régissent les ventes de produits et services effectuées par la société Cartoonova SAS, au capital de 10 000 €, dont le siège social est situé au 42 rue du Faubourg Saint-Honoré, 75008 Paris, France, immatriculée au RCS de Paris sous le numéro 912 345 678, ci-après dénommée « Cartoonova ».</p>
          <p className="mt-3">Elles s&apos;appliquent à toute commande passée sur le site <strong>cartoonova.com</strong> (ci-après « le Site ») par un client particulier ou professionnel (ci-après « le Client »).</p>
          <p className="mt-3">Le fait de passer commande sur le Site implique l&apos;acceptation pleine et entière des présentes CGV.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Article 2 — Produits et services</h2>
          <p>Cartoonova propose un service de création de caricatures et portraits personnalisés de style cartoon, réalisés à la main par des artistes professionnels. Les produits proposés comprennent :</p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>Fichiers numériques (JPG, PNG haute résolution)</li>
            <li>Impressions sur poster</li>
            <li>Impressions sur canvas (toile)</li>
            <li>Impressions sur poster encadré</li>
            <li>Impressions sur mug</li>
            <li>Impressions sur Alu-Dibond</li>
          </ul>
          <p className="mt-3">Les photographies et illustrations présentées sur le Site sont aussi fidèles que possible. Toutefois, de légères variations peuvent exister entre le produit commandé et le produit reçu, chaque caricature étant une création unique et artisanale.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Article 3 — Prix</h2>
          <p>Les prix sont indiqués en euros (€), toutes taxes comprises (TTC). Cartoonova se réserve le droit de modifier ses prix à tout moment. Les produits seront facturés au tarif en vigueur au moment de la validation de la commande.</p>
          <p className="mt-3">Les frais de livraison, le cas échéant, sont indiqués et calculés avant la validation finale de la commande.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Article 4 — Commande</h2>
          <p>Le Client sélectionne les options de personnalisation souhaitées (format, nombre de personnes/animaux, arrière-plan, support d&apos;impression) et téléverse les photos nécessaires à la réalisation de la caricature.</p>
          <p className="mt-3">La commande est confirmée par le paiement intégral du prix. Un email de confirmation est envoyé au Client à l&apos;adresse email fournie lors de la commande.</p>
          <p className="mt-3">Cartoonova se réserve le droit de refuser ou d&apos;annuler toute commande en cas de litige existant, de photos inappropriées ou d&apos;informations manifestement erronées.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Article 5 — Paiement</h2>
          <p>Le paiement s&apos;effectue en ligne par carte bancaire (Visa, Mastercard, American Express) ou via PayPal. Le paiement est sécurisé par un système de cryptage SSL.</p>
          <p className="mt-3">Le montant total est débité au moment de la validation de la commande. Aucune commande ne sera traitée avant réception complète du paiement.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Article 6 — Délais de réalisation et livraison</h2>
          <p>Les délais de réalisation d&apos;une caricature sont généralement de <strong>3 à 5 jours ouvrés</strong> à compter de la réception du paiement et des photos. Ce délai peut varier en fonction de la complexité de la commande et de la charge de travail des artistes.</p>
          <p className="mt-3"><strong>Produits numériques :</strong> Le fichier est envoyé par email au Client dès validation de la caricature.</p>
          <p className="mt-3"><strong>Produits imprimés :</strong> L&apos;impression et l&apos;expédition prennent un délai supplémentaire de 5 à 10 jours ouvrés selon la destination. Les frais et délais de livraison sont indiqués lors de la commande.</p>
          <p className="mt-3">Cartoonova ne saurait être tenue responsable des retards de livraison imputables au transporteur ou à un cas de force majeure.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Article 7 — Révisions et satisfaction</h2>
          <p>Cartoonova s&apos;engage à fournir un travail de qualité et fidèle aux photos fournies. Le Client dispose de <strong>révisions gratuites et illimitées</strong> jusqu&apos;à satisfaction complète.</p>
          <p className="mt-3">Les demandes de révision doivent être formulées de manière claire et précise par email à{" "}
            <a href="mailto:support@cartoonova.com" className="text-[#3B9AE8] underline underline-offset-2 font-semibold hover:text-[#1a5fa8] transition-colors">support@cartoonova.com</a>.
          </p>
          <p className="mt-3">Les révisions portent sur des ajustements raisonnables (ressemblance, couleurs, détails). Elles ne couvrent pas un changement complet du style ou de la composition initialement validée.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Article 8 — Droit de rétractation</h2>
          <p>Conformément à l&apos;article L221-28 du Code de la consommation, le droit de rétractation <strong>ne peut être exercé</strong> pour les contrats de fourniture de biens confectionnés selon les spécifications du consommateur ou nettement personnalisés.</p>
          <p className="mt-3">Chaque caricature étant une œuvre unique réalisée sur mesure à partir des photos et instructions du Client, les commandes de produits numériques ne sont pas éligibles au droit de rétractation une fois le travail de création commencé.</p>
          <p className="mt-3">Pour les produits imprimés, si le produit reçu est endommagé ou non conforme à la commande, le Client peut contacter le service client dans un délai de 14 jours suivant la réception pour obtenir un échange ou un remboursement.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Article 9 — Remboursement</h2>
          <p>En cas de produit défectueux ou non conforme, Cartoonova procédera, au choix du Client, à un remplacement ou un remboursement intégral dans un délai de 14 jours suivant la demande validée.</p>
          <p className="mt-3">Les demandes de remboursement doivent être adressées à{" "}
            <a href="mailto:support@cartoonova.com" className="text-[#3B9AE8] underline underline-offset-2 font-semibold hover:text-[#1a5fa8] transition-colors">support@cartoonova.com</a>
            {" "}accompagnées du numéro de commande et d&apos;une description du problème.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Article 10 — Propriété intellectuelle</h2>
          <p>Les caricatures créées par Cartoonova sont des œuvres originales protégées par le droit d&apos;auteur. Après paiement intégral, le Client reçoit un <strong>droit d&apos;usage personnel et non commercial</strong> de l&apos;œuvre.</p>
          <p className="mt-3">Cartoonova se réserve le droit d&apos;utiliser les caricatures réalisées à des fins de promotion (portfolio, réseaux sociaux), sauf demande contraire explicite du Client.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Article 11 — Responsabilité</h2>
          <p>Cartoonova ne saurait être tenue responsable de l&apos;utilisation faite par le Client des caricatures livrées. Le Client garantit qu&apos;il dispose des droits nécessaires sur les photos transmises et qu&apos;il ne les utilise pas à des fins diffamatoires ou illégales.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Article 12 — Protection des données</h2>
          <p>Les données personnelles collectées dans le cadre des commandes sont traitées conformément à notre <a href="/politique-de-confidentialite" className="text-[#3B9AE8] underline underline-offset-2 hover:text-[#1a5fa8] transition-colors">Politique de Confidentialité</a>.</p>
          <p className="mt-3">Les photos transmises par le Client sont utilisées exclusivement pour la réalisation de la commande et sont supprimées dans un délai de 90 jours après livraison, sauf demande de conservation du Client.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Article 13 — Médiation et litiges</h2>
          <p>En cas de litige, le Client est invité à contacter en premier lieu le service client de Cartoonova à{" "}
            <a href="mailto:support@cartoonova.com" className="text-[#3B9AE8] underline underline-offset-2 font-semibold hover:text-[#1a5fa8] transition-colors">support@cartoonova.com</a>
            {" "}afin de rechercher une solution amiable.</p>
          <p className="mt-3">Conformément aux articles L611-1 et suivants du Code de la consommation, le Client peut recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable du litige.</p>
          <p className="mt-3">À défaut de résolution amiable, les tribunaux compétents de Paris seront seuls compétents. Les présentes CGV sont soumises au droit français.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Article 14 — Contact</h2>
          <p>Pour toute question relative à votre commande ou aux présentes CGV :</p>
          <div className="mt-3 space-y-1">
            <p><strong>Cartoonova SAS</strong></p>
            <p>42 rue du Faubourg Saint-Honoré, 75008 Paris</p>
            <p>Tél. : 01 42 68 93 17</p>
            <p>Email :{" "}
              <a href="mailto:support@cartoonova.com" className="text-[#3B9AE8] underline underline-offset-2 font-semibold hover:text-[#1a5fa8] transition-colors">support@cartoonova.com</a>
            </p>
          </div>
        </section>

      </div>
    </main>
  );
}
