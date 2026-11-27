import type { Ui } from "@universal-ui/core"
import type { BoardScreenSnapshot } from "../../state/index.ts"
import type { FolioPalette as Palette } from "../theme.ts"
import { FolioAppMessage as Msg, type FolioAppMessage } from "../FolioApp.ts"
import { secondaryButtonStyle } from "./controls.ts"

export const inspectorPanel = (
  h: Ui.H<FolioAppMessage>,
  screen: BoardScreenSnapshot,
  p: Palette
) =>
  h.box
    .testId("inspector.panel")
    .role("complementary")
    .ariaLabel("MVU Runtime Trace")
    .style({
      width: 280,
      minWidth: 260,
      height: "100%",
      flexDirection: "column",
      backgroundColor: p.topbar,
      borderLeftWidth: 1,
      borderColor: p.rule
    })
    .children(
      h.box
        .style({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderBottomWidth: 1,
          borderColor: p.rule
        })
        .children(
          h.text
            .style({ fontSize: 12.5, fontWeight: "700", color: p.ink })
            .children(`MVU Trace (${screen.dispatchCount})`),
          h.button
            .testId("inspector.close")
            .ariaLabel("Close MVU trace")
            .style(secondaryButtonStyle(p, 8))
            .on("press", Msg.ClickedToggleInspector())
            .children(
              h.text
                .style({ fontSize: 11, fontWeight: "600", color: p.inkSoft })
                .children("Close")
            )
        ),
      h.box
        .style({
          flexDirection: "row",
          justifyContent: "space-between",
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderBottomWidth: 1,
          borderColor: p.rule,
          backgroundColor: p.surfaceAlt
        })
        .children(
          h.text
            .style({ fontSize: 11, fontWeight: "600", color: p.inkSoft })
            .children(`Undo stack: ${screen.undoDepth}`),
          h.text
            .style({ fontSize: 11, fontWeight: "600", color: p.inkSoft })
            .children(`Redo stack: ${screen.redoDepth}`)
        ),
      h.scroll
        .style({
          flex: 1,
          padding: 12
        })
        .children(
          h.box
            .collapsable(false)
            .style({ flexDirection: "column", gap: 6 })
            .children(
              screen.traceEntries.length === 0
                ? h.text
                    .style({ fontSize: 11.5, color: p.inkMuted })
                    .children("Interact with the board to stream pure TEA messages.")
                : screen.traceEntries.map((entry, idx) =>
                    h.box
                      .key(`trace-${idx}`)
                      .style({
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: p.rule,
                        backgroundColor: p.card
                      })
                      .children(
                        h.text
                          .style({ fontSize: 11, color: p.inkSoft })
                          .children(entry)
                      )
                  )
            )
        )
    )
