import 'core-js/es/promise/all-settled'
import 'core-js/es/array/flat'
import { Node, NodeAPI, NodeConstructor, NodeDef } from 'node-red'
import * as t from 'io-ts'
import { PathReporter } from 'io-ts/PathReporter'
import { isLeft } from 'fp-ts/lib/Either'
import { TradfriConfigNode } from '../tradfri-config-node/types'
import { messageType } from '../common/message-type'

const tradfriSwitchControlActionType = t.union(
  [t.literal('on'), t.literal('off')],
  'TradfriSwitchControlAction'
)
type TradfriSwitchControlAction = t.TypeOf<
  typeof tradfriSwitchControlActionType
>

interface TradfriSwitchControlNode extends Node<Record<string, never>> {
  gateway: TradfriConfigNode
  action?: TradfriSwitchControlAction
  accessories?: number[]
  groups?: number[]
}

interface TradfriSwitchControlNodeDef extends NodeDef {
  gateway: string
  action?: TradfriSwitchControlAction
  accessories?: number[]
  groups?: number[]
}

const tradfriSwitchControlMessageType = t.intersection(
  [
    t.partial({
      topic: t.union([t.Int, t.array(t.Int)]),
      payload: tradfriSwitchControlActionType,
    }),
    messageType,
  ],
  'TradfriSwitchControlMessage'
)

export = (RED: NodeAPI): void | Promise<void> => {
  const tradfriSwitchControlNodeConstructor: NodeConstructor<
    TradfriSwitchControlNode,
    TradfriSwitchControlNodeDef,
    Record<string, never>
  > = function (nodeDef) {
    RED.nodes.createNode(this, nodeDef)

    this.gateway = RED.nodes.getNode(nodeDef.gateway) as TradfriConfigNode
    this.action = nodeDef.action
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
      const maybeSwitchControlMessage = tradfriSwitchControlMessageType.decode(
        message
      )
      if (isLeft(maybeSwitchControlMessage)) {
        this.warn(
          `Invalid message received, using node config!\n${PathReporter.report(
            maybeSwitchControlMessage
          ).join('\n')}`
        )
      }
      const switchControlMessage = isLeft(maybeSwitchControlMessage)
        ? ({} as t.TypeOf<typeof tradfriSwitchControlMessageType>)
        : maybeSwitchControlMessage.right
      const action = switchControlMessage.payload || this.action
      const instanceIds = Array.isArray(switchControlMessage.topic)
        ? switchControlMessage.topic
        : typeof switchControlMessage.topic === 'number'
        ? [switchControlMessage.topic]
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

      this.log(
        `Turning ${action} accessories: [${accessoryIds.join()}] and groups: [${groupIds.join()}]`
      )

      switch (action) {
        case 'on':
          Promise.all([
            ...Array.from(this.gateway.accessories.values())
              .filter((accessory) =>
                accessoryIds.includes(accessory.instanceId)
              )
              .map((accessory) =>
                Promise.allSettled([
                  ...(accessory.lightList?.map((l) => l.turnOn()) || []),
                  ...(accessory.plugList?.map((p) => p.turnOn()) || []),
                ])
              ),
            ...Array.from(this.gateway.groups.values())
              .filter((group) => groupIds.includes(group.instanceId))
              .map((group) => Promise.allSettled([group.turnOn()])),
          ])
            .then((results) => {
              this.log(`"On" action result: ${JSON.stringify(results.flat())}`)
            })
            .catch((err: Error) => {
              this.error(`"On" action error: ${String(err)}`, message)
            })
          break
        case 'off':
          Promise.all([
            ...Array.from(this.gateway.accessories.values())
              .filter((accessory) =>
                accessoryIds.includes(accessory.instanceId)
              )
              .map((accessory) =>
                Promise.allSettled([
                  ...(accessory.lightList?.map((l) => l.turnOff()) || []),
                  ...(accessory.plugList?.map((p) => p.turnOff()) || []),
                ])
              ),
            ...Array.from(this.gateway.groups.values())
              .filter((group) => groupIds.includes(group.instanceId))
              .map((group) => Promise.allSettled([group.turnOff()])),
          ])
            .then((results) => {
              this.log(`"Off" action result: ${JSON.stringify(results.flat())}`)
            })
            .catch((err: Error) => {
              this.error(`"Off" action error: ${String(err)}`, message)
            })
          break
        default:
          this.error(
            `Unsupported tradfri-control action: "${action as string}"`
          )
          return
      }
    })
  }

  RED.nodes.registerType(
    'tradfri-switch-control',
    tradfriSwitchControlNodeConstructor
  )
}
