import type { PagesLegales } from "./types";

export const LEGAL_EN: PagesLegales = {
  avertissement: "This translation is provided for information only; in case of discrepancy, the French version prevails.",
  accepterCgv: "By ordering, you accept our [terms and conditions of sale](/cgv).",

  cgv: {
    titre: "Terms and Conditions of Sale",
    miseAJour: "Last updated: 1 October 2026",
    sections: [
      {
        titre: "Article 1 — Purpose",
        blocs: [
          "These Terms and Conditions of Sale (the “Terms”) govern the sale of products and services by the company {raison}, with a share capital of {capital}, whose registered office is located at {siege}, registered with the Trade and Companies Register (RCS) under number {rcs}, hereinafter referred to as “Cartoonova”.",
          "They apply to any order placed on the website **cartoonova.com** (hereinafter “the Site”) by a private or professional customer (hereinafter “the Customer”).",
          "Placing an order on the Site implies full and unreserved acceptance of these Terms.",
        ],
      },
      {
        titre: "Article 2 — Products and services",
        blocs: [
          "Cartoonova offers a service creating personalised cartoon-style caricatures and portraits, produced from photos supplied by the Customer. The products offered include:",
          {
            liste: [
              "Digital files (high-resolution JPG, PNG)",
              "Poster prints",
              "Canvas prints",
              "Framed portrait prints",
              "Mug prints",
              "Alu-Dibond prints",
            ],
          },
          "The photographs and illustrations shown on the Site are as faithful as possible. However, slight variations may exist between the product ordered and the product received, as each caricature is a unique, handmade creation.",
        ],
      },
      {
        titre: "Article 3 — Prices",
        blocs: [
          "Prices are stated in euros (€), all taxes included. Cartoonova reserves the right to change its prices at any time. Products will be invoiced at the rate in force at the time the order is confirmed.",
          "Prints (poster, canvas, framed portrait) are delivered subject to flat-rate delivery charges, which are added to the price of the products and indicated before final confirmation of the order. The digital file, sent by e-mail, incurs no delivery charges.",
        ],
      },
      {
        titre: "Article 4 — Orders",
        blocs: [
          "The Customer selects the desired personalisation options (format, number of people/animals, background, print medium) and uploads the photos required to produce the caricature.",
          "The order is confirmed by payment of the price in full. A confirmation e-mail is sent to the Customer at the e-mail address provided when ordering.",
          "Cartoonova reserves the right to refuse or cancel any order in the event of an existing dispute, inappropriate photos or manifestly incorrect information.",
        ],
      },
      {
        titre: "Article 5 — Payment",
        blocs: [
          "Payment is made online by bank card (Visa, Mastercard, American Express) or via PayPal. Payment is secured by an SSL encryption system.",
          "The total amount is charged when the order is confirmed. No order will be processed before payment has been received in full.",
        ],
      },
      {
        titre: "Article 6 — Production times and delivery",
        blocs: [
          "A caricature is generally produced within **2 working days** of receipt of payment and photos. This time may vary depending on the complexity of the order and the artists’ workload.",
          "**Digital products:** The high-definition file is sent to the Customer by e-mail as soon as the caricature is finished. The Customer may then request revisions (Article 7).",
          "**Printed products:** A preview is submitted to the Customer, who approves it before printing. Printing and shipping then take 3 to 7 working days depending on the destination. Delivery charges and times are indicated when ordering.",
          "**Express option:** where the Customer has chosen it, the caricature is delivered within 24 hours, including at weekends, from receipt of payment and photos. For a printed product, this time applies to the drawing; printing and shipping then follow the times set out above.",
          "Cartoonova cannot be held liable for delivery delays attributable to the carrier or to an event of force majeure.",
        ],
      },
      {
        titre: "Article 7 — Revisions and satisfaction",
        blocs: [
          "Cartoonova undertakes to provide quality work that is faithful to the photos supplied. The Customer is entitled to **free and unlimited revisions** until fully satisfied.",
          "Revision requests must be made clearly and precisely by e-mail to support@cartoonova.com.",
          "Revisions cover reasonable adjustments (likeness, colours, details). They do not cover a complete change of the style or of the composition initially approved.",
          "**Satisfaction guarantee.** If, after the revisions, the caricature still does not suit the Customer, Cartoonova will refund the full price paid, upon simple request to support@cartoonova.com. For a printed product, the request must be made **before the preview is approved**: once the preview has been approved, printing begins and the product then falls under Article 9.",
        ],
      },
      {
        titre: "Article 8 — Right of withdrawal",
        blocs: [
          "In accordance with Article L221-28 of the French Consumer Code, the right of withdrawal **cannot be exercised** for contracts for the supply of goods made to the consumer’s specifications or clearly personalised.",
          "As each caricature is a unique, made-to-measure work produced from the Customer’s photos and instructions, orders for digital products are not eligible for the right of withdrawal once the creative work has begun.",
          "For printed products, if the product received is damaged or does not conform to the order, the Customer may contact customer service within 14 days of receipt to obtain an exchange or a refund.",
        ],
      },
      {
        titre: "Article 9 — Refunds",
        blocs: [
          "A refund is granted in two cases: under the satisfaction guarantee in Article 7, or where a printed product is received defective or non-conforming. In the latter case, Cartoonova will, at the Customer’s choice, replace the product or refund it in full.",
          "The refund is made to the payment method used for the order, within 14 days of the approved request.",
          "Refund requests must be sent to support@cartoonova.com together with the order number and a description of the problem.",
        ],
      },
      {
        titre: "Article 9 bis — Gift vouchers",
        blocs: [
          "Cartoonova offers gift vouchers of a fixed amount, paid for online and delivered by e-mail in the form of a code and a printable version.",
          "The voucher is valid for **12 months** from its purchase, in the currency of purchase. It may be used across one or more orders until its balance is exhausted. Each order includes a minimum of 1 (in the currency of the order) payable by the Customer; any unused balance remains available.",
          "The voucher is neither refundable nor exchangeable for cash. The 14-day right of withdrawal applies to the purchase of the voucher as long as it has not been used: a refund may then be requested at support@cartoonova.com.",
        ],
      },
      {
        titre: "Article 10 — Intellectual property",
        blocs: [
          "The caricatures created by Cartoonova are original works protected by copyright. After payment in full, the Customer receives a **personal, non-commercial right of use** of the work.",
          "Cartoonova reserves the right to use the caricatures produced for promotional purposes (portfolio, social networks), unless the Customer explicitly requests otherwise.",
        ],
      },
      {
        titre: "Article 11 — Liability",
        blocs: [
          "Cartoonova cannot be held liable for the use the Customer makes of the caricatures delivered. The Customer warrants that they hold the necessary rights to the photos submitted and that they do not use them for defamatory or unlawful purposes.",
        ],
      },
      {
        titre: "Article 12 — Data protection",
        blocs: [
          "Personal data collected in connection with orders is processed in accordance with our [Privacy Policy](/politique-de-confidentialite).",
          "Photos submitted by the Customer are used exclusively to fulfil the order and are deleted within 90 days of delivery, unless the Customer requests that they be kept.",
        ],
      },
      {
        titre: "Article 13 — Mediation and disputes",
        blocs: [
          "In the event of a dispute, the Customer is invited first to contact Cartoonova’s customer service at support@cartoonova.com in order to seek an amicable solution.",
          "In accordance with Articles L611-1 et seq. of the French Consumer Code, the Customer may have recourse, free of charge, to a consumer mediator with a view to the amicable resolution of the dispute.",
          "Failing an amicable resolution, the competent courts of Paris shall have exclusive jurisdiction. These Terms are governed by French law.",
        ],
      },
      {
        titre: "Article 14 — Contact",
        blocs: [
          "For any question relating to your order or to these Terms:",
          { lignes: ["**{raison}**", "{siege}", "Tel.: {tel}", "E-mail: support@cartoonova.com"] },
        ],
      },
    ],
  },

  mentions: {
    titre: "Legal Notice",
    miseAJour: "Last updated: 21 March 2024",
    sections: [
      {
        titre: "1. Site publisher",
        blocs: [
          {
            lignes: [
              "**Company name:** {raison}",
              "**Registered office:** {siege}",
              "**SIRET:** {siret}",
              "**RCS:** {rcs}",
              "**Share capital:** {capital}",
              "**Intra-Community VAT number:** {tva}",
              "**Telephone:** {tel}",
              "**E-mail:** support@cartoonova.com",
              "**Publication director:** {directeur}",
            ],
          },
        ],
      },
      {
        titre: "2. Hosting",
        blocs: [
          {
            lignes: [
              "**Host:** Vercel Inc.",
              "**Address:** 340 S Lemon Ave #4133, Walnut, CA 91789, United States",
              "**Website:** vercel.com",
            ],
          },
        ],
      },
      {
        titre: "3. Activity",
        blocs: [
          "Cartoonova is an online service creating personalised cartoon-style caricatures and portraits. Cartoonova turns your photos into unique portraits, available in digital format or printed on various media (poster, canvas, mug, etc.).",
        ],
      },
      {
        titre: "4. Intellectual property",
        blocs: [
          "All content on the Cartoonova site (texts, images, graphics, logo, icons, sounds, software, etc.) is protected by French and international intellectual property laws.",
          "Any reproduction, representation, modification, publication or adaptation of all or part of the elements of the site, by whatever means or process, is prohibited without the prior written authorisation of {raison}.",
          "The caricatures produced by Cartoonova remain the property of {raison} until the order has been paid in full. After payment, the customer receives a personal, non-commercial right of use of the work.",
        ],
      },
      {
        titre: "5. Personal data",
        blocs: [
          "In accordance with the General Data Protection Regulation (GDPR) and the amended French Data Protection Act of 6 January 1978 (loi « Informatique et Libertés »), you have a right of access, rectification, erasure and portability of your personal data.",
          "To exercise these rights or for any question relating to the protection of your data, contact us at: support@cartoonova.com",
          "For more details, see our [Privacy Policy](/politique-de-confidentialite).",
        ],
      },
      {
        titre: "6. Cookies",
        blocs: [
          "The Cartoonova site uses cookies to improve the user experience, analyse traffic and enable the services to function properly. By continuing to browse, you accept the use of cookies in accordance with our privacy policy.",
        ],
      },
      {
        titre: "7. Limitation of liability",
        blocs: [
          "{raison} endeavours to provide accurate and up-to-date information on the site. However, it cannot guarantee the accuracy, completeness or currency of the information published. {raison} accepts no liability for any error or omission in the content of the site.",
          "Use of the site is at the user’s own risk. {raison} cannot be held liable for any direct or indirect damage resulting from access to or use of the site.",
        ],
      },
      {
        titre: "8. Applicable law",
        blocs: [
          "This legal notice is governed by French law. In the event of a dispute, and after an attempt at amicable resolution, the competent courts of Paris shall have exclusive jurisdiction.",
        ],
      },
      {
        titre: "9. Contact",
        blocs: ["For any question, you can contact us by e-mail at: support@cartoonova.com"],
      },
    ],
  },

  confidentialite: {
    titre: "Privacy Policy",
    miseAJour: "Last updated: 21 March 2024",
    sections: [
      {
        titre: "1. Introduction",
        blocs: [
          "The company {raison} (hereinafter “Cartoonova”, “we”, “our”) is committed to protecting the privacy of its users and customers (hereinafter “you”, “your”).",
          "This Privacy Policy describes how we collect, use, store and protect your personal data when you use our website **cartoonova.com** (hereinafter “the Site”) and our personalised caricature creation services.",
          "This policy complies with the General Data Protection Regulation (GDPR — Regulation (EU) 2016/679) and the amended French Data Protection Act of 6 January 1978 (loi « Informatique et Libertés »).",
        ],
      },
      {
        titre: "2. Data controller",
        blocs: [{ lignes: ["**{raison}**", "{siege}", "SIRET: {siret}", "E-mail: support@cartoonova.com", "Tel.: {tel}"] }],
      },
      {
        titre: "3. Data collected",
        blocs: [
          "In the course of providing our services, we may collect the following categories of data:",
          { sousTitre: "3.1 Identification data" },
          { liste: ["Surname and first name", "E-mail address", "Postal address (for deliveries of printed products)", "Telephone number (optional)"] },
          { sousTitre: "3.2 Order data" },
          {
            liste: [
              "Order details (format, options, print medium)",
              "Photos submitted for producing the caricature",
              "History of orders and of exchanges with customer service",
            ],
          },
          { sousTitre: "3.3 Payment data" },
          {
            liste: [
              "Payment data (card number, etc.) is processed directly by our secure payment providers (Stripe, PayPal) and is never stored on our servers.",
            ],
          },
          { sousTitre: "3.4 Browsing data" },
          { liste: ["IP address", "Browser type and operating system", "Pages viewed and length of visit", "Cookies and session identifiers"] },
        ],
      },
      {
        titre: "4. Purposes of processing",
        blocs: [
          "Your personal data is collected and processed for the following purposes:",
          {
            liste: [
              "**Performance of orders:** producing the caricature, printing, shipping and delivery tracking.",
              "**Customer relationship management:** after-sales service, revisions, responses to your requests.",
              "**Payment:** processing and securing transactions.",
              "**Communication:** sending order confirmations, delivery notifications and, with your consent, promotional offers.",
              "**Service improvement:** anonymised statistical analysis of the use of the Site.",
              "**Legal obligations:** retention of invoices and accounting data in accordance with the regulations in force.",
            ],
          },
        ],
      },
      {
        titre: "5. Legal basis for processing",
        blocs: [
          "The processing of your data is based on the following legal bases:",
          {
            liste: [
              "**Performance of the contract:** the data required to produce and deliver your order.",
              "**Consent:** for sending marketing communications and using non-essential cookies.",
              "**Legitimate interest:** for improving our services and preventing fraud.",
              "**Legal obligation:** for retaining accounting and tax data.",
            ],
          },
        ],
      },
      {
        titre: "6. Retention period",
        blocs: [
          {
            liste: [
              "**Order data:** 3 years after the last order.",
              "**Submitted photos:** deleted within 90 days of delivery of the order, unless the Customer requests otherwise.",
              "**Accounting data:** 10 years in accordance with legal obligations.",
              "**Browsing cookies:** 13 months maximum.",
              "**Prospecting data:** 3 years after the last contact.",
            ],
          },
        ],
      },
      {
        titre: "7. Data sharing",
        blocs: [
          "Your personal data is never sold to third parties. It may be shared with:",
          {
            liste: [
              "**Our production providers:** only the photos and instructions required to produce the caricature.",
              "**Payment providers:** Stripe and PayPal for the secure processing of payments.",
              "**Printing and delivery services:** delivery address for shipping printed products.",
              "**Host:** Vercel Inc. for the technical hosting of the Site.",
              "**Analytics tools:** Google Analytics (anonymised data).",
            ],
          },
          "All our providers are subject to strict contractual obligations of confidentiality and data protection in compliance with the GDPR.",
        ],
      },
      {
        titre: "8. International transfers",
        blocs: [
          "Some of your data may be transferred outside the European Union (hosting in the United States via Vercel). These transfers are governed by the European Commission’s Standard Contractual Clauses (SCCs) or the EU-US Data Privacy Framework.",
        ],
      },
      {
        titre: "9. Cookies",
        blocs: [
          "The Site uses the following types of cookies:",
          {
            liste: [
              "**Essential cookies:** necessary for the Site to function (session, basket, authentication).",
              "**Analytics cookies:** allow us to understand how the Site is used (Google Analytics) — subject to your consent.",
              "**Marketing cookies:** used to personalise advertising — subject to your consent.",
            ],
          },
          "You can manage your cookie preferences at any time via your browser settings or via our consent banner.",
        ],
      },
      {
        titre: "10. Your rights",
        blocs: [
          "In accordance with the GDPR, you have the following rights over your personal data:",
          {
            liste: [
              "**Right of access:** to obtain confirmation that your data is being processed and to obtain a copy of it.",
              "**Right to rectification:** to correct inaccurate or incomplete data.",
              "**Right to erasure:** to request the deletion of your data (“right to be forgotten”).",
              "**Right to data portability:** to receive your data in a structured and readable format.",
              "**Right to object:** to object to the processing of your data on legitimate grounds.",
              "**Right to restriction:** to restrict the processing of your data in certain circumstances.",
              "**Right to withdraw your consent:** at any time for processing based on consent.",
            ],
          },
          "To exercise any of these rights, contact us at: support@cartoonova.com",
          "We undertake to respond to your request within 30 days. You also have the right to lodge a complaint with the **CNIL** (Commission Nationale de l'Informatique et des Libertés, the French data protection authority): [www.cnil.fr](https://www.cnil.fr).",
        ],
      },
      {
        titre: "11. Security",
        blocs: [
          "We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, loss, destruction or alteration:",
          {
            liste: [
              "SSL/TLS encryption of all communications",
              "Restricted access to data on a “need-to-know” basis",
              "Regular, secure backups",
              "Access monitoring and logging",
            ],
          },
        ],
      },
      {
        titre: "12. Minors",
        blocs: [
          "The Site is not intended for minors under the age of 16. We do not knowingly collect personal data from minors. If you are a parent or guardian and believe that your child has provided us with data, please contact us so that we can delete it.",
        ],
      },
      {
        titre: "13. Changes",
        blocs: [
          "We reserve the right to amend this Privacy Policy at any time. Any change will be published on this page together with the date of update. We invite you to consult this page regularly.",
        ],
      },
      {
        titre: "14. Contact",
        blocs: [
          "For any question concerning the protection of your personal data:",
          { lignes: ["**{raison}**", "{siege}", "Tel.: {tel}", "E-mail: support@cartoonova.com"] },
        ],
      },
    ],
  },
};
