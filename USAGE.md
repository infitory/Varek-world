# Varek — Usage

A quiet local web app for tending the Varek compendium. One user. One browser
tab. No cloud. Your markdown files are the source of truth.

## First-time setup

```bash
npm install
cp .env.example .env
```

Open `.env` and paste your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-…
```

Get a key at https://console.anthropic.com/. You can run the app without a key
— everything except the AI panel will work — but the "Extend this entry"
feature needs one.

## Running the app

```bash
npm run dev
```

Then open **http://localhost:5173** in your browser.

`npm run dev` starts two processes:

- `api`: the Node/Express server, on port 5174.
- `web`: the Vite dev server, on port 5173. It proxies `/api/*` to the API.

You interact with port 5173. Everything else is internal.

## Shortcuts

| Key | What it does |
| --- | --- |
| `⌘K` / `Ctrl+K` | Open global search. `Enter` to pick. |
| `⌘S` / `Ctrl+S` | Save the current entry (edit mode). |
| `⌘⇧N` / `Ctrl+Shift+N` | New entry modal. |
| `Esc` | Close any modal. |

## Working with entries

- **Clicking a file** in the left tree opens it in view mode.
- **View / Edit** tabs at the top switch rendering vs. CodeMirror editor. In
  edit mode, the preview updates live to the right of the editor.
- **In-app links**: internal cross-links (`[Aldric](../characters/aldric.md)`)
  navigate inside the app. External links open in a new tab.
- **Drafts** auto-save to browser localStorage while you type. If you close
  the tab without saving, your draft comes back next time you open the entry.
  Saving clears the draft.
- **Backlinks** (right panel) show every entry that links to the current one,
  computed from the live link graph. The list refreshes after each save.

## Using the AI panel

The AI panel is on the right when any entry is open. It has one button:
**Extend this entry**. Clicking it:

1. Loads the compendium's tone guide (from `varek/README.md`) into the system
   prompt.
2. Sends the current entry and its directly-linked entries as context.
3. Streams Claude's response into the panel as it arrives.

When it finishes, you can:

- **Append to editor** — the generated text is appended to the current
  draft in the editor buffer. The file is **not** written to disk until you
  save.
- **Discard** — throw it away.

Nothing the AI produces is written to disk without your explicit save.

You can also type a custom instruction in the textarea before running — e.g.
"write a section about his relationship with his father."

## Creating new entries

Click **New entry** (top bar) or press `⌘⇧N` / `Ctrl+Shift+N`. Pick a folder,
give the entry a title, confirm the filename. The app creates a new markdown
file with a blockquote-style metadata block matching the existing compendium
convention.

## Backing up your work

The `varek/` folder is a plain directory of markdown files — nothing hidden,
nothing proprietary. Two good backup strategies:

**Git (recommended).** The repo is already a git repository. After a day of
writing:

```bash
git add varek
git commit -m "writing session, autumn 421 ALS"
```

Push to a private remote if you want off-machine safety.

**Plain filesystem copy.** Just copy the `varek/` folder somewhere. Every file
is readable in any text editor.

The app never modifies existing files without you explicitly saving them, and
it never deletes files.

## Where things live

| Path | What it holds |
| --- | --- |
| `varek/` | The compendium. Never modified unless you save or create via the app. |
| `.env` | Your API key. Gitignored. |
| `server/` | API server source. |
| `client/` | React app source. |
| `dist/` | Built frontend (only after `npm run build`). Gitignored. |

## Troubleshooting

**Port already in use.** Override the ports:

```bash
VAREK_API_PORT=6000 VAREK_WEB_PORT=6001 npm run dev
```

**AI panel says "no API key".** Add `ANTHROPIC_API_KEY=...` to `.env` and
restart `npm run dev`.

**An entry's metadata isn't showing in the sidebar.** The parser recognizes
blockquote metadata (`> **Key:** value`) and YAML frontmatter (`--- ... ---`).
Any other format is ignored. Check the file's first block after the `# Title`.

**Backlinks look wrong.** They're computed from a live in-memory graph that
rebuilds on startup and watches for file changes. If you edited files outside
the app, restart `npm run dev` to force a reindex.

## What this app will not do

- Sync to a server. It only speaks to `localhost`.
- Authenticate you. There are no accounts.
- Modify files you didn't explicitly edit or create through it.
- Move or rename your existing files.
- Delete anything from disk.
