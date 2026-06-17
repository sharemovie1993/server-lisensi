// Elements
const premiumDialogModal = document.getElementById('premiumDialogModal');
const premiumDialogCard = document.getElementById('premiumDialogCard');
const dialogIconContainer = document.getElementById('dialogIconContainer');
const dialogTitle = document.getElementById('dialogTitle');
const dialogMessage = document.getElementById('dialogMessage');
const dialogActions = document.getElementById('dialogActions');

export function showPremiumDialog(options) {
  const { type, title, message, onConfirm } = options;
  
  // Setup icon based on type
  if (type === 'confirm') {
    dialogIconContainer.className = "w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-3xl mx-auto shadow-inner border border-amber-500/20";
    dialogIconContainer.textContent = "❓";
  } else if (type === 'error') {
    dialogIconContainer.className = "w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center text-3xl mx-auto shadow-inner border border-red-500/20";
    dialogIconContainer.textContent = "⚠️";
  } else {
    dialogIconContainer.className = "w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-3xl mx-auto shadow-inner border border-emerald-500/20";
    dialogIconContainer.textContent = "✔️";
  }

  dialogTitle.textContent = title;
  dialogMessage.textContent = message;
  dialogActions.innerHTML = '';

  if (type === 'confirm') {
    // Create cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = "flex-grow bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-3 rounded-xl text-xs font-bold transition-all duration-300 border border-slate-600";
    cancelBtn.textContent = "BATAL";
    cancelBtn.onclick = closePremiumDialog;

    // Create confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.className = "flex-grow bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-3 rounded-xl text-xs tracking-wider uppercase transition-all duration-300 shadow-lg shadow-blue-600/20";
    confirmBtn.textContent = "YA, SETUJU";
    confirmBtn.onclick = () => {
      closePremiumDialog();
      if (onConfirm) onConfirm();
    };

    dialogActions.appendChild(cancelBtn);
    dialogActions.appendChild(confirmBtn);
  } else {
    // Alert type - just show OK button
    const okBtn = document.createElement('button');
    okBtn.className = "w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-xl text-xs tracking-wider uppercase transition-all duration-300 shadow-lg shadow-blue-600/20";
    okBtn.textContent = "OK, SAYA PAHAM";
    okBtn.onclick = closePremiumDialog;
    dialogActions.appendChild(okBtn);
  }

  // Show modal with transition
  premiumDialogModal.classList.remove('hidden');
  setTimeout(() => {
    premiumDialogModal.classList.remove('opacity-0');
    premiumDialogCard.classList.remove('scale-95');
  }, 10);
}

export function closePremiumDialog() {
  premiumDialogModal.classList.add('opacity-0');
  premiumDialogCard.classList.add('scale-95');
  setTimeout(() => {
    premiumDialogModal.classList.add('hidden');
  }, 300);
}

// Attach to window so legacy global handlers can still find it (if any)
window.showPremiumDialog = showPremiumDialog;
window.closePremiumDialog = closePremiumDialog;
