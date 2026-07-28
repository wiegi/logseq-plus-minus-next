import "@logseq/libs";
import { createStyles } from "./styles";

const FILE_BOARD_TAG = "#.pmn-board";
const DB_BOARD_TAG = "pmn-board";
const BOARD_NAME = "Plus · Minus · Next";
const FILE_BOARD_TITLE = `${BOARD_NAME} ${FILE_BOARD_TAG}`;

const fileColumnHeadings = ["## ＋ Plus", "## − Minus", "## → Next"];
const dbColumnHeadings = ["＋ Plus", "− Minus", "→ Next"];
const columnDescriptions = {
  plus: "What worked well, felt energising, or should be repeated?",
  minus: "What did not work, felt difficult, or created friction?",
  next: "What will you change, try, or prioritise next?"
} as const;
const columnNames = ["plus", "minus", "next"] as const;

const fileColumns = [
  {
    content: `${fileColumnHeadings[0]} {{renderer :pmn-info, plus}}`,
    children: [{ content: "" }]
  },
  {
    content: `${fileColumnHeadings[1]} {{renderer :pmn-info, minus}}`,
    children: [{ content: "" }]
  },
  {
    content: `${fileColumnHeadings[2]} {{renderer :pmn-info, next}}`,
    children: [{ content: "" }]
  }
];

const dbColumns = dbColumnHeadings.map((content) => ({
  content,
  children: [{ content: "" }]
}));

const legacyColumns = [
  {
    contents: [
      "## ＋ Plus\nWhat worked well, felt energising, or should be repeated?",
      fileColumnHeadings[0]
    ],
    replacement: fileColumns[0].content
  },
  {
    contents: [
      "## − Minus\nWhat did not work, felt difficult, or created friction?",
      fileColumnHeadings[1]
    ],
    replacement: fileColumns[1].content
  },
  {
    contents: [
      "## → Next\nWhat will you change, try, or prioritise next?",
      fileColumnHeadings[2]
    ],
    replacement: fileColumns[2].content
  }
];

type BoardBlock = {
  uuid?: string;
  content?: string;
  title?: string;
  children?: BoardBlock[];
  tags?: BoardTagReference[];
  "block/tags"?: BoardTagReference[];
};

type BoardTagReference =
  | string
  | {
      uuid?: string;
      name?: string;
      title?: string;
      originalName?: string;
      ident?: string;
    };

let maintenanceTimer: number | undefined;
let startupMaintenanceTimer: number | undefined;
let maintenanceRunning = false;
let currentGraphIsDb = false;
const knownBoardUuids = new Set<string>();
let logseqDocument: Document | undefined;
let boardDomObserver: MutationObserver | undefined;

const BLOCK_ELEMENT_SELECTOR = ".ls-block";
const BLOCK_UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function getBlockText(block?: Pick<BoardBlock, "content" | "title"> | null): string {
  if (!block) return "";

  return currentGraphIsDb
    ? (block.title ?? block.content ?? "")
    : (block.content ?? block.title ?? "");
}

async function detectCurrentGraphMode(): Promise<boolean> {
  const checkCurrentIsDbGraph = logseq.App.checkCurrentIsDbGraph;

  if (typeof checkCurrentIsDbGraph !== "function") return false;

  try {
    return Boolean(await logseq.App.checkCurrentIsDbGraph());
  } catch (error) {
    console.warn(
      "[Plus Minus Next] Could not detect graph type; using file-graph compatibility mode",
      error
    );
    return false;
  }
}

function getLogseqDocument(): Document {
  try {
    return window.parent?.document ?? document;
  } catch {
    return document;
  }
}

function getParentBlockElement(block: HTMLElement): HTMLElement | null {
  let element = block.parentElement;

  while (element) {
    if (element.matches(BLOCK_ELEMENT_SELECTOR)) return element;
    element = element.parentElement;
  }

  return null;
}

function isBoardElement(block: HTMLElement): boolean {
  const refs = block.getAttribute("data-refs-self") ?? "";
  const uuid =
    block.getAttribute("blockid") ??
    block.getAttribute("data-block-id") ??
    block.getAttribute("data-block-uuid") ??
    "";

  return refs.includes("pmn-board") || knownBoardUuids.has(uuid);
}

/*
 * In Logseq, Enter on an already empty block outdents it. For a PMN entry that
 * would place the block beside Plus / Minus / Next, where the grid renders it
 * as another card. Consume only that specific Enter press; Enter after a
 * non-empty entry still creates the next bullet normally.
 */
function keepEmptyEntryInsideColumn(event: KeyboardEvent): void {
  if (
    event.key !== "Enter" ||
    event.shiftKey ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.isComposing
  ) {
    return;
  }

  const editor = event.target as HTMLElement | null;
  if (!editor || editor.nodeType !== 1) return;

  let isEmpty = false;

  if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
    isEmpty = (editor as HTMLTextAreaElement | HTMLInputElement).value.trim() === "";
  } else if (editor.isContentEditable) {
    isEmpty = (editor.textContent ?? "").trim() === "";
  } else {
    return;
  }

  if (!isEmpty) return;

  const entryBlock = editor.closest<HTMLElement>(BLOCK_ELEMENT_SELECTOR);
  if (!entryBlock) return;

  const columnBlock = getParentBlockElement(entryBlock);
  const boardBlock = columnBlock
    ? getParentBlockElement(columnBlock)
    : null;

  if (!columnBlock || !boardBlock || !isBoardElement(boardBlock)) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function rememberBoardUuid(uuid?: string): boolean {
  if (!uuid || knownBoardUuids.has(uuid)) return false;
  knownBoardUuids.add(uuid);
  return true;
}

function registerBoardUuid(uuid?: string): void {
  if (rememberBoardUuid(uuid)) updateBoardStyles();
}

function updateBoardStyles(): void {
  logseq.provideStyle({
    key: "plus-minus-next-board-styles",
    style: createStyles([...knownBoardUuids], currentGraphIsDb)
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFileColumnIndex(block: BoardBlock): number {
  const content = getBlockText(block);

  return columnNames.findIndex(
    (columnName, index) =>
      content.includes(`{{renderer :pmn-info, ${columnName}}}`) ||
      legacyColumns[index].contents.includes(content)
  );
}

function getColumnIndex(block: BoardBlock): number {
  const fileColumnIndex = getFileColumnIndex(block);
  if (fileColumnIndex >= 0) return fileColumnIndex;

  const content = getBlockText(block);
  return dbColumnHeadings.findIndex((heading) => heading === content);
}

function hasFileBoardColumns(block: BoardBlock): boolean {
  const columnIndexes = new Set(
    (block.children ?? [])
      .map(getFileColumnIndex)
      .filter((index) => index >= 0)
  );

  return columnNames.every((_, index) => columnIndexes.has(index));
}

function hasDbBoardColumns(block: BoardBlock): boolean {
  const columnIndexes = new Set(
    (block.children ?? [])
      .map((child) => {
        const content = getBlockText(child);
        return dbColumnHeadings.findIndex((heading) => heading === content);
      })
      .filter((index) => index >= 0)
  );

  return columnNames.every((_, index) => columnIndexes.has(index));
}

function isDbBoardTagName(value?: string): boolean {
  if (!value) return false;

  const normalized = value.toLowerCase().replace(/^:/, "");
  return (
    normalized === DB_BOARD_TAG ||
    normalized === `.${DB_BOARD_TAG}` ||
    normalized.endsWith(`/${DB_BOARD_TAG}`)
  );
}

function hasDbBoardTag(block: BoardBlock): boolean {
  const tags = [...(block.tags ?? []), ...(block["block/tags"] ?? [])];

  return tags.some((tag) => {
    if (typeof tag === "string") return isDbBoardTagName(tag);

    return [tag.name, tag.title, tag.originalName, tag.ident].some(
      isDbBoardTagName
    );
  });
}

function collectDbQueryUuids(value: unknown, boardUuids: Set<string>): void {
  if (typeof value === "string") {
    const uuid = value.match(BLOCK_UUID_PATTERN)?.[0];
    if (uuid) boardUuids.add(uuid);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectDbQueryUuids(item, boardUuids);
    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectDbQueryUuids(item, boardUuids);
    }
  }
}

function discoverRenderedDbBoards(): boolean {
  if (!currentGraphIsDb || !logseqDocument) return false;

  let changed = false;
  const blocks =
    logseqDocument.querySelectorAll<HTMLElement>(".ls-block[blockid]");

  for (const block of blocks) {
    const mainContainer = Array.from(block.children).find(
      (child) => child.classList.contains("block-main-container")
    );
    const title = mainContainer?.querySelector<HTMLElement>(
      ".block-title-wrap"
    );
    const normalizedTitle = (title?.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();

    if (normalizedTitle !== BOARD_NAME) continue;

    const uuid = block.getAttribute("blockid") ?? undefined;
    changed = rememberBoardUuid(uuid) || changed;
  }

  return changed;
}

function provideInfoIcon(slot: string, description: string): void {
  const safeSlot = slot.replace(/[^a-zA-Z0-9_-]/g, "-");

  logseq.provideUI({
    key: `pmn-info-${safeSlot}`,
    slot,
    reset: true,
    template: `
      <span
        class="pmn-info"
        tabindex="0"
        role="note"
        aria-label="${escapeHtml(description)}"
        data-on-click="keepPmnInfoReadOnly"
      >
        <span aria-hidden="true">i</span>
        <span class="pmn-info-tooltip" role="tooltip">
          ${escapeHtml(description)}
        </span>
      </span>
    `
  });
}

async function getDbBoardUuids(): Promise<Set<string>> {
  if (!currentGraphIsDb) return new Set();

  const tagIdentifiers = new Set<string>([DB_BOARD_TAG]);

  try {
    const tag = await logseq.Editor.getTag(DB_BOARD_TAG);
    if (tag?.ident) tagIdentifiers.add(tag.ident);
  } catch (error) {
    console.warn("[Plus Minus Next] Could not resolve the DB board tag", error);
  }

  const boardUuids = new Set<string>();

  for (const identifier of tagIdentifiers) {
    try {
      const boards = await logseq.Editor.getTagObjects(identifier);
      for (const board of boards ?? []) {
        if (typeof board.uuid === "string") boardUuids.add(board.uuid);
      }
    } catch (error) {
      console.warn(
        `[Plus Minus Next] Could not load DB boards for ${identifier}`,
        error
      );
    }
  }

  try {
    const titleQuery = `
      [:find ?uuid
       :where
       [?block :block/title ${JSON.stringify(BOARD_NAME)}]
       [?block :block/uuid ?uuid]]
    `;
    const results = await logseq.DB.datascriptQuery(titleQuery);
    collectDbQueryUuids(results, boardUuids);
  } catch (error) {
    console.warn(
      "[Plus Minus Next] Could not query DB boards by title",
      error
    );
  }

  return boardUuids;
}

async function ensureDbBoardTag(blockUuid: string): Promise<void> {
  const boardTag =
    (await logseq.Editor.getTag(DB_BOARD_TAG)) ??
    (await logseq.Editor.createTag(DB_BOARD_TAG));

  if (!boardTag?.uuid) {
    throw new Error("Logseq could not create the PMN board tag.");
  }

  await logseq.Editor.addBlockTag(blockUuid, boardTag.uuid);
}

async function maintainCurrentPageBoards(): Promise<void> {
  if (maintenanceRunning) {
    scheduleBoardMaintenance(100);
    return;
  }

  maintenanceRunning = true;
  let boardStylesChanged = false;

  try {
    boardStylesChanged =
      discoverRenderedDbBoards() || boardStylesChanged;
    const dbBoardUuids = await getDbBoardUuids();
    const blocks =
      (await logseq.Editor.getCurrentPageBlocksTree()) as BoardBlock[];

    async function visit(block: BoardBlock): Promise<void> {
      const blockText = getBlockText(block);
      const hasFileBoardTag = blockText.includes(FILE_BOARD_TAG);
      const hasRecognizableFileColumns =
        !currentGraphIsDb && hasFileBoardColumns(block);
      const hasPersistedDbBoardTag =
        currentGraphIsDb && hasDbBoardTag(block);
      const hasRecognizableDbBoard =
        currentGraphIsDb &&
        blockText === BOARD_NAME &&
        hasDbBoardColumns(block);
      const isBoard = currentGraphIsDb
        ? Boolean(
            block.uuid &&
              (dbBoardUuids.has(block.uuid) ||
                knownBoardUuids.has(block.uuid) ||
                hasPersistedDbBoardTag ||
                hasRecognizableDbBoard)
          )
        : hasFileBoardTag || hasRecognizableFileColumns;

      if (isBoard) {
        boardStylesChanged =
          rememberBoardUuid(block.uuid) || boardStylesChanged;

        if (
          !currentGraphIsDb &&
          !hasFileBoardTag &&
          hasRecognizableFileColumns &&
          block.uuid
        ) {
          await logseq.Editor.updateBlock(block.uuid, FILE_BOARD_TITLE);
        }

        if (
          currentGraphIsDb &&
          hasRecognizableDbBoard &&
          !dbBoardUuids.has(block.uuid ?? "") &&
          !hasPersistedDbBoardTag &&
          block.uuid
        ) {
          await ensureDbBoardTag(block.uuid).catch((error) => {
            console.warn(
              "[Plus Minus Next] Could not restore the DB board tag",
              error
            );
          });
        }

        let precedingColumn: BoardBlock | undefined;
        for (const child of block.children ?? []) {
          const columnIndex = getColumnIndex(child);

          if (columnIndex >= 0) {
            precedingColumn = child;
            const currentText = getBlockText(child);
            const replacement = currentGraphIsDb
              ? dbColumnHeadings[columnIndex]
              : legacyColumns[columnIndex].replacement;

            if (
              child.uuid &&
              currentText !== replacement &&
              (currentGraphIsDb ||
                legacyColumns[columnIndex].contents.includes(currentText) ||
                dbColumnHeadings[columnIndex] === currentText)
            ) {
              await logseq.Editor.updateBlock(child.uuid, replacement);
            }

            continue;
          }

          /*
           * In the marketplace iframe sandbox we cannot intercept key events
           * from Logseq's editor. Pressing Enter on an empty entry therefore
           * briefly outdents it into a direct board child. Move any such child
           * back beneath the column that precedes it.
           */
          if (child.uuid && precedingColumn?.uuid) {
            await logseq.Editor.moveBlock(child.uuid, precedingColumn.uuid, {
              children: true
            });
          }
        }
      }

      for (const child of block.children ?? []) {
        await visit(child);
      }
    }

    for (const block of blocks ?? []) {
      await visit(block);
    }
  } finally {
    if (boardStylesChanged) updateBoardStyles();
    maintenanceRunning = false;
  }
}

function scheduleBoardMaintenance(delay = 180): void {
  if (maintenanceTimer !== undefined) {
    window.clearTimeout(maintenanceTimer);
  }

  maintenanceTimer = window.setTimeout(() => {
    maintenanceTimer = undefined;
    maintainCurrentPageBoards().catch((error) => {
      console.warn("[Plus Minus Next] Could not maintain this page", error);
    });
  }, delay);
}

async function insertBoard(reuseEmptyCurrentBlock = false): Promise<void> {
  try {
    currentGraphIsDb = await detectCurrentGraphMode();
    const boardTitle = currentGraphIsDb ? BOARD_NAME : FILE_BOARD_TITLE;
    const columns = currentGraphIsDb ? dbColumns : fileColumns;
    const currentBlock = await logseq.Editor.getCurrentBlock();
    let board;

    if (currentBlock?.uuid) {
      const canReuseCurrentBlock =
        reuseEmptyCurrentBlock && getBlockText(currentBlock).trim() === "";

      if (canReuseCurrentBlock) {
        await logseq.Editor.updateBlock(currentBlock.uuid, boardTitle);
        board = await logseq.Editor.getBlock(currentBlock.uuid);
      } else {
        board = await logseq.Editor.insertBlock(currentBlock.uuid, boardTitle, {
          sibling: true
        });
      }
    } else {
      const currentPage = await logseq.Editor.getCurrentPage();

      if (!currentPage) {
        logseq.UI.showMsg(
          "Open a page or edit a block before inserting a Plus / Minus / Next board.",
          "warning"
        );
        return;
      }

      board = await logseq.Editor.appendBlockInPage(
        currentPage.uuid ?? currentPage.name,
        boardTitle
      );
    }

    if (!board?.uuid) {
      throw new Error("Logseq did not return the new board block.");
    }

    if (currentGraphIsDb) {
      await ensureDbBoardTag(board.uuid);
    }

    // Register a UUID selector immediately. Unlike Logseq's tag-derived DOM
    // metadata, the block UUID is present consistently during editor updates.
    registerBoardUuid(board.uuid);

    // Finish the slash-command editor before adding children. This makes
    // Logseq render the tag-derived data-refs-self marker immediately, which
    // activates the three-column CSS without a timing race.
    await logseq.Editor.exitEditingMode();

    /*
     * Do not register onBlockRendererSlotted for DB column blocks. In Logseq
     * 2.0 that hook intentionally replaces the native outline renderer,
     * including the column title.
     */
    await logseq.Editor.insertBatchBlock(board.uuid, columns, {
      sibling: false
    });

    // Ensure focus restored by the slash-command host cannot leave the parent
    // in its unrendered editing state.
    await logseq.Editor.exitEditingMode();

    // Logseq 0.10 can restore the slash-command editor's previous empty value
    // after children are inserted. Persist the exact board label once more
    // after editing has fully ended.
    await logseq.Editor.updateBlock(board.uuid, boardTitle);

  } catch (error) {
    console.error("[Plus Minus Next] Could not insert board", error);
    logseq.UI.showMsg(
      "The Plus / Minus / Next board could not be inserted. See the developer console for details.",
      "error"
    );
  }
}

async function main(): Promise<void> {
  // Register the primary command first. Optional UI and maintenance setup
  // must not prevent the plugin's core command from becoming available.
  logseq.Editor.registerSlashCommand(
    "Plus Minus Next: Insert reflection board",
    () => insertBoard(true)
  );

  currentGraphIsDb = await detectCurrentGraphMode();

  logseqDocument = getLogseqDocument();
  logseqDocument.addEventListener(
    "keydown",
    keepEmptyEntryInsideColumn as EventListener,
    true
  );
  boardDomObserver = new MutationObserver(() => {
    if (currentGraphIsDb) scheduleBoardMaintenance(120);
  });
  boardDomObserver.observe(logseqDocument.body, {
    childList: true,
    subtree: true
  });
  logseq.beforeunload(async () => {
    logseqDocument?.removeEventListener(
      "keydown",
      keepEmptyEntryInsideColumn as EventListener,
      true
    );

    if (maintenanceTimer !== undefined) {
      window.clearTimeout(maintenanceTimer);
    }
    if (startupMaintenanceTimer !== undefined) {
      window.clearTimeout(startupMaintenanceTimer);
    }
    boardDomObserver?.disconnect();
  });

  logseq.provideStyle({
    key: "plus-minus-next-board-styles",
    style: createStyles([], currentGraphIsDb)
  });

  logseq.provideModel({
    keepPmnInfoReadOnly: (event?: Event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
    }
  });

  logseq.App.onMacroRendererSlotted(
    ({ slot, payload: { arguments: args } }) => {
      const [renderer, columnName] = args;

      if (renderer !== ":pmn-info") return;
      if (!(columnName in columnDescriptions)) return;

      const description =
        columnDescriptions[columnName as keyof typeof columnDescriptions];
      provideInfoIcon(slot, description);
    }
  );

  await maintainCurrentPageBoards().catch((error) => {
    console.warn("[Plus Minus Next] Could not upgrade this page", error);
  });

  /*
   * Logseq 0.10 can finish restoring the last blocks on a page shortly after
   * plugin startup. Rescan once after that restore and publish one complete
   * UUID-based stylesheet for every board.
   */
  startupMaintenanceTimer = window.setTimeout(() => {
    startupMaintenanceTimer = undefined;
    scheduleBoardMaintenance(0);
  }, 800);

  logseq.App.onRouteChanged(() => {
    scheduleBoardMaintenance(100);
  });

  logseq.App.onCurrentGraphChanged?.(() => {
    detectCurrentGraphMode()
      .then((isDbGraph) => {
        currentGraphIsDb = isDbGraph;
        knownBoardUuids.clear();
        updateBoardStyles();
        scheduleBoardMaintenance(0);
      })
      .catch((error) => {
        console.warn("[Plus Minus Next] Could not detect graph type", error);
      });
  });

  logseq.DB.onChanged(() => {
    scheduleBoardMaintenance(0);
  });

  console.info("[Plus Minus Next] Plugin loaded");
}

logseq.ready(main).catch((error) => {
  console.error("[Plus Minus Next] Failed to start", error);
});
