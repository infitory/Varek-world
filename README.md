# Varek

A local web app for managing the **Varek** worldbuilding compendium — a low
dark fantasy setting. One user. One browser tab. Markdown files on disk are
the source of truth.

The compendium lives in [`varek/`](varek/). Start there if you want to read
the world. Start in [`USAGE.md`](USAGE.md) if you want to run the app.

## Quick start

```bash
npm install
cp .env.example .env     # add your ANTHROPIC_API_KEY
npm run dev
```

Open <http://localhost:5173>.

- **[USAGE.md](USAGE.md)** — how to run it, shortcuts, backing up.
- **[DEVELOPMENT.md](DEVELOPMENT.md)** — architecture, API, where to add
  features.
- **[varek/README.md](varek/README.md)** — the compendium's own guide and
  the canonical tone guide.
