export const state = {
  API_BASE: window.location.origin,
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
