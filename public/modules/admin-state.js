export const state = {
  API_BASE: window.location.origin,
  MAIN_DOMAIN: window.location.hostname.replace('api.', '').replace('www.', ''),
  ADMIN_SECRET: localStorage.getItem('@license_admin_secret') || '',
  packagesDataCache: [],
  activeLicensesCache: [],
  subscriptionsCache: [],
  invoicesCache: [],
  logsCache: [],
  productsList: [],
  tenantsList: [],
  dataPollInterval: null,
  selectedQrisBase64: null,
  revenueCache: null,
  tenantsDataCache: [],
  systemSettingsCache: null
};
