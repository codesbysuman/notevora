import { createStore } from './state.js';
import { cacheDom } from './ui/dom.js';
import { createNavigation } from './ui/navigation.js';
import { renderApp } from './ui/render.js';
import { initTheme } from './ui/theme.js';
import { initModals } from './ui/modals.js';
import { bindEvents, bindAssetForm } from './events.js';
import { initBackup } from './backup.js';
import { hydrateLibraryFromIndexedDB } from './services/storage.js';
import { initManualWorkspace } from './manual-workspace.js';

const dom = cacheDom();
const store = createStore();
const navigation = createNavigation(store);
const modals = initModals(dom, store, navigation);

initTheme(dom);
initBackup(dom, store, navigation);
initManualWorkspace(dom, store, navigation);
bindEvents(dom, store, navigation, modals);
bindAssetForm(dom, store);
store.subscribe(state => renderApp(state, dom));
renderApp(store.getState(), dom);
navigation.syncFromHash();

// IndexedDB is the durable store; the synchronous cache above keeps first paint immediate.
void hydrateLibraryFromIndexedDB(library => {
  // If the user changed the library while IndexedDB was loading, keep the newer in-memory chain.
  if (store.getState().library.headPatchId === library.headPatchId) return;
  store.updateLibrary(library);
});

// Expose a tiny read-only debug surface. Future frameworks can replace this with devtools.
window.Notevora = Object.freeze({
  getState: () => store.getState(),
  navigate: navigation
});
// Backward-compatible debug alias for older local tooling.
window.Studiora = window.Notevora;
