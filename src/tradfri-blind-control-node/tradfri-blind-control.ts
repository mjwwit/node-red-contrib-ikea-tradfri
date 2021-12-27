import 'core-js/es/promise/all-settled'
import 'core-js/es/array/flat'
import { Node, NodeAPI, NodeConstructor, NodeDef } from 'node-red'
import * as t from 'io-ts'
import { PathReporter } from 'io-ts/PathReporter'
import { isLeft } from 'fp-ts/lib/Either'
import { AccessoryTypes, BlindOperation } from 'node-tradfri-client'
import { TradfriConfigNode } from '../tradfri-config-node/types'
import { messageType } from '../common/message-type'
import { blindPositionType } from '../common/types'

const tradfriBlindControlActionType = t.partial(
  {
    operation: t.union([t.literal('setPosition'), t.literal('stop')]),
    position: blindPositionType,
  },
  'TradfriBlindControlAction'
)

type TradfriBlindControlAction = t.TypeOf<typeof tradfriBlindControlActionType>

interface TradfriBlindControlNode extends Node<Record<string, never>> {
  gateway: TradfriConfigNode
  action?: TradfriBlindControlAction
  accessories?: number[]
  groups?: number[]
  logInputErrors: boolean
}

interface TradfriBlindControlNodeDef extends NodeDef {
  gateway: string
  action?: string
  accessories?: number[]
  groups?: number[]
  logInputErrors: boolean
}

const tradfriBlindControlMessageType = t.intersection(
  [
    t.partial({
      topic: t.union([t.Int, t.array(t.Int)]),
      payload: tradfriBlindControlActionType,
    }),
    messageType,
  ],
  'TradfriBlindControlMessage'
)

export = (RED: NodeAPI): void | Promise<void> => {
  const tradfriBlindControlNodeConstructor: NodeConstructor<
    TradfriBlindControlNode,
    TradfriBlindControlNodeDef,
    Record<string, never>
  > = function (nodeDef) {
    RED.nodes.createNode(this, nodeDef)

    this.gateway = RED.nodes.getNode(nodeDef.gateway) as TradfriConfigNode
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.action = nodeDef.action ? JSON.parse(nodeDef.action) : {}
    this.accessories = nodeDef.accessories?.map((id) => Number(id))
    this.groups = nodeDef.groups?.map((id) => Number(id))
    this.logInputErrors = nodeDef.logInputErrors

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

    this.on('close', () => {
      this.gateway.client
        .off('connection alive', setConnected)
        .off('connection lost', setDisconnected)
        .off('connection failed', setDisconnected)
        .off('reconnecting', setConnecting)
        .off('ping succeeded', setConnected)
        .off('ping failed', setDisconnected)
    })

    this.on('input', (message) => {
      const maybeBlindControlMessage =
        tradfriBlindControlMessageType.decode(message)
      if (isLeft(maybeBlindControlMessage) && this.logInputErrors) {
        this.warn(
          `Invalid message received, using node config!\n${PathReporter.report(
            maybeBlindControlMessage
          ).join('\n')}`
        )
      }
      const blindControlMessage = isLeft(maybeBlindControlMessage)
        ? ({} as t.TypeOf<typeof tradfriBlindControlMessageType>)
        : maybeBlindControlMessage.right
      const action = {
        ...(this.action || {}),
        ...(blindControlMessage.payload || {}),
      }
      const instanceIds = Array.isArray(blindControlMessage.topic)
        ? blindControlMessage.topic
        : typeof blindControlMessage.topic === 'number'
        ? [blindControlMessage.topic]
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

      if (!action) {
        this.warn('No action set in message or node configuration!')
        return
      }

      if (!accessoryIds.length && !groupIds.length) {
        this.warn('No accessories or groups in message or node configuration!')
        return
      }

      if (!action.operation) {
        this.warn('No blind operation found in message or node configuration!')
        return
      }

      if (action.operation === 'setPosition' && action.position === undefined) {
        this.warn(
          'Blind operation "setPosition" requires a position and none was found in the message or node configuration!'
        )
        return
      }

      this.log(
        `Sending ${JSON.stringify(
          action
        )} to accessories: [${accessoryIds.join()}] and groups: [${groupIds.join()}]`
      )

      const operation: BlindOperation = {
        position:
          action.operation === 'setPosition' && action.position !== undefined
            ? action.position
            : undefined,
        trigger: action.operation === 'stop' ? 0 : undefined,
      }

      // We need to delete all the properties we do not use
      for (const key of Object.keys(operation) as (keyof BlindOperation)[]) {
        if (operation[key] === undefined) {
          delete operation[key]
        }
      }

      this.log(`Executing operation: ${JSON.stringify(operation)}`)

      Promise.allSettled([
        ...Array.from(this.gateway.accessories.values())
          .filter(
            (accessory) =>
              accessoryIds.includes(accessory.instanceId) &&
              accessory.type === AccessoryTypes.blind
          )
          .map((accessory) =>
            this.gateway.client.operateBlind(accessory, operation)
          ),
        ...Array.from(this.gateway.groups.values())
          .filter((group) => groupIds.includes(group.instanceId))
          .map((group) => this.gateway.client.operateGroup(group, operation)),
      ])
        .then((results) => {
          this.log(`Blind action result: ${JSON.stringify(results)}`)
        })
        .catch((err: Error) => {
          this.error(`Blind action error: ${String(err)}`, message)
        })
    })
  }

  RED.nodes.registerType(
    'tradfri-blind-control',
    tradfriBlindControlNodeConstructor
  )
}
