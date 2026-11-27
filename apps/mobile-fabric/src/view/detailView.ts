import type { Html, NativeBuilder } from 'foldkit-native/view'
import { LANES, type Priority } from '../domain'
import { Message } from '../message'
import type { EditDraft } from '../model'
import type { Palette } from './palette'

const PRIORITIES: ReadonlyArray<{
  readonly value: Priority
  readonly label: string
}> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const POINTS: ReadonlyArray<number> = [1, 2, 3, 5, 8, 13]

export const detailView = (
  draft: EditDraft,
  statusBanner: string,
  p: Palette,
  n: NativeBuilder<Message>,
): Html =>
  n.view(
    [n.Key(`detail.${draft.cardId}`), n.Style({ flex: 1 })],
    [
      n.view(
        [
          n.Style({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: p.border,
          }),
        ],
        [
          n.pressable(
            [
              n.TestID('detail.back'),
              n.AccessibilityLabel('Back to board'),
              n.OnPress(Message.PressedBackToBoard()),
              n.Style({ paddingVertical: 6, paddingRight: 12 }),
            ],
            [
              n.text(
                [n.Style({ fontSize: 15, fontWeight: '700', color: p.accent })],
                ['‹ Board'],
              ),
            ],
          ),
          n.text(
            [n.Style({ fontSize: 15, fontWeight: '700', color: p.ink })],
            [draft.code],
          ),
          n.pressable(
            [
              n.TestID('detail.save'),
              n.AccessibilityLabel('Save card'),
              n.OnPress(Message.PressedSaveDraft()),
              n.Style({
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 7,
                backgroundColor: p.accent,
              }),
            ],
            [
              n.text(
                [n.Style({ fontSize: 13, fontWeight: '700', color: p.accentInk })],
                ['Save'],
              ),
            ],
          ),
        ],
      ),
      statusBanner.length > 0
        ? n.view(
            [
              n.Style({
                marginHorizontal: 16,
                marginTop: 10,
                padding: 10,
                borderRadius: 6,
                backgroundColor: p.accentSoft,
              }),
            ],
            [
              n.text(
                [n.Style({ fontSize: 12, fontWeight: '600', color: p.accent })],
                [statusBanner],
              ),
            ],
          )
        : null,
      n.scrollView(
        [n.Style({ flex: 1, paddingHorizontal: 16, paddingTop: 14 })],
        [
          n.view(
            [n.Style({ gap: 14, paddingBottom: 32 })],
            [
              n.view(
                [n.Style({ gap: 6 })],
                [
                  n.text(
                    [n.Style({ fontSize: 11, fontWeight: '700', color: p.inkMuted })],
                    ['TITLE'],
                  ),
                  n.textInput([
                    n.TestID('detail.title'),
                    n.Value(draft.title),
                    n.Placeholder('Card title'),
                    n.OnChangeText((text) => Message.ChangedDraftTitle({ text })),
                    n.Style({
                      fontSize: 16,
                      fontWeight: '600',
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: p.border,
                      backgroundColor: p.surface,
                      color: p.ink,
                    }),
                  ]),
                ],
              ),
              n.view(
                [n.Style({ gap: 6 })],
                [
                  n.text(
                    [n.Style({ fontSize: 11, fontWeight: '700', color: p.inkMuted })],
                    ['LANE'],
                  ),
                  n.view(
                    [n.Style({ flexDirection: 'row', gap: 6 })],
                    LANES.map((lane) => {
                      const active = draft.lane === lane.id
                      return n.pressable(
                        [
                          n.Key(lane.id),
                          n.TestID(`detail.lane.${lane.id}`),
                          n.OnPress(
                            Message.SelectedDraftLane({ lane: lane.id }),
                          ),
                          n.Style({
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 7,
                            alignItems: 'center',
                            backgroundColor: active ? p.ink : p.surface,
                            borderWidth: 1,
                            borderColor: active ? p.ink : p.border,
                          }),
                        ],
                        [
                          n.text(
                            [
                              n.Style({
                                fontSize: 12,
                                fontWeight: '700',
                                color: active ? p.surface : p.ink,
                              }),
                            ],
                            [lane.shortLabel],
                          ),
                        ],
                      )
                    }),
                  ),
                ],
              ),
              n.view(
                [n.Style({ gap: 6 })],
                [
                  n.text(
                    [n.Style({ fontSize: 11, fontWeight: '700', color: p.inkMuted })],
                    ['PRIORITY'],
                  ),
                  n.view(
                    [n.Style({ flexDirection: 'row', gap: 6 })],
                    PRIORITIES.map((opt) => {
                      const active = draft.priority === opt.value
                      return n.pressable(
                        [
                          n.Key(opt.value),
                          n.TestID(`detail.priority.${opt.value}`),
                          n.OnPress(
                            Message.SelectedDraftPriority({
                              priority: opt.value,
                            }),
                          ),
                          n.Style({
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 7,
                            alignItems: 'center',
                            backgroundColor: active ? p.accent : p.surface,
                            borderWidth: 1,
                            borderColor: active ? p.accent : p.border,
                          }),
                        ],
                        [
                          n.text(
                            [
                              n.Style({
                                fontSize: 12,
                                fontWeight: '700',
                                color: active ? p.accentInk : p.ink,
                              }),
                            ],
                            [opt.label],
                          ),
                        ],
                      )
                    }),
                  ),
                ],
              ),
              n.view(
                [n.Style({ gap: 6 })],
                [
                  n.text(
                    [n.Style({ fontSize: 11, fontWeight: '700', color: p.inkMuted })],
                    ['STORY POINTS'],
                  ),
                  n.view(
                    [n.Style({ flexDirection: 'row', gap: 6 })],
                    POINTS.map((pt) => {
                      const active = draft.points === pt
                      return n.pressable(
                        [
                          n.Key(pt),
                          n.TestID(`detail.points.${pt}`),
                          n.OnPress(Message.SelectedDraftPoints({ points: pt })),
                          n.Style({
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 7,
                            alignItems: 'center',
                            backgroundColor: active ? p.ink : p.surface,
                            borderWidth: 1,
                            borderColor: active ? p.ink : p.border,
                          }),
                        ],
                        [
                          n.text(
                            [
                              n.Style({
                                fontSize: 12,
                                fontWeight: '700',
                                color: active ? p.surface : p.ink,
                              }),
                            ],
                            [`${pt}`],
                          ),
                        ],
                      )
                    }),
                  ),
                ],
              ),
              n.view(
                [n.Style({ gap: 6 })],
                [
                  n.text(
                    [n.Style({ fontSize: 11, fontWeight: '700', color: p.inkMuted })],
                    ['ASSIGNEE'],
                  ),
                  n.textInput([
                    n.TestID('detail.assignee'),
                    n.Value(draft.assignee),
                    n.AutoCorrect(false),
                    n.AutoCapitalize('characters'),
                    n.OnChangeText((text) =>
                      Message.ChangedDraftAssignee({ text }),
                    ),
                    n.Style({
                      fontSize: 14,
                      padding: 11,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: p.border,
                      backgroundColor: p.surface,
                      color: p.ink,
                    }),
                  ]),
                ],
              ),
              n.view(
                [n.Style({ gap: 6 })],
                [
                  n.text(
                    [n.Style({ fontSize: 11, fontWeight: '700', color: p.inkMuted })],
                    ['NOTES'],
                  ),
                  n.textInput([
                    n.TestID('detail.notes'),
                    n.Value(draft.notes),
                    n.Placeholder('Implementation notes...'),
                    n.OnChangeText((text) => Message.ChangedDraftNotes({ text })),
                    n.Style({
                      fontSize: 14,
                      padding: 12,
                      minHeight: 80,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: p.border,
                      backgroundColor: p.surface,
                      color: p.ink,
                    }),
                  ]),
                ],
              ),
              n.pressable(
                [
                  n.TestID('detail.delete'),
                  n.AccessibilityLabel('Delete card'),
                  n.OnPress(Message.PressedDeleteCard({ cardId: draft.cardId })),
                  n.Style({
                    paddingVertical: 12,
                    borderRadius: 8,
                    backgroundColor: p.accentSoft,
                    alignItems: 'center',
                    marginTop: 6,
                  }),
                ],
                [
                  n.text(
                    [n.Style({ fontSize: 14, fontWeight: '700', color: p.accent })],
                    ['Delete Card'],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  )
