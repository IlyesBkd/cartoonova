import type { Metadata } from "next";
import { metadataPageLegale } from "@/lib/seo";

export function generateMetadata(params: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return metadataPageLegale(params, "mentionsLegales", "/mentions-legales");
}

export default function MentionsLegales() {
  return (
    <div className="section">
      <div className="enveloppe prose">
      <h1>Mentions Légales</h1>
      <p>Dernière mise à jour : 21 mars 2024</p>

      <div>

        <section>
          <h2>1. Éditeur du site</h2>
          <div>
            <p><strong>Raison sociale :</strong> Cartoonova SAS</p>
            <p><strong>Siège social :</strong> 42 rue du Faubourg Saint-Honoré, 75008 Paris, France</p>
            <p><strong>SIRET :</strong> 912 345 678 00014</p>
            <p><strong>RCS :</strong> Paris B 912 345 678</p>
            <p><strong>Capital social :</strong> 10 000 €</p>
            <p><strong>Numéro de TVA intracommunautaire :</strong> FR 76 912345678</p>
            <p><strong>Téléphone :</strong> 01 42 68 93 17</p>
            <p><strong>Email :</strong>{" "}
              <a href="mailto:support@cartoonova.com">
                support@cartoonova.com
              </a>
            </p>
            <p><strong>Directeur de la publication :</strong> M. Antoine Lefèvre</p>
          </div>
        </section>

        <section>
          <h2>2. Hébergement</h2>
          <div>
            <p><strong>Hébergeur :</strong> Vercel Inc.</p>
            <p><strong>Adresse :</strong> 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</p>
            <p><strong>Site web :</strong> vercel.com</p>
          </div>
        </section>

        <section>
          <h2>3. Activité</h2>
          <p>Cartoonova est un service en ligne de création de caricatures et portraits personnalisés de style cartoon. Nos artistes professionnels transforment vos photos en œuvres d&apos;art uniques, disponibles en format numérique ou imprimées sur divers supports (poster, canvas, mug, etc.).</p>
        </section>

        <section>
          <h2>4. Propriété intellectuelle</h2>
          <p>L&apos;ensemble du contenu du site Cartoonova (textes, images, graphismes, logo, icônes, sons, logiciels, etc.) est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.</p>
          <p>Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans l&apos;autorisation écrite préalable de Cartoonova SAS.</p>
          <p>Les caricatures réalisées par nos artistes restent la propriété de Cartoonova SAS jusqu&apos;au paiement intégral de la commande. Après paiement, le client reçoit un droit d&apos;usage personnel et non commercial de l&apos;œuvre.</p>
        </section>

        <section>
          <h2>5. Données personnelles</h2>
          <p>Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi « Informatique et Libertés » du 6 janvier 1978 modifiée, vous disposez d&apos;un droit d&apos;accès, de rectification, de suppression et de portabilité de vos données personnelles.</p>
          <p>Pour exercer ces droits ou pour toute question relative à la protection de vos données, contactez-nous à :{" "}
            <a href="mailto:support@cartoonova.com">
              support@cartoonova.com
            </a>
          </p>
          <p>Pour plus de détails, consultez notre <a href="/politique-de-confidentialite">Politique de Confidentialité</a>.</p>
        </section>

        <section>
          <h2>6. Cookies</h2>
          <p>Le site Cartoonova utilise des cookies pour améliorer l&apos;expérience utilisateur, analyser le trafic et permettre le bon fonctionnement des services. En poursuivant votre navigation, vous acceptez l&apos;utilisation de cookies conformément à notre politique de confidentialité.</p>
        </section>

        <section>
          <h2>7. Limitation de responsabilité</h2>
          <p>Cartoonova SAS s&apos;efforce de fournir des informations exactes et à jour sur le site. Toutefois, elle ne saurait garantir l&apos;exactitude, la complétude ou l&apos;actualité des informations diffusées. Cartoonova SAS décline toute responsabilité en cas d&apos;erreur ou d&apos;omission dans le contenu du site.</p>
          <p>L&apos;utilisation du site se fait aux risques et périls de l&apos;utilisateur. Cartoonova SAS ne saurait être tenue responsable des dommages directs ou indirects résultant de l&apos;accès ou de l&apos;utilisation du site.</p>
        </section>

        <section>
          <h2>8. Droit applicable</h2>
          <p>Les présentes mentions légales sont régies par le droit français. En cas de litige, et après tentative de résolution amiable, les tribunaux compétents de Paris seront seuls compétents.</p>
        </section>

        <section>
          <h2>9. Contact</h2>
          <p>Pour toute question, vous pouvez nous contacter par email à :{" "}
            <a href="mailto:support@cartoonova.com">
              support@cartoonova.com
            </a>
          </p>
        </section>

      </div>
    </div>
    </div>
  );
}
