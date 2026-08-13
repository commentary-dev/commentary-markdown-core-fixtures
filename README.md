# Commentary Markdown Core Fixtures

This fixture repository demonstrates Commentary's core Markdown rendering and repository-aware extension behavior.

## Feature Coverage

- Frontmatter metadata rendering.
- GitHub-Flavored Markdown tables, task lists, and callouts.
- Mermaid diagrams, including valid and invalid diagram fallback.
- First-class standalone SVG and Mermaid artifacts with source-backed Raw mode.
- Embedded PNG, JPEG, WebP, AVIF, SVG, and Mermaid visual region review.
- Repeated SVG occurrences with independent marker identity.
- Relative links, heading anchors, broken links, and asset resolution.
- Wikilinks with aliases, heading targets, missing targets, and ambiguous targets.
- Markdown page embeds, heading-section embeds, recursive embed protection, and image embeds.
- MDX import/export/component detection without executing user code.
- Repository graph, backlinks, broken-link, and asset diagnostics.

## Manual Commentary Routes

```text
/review/github/commentary-dev/commentary-markdown-core-fixtures/pull/3?file=docs%2Fcore-extension-matrix.mdx
/review/github/commentary-dev/commentary-markdown-core-fixtures/document?branch=fixture%2Fcore-extensions&file=docs%2Fcore-extension-matrix.mdx
/review/github/commentary-dev/commentary-markdown-core-fixtures/pull/3?file=docs%2Fassets%2Freview-workflow.svg
/review/github/commentary-dev/commentary-markdown-core-fixtures/pull/3?file=docs%2Fdiagrams%2Freview-flow.mmd
/review/github/commentary-dev/commentary-markdown-core-fixtures/pull/3?file=docs%2Fassets%2Freview-dashboard.avif
```

For manual review, activate visual annotation, select a rectangle, and submit the normal comment composer. Use the oversized dashboard to exercise zoom and pan. Public viewing remains read-only, and automated tests must not create persistent comments here.
