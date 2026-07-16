// scripts/sync-caddy.js
// Automatically syncs SQLite licenses and Supabase tenants into /etc/caddy/Caddyfile and reloads Caddy.

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const https = require('https');
const { Client } = require('pg');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MAIN_DOMAIN = process.env.MAIN_DOMAIN;
if (!MAIN_DOMAIN) {
  console.log("CRITICAL ERROR: MAIN_DOMAIN is not defined in .env");
  process.exit(1);
}

const DISABLE_HTTPS = process.env.DISABLE_HTTPS === 'true';
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const tlsBlock = (CF_TOKEN && !DISABLE_HTTPS) ? `\n    tls {\n        dns cloudflare ${CF_TOKEN}\n    }` : '';

const isLinux = process.platform === 'linux';
const caddyfilePath = isLinux ? '/etc/caddy/Caddyfile' : path.join(__dirname, '../Caddyfile.generated');
// Database URL is loaded from env for PostgreSQL

const PORT_EXCEPTIONS = {
  'cibinong': { backend: 5006, frontend: 5176 },
  '2pwk': { backend: 5005, frontend: 5174 }
};

// Supabase Request Helper
function getTenantsFromSupabase() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: `supabaselocal.${MAIN_DOMAIN}`,
      port: 443,
      path: '/rest/v1/tenants?select=id,domain_or_slug,license_key,custom_domain,is_active',
      method: 'GET',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error('Failed to parse Supabase response'));
          }
        } else {
          reject(new Error(`Supabase HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Supabase API timeout'));
    });
    req.end();
  });
}

async function run() {
  console.log('[Caddy-Sync] Starting Caddy configuration sync...');

  let client;
  try {
    // 1. Fetch data from PostgreSQL
    client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    await client.connect();

    const res = await client.query(
      `SELECT license_key, requested_slug, wireguard_ip, custom_domain, product_id, local_port FROM licenses 
       WHERE is_active = 1 AND wireguard_ip IS NOT NULL AND wireguard_ip != ''`
    );
    const activeLicenses = res.rows;

    console.log(`[Caddy-Sync] Loaded ${activeLicenses.length} active licenses with WireGuard IPs from PostgreSQL.`);

    // Map license details by key & slug
    const licenseMapByKey = {};
    const licenseMapBySlug = {};
    activeLicenses.forEach(lic => {
      if (lic.license_key) licenseMapByKey[lic.license_key.trim()] = lic;
      if (lic.requested_slug) licenseMapBySlug[lic.requested_slug.trim().toLowerCase()] = lic;
    });

    // 2. Fetch data from Supabase (DISABLED - Using Local SQLite only)
    let supabaseTenants = [];
    /*
    try {
      supabaseTenants = await getTenantsFromSupabase();
      console.log(`[Caddy-Sync] Loaded ${supabaseTenants.length} tenants from Supabase.`);
    } catch (sbErr) {
      console.warn('[Caddy-Sync] Warning: Failed to query Supabase API. Falling back to SQLite-only routing.', sbErr.message);
    }
    */

    // 3. Resolve mappings and hostnames
    const upstreams = [];

    // Map Supabase tenants to WireGuard IPs
    supabaseTenants.forEach(tenant => {
      if (!tenant.is_active) return;

      let matchedLicense = null;
      if (tenant.license_key) {
        matchedLicense = licenseMapByKey[tenant.license_key.trim()];
      }
      if (!matchedLicense && tenant.domain_or_slug) {
        matchedLicense = licenseMapBySlug[tenant.domain_or_slug.trim().toLowerCase()];
      }

      if (matchedLicense && matchedLicense.wireguard_ip) {
        const domains = [];
        if (tenant.domain_or_slug) {
          domains.push(`${tenant.domain_or_slug.trim().toLowerCase()}.${MAIN_DOMAIN}`);
        }
        if (tenant.custom_domain) {
          domains.push(tenant.custom_domain.trim().toLowerCase());
        }

        if (domains.length > 0) {
          upstreams.push({
            slug: tenant.domain_or_slug || matchedLicense.requested_slug,
            domains,
            wireguard_ip: matchedLicense.wireguard_ip
          });
        }
      }
    });

    // Fallback/Add any licenses in SQLite that weren't in Supabase but have slugs
    // Also picks up custom_domain stored directly in licenses.db (e.g. Project-Yatim tenants)
    activeLicenses.forEach(lic => {
      if (lic.requested_slug) {
        const slugClean = lic.requested_slug.trim().toLowerCase();
        // Cegah konflik dengan rute statis www
        if (slugClean === 'www') return;

        const alreadyMapped = upstreams.some(u => u.slug.toLowerCase() === slugClean);
        if (!alreadyMapped) {
          const domainsSet = new Set([`${slugClean}.${MAIN_DOMAIN}`]);
          if (lic.custom_domain) {
            domainsSet.add(lic.custom_domain.trim().toLowerCase());
          }
          const domains = Array.from(domainsSet);

          upstreams.push({
            slug: lic.requested_slug,
            domains,
            wireguard_ip: lic.wireguard_ip,
            product_id: lic.product_id,
            local_port: lic.local_port
          });
        }
      }
    });

    // 4. Generate Caddyfile content
    let caddyfile = `# Caddyfile - Generated automatically by sync-caddy.js
# Do not edit this file directly, it will be overwritten.

{
    email sharemovie1993@gmail.com
    ${DISABLE_HTTPS ? 'auto_https off' : 'on_demand_tls {\n        ask http://127.0.0.1:5001/api/public/validate-domain\n    }'}
}

# --- STATIC CENTRAL ROUTES ---

# Wildcard SSL Certificate Management (Brings wildcard cert into memory)
${(CF_TOKEN && !DISABLE_HTTPS) ? `*.${MAIN_DOMAIN} {
    tls {
        dns cloudflare ${CF_TOKEN}
    }
    respond "Not Found" 404
}` : ''}

# Central Landing/Portal Page
${MAIN_DOMAIN}, www.${MAIN_DOMAIN} {
    root * /var/www/${MAIN_DOMAIN}
    file_server
    try_files {path} {path}/ /index.html${tlsBlock}
}

# Central License Server API & admin UI
api.${MAIN_DOMAIN} {
    reverse_proxy 127.0.0.1:5001
}

# Local Supabase Kong Instance
supabaselocal.${MAIN_DOMAIN} {
    reverse_proxy 10.0.0.2:8000
}

# Central POS System
pos.${MAIN_DOMAIN} {
    reverse_proxy 10.0.0.3:3002
}

# Catch-all web client for selected subdomains (Serving static files directly)
1pwk.${MAIN_DOMAIN}, 2krw.${MAIN_DOMAIN}, 1krw.${MAIN_DOMAIN}, 1subang.${MAIN_DOMAIN}, 3cianjur.${MAIN_DOMAIN}, 1maniis.${MAIN_DOMAIN} {
    root * /var/www/${MAIN_DOMAIN}
    file_server
    try_files {path} {path}/ /index.html
}

# --- DYNAMIC TENANT GATEWAYS ---
`;

    upstreams.forEach(up => {
      const ports = PORT_EXCEPTIONS[up.slug.toLowerCase()] || { backend: 5002, frontend: 5174 };

      // Proses per domain secara terpisah agar kita bisa memberikan tls directive wildcard atau on-demand secara spesifik
      up.domains.forEach(domain => {
        const domainClean = domain.trim().toLowerCase();
        
        // Deteksi apakah domain berakhiran .MAIN_DOMAIN (domain internal absenta.id)
        const isInternalSubdomain = domainClean.endsWith(`.${MAIN_DOMAIN.toLowerCase()}`);
        
        let tenantTlsBlock = '';
        if (isInternalSubdomain && !DISABLE_HTTPS) {
          // Arahkan ke file sertifikat wildcard yang sudah ada di VPS
          tenantTlsBlock = `\n    tls /var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/wildcard_.${MAIN_DOMAIN}/wildcard_.${MAIN_DOMAIN}.crt /var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/wildcard_.${MAIN_DOMAIN}/wildcard_.${MAIN_DOMAIN}.key`;
        }

        if (up.product_id === 'easy-tunnel') {
          // Jika port lokal adalah 443, asumsikan target menggunakan HTTPS (Caddy Lokal)
          const isHttps = up.local_port === 443;
          
          if (isHttps) {
            caddyfile += `
# Tenant: ${up.slug} (Easy Tunnel - End-to-End HTTPS - ${domainClean})
${domainClean} {${tenantTlsBlock}
    reverse_proxy /socket.io/* https://${up.wireguard_ip}:${up.local_port} {
        header_up Host {host}
        transport http {
            tls_server_name ${domainClean}
        }
    }
    reverse_proxy https://${up.wireguard_ip}:${up.local_port} {
        header_up Host {host}
        transport http {
            tls_server_name ${domainClean}
        }
    }
}
`;
          } else {
            caddyfile += `
# Tenant: ${up.slug} (Easy Tunnel - ${domainClean})
${domainClean} {${tenantTlsBlock}
    reverse_proxy /socket.io/* http://${up.wireguard_ip}:${up.local_port || 5002}
    reverse_proxy http://${up.wireguard_ip}:${up.local_port || 5002}
}
`;
          }
        } else {
          caddyfile += `
# Tenant: ${up.slug} (${domainClean})
${domainClean} {${tenantTlsBlock}
    # Route backend API
    reverse_proxy /api/* http://${up.wireguard_ip}:${ports.backend}
    
    # Route frontend Vite / Web client
    reverse_proxy * http://${up.wireguard_ip}:${ports.frontend}
}
`;
        }
      });
    });

    // Write to Caddyfile
    fs.writeFileSync(caddyfilePath, caddyfile, 'utf8');
    console.log(`[Caddy-Sync] Successfully wrote Caddy configuration to ${caddyfilePath}`);

    // 5. Reload Caddy if on Linux
    if (isLinux) {
      exec('sudo systemctl is-active caddy', (activeErr, activeStdout) => {
        const isActive = !activeErr && activeStdout.trim() === 'active';
        const reloadCmd = isActive ? 'sudo systemctl reload caddy' : 'sudo systemctl restart caddy';
        console.log(`[Caddy-Sync] Caddy service is ${isActive ? 'active' : 'inactive'}. Running: ${reloadCmd}`);
        
        exec(reloadCmd, (err, stdout, stderr) => {
          if (err) {
            console.error('[Caddy-Sync] Failed to update Caddy service:', stderr || err.message);
            process.exit(1);
          } else {
            console.log('[Caddy-Sync] Caddy service successfully updated.');
            process.exit(0);
          }
        });
      });
    } else {
      console.log('[Caddy-Sync] Local Windows environment detected. Skipping Caddy service reload.');
      process.exit(0);
    }

  } catch (err) {
    console.error('[Caddy-Sync] Critical error during sync:', err.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.end().catch(() => {});
    }
  }
}

run();
