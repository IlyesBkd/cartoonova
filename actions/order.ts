"use server";

export async function processOrder(orderData: unknown) {
  void orderData;
  // La logique est maintenant gérée dans /success/page.tsx
  // Cette fonction est conservée pour compatibilité mais ne fait rien
  console.log("processOrder appelé - logique déplacée vers /success");
  return { success: true };
}
