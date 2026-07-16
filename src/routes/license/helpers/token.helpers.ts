import jwt from 'jsonwebtoken';
import { PRIVATE_KEY } from '../../../utils/keys';
import { JWT_EXPIRY } from '../../../config/constants';

/**
 * Sign an activation JWT token using the RSA private key (RS256).
 */
export function buildActivationToken(
  license: { licenseKey: string; productId: string; schoolName: string; expiresAt: string; includeVpn: number },
  deviceId: string,
  vpnLicenseKey: string | null,
  features: string[]
): string {
  return jwt.sign(
    {
      license_key: license.licenseKey,
      product_id: license.productId,
      school_name: license.schoolName,
      device_id: deviceId,
      expires_at: license.expiresAt,
      include_vpn: license.includeVpn,
      vpn_enabled: license.includeVpn,
      vpn_license_key: vpnLicenseKey,
      features
    },
    PRIVATE_KEY,
    {
      algorithm: 'RS256',
      expiresIn: JWT_EXPIRY
    }
  );
}
