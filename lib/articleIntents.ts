import type { BlogArticle } from "./blogDb";
/** Editorial intent map, not evidence of cannibalisation. No merging without GSC evidence. */
export const FRENCH_ARTICLE_INTENTS = {
 "idees-cadeaux-d-anniversaire-simples-originales-et-vraiment-marquantes": {
  query:"idées cadeaux anniversaire", role:"guide général par budget et délai",
  title:"Cadeau d’anniversaire : choisir selon le budget et le délai",
  description:"Un guide pour choisir un cadeau d’anniversaire selon votre budget, le temps disponible et le degré de personnalisation souhaité.",
  intro:"Commencez par deux contraintes : votre budget total et le temps restant. Le choix du destinataire vient ensuite ; pour une sélection par personne, consultez notre guide femme et homme.",
  related:"idees-de-cadeaux-d-anniversaire-pour-femme-et-homme", anchor:"Choisir selon les goûts du destinataire",
 },
 "idees-de-cadeaux-d-anniversaire-pour-femme-et-homme": {
  query:"cadeau anniversaire femme homme personnalisé", role:"destinataire et centres d’intérêt",
  title:"Cadeau d’anniversaire femme ou homme : partir de ses goûts",
  description:"Choisir un cadeau d’anniversaire pour une femme ou un homme à partir de ses passions, de votre relation et des souvenirs partagés.",
  intro:"Plutôt qu’une liste genrée, partez des passions de la personne : univers préférés, souvenirs communs et place disponible chez elle. Pour organiser budget et délai, notre guide général complète cette sélection.",
  related:"idees-cadeaux-d-anniversaire-simples-originales-et-vraiment-marquantes",anchor:"Organiser le budget et le délai",
 },
 "cadeaux-photo-personnalises-comment-choisir-une-idee-vraiment-touchante": {
  query:"choisir cadeau photo personnalisé", role:"comparatif de supports et qualité de photo",
  title:"Cadeau photo personnalisé : comparer supports et qualité photo",
  description:"Photo imprimée, portrait illustré ou souvenir numérique : comparez les supports, la qualité de la photo source et les usages avant de choisir.",
  intro:"Ce comparatif aide à arbitrer entre un objet photo, un tirage et un portrait illustré : qualité du fichier source, support et usage quotidien. Pour construire un portrait autour d’un souvenir, voyez notre guide créatif.",
  related:"cadeau-photo-personnalise-une-idee-vraiment-originale",anchor:"Créer un portrait autour d’un souvenir",
 },
 "cadeau-photo-personnalise-une-idee-vraiment-originale": {
  query:"portrait personnalisé souvenir photo",role:"brief créatif d’un portrait à partir d’un souvenir",
  title:"Transformer une photo souvenir en portrait personnalisé",
  description:"Choisissez le souvenir, l’univers graphique et les détails à transmettre pour créer un portrait personnalisé à partir d’une photo.",
  intro:"Ici, l’objectif est le brief créatif : quel souvenir raconter, quel univers graphique choisir et quels détails conserver ? Pour comparer les objets et supports photo, consultez plutôt notre comparatif.",
  related:"cadeaux-photo-personnalises-comment-choisir-une-idee-vraiment-touchante",anchor:"Comparer les supports photo personnalisés",
 },
} as const;
export function getFrenchArticleIntent(slug: string) {
 return Object.hasOwn(FRENCH_ARTICLE_INTENTS, slug)
  ? FRENCH_ARTICLE_INTENTS[slug as keyof typeof FRENCH_ARTICLE_INTENTS] : undefined;
}
export function withEditorialIntent(article: BlogArticle): BlogArticle {
 if(article.locale!=="fr")return article;
 const intent=getFrenchArticleIntent(article.slug);
 if(!intent)return article;
 return {...article,title:intent.title,excerpt:intent.description,seo:{...article.seo,title:intent.title,description:intent.description}};
}
