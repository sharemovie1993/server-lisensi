"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildActivationToken = buildActivationToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const keys_1 = require("../../../utils/keys");
const constants_1 = require("../../../config/constants");
/**
 * Sign an activation JWT token using the RSA private key (RS256).
 */
function buildActivationToken(license, deviceId, vpnLicenseKey, features) {
    return jsonwebtoken_1.default.sign({
        license_key: license.licenseKey,
        product_id: license.productId,
        school_name: license.schoolName,
        device_id: deviceId,
        expires_at: license.expiresAt,
        include_vpn: license.includeVpn,
        vpn_enabled: license.includeVpn,
        vpn_license_key: vpnLicenseKey,
        features
    }, keys_1.PRIVATE_KEY, {
        algorithm: 'RS256',
        expiresIn: constants_1.JWT_EXPIRY
    });
}
