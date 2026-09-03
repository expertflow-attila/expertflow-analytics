import { genericWebhookProvider } from "./generic-webhook";
import { registerProvider } from "./provider";
import { stripeProvider } from "./stripe";

/**
 * Provider registration. Imported for its side effect by the webhook route, so
 * adding an integration means adding one line here rather than editing the
 * routing layer.
 */
registerProvider(stripeProvider);
registerProvider(genericWebhookProvider);

export * from "./provider";
export { stripeProvider, genericWebhookProvider };
