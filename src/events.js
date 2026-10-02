import { findNote, createUniqueNote } from './services/notes.js';
import { sanitizeAndParseJSON } from './services/json.js';
import { normalizeNote, normalizeSubjectMeta } from './utils/validation.js';
import { buildOmniCreatePrompt, buildOmniEditPrompt } from './prompts.js';
import { hide, show } from './ui/dom.js';
import { showToast } from './ui/toast.js';

export function bindEvents(dom, store, navigation, modals) {
  dom['global-search']?.addEventListener('input', event => {
    const query = event.target.value.trim().toLowerCase();
    store.setState({ searchQuery: query });
    if (store.getState().libraryTab === 'online') return;
    if (query) navigation.search();
    else navigation.subjects();
  });

  dom['btn-search-clear']?.addEventListener('click', () => {
    dom['global-search'].value = '';
    store.setState({ searchQuery: '' });
    navigation.subjects();
    dom['global-search'].focus();
  });

  dom['btn-back']?.addEventListener('click', () => navigation.back());

  const toggleSearchMenu = (menu, other, button) => {
    if (!menu) return;
    const opening = menu.classList.contains('hidden');
    other?.classList.add('hidden');
    menu.classList.toggle('hidden', !opening);
    button?.setAttribute('aria-expanded', String(opening));
  };

  dom['btn-sort-menu']?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    toggleSearchMenu(dom['sort-menu'], dom['filter-menu'], dom['btn-sort-menu']);
  });

  dom['btn-filter-menu']?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    toggleSearchMenu(dom['filter-menu'], dom['sort-menu'], dom['btn-filter-menu']);
  });

  dom['sort-menu']?.addEventListener('click', event => {
    const sort = event.target.closest('[data-sort]');
    if (sort) {
      store.setState({ sortBy: sort.dataset.sort });
      dom['sort-menu'].classList.add('hidden');
    }
  });

  dom['filter-menu']?.addEventListener('click', event => {
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      store.setState({ searchFilter: filter.dataset.filter });
      dom['filter-menu'].classList.add('hidden');
    }
  });
  
    // In src/events.js:

  // 1. Header More menu click handler:
  dom['header-more-menu']?.addEventListener('click', event => {
    const action = event.target.closest('[data-header-action]')?.dataset.headerAction;
    if (!action) return;
    dom['header-more-menu'].classList.add('hidden');
    if (action === 'toggle-answers') store.setState({ hideAnswers: !store.getState().hideAnswers });
    if (action === 'backup') dom['btn-backup-open']?.click();
    if (action === 'history') dom['btn-history-open']?.click();
    if (action === 'profile') navigation.profile(); // <--- Navigate directly to profile page
  });

  // 2. Open Profile chips from Omnibox or Manual Workspace:
  document.addEventListener('click', event => {
    if (event.target.closest('[data-open-profile]')) {
      navigation.profile();
    }
  });

  // 3. Profile Form Submission and Reset:
  document.addEventListener('submit', event => {
    const form = event.target.closest('#profile-page-form');
    if (!form) return;
    event.preventDefault();

    const profile = {
      writingLanguage: document.getElementById('prof-writing')?.value.trim() || '',
      speakingLanguage: document.getElementById('prof-speaking')?.value.trim() || '',
      readingLanguage: document.getElementById('prof-reading')?.value.trim() || '',
      academicMedium: document.getElementById('prof-medium')?.value.trim() || '',
      academicLevel: document.getElementById('prof-level')?.value.trim() || '',
      academicBoard: document.getElementById('prof-board')?.value.trim() || '',
      university: document.getElementById('prof-university')?.value.trim() || ''
    };

    const hasAny = Object.values(profile).some(Boolean);
    store.setState({ studyProfile: hasAny ? profile : null, studyProfileSkippedAt: 0 });
    showToast('Study profile preferences updated.', { icon: 'verified' });
    navigation.subjects();
  });

  document.addEventListener('click', event => {
    if (event.target.closest('#btn-profile-clear')) {
      if (!confirm('Clear your personalized study profile?')) return;
      store.setState({ studyProfile: null, studyProfileSkippedAt: 0 });
      showToast('Study profile cleared.', { icon: 'delete' });
      navigation.profile();
    }
  });


  document.addEventListener('click', event => {
    if (!event.target.closest('.search-tool-wrap')) {
      dom['sort-menu']?.classList.add('hidden');
      dom['filter-menu']?.classList.add('hidden');
    }
    if (!event.target.closest('.header-right')) {
      dom['header-more-menu']?.classList.add('hidden');
      dom['btn-header-more']?.setAttribute('aria-expanded', 'false');
    }
  });

  dom['btn-header-more']?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const menu = dom['header-more-menu'];
    const opening = menu?.classList.contains('hidden');
    menu?.classList.toggle('hidden', !opening);
    dom['btn-header-more']?.setAttribute('aria-expanded', String(opening));
  });

  dom['header-more-menu']?.addEventListener('click', event => {
    const action = event.target.closest('[data-header-action]')?.dataset.headerAction;
    if (!action) return;
    dom['header-more-menu'].classList.add('hidden');
    if (action === 'toggle-answers') store.setState({ hideAnswers: !store.getState().hideAnswers });
    if (action === 'backup') dom['btn-backup-open']?.click();
    if (action === 'history') dom['btn-history-open']?.click();
    if (action === 'profile') document.dispatchEvent(new CustomEvent('studiora-open-study-profile'));
  });

  // Custom Groups Editor Modal
  const openCustomGroupEditor = () => {
    const renderEditor = () => {
      const state = store.getState();
      const subjects = [...new Set(state.notes.map(n => n.subject))].sort((a, b) => a.localeCompare(b));
      const groups = state.customSubjectGroups || [];
      const assigned = new Set(groups.flatMap(g => g.subjects || []));
      const ungrouped = subjects.filter(s => !assigned.has(s));
      const section = (name, members, removable) => `<section class="custom-group-drop" data-group-name="${escapeText(name)}"><div class="custom-group-title"><strong>${escapeText(name)}</strong>${removable ? `<button type="button" class="custom-group-delete" data-group-delete="${escapeText(name)}" aria-label="Delete section"><span class="material-symbols-outlined">delete</span></button>` : ''}</div><div class="custom-group-subjects">${members.map(subject => `<div class="custom-group-subject" draggable="true" data-custom-subject="${escapeText(subject)}"><span class="material-symbols-outlined">drag_indicator</span>${escapeText(subject)}</div>`).join('') || '<span class="custom-group-empty">Drop subjects here</span>'}</div></section>`;
      dom['custom-group-body'].innerHTML = [section('Ungrouped', ungrouped, false), ...groups.map(g => section(g.name, subjects.filter(s => (g.subjects || []).includes(s)), true))].join('');
    };
    renderEditor();
    show(dom['custom-group-modal']);
    const body = dom['custom-group-body'];
    let dragSubject = null;
    let dragging = false;
    body.onpointerdown = e => {
      const item = e.target.closest('[data-custom-subject]');
      if (!item) return;
      dragSubject = item.dataset.customSubject;
      dragging = false;
      item.setPointerCapture?.(e.pointerId);
    };
    body.onpointermove = e => {
      if (!dragSubject) return;
      dragging = true;
      const zone = document.elementFromPoint(e.clientX, e.clientY)?.closest('.custom-group-drop');
      body.querySelectorAll('.custom-group-drop').forEach(z => z.classList.toggle('drag-over', z === zone));
      if (dragging) e.preventDefault();
    };
    body.onpointerup = e => {
      if (!dragSubject) return;
      const zone = document.elementFromPoint(e.clientX, e.clientY)?.closest('.custom-group-drop');
      const targetName = zone?.dataset.groupName;
      const subject = dragSubject;
      dragSubject = null;
      body.querySelectorAll('.custom-group-drop').forEach(z => z.classList.remove('drag-over'));
      if (!targetName) return;
      const state = store.getState();
      let groups = (state.customSubjectGroups || []).map(g => ({ ...g, subjects: (g.subjects || []).filter(s => s !== subject) }));
      if (targetName !== 'Ungrouped') groups = groups.map(g => g.name === targetName ? { ...g, subjects: [...(g.subjects || []), subject] } : g);
      store.setState({ customSubjectGroups: groups, subjectGroupBy: 'custom' });
      renderEditor();
    };
    body.ondragstart = e => {
      const item = e.target.closest('[data-custom-subject]');
      if (item) e.dataTransfer.setData('text/plain', item.dataset.customSubject);
    };
    body.ondragover = e => {
      const z = e.target.closest('.custom-group-drop');
      if (z) { e.preventDefault(); z.classList.add('drag-over'); }
    };
    body.ondragleave = e => {
      e.target.closest('.custom-group-drop')?.classList.remove('drag-over');
    };
    body.ondrop = e => {
      const z = e.target.closest('.custom-group-drop');
      if (!z) return;
      e.preventDefault();
      const subject = e.dataTransfer.getData('text/plain');
      if (!subject) return;
      const state = store.getState();
      let groups = (state.customSubjectGroups || []).map(g => ({ ...g, subjects: (g.subjects || []).filter(s => s !== subject) }));
      if (z.dataset.groupName !== 'Ungrouped') groups = groups.map(g => g.name === z.dataset.groupName ? { ...g, subjects: [...(g.subjects || []), subject] } : g);
      store.setState({ customSubjectGroups: groups, subjectGroupBy: 'custom' });
      renderEditor();
    };
  };

  dom['btn-add-custom-group']?.addEventListener('click', () => {
    const name = prompt('Name this section');
    if (!name?.trim()) return;
    const state = store.getState();
    if ((state.customSubjectGroups || []).some(g => g.name.toLowerCase() === name.trim().toLowerCase())) return showToast('That section already exists.');
    store.setState({ customSubjectGroups: [...(state.customSubjectGroups || []), { name: name.trim(), subjects: [] }], subjectGroupBy: 'custom' });
    openCustomGroupEditor();
  });

  dom['btn-close-custom-groups']?.addEventListener('click', () => hide(dom['custom-group-modal']));
  dom['btn-done-custom-groups']?.addEventListener('click', () => hide(dom['custom-group-modal']));

  // General App Routing
  document.addEventListener('click', event => {
    const deleteButton = event.target.closest('[data-group-delete]');
    if (deleteButton) {
      const name = deleteButton.dataset.groupDelete;
      store.setState({ customSubjectGroups: (store.getState().customSubjectGroups || []).filter(g => g.name !== name) });
      openCustomGroupEditor();
      return;
    }
    const groupBy = event.target.closest('[data-group-by]')?.dataset.groupBy;
    if (groupBy) {
      store.setState({ subjectGroupBy: groupBy });
      if (groupBy === 'custom') setTimeout(openCustomGroupEditor, 0);
      return;
    }
    const groupAction = event.target.closest('[data-group-action]')?.dataset.groupAction;
    if (groupAction === 'edit-custom') { openCustomGroupEditor(); return; }
    if (groupAction === 'new') {
      const name = prompt('Name this section');
      if (!name?.trim()) return;
      store.setState({ customSubjectGroups: [...(store.getState().customSubjectGroups || []), { name: name.trim(), subjects: [] }], subjectGroupBy: 'custom' });
      openCustomGroupEditor();
      return;
    }
    if (groupAction === 'delete') {
      const name = event.target.closest('[data-group-name]')?.dataset.groupName;
      store.setState({ customSubjectGroups: (store.getState().customSubjectGroups || []).filter(g => g.name !== name) });
      return;
    }

    const target = event.target.closest('[data-action]');
    if (!target) return;
    if (target.matches('[data-clear-sort]')) { store.setState({ sortBy: stateDefaultSort(store.getState()) }); return; }
    if (target.matches('[data-clear-filter]')) { store.setState({ searchFilter: 'all' }); return; }

    const action = target.dataset.action;
    const state = store.getState();

    if (action === 'open-subject') navigation.chapters(target.dataset.subject);
    else if (action === 'library-tab') {
      event.preventDefault();
      dom['global-search'].value = '';
      navigation.library(target.dataset.libraryTab === 'online' ? 'online' : 'my');
    } else if (action === 'library-sync') {
      event.preventDefault();
      showToast('Sync is coming soon.');
    } else if (action === 'attach-note-asset') {
      document.dispatchEvent(new CustomEvent('studiora-attach-visual', { detail: { noteId: state.activeNoteId, targetType: target.dataset.targetType, targetKey: target.dataset.targetKey } }));
    } else if (action === 'open-chapter') {
      navigation.notes(state.activeSubject, target.dataset.chapter);
    } else if (action === 'open-note' || action === 'open-search-note') {
      navigation.reader(findNote(state.notes, target.dataset.noteId));
    } else if (action === 'toggle-qa') {
      const answer = document.getElementById(target.dataset.qaId);
      answer?.classList.toggle('hidden-answer');
      target.classList.toggle('open', !answer?.classList.contains('hidden-answer'));
      const icon = target.querySelector('.qa-chevron');
      if (icon) icon.textContent = answer?.classList.contains('hidden-answer') ? 'expand_more' : 'expand_less';
    } else if (action === 'delete-note') {
      if (!confirm('Permanently delete this note?')) return;
      const id = Number(target.dataset.noteId);
      store.replaceWithNotes(state.notes.filter(note => Number(note.id) !== id), state.subjectMeta, 'delete');
      navigation.notes(state.activeSubject, state.activeChapter);
    } else if (action === 'mcq') {
      const container = target.parentElement;
      container.querySelectorAll('.mcq-opt').forEach(button => {
        button.classList.remove('correct', 'incorrect');
        if (Number(button.dataset.correct) === Number(button.dataset.selected)) button.classList.add('correct');
      });
      if (Number(target.dataset.selected) !== Number(target.dataset.correct)) target.classList.add('incorrect');
    }
  });

  // Term Definitions
  document.addEventListener('click', event => {
    const term = event.target.closest('mark.term');
    if (!term) return;
    event.stopPropagation();
    const name = term.textContent;
    const def = term.dataset.def || 'No definition attached.';
    const note = term.dataset.note || '';
    dom['term-title'].textContent = name;
    dom['term-def'].textContent = def;
    dom['term-note'].textContent = note;
    dom['term-note-block'].style.display = note ? 'block' : 'none';
    dom['btn-speak-term'].onclick = () => {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`${name}. Definition: ${def}. ${note}`);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    };
    show(dom['term-sheet']);
  });

  dom['btn-close-term']?.addEventListener('click', () => {
    hide(dom['term-sheet']);
    window.speechSynthesis?.cancel?.();
  });

  // Group Dropdown Menu
  document.addEventListener('click', event => {
    const opener = event.target.closest('[data-action="open-group-menu"]');
    const menu = document.querySelector('[data-group-menu]');
    const control = opener?.closest('.group-control');
    if (opener && menu && control) {
      event.preventDefault();
      event.stopPropagation();
      const opening = !menu.classList.contains('open');
      menu.classList.toggle('open', opening);
      opener.setAttribute('aria-expanded', String(opening));
      const groups = [['category', 'Academic category', 'category'], ['level', 'Class / level', 'school'], ['board', 'Board', 'account_balance'], ['medium', 'Medium', 'translate'], ['alphabetical', 'Alphabetical', 'sort_by_alpha'], ['custom', 'Custom sections', 'tune']];
      const current = store.getState().subjectGroupBy;
      menu.innerHTML = opening ? `<div class="group-menu-panel" role="menu"><div class="group-menu-head"><div><strong>Group subjects</strong><span>Choose how your subjects are organized.</span></div><span class="material-symbols-outlined">view_agenda</span></div><div class="group-menu-options">${groups.map(([value, label, icon]) => `<button type="button" role="menuitemradio" aria-checked="${current === value}" data-group-by="${value}" class="group-menu-option ${current === value ? 'selected' : ''}"><span class="material-symbols-outlined">${icon}</span><span>${label}</span>${current === value ? '<span class="material-symbols-outlined group-check">check</span>' : ''}</button>`).join('')}</div>${current === 'custom' ? '<div class="group-menu-actions"><button type="button" data-group-action="edit-custom"><span class="material-symbols-outlined">edit</span>Edit custom sections</button><button type="button" data-group-action="new"><span class="material-symbols-outlined">add</span>New custom section</button></div>' : ''}</div>` : '';
      return;
    }
    if (menu?.classList.contains('open') && !event.target.closest('[data-group-menu]')) {
      menu.classList.remove('open');
      document.querySelector('[data-action="open-group-menu"]')?.setAttribute('aria-expanded', 'false');
    }
  });

  bindOmnibox(dom, store, navigation, modals);
}

function openAssetEditor(dom, store, targetsOrType, targetKey) {
  const state = store.getState();
  const note = state.notes.find(n => Number(n.id) === Number(state.activeNoteId || state.omniContext?.noteId));
  if (!note) return;
  const targets = Array.isArray(targetsOrType) ? targetsOrType : [{ type: targetsOrType, key: targetKey }];
  dom['asset-form'].dataset.noteId = note.id;
  dom['asset-form'].dataset.targets = JSON.stringify(targets);
  dom['asset-form'].reset();
  dom['asset-target-type'].value = targets[0]?.type || 'note';
  dom['asset-target-key'].value = targets[0]?.key || 'note';
  dom['asset-target-label'].textContent = targets.length > 1 ? `Attach to: ${targets.length} selected parts` : `Attach to: ${String(targets[0]?.type || 'note').replaceAll('-', ' ')} · ${targets[0]?.key || 'note'}`;
  show(dom['asset-modal']);
}

export function bindAssetForm(dom, store) {
  dom['btn-close-asset']?.addEventListener('click', () => hide(dom['asset-modal']));
  dom['btn-close-asset-secondary']?.addEventListener('click', () => hide(dom['asset-modal']));
  const syncAssetSourceFields = () => {
    const source = dom['asset-source']?.value || 'url';
    const urlField = dom['asset-url']?.closest('.form-field');
    const promptField = dom['asset-prompt']?.closest('.form-field');
    if (urlField) urlField.classList.toggle('hidden', source === 'ai');
    if (promptField) promptField.classList.toggle('hidden', source !== 'ai' && source !== 'custom');
  };
  dom['asset-source']?.addEventListener('change', syncAssetSourceFields);
  syncAssetSourceFields();
  dom['asset-form']?.addEventListener('submit', event => {
    event.preventDefault();
    const state = store.getState();
    const note = state.notes.find(n => Number(n.id) === Number(dom['asset-form'].dataset.noteId));
    if (!note) return;
    const type = dom['asset-type'].value;
    const source = dom['asset-source'].value;
    const url = dom['asset-url'].value.trim();
    if (source === 'url' && !/^https?:\/\//i.test(url)) {
      showToast('Enter a valid http(s) resource URL.', { icon: 'link' });
      return;
    }
    const targets = JSON.parse(dom['asset-form'].dataset.targets || JSON.stringify([{ type: dom['asset-target-type'].value, key: dom['asset-target-key'].value }]));
    const base = { type, source, url, title: dom['asset-title'].value.trim(), caption: dom['asset-caption'].value.trim(), prompt: dom['asset-prompt'].value.trim() };
    const additions = targets.map(target => ({ ...base, id: `asset_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`}`, target: { type: target.type, key: target.key } }));
    const next = state.notes.map(n => Number(n.id) === Number(note.id) ? { ...n, assets: [...(n.assets || []), ...additions] } : n);
    store.replaceWithNotes(next, state.subjectMeta, 'attach_asset');
    hide(dom['asset-modal']);
  });
}

function stateDefaultSort(state) {
  return state.currentView === 'search' ? 'relevance' : 'title';
}

function bindOmnibox(dom, store, navigation, modals) {
  if (!dom['omni-box']) return;

  if (dom['omni-context-thread'] && dom['omni-manual-actions'] && dom['omni-context-thread'].parentElement !== dom['omni-box']) {
    dom['omni-box'].insertBefore(dom['omni-context-thread'], dom['omni-manual-actions']);
  }

  let clipboardOfferTimer = null;
  let activeOmniTab = 'ai'; // 'ai' or 'manual'

  // Inspects clipboard content using the schema validation pipeline instead of regex
  function inspectClipboardPayload(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;
    try {
      const parsed = sanitizeAndParseJSON(rawText);
      if (!parsed || typeof parsed !== 'object') return null;

      // Smart Patch structure check
      if (parsed.type === 'smart-notes-patch' && Array.isArray(parsed.changes)) {
        return { kind: 'patch', payload: parsed, label: 'Smart Patch' };
      }

      // Complete Note structure check (normalizes and validates required keys)
      if (parsed.subject && parsed.chapter && parsed.title) {
        const normalized = normalizeNote(parsed);
        return { kind: 'note', payload: normalized, label: `Note: "${normalized.title}"` };
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  // Passive background clipboard check (no error toasts on tab switch)
  async function checkClipboardAfterReturn() {
    clearTimeout(clipboardOfferTimer);
    clipboardOfferTimer = setTimeout(async () => {
      if (document.visibilityState !== 'visible') return;
      await offerRecentClipboard();
    }, 350);
  }

  document.addEventListener('visibilitychange', () => {
    const state = store.getState();
    if (document.visibilityState === 'visible' && state.omniCanOfferClipboard) {
      checkClipboardAfterReturn();
    }
  });

  const placeholders = {
    create: 'Describe the note you want to create…',
    edit: 'Explain what you want to change in the selected context…'
  };

  // Top Segmented Pill Toggle: AI Assistant vs Manual Editor
  dom['omni-tab-ai']?.addEventListener('click', () => {
    activeOmniTab = 'ai';
    dom['omni-tab-ai'].classList.add('active');
    dom['omni-tab-ai'].setAttribute('aria-selected', 'true');
    dom['omni-tab-manual']?.classList.remove('active');
    dom['omni-tab-manual']?.setAttribute('aria-selected', 'false');

    dom['omni-manual-actions']?.classList.add('hidden');
    dom['omni-ai-container']?.classList.remove('hidden');
    setMode('create');
  });

  dom['omni-tab-manual']?.addEventListener('click', () => {
    activeOmniTab = 'manual';
    dom['omni-tab-manual'].classList.add('active');
    dom['omni-tab-manual'].setAttribute('aria-selected', 'true');
    dom['omni-tab-ai']?.classList.remove('active');
    dom['omni-tab-ai']?.setAttribute('aria-selected', 'false');

    dom['omni-ai-container']?.classList.add('hidden');
    dom['omni-manual-actions']?.classList.remove('hidden');
    dom['omni-response-wrap']?.classList.add('hidden');
    document.body.classList.remove('omni-gathering-active', 'context-gathering');
    renderOmniContext();
  });

  // Manual Mode: Create Note Button
  dom['btn-omni-manual-create']?.addEventListener('click', () => {
    setMode('create');
    document.dispatchEvent(new CustomEvent('studiora-open-manual', { detail: { mode: 'create' } }));
  });

  // Manual Mode: Edit Note Button (Note-selection only, opens immediately if a note is active)
  dom['btn-omni-manual-edit']?.addEventListener('click', () => {
    const state = store.getState();
    const targetId = state.activeNoteId || state.omniContext?.noteId;
    const note = targetId ? state.notes.find(n => Number(n.id) === Number(targetId)) : null;

    if (note) {
      store.setState({ omniMode: 'edit', omniContext: { noteId: note.id, selections: [] }, omniContextGathering: false });
      document.body.classList.remove('omni-gathering-active', 'context-gathering');
      renderOmniContext();
      document.dispatchEvent(new CustomEvent('studiora-open-manual', { detail: { mode: 'edit', noteId: note.id } }));
    } else {
      store.setState({ omniMode: 'edit', omniContext: null, omniContextGathering: false });
      renderOmniContext();
      showToast('Select a note above to edit.', { icon: 'description' });
    }
  });

  const setMode = mode => {
    const current = store.getState();
    if (mode === 'edit' && current.activeNoteId && activeOmniTab === 'ai') {
      const note = current.notes.find(n => Number(n.id) === Number(current.activeNoteId));
      if (note) {
        startContextGathering(note, false);
        return;
      }
    }
    const nextContext = mode === 'edit'
      ? (current.omniContext?.noteId ? current.omniContext : (current.activeNoteId ? { noteId: current.activeNoteId, selections: [] } : null))
      : null;

    store.setState({
      omniMode: mode,
      omniMessage: '',
      omniContext: nextContext,
      omniContextGathering: false,
      omniAwaitingResponse: false,
      omniVisualAttach: false
    });

    if (dom['omni-input']) {
      dom['omni-input'].value = '';
      dom['omni-input'].placeholder = placeholders[mode] || placeholders.create;
    }
    dom['omni-response-wrap']?.classList.add('hidden');
    syncResponseChip();
    document.body.classList.remove('omni-gathering-active', 'context-gathering');
    renderOmniContext();
  };

  dom['omni-modes']?.addEventListener('click', event => {
    const button = event.target.closest('[data-omni-mode]');
    if (!button) return;
    setMode(button.dataset.omniMode);
  });

  dom['omni-input']?.addEventListener('input', event => {
    store.setState({ omniMessage: event.target.value });
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.min(event.target.scrollHeight, 130)}px`;
  });

  dom['omni-submit']?.addEventListener('click', submitOmni);
  dom['omni-input']?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitOmni();
    }
  });

  dom['omni-response-submit']?.addEventListener('click', processOmniResponse);

  // Active user-gesture Paste button with Permission Re-Allow Guidance
  dom['omni-paste-toggle']?.addEventListener('click', async () => {
    const open = dom['omni-response-wrap']?.classList.toggle('hidden') === false;
    store.setState({ omniResponseOpen: open });
    syncResponseChip();

    if (open) {
      dom['omni-response-input']?.focus();
      if (navigator.clipboard?.readText) {
        try {
          const text = (await navigator.clipboard.readText()).trim();
          const inspection = inspectClipboardPayload(text);
          if (inspection) {
            dom['omni-response-input'].value = text;
            showToast(`Pasted valid ${inspection.kind}: ${inspection.label}`, { icon: 'content_paste' });
          }
        } catch (err) {
          if (err.name === 'NotAllowedError') {
            showToast('Clipboard access denied. Tap the lock/tune icon in your address bar to allow.', { icon: 'lock_open', duration: 5500 });
          }
        }
      }
    }
  });

  function syncResponseChip() {
    const state = store.getState();
    const chip = dom['omni-paste-toggle'];
    const label = document.getElementById('omni-response-submit-label');
    if (chip) {
      chip.classList.toggle('active', !!state.omniResponseOpen);
    }
    if (label) label.textContent = state.omniMode === 'edit' ? 'Edit Note' : 'Create Note';
  }

  dom['omni-context-close']?.addEventListener('click', () => {
    const state = store.getState();
    if (state.omniMode === 'edit') {
      store.setState({
        omniMode: 'create',
        omniContext: null,
        omniContextGathering: false,
        omniVisualAttach: false,
        omniAwaitingResponse: false,
        omniResponseOpen: false
      });
      document.body.classList.remove('omni-gathering-active', 'context-gathering');
      renderOmniContext();
    } else {
      dom['omni-context-thread']?.classList.add('hidden');
    }
  });

  document.addEventListener('studiora-attach-visual', event => {
    const noteId = event.detail?.noteId;
    const note = store.getState().notes.find(n => Number(n.id) === Number(noteId));
    if (!note) return;
    startContextGathering(note, true);
  });

  dom['omni-context-done']?.addEventListener('click', () => finishContextGathering());

  // Click on context chips
  dom['omni-context-list']?.addEventListener('click', event => {
    if (event.target.closest('[data-open-profile]')) {
      document.dispatchEvent(new CustomEvent('studiora-open-study-profile'));
      return;
    }
    const chip = event.target.closest('[data-context-note-id]');
    if (!chip) return;
    const note = store.getState().notes.find(n => String(n.id) === String(chip.dataset.contextNoteId));
    if (!note) return;

    // In Manual Mode: Select the note and launch the editor directly (No granular gathering)
    if (activeOmniTab === 'manual') {
      store.setState({ omniMode: 'edit', omniContext: { noteId: note.id, selections: [] }, omniContextGathering: false });
      document.body.classList.remove('omni-gathering-active', 'context-gathering');
      renderOmniContext();
      document.dispatchEvent(new CustomEvent('studiora-open-manual', { detail: { mode: 'edit', noteId: note.id } }));
      return;
    }

    // In AI Assistant mode: Proceed with granular context gathering
    startContextGathering(note, false);
  });

  function startContextGathering(note, visualAttach = false) {
    navigation.reader(note);
    setTimeout(() => {
      store.setState({
        omniMode: 'edit',
        omniContext: { noteId: note.id, selections: [] },
        omniContextGathering: true,
        omniAwaitingResponse: false,
        omniVisualAttach: visualAttach
      });
      document.body.classList.add('omni-gathering-active', 'context-gathering');
      renderOmniContext();
    }, 0);
  }

  function finishContextGathering() {
    const state = store.getState();
    if (!state.omniContext?.noteId) return;
    store.setState({ omniContextGathering: false });
    document.body.classList.remove('omni-gathering-active', 'context-gathering');

    if (state.omniVisualAttach) {
      const selections = state.omniContext.selections || [];
      const targets = selections.length
        ? selections.map(item => ({ type: item.targetType || item.type, key: item.targetKey || item.key }))
        : [{ type: 'note', key: 'note' }];
      store.setState({ omniVisualAttach: false });
      openAssetEditor(dom, store, targets);
    }
    renderOmniContext();
  }

  // Only allow granular DOM click selections in AI Assistant mode
  document.addEventListener('click', event => {
    const state = store.getState();
    if (!state.omniContextGathering || state.omniMode !== 'edit' || activeOmniTab === 'manual') return;
    const target = event.target.closest('.context-selectable');
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();

    const note = state.notes.find(n => Number(n.id) === Number(state.omniContext?.noteId));
    if (!note) return;

    const item = contextItemFromElement(target, note);
    if (!item) return;
    const selections = [...(state.omniContext.selections || [])];
    const key = `${item.type}:${item.key}`;
    const existing = selections.findIndex(x => `${x.type}:${x.key}` === key);
    if (existing >= 0) {
      selections.splice(existing, 1);
      target.classList.remove('omni-selected');
    } else {
      selections.push(item);
      target.classList.add('omni-selected');
    }
    store.setState({ omniContext: { ...state.omniContext, selections } });
    renderOmniContext();
  }, true);

  let lastScroll = window.scrollY;
  window.addEventListener('scroll', () => {
    const box = dom['omni-box'];
    if (!box || store.getState().omniContextGathering) return;
    const y = window.scrollY;
    box.classList.toggle('omni-hidden-scroll', y > lastScroll && y > 90);
    if (y < lastScroll || y < 50) box.classList.remove('omni-hidden-scroll');
    lastScroll = y;
  }, { passive: true });

  const updateKeyboardOffset = () => {
    const vv = window.visualViewport;
    const offset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    document.documentElement.style.setProperty('--studiora-keyboard-offset', `${Math.round(offset)}px`);
  };
  window.visualViewport?.addEventListener('resize', updateKeyboardOffset);
  window.visualViewport?.addEventListener('scroll', updateKeyboardOffset);
  dom['omni-input']?.addEventListener('focus', () => setTimeout(() => {
    updateKeyboardOffset();
    dom['omni-input']?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, 120));
  dom['omni-input']?.addEventListener('blur', () => setTimeout(updateKeyboardOffset, 180));
  updateKeyboardOffset();

  dom['btn-manual-paste-json']?.addEventListener('click', () => {
    const state = store.getState();
    if (state.omniMode === 'edit') {
      show(dom['patch-modal']);
      showToast('Paste the patch JSON to apply it to the selected note.', { icon: 'content_paste' });
    } else {
      document.getElementById('tab-btn-ai')?.click();
      show(dom['note-modal']);
      dom['ai-json-input']?.focus();
      showToast('Paste the generated note JSON here.', { icon: 'content_paste' });
    }
  });

  // Study profile listeners
  document.addEventListener('studiora-open-study-profile', () => openStudyProfile(true));

  function profileValue(id) { return dom[id]?.value?.trim() || ''; }

  function fillStudyProfile() {
    const state = store.getState();
    const meta = state.activeSubject ? (state.subjectMeta?.[state.activeSubject] || {}) : {};
    const profile = state.studyProfile || {};
    const values = {
      'profile-speaking': profile.speakingLanguage || '',
      'profile-writing': profile.writingLanguage || '',
      'profile-reading': profile.readingLanguage || '',
      'profile-medium': profile.academicMedium || meta.medium || '',
      'profile-level': profile.academicLevel || meta.level || '',
      'profile-board': profile.academicBoard || meta.board || '',
      'profile-university': profile.university || ''
    };
    Object.entries(values).forEach(([id, value]) => { if (dom[id]) dom[id].value = value; });
  }

  let studyProfileOpen = false;
  let studyProfileResolve = null;

  function openStudyProfile(fromMenu = false) {
    if (studyProfileOpen) return Promise.resolve(true);
    studyProfileOpen = true;
    fillStudyProfile();
    show(dom['study-profile-modal']);
    if (fromMenu) dom['header-more-menu']?.classList.add('hidden');
    return new Promise(resolve => { studyProfileResolve = resolve; });
  }

  function closeStudyProfile(result = true, skipped = false) {
    const profile = {
      speakingLanguage: profileValue('profile-speaking'),
      writingLanguage: profileValue('profile-writing'),
      readingLanguage: profileValue('profile-reading'),
      academicMedium: profileValue('profile-medium'),
      academicLevel: profileValue('profile-level'),
      academicBoard: profileValue('profile-board'),
      university: profileValue('profile-university')
    };
    if (result) {
      store.setState({ studyProfile: Object.values(profile).some(Boolean) ? profile : null, studyProfileSkippedAt: skipped ? Date.now() : 0 });
      if (!skipped) showToast('Study preferences updated.', { icon: 'tune' });
    }
    hide(dom['study-profile-modal']);
    studyProfileOpen = false;
    const resolve = studyProfileResolve;
    studyProfileResolve = null;
    resolve?.(result);
  }

  dom['btn-save-study-profile']?.addEventListener('click', () => closeStudyProfile(true, false));
  dom['btn-skip-study-profile']?.addEventListener('click', () => closeStudyProfile(true, true));
  dom['btn-close-study-profile']?.addEventListener('click', () => closeStudyProfile(true, true));

  function ensureStudyProfile() {
    const state = store.getState();
    if (state.studyProfile) return Promise.resolve(true);
    if (state.studyProfileSkippedAt && Date.now() - state.studyProfileSkippedAt < 7 * 86400000) return Promise.resolve(true);
    return openStudyProfile(false);
  }

  async function submitOmni() {
    let state = store.getState();
    const message = dom['omni-input'].value.trim();
    if (!message && state.omniMode !== 'edit') {
      dom['omni-input'].focus();
      return;
    }

    if (state.omniMode === 'edit' && !state.omniContext?.noteId) {
      showToast('Choose a note from the Context thread first.', { icon: 'description' });
      renderOmniContext();
      return;
    }

    if (!(await ensureStudyProfile())) return;
    state = store.getState();

    let prompt;
    try {
      if (state.omniMode === 'create') {
        const meta = state.activeSubject ? (state.subjectMeta?.[state.activeSubject] || {}) : {};
        const chapterNote = state.notes.find(n => n.subject === state.activeSubject && n.chapter === state.activeChapter);
        prompt = buildOmniCreatePrompt(message, {
          subject: state.activeSubject,
          chapter: state.activeChapter,
          chapterNumber: chapterNote?.chapterNumber ?? null,
          board: meta.board,
          medium: meta.medium,
          level: meta.level,
          university: state.studyProfile?.university || null,
          studyProfile: state.studyProfile || {}
        });
      } else {
        const note = state.notes.find(n => Number(n.id) === Number(state.omniContext.noteId));
        const meta = state.subjectMeta?.[note.subject] || {};
        prompt = buildOmniEditPrompt({
          id: note.id,
          subject: note.subject,
          chapter: note.chapter,
          chapterNumber: note.chapterNumber,
          title: note.title,
          label: note.label,
          board: meta.board,
          medium: meta.medium,
          level: meta.level,
          selectedContext: state.omniContext.selections || [{ type: 'note', key: 'note', content: note }],
          note,
          studyProfile: state.studyProfile || {}
        }, message, state.library.headPatchId || '');
      }
    } catch (error) {
      showToast(error.message, { icon: 'error' });
      return;
    }

    store.setState({ omniMessage: '', omniAwaitingResponse: true, omniResponseOpen: true, omniCanOfferClipboard: true, omniLastSubmittedPrompt: prompt });
    syncResponseChip();
    dom['omni-input'].value = '';
    dom['omni-input'].style.height = 'auto';
    dom['omni-response-wrap']?.classList.remove('hidden');

    showToast('Choose your AI app in the share menu, then copy its JSON response.', { icon: 'ios_share' });

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Notevora AI prompt', text: prompt });
      } else {
        await navigator.clipboard?.writeText(prompt);
        showToast('Share is unavailable, so the prompt was copied.');
      }
    } catch (_) {}

    dom['omni-response-input']?.focus();
    checkClipboardAfterReturn();
  }

  // Passive auto-suggestion using the parser pipeline instead of regex
  async function offerRecentClipboard() {
    const state = store.getState();
    if (!state.omniCanOfferClipboard || !navigator.clipboard?.readText) return;
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text || text === state.omniLastSubmittedPrompt || text === dom['omni-response-input']?.value.trim()) return;
      
      const inspection = inspectClipboardPayload(text);
      if (!inspection) return; // Cleanly ignore non-JSON or invalid schema strings

      showClipboardPrompt(text, inspection);
    } catch (_) {}
  }

  function showClipboardPrompt(text, inspection) {
    let prompt = document.getElementById('omni-clipboard-prompt');
    if (prompt) prompt.remove();

    prompt = document.createElement('div');
    prompt.id = 'omni-clipboard-prompt';
    prompt.className = 'omni-clipboard-prompt';
    prompt.innerHTML = `
      <div class="omni-clipboard-card">
        <div class="omni-clipboard-icon">
          <span class="material-symbols-outlined">${inspection.kind === 'patch' ? 'difference' : 'note_add'}</span>
        </div>
        <div class="omni-clipboard-copy">
          <strong>Paste ${inspection.kind === 'patch' ? 'Patch' : 'Note'}?</strong>
          <p>Found valid structured data: ${escapeText(inspection.label)}</p>
        </div>
        <div class="omni-clipboard-actions">
          <button type="button" data-clipboard-choice="yes" class="btn-primary">Paste & Review</button>
          <button type="button" data-clipboard-choice="no" class="btn-ghost">Dismiss</button>
        </div>
      </div>`;

    document.body.appendChild(prompt);
    prompt.addEventListener('click', event => {
      const choice = event.target.closest('[data-clipboard-choice]')?.dataset.clipboardChoice;
      if (!choice) return;
      if (choice === 'yes') {
        dom['omni-response-input'].value = text;
        dom['omni-response-wrap']?.classList.remove('hidden');
        dom['omni-response-input']?.focus();
        showToast('AI response loaded. Check it, then tap the action button.', { icon: 'verified' });
      }
      prompt.remove();
      store.setState({ omniCanOfferClipboard: false });
    });
  }

  function contextItemFromElement(el, note) {
    if (el.matches('[data-paragraph-key]') || el.dataset.contextType === 'paragraph') {
      return {
        type: 'paragraph',
        targetType: 'paragraph',
        targetKey: el.dataset.paragraphKey,
        key: el.dataset.paragraphKey,
        content: el.innerText.trim()
      };
    }
    if (el.dataset.contextType === 'qa') {
      const index = Number(el.dataset.contextIndex);
      return { type: 'qa', targetType: 'qa-question', targetKey: `qa-question-${index}`, key: `qa-${index}`, content: note.qas?.[index] || null };
    }
    if (el.dataset.contextType === 'mcq') {
      const index = Number(el.dataset.contextIndex);
      return { type: 'mcq', targetType: 'mcq-question', targetKey: `mcq-question-${index}`, key: `mcq-${index}`, content: note.mcqs?.[index] || null };
    }
    return null;
  }

  // Unified Context System
  function renderOmniContext() {
    const state = store.getState();
    document.querySelectorAll('.omni-mode').forEach(button => {
      button.classList.toggle('active', button.dataset.omniMode === state.omniMode);
    });

    const thread = dom['omni-context-thread'];
    if (!thread) return;

    const typeLabel = document.getElementById('omni-context-type-label') || thread.querySelector('.omni-context-head strong');
    const descLabel = document.getElementById('omni-context-list-label');

    // 1. Edit Mode Context (Active in BOTH AI Assistant & Manual Editor)
    if (state.omniMode === 'edit') {
      thread.classList.remove('hidden');
      if (typeLabel) typeLabel.textContent = 'Note Context';
      const notes = state.notes || [];
      const selectedNoteId = state.omniContext?.noteId || state.activeNoteId;
      const selections = state.omniContext?.selections || [];

      dom['omni-context-list'].innerHTML = notes.slice(0, 20).map(note => {
        const active = String(note.id) === String(selectedNoteId);
        return `<button type="button" class="omni-context-chip ${active ? 'selected' : ''}" data-context-note-id="${note.id}"><span class="material-symbols-outlined">description</span>${escapeText(note.title || 'Untitled note')}</button>`;
      }).join('') || '<span class="omni-context-chip">No notes available</span>';

      // In Manual Mode: Note-only context selection
      if (activeOmniTab === 'manual') {
        if (dom['omni-context-done']) dom['omni-context-done'].classList.add('hidden');
        if (descLabel) {
          const selectedNote = notes.find(n => Number(n.id) === Number(selectedNoteId));
          descLabel.textContent = selectedNote
            ? `Ready to edit: "${selectedNote.title}" (tap another note to change)`
            : 'Select a note above to edit in the manual editor';
        }
        return;
      }

      // In AI Assistant Mode: Granular sub-part selection
      if (dom['omni-context-done']) dom['omni-context-done'].classList.toggle('hidden', !state.omniContextGathering);
      if (descLabel) {
        descLabel.textContent = selectedNoteId
          ? `${selections.length ? `${selections.length} focused part${selections.length === 1 ? '' : 's'}` : 'Entire note'} • tap content to select, then tap ✓`
          : 'Choose a note to focus changes';
      }

      if (selectedNoteId) {
        const selectedKeys = new Set(selections.map(item => `${item.type}:${item.key}`));
        document.querySelectorAll('[data-paragraph-key]').forEach(el => {
          const key = `paragraph:${el.dataset.paragraphKey}`;
          el.classList.toggle('omni-selected', selectedKeys.has(key));
        });
        document.querySelectorAll('[data-context-type="qa"], [data-context-type="mcq"]').forEach(el => {
          const type = el.dataset.contextType;
          const index = Number(el.dataset.contextIndex);
          const key = `${type}:${type === 'qa' ? `qa-${index}` : `mcq-${index}`}`;
          el.classList.toggle('omni-selected', selectedKeys.has(key));
        });
      }
      return;
    }

    // 2. Create Mode Personalization Context (Active in AI Assistant & Manual Mode)
    thread.classList.remove('hidden');
    if (typeLabel) typeLabel.textContent = 'Personalization Context';
    if (dom['omni-context-done']) dom['omni-context-done'].classList.add('hidden');

    const profile = state.studyProfile || {};
    const meta = state.activeSubject ? (state.subjectMeta?.[state.activeSubject] || {}) : {};
    const chips = [];

    if (profile.writingLanguage) {
      chips.push(`<button type="button" class="omni-context-chip selected" data-open-profile><span class="material-symbols-outlined">translate</span>Writing: ${escapeText(profile.writingLanguage)}</button>`);
    }
    if (profile.speakingLanguage) {
      chips.push(`<button type="button" class="omni-context-chip selected" data-open-profile><span class="material-symbols-outlined">record_voice_over</span>Speaking: ${escapeText(profile.speakingLanguage)}</button>`);
    }
    if (profile.academicLevel || meta.level) {
      chips.push(`<button type="button" class="omni-context-chip selected" data-open-profile><span class="material-symbols-outlined">school</span>Level: ${escapeText(profile.academicLevel || meta.level)}</button>`);
    }
    if (profile.academicMedium || meta.medium) {
      chips.push(`<button type="button" class="omni-context-chip selected" data-open-profile><span class="material-symbols-outlined">menu_book</span>Medium: ${escapeText(profile.academicMedium || meta.medium)}</button>`);
    }
    if (profile.academicBoard || meta.board) {
      chips.push(`<button type="button" class="omni-context-chip selected" data-open-profile><span class="material-symbols-outlined">account_balance</span>Board: ${escapeText(profile.academicBoard || meta.board)}</button>`);
    }
    if (profile.university) {
      chips.push(`<button type="button" class="omni-context-chip selected" data-open-profile><span class="material-symbols-outlined">apartment</span>${escapeText(profile.university)}</button>`);
    }
    if (state.activeSubject) {
      chips.push(`<span class="omni-context-chip"><span class="material-symbols-outlined">folder</span>${escapeText(state.activeSubject)}</span>`);
    }

    chips.push(`<button type="button" class="omni-context-chip omni-profile-edit-chip" data-open-profile><span class="material-symbols-outlined">tune</span>${chips.length ? 'Adjust Profile' : 'Set Profile'}</button>`);

    dom['omni-context-list'].innerHTML = chips.join('');
    if (descLabel) {
      const hasPrefs = Object.values(profile).some(Boolean);
      descLabel.textContent = hasPrefs
        ? 'Current student profile tailoring generated & manual content'
        : 'Set language, level & board context for your notes';
    }
  }

  store.subscribe(() => renderOmniContext());

  function processOmniResponse() {
    const state = store.getState();
    const raw = dom['omni-response-input']?.value?.trim();
    if (!raw) return;
    try {
      const payload = sanitizeAndParseJSON(raw);
      if (state.omniMode === 'create') {
        const parsed = normalizeNote(payload);
        const uniqueParsed = createUniqueNote(parsed, state.notes);
        store.replaceWithNotes([uniqueParsed, ...state.notes], { ...state.subjectMeta, [uniqueParsed.subject]: normalizeSubjectMeta(payload) }, 'omni_create');
        dom['omni-response-input'].value = '';
        dom['omni-response-wrap'].classList.add('hidden');
        store.setState({ omniAwaitingResponse: false, omniResponseOpen: false, omniCanOfferClipboard: false, omniMessage: '' });
        syncResponseChip();
        navigation.notes(uniqueParsed.subject, uniqueParsed.chapter);
        showToast('Note created successfully.', { icon: 'check_circle' });
      } else if (state.omniMode === 'edit') {
        if (payload.type !== 'smart-notes-patch') throw new Error('Edit mode expects a smart-notes-patch JSON response.');
        if (payload.basePatchId && payload.basePatchId !== state.library.headPatchId) throw new Error('This patch is based on an older library version.');
        if (!Array.isArray(payload.changes) || !payload.changes.length) throw new Error(payload.error || 'The patch contains no changes.');
        store.applyPatchChanges(payload.changes, 'omni_edit');
        dom['omni-response-input'].value = '';
        dom['omni-response-wrap'].classList.add('hidden');
        store.setState({ omniAwaitingResponse: false, omniResponseOpen: false, omniCanOfferClipboard: false, omniContextGathering: false, omniMessage: '' });
        document.body.classList.remove('omni-gathering-active', 'context-gathering');
        renderOmniContext();
        syncResponseChip();
        navigation.reader(store.getState().notes.find(n => Number(n.id) === Number(state.omniContext.noteId)));
        showToast('Changes applied safely.', { icon: 'verified' });
      }
    } catch (error) {
      showToast(`Error processing response: ${error.message}`);
    }
  }

  function escapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  renderOmniContext();
}


function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
