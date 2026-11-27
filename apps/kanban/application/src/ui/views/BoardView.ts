import type { Ui } from "@universal-ui/core"
import {
  WorkspaceModeSchema,
  type BoardScreenSnapshot
} from "../../state/index.ts"
import {
  FolioAppMessage as Msg,
  type FolioAppMessage,
  type FolioAppProps
} from "../FolioApp.ts"
import { CardEditor } from "../components/CardEditor.ts"
import { paletteFor } from "../theme.ts"
import { columnsBoardView } from "./ColumnsBoardView.ts"
import { tabsBoardView } from "./TabsBoardView.ts"

export const boardView = (
  h: Ui.H<FolioAppMessage, FolioAppProps>,
  screen: BoardScreenSnapshot
) => {
  const p = paletteFor(screen.theme)
  const isTabs = screen.layout === "tabs"
  const editorDraft = WorkspaceModeSchema.guards.EditingCard(screen.workspaceMode)
    ? screen.workspaceMode.draft
    : undefined

  const renderEditor = (mode: "modal" | "screen") =>
    editorDraft !== undefined &&
    CardEditor(h, {
      key: editorDraft.cardId,
      props: {
        draft: editorDraft,
        theme: screen.theme,
        mode
      },
      onEmit: {
        Saved: ({ draft, title }) => Msg.SavedEditedCard({ draft, title }),
        Deleted: ({ cardId }) => Msg.ClickedDeleteCard({ cardId }),
        Cancelled: () => Msg.CancelledEditCard()
      }
    })

  if (isTabs && editorDraft !== undefined) {
    return h.box
      .testId("board.root")
      .style({
        flex: 1,
        width: "100%",
        height: "100%",
        paddingTop: screen.topInset,
        backgroundColor: p.canvas
      })
      .children(renderEditor("screen"))
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
      !isTabs && renderEditor("modal")
    )
}
