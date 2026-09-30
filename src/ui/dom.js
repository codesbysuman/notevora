export function cacheDom() {
  const ids = [
    'view-subjects', 'view-chapters', 'view-notes-list', 'view-note-reader', 'view-search',
    'app-heading', 'breadcrumb-subtext', 'btn-back', 'global-search',
    'btn-theme-toggle', 'theme-icon', 'btn-header-more', 'header-answer-action', 'header-more-menu', 'active-search-chips', 'btn-library-sync', 'btn-library-tab-my', 'btn-library-tab-online', 'btn-search-clear', 'sort-select', 'btn-sort-menu', 'btn-filter-menu', 'sort-menu', 'filter-menu', 'search-menu',
    'study-profile-modal', 'btn-close-study-profile', 'btn-skip-study-profile', 'btn-save-study-profile', 'profile-speaking', 'profile-writing', 'profile-reading', 'profile-medium', 'profile-level', 'profile-board', 'profile-university', 'omni-box', 'omni-modes', 'omni-paste-toggle', 'omni-input', 'omni-submit', 'omni-context-thread', 'omni-context-list', 'omni-context-list-label', 'omni-context-done', 'omni-context-close', 'omni-response-wrap', 'omni-response-input', 'omni-response-submit', 'custom-group-modal', 'custom-group-body', 'btn-close-custom-groups', 'btn-add-custom-group', 'btn-done-custom-groups', 'note-modal', 'modal-title', 'btn-open-create', 'btn-close-modal',
    'tab-btn-ai', 'tab-btn-manual', 'tab-panel-ai', 'tab-panel-manual',
    'ai-import-form', 'ai-json-input', 'btn-copy-prompt', 'btn-copy-expand-prompt', 'btn-load-sample',
    'manual-note-form', 'btn-manual-paste-json', 'edit-note-id', 'input-subject', 'input-chapter', 'input-title', 'input-body',
    'btn-wrap-term', 'manual-edit-context', 'manual-edit-context-summary', 'btn-manual-context', 'subject-datalist', 'chapter-datalist', 'input-chapter-number', 'input-label', 'input-board', 'input-medium', 'input-level',
    'merge-modal', 'btn-merge-append', 'btn-merge-overwrite', 'btn-merge-new',
    'asset-modal', 'btn-close-asset', 'btn-close-asset-secondary', 'asset-form', 'asset-target-type', 'asset-target-key', 'asset-target-label', 'asset-type', 'asset-source', 'asset-url', 'asset-title', 'asset-caption', 'asset-prompt', 'term-sheet', 'term-title', 'term-def', 'term-note', 'term-note-block', 'btn-close-term', 'btn-speak-term',
    'patch-modal', 'btn-open-patch', 'btn-close-patch', 'btn-copy-patch-prompt', 'patch-json-input', 'btn-apply-ai-patch', 'patch-note-select', 'patch-target-select', 'patch-context-summary', 'backup-modal', 'btn-backup-open', 'btn-close-backup', 'btn-export-file', 'btn-export-compressed', 'btn-share-library', 'btn-open-library', 'btn-merge-library', 'btn-export-patch', 'patch-start', 'patch-end', 'file-import', 'library-file-picker', 'history-modal', 'btn-history-open', 'btn-close-history', 'history-list', 'manual-workspace', 'manual-workspace-title', 'manual-workspace-subtitle', 'manual-workspace-content', 'manual-workspace-close', 'manual-workspace-save', 'manual-workspace-paste-toggle', 'manual-workspace-paste-apply', 'manual-workspace-json'
  ];
  return Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
}

export function show(element) { element?.classList.remove('hidden'); }
export function hide(element) { element?.classList.add('hidden'); }
