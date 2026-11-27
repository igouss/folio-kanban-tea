export type AppStateStatus =
  | "active"
  | "background"
  | "inactive"
  | "unknown"
  | "extension"

export interface AppStateSource {
  readonly currentState: string
  readonly addEventListener: (
    type: "change",
    listener: (state: AppStateStatus) => void
  ) => { readonly remove: () => void }
}
