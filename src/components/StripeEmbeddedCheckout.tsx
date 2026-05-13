import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  priceId: string;
  organizationId: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ priceId, organizationId, returnUrl }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const url = returnUrl ?? `${window.location.origin}/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId, organizationId, returnUrl: url, environment: getStripeEnvironment() },
    });
    if (error || !data?.clientSecret) throw new Error(error?.message || data?.error || "Falha no checkout");
    return data.clientSecret;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
