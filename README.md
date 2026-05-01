# Commentary Markdown Core Fixtures

This fixture repository demonstrates Commentary's core Markdown rendering and repository-aware extension behavior.

## Feature Coverage

- Frontmatter metadata rendering.
- GitHub-Flavored Markdown tables, task lists, and callouts.
- Mermaid diagrams, including valid and invalid diagram fallback.
- Relative links, heading anchors, broken links, and asset resolution.
- Wikilinks with aliases, heading targets, missing targets, and ambiguous targets.
- Markdown page embeds, heading-section embeds, recursive embed protection, and image embeds.
- MDX import/export/component detection without executing user code.
- Repository graph, backlinks, broken-link, and asset diagnostics.

## Manual Commentary Routes

```text
/review/github/commentary-dev/commentary-markdown-core-fixtures/pull/1?file=docs%2Fcore-extension-matrix.mdx
/review/github/commentary-dev/commentary-markdown-core-fixtures/document?branch=fixture%2Fcore-extensions&file=docs%2Fcore-extension-matrix.mdx
```

This repo is safe for demos and read-only automation. Do not create persistent comments from automated tests here.
