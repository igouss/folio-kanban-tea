import type { Ui } from "@universal-ui/core"
import type { BoardScreenSnapshot } from "../../state/index.ts"
import type { FolioAppMessage, FolioAppProps } from "../FolioApp.ts"
import { paletteFor } from "../theme.ts"
import { columnsBoardView } from "./ColumnsBoardView.ts"
import { editorView } from "./EditorView.ts"
import { tabsBoardView } from "./TabsBoardView.ts"

export const boardView = (
  h: Ui.H<FolioAppMessage, FolioAppProps>,
  screen: BoardScreenSnapshot
) => {
  const p = paletteFor(screen.theme)
  const isTabs = screen.layout === "tabs"

  if (isTabs && screen.editorDraft !== undefined) {
    return h.box
      .testId("board.root")
      .style({
        flex: 1,
        width: "100%",
        height: "100%",
        paddingTop: screen.topInset,
        backgroundColor: p.canvas
      })
      .children(editorView(h, screen.editorDraft, screen.notice, p, "screen"))
  }

  return h.box
    .testId("board.root")
    .style({
      position: "relative",
      flex: 1,
      width: "100%",
      height: "100%",
      paddingTop: screen.topInset,
      backgroundColor: p.canvas,
      color: p.ink,
      fontSize: 13
    })
    .children(
      isTabs
        ? tabsBoardView(h, screen, p)
        : columnsBoardView(h, screen, p),
      !isTabs &&
        screen.editorDraft !== undefined &&
        editorView(h, screen.editorDraft, screen.notice, p, "modal")
    )
}
