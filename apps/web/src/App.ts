import { PlusIcon, TerminalIcon } from "#components/Icons"
import {
  ClearTraces,
  InspectorDrawer,
  LoadTraceSnapshot
} from "#components/InspectorDrawer"
import { Command, Component, Head, Router, UiSchema } from "@effect/ui"
import { Html, HtmlHead, HtmlSubscription } from "@effect/ui/html"
import { Layer, Schema } from "effect"
import { BoardPage } from "./pages/BoardPage.ts"
import { NewTaskPage } from "./pages/new/NewTaskPage.ts"
import { TaskDetailPage } from "./pages/tasks/TaskDetailPage.ts"
import { AppRoute } from "./routes.ts"

const boardRoute = AppRoute.Board()
const newTaskRoute = AppRoute.NewTask()

export const AppMessage = UiSchema.TaggedEnum({
  ChangedRoute: { route: AppRoute },
  ClickedToggleInspector: {},
  ClosedInspector: {},
  PressedNewCardShortcut: {},
  ClickedBackToBoard: {}
})

const transitionDirection = (
  from: AppRoute,
  to: AppRoute
): ReadonlyArray<string> => {
  if (from._tag === "Board" && (to._tag === "TaskDetail" || to._tag === "NewTask")) {
    return ["forward"]
  }
  if ((from._tag === "TaskDetail" || from._tag === "NewTask") && to._tag === "Board") {
    return ["back"]
  }
  return []
}

const AppNoDeps = Html.component({
  name: "App",
  props: Schema.Struct({ route: AppRoute }),
  model: Schema.Struct({
    route: AppRoute,
    inspectorOpen: Schema.Boolean
  }),
  message: AppMessage,
  restore: (model) => ({ ...model, inspectorOpen: false })
}).make({
  init: ($) => ({
    route: $.props.route,
    inspectorOpen: false
  }),
  update: {
    ChangedRoute: ($, { route }) =>
      $.evolve({ route }).viewTransition(transitionDirection($.model.route, route)),
    ClickedToggleInspector: ($) =>
      $.evolve({ inspectorOpen: (open) => !open }),
    ClosedInspector: ($) => $.evolve({ inspectorOpen: false }),
    PressedNewCardShortcut: ($) =>
      $.run(Router.push(AppRoute, newTaskRoute).pipe(Command.asNoop)),
    ClickedBackToBoard: ($) =>
      $.run(Router.push(AppRoute, boardRoute).pipe(Command.asNoop))
  },
  subscriptions: ({ model }) => [
    Router.subscription(AppRoute, model.route, (route) =>
      AppMessage.ChangedRoute({ route })
    ),
    HtmlSubscription.shortcuts([
      { key: "i", message: AppMessage.ClickedToggleInspector() },
      { key: "n", message: AppMessage.PressedNewCardShortcut() }
    ])
  ],
  head: () => [
    Head.titleTemplate((title) => `${title} · Folio Kanban`),
    HtmlHead.lang("en")
  ],
  view: (h, model) =>
    h.div.class("app-frame", model.inspectorOpen && "has-inspector").children(
      h.header.class("topbar").children(
        h.div.class("topbar-left").children(
          h.a
            .class("brand-mark")
            .attr("href", AppRoute.print(boardRoute))
            .children(
              h.span.class("brand-dot"),
              h.span.class("brand-name").children("Folio"),
              h.span.class("brand-badge").children("@effect/ui")
            ),
          h.nav.class("topbar-nav").attr("aria-label", "Primary").children(
            h.a
              .class("nav-link", model.route._tag === "Board" && "is-active")
              .attr("href", AppRoute.print(boardRoute))
              .children("Board"),
            h.a
              .class("nav-link", model.route._tag === "NewTask" && "is-active")
              .attr("href", AppRoute.print(newTaskRoute))
              .children("New Card")
          )
        ),
        h.div.class("topbar-right").children(
          h.button
            .class("inspector-toggle-btn", model.inspectorOpen && "is-active")
            .attrs({
              type: "button",
              title: "Toggle live MVU MessageLog inspector (press I)"
            })
            .on("click", AppMessage.ClickedToggleInspector())
            .children(
              TerminalIcon(h, 14),
              h.span("MVU Trace"),
              h.kbd.class("key-hint").children("I")
            ),
          h.a
            .class("primary-btn small")
            .attr("href", AppRoute.print(newTaskRoute))
            .children(
              PlusIcon(h, 14),
              h.span("New card"),
              h.kbd.class("key-hint dark").children("N")
            )
        )
      ),
      h.div.class("workspace-body").children(
        h.main.class("workspace-main").children(
          AppRoute.match(model.route, {
            Board: (route) =>
              BoardPage(h, {
                key: AppRoute.printPath(route),
                props: { route }
              }),
            NewTask: (route) =>
              NewTaskPage(h, {
                key: AppRoute.printPath(route),
                props: { route }
              }),
            TaskDetail: (route) =>
              TaskDetailPage(h, {
                key: AppRoute.printPath(route),
                props: { id: route.params.id }
              }),
            NotFound: () =>
              h.section.class("state-panel").children(
                h.h1.class("state-title").children("Route not found"),
                h.p.class("state-sub").children(
                  "This URL did not match any route in AppRoute."
                ),
                h.button
                  .class("primary-btn")
                  .attr("type", "button")
                  .on("click", AppMessage.ClickedBackToBoard())
                  .children("Back to Kanban board")
              )
          })
        ),
        model.inspectorOpen &&
          InspectorDrawer(h, {
            onEmit: {
              RequestedClose: () => AppMessage.ClosedInspector()
            }
          })
      )
    )
})

export const App = AppNoDeps.pipe(
  Component.provide(Layer.merge(LoadTraceSnapshot.layer, ClearTraces.layer))
)
