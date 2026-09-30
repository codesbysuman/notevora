# Notevora 1.0.0

A local-first study library for creating, organizing, reading, searching, revising, and safely sharing structured study notes.

> **Release:** 1.0.0 — first finalized v1 release after the experimental development iterations.

## What Notevora is

Notevora is intentionally more than a plain note editor. A note can contain:

- subject and chapter metadata;
- chapter number and academic level;
- a title and structured body;
- important terms;
- question-and-answer items;
- multiple-choice questions;
- visual assets attached to a note or a specific content part.

The app is local-first and currently **frontend-only**. There is no backend, account system, AI API, or required cloud service.

The AI workflow is an external bridge:

```text
Notevora
   ↓
prepare prompt
   ↓
share/copy prompt
   ↓
user chooses an AI app
   ↓
AI returns JSON
   ↓
user pastes JSON back into Notevora
   ↓
validate / normalize / apply
```

The application therefore does not need an AI API key and does not silently send a student's library to an AI service.

---

# 1. Product principles

## Local first

The active library is stored in the browser. LocalStorage provides fast synchronous startup, while IndexedDB is the durable browser layer.

## History first

Content mutations are represented as immutable patches. Undo and rollback create new patches instead of deleting old history.

## Structured notes

Notes are data, not arbitrary HTML documents. This allows search, context selection, AI patching, visual attachments, and future synchronization.

## External AI, controlled data flow

Notevora prepares prompts and accepts structured responses. It does not contain an AI provider integration in v1.

## Progressive disclosure

Normal users see simple actions such as:

- Create note
- Edit note
- Paste
- Save a copy
- Open another library
- Add from another library

Advanced JSON, patch, history, and storage concepts remain available without making them the primary UX.

---

# 2. Release identity

The product was rebranded from **Studiora** to **Notevora** for v1.

The old Studiora storage identifiers are intentionally retained internally so an existing user's local data is not discarded by the rebrand.

Important compatibility identifiers that remain:

```text
STUDIORA_LIBRARY_V1
STUDIORA_UI_PREFS
STUDIORA_THEME
SMART_NOTES_LIBRARY_V2
SMART_NOTES_DATA_STREAMLINED
IndexedDB database: studiora
```

These are storage/migration identifiers, not the product's public brand.

The browser debug surface is now:

```js
window.Notevora
```

and `window.Studiora` remains as a small compatibility alias for older local tooling.

### Domain candidate

`notevora.com` was listed as an available .com candidate by a domain-name directory during a May 3, 2026 verification. Availability is time-sensitive and that listing is not proof of current registration status, so the domain must be rechecked at a registrar immediately before purchase. The name should also receive a trademark/search review before commercial launch.

---

# 3. Project structure

```text
Notevora/
├── index.html
├── style.css
├── manifest.webmanifest
├── sw.js
├── VERSION
├── README.md
├── robots.txt
├── icons/
│   ├── icon.svg
│   ├── icon-192.png
│   └── icon-512.png
└── src/
    ├── main.js
    ├── config.js
    ├── state.js
    ├── events.js
    ├── prompts.js
    ├── backup.js
    ├── manual-workspace.js
    ├── services/
    │   ├── compression.js
    │   ├── json.js
    │   ├── library.js
    │   ├── notes.js
    │   ├── search.js
    │   ├── storage.js
    │   ├── sync.js
    │   └── terms.js
    ├── ui/
    │   ├── dom.js
    │   ├── modals.js
    │   ├── navigation.js
    │   ├── render.js
    │   ├── theme.js
    │   └── toast.js
    └── utils/
        ├── html.js
        └── validation.js
```

There is deliberately no `backend/` directory in v1.

---

# 4. Application composition

`src/main.js` is the composition root.

Startup order:

```text
cache DOM
  ↓
create store
  ↓
create navigation
  ↓
initialize theme
  ↓
initialize modals
  ↓
initialize backup UI
  ↓
initialize manual workspace
  ↓
bind application events
  ↓
subscribe renderer
  ↓
initial render
  ↓
sync URL/hash navigation
  ↓
hydrate IndexedDB asynchronously
```

The important architectural rule is that UI code should call store/domain operations rather than directly rewriting persisted library data.

---

# 5. State model

`src/state.js` owns the reactive application state.

Important state areas include:

```js
{
  notes,
  subjectMeta,
  library,
  activeSubject,
  activeChapter,
  activeNoteId,
  currentView,
  searchQuery,
  searchFilter,
  sortBy,
  hideAnswers,

  omniMode,
  omniMessage,
  omniContext,
  omniContextGathering,
  omniAwaitingResponse,
  omniResponseOpen,
  omniCanOfferClipboard,
  omniLastSubmittedPrompt,
  omniVisualAttach,

  subjectGroupBy,
  customSubjectGroups,

  studyProfile,
  studyProfileSkippedAt
}
```

UI preferences are stored separately from the content library so changing presentation preferences does not create content patches.

---

# 6. Note JSON schema

A normalized note has the following conceptual shape:

```js
{
  id: 123,
  subject: "Political Science",
  chapterNumber: 1,
  chapter: "Introduction to Political Science",
  label: "Notes",
  board: "...",
  medium: "English",
  level: "BA 1st Semester",
  title: "...",
  body: "...",
  terms: [
    {
      word: "Power",
      def: "...",
      note: "..."
    }
  ],
  qas: [
    {
      question: "...",
      answer: "..."
    }
  ],
  mcqs: [
    {
      question: "...",
      options: ["...", "...", "...", "..."],
      answerIndex: 0
    }
  ],
  assets: [
    {
      id: "asset_...",
      type: "image",
      source: "url",
      url: "https://...",
      title: "...",
      caption: "...",
      prompt: "...",
      target: {
        type: "paragraph",
        key: "..."
      }
    }
  ]
}
```

Validation normalizes legacy/missing fields before the note enters the application state.

### Duplicate notes

A chapter can contain any number of notes.

The following are all valid:

```text
Political Science
└── Chapter 1
    ├── Meaning of Political Science
    ├── Definitions of Political Science
    ├── Scope of Political Science
    └── Previous-Year Questions
```

The application does not reject a new note merely because another note has the same subject, chapter, or title. `createUniqueNote()` assigns a unique ID when necessary.

---

# 7. Subject metadata

Subject-level metadata is stored separately from individual note content.

Conceptually:

```js
subjectMeta: {
  "Political Science": {
    level: "BA 1st Semester",
    board: "Gauhati University FYUGP",
    medium: "English",
    category: "Major"
  }
}
```

This lets the UI display course context without duplicating the same metadata into every patch operation.

---

# 8. Library and patch architecture

The library is the source of truth for content history.

Conceptually:

```js
{
  schemaVersion: 2,
  libraryId: "library_...",
  headPatchId: "patch_...",
  patches: [
    {
      id: "patch_...",
      parentId: null,
      timestamp: "...",
      kind: "origin",
      changes: [ ... ]
    },
    {
      id: "patch_...",
      parentId: "patch_...",
      timestamp: "...",
      kind: "edit",
      changes: [ ... ]
    }
  ]
}
```

The materialized internal state is:

```js
{
  notesById: {},
  subjectMeta: {}
}
```

This is important because notes can be changed independently.

---

# 9. Supported patch operations

The patch engine currently supports:

```js
{ op: "add",     path: "/notesById/123", value: {...} }
{ op: "replace", path: "/notesById/123/title", value: "New title" }
{ op: "remove",  path: "/notesById/123" }
```

Only:

- `add`
- `replace`
- `remove`

are accepted by the patch application layer.

The engine does not expose arbitrary JavaScript execution through JSON.

---

# 10. Why patches instead of full-library replacement?

Suppose a library contains 500 notes and one answer changes.

A full replacement would conceptually transmit:

```text
500 notes
```

The patch model can instead record:

```text
replace /notesById/123/qas/4/answer
```

This keeps edits small and gives the system a history that can later be synchronized with a server.

---

# 11. History, undo and rollback

History is immutable from the user's perspective.

### Undo

```text
P1 origin
 ↓
P2 edit
 ↓
P3 undo
```

P2 remains in history. P3 restores the previous materialized state.

### Rollback

Rollback materializes an older patch state and creates a new patch from the current state to that state.

```text
P1 → P2 → P3 → P4
          ↑
       rollback
          ↓
         P5
```

No historical patch is silently deleted.

---

# 12. Context system

Context is shared by:

- AI Edit Note;
- Manual Edit;
- Attach Visual;
- future context-aware actions.

A context contains a note ID plus selected content parts.

Example:

```js
{
  noteId: 123,
  selections: [
    {
      type: "paragraph",
      key: "stable-paragraph-key",
      targetType: "paragraph",
      targetKey: "stable-paragraph-key",
      content: "..."
    },
    {
      type: "qa",
      key: "qa-2",
      targetType: "qa-question",
      targetKey: "qa-question-2",
      content: {...}
    }
  ]
}
```

Supported selectable targets:

- whole note;
- paragraph;
- Q&A;
- MCQ.

Paragraphs use stable keys derived from their content so visual attachments and context references do not depend solely on array position.

### Context selection UX

When Edit is activated while a note is already open, Notevora immediately enters context-gathering mode. The current note is already selected; the user does not need to tap the note a second time before selecting paragraphs or questions.

Selected paragraphs use the same themed surface treatment as MCQ and manual-edit cards so the selection is visible in both light and dark themes.

---

# 13. AI omnibox

The omnibox is the primary AI bridge.

Modes:

```text
Create note
Edit note
Manual
Paste
```

Only Create and Edit are active modes. Manual is an action, while Paste exposes the response area.

### Create flow

```text
Describe what you want
 ↓
Submit
 ↓
Notevora prepares the prompt
 ↓
Share/copy to an AI app
 ↓
AI returns note JSON
 ↓
Paste
 ↓
Validate + normalize
 ↓
Create a new note
```

### Edit flow

```text
Open note / select note
 ↓
Context gathering
 ↓
Select whole note or parts
 ↓
Describe change
 ↓
AI returns smart-notes-patch JSON
 ↓
Validate basePatchId
 ↓
Apply patch
```

The edit system does not ask the AI to rewrite unrelated content.

---

# 14. Manual workspace

`src/manual-workspace.js` provides the modern manual editor.

Create mode supports:

- title/metadata;
- main explanation;
- Q&A parts;
- MCQs;
- important terms;
- JSON input.

Edit mode is context-first.

The user first selects the relevant context and can then:

- edit a paragraph;
- edit a Q&A;
- edit an MCQ;
- remove selected content;
- add a new paragraph/Q&A/MCQ;
- use a validated patch JSON when preferred.

Manual mutations still enter the same patch history as AI mutations.

---

# 15. Visual assets

Assets can be attached to:

```text
whole note
paragraph
Q&A question/answer
MCQ question
```

Supported conceptual asset types include:

- image;
- vector/SVG;
- diagram;
- graph.

The Visual Attach workflow uses the shared Context system rather than maintaining a second selection model.

Asset data is stored on the note and changes are recorded through the patch system.

External URLs are validated as HTTP(S) resources before being accepted.

---

# 16. Search

Search is implemented in `services/search.js`.

The goal is relevance, not merely substring matching.

Ranking considers signals such as:

- exact query match;
- phrase match;
- token coverage;
- title match;
- subject match;
- chapter match;
- question match;
- term match;
- prefix matching;
- small typo tolerance;
- normalized text comparison.

The search UI also supports separate sorting/filtering controls.

The ranking system is intentionally deterministic so the same local library produces predictable results.

For very large future libraries, the search service is the intended location for a persistent inverted/search index rather than scanning every field repeatedly.

---

# 17. Subject grouping

The library supports grouping by:

- Academic category;
- Class / level;
- Board;
- Medium;
- Alphabetical;
- Custom sections.

Grouping is a UI preference. It does not modify note content and therefore does not create a content patch.

The Group popover is anchored directly below its button using the same geometry as Sort/Filter popovers.

Custom grouping stores subject names separately and supports drag-and-drop/pointer movement.

---

# 18. Personalization

Profile preferences are available through:

```text
More → Profile
```

There are two kinds of information.

### Communication preferences

These describe how the AI should communicate:

- preferred speaking language;
- preferred writing language;
- preferred reading language.

These affect instruction/explanation style and generated language where appropriate.

### Academic context

These describe the student's academic environment:

- academic medium;
- class/level;
- board/curriculum;
- university.

Academic context is not treated as a language preference.

The profile is local-only and is inserted into AI prompts when useful. Missing fields are not invented.

The profile can be edited at any time.

---

# 19. Prompt personalization behavior

A prompt may combine:

```text
user request
+
current subject/chapter metadata
+
known note context
+
academic profile
+
communication preferences
```

Example conceptual instruction:

```text
Explain the requested material using the student's preferred
reading/writing language. Keep the academic content aligned with
the known level, medium, board and university context.
```

This keeps language behavior separate from course facts.

---

# 20. JSON contracts

Notevora uses multiple JSON layers.

## Note JSON

Used for creating a note.

## Library JSON

Contains the complete local library including patch history.

## Patch JSON

Contains a sequence of safe add/replace/remove operations.

## AI create response

Must represent a normalized note or a compatible note payload.

## AI edit response

Must use:

```json
{
  "type": "smart-notes-patch",
  "basePatchId": "CURRENT_PATCH_ID",
  "changes": [
    {
      "op": "replace",
      "path": "/notesById/123/title",
      "value": "Updated title"
    }
  ]
}
```

The current patch ID prevents an edit generated against an older library state from silently modifying a newer state.

---

# 21. JSON safety

Before JSON enters the application it should pass through the JSON service and validation layer.

The application should:

- parse JSON rather than evaluate JavaScript;
- reject malformed payloads;
- normalize supported structures;
- validate patch operations;
- validate patch base IDs;
- sanitize rendered HTML/URLs;
- escape user-provided text before HTML insertion;
- never execute arbitrary code from imported JSON.

AI output is treated as untrusted data.

---

# 22. Backup and restore

Normal users do not need to understand patches to back up their library.

### Full backup

Exports the complete library JSON including patch history.

### Compressed backup

Exports the same logical library as `.json.gz` when the browser supports the standard CompressionStream APIs.

### Open another library

Loads a separate library file as the active library after validation.

### Add from another library

Imports notes from another library into the current library while preserving the current library's patch history. ID collisions are assigned new IDs.

### Share a library copy

Creates a separate backup file and uses the device share sheet when supported. Sharing does not modify the active library.

### Patch tools

Advanced users can export/apply compact patch bundles. These tools are secondary because most users should use full library backups.

---

# 23. Storage architecture

Notevora uses three practical layers.

```text
RAM
 ↑
IndexedDB
 ↑
LocalStorage bootstrap
```

### LocalStorage

Used for synchronous first paint and compatibility with existing local data.

### IndexedDB

Used as the durable browser persistence layer and for asynchronous hydration.

### RAM cache

Materialized library states can be cached for repeated reads. The cache is bounded so it cannot grow without limit.

The patch chain remains authoritative. Storage and cache are implementation layers.

---

# 24. Compression

`services/compression.js` uses the browser's standard APIs:

```js
CompressionStream('gzip')
DecompressionStream('gzip')
```

The compressed backup contains the same JSON library model after decompression. Compression does not alter patch semantics.

Browsers without decompression support should use the normal `.json` backup.

---

# 25. Large-library strategy

The current v1 already includes:

- synchronous bootstrap;
- IndexedDB hydration;
- bounded RAM materialization caching;
- compact patch representation;
- relevance-ranked search;
- compressed backups.

A future high-scale release can add:

```text
library manifest
      ↓
note index
      ↓
subject/chapter index
      ↓
search index
      ↓
materialized snapshots
      ↓
load individual note/patch ranges on demand
```

True note-by-note lazy loading is not claimed as a completed v1 feature. The architecture is intentionally kept compatible with that future storage model.

---

# 26. Navigation

`ui/navigation.js` owns view routing.

The app uses hash-based navigation so the PWA can remain a static frontend.

Conceptual routes include:

```text
#subjects
#chapters/<subject>
#notes/<subject>/<chapter>
#reader/<note-id>
#search/<query>
```

The exact encoding is handled by the navigation module rather than being duplicated across UI components.

---

# 27. Rendering

`ui/render.js` is responsible for turning state into UI.

It renders:

- subjects;
- chapters;
- note lists;
- note reader;
- search results;
- Q&A;
- MCQs;
- terms;
- visual assets;
- library grouping.

The renderer does not own persistence.

---

# 28. Theme

`ui/theme.js` manages the light/dark presentation preference.

Components should use theme variables such as:

```css
var(--bg-color)
var(--card-bg)
var(--text-main)
var(--text-muted)
var(--border)
var(--primary)
var(--primary-light)
var(--shadow-md)
```

To keep UI consistent, new surfaces should use these variables rather than hard-coded light/dark colors.

This rule applies particularly to:

- toasts;
- popovers;
- context selection;
- forms;
- backup sheets;
- asset editors;
- manual workspace.

---

# 29. Toast system

`ui/toast.js` is the single feedback mechanism for transient application messages.

The v1 UI should not introduce competing alert/toast designs.

Toast content is escaped before insertion and the visual surface follows the active theme.

Examples:

```js
showToast('Note created.', { icon: 'check_circle' });
showToast('Choose a note first.', { icon: 'description' });
showToast('Backup saved.', { icon: 'save' });
```

Browser `alert()` is intentionally not part of the normal product UX.

---

# 30. PWA

The application includes:

- web manifest;
- installable icons;
- service worker;
- cached app shell;
- offline-first shell behavior.

`sw.js` uses a versioned cache name. Updating the cache version invalidates the old shell during activation.

The service worker caches the application modules needed for the static frontend.

---

# 31. Offline and online boundaries

The core library does not require network access after the application shell has been cached.

Network-dependent functionality in v1 is intentionally limited.

The future sync boundary lives in `services/sync.js` and is not a backend implementation.

The current product should be described as:

> local-first and sync-ready

not as cloud-synchronized.

---

# 32. Security model

The v1 security model is based on minimizing trust.

### Imported data

Treat imported JSON and shared files as untrusted data.

### AI responses

Treat AI output as untrusted structured input.

### Patch base IDs

Reject stale edit patches when their `basePatchId` does not match the current library head.

### HTML

Escape user-provided strings before rendering into HTML.

### URLs

Only HTTP(S) resource URLs are accepted for external visual resources.

### Sharing

Sharing a library creates a copy. It does not expose a live editing connection to the current local library.

### No credentials

v1 has no account credentials or AI API secrets.

---

# 33. Data ownership model

The current library belongs to the browser/device where it is stored.

Because there is no backend in v1:

- clearing browser data can remove the local library;
- exporting a backup is the safest recovery mechanism;
- sharing a backup is a copy operation;
- there is no server-side recovery service.

Users should periodically export a library backup for important coursework.

---

# 34. Migration compatibility

The app still recognizes legacy Smart Notes storage identifiers.

Migration exists so the rebrand and v1 release do not require users to manually reconstruct their old notes.

Do not rename or remove legacy storage constants casually. They are part of the local migration path.

---

# 35. Development checks

The project is intentionally dependency-light and currently does not require a build tool.

A basic release validation is:

```bash
node --check src/main.js
node --check src/state.js
node --check src/events.js
node --check src/backup.js
node --check src/manual-workspace.js
node --check src/prompts.js
```

For a full source check, run `node --check` against every `.js` file under `src/`.

Also verify:

```text
✓ root index.html exists
✓ manifest.webmanifest exists
✓ service worker exists
✓ no backend directory exists
✓ all imported local modules exist
✓ PWA shell paths exist
✓ VERSION contains 1.0.0
```

---

# 36. Release checklist — v1.0.0

## Product

- [x] Local-first study library
- [x] Subject cards on home
- [x] Chapter and note navigation
- [x] Multiple notes per chapter
- [x] Note reader
- [x] Q&A
- [x] MCQs
- [x] Important terms
- [x] Visual assets
- [x] Search
- [x] Sort/filter
- [x] Subject grouping
- [x] Custom grouping

## AI workflow

- [x] Create prompt
- [x] Edit prompt
- [x] External AI share/copy workflow
- [x] Paste response workflow
- [x] Structured JSON validation
- [x] Patch-based edit workflow
- [x] Context selection
- [x] Manual context-aware editing

## Context

- [x] Whole-note selection
- [x] Paragraph selection
- [x] Q&A selection
- [x] MCQ selection
- [x] Edit Note integration
- [x] Manual Edit integration
- [x] Visual Attach integration
- [x] Immediate selection mode when editing an already-open note

## Personalization

- [x] More → Profile
- [x] Speaking language
- [x] Writing language
- [x] Reading language
- [x] Academic medium
- [x] Academic level
- [x] Board/curriculum
- [x] University
- [x] Prompt injection without inventing missing fields

## Storage

- [x] LocalStorage bootstrap
- [x] IndexedDB durability
- [x] RAM materialization cache
- [x] Patch history
- [x] Undo
- [x] Rollback
- [x] Full library export
- [x] Full library restore
- [x] Compressed backup
- [x] Library sharing copy
- [x] Import from another library
- [x] Add notes from another library

## UX

- [x] Responsive omnibox
- [x] Keyboard-aware mobile positioning
- [x] Modern themed toasts
- [x] Compact Sort/Filter-style Group popover
- [x] Modern backup/restore UI
- [x] Modern Visual Attach UI
- [x] Modern manual workspace
- [x] Light/dark theme support

## Release

- [x] Frontend-only
- [x] No backend
- [x] PWA manifest
- [x] Service worker
- [x] Version marker 1.0.0
- [x] README aligned with current architecture

---

# 37. Known intentional limits in v1

These are not hidden implementation gaps; they are explicit boundaries for the first release.

### No backend

There is no cloud account or server synchronization in v1.

### No built-in AI API

AI generation is intentionally external through copy/share and paste.

### No full note-by-note lazy database

The current release improves storage and materialization performance but does not claim a complete note-level lazy database architecture.

### Search is local

The relevance engine operates over the local library. A persistent full-text index is a future scalability layer.

### Domain is not bundled

The brand is **Notevora**, but the production domain must be registered separately.

---

# 38. Future direction

The architecture leaves room for:

```text
Notevora v1
   ↓
cloud patch synchronization
   ↓
account-scoped libraries
   ↓
server-side patch validation
   ↓
conflict-aware sync
   ↓
large-library indexes/snapshots
   ↓
optional native AI integrations
```

The future backend should preserve the same patch semantics rather than replacing the local model with destructive full-library synchronization.

---

# 39. Final architecture rule

The most important invariant of Notevora is:

```text
UI
 ↓
state/domain operation
 ↓
patch
 ↓
persist
 ↓
materialized state
 ↓
render
```

Not:

```text
UI
 ↓
mutate random object
 ↓
write random JSON
```

Keeping that boundary intact is what allows Notevora to remain local-first today while still having a credible path to synchronization and larger libraries later.

---

# 40. Version

```text
Product: Notevora
Version: 1.0.0
Architecture: frontend-only, local-first
Storage: LocalStorage + IndexedDB + bounded RAM cache
AI: external copy/share + paste workflow
History: immutable patch chain
PWA: enabled
Backend: none
```
