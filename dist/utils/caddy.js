"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maybeSyncCaddy = maybeSyncCaddy;
const caddy_service_1 = require("../services/caddy.service");
/**
 * Trigger Caddy config re-sync unless the product is 'privateer' (transactional offline app).
 */
async function maybeSyncCaddy(productId) {
    if (productId !== 'privateer') {
        try {
            await (0, caddy_service_1.triggerCaddySync)();
        }
        catch (error) {
            console.error('[CaddyHelper] Failed to trigger Caddy config sync:', error);
        }
    }
}
