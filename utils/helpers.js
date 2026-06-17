function formatIndonesianDate(dateStr) {
  try {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const day = parseInt(parts[2], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[0], 10);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${day} ${months[monthIdx]} ${year}`;
  } catch {
    return dateStr;
  }
}

function generateKey(productId, customPrefix = null) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  
  let prefix = 'LIC';
  if (customPrefix) {
    prefix = customPrefix.slice(0, 4).toUpperCase();
  } else if (productId) {
    if (productId === 'absenta') prefix = 'ABS';
    else if (productId === 'gform-orkestrator') prefix = 'ORK';
    else if (productId === 'project-yatim') prefix = 'YTM';
    else prefix = productId.slice(0, 3).toUpperCase();
  }
  
  return `${prefix}-${segment(4)}-${segment(4)}-${segment(4)}`;
}

module.exports = {
  formatIndonesianDate,
  generateKey
};

