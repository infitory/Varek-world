# Chapters

This directory will hold the story itself as it is written.

## Convention

Each chapter as its own file:
- `01-the-chapel.md`
- `02-the-arrival.md`
- `03-the-letter.md`
- etc.

Each file should begin with frontmatter-style metadata:

```
# Chapter N: [Title]

> **POV:** [Aldric / other]
> **Location:** [Setting]
> **Time:** [Relative to story start]
> **Status:** [Draft / revised / final]
```

Followed by the prose.

## Notes

- Chapters should cross-reference worldbuilding files where relevant, so that a reader (or [Claude Code](../../README.md)) can trace an element back to its canonical definition.
- Chapters are the story. The compendium is the setting. The two should stay coherent but distinct — changes to the compendium that come from the story should be noted in commit messages or in the compendium files themselves.
