import "@logseq/libs";
import { createStyles } from "./styles";

const BOARD_TAG = "#.pmn-board";
const BOARD_TITLE = `Plus · Minus · Next ${BOARD_TAG}`;

const columnHeadings = ["## ＋ Plus", "## − Minus", "## → Next"];
const columnDescriptions = {
  plus: "What worked well, felt energising, or should be repeated?",
  minus: "What did not work, felt difficult, or created friction?",
  next: "What will you change, try, or prioritise next?"
} as const;

const columns = [
  {
    content: `${columnHeadings[0]} {{renderer :pmn-info, plus}}`,
    children: [{ content: "" }]
  },
  {
    content: `${columnHeadings[1]} {{renderer :pmn-info, minus}}`,
    children: [{ content: "" }]
  },
  {
    content: `${columnHeadings[2]} {{renderer :pmn-info, next}}`,
    children: [{ content: "" }]
  }
];

const legacyColumns = [
  {
    contents: [
      "## ＋ Plus\nWhat worked well, felt energising, or should be repeated?",
      columnHeadings[0]
    ],
    replacement: columns[0].content
  },
  {
    contents: [
      "## − Minus\nWhat did not work, felt difficult, or created friction?",
      columnHeadings[1]
    ],
    replacement: columns[1].content
  },
  {
    contents: [
      "## → Next\nWhat will you change, try, or prioritise next?",
      columnHeadings[2]
    ],
    replacement: columns[2].content
  }
];

type BoardBlock = {
  uuid?: string;
  content?: string;
  children?: BoardBlock[];
};

let maintenanceTimer: number | undefined;
let maintenanceRunning = false;
const knownBoardUuids = new Set<string>();
let logseqDocument: Document | undefined;

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
    if (element.classList.contains("ls-block")) return element;
    element = element.parentElement;
  }

  return null;
}

function isBoardElement(block: HTMLElement): boolean {
  const refs = block.getAttribute("data-refs-self") ?? "";
  const uuid = block.getAttribute("blockid") ?? "";

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

  const entryBlock = editor.closest<HTMLElement>(".ls-block");
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

function registerBoardUuid(uuid?: string): void {
  if (!uuid || knownBoardUuids.has(uuid)) return;
  knownBoardUuids.add(uuid);
  logseq.provideStyle({
    key: "plus-minus-next-board-styles",
    style: createStyles([...knownBoardUuids])
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

async function maintainCurrentPageBoards(): Promise<void> {
  if (maintenanceRunning) return;
  maintenanceRunning = true;

  try {
    const blocks =
      (await logseq.Editor.getCurrentPageBlocksTree()) as BoardBlock[];

    async function visit(block: BoardBlock): Promise<void> {
      if (block.content?.includes(BOARD_TAG) && block.children) {
        registerBoardUuid(block.uuid);

        for (const column of block.children.slice(0, 3)) {
          const legacy = legacyColumns.find(
            ({ contents }) =>
              column.content !== undefined && contents.includes(column.content)
          );

          if (legacy && column.uuid) {
            await logseq.Editor.updateBlock(column.uuid, legacy.replacement);
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
    const currentBlock = await logseq.Editor.getCurrentBlock();
    let board;

    if (currentBlock?.uuid) {
      const canReuseCurrentBlock =
        reuseEmptyCurrentBlock && currentBlock.content.trim() === "";

      if (canReuseCurrentBlock) {
        await logseq.Editor.updateBlock(currentBlock.uuid, BOARD_TITLE);
        board = await logseq.Editor.getBlock(currentBlock.uuid);
      } else {
        board = await logseq.Editor.insertBlock(currentBlock.uuid, BOARD_TITLE, {
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
        BOARD_TITLE
      );
    }

    if (!board?.uuid) {
      throw new Error("Logseq did not return the new board block.");
    }

    // Register a UUID selector immediately. Unlike Logseq's tag-derived DOM
    // metadata, the block UUID is present consistently during editor updates.
    registerBoardUuid(board.uuid);

    // Finish the slash-command editor before adding children. This makes
    // Logseq render the tag-derived data-refs-self marker immediately, which
    // activates the three-column CSS without a timing race.
    await logseq.Editor.exitEditingMode();

    await logseq.Editor.insertBatchBlock(board.uuid, columns, {
      sibling: false
    });

    // Ensure focus restored by the slash-command host cannot leave the parent
    // in its unrendered editing state.
    await logseq.Editor.exitEditingMode();

  } catch (error) {
    console.error("[Plus Minus Next] Could not insert board", error);
    logseq.UI.showMsg(
      "The Plus / Minus / Next board could not be inserted. See the developer console for details.",
      "error"
    );
  }
}

async function main(): Promise<void> {
  logseqDocument = getLogseqDocument();
  logseqDocument.addEventListener(
    "keydown",
    keepEmptyEntryInsideColumn as EventListener,
    true
  );
  logseq.beforeunload(async () => {
    logseqDocument?.removeEventListener(
      "keydown",
      keepEmptyEntryInsideColumn as EventListener,
      true
    );
  });

  logseq.provideStyle({
    key: "plus-minus-next-board-styles",
    style: createStyles()
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
  );

  logseq.Editor.registerSlashCommand(
    "Plus Minus Next: Insert reflection board",
    () => insertBoard(true)
  );

  await maintainCurrentPageBoards().catch((error) => {
    console.warn("[Plus Minus Next] Could not upgrade this page", error);
  });

  logseq.App.onRouteChanged(() => {
    scheduleBoardMaintenance(100);
  });

  logseq.DB.onChanged(() => {
    scheduleBoardMaintenance();
  });

  console.info("[Plus Minus Next] Plugin loaded");
}

logseq.ready(main).catch((error) => {
  console.error("[Plus Minus Next] Failed to start", error);
});
