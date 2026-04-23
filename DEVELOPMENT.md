# Varek — Development

This is a single-user, local-only web app for managing the Varek worldbuilding
compendium. The filesystem is the database. Markdown files are the source of
truth. The app is strictly scoped to Varek — its defaults, copy, and folder
conventions encode the setting, not a generic worldbuilding schema.

## Stack

- **Backend.** Node.js + Express, written in TypeScript, run via `tsx`. One
  process, binds to `127.0.0.1` only.
- **Frontend.** React 18 + Vite. CodeMirror 6 as the editor. `markdown-it` for
  rendering, with a custom pass that rewrites internal links so React can
  intercept clicks.
- **AI.** `@anthropic-ai/sdk`. Streams responses; see `server/routes/ai.ts`.
- **Search + links.** In-memory inverted index and link graph, built on
  startup and kept warm by a `chokidar` filesystem watcher.

Nothing persists in a database. The only mutable on-disk state is the
compendium itself.

## Layout

```
.
├── varek/                     the canonical compendium (content)
├── server/                    node+express API
│   ├── index.ts               entry — wires up routes + builds indexes
│   ├── lib/
│   │   ├── metadata.ts        parse/compose blockquote + YAML metadata
│   │   ├── links.ts           pure link extraction
│   │   ├── tree.ts            directory walking
│   │   ├── search.ts          SearchIndex class (with chokidar watcher)
│   │   ├── backlinks.ts       LinkGraph class (with chokidar watcher)
│   │   ├── safePath.ts        path-traversal guard
│   │   └── toneGuide.ts       extracts the Tone guide section from README
│   └── routes/
│       ├── tree.ts            GET /api/tree
│       ├── entries.ts         GET/PUT /api/entries/*, POST /api/entries,
│       │                      GET /api/links/*
│       ├── search.ts          GET /api/search
│       └── ai.ts              POST /api/ai/extend (streaming)
├── client/                    react + vite SPA
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx            top-level layout + shortcuts
│   │   ├── lib/
│   │   │   ├── api.ts         typed fetch wrappers + streaming helper
│   │   │   ├── markdown.ts    renderer with internal-link rewriting
│   │   │   └── theme.ts       dark/light toggle, category → tag colour
│   │   ├── components/
│   │   │   ├── FileTree.tsx
│   │   │   ├── Viewer.tsx
│   │   │   ├── Editor.tsx     CodeMirror + live preview
│   │   │   ├── MetadataBlock.tsx
│   │   │   ├── SafeHtml.tsx   click interceptor for internal links
│   │   │   ├── Backlinks.tsx
│   │   │   ├── AiPanel.tsx
│   │   │   ├── NewEntryModal.tsx
│   │   │   └── GlobalSearch.tsx
│   │   └── styles/globals.css all visual design (CSS variables per theme)
│   └── tsconfig.json
├── vite.config.ts             vite config — root is ./client, proxies /api
├── tsconfig.json              server-side tsconfig (used by typecheck)
├── package.json
├── .env.example
└── USAGE.md                   user-facing instructions
```

## Running it

```bash
npm install
npm run dev   # vite + express in parallel, via concurrently
npm run build # builds the client to dist/client
npm start     # runs server in production mode; serves built client + API
npm run typecheck
```

Env vars (see `.env.example`):

- `ANTHROPIC_API_KEY` — required for the AI panel only.
- `VAREK_MODEL` — defaults to `claude-opus-4-7`.
- `VAREK_API_PORT` / `VAREK_WEB_PORT` — defaults 5174 / 5173.
- `VAREK_ROOT` — defaults to `./varek`.

## API

All endpoints live under `/api`. The server binds to `127.0.0.1` only — the
app is not reachable from other machines.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health + whether an API key is configured + current model. |
| `GET` | `/api/tree` | Nested tree of the compendium (directories + `.md` files). |
| `GET` | `/api/entries/<path>.md` | Parsed entry — title, metadata, body, raw, outgoing links. |
| `PUT` | `/api/entries/<path>.md` | Overwrite the file with `{ raw }`. Reindexes the file. |
| `POST` | `/api/entries` | Create a new entry from `{ folder, filename, title, metadata, body }`. |
| `GET` | `/api/links/<path>.md` | Live graph results: `{ backlinks, outgoing }`. |
| `GET` | `/api/search?q=` | Ranked hits across the compendium. |
| `POST` | `/api/ai/extend` | Streams Claude's response for `{ relativePath, instruction? }`. |

`<path>.md` is the compendium-relative path (e.g.
`characters/aldric.md`). All paths are resolved through
`resolveInsideRoot()` (`server/lib/safePath.ts`) — any attempt to escape the
compendium root is rejected.

## Metadata conventions

The compendium uses **blockquote-style metadata** immediately after the H1:

```markdown
# Aldric

> **Type:** Character (protagonist)
> **Status:** Canonical
```

The parser (`server/lib/metadata.ts`) handles two flavours:

- **Blockquote.** Canonical for the existing compendium. The colon may sit
  inside the bold (`**Key:**`) or outside (`**Key**:`).
- **YAML frontmatter.** Supported on read for files that happen to use it.
  When both are present, YAML wins.

**On write**, the app uses the blockquote style so new files match the
existing aesthetic. This is enforced in `composeBlockquoteEntry()`. New
entries are created via `POST /api/entries`, which validates filenames
against `^[a-z0-9][a-z0-9-]*\.md$` and folder segments against the same
pattern.

If you want to let users pick a metadata style in the New Entry modal, the
cleanest extension point is a new `composeYamlEntry()` helper in
`metadata.ts` and a radio in `NewEntryModal.tsx`.

## How the link graph works

`LinkGraph` (`server/lib/backlinks.ts`):

1. On startup, walks every `.md` under the compendium root.
2. For each file, `extractLinks()` parses every `[label](href)` pair and
   resolves relative paths through the source file's directory.
3. Stores two maps: `forward[from] = Edge[]` and `backward[to] = Edge[]`.
4. A chokidar watcher reindexes individual files on `add` / `change` /
   `unlink`.

Edges carry `{ from, to, anchor, label }`. Anchors are exposed so the "jump
to anchor" UI knows where to scroll.

## How search works

`SearchIndex` (`server/lib/search.ts`):

- One indexed doc per `.md`. Stores tokens (lowercased `[a-z0-9']+`), a
  lowercase haystack, and the body for snippet extraction.
- Scoring is a simple hand-rolled weighting: substring hit in body (+10),
  token intersection (+2 each), title match (+15), path match (+5).
- Watched the same way as the link graph.

This is adequate for a compendium of a few dozen files. For thousands of
entries, swap it for `flexsearch` or `minisearch` behind the same interface.

## How the AI endpoint works

`server/routes/ai.ts`:

1. Read the compendium's Tone guide from `README.md`
   (`loadToneGuide()`), cached per-request for simplicity.
2. Fold it into the system prompt along with a handful of explicit style
   rules derived from it.
3. Pull the current entry's raw file contents.
4. Pull the bodies of up to 8 directly-linked entries from the live link
   graph as extra context.
5. Call `anthropic.messages.stream(...)`, pipe `text` events straight to
   the HTTP response.

Model is controlled by `VAREK_MODEL` (default `claude-opus-4-7`).

To add new AI actions ("consistency checker," "NPC generator," etc.):

1. Add a new handler under `server/routes/ai.ts` — each should load the
   tone guide via `loadToneGuide()` and stream through the same pipeline.
2. Add a typed wrapper in `client/src/lib/api.ts`.
3. Hook it into `AiPanel.tsx` (or a new panel) with streaming UI.

The existing pattern already handles streaming, abort signals, and the
"no API key" error path.

## Where to add new features

| Feature in the roadmap | Where to start |
| --- | --- |
| Story writing mode | New `components/StoryMode.tsx` with a distraction-free layout. Scope it by current path starting with `story/chapters/`. Add a route-like mode switch in `App.tsx`. |
| Link graph view | Build on `GET /api/links/*`; a global graph endpoint would be a helpful addition (`LinkGraph.allEdges()`). Render with `d3-force` or `react-force-graph`. |
| Timeline view | Parse dated sections out of `history/*.md`. A new server-side parser can live in `server/lib/timeline.ts`. |
| "What if" sandbox | Treat `scratch/` as a sibling root, excluded from the main tree. The cleanest path is to extend `buildTree` with an ignore list, and add a new `GET /api/scratch/*` routes set. |
| Consistency checker | Another AI handler. Feed the whole compendium (or a ranked subset). The tone guide and prompt-caching of the big system prompt make this cheap to add if you upgrade to `anthropic.beta.promptCaching.messages`. |
| NPC generator | Another AI handler, plus a `NpcModal.tsx`. Don't auto-commit — return a blob for the user to review, then reuse `POST /api/entries`. |
| Oracle mode | Yet another AI handler; read-only. Display answers in a conversation log in a new panel. |
| Broken-link checker | `LinkGraph.brokenLinks()` — iterate all edges, check whether the target exists on disk. Expose at `GET /api/diagnostics/broken-links`. |
| Git integration | A thin `server/lib/git.ts` using `simple-git`. Hook into `PUT /api/entries/*` and `POST /api/entries` so each save is auto-committed. |

## Frontmatter / metadata enforcement

- Keys shown in the view-mode metadata block (top of each entry) come from
  whatever the parser extracted. Any key is allowed. The `Type` key is
  special-cased: its first word is rendered as a coloured tag derived from
  the entry's top-level folder (`categoryFromPath()` in `client/src/lib/theme.ts`).
- Filename validation is enforced server-side (`FILENAME_RE` and
  `DIR_SEGMENT_RE` in `server/routes/entries.ts`). Adjust there if you want
  to allow, e.g., chapter files like `01-the-chapel.md` — the current regex
  already allows those, so no change needed.
- There is no required key. Entries can have no metadata at all. The
  compendium convention is `Type` + `Status` at minimum; new entries default
  to those two fields.

## Testing surface

There are no automated tests yet. For a local single-user tool this is a
deliberate trade-off. If you want to add some, the highest-leverage targets
are:

1. `server/lib/metadata.ts` — the blockquote parser has subtle edge cases.
   Snapshot-test against every file in `varek/`.
2. `server/lib/links.ts` — tests around relative path resolution.
3. `server/lib/safePath.ts` — path-traversal attack cases.

## Design direction

- Dark mode is primary. Colours live in CSS variables per theme
  (`[data-theme="dark" | "light"]` on `<html>`).
- Category colour comes from `--tag-<category>` tied to the entry's top
  folder. Add a new category: add a `--tag-foo` variable in both themes and
  update `categoryFromPath()`.
- Typography: **Lora** for reading content, **Inter** for UI chrome. Both
  loaded from Google Fonts in `index.html`. If you prefer fully offline,
  replace with self-hosted font files and remove the `<link>` tag.
- No emoji. No decorative icons.
