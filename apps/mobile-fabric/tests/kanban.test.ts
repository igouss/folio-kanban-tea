import { FabricHost } from "@folio/effect-ui-fabric"
import { attachStyles } from "@folio/effect-ui-fabric/css"
import { appState } from "@folio/effect-ui-fabric/subscription"
import {
  createFakeFabric,
  fakeAppState,
  manualFrames,
  type FakeFabricNode
} from "@folio/effect-ui-fabric/testing"
import {
  FolioApp,
  makeAppLayer,
  makeLifecycleLayer,
  mobileAppProps
} from "@folio/folio-app"
import { Engine } from "@ng-native/fabric"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import tailwind from "../.tailwind/app.tailwind.js"

beforeEach(() => {
  fakeAppState.set("active")
})

afterEach(() => {
  fakeAppState.set("active")
})

const findByTestID = (
  nodes: ReadonlyArray<FakeFabricNode>,
  testID: string
): FakeFabricNode | undefined => {
  for (const node of nodes) {
    const hit =
      node.props["testID"] === testID
        ? node
        : findByTestID(node.children, testID)
    if (hit !== undefined) return hit
  }
  return undefined
}

const setup = () => {
  const fabric = createFakeFabric()
  const conditions = {
    width: 390,
    height: 844,
    colorScheme: "light" as const,
    fontScale: 1
  }
  const engine = new Engine(fabric, 1, {
    processColor: (value) => value,
    globalStyles: tailwind,
    conditions
  })
  attachStyles(engine, { platform: "ios", conditions })
  const frames = manualFrames()
  const app = FabricHost.mountApp(FolioApp, mobileAppProps(), engine, {
    platform: "ios",
    requestAnimationFrame: frames.requestAnimationFrame,
    layer: makeAppLayer({ lifecycle: makeLifecycleLayer(appState) })
  })

  const settle = async (isSettled: () => boolean): Promise<number> => {
    const before = fabric.calls.completeRoot
    await vi.waitFor(() => {
      frames.flush()
      expect(isSettled()).toBe(true)
    })
    return fabric.calls.completeRoot - before
  }

  const byTestID = (testID: string): FakeFabricNode | undefined =>
    findByTestID(fabric.committed, testID)

  const tap = (testID: string): void => {
    const node = byTestID(testID)
    if (node === undefined) {
      throw new Error(`Nothing committed with testID ${testID}`)
    }
    const point = {
      identifier: 0,
      target: node.reactTag,
      pageX: 5,
      pageY: 5,
      timestamp: 0
    }
    fabric.emit(node, "topTouchStart", {
      ...point,
      touches: [point],
      changedTouches: [point]
    })
    fabric.emit(node, "topTouchEnd", {
      ...point,
      touches: [],
      changedTouches: [point]
    })
  }

  const typeIn = (testID: string, text: string, eventCount: number): void => {
    const node = byTestID(testID)
    if (node === undefined) {
      throw new Error(`No TextInput committed with testID ${testID}`)
    }
    fabric.emit(node, "topChange", { text, eventCount, target: node.reactTag })
  }

  const hasText = (text: string) => () =>
    fabric.render().includes(`RawText "${text}"`)

  return { fabric, app, settle, byTestID, tap, typeIn, hasText }
}

describe("Folio Kanban Mobile (Unified @folio/folio-app on React Native Fabric)", () => {
  it("mounts unified FolioApp onto native Fabric views, switches lanes in 1 commit, and moves a card", async () => {
    const { fabric, app, settle, byTestID, tap, hasText } = setup()

    await settle(hasText("Share pure TEA domain across Web, Desktop GPU & Mobile"))
    expect(byTestID("board.scroll")).toBeDefined()

    // Switch to Backlog tab in a single Fabric commit
    tap("lane.tab.backlog")
    expect(
      await settle(hasText("Enforce WIP limits across all delivery targets"))
    ).toBe(1)

    // Switch back to In Progress and move FOL-101 to In Review
    tap("lane.tab.in_progress")
    await settle(() => byTestID("card.next.card-101") !== undefined)
    tap("card.next.card-101")
    await settle(hasText("Moved FOL-101 to In Review."))
    expect(byTestID("card.card-101")).toBeUndefined()

    // Check card landed in In Review
    tap("lane.tab.review")
    await settle(() => byTestID("card.card-101") !== undefined)
    expect(fabric.render()).toContain('RawText "FOL-101"')

    // Undo restores FOL-101 back to In Progress
    tap("board.undo")
    await settle(hasText("Undid last change."))
    tap("lane.tab.in_progress")
    await settle(() => byTestID("card.card-101") !== undefined)
    app.dispose()
  })

  it("creates a new card via native Fabric TextInput and filters with Search", async () => {
    const { app, settle, byTestID, tap, typeIn, hasText } = setup()

    await settle(() => byTestID("quick.input") !== undefined)
    typeIn("quick.input", "Ship @effect/ui on Fabric", 1)
    await settle(
      () => byTestID("quick.input")?.props["text"] === "Ship @effect/ui on Fabric"
    )

    tap("quick.submit")
    await settle(hasText("Ship @effect/ui on Fabric"))
    expect(byTestID("quick.input")?.props["text"]).toBe("")

    // Filter down to the newly created card (title splits into inline VirtualText highlight segments)
    typeIn("board.search", "Fabric", 1)
    await settle(() => byTestID("card.card-101") === undefined)
    expect(byTestID("card.mobile-card-1")).toBeDefined()
    expect(hasText("Ship @effect/ui on ")()).toBe(true)
    expect(hasText("Fabric")()).toBe(true)
    app.dispose()
  })

  it("opens full-screen Card Editor, edits title via controlled TextInput, and saves back to Board", async () => {
    const { app, settle, byTestID, tap, typeIn, hasText } = setup()

    await settle(() => byTestID("card.open.card-101") !== undefined)
    tap("card.open.card-101")
    await settle(() => byTestID("editor.title") !== undefined)

    typeIn("editor.title", "Effect UI Fabric verified", 1)
    await settle(
      () => byTestID("editor.title")?.props["text"] === "Effect UI Fabric verified"
    )

    tap("editor.lane.done")
    tap("editor.save")
    await settle(hasText("Saved FOL-101."))
    expect(hasText("Effect UI Fabric verified")()).toBe(true)
    app.dispose()
  })

  it("tracks native AppState background/foreground transitions via @folio/folio-app AppLifecycle", async () => {
    const { app, settle, hasText } = setup()

    await settle(hasText("@effect/ui · active"))
    fakeAppState.set("background")
    await settle(hasText("@effect/ui · background (1)"))
    fakeAppState.set("active")
    await settle(hasText("@effect/ui · active (1)"))
    app.dispose()
  })
})
