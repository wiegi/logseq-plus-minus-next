# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Support Logseq DB graphs with native DB tags and block titles while retaining
  the existing Markdown representation for file graphs.

### Fixed

- Apply the three-column card layout through Logseq 2.0's additional
  `.blocks-list-wrap` outline container while preserving the Logseq 0.10 DOM
  path.
- Scope UUID selectors and Enter-key traversal to actual `.ls-block` elements
  so nested elements carrying the same `blockid` cannot be mistaken for blocks.
- Keep Plus, Minus, and Next headings visible in Logseq 2.0 by avoiding the
  block-slot hook, which replaces a block's native outline title.
- Keep card dimensions and heading typography consistent across Logseq 0.10
  and 2.0 instead of scaling them with each app's different root font size.
- Hide the complete native DB tag wrapper so its standalone `#` is not shown
  beside a board.
- Restore every board after restarting Logseq 0.10 by batching discovered board
  UUIDs into one stylesheet and rescanning after page restoration completes.
- Preserve the file-graph board headline by limiting native tag-wrapper hiding
  to DB graphs and preventing UUID fallbacks from matching ancestor blocks.
- Persist `Plus · Minus · Next #.pmn-board` after slash-command insertion and
  restore it on file-graph boards whose parent title is empty but whose three
  structural columns are intact.
- Rediscover Logseq 2.0 boards after restart from the native tag ident, block
  tag metadata, or their exact title and three-column structure, and repair the
  native tag when necessary.
- Recover Logseq 2.0 board UUIDs independently through an exact
  `:block/title` query and the rendered `.ls-block` DOM, including boards that
  mount after plugin startup.

## [0.1.4] - 2026-07-27

### Fixed

- Request the Marketplace same-origin sandbox required to intercept Enter on
  empty reflection blocks before Logseq outdents them into a new card.

## [0.1.3] - 2026-07-27

### Fixed

- Move entries that Logseq outdents after a second Enter press back beneath
  their preceding column using the plugin API, including in marketplace
  sandbox installations.

## [0.1.2] - 2026-07-27

### Fixed

- Use an HTML plugin entry so marketplace installations run correctly in
  Logseq's standard iframe sandbox.
- Include and validate the HTML entry in release packages.

## [0.1.1] - 2026-07-27

### Fixed

- Register the slash command before optional UI and maintenance hooks so it is
  available after installing the plugin from the Logseq Marketplace.
- Update the Logseq SDK and its bundled security-sensitive dependencies.

## [0.1.0] - 2026-07-25

### Added

- Slash-command-only creation with `/Plus Minus Next`.
- A permanent left-to-right three-column reflection layout.
- Native editable child bullets for Plus, Minus, and Next entries.
- Fixed, bullet-free column headings.
- Neutral styling based on Logseq theme variables.
- Accessible information tooltips for the three reflection prompts.
- Safe migration of headings created by development versions of the plugin.
- Automated validation, CI, and installable GitHub release packaging.

### Fixed

- Outdented entries are moved back beneath their preceding column so cards grow
  vertically instead of creating additional boxes.
- Board styling now uses stable block UUID selectors as well as the Logseq tag
  marker, avoiding intermittent rendering during editor updates.
- Removed the post-insertion system notification.
- First-level reflection bullets now use a compact base-level gutter instead of
  appearing as an extra indented outline level.

[Unreleased]: https://github.com/wiegi/logseq-plus-minus-next/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/wiegi/logseq-plus-minus-next/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/wiegi/logseq-plus-minus-next/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/wiegi/logseq-plus-minus-next/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/wiegi/logseq-plus-minus-next/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/wiegi/logseq-plus-minus-next/releases/tag/v0.1.0
