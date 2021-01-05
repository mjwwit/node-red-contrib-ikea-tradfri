import * as t from 'io-ts'

export const messageType = t.type(
  {
    _msgid: t.string,
  },
  'NodeMessage'
)
