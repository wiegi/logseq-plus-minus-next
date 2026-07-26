export function createStyles(boardUuids: string[] = []): string {
  const uuidSelectors = boardUuids
    .filter((uuid) => /^[0-9a-f-]{36}$/i.test(uuid))
    .flatMap((uuid) => [
      `div.ls-block[blockid="${uuid}"]`,
      `div.ls-block:has([id="block-content-${uuid}"])`
    ]);
  const boardSelector = `:is(div[data-refs-self*="pmn-board"]${
    uuidSelectors.length ? `, ${uuidSelectors.join(", ")}` : ""
  })`;

  return String.raw`
/*
 * A PMN board is an ordinary Logseq block tagged #.pmn-board.
 * Only its three direct children become columns; every deeper block keeps
 * Logseq's normal outliner behaviour.
 */
${boardSelector} {
  margin: 1.25rem 0 1.75rem;
}

${boardSelector} > .block-main-container {
  opacity: 0.72;
}

${boardSelector} .tag[data-ref=".pmn-board"],
${boardSelector} .tag[data-ref="pmn-board"] {
  display: none;
}

${boardSelector} > .block-children-container {
  width: 100%;
  margin-left: 0;
}

${boardSelector} > .block-children-container > .block-children {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(12rem, 1fr)) !important;
  align-items: stretch;
  gap: 0.9rem;
  width: 100%;
  overflow-x: auto !important;
  overflow-y: visible;
  border-left: 0;
  margin: 0.6rem 0 0;
  padding: 0 0 0.5rem;
}

${boardSelector} > .block-children-container > .block-children > .ls-block {
  min-width: 0;
  min-height: 11rem;
  margin: 0 !important;
  padding: 0.8rem 0.6rem 1rem;
  border: 1px solid var(--ls-border-color);
  border-radius: var(--ls-border-radius-medium, 0.5rem);
  background: var(--ls-secondary-background-color);
}

${boardSelector} > .block-children-container > .block-children > .ls-block > .block-main-container {
  font-size: 0.9rem;
  pointer-events: none;
  user-select: none;
  cursor: default;
}

/*
 * Column blocks are structural labels, not entries. Hide their bullets while
 * leaving every child block beneath them fully interactive.
 */
${boardSelector} > .block-children-container > .block-children > .ls-block > .block-main-container > .block-control-wrap {
  display: none;
}

${boardSelector} > .block-children-container > .block-children > .ls-block > .block-main-container .bullet-container {
  display: none;
}

/*
 * Remove Logseq's normal nested-outline gutter inside each card. Entry bullets
 * keep their own compact control space, so content remains readable and native.
 */
${boardSelector} > .block-children-container > .block-children > .ls-block > .block-children-container {
  margin-left: 0 !important;
  padding-left: 0 !important;
}

${boardSelector} > .block-children-container > .block-children > .ls-block > .block-children-container > .block-children {
  margin-left: 0 !important;
  padding-left: 0 !important;
  border-left: 0 !important;
}

${boardSelector} > .block-children-container > .block-children > .ls-block > .block-children-container .block-children-left-border {
  display: none;
}

${boardSelector} > .block-children-container > .block-children > .ls-block > .block-main-container h2 {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0 0 0.25rem;
  font-size: 1.05rem;
  color: var(--ls-primary-text-color);
}

${boardSelector} .pmn-info {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  color: var(--ls-secondary-text-color);
  font-family: sans-serif;
  font-size: 0.68rem;
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
  top: calc(100% + 0.45rem);
  left: 0;
  display: block;
  width: max-content;
  max-width: 15rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--ls-border-color);
  border-radius: var(--ls-border-radius-medium, 0.5rem);
  background: var(--ls-primary-background-color);
  color: var(--ls-primary-text-color);
  font-family: var(--ls-font-family);
  font-size: 0.78rem;
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

${boardSelector} > .block-children-container > .block-children > .ls-block:nth-child(3) .pmn-info-tooltip {
  right: 0;
  left: auto;
}
`;
}
