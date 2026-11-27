import type { Html } from "@effect/ui/html"

const baseSvg = <M>(h: Html.H<M>, size = 16) =>
  h.svg
    .class("icon")
    .attrs({
      width: String(size),
      height: String(size),
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.9",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true"
    })

export const PlusIcon = <M>(h: Html.H<M>, size = 16) =>
  baseSvg(h, size).children(
    h.path.attr("d", "M12 5v14"),
    h.path.attr("d", "M5 12h14")
  )

export const ArrowLeftIcon = <M>(h: Html.H<M>, size = 14) =>
  baseSvg(h, size).children(
    h.path.attr("d", "M15 18l-6-6 6-6")
  )

export const ArrowRightIcon = <M>(h: Html.H<M>, size = 14) =>
  baseSvg(h, size).children(
    h.path.attr("d", "M9 18l6-6-6-6")
  )

export const TrashIcon = <M>(h: Html.H<M>, size = 14) =>
  baseSvg(h, size).children(
    h.path.attr("d", "M3 6h18"),
    h.path.attr("d", "M8 6V4h8v2"),
    h.path.attr("d", "M19 6l-1 14H6L5 6")
  )

export const TerminalIcon = <M>(h: Html.H<M>, size = 15) =>
  baseSvg(h, size).children(
    h.path.attr("d", "M4 17l6-6-6-6"),
    h.path.attr("d", "M12 19h8")
  )

export const CloseIcon = <M>(h: Html.H<M>, size = 16) =>
  baseSvg(h, size).children(
    h.path.attr("d", "M18 6L6 18"),
    h.path.attr("d", "M6 6l12 12")
  )

export const SearchIcon = <M>(h: Html.H<M>, size = 15) =>
  baseSvg(h, size).children(
    h.circle.attrs({ cx: "11", cy: "11", r: "7" }),
    h.path.attr("d", "M20 20l-3.5-3.5")
  )

export const RefreshIcon = <M>(h: Html.H<M>, size = 14) =>
  baseSvg(h, size).children(
    h.path.attr("d", "M21 12a9 9 0 1 1-2.64-6.36"),
    h.path.attr("d", "M21 3v6h-6")
  )

export const CheckIcon = <M>(h: Html.H<M>, size = 14) =>
  baseSvg(h, size).children(
    h.path.attr("d", "M5 13l4 4L19 7")
  )

export const GripIcon = <M>(h: Html.H<M>, size = 14) =>
  baseSvg(h, size).children(
    h.circle.attrs({ cx: "9", cy: "6", r: "1", fill: "currentColor" }),
    h.circle.attrs({ cx: "15", cy: "6", r: "1", fill: "currentColor" }),
    h.circle.attrs({ cx: "9", cy: "12", r: "1", fill: "currentColor" }),
    h.circle.attrs({ cx: "15", cy: "12", r: "1", fill: "currentColor" }),
    h.circle.attrs({ cx: "9", cy: "18", r: "1", fill: "currentColor" }),
    h.circle.attrs({ cx: "15", cy: "18", r: "1", fill: "currentColor" })
  )
