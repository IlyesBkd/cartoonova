import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de Confidentialité — Cartoonova",
  description: "Politique de confidentialité et protection des données personnelles de Cartoonova.com",
};

export default function PolitiqueConfidentialite() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 pt-24 sm:pt-28 text-gray-800">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">Politique de Confidentialité</h1>
      <p className="text-sm text-gray-400 mb-10">Dernière mise à jour : 21 mars 2024</p>

      <div className="space-y-8 leading-relaxed">

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">1. Introduction</h2>
          <p>La société Cartoonova SAS (ci-après « Cartoonova », « nous », « notre ») s&apos;engage à protéger la vie privée de ses utilisateurs et clients (ci-après « vous », « votre »).</p>
          <p className="mt-3">La présente Politique de Confidentialité décrit la manière dont nous collectons, utilisons, stockons et protégeons vos données personnelles lorsque vous utilisez notre site <strong>cartoonova.com</strong> (ci-après « le Site ») et nos services de création de caricatures personnalisées.</p>
          <p className="mt-3">Cette politique est conforme au Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679) et à la loi « Informatique et Libertés » du 6 janvier 1978 modifiée.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">2. Responsable du traitement</h2>
          <div className="space-y-1">
            <p><strong>Cartoonova SAS</strong></p>
            <p>42 rue du Faubourg Saint-Honoré, 75008 Paris, France</p>
            <p>SIRET : 912 345 678 00014</p>
            <p>Email :{" "}
              <a href="mailto:support@cartoonova.com" className="text-[#3B9AE8] underline underline-offset-2 font-semibold hover:text-[#1a5fa8] transition-colors">support@cartoonova.com</a>
            </p>
            <p>Tél. : 01 42 68 93 17</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">3. Données collectées</h2>
          <p>Dans le cadre de nos services, nous sommes amenés à collecter les catégories de données suivantes :</p>

          <h3 className="text-lg font-semibold mt-5 mb-2 text-gray-900">3.1 Données d&apos;identification</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Nom et prénom</li>
            <li>Adresse email</li>
            <li>Adresse postale (pour les livraisons de produits imprimés)</li>
            <li>Numéro de téléphone (facultatif)</li>
          </ul>

          <h3 className="text-lg font-semibold mt-5 mb-2 text-gray-900">3.2 Données de commande</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Détails de la commande (format, options, support d&apos;impression)</li>
            <li>Photos transmises pour la réalisation de la caricature</li>
            <li>Historique des commandes et des échanges avec le service client</li>
          </ul>

          <h3 className="text-lg font-semibold mt-5 mb-2 text-gray-900">3.3 Données de paiement</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Les données de paiement (numéro de carte, etc.) sont traitées directement par nos prestataires de paiement sécurisés (Stripe, PayPal) et ne sont jamais stockées sur nos serveurs.</li>
          </ul>

          <h3 className="text-lg font-semibold mt-5 mb-2 text-gray-900">3.4 Données de navigation</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Adresse IP</li>
            <li>Type de navigateur et système d&apos;exploitation</li>
            <li>Pages consultées et durée de visite</li>
            <li>Cookies et identifiants de session</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">4. Finalités du traitement</h2>
          <p>Vos données personnelles sont collectées et traitées pour les finalités suivantes :</p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li><strong>Exécution des commandes :</strong> réalisation de la caricature, impression, expédition et suivi de livraison.</li>
            <li><strong>Gestion de la relation client :</strong> service après-vente, révisions, réponses à vos demandes.</li>
            <li><strong>Paiement :</strong> traitement et sécurisation des transactions.</li>
            <li><strong>Communication :</strong> envoi de confirmations de commande, notifications de livraison et, avec votre consentement, offres promotionnelles.</li>
            <li><strong>Amélioration du service :</strong> analyse statistique anonymisée de l&apos;utilisation du Site.</li>
            <li><strong>Obligations légales :</strong> conservation des factures et données comptables conformément à la réglementation en vigueur.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">5. Base légale du traitement</h2>
          <p>Le traitement de vos données repose sur les bases légales suivantes :</p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li><strong>Exécution du contrat :</strong> les données nécessaires à la réalisation et la livraison de votre commande.</li>
            <li><strong>Consentement :</strong> pour l&apos;envoi de communications marketing et l&apos;utilisation de cookies non essentiels.</li>
            <li><strong>Intérêt légitime :</strong> pour l&apos;amélioration de nos services et la prévention de la fraude.</li>
            <li><strong>Obligation légale :</strong> pour la conservation des données comptables et fiscales.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">6. Durée de conservation</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Données de commande :</strong> 3 ans après la dernière commande.</li>
            <li><strong>Photos transmises :</strong> supprimées dans un délai de 90 jours après la livraison de la commande, sauf demande contraire du Client.</li>
            <li><strong>Données comptables :</strong> 10 ans conformément aux obligations légales.</li>
            <li><strong>Cookies de navigation :</strong> 13 mois maximum.</li>
            <li><strong>Données de prospection :</strong> 3 ans après le dernier contact.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">7. Partage des données</h2>
          <p>Vos données personnelles ne sont jamais vendues à des tiers. Elles peuvent être partagées avec :</p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li><strong>Nos artistes :</strong> uniquement les photos et instructions nécessaires à la réalisation de la caricature.</li>
            <li><strong>Prestataires de paiement :</strong> Stripe et PayPal pour le traitement sécurisé des paiements.</li>
            <li><strong>Services d&apos;impression et de livraison :</strong> adresse de livraison pour l&apos;expédition des produits imprimés.</li>
            <li><strong>Hébergeur :</strong> Vercel Inc. pour l&apos;hébergement technique du Site.</li>
            <li><strong>Outils d&apos;analyse :</strong> Google Analytics (données anonymisées).</li>
          </ul>
          <p className="mt-3">Tous nos prestataires sont soumis à des obligations contractuelles strictes de confidentialité et de protection des données conformes au RGPD.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">8. Transferts internationaux</h2>
          <p>Certaines de vos données peuvent être transférées en dehors de l&apos;Union Européenne (hébergement aux États-Unis via Vercel). Ces transferts sont encadrés par les Clauses Contractuelles Types (CCT) de la Commission Européenne ou le Data Privacy Framework UE-États-Unis.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">9. Cookies</h2>
          <p>Le Site utilise les types de cookies suivants :</p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li><strong>Cookies essentiels :</strong> nécessaires au fonctionnement du Site (session, panier, authentification).</li>
            <li><strong>Cookies analytiques :</strong> nous permettent de comprendre comment le Site est utilisé (Google Analytics) — soumis à votre consentement.</li>
            <li><strong>Cookies marketing :</strong> utilisés pour personnaliser les publicités — soumis à votre consentement.</li>
          </ul>
          <p className="mt-3">Vous pouvez gérer vos préférences de cookies à tout moment via les paramètres de votre navigateur ou via notre bandeau de consentement.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">10. Vos droits</h2>
          <p>Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :</p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li><strong>Droit d&apos;accès :</strong> obtenir la confirmation que vos données sont traitées et en obtenir une copie.</li>
            <li><strong>Droit de rectification :</strong> corriger des données inexactes ou incomplètes.</li>
            <li><strong>Droit de suppression :</strong> demander l&apos;effacement de vos données (« droit à l&apos;oubli »).</li>
            <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré et lisible.</li>
            <li><strong>Droit d&apos;opposition :</strong> vous opposer au traitement de vos données pour des motifs légitimes.</li>
            <li><strong>Droit de limitation :</strong> limiter le traitement de vos données dans certaines circonstances.</li>
            <li><strong>Droit de retirer votre consentement :</strong> à tout moment pour les traitements basés sur le consentement.</li>
          </ul>
          <p className="mt-3">Pour exercer l&apos;un de ces droits, contactez-nous à :{" "}
            <a href="mailto:support@cartoonova.com" className="text-[#3B9AE8] underline underline-offset-2 font-semibold hover:text-[#1a5fa8] transition-colors">support@cartoonova.com</a>
          </p>
          <p className="mt-3">Nous nous engageons à répondre à votre demande dans un délai de 30 jours. Vous disposez également du droit d&apos;introduire une réclamation auprès de la <strong>CNIL</strong> (Commission Nationale de l&apos;Informatique et des Libertés) : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-[#3B9AE8] underline underline-offset-2 hover:text-[#1a5fa8] transition-colors">www.cnil.fr</a>.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">11. Sécurité</h2>
          <p>Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données personnelles contre l&apos;accès non autorisé, la perte, la destruction ou l&apos;altération :</p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>Chiffrement SSL/TLS de toutes les communications</li>
            <li>Accès restreint aux données sur la base du « besoin d&apos;en connaître »</li>
            <li>Sauvegardes régulières et sécurisées</li>
            <li>Surveillance et journalisation des accès</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">12. Mineurs</h2>
          <p>Le Site ne s&apos;adresse pas aux mineurs de moins de 16 ans. Nous ne collectons pas sciemment de données personnelles de mineurs. Si vous êtes parent ou tuteur et pensez que votre enfant nous a fourni des données, contactez-nous pour que nous procédions à leur suppression.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">13. Modifications</h2>
          <p>Nous nous réservons le droit de modifier la présente Politique de Confidentialité à tout moment. Toute modification sera publiée sur cette page avec la date de mise à jour. Nous vous invitons à consulter régulièrement cette page.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">14. Contact</h2>
          <p>Pour toute question concernant la protection de vos données personnelles :</p>
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
