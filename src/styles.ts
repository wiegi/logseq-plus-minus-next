export function createStyles(
  boardUuids: string[] = [],
  isDbGraph = false
): string {
  const uuidSelectors = boardUuids
    .filter((uuid) => /^[0-9a-f-]{36}$/i.test(uuid))
    .flatMap((uuid) => [
      `.ls-block[blockid="${uuid}"]`,
      `.ls-block[data-block-id="${uuid}"]`,
      `.ls-block[data-block-uuid="${uuid}"]`,
      `.ls-block:has(> .block-main-container [id="block-content-${uuid}"])`
    ]);
  const boardSelector = `:is(.ls-block[data-refs-self*="pmn-board"]${
    uuidSelectors.length ? `, ${uuidSelectors.join(", ")}` : ""
  })`;
  const boardChildrenSelector =
    `${boardSelector} > .block-children-container`;
  const fileColumnListSelector =
    `${boardChildrenSelector} > .block-children:not(:has(> .blocks-list-wrap))`;
  const dbColumnListSelector =
    `${boardChildrenSelector} > .block-children > .blocks-list-wrap`;
  const columnListSelector =
    `:is(${fileColumnListSelector}, ${dbColumnListSelector})`;
  const columnSelector = `${columnListSelector} > .ls-block`;
  const dbTagStyles = isDbGraph
    ? String.raw`
${boardSelector} .block-tag:has(.tag[data-ref=".pmn-board"]),
${boardSelector} .block-tag:has(.tag[data-ref="pmn-board"]) {
  display: none;
}
`
    : "";

  return String.raw`
/*
 * A PMN board is an ordinary Logseq block tagged #.pmn-board in a file graph
 * or with the native pmn-board tag in a DB graph.
 * Only its three direct children become columns; every deeper block keeps
 * Logseq's normal outliner behaviour.
 */
${boardSelector} {
  margin: 20px 0 28px;
}

${boardSelector} > .block-main-container {
  font-size: 15px;
  opacity: 0.72;
}

${boardSelector} .tag[data-ref=".pmn-board"],
${boardSelector} .tag[data-ref="pmn-board"] {
  display: none;
}

${dbTagStyles}

${boardChildrenSelector} {
  width: 100%;
  margin-left: 0;
}

${boardChildrenSelector} > .block-children {
  width: 100%;
  border-left: 0 !important;
}

/*
 * File graphs place column blocks directly inside .block-children. Logseq 2.0
 * adds .blocks-list-wrap between those elements. Target the element that
 * actually owns the three column blocks in either DOM shape.
 */
${columnListSelector} {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(192px, 1fr)) !important;
  align-items: stretch;
  gap: 14px;
  width: 100%;
  overflow-x: auto !important;
  overflow-y: visible;
  border-left: 0 !important;
  margin: 10px 0 0;
  padding: 0 0 8px;
}

${columnSelector} {
  min-width: 0;
  min-height: 176px;
  margin: 0 !important;
  padding: 13px 10px 16px;
  border: 1px solid var(--ls-border-color);
  border-radius: var(--ls-border-radius-medium, 8px);
  background: var(--ls-secondary-background-color);
}

${columnSelector} > .block-main-container {
  font-size: 14px;
  pointer-events: none;
  user-select: none;
  cursor: default;
}

/*
 * Column blocks are structural labels, not entries. Hide their bullets while
 * leaving every child block beneath them fully interactive.
 */
${columnSelector} > .block-main-container > .block-control-wrap {
  display: none;
}

${columnSelector} > .block-main-container .bullet-container {
  display: none;
}

/*
 * Remove Logseq's normal nested-outline gutter inside each card. Entry bullets
 * keep their own compact control space, so content remains readable and native.
 */
${columnSelector} > .block-children-container {
  margin-left: 0 !important;
  padding-left: 0 !important;
}

${columnSelector} > .block-children-container > .block-children {
  margin-left: 0 !important;
  padding-left: 0 !important;
  border-left: 0 !important;
}

${columnSelector} > .block-children-container .block-children-left-border {
  display: none;
}

${columnSelector} > .block-main-container h2,
${columnSelector} > .block-main-container .block-title-wrap {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 600;
  color: var(--ls-primary-text-color);
}

${boardSelector} .pmn-info {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid currentColor;
  border-radius: 999px;
  color: var(--ls-secondary-text-color);
  font-family: sans-serif;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
  line-height: 1;
  vertical-align: middle;
  cursor: help;
  opacity: 0.72;
  pointer-events: auto;
  outline: none;
}

${boardSelector} .pmn-info:hover,
${boardSelector} .pmn-info:focus-visible {
  opacity: 1;
}

${boardSelector} .pmn-info-tooltip {
  position: absolute;
  z-index: 1000;
  top: calc(100% + 7px);
  left: 0;
  display: block;
  width: max-content;
  max-width: 240px;
  padding: 8px 10px;
  border: 1px solid var(--ls-border-color);
  border-radius: var(--ls-border-radius-medium, 8px);
  background: var(--ls-primary-background-color);
  color: var(--ls-primary-text-color);
  font-family: var(--ls-font-family);
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 1.35;
  text-align: left;
  white-space: normal;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}

${boardSelector} .pmn-info:hover .pmn-info-tooltip,
${boardSelector} .pmn-info:focus-visible .pmn-info-tooltip {
  visibility: visible;
  opacity: 1;
}

${columnSelector}:nth-child(3) .pmn-info-tooltip {
  right: 0;
  left: auto;
}
`;
}
