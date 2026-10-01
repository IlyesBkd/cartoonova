import { notFound } from "next/navigation";

/* Attrape-tout des adresses inconnues a plusieurs segments (/fr/a/b).

   Une adresse a un seul segment passe par [produit], qui appelle notFound()
   et affiche la 404 de [locale], dans la coque du site. Une adresse a deux
   segments ou plus ne correspondait a aucune route : Next tombait sur la 404
   racine, sans en-tete ni pied de page. Cette route la ramene dans [locale]. */

export default function PageInconnue() {
  notFound();
}
