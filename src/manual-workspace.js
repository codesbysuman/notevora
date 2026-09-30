import { sanitizeAndParseJSON } from './services/json.js';
import { normalizeNote, normalizeSubjectMeta } from './utils/validation.js';
import { createUniqueNote } from './services/notes.js';
import { showToast } from './ui/toast.js';

export function initManualWorkspace(dom, store, navigation) {
  document.addEventListener('studiora-open-manual', event => openWorkspace(event.detail || {}));
  dom['manual-workspace-close']?.addEventListener('click', close);
  dom['manual-workspace-save']?.addEventListener('click', saveCreate);
  dom['manual-workspace-paste-apply']?.addEventListener('click', applyJSON);
  dom['manual-workspace-paste-toggle']?.addEventListener('click', () => dom['manual-workspace-json']?.classList.toggle('hidden'));
  dom['manual-workspace-content']?.addEventListener('click', event => { if (event.target.closest('#manual-workspace-add-part')) addPart(); onEditAction(event); });

  function openWorkspace({ mode = 'create', noteId = null, context = null }) {
    const state = store.getState();
    const note = noteId ? state.notes.find(n => Number(n.id) === Number(noteId)) : null;
    if (mode === 'edit' && !note) {
      showToast('Open a note first, then choose Edit Note.', { icon: 'description' });
      return;
    }
    dom['manual-workspace'].dataset.mode = mode;
    dom['manual-workspace'].dataset.noteId = note?.id || '';
    dom['manual-workspace-save'].classList.toggle('hidden', mode !== 'create');
    dom['manual-workspace-save'].innerHTML = '<span class="material-symbols-outlined">save</span>Save note';
    dom['manual-workspace-title'].textContent = mode === 'edit' ? 'Edit note with focus' : 'Create a note';
    dom['manual-workspace-subtitle'].textContent = mode === 'edit'
      ? 'Work directly on the parts you selected. Changes become a new safe library patch.'
      : 'Build a note visually, one useful section at a time. You can paste JSON whenever that is faster.';
    dom['manual-workspace-json'].value = '';
    dom['manual-workspace-json'].classList.add('hidden');
    if (mode === 'edit') renderEdit(note, context || { noteId: note.id, selections: [] });
    else renderCreate(state);
    dom['manual-workspace'].classList.remove('hidden');
    document.body.classList.add('manual-workspace-open');
  }

  function close() {
    dom['manual-workspace']?.classList.add('hidden');
    document.body.classList.remove('manual-workspace-open');
  }

  function renderCreate(state) {
    dom['manual-workspace-content'].innerHTML = `
      <div class="manual-hero"><span class="material-symbols-outlined">edit_square</span><div><strong>Build it your way</strong><p>Start with the basics, then add questions, MCQs, terms or paste a complete note JSON.</p></div></div>
      <div class="manual-grid">
        ${field('Subject','mw-subject',state.activeSubject || '', 'e.g. Political Science')}
        ${field('Chapter','mw-chapter',state.activeChapter || '', 'e.g. State')}
        ${field('Title','mw-title','', 'What is this note about?')}
        ${field('Class / Level','mw-level',state.subjectMeta?.[state.activeSubject]?.level || '', 'e.g. BA 1st Semester')}
      </div>
      <label class="manual-label">Main explanation</label>
      <textarea id="mw-body" class="manual-editor-area" rows="9" placeholder="Write the explanation in your own words..."></textarea>
      <div id="mw-create-parts" class="manual-create-parts"></div>
      <div class="manual-add-row"><select id="manual-workspace-add-type"><option value="qa">Question & answer</option><option value="mcq">MCQ</option><option value="term">Important term</option></select><button id="manual-workspace-add-part" class="btn-secondary" type="button"><span class="material-symbols-outlined">add</span>Add part</button></div>
    `;
  }

  function renderCreateParts() {
    const box = document.getElementById('mw-create-parts');
    if (!box) return;
    const type = dom['manual-workspace-add-type']?.value;
    const item = document.createElement('div'); item.className = 'manual-part-card';
    item.dataset.partType = type;
    if (type === 'qa') item.innerHTML = `<div class="manual-part-head"><strong>Question & answer</strong><button type="button" class="icon-btn" data-remove-create-part aria-label="Remove"><span class="material-symbols-outlined">close</span></button></div><input data-field="question" placeholder="Question"><textarea data-field="answer" rows="3" placeholder="Answer"></textarea>`;
    if (type === 'mcq') item.innerHTML = `<div class="manual-part-head"><strong>Multiple choice question</strong><button type="button" class="icon-btn" data-remove-create-part aria-label="Remove"><span class="material-symbols-outlined">close</span></button></div><input data-field="question" placeholder="Question"><input data-field="options" placeholder="Options separated by |"><select data-field="answerIndex"><option value="0">Correct option: 1</option><option value="1">Correct option: 2</option><option value="2">Correct option: 3</option><option value="3">Correct option: 4</option></select>`;
    if (type === 'term') item.innerHTML = `<div class="manual-part-head"><strong>Important term</strong><button type="button" class="icon-btn" data-remove-create-part aria-label="Remove"><span class="material-symbols-outlined">close</span></button></div><input data-field="word" placeholder="Term"><textarea data-field="def" rows="2" placeholder="Definition"></textarea>`;
    box.appendChild(item);
  }

  function addPart() { renderCreateParts(); }

  function saveCreate() {
    const state = store.getState();
    const subject = document.getElementById('mw-subject')?.value.trim();
    const chapter = document.getElementById('mw-chapter')?.value.trim();
    const title = document.getElementById('mw-title')?.value.trim();
    if (!subject || !chapter || !title) return showToast('Add a subject, chapter and title first.', { icon: 'edit_note' });
    const qas = [], mcqs = [], terms = [];
    document.querySelectorAll('#mw-create-parts .manual-part-card').forEach(card => {
      const val = key => card.querySelector(`[data-field="${key}"]`)?.value?.trim() || '';
      if (card.dataset.partType === 'qa') qas.push({ question: val('question'), answer: val('answer') });
      if (card.dataset.partType === 'mcq') mcqs.push({ question: val('question'), options: val('options').split('|').map(x=>x.trim()).filter(Boolean), answerIndex: Number(card.querySelector('[data-field="answerIndex"]')?.value || 0) });
      if (card.dataset.partType === 'term') terms.push({ word: val('word'), def: val('def'), note: '' });
    });
    const raw = { subject, chapter, title, body: document.getElementById('mw-body')?.value.trim() || '', level: document.getElementById('mw-level')?.value.trim() || '', label:'Notes', qas, mcqs, terms };
    const note = createUniqueNote(normalizeNote(raw), state.notes);
    store.replaceWithNotes([note, ...state.notes], { ...state.subjectMeta, [subject]: normalizeSubjectMeta(raw) }, 'manual_create');
    close(); navigation.reader(note); showToast('Note created and added to your library.', { icon: 'check_circle' });
  }

  function renderEdit(note, context) {
    const selections = context?.selections || [];
    const focused = selections.length ? selections : [{ type:'note', key:'note', content: note }];
    dom['manual-workspace-content'].innerHTML = `
      <div class="manual-focus-banner"><span class="material-symbols-outlined">center_focus_strong</span><div><strong>${focused.length === 1 && focused[0].type === 'note' ? 'Whole note' : `${focused.length} selected part${focused.length === 1 ? '' : 's'}`}</strong><p>Each action below changes only the selected content and is recorded as a new patch.</p></div></div>
      <div class="manual-edit-stack">${focused.map((item,index)=>editCard(note,item,index)).join('')}</div>
      <div class="manual-add-panel"><strong>Add something new</strong><p>Add a new part without touching the existing selection.</p><div class="manual-add-actions"><button data-add-edit="paragraph" class="btn-secondary" type="button">Paragraph</button><button data-add-edit="qa" class="btn-secondary" type="button">Question & answer</button><button data-add-edit="mcq" class="btn-secondary" type="button">MCQ</button></div></div>
    `;
  }

  function editCard(note,item,index) {
    const type = item.type;
    if (type === 'paragraph') return `<article class="manual-edit-card" data-edit-type="paragraph" data-key="${esc(item.key)}"><div class="manual-part-head"><strong>Paragraph</strong><button data-edit-action="remove" class="btn-danger-soft" type="button">Remove</button></div><textarea data-edit-field="body" rows="5">${esc(item.content || '')}</textarea><button data-edit-action="save" class="btn-primary btn-sm" type="button">Save this paragraph</button></article>`;
    if (type === 'qa') { const qa = note.qas?.[Number(item.key.replace('qa-',''))] || item.content || {}; return `<article class="manual-edit-card" data-edit-type="qa" data-index="${index}" data-key="${esc(item.key)}"><div class="manual-part-head"><strong>Question & answer</strong><button data-edit-action="remove" class="btn-danger-soft" type="button">Remove</button></div><input data-edit-field="question" value="${esc(qa.question || '')}" placeholder="Question"><textarea data-edit-field="answer" rows="4" placeholder="Answer">${esc(qa.answer || '')}</textarea><button data-edit-action="save" class="btn-primary btn-sm" type="button">Save this answer</button></article>`; }
    if (type === 'mcq') { const mcq = note.mcqs?.[Number(item.key.replace('mcq-',''))] || item.content || {}; return `<article class="manual-edit-card" data-edit-type="mcq" data-index="${index}" data-key="${esc(item.key)}"><div class="manual-part-head"><strong>Multiple choice question</strong><button data-edit-action="remove" class="btn-danger-soft" type="button">Remove</button></div><input data-edit-field="question" value="${esc(mcq.question || '')}" placeholder="Question"><input data-edit-field="options" value="${esc((mcq.options || []).join(' | '))}" placeholder="Option 1 | Option 2 | Option 3 | Option 4"><select data-edit-field="answerIndex">${(mcq.options || ['1','2','3','4']).map((_,i)=>`<option value="${i}" ${Number(mcq.answerIndex)===i?'selected':''}>Correct option: ${i+1}</option>`).join('')}</select><button data-edit-action="save" class="btn-primary btn-sm" type="button">Save this question</button></article>`; }
    return `<article class="manual-edit-card"><div class="manual-part-head"><strong>Whole note</strong><button data-edit-action="remove-note" class="btn-danger-soft" type="button">Delete note</button></div><input data-edit-field="title" value="${esc(note.title || '')}" placeholder="Title"><textarea data-edit-field="body" rows="7">${esc(note.body || '')}</textarea><button data-edit-action="save-note" class="btn-primary btn-sm" type="button">Save note details</button></article>`;
  }

  function onEditAction(event) {
    const add = event.target.closest('[data-add-edit]');
    if (add) return addNewEditPart(add.dataset.addEdit);
    const removeCreate = event.target.closest('[data-remove-create-part]');
    if (removeCreate) return removeCreate.closest('.manual-part-card')?.remove();
    const action = event.target.closest('[data-edit-action]');
    if (!action) return;
    const card = action.closest('.manual-edit-card'); if (!card) return;
    const state = store.getState(); const noteId = Number(dom['manual-workspace'].dataset.noteId); const note = state.notes.find(n=>Number(n.id)===noteId); if (!note) return;
    const next = structuredClone(note);
    if (action.dataset.editAction === 'remove-note') { if (!confirm('Delete this note? Your existing history stays available.')) return; store.replaceWithNotes(state.notes.filter(n=>Number(n.id)!==noteId), state.subjectMeta, 'manual_delete_note'); close(); navigation.subjects(); showToast('Note deleted. Your history is still preserved.', {icon:'delete'}); return; }
    const key = card.dataset.key; const type = card.dataset.editType;
    if (type === 'paragraph') { const parts = (next.body || '').split(/\n\s*\n/); const index = Number(String(key).replace('paragraph-','')); if (action.dataset.editAction === 'remove') parts.splice(index,1); else parts[index] = card.querySelector('[data-edit-field="body"]').value.trim(); next.body = parts.filter(Boolean).join('\n\n'); }
    if (type === 'qa') { const index = Number(key.replace('qa-','')); if (action.dataset.editAction === 'remove') next.qas.splice(index,1); else next.qas[index] = { question: card.querySelector('[data-edit-field="question"]').value.trim(), answer: card.querySelector('[data-edit-field="answer"]').value.trim() }; }
    if (type === 'mcq') { const index = Number(key.replace('mcq-','')); if (action.dataset.editAction === 'remove') next.mcqs.splice(index,1); else next.mcqs[index] = { question: card.querySelector('[data-edit-field="question"]').value.trim(), options: card.querySelector('[data-edit-field="options"]').value.split('|').map(x=>x.trim()).filter(Boolean), answerIndex: Number(card.querySelector('[data-edit-field="answerIndex"]').value) }; }
    if (action.dataset.editAction === 'save-note') { next.title = card.querySelector('[data-edit-field="title"]').value.trim(); next.body = card.querySelector('[data-edit-field="body"]').value.trim(); }
    store.replaceWithNotes(state.notes.map(n=>Number(n.id)===noteId?next:n), state.subjectMeta, 'manual_edit');
    renderEdit(next, store.getState().omniContext || {noteId});
    showToast('Change saved safely to your library.', {icon:'check_circle'});
  }

  function addNewEditPart(type) {
    const state=store.getState(); const id=Number(dom['manual-workspace'].dataset.noteId); const note=state.notes.find(n=>Number(n.id)===id); if(!note)return;
    const next=structuredClone(note);
    if(type==='paragraph') next.body = `${next.body || ''}${next.body ? '\n\n' : ''}New paragraph`;
    if(type==='qa') next.qas=[...(next.qas||[]),{question:'New question',answer:'New answer'}];
    if(type==='mcq') next.mcqs=[...(next.mcqs||[]),{question:'New question',options:['Option 1','Option 2','Option 3','Option 4'],answerIndex:0}];
    store.replaceWithNotes(state.notes.map(n=>Number(n.id)===id?next:n),state.subjectMeta,'manual_add_part');
    renderEdit(next,{noteId:id,selections:[]}); showToast('New part added. You can edit it here.',{icon:'add_circle'});
  }

  function applyJSON() {
    const raw=dom['manual-workspace-json']?.value?.trim(); if(!raw)return showToast('Paste JSON first.',{icon:'content_paste'});
    try {
      const payload=sanitizeAndParseJSON(raw); const state=store.getState(); const mode=dom['manual-workspace'].dataset.mode;
      if(mode==='create') { const note=createUniqueNote(normalizeNote(payload), state.notes); store.replaceWithNotes([note,...state.notes],{...state.subjectMeta,[note.subject]:normalizeSubjectMeta(payload)},'manual_json_create'); close(); navigation.reader(note); showToast('Note created from JSON.',{icon:'check_circle'}); }
      else { if(payload.type!=='smart-notes-patch') throw new Error('Edit JSON must be a Notevora patch.'); if(payload.basePatchId && payload.basePatchId!==state.library.headPatchId) throw new Error('This patch is for an older library version. Generate a fresh patch.'); store.applyPatchChanges(payload.changes||[],'manual_json_edit'); const note=store.getState().notes.find(n=>Number(n.id)===Number(dom['manual-workspace'].dataset.noteId)); renderEdit(note,store.getState().omniContext||{noteId:note?.id,selections:[]}); showToast('Patch checked and applied safely.',{icon:'verified'}); }
    } catch(error) { showToast(error.message,{icon:'error'}); }
  }

  function field(label,id,value,placeholder){return `<label class="manual-label">${label}<input id="${id}" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`;}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
}
