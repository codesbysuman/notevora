import { exportLibraryFile } from './services/storage.js';
import { createOriginLibrary, compactPatchesBetween, exportLibrary, materializeLibrary } from './services/library.js';
import { sanitizeAndParseJSON } from './services/json.js';
import { hide, show } from './ui/dom.js';
import { gzipJSON, gunzipJSON } from './services/compression.js';
import { createUniqueNote } from './services/notes.js';
import { showToast } from './ui/toast.js';

export function initBackup(dom, store, navigation) {
  dom['btn-backup-open'].addEventListener('click', () => { refreshPatchSelectors(); show(dom['backup-modal']); });
  dom['btn-close-backup'].addEventListener('click', () => hide(dom['backup-modal']));
  dom['btn-export-file'].addEventListener('click', () => { exportLibraryFile(store.getState().library); showToast('Backup saved. Your library here was not changed.', {icon:'download_done'}); });
  dom['btn-export-compressed']?.addEventListener('click', async () => { try { const blob = await gzipJSON(exportLibrary(store.getState().library)); downloadBlob(blob, `notevora_library_${new Date().toISOString().slice(0,10)}.json.gz`); showToast('Compressed backup saved.', {icon:'compress'}); } catch (error) { showToast(`Could not create the backup: ${error.message}`, {icon:'error'}); } });
  dom['btn-share-library']?.addEventListener('click', shareLibrary);
  dom['btn-open-library']?.addEventListener('click', () => chooseLibraryFile('open'));
  dom['btn-merge-library']?.addEventListener('click', () => chooseLibraryFile('merge'));
  dom['library-file-picker']?.addEventListener('change', handleLibraryFile);
  dom['btn-export-patch'].addEventListener('click', () => {
    try { const library=store.getState().library, start=dom['patch-start'].value, end=dom['patch-end'].value; if(!start||!end)throw new Error('Choose the changes you want to export.'); downloadJSON(compactPatchesBetween(library,start,end),`notevora_changes_${start.slice(-12)}_to_${end.slice(-12)}.json`); showToast('Selected changes saved as a patch file.',{icon:'difference'}); }
    catch(error){showToast(`Could not export changes: ${error.message}`,{icon:'error'});}
  });
  dom['file-import'].addEventListener('change', event => { const file=event.target.files?.[0]; if(file) void readLibraryFile(file,'open'); event.target.value=''; });
  dom['btn-history-open'].addEventListener('click', () => { renderHistory(dom,store); show(dom['history-modal']); });
  dom['btn-close-history'].addEventListener('click', () => hide(dom['history-modal']));

  async function shareLibrary(){
    try{
      const blob=await gzipJSON(exportLibrary(store.getState().library));
      const file=new File([blob],`notevora-library-${new Date().toISOString().slice(0,10)}.json.gz`,{type:'application/gzip'});
      if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){ await navigator.share({title:'Notevora library copy',text:'A backup copy of my Notevora library.',files:[file]}); showToast('Library copy shared. Your original stayed on this device.',{icon:'ios_share'}); }
      else { downloadBlob(blob,file.name); showToast('Sharing is not available here, so a safe copy was saved instead.',{icon:'download'}); }
    }catch(error){if(error?.name!=='AbortError')showToast(`Could not share the library: ${error.message}`,{icon:'error'});}
  }
  function chooseLibraryFile(action){const picker=dom['library-file-picker']; if(!picker)return; picker.dataset.action=action; picker.value=''; picker.click();}
  async function handleLibraryFile(event){const file=event.target.files?.[0]; if(!file)return; const action=event.target.dataset.action||'open'; event.target.value=''; await readLibraryFile(file,action);}

  async function readLibraryFile(file,action){
    try{
      const imported=file.name.toLowerCase().endsWith('.gz')?await gunzipJSON(file):sanitizeAndParseJSON(await file.text());
      const library=Array.isArray(imported)?createOriginLibrary(imported):imported;
      if(!library||typeof library!=='object'||!Array.isArray(library.patches))throw new Error('That file is not a Notevora library backup.');
      const incoming=materializeLibrary(library), state=store.getState();
      if(action==='open'){
        if(!confirm(`Open “${file.name}” as your active library? Your current library will be replaced in this session. Save a backup first if you want to keep it.`))return;
        store.updateLibrary(library); hide(dom['backup-modal']); navigation.subjects(); showToast('Library opened. Its patch history is now active.',{icon:'folder_open'});
      }else{
        const existingIds=new Set(state.notes.map(n=>String(n.id))), added=[];
        for(const note of incoming.notes||[]) added.push(existingIds.has(String(note.id))?createUniqueNote(note,[...state.notes,...added]):structuredClone(note));
        if(!added.length)return showToast('There were no notes to add.',{icon:'info'});
        store.replaceWithNotes([...added,...state.notes],{...state.subjectMeta,...(incoming.subjectMeta||{})},'library_merge');
        hide(dom['backup-modal']); navigation.subjects(); showToast(`${added.length} note${added.length===1?'':'s'} added. Your existing history was kept.`,{icon:'library_add'});
      }
    }catch(error){showToast(`Could not load that library: ${error.message}`,{icon:'error'});}
  }

  function refreshPatchSelectors(){const patches=store.getState().library.patches;const options=patches.map((patch,index)=>`<option value="${escapeAttr(patch.id)}">${index===0?'Starting library':patch.kind} · ${new Date(patch.timestamp).toLocaleString()} · ${escapeText(patch.id.slice(-12))}</option>`).join('');dom['patch-start'].innerHTML=options;dom['patch-end'].innerHTML=options;if(patches.length){dom['patch-start'].value=patches[0].id;dom['patch-end'].value=patches.at(-1).id;}}
  function renderHistory(dom,store){const patches=[...store.getState().library.patches].reverse();dom['history-list'].innerHTML=patches.map((patch,index)=>`<div class="history-item"><div class="history-main"><span class="history-kind">${escapeText(patch.kind)}</span><strong>${escapeText(patch.id)}</strong><time>${new Date(patch.timestamp).toLocaleString()}</time><span>${patch.changes.length} change${patch.changes.length===1?'':'s'}</span></div><div class="history-actions">${index===0?`<span class="history-current">Current${patch.parentId?` · <button class="btn-ghost btn-sm" data-history-undo="${escapeAttr(patch.parentId)}">Undo</button>`:''}</span>`:`<button class="btn-ghost btn-sm" data-history-rollback="${escapeAttr(patch.id)}">Rollback to here</button>`}</div></div>`).join('');dom['history-list'].querySelectorAll('[data-history-undo]').forEach(b=>b.addEventListener('click',()=>{store.replaceFromPatch(b.dataset.historyUndo,'undo');renderHistory(dom,store);refreshPatchSelectors();navigation.subjects();showToast('Undone as a new history patch.',{icon:'undo'});}));dom['history-list'].querySelectorAll('[data-history-rollback]').forEach(b=>b.addEventListener('click',()=>{if(!confirm('Rollback to this version? Your newer history will remain available.'))return;store.replaceFromPatch(b.dataset.historyRollback,'rollback');renderHistory(dom,store);refreshPatchSelectors();navigation.subjects();showToast('Library rolled back safely; newer history was preserved.',{icon:'history'});}));}
}
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
function downloadJSON(payload,filename){downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),filename);}
function escapeText(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function escapeAttr(value){return escapeText(value);}
