import assert from "node:assert/strict"
import { describe, it } from "node:test"
import * as WebHost from "@folio/effect-ui-universal/web"
import {
  FolioApp,
  makeAppLayer,
  makeMemoryStorageLayer,
  webAppProps
} from "@folio/folio-app"
import { canRedoHistory, canUndoHistory, cardsInLane } from "@folio/kanban-core"
import { Effect } from "effect"

interface FakeNode {
  readonly nodeType: number
  readonly tagName: string
  readonly ownerDocument: FakeDocument
  parentNode: FakeNode | null
  readonly childNodes: Array<FakeNode>
  nodeValue: string | null
  value: string
  disabled: boolean
  isConnected: boolean
  readonly style: Record<string, string>
  readonly attrs: Map<string, string>
  readonly listeners: Map<string, Set<(event: any) => void>>
  readonly nextSibling: FakeNode | null
  setAttribute(name: string, value: string): void
  getAttribute(name: string): string | null
  removeAttribute(name: string): void
  insertBefore(child: FakeNode, ref: FakeNode | null): FakeNode
  removeChild(child: FakeNode): FakeNode
  addEventListener(type: string, listener: (event: any) => void): void
  removeEventListener(type: string, listener: (event: any) => void): void
  dispatch(type: string, event?: Record<string, unknown>): void
  focus(): void
}

interface FakeDocument {
  title: string
  createElement(tag: string): FakeNode
  createTextNode(text: string): FakeNode
  createDocumentFragment(): FakeNode
}

const createFakeDom = (): {
  readonly doc: FakeDocument
  readonly container: FakeNode
  readonly findByTestId: (id: string) => FakeNode | undefined
  readonly findByRole: (role: string, name?: string) => FakeNode | undefined
  readonly textContent: (node?: FakeNode) => string
} => {
  const makeNode = (nodeType: number, tagName: string, text = ""): FakeNode => {
    const node: FakeNode = {
      nodeType,
      tagName,
      ownerDocument: doc,
      parentNode: null,
      childNodes: [],
      nodeValue: nodeType === 3 ? text : null,
      value: "",
      disabled: false,
      isConnected: true,
      style: {},
      attrs: new Map(),
      listeners: new Map(),
      get nextSibling(): FakeNode | null {
        if (node.parentNode === null) return null
        const idx = node.parentNode.childNodes.indexOf(node)
        return idx >= 0 ? (node.parentNode.childNodes[idx + 1] ?? null) : null
      },
      setAttribute(name, value) {
        node.attrs.set(name, value)
      },
      getAttribute(name) {
        return node.attrs.get(name) ?? null
      },
      removeAttribute(name) {
        node.attrs.delete(name)
      },
      insertBefore(child, ref) {
        if (child.parentNode !== null) {
          const prev = child.parentNode.childNodes.indexOf(child)
          if (prev >= 0) child.parentNode.childNodes.splice(prev, 1)
        }
        child.parentNode = node
        if (ref === null) {
          node.childNodes.push(child)
        } else {
          const idx = node.childNodes.indexOf(ref)
          if (idx >= 0) node.childNodes.splice(idx, 0, child)
          else node.childNodes.push(child)
        }
        return child
      },
      removeChild(child) {
        const idx = node.childNodes.indexOf(child)
        if (idx >= 0) node.childNodes.splice(idx, 1)
        child.parentNode = null
        return child
      },
      addEventListener(type, listener) {
        let set = node.listeners.get(type)
        if (set === undefined) {
          set = new Set()
          node.listeners.set(type, set)
        }
        set.add(listener)
      },
      removeEventListener(type, listener) {
        node.listeners.get(type)?.delete(listener)
      },
      dispatch(type, event = {}) {
        const set = node.listeners.get(type)
        if (set === undefined) return
        for (const fn of [...set]) {
          fn({ preventDefault: () => {}, ...event })
        }
      },
      focus() {}
    }
    return node
  }

  const doc: FakeDocument = {
    title: "",
    createElement: (tag) => makeNode(1, tag.toUpperCase()),
    createTextNode: (text) => makeNode(3, "#text", text),
    createDocumentFragment: () => makeNode(11, "#fragment")
  }

  const container = doc.createElement("div")

  const walk = (
    node: FakeNode,
    predicate: (candidate: FakeNode) => boolean
  ): FakeNode | undefined => {
    if (predicate(node)) return node
    for (const child of node.childNodes) {
      const hit = walk(child, predicate)
      if (hit !== undefined) return hit
    }
    return undefined
  }

  const textContent = (node: FakeNode = container): string => {
    if (node.nodeType === 3) return node.nodeValue ?? ""
    return node.childNodes.map((child) => textContent(child)).join("")
  }

  return {
    doc,
    container,
    findByTestId: (id) =>
      walk(container, (n) => n.getAttribute("data-testid") === id),
    findByRole: (role, name) =>
      walk(
        container,
        (n) =>
          n.getAttribute("role") === role &&
          (name === undefined || n.getAttribute("aria-label") === name)
      ),
    textContent
  }
}

const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 15))

const waitFor = async (predicate: () => boolean, timeoutMs = 500): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() >= deadline) break
    await tick()
  }
}

describe("Folio Kanban Web (Unified @folio/folio-app on WebHost DOM)", () => {
  it("mounts FolioApp onto DOM, syncs document.title, exposes UI SDK ARIA, and handles full board lifecycle", async () => {
    const dom = createFakeDom()
    const storage = makeMemoryStorageLayer()

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const root = yield* WebHost.mountEffect(
            FolioApp,
            webAppProps(),
            dom.container as unknown as Element
          )

          assert.ok(dom.doc.title.includes("Web · DOM Host"))
          assert.ok(dom.doc.title.includes("8 cards"))
          assert.ok(dom.textContent().includes("Folio Kanban"))
          assert.ok(
            dom.findByRole("radiogroup", "Filter by priority") !== undefined
          )
          assert.ok(
            dom.findByRole("progressbar", "Sprint velocity") !== undefined
          )
          assert.ok(
            dom.findByRole("region", "Folio Kanban board") !== undefined
          )

          // Move FOL-101 from In Progress to In Review via DOM click
          const moveBtn = dom.findByTestId("card.next.card-101")
          assert.ok(moveBtn)
          moveBtn.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => storage.getSaved() !== undefined)
          )
          assert.equal(cardsInLane(root.model()!.cards, "review")[0]?.id, "card-101")

          // Toggle Paper -> Graphite theme
          const themeBtn = dom.findByTestId("theme.toggle")
          assert.ok(themeBtn)
          themeBtn.dispatch("click")
          yield* Effect.promise(() =>
            waitFor(() => storage.getSaved()?.theme === "graphite")
          )
          assert.equal(root.model()!.theme, "graphite")

          // Open MVU Trace inspector
          const inspectorBtn = dom.findByTestId("board.inspector")
          assert.ok(inspectorBtn)
          inspectorBtn.dispatch("click")
          yield* Effect.promise(tick)
          assert.ok(dom.findByTestId("inspector.panel") !== undefined)

          // Quick-add a card via DOM input + Enter submit
          dom.findByTestId("lane.add.backlog")!.dispatch("click")
          yield* Effect.promise(tick)
          const quickInput = dom.findByTestId("quick.input")!
          quickInput.value = "Ship unified Web DOM host"
          quickInput.dispatch("input")
          yield* Effect.promise(tick)
          quickInput.dispatch("keydown", { key: "Enter" })
          yield* Effect.promise(tick)

          assert.equal(root.model()!.cards.length, 9)
          assert.ok(dom.doc.title.includes("9 cards"))

          // Undo & Redo
          assert.equal(canUndoHistory(root.model()!.history), true)
          dom.findByTestId("board.undo")!.dispatch("click")
          yield* Effect.promise(tick)
          assert.equal(root.model()!.cards.length, 8)
          assert.equal(canRedoHistory(root.model()!.history), true)
          dom.findByTestId("board.redo")!.dispatch("click")
          yield* Effect.promise(tick)
          assert.equal(root.model()!.cards.length, 9)
        })
      ).pipe(Effect.provide(makeAppLayer({ storage: storage.layer })))
    )
  })
})
