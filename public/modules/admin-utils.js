export function formatIndonesianDate(dateStr) {
  try {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${day} ${months[monthIdx]} ${year}`;
  } catch {
    return dateStr;
  }
}

export function formatIndonesianDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const cleanStr = dateStr.replace('T', ' ').slice(0, 19);
    const parts = cleanStr.split(' ');
    const datePart = parts[0];
    const timePart = parts[1] || '';
    
    const formattedDate = formatIndonesianDate(datePart);
    return `${formattedDate} ${timePart}`;
  } catch {
    return dateStr;
  }
}

export function copyToClipboard(text) {
  if (!navigator.clipboard) {
    // Fallback
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback: Gagal menyalin', err);
    }
    document.body.removeChild(textArea);
    return;
  }
  navigator.clipboard.writeText(text).catch(err => {
    console.error('Gagal menyalin teks:', err);
  });
}
