import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { KeyValueStore } from "@universal-ui/core"
import { Effect, Option } from "effect"
import {
  makeBrowserStoreLayer,
  uiStyleToCss,
  type WebStorageLike
} from "../src/index.ts"

describe("@universal-ui/host-web", () => {
  it("translates universal flexbox and spacing shorthands to DOM CSS", () => {
    const css = uiStyleToCss("box", {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: "#D8CEBE",
      borderRadius: 8,
      fontWeight: "700"
    })
    assert.equal(css["display"], "flex")
    assert.equal(css["flexDirection"], "column")
    assert.equal(css["flex"], "1 1 0%")
    assert.equal(css["paddingLeft"], "16px")
    assert.equal(css["paddingRight"], "16px")
    assert.equal(css["paddingTop"], "8px")
    assert.equal(css["paddingBottom"], "8px")
    assert.equal(css["borderWidth"], "1px")
    assert.equal(css["borderStyle"], "solid")
    assert.equal(css["fontWeight"], "700")
  })

  it("sets scroll minHeight and avoids redundant button border/padding shorthands", () => {
    const scrollCss = uiStyleToCss("scroll", { flex: 1 })
    assert.equal(scrollCss["overflow"], "auto")
    assert.equal(scrollCss["minHeight"], "0px")

    const plainBtn = uiStyleToCss("button", undefined)
    assert.equal(plainBtn["borderStyle"], "none")
    assert.equal(plainBtn["padding"], "0px")

    const styledBtn = uiStyleToCss("button", {
      borderWidth: 1,
      borderColor: "#111111",
      paddingHorizontal: 10
    })
    assert.equal(styledBtn["borderStyle"], "solid")
    assert.equal(styledBtn["borderWidth"], "1px")
    assert.equal(styledBtn["padding"], undefined)
    assert.equal(styledBtn["paddingLeft"], "10px")
  })

  it("adapts WebStorageLike to the KeyValueStore port with prefixing", async () => {
    const raw = new Map<string, string>()
    const fakeStorage: WebStorageLike = {
      getItem: (k) => raw.get(k) ?? null,
      setItem: (k, v) => {
        raw.set(k, v)
      },
      removeItem: (k) => {
        raw.delete(k)
      }
    }

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* KeyValueStore
        yield* store.set("state", "ok")
        const loaded = yield* store.get("state")
        yield* store.remove("state")
        const removed = yield* store.get("state")
        return { loaded, removed }
      }).pipe(
        Effect.provide(
          makeBrowserStoreLayer({ prefix: "demo.", storage: fakeStorage })
        )
      )
    )

    assert.deepEqual(result.loaded, Option.some("ok"))
    assert.deepEqual(result.removed, Option.none())
  })
})
