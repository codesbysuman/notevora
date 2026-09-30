let timer = null;
export function showToast(message, options = {}) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerHTML = `<span class="toast-icon material-symbols-outlined">${escapeHtml(options.icon || 'check_circle')}</span><span class="toast-message">${escapeHtml(message)}</span>`;
  toast.classList.add('visible');
  clearTimeout(timer);
  timer = setTimeout(() => toast.classList.remove('visible'), options.duration || 3200);
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
