import { Array } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'
import type { Priority } from '../domain.ts'
import { Message } from '../message.ts'
import type { EditDraft, Model } from '../model.ts'

const PRIORITIES: ReadonlyArray<{
  readonly value: Priority
  readonly label: string
}> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const POINT_CHOICES: ReadonlyArray<number> = [1, 2, 3, 5, 8, 13]

export const editorModal = (
  model: Model,
  draft: EditDraft,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('modal-overlay'), h.Role('dialog'), h.AriaLabel(`Edit ${draft.code}`)],
    [
      h.form(
        [h.Class('modal-card'), h.OnSubmit(Message.SubmittedEditCard())],
        [
          h.div(
            [h.Class('modal-header')],
            [
              h.h2([h.Class('modal-title')], [`Edit ${draft.code}`]),
              h.button(
                [
                  h.Type('button'),
                  h.Class('btn'),
                  h.OnClick(Message.CancelledEditCard()),
                ],
                ['Close'],
              ),
            ],
          ),
          h.div(
            [h.Class('field-group')],
            [
              h.span([h.Class('field-label')], ['TITLE']),
              h.input([
                h.Class('field-input'),
                h.Value(draft.title),
                h.OnInput((value) => Message.ChangedEditTitle({ value })),
              ]),
            ],
          ),
          h.div(
            [h.Class('field-group')],
            [
              h.span([h.Class('field-label')], ['LANE']),
              h.div(
                [h.Class('segmented')],
                Array.map(model.columns, (col) =>
                  h.keyed('button')(
                    col.id,
                    [
                      h.Type('button'),
                      h.Class(
                        draft.columnId === col.id
                          ? 'seg-btn is-active'
                          : 'seg-btn',
                      ),
                      h.OnClick(
                        Message.ChangedEditColumn({ columnId: col.id }),
                      ),
                    ],
                    [col.name],
                  ),
                ),
              ),
            ],
          ),
          h.div(
            [h.Class('field-row')],
            [
              h.div(
                [h.Class('field-col')],
                [
                  h.span([h.Class('field-label')], ['PRIORITY']),
                  h.div(
                    [h.Class('segmented')],
                    Array.map(PRIORITIES, (p) =>
                      h.keyed('button')(
                        p.value,
                        [
                          h.Type('button'),
                          h.Class(
                            draft.priority === p.value
                              ? 'seg-btn is-active'
                              : 'seg-btn',
                          ),
                          h.OnClick(
                            Message.ChangedEditPriority({ priority: p.value }),
                          ),
                        ],
                        [p.label],
                      ),
                    ),
                  ),
                ],
              ),
              h.div(
                [h.Class('field-col')],
                [
                  h.span([h.Class('field-label')], ['ASSIGNEE']),
                  h.input([
                    h.Class('field-input'),
                    h.Value(draft.assignee),
                    h.OnInput((value) => Message.ChangedEditAssignee({ value })),
                  ]),
                ],
              ),
            ],
          ),
          h.div(
            [h.Class('field-group')],
            [
              h.span([h.Class('field-label')], ['STORY POINTS']),
              h.div(
                [h.Class('segmented')],
                Array.map(POINT_CHOICES, (pt) =>
                  h.keyed('button')(
                    `${pt}`,
                    [
                      h.Type('button'),
                      h.Class(
                        draft.points === pt ? 'seg-btn is-active' : 'seg-btn',
                      ),
                      h.OnClick(Message.ChangedEditPoints({ points: pt })),
                    ],
                    [`${pt}pt`],
                  ),
                ),
              ),
            ],
          ),
          h.div(
            [h.Class('field-group')],
            [
              h.span([h.Class('field-label')], ['NOTES']),
              h.textarea([
                h.Class('field-textarea'),
                h.Value(draft.notes),
                h.OnInput((value) => Message.ChangedEditNotes({ value })),
              ]),
            ],
          ),
          h.div(
            [h.Class('modal-actions')],
            [
              h.button(
                [
                  h.Type('button'),
                  h.Class('btn btn-danger'),
                  h.OnClick(
                    Message.ClickedDeleteCard({
                      cardId: draft.cardId,
                      columnId: draft.columnId,
                    }),
                  ),
                ],
                ['Delete card'],
              ),
              h.div(
                [h.Class('modal-actions-right')],
                [
                  h.button(
                    [
                      h.Type('button'),
                      h.Class('btn'),
                      h.OnClick(Message.CancelledEditCard()),
                    ],
                    ['Cancel'],
                  ),
                  h.button(
                    [h.Type('submit'), h.Class('btn btn-primary')],
                    ['Save card'],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  )
