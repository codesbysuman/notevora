import { sanitizeAndParseJSON } from './services/json.js';
import { normalizeNote, normalizeSubjectMeta } from './utils/validation.js';
import { createUniqueNote } from './services/notes.js';
import { showToast } from './ui/toast.js';

export function initManualWorkspace(dom, store, navigation) {
  let parsedPayload = null;

  document.addEventListener('studiora-open-manual', event => openWorkspace(event.detail || {}));
  
  const getEl = id => dom[id] || document.getElementById(id);

  getEl('manual-workspace-close')?.addEventListener('click', close);
  getEl('manual-workspace-toggle-json')?.addEventListener('click', showJsonScreen);
  getEl('manual-workspace-back-to-form')?.addEventListener('click', showFormScreen);
  getEl('manual-workspace-save-main')?.addEventListener('click', saveForm);
  getEl('manual-workspace-json-apply')?.addEventListener('click', applyJsonPayload);
  getEl('manual-workspace-json')?.addEventListener('input', validateJsonInput);

  function openWorkspace({ mode = 'create', noteId = null, context = null }) {
    const state = store.getState();
    const note = noteId ? state.notes.find(n => Number(n.id) === Number(noteId)) : null;

    if (mode === 'edit' && !note) {
      showToast('Open a note first to edit it.', { icon: 'description' });
      return;
    }

    const ws = getEl('manual-workspace');
    if (!ws) return;

    ws.dataset.mode = mode;
    ws.dataset.noteId = note?.id || '';

    const badge = getEl('manual-workspace-badge');
    const title = getEl('manual-workspace-title');
    const subtitle = getEl('manual-workspace-subtitle');
    const saveLabel = getEl('manual-workspace-save-label');
    const jsonApplyLabel = getEl('manual-workspace-json-apply-label');
    const jsonScreenTitle = getEl('manual-json-screen-title');

    if (badge) badge.textContent = mode === 'edit' ? 'EDIT MODE' : 'CREATE MODE';
    if (title) title.textContent = mode === 'edit' ? `Edit "${note.title}"` : 'Create a note';
    if (subtitle) {
      subtitle.textContent = mode === 'edit'
        ? 'Update note content blocks, structured tables, questions, and terms.'
        : 'Assemble notes visually with modular paragraphs, comparative tables, and questions.';
    }

    const actionText = mode === 'edit' ? 'Save Changes' : 'Create Note';
    if (saveLabel) saveLabel.textContent = actionText;
    if (jsonApplyLabel) jsonApplyLabel.textContent = actionText;
    if (jsonScreenTitle) jsonScreenTitle.textContent = mode === 'edit' ? 'Paste Patch JSON' : 'Paste Note JSON';

    showFormScreen();
    renderContent(mode, note, state);

    ws.classList.remove('hidden');
    document.body.classList.add('manual-workspace-open');
  }

  function close() {
    getEl('manual-workspace')?.classList.add('hidden');
    document.body.classList.remove('manual-workspace-open');
  }

  function showFormScreen() {
    getEl('manual-workspace-form-screen')?.classList.remove('hidden');
    getEl('manual-workspace-json-screen')?.classList.add('hidden');
  }

  function showJsonScreen() {
    getEl('manual-workspace-form-screen')?.classList.add('hidden');
    const jsonScreen = getEl('manual-workspace-json-screen');
    const jsonInput = getEl('manual-workspace-json');
    if (jsonScreen) jsonScreen.classList.remove('hidden');
    if (jsonInput) {
      jsonInput.value = '';
      validateJsonInput();
      jsonInput.focus();
    }
  }

  function renderContent(mode, note, state) {
    const isEdit = mode === 'edit';
    const sub = isEdit ? note.subject : (state.activeSubject || '');
    const ch = isEdit ? note.chapter : (state.activeChapter || '');
    const meta = state.subjectMeta?.[sub] || {};
    const profile = state.studyProfile || {};
    const content = getEl('manual-workspace-content');
    if (!content) return;

    

    content.innerHTML = `
      <!-- 1. Basic Metadata Section -->
      <section class="mw-section-card">
        <div class="mw-section-head">
          <span class="material-symbols-outlined">info</span>
          <div>
            <strong>Basic Information</strong>
            <p>Subject, chapter, syllabus level, and topic details</p>
          </div>
        </div>
        <div class="mw-grid-2">
          <label class="mw-field"><span>Subject *</span><input id="mw-f-subject" value="${esc(sub)}" placeholder="e.g. Political Science"></label>
          <label class="mw-field"><span>Chapter *</span><input id="mw-f-chapter" value="${esc(ch)}" placeholder="e.g. State & Governance"></label>
          <label class="mw-field"><span>Note Title *</span><input id="mw-f-title" value="${esc(isEdit ? note.title : '')}" placeholder="What is this note about?"></label>
          <label class="mw-field"><span>Chapter Number</span><input id="mw-f-chapnum" type="number" value="${esc(isEdit && note.chapterNumber != null ? note.chapterNumber : '')}" placeholder="e.g. 1"></label>
          <label class="mw-field"><span>Class / Level</span><input id="mw-f-level" value="${esc(meta.level || profile.academicLevel || (isEdit ? note.level : ''))}" placeholder="e.g. BA 1st Semester"></label>
          <label class="mw-field"><span>Board / Curriculum</span><input id="mw-f-board" value="${esc(meta.board || profile.academicBoard || (isEdit ? note.board : ''))}" placeholder="e.g. Gauhati University"></label>
          <label class="mw-field"><span>Medium</span><input id="mw-f-medium" value="${esc(meta.medium || profile.academicMedium || (isEdit ? note.medium : ''))}" placeholder="e.g. English"></label>
          <label class="mw-field"><span>Note Label</span><input id="mw-f-label" value="${esc(isEdit ? note.label : 'Notes')}" placeholder="e.g. Notes, PYQ, Summary"></label>
        </div>
      </section>

      <!-- 2. Modular Note Body Builder (Paragraphs, Headings, Tables) -->
      <section class="mw-section-card">
        <div class="mw-section-head">
          <span class="material-symbols-outlined">view_agenda</span>
          <div>
            <strong>Note Explanation Blocks</strong>
            <p>Structure your explanations with modular paragraphs, subheadings, and comparison tables</p>
          </div>
          <div class="mw-block-add-buttons">
            <button type="button" id="mw-add-para-block" class="btn-secondary btn-sm"><span class="material-symbols-outlined">add</span>Paragraph</button>
            <button type="button" id="mw-add-table-block" class="btn-secondary btn-sm"><span class="material-symbols-outlined">table_chart</span>Table</button>
            <button type="button" id="mw-add-heading-block" class="btn-secondary btn-sm"><span class="material-symbols-outlined">title</span>Heading</button>
          </div>
        </div>
        <div id="mw-blocks-list" class="mw-dynamic-list"></div>
        ${renderVisualSection('note', isEdit ? note.assets?.find(a => a.target?.type === 'note') : null)}
      </section>

      <!-- 3. Important Terms -->
      <section class="mw-section-card">
        <div class="mw-section-head">
          <span class="material-symbols-outlined">bookmark</span>
          <div>
            <strong>Important Terms</strong>
            <p>Key concepts and definitions highlighted in text</p>
          </div>
          <button type="button" id="mw-add-term" class="btn-secondary btn-sm"><span class="material-symbols-outlined">add</span>Add Term</button>
        </div>
        <div id="mw-terms-list" class="mw-dynamic-list"></div>
      </section>

      <!-- 4. Questions & Answers -->
      <section class="mw-section-card">
        <div class="mw-section-head">
          <span class="material-symbols-outlined">help</span>
          <div>
            <strong>Questions & Answers</strong>
            <p>Revision questions and conceptual explanations</p>
          </div>
          <button type="button" id="mw-add-qa" class="btn-secondary btn-sm"><span class="material-symbols-outlined">add</span>Add Q&A</button>
        </div>
        <div id="mw-qa-list" class="mw-dynamic-list"></div>
      </section>

      <!-- 5. MCQs -->
      <section class="mw-section-card">
        <div class="mw-section-head">
          <span class="material-symbols-outlined">quiz</span>
          <div>
            <strong>Multiple Choice Questions</strong>
            <p>Self-assessment questions with exactly four choices</p>
          </div>
          <button type="button" id="mw-add-mcq" class="btn-secondary btn-sm"><span class="material-symbols-outlined">add</span>Add MCQ</button>
        </div>
        <div id="mw-mcq-list" class="mw-dynamic-list"></div>
      </section>
    `;

    document.getElementById('mw-btn-open-profile')?.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('studiora-open-study-profile'));
    });

    // Populate modular body blocks from existing note or default
    if (isEdit && note.body) {
      parseBodyIntoBlocks(note.body, note.assets || []);
    } else {
      addParagraphBlock('');
    }

    // Populate arrays
    if (isEdit) {
      (note.terms || []).forEach(t => addTermItem(t));
      (note.qas || []).forEach((q, i) => addQaItem(q, note.assets?.find(a => a.target?.type === 'qa-question' && a.target?.key === `qa-question-${i}`)));
      (note.mcqs || []).forEach((m, i) => addMcqItem(m, note.assets?.find(a => a.target?.type === 'mcq-question' && a.target?.key === `mcq-question-${i}`)));
    }

    // Block addition listeners
    document.getElementById('mw-add-para-block')?.addEventListener('click', () => addParagraphBlock());
    document.getElementById('mw-add-table-block')?.addEventListener('click', () => addTableBlock());
    document.getElementById('mw-add-heading-block')?.addEventListener('click', () => addHeadingBlock());
    document.getElementById('mw-add-term')?.addEventListener('click', () => addTermItem());
    document.getElementById('mw-add-qa')?.addEventListener('click', () => addQaItem());
    document.getElementById('mw-add-mcq')?.addEventListener('click', () => addMcqItem());

    content.onclick = e => {
      const rm = e.target.closest('[data-remove-item]');
      if (rm) {
        rm.closest('.mw-item-card, .mw-body-block-card')?.remove();
        return;
      }

      const toggleVis = e.target.closest('[data-toggle-visual]');
      if (toggleVis) {
        const wrap = toggleVis.closest('.mw-item-card, .mw-section-card, .mw-body-block-card')?.querySelector('.mw-visual-drawer');
        if (wrap) wrap.classList.toggle('hidden');
      }
    };
  }

  // Parses raw/HTML body into modular cards
  function parseBodyIntoBlocks(bodyHtml, assets = []) {
    const container = document.createElement('div');
    container.innerHTML = bodyHtml;

    let paraIndex = 0;
    const nodes = Array.from(container.children);

    if (!nodes.length) {
      // Raw string without top-level HTML tags
      const rawParas = bodyHtml.split(/\n\s*\n/).filter(Boolean);
      rawParas.forEach((text, i) => {
        const matchedAsset = assets.find(a => a.target?.type === 'paragraph' && (a.target?.key === `paragraph-${i}`));
        addParagraphBlock(text, matchedAsset);
      });
      return;
    }

    nodes.forEach(node => {
      const tag = node.tagName.toLowerCase();
      if (tag === 'table') {
        const headers = Array.from(node.querySelectorAll('th')).map(th => th.textContent.trim()).join(' | ');
        const rows = Array.from(node.querySelectorAll('tbody tr, tr')).filter(tr => !tr.querySelector('th')).map(tr => {
          return Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()).join(' | ');
        }).join('\n');
        addTableBlock(headers, rows);
      } else if (tag === 'h3' || tag === 'h4') {
        addHeadingBlock(node.textContent.trim());
      } else {
        const matchedAsset = assets.find(a => a.target?.type === 'paragraph' && (a.target?.key === `paragraph-${paraIndex}`));
        addParagraphBlock(node.innerHTML.trim(), matchedAsset);
        paraIndex++;
      }
    });
  }

  function addParagraphBlock(text = '', asset = null) {
    const list = document.getElementById('mw-blocks-list');
    if (!list) return;
    const card = document.createElement('div');
    card.className = 'mw-body-block-card';
    card.dataset.blockKind = 'paragraph';
    card.innerHTML = `
      <div class="mw-item-head">
        <span class="mw-block-tag"><span class="material-symbols-outlined">article</span>Paragraph</span>
        <button type="button" class="close-btn" data-remove-item aria-label="Remove"><span class="material-symbols-outlined">close</span></button>
      </div>
      <textarea class="mw-para-text mw-textarea" rows="4" placeholder="Write paragraph explanation...">${esc(text)}</textarea>
      ${renderVisualSection('paragraph', asset)}
    `;
    list.appendChild(card);
  }

  function addHeadingBlock(title = '') {
    const list = document.getElementById('mw-blocks-list');
    if (!list) return;
    const card = document.createElement('div');
    card.className = 'mw-body-block-card';
    card.dataset.blockKind = 'heading';
    card.innerHTML = `
      <div class="mw-item-head">
        <span class="mw-block-tag"><span class="material-symbols-outlined">title</span>Subheading</span>
        <button type="button" class="close-btn" data-remove-item aria-label="Remove"><span class="material-symbols-outlined">close</span></button>
      </div>
      <input class="mw-heading-text" value="${esc(title)}" placeholder="e.g. 1. Core Principles & Mechanisms">
    `;
    list.appendChild(card);
  }

  function addTableBlock(headers = '', rows = '') {
    const list = document.getElementById('mw-blocks-list');
    if (!list) return;
    const card = document.createElement('div');
    card.className = 'mw-body-block-card';
    card.dataset.blockKind = 'table';
    card.innerHTML = `
      <div class="mw-item-head">
        <span class="mw-block-tag"><span class="material-symbols-outlined">table_chart</span>Comparison Table</span>
        <button type="button" class="close-btn" data-remove-item aria-label="Remove"><span class="material-symbols-outlined">close</span></button>
      </div>
      <label class="mw-field">
        <span>Table Columns (separate headers with |)</span>
        <input class="mw-table-headers" value="${esc(headers)}" placeholder="Feature | Concept A | Concept B">
      </label>
      <label class="mw-field">
        <span>Table Rows (one line per row, separate columns with |)</span>
        <textarea class="mw-table-rows mw-textarea" rows="4" placeholder="Definition | High speed | Low latency&#10;Application | Physics | Chemistry">${esc(rows)}</textarea>
      </label>
    `;
    list.appendChild(card);
  }

  function renderVisualSection(type, asset = null) {
    const hasAsset = Boolean(asset);
    return `
      <div class="mw-visual-wrapper">
        <button type="button" class="btn-ghost btn-sm" data-toggle-visual>
          <span class="material-symbols-outlined">image</span>
          ${hasAsset ? 'Edit Attached Visual' : 'Attach Visual'}
        </button>
        <div class="mw-visual-drawer ${hasAsset ? '' : 'hidden'}">
          <div class="mw-grid-2">
            <label class="mw-field"><span>Visual Type</span>
              <select class="mw-vis-type">
                <option value="image" ${asset?.type === 'image' ? 'selected' : ''}>Image</option>
                <option value="vector" ${asset?.type === 'vector' ? 'selected' : ''}>Vector / SVG</option>
                <option value="diagram" ${asset?.type === 'diagram' ? 'selected' : ''}>Diagram</option>
                <option value="graph" ${asset?.type === 'graph' ? 'selected' : ''}>Graph</option>
              </select>
            </label>
            <label class="mw-field"><span>Source</span>
              <select class="mw-vis-source">
                <option value="url" ${asset?.source === 'url' ? 'selected' : ''}>Web URL</option>
                <option value="ai" ${asset?.source === 'ai' ? 'selected' : ''}>AI Prompt</option>
                <option value="custom" ${asset?.source === 'custom' ? 'selected' : ''}>Custom</option>
              </select>
            </label>
          </div>
          <label class="mw-field"><span>Resource URL</span>
            <input class="mw-vis-url" value="${esc(asset?.url || '')}" placeholder="https://example.com/image.png">
          </label>
          <label class="mw-field"><span>Visual Caption / Prompt</span>
            <input class="mw-vis-caption" value="${esc(asset?.caption || asset?.prompt || '')}" placeholder="What should the reader observe?">
          </label>
        </div>
      </div>
    `;
  }

  function addTermItem(term = {}) {
    const list = document.getElementById('mw-terms-list');
    if (!list) return;
    const card = document.createElement('div');
    card.className = 'mw-item-card';
    card.dataset.itemKind = 'term';
    card.innerHTML = `
      <div class="mw-item-head">
        <strong>Term</strong>
        <button type="button" class="close-btn" data-remove-item aria-label="Remove"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div class="mw-grid-2">
        <label class="mw-field"><span>Word *</span><input class="mw-term-word" value="${esc(term.word || '')}" placeholder="e.g. Sovereignty"></label>
        <label class="mw-field"><span>Hint / Note</span><input class="mw-term-note" value="${esc(term.note || '')}" placeholder="Contextual or bilingual note"></label>
      </div>
      <label class="mw-field"><span>Definition *</span><textarea class="mw-term-def" rows="2" placeholder="Precise definition">${esc(term.def || '')}</textarea></label>
    `;
    list.appendChild(card);
  }

  function addQaItem(qa = {}, asset = null) {
    const list = document.getElementById('mw-qa-list');
    if (!list) return;
    const card = document.createElement('div');
    card.className = 'mw-item-card';
    card.dataset.itemKind = 'qa';
    card.innerHTML = `
      <div class="mw-item-head">
        <strong>Question & Answer</strong>
        <button type="button" class="close-btn" data-remove-item aria-label="Remove"><span class="material-symbols-outlined">close</span></button>
      </div>
      <label class="mw-field"><span>Question *</span><input class="mw-qa-q" value="${esc(qa.question || '')}" placeholder="Enter question"></label>
      <label class="mw-field"><span>Answer *</span><textarea class="mw-qa-a" rows="3" placeholder="Enter answer">${esc(qa.answer || '')}</textarea></label>
      ${renderVisualSection('qa-question', asset)}
    `;
    list.appendChild(card);
  }

  function addMcqItem(mcq = {}, asset = null) {
    const list = document.getElementById('mw-mcq-list');
    if (!list) return;
    const opts = (Array.isArray(mcq.options) ? mcq.options : ['', '', '', '']).slice(0, 4);
    while (opts.length < 4) opts.push('');
    const ans = Number(mcq.answerIndex || 0);
    const radioName = `mcq-ans-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const card = document.createElement('div');
    card.className = 'mw-item-card';
    card.dataset.itemKind = 'mcq';
    card.innerHTML = `
      <div class="mw-item-head">
        <strong>MCQ</strong>
        <button type="button" class="close-btn" data-remove-item aria-label="Remove"><span class="material-symbols-outlined">close</span></button>
      </div>
      <label class="mw-field"><span>Question *</span><input class="mw-mcq-q" value="${esc(mcq.question || '')}" placeholder="MCQ question"></label>
      <div class="mw-mcq-options-grid">
        ${[0, 1, 2, 3].map(i => `
          <div class="mw-mcq-opt-row">
            <input type="radio" name="${radioName}" value="${i}" ${ans === i ? 'checked' : ''} class="mw-mcq-radio" title="Mark as correct">
            <input class="mw-mcq-opt" data-opt-idx="${i}" value="${esc(opts[i] || '')}" placeholder="Option ${i + 1}">
          </div>
        `).join('')}
      </div>
      ${renderVisualSection('mcq-question', asset)}
    `;
    list.appendChild(card);
  }

  function saveForm() {
    const state = store.getState();
    const ws = getEl('manual-workspace');
    const mode = ws.dataset.mode;
    const noteId = Number(ws.dataset.noteId);

    const subject = document.getElementById('mw-f-subject')?.value.trim();
    const chapter = document.getElementById('mw-f-chapter')?.value.trim();
    const title = document.getElementById('mw-f-title')?.value.trim();

    if (!subject || !chapter || !title) {
      showToast('Subject, Chapter, and Note Title are required.', { icon: 'edit_note' });
      return;
    }

    const chapnum = document.getElementById('mw-f-chapnum')?.value.trim();
    const level = document.getElementById('mw-f-level')?.value.trim();
    const board = document.getElementById('mw-f-board')?.value.trim();
    const medium = document.getElementById('mw-f-medium')?.value.trim();
    const label = document.getElementById('mw-f-label')?.value.trim() || 'Notes';

    const assets = [];
    const bodyParts = [];
    let paraCounter = 0;

    // Compile explanation blocks (paragraphs, tables, headings)
    document.querySelectorAll('#mw-blocks-list .mw-body-block-card').forEach(block => {
      const kind = block.dataset.blockKind;
      if (kind === 'paragraph') {
        const text = block.querySelector('.mw-para-text')?.value.trim();
        if (text) {
          bodyParts.push(`<p>${text.replace(/\n/g, '<br>')}</p>`);
          const vUrl = block.querySelector('.mw-vis-url')?.value.trim();
          if (vUrl) {
            assets.push({
              id: `asset_${Date.now()}_para_${paraCounter}`,
              type: block.querySelector('.mw-vis-type').value,
              source: block.querySelector('.mw-vis-source').value,
              url: vUrl,
              caption: block.querySelector('.mw-vis-caption').value.trim(),
              target: { type: 'paragraph', key: `paragraph-${paraCounter}` }
            });
          }
          paraCounter++;
        }
      } else if (kind === 'heading') {
        const h = block.querySelector('.mw-heading-text')?.value.trim();
        if (h) bodyParts.push(`<h3>${esc(h)}</h3>`);
      } else if (kind === 'table') {
        const rawHeaders = block.querySelector('.mw-table-headers')?.value.trim();
        const rawRows = block.querySelector('.mw-table-rows')?.value.trim();
        if (rawHeaders) {
          const headers = rawHeaders.split('|').map(s => `<th>${esc(s.trim())}</th>`).join('');
          const rows = rawRows
            ? rawRows.split('\n').filter(Boolean).map(row => {
                const cols = row.split('|').map(c => `<td>${esc(c.trim())}</td>`).join('');
                return `<tr>${cols}</tr>`;
              }).join('')
            : '';
          bodyParts.push(`<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`);
        }
      }
    });

    const body = bodyParts.join('\n\n');

    // Note-level visual
    const noteVisDrawer = getEl('manual-workspace-content')?.querySelector('.mw-section-card > .mw-visual-wrapper');
    const noteVisUrl = noteVisDrawer?.querySelector('.mw-vis-url')?.value.trim();
    if (noteVisUrl) {
      assets.push({
        id: `asset_${Date.now()}_note`,
        type: noteVisDrawer.querySelector('.mw-vis-type').value,
        source: noteVisDrawer.querySelector('.mw-vis-source').value,
        url: noteVisUrl,
        caption: noteVisDrawer.querySelector('.mw-vis-caption').value.trim(),
        target: { type: 'note', key: 'note' }
      });
    }

    // Terms
    const terms = [];
    document.querySelectorAll('#mw-terms-list .mw-item-card').forEach(c => {
      const w = c.querySelector('.mw-term-word')?.value.trim();
      const d = c.querySelector('.mw-term-def')?.value.trim();
      const n = c.querySelector('.mw-term-note')?.value.trim();
      if (w && d) terms.push({ word: w, def: d, note: n });
    });

    // Q&A
    const qas = [];
    document.querySelectorAll('#mw-qa-list .mw-item-card').forEach((c, idx) => {
      const q = c.querySelector('.mw-qa-q')?.value.trim();
      const a = c.querySelector('.mw-qa-a')?.value.trim();
      if (q && a) {
        qas.push({ question: q, answer: a });
        const vUrl = c.querySelector('.mw-vis-url')?.value.trim();
        if (vUrl) {
          assets.push({
            id: `asset_${Date.now()}_qa_${idx}`,
            type: c.querySelector('.mw-vis-type').value,
            source: c.querySelector('.mw-vis-source').value,
            url: vUrl,
            caption: c.querySelector('.mw-vis-caption').value.trim(),
            target: { type: 'qa-question', key: `qa-question-${idx}` }
          });
        }
      }
    });

    // MCQs
    const mcqs = [];
    document.querySelectorAll('#mw-mcq-list .mw-item-card').forEach((c, idx) => {
      const q = c.querySelector('.mw-mcq-q')?.value.trim();
      const options = Array.from(c.querySelectorAll('.mw-mcq-opt'))
        .map(i => i.value.trim())
        .filter(Boolean)
        .slice(0, 4);
      const radio = c.querySelector('.mw-mcq-radio:checked');
      const answerIndex = radio ? Number(radio.value) : 0;
      if (q && options.length >= 2) {
        mcqs.push({ question: q, options, answerIndex });
        const vUrl = c.querySelector('.mw-vis-url')?.value.trim();
        if (vUrl) {
          assets.push({
            id: `asset_${Date.now()}_mcq_${idx}`,
            type: c.querySelector('.mw-vis-type').value,
            source: c.querySelector('.mw-vis-source').value,
            url: vUrl,
            caption: c.querySelector('.mw-vis-caption').value.trim(),
            target: { type: 'mcq-question', key: `mcq-question-${idx}` }
          });
        }
      }
    });

    const notePayload = {
      subject,
      chapter,
      title,
      body,
      chapterNumber: chapnum ? Number(chapnum) : null,
      level,
      board,
      medium,
      label,
      terms,
      qas,
      mcqs,
      assets
    };

    const subjectMeta = {
      ...state.subjectMeta,
      [subject]: normalizeSubjectMeta({ board, medium, level })
    };

    if (mode === 'create') {
      const newNote = createUniqueNote(normalizeNote(notePayload), state.notes);
      store.replaceWithNotes([newNote, ...state.notes], subjectMeta, 'manual_create');
      close();
      navigation.reader(newNote);
      showToast('Note created successfully.', { icon: 'check_circle' });
    } else {
      const existing = state.notes.find(n => Number(n.id) === noteId);
      if (!existing) return;
      const updated = { ...existing, ...notePayload };
      const nextNotes = state.notes.map(n => Number(n.id) === noteId ? updated : n);
      store.replaceWithNotes(nextNotes, subjectMeta, 'manual_edit');
      close();
      navigation.reader(updated);
      showToast('Changes saved to your library.', { icon: 'check_circle' });
    }
  }

  function validateJsonInput() {
    const raw = getEl('manual-workspace-json')?.value?.trim();
    const mode = getEl('manual-workspace')?.dataset.mode;
    const status = getEl('manual-json-validation-status');
    const button = getEl('manual-workspace-json-apply');

    if (!status || !button) return;

    if (!raw) {
      status.className = 'manual-json-status pending';
      status.innerHTML = '<span class="material-symbols-outlined">info</span><span>Paste valid JSON to continue</span>';
      button.disabled = true;
      parsedPayload = null;
      return;
    }

    try {
      const parsed = sanitizeAndParseJSON(raw);
      if (mode === 'create') {
        if (!parsed.subject || !parsed.chapter || !parsed.title) {
          throw new Error('JSON requires "subject", "chapter", and "title".');
        }
        parsedPayload = parsed;
        status.className = 'manual-json-status valid';
        status.innerHTML = `<span class="material-symbols-outlined">check_circle</span><span>Valid Note: "${esc(parsed.title)}" ready to import</span>`;
        button.disabled = false;
      } else {
        if (parsed.type !== 'smart-notes-patch') {
          throw new Error('Edit mode requires a "smart-notes-patch" object.');
        }
        if (!Array.isArray(parsed.changes) || !parsed.changes.length) {
          throw new Error('Patch contains no changes.');
        }
        parsedPayload = parsed;
        status.className = 'manual-json-status valid';
        status.innerHTML = `<span class="material-symbols-outlined">check_circle</span><span>Valid Patch (${parsed.changes.length} change${parsed.changes.length > 1 ? 's' : ''}) ready</span>`;
        button.disabled = false;
      }
    } catch (e) {
      parsedPayload = null;
      status.className = 'manual-json-status invalid';
      status.innerHTML = `<span class="material-symbols-outlined">cancel</span><span>${esc(e.message)}</span>`;
      button.disabled = true;
    }
  }

  function applyJsonPayload() {
    if (!parsedPayload) return;
    const state = store.getState();
    const mode = getEl('manual-workspace')?.dataset.mode;

    try {
      if (mode === 'create') {
        const note = createUniqueNote(normalizeNote(parsedPayload), state.notes);
        store.replaceWithNotes(
          [note, ...state.notes],
          { ...state.subjectMeta, [note.subject]: normalizeSubjectMeta(parsedPayload) },
          'manual_json_create'
        );
        close();
        navigation.reader(note);
        showToast('Note created from JSON.', { icon: 'check_circle' });
      } else {
        store.applyPatchChanges(parsedPayload.changes, 'manual_json_edit');
        const noteId = Number(getEl('manual-workspace')?.dataset.noteId);
        const updated = store.getState().notes.find(n => Number(n.id) === noteId);
        close();
        if (updated) navigation.reader(updated);
        showToast('Patch applied safely.', { icon: 'verified' });
      }
    } catch (e) {
      showToast(e.message, { icon: 'error' });
    }
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
}
