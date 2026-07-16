import { triggerCaddySync } from '../services/caddy.service';

/**
 * Trigger Caddy config re-sync unless the product is 'privateer' (transactional offline app).
 */
export async function maybeSyncCaddy(productId: string): Promise<void> {
  if (productId !== 'privateer') {
    try {
      await triggerCaddySync();
    } catch (error) {
      console.error('[CaddyHelper] Failed to trigger Caddy config sync:', error);
    }
  }
}
