import Stripe from "stripe";
import { StripeMode } from "../types";

const getStripeSecretKey = () => {
  if (process.env.STRIPE_SECRET_KEY) {
    return process.env.STRIPE_SECRET_KEY;
  }

  if (process.env.NODE_ENV === "development") {
    return "sk_test_dummy";
  }

  throw new Error("Missing STRIPE_SECRET_KEY");
};

export const stripe = new Stripe(getStripeSecretKey(), {
  apiVersion: "2025-05-28.basil",
  appInfo: {
    name: "Dub.co",
    version: "0.1.0",
  },
});

const secretMap: Record<StripeMode, string | undefined> = {
  live: process.env.STRIPE_APP_SECRET_KEY,
  test: process.env.STRIPE_APP_SECRET_KEY_TEST,
  sandbox: process.env.STRIPE_APP_SECRET_KEY_SANDBOX,
};

const getStripeAppSecretKey = (mode: StripeMode = "test") => {
  const appSecretKey = secretMap[mode];

  if (appSecretKey) {
    return appSecretKey;
  }

  if (process.env.NODE_ENV === "development") {
    return "sk_test_dummy";
  }

  throw new Error(`Missing Stripe app secret key for ${mode} mode`);
};

// Stripe Integration App client
export const stripeAppClient = ({ mode }: { mode?: StripeMode }) => {
  return new Stripe(getStripeAppSecretKey(mode), {
    apiVersion: "2025-05-28.basil",
    appInfo: {
      name: "Dub.co",
      version: "0.1.0",
    },
  });
};
