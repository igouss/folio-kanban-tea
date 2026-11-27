import { paletteFor } from "@folio/kanban-domain/theme"
import type { Ui } from "@universal-ui/core"
import { Option } from "effect"
import type {
  FolioAppMessage,
  FolioAppModel,
  FolioAppProps
} from "../FolioApp.ts"
import { columnsBoardView } from "./ColumnsBoardView.ts"
import { editorView } from "./EditorView.ts"
import { tabsBoardView } from "./TabsBoardView.ts"

export const boardView = (
  h: Ui.H<FolioAppMessage, FolioAppProps>,
  model: FolioAppModel
) => {
  const p = paletteFor(model.theme)
  const isTabs = h.props.layout === "tabs"

  if (isTabs && Option.isSome(model.editDraft)) {
    return h.box
      .testId("board.root")
      .style({
        flex: 1,
        width: "100%",
        height: "100%",
        paddingTop: h.props.topInset,
        backgroundColor: p.canvas
      })
      .children(editorView(h, model.editDraft.value, model.notice, p, "screen"))
  }

  return h.box
    .testId("board.root")
    .style({
      position: "relative",
      flex: 1,
      width: "100%",
      height: "100%",
      paddingTop: h.props.topInset,
      backgroundColor: p.canvas,
      color: p.ink,
      fontSize: 13
    })
    .children(
      isTabs
        ? tabsBoardView(h, model, p)
        : columnsBoardView(h, model, p),
      !isTabs &&
        Option.match(model.editDraft, {
          onNone: () => false,
          onSome: (draft) => editorView(h, draft, model.notice, p, "modal")
        })
    )
}
