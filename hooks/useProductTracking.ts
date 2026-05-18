"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";

interface ProductConfig {
  productId: string;
  productName: string;
  category?: string;
}

interface SelectedOptions {
  format: "portrait" | "fullbody";
  people: number;
  animals: number;
  background?: string;
  printOption: string;
}

export function useProductTracking(config: ProductConfig) {
  const viewTracked = useRef(false);

  // Track product_viewed on mount (once only)
  useEffect(() => {
    if (viewTracked.current) return;
    viewTracked.current = true;

    posthog.capture("product_viewed", {
      product_id: config.productId,
      product_name: config.productName,
      category: config.category || "portrait_personnalise",
      url: typeof window !== "undefined" ? window.location.href : "",
      locale: typeof window !== "undefined" ? window.location.pathname.split("/")[1] : "",
    });
  }, [config.productId, config.productName, config.category]);

  // Track option selection
  const trackOptionSelected = (
    optionType: "format" | "background" | "addon" | "print" | "people" | "animals",
    optionValue: string | number,
    priceImpact: number = 0
  ) => {
    posthog.capture("option_selected", {
      product_id: config.productId,
      product_type: optionType,
      option_value: optionValue,
      price_impact: priceImpact,
    });
  };

  // Track photo upload success
  const trackPhotoUploaded = (photoCount: number = 1) => {
    posthog.capture("photo_uploaded", {
      product_id: config.productId,
      product_name: config.productName,
      photo_count: photoCount,
    });
  };

  // Track checkout started
  const trackCheckoutStarted = (
    value: number,
    currency: string,
    selectedOptions: SelectedOptions
  ) => {
    posthog.capture("checkout_started", {
      product_id: config.productId,
      product_name: config.productName,
      value,
      currency,
      selected_options: selectedOptions,
    });
  };

  // Track purchase completed (called from success page)
  const trackPurchaseCompleted = (
    value: number,
    currency: string,
    transactionId: string,
    selectedOptions: SelectedOptions
  ) => {
    posthog.capture("purchase_completed", {
      product_id: config.productId,
      product_name: config.productName,
      value,
      currency,
      transaction_id: transactionId,
      selected_options: selectedOptions,
    });
  };

  return {
    trackOptionSelected,
    trackPhotoUploaded,
    trackCheckoutStarted,
    trackPurchaseCompleted,
  };
}

// Product configurations for all 6 products
export const PRODUCT_CONFIGS: Record<string, ProductConfig> = {
  simpson: {
    productId: "cartoonova-simpson-base",
    productName: "Custom Simpson Portrait",
  },
  onepiece: {
    productId: "cartoonova-onepiece-wanted",
    productName: "One Piece Wanted Poster",
  },
  dbz: {
    productId: "cartoonova-dbz-portrait",
    productName: "Dragon Ball Z Portrait",
  },
  ghibli: {
    productId: "cartoonova-ghibli-portrait",
    productName: "Studio Ghibli Portrait",
  },
  rickandmorty: {
    productId: "cartoonova-rickandmorty-portrait",
    productName: "Rick & Morty Portrait",
  },
  disney: {
    productId: "cartoonova-disney-portrait",
    productName: "Disney Portrait",
  },
};
