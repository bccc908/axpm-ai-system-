export type SubscriptionPlan = "free" | "basic" | "pro";

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

export type ApiKeyScope = "fortune";

export interface CustomerIntegrations {
  deepseek_api_key: string | null;
  deepseek_base_url: string | null;
  deepseek_model: string | null;
}

export interface CustomerAccount {
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  readings_today: number;
  readings_date: string | null;
  integrations: CustomerIntegrations;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  /** User id of the person who shared their signup link */
  referred_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerApiKey {
  id: string;
  user_id: string;
  label: string;
  key_prefix: string;
  key_hash: string;
  scopes: ApiKeyScope[];
  created_at: string;
  last_used_at: string | null;
}

export interface CustomerData {
  accounts: CustomerAccount[];
  api_keys: CustomerApiKey[];
}

export interface CustomerAccountPublic {
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  readings_today: number;
  readings_limit: number;
  readings_remaining: number;
  current_period_end: string | null;
  integrations: {
    deepseek_configured: boolean;
    deepseek_base_url: string | null;
    deepseek_model: string | null;
  };
  stripe_enabled: boolean;
  referred_by_user_id: string | null;
  referral_count: number;
}

export interface CustomerApiKeyPublic {
  id: string;
  label: string;
  key_prefix: string;
  scopes: ApiKeyScope[];
  created_at: string;
  last_used_at: string | null;
}
