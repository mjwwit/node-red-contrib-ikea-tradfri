import { Node, NodeAPI, NodeConstructor, NodeDef, NodeMessage } from 'node-red'
import * as t from 'io-ts'
import { isLeft } from 'fp-ts/lib/Either'
import { PathReporter } from 'io-ts/lib/PathReporter'
import { TradfriConfigNode } from '../tradfri-config-node/types'
import { messageType } from '../common/message-type'
import {
  createDeviceState,
  createGroupState,
  TradfriDeviceState,
  TradfriGroupState,
} from '../common/tradfri-state-to-payload'

interface TradfriStateNode extends Node<Record<string, never>> {
  gateway: TradfriConfigNode
  accessories?: number[]
  groups?: number[]
}

interface TradfriStateNodeDef extends NodeDef {
  gateway: string
  accessories?: number[]
  groups?: number[]
}

const tradfriStateInputMessageType = t.intersection(
  [
    t.partial({
      topic: t.union([t.Int, t.array(t.Int)]),
    }),
    messageType,
  ],
  'TradfriStateInputMessage'
)

interface TradfriStateOutputMessage extends NodeMessage {
  topic: number[]
  payload: Record<number, TradfriDeviceState | TradfriGroupState>
}

export = (RED: NodeAPI): void | Promise<void> => {
  const tradfriStateNodeConstructor: NodeConstructor<
    TradfriStateNode,
    TradfriStateNodeDef,
    Record<string, never>
  > = function (nodeDef) {
    RED.nodes.createNode(this, nodeDef)

    this.gateway = RED.nodes.getNode(nodeDef.gateway) as TradfriConfigNode
    this.accessories = nodeDef.accessories?.map((id) => Number(id))
    this.groups = nodeDef.groups?.map((id) => Number(id))

    const setConnected = () => {
      this.status({ fill: 'green', shape: 'dot', text: 'connected' })
    }

    const setDisconnected = () => {
      this.status({ fill: 'red', shape: 'ring', text: 'disconnected' })
    }

    const setConnecting = () => {
      this.status({ fill: 'yellow', shape: 'ring', text: 'connecting...' })
    }

    setConnecting()

    this.gateway.client
      .on('connection alive', setConnected)
      .on('connection lost', setDisconnected)
      .on('connection failed', setDisconnected)
      .on('reconnecting', setConnecting)
      .on('ping succeeded', setConnected)
      .on('ping failed', setDisconnected)
      .ping()
      .catch((err) => {
        this.error(`Unable to ping gateway! ${String(err)}`)
      })

    this.on('input', (inputMessage) => {
      const maybeStateMessage = tradfriStateInputMessageType.decode(
        inputMessage
      )
      if (isLeft(maybeStateMessage)) {
        this.warn(
          `Invalid message received, using node config!\n${PathReporter.report(
            maybeStateMessage
          ).join('\n')}`
        )
      }
      const stateMessage = isLeft(maybeStateMessage)
        ? ({} as t.TypeOf<typeof tradfriStateInputMessageType>)
        : maybeStateMessage.right
      const instanceIds = Array.isArray(stateMessage.topic)
        ? stateMessage.topic
        : typeof stateMessage.topic === 'number'
        ? [stateMessage.topic]
        : []
      const accessoryIds = [
        ...instanceIds.filter((instanceId) =>
          this.gateway.accessories.has(instanceId)
        ),
        ...(this.accessories || []),
      ]
      const groupIds = [
        ...instanceIds.filter((instanceId) =>
          this.gateway.groups.has(instanceId)
        ),
        ...(this.groups || []),
      ]

      if (!accessoryIds.length && !groupIds.length) {
        this.warn('No accessories or groups in message or node configuration!')
        return
      }

      this.log(
        `Retrieving current state of accessories: [${accessoryIds.join()}] and groups: [${groupIds.join()}]`
      )

      const outputMessage: TradfriStateOutputMessage = {
        topic: [...accessoryIds, ...groupIds],
        payload: {
          ...accessoryIds.reduce((cummulativeDeviceState, instanceId) => {
            const accessory = this.gateway.accessories.get(instanceId)
            if (!accessory) {
              return cummulativeDeviceState
            }
            return {
              ...cummulativeDeviceState,
              [instanceId]: createDeviceState(accessory),
            }
          }, {}),
          ...groupIds.reduce((cummulativeGroupState, instanceId) => {
            const group = this.gateway.groups.get(instanceId)
            if (!group) {
              return cummulativeGroupState
            }
            return {
              ...cummulativeGroupState,
              [instanceId]: createGroupState(group),
            }
          }, {}),
        },
      }

      this.send(outputMessage)
    })
  }

  RED.nodes.registerType('tradfri-state', tradfriStateNodeConstructor)
}
