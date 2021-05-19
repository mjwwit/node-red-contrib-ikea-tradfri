import 'core-js/es/promise/all-settled'
import 'core-js/es/array/flat'
import { Node, NodeAPI, NodeConstructor, NodeDef } from 'node-red'
import * as t from 'io-ts'
import { PathReporter } from 'io-ts/PathReporter'
import { isLeft } from 'fp-ts/lib/Either'
import { AccessoryTypes, LightOperation } from 'node-tradfri-client'
import { TradfriConfigNode } from '../tradfri-config-node/types'
import { messageType } from '../common/message-type'
import { brightnessType, hueType, saturationType } from '../common/types'

const tradfriLightControlActionType = t.partial(
  {
    onOff: t.boolean,
    brightness: brightnessType,
    transitionTime: t.number,
    colorTemperature: t.number,
    color: t.string,
    hue: hueType,
    saturation: saturationType,
  },
  'TradfriLightControlAction'
)

type TradfriLightControlAction = t.TypeOf<typeof tradfriLightControlActionType>

interface TradfriLightControlNode extends Node<Record<string, never>> {
  gateway: TradfriConfigNode
  action?: TradfriLightControlAction
  accessories?: number[]
  groups?: number[]
}

interface TradfriLightControlNodeDef extends NodeDef {
  gateway: string
  action?: string
  accessories?: number[]
  groups?: number[]
}

const tradfriLightControlMessageType = t.intersection(
  [
    t.partial({
      topic: t.union([t.Int, t.array(t.Int)]),
      payload: tradfriLightControlActionType,
    }),
    messageType,
  ],
  'TradfriLightControlMessage'
)

export = (RED: NodeAPI): void | Promise<void> => {
  const tradfriLightControlNodeConstructor: NodeConstructor<
    TradfriLightControlNode,
    TradfriLightControlNodeDef,
    Record<string, never>
  > = function (nodeDef) {
    RED.nodes.createNode(this, nodeDef)

    this.gateway = RED.nodes.getNode(nodeDef.gateway) as TradfriConfigNode
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.action = nodeDef.action ? JSON.parse(nodeDef.action) : {}
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
      const maybeLightControlMessage =
        tradfriLightControlMessageType.decode(message)
      if (isLeft(maybeLightControlMessage)) {
        this.warn(
          `Invalid message received, using node config!\n${PathReporter.report(
            maybeLightControlMessage
          ).join('\n')}`
        )
      }
      const lightControlMessage = isLeft(maybeLightControlMessage)
        ? ({} as t.TypeOf<typeof tradfriLightControlMessageType>)
        : maybeLightControlMessage.right
      const action = {
        ...(this.action || {}),
        ...(lightControlMessage.payload || {}),
      }
      const instanceIds = Array.isArray(lightControlMessage.topic)
        ? lightControlMessage.topic
        : typeof lightControlMessage.topic === 'number'
        ? [lightControlMessage.topic]
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
        `Sending ${JSON.stringify(
          action
        )} to accessories: [${accessoryIds.join()}] and groups: [${groupIds.join()}]`
      )

      const operation: LightOperation = {
        onOff:
          action.onOff !== false &&
          (action.colorTemperature !== undefined ||
            action.color !== undefined ||
            action.brightness !== undefined)
            ? true
            : action.onOff,
        dimmer: action.brightness,
        color:
          action.color && action.color.startsWith('#')
            ? action.color.slice(1)
            : action.color,
        colorTemperature: action.colorTemperature,
        hue: action.hue,
        saturation: action.saturation,
        transitionTime: action.transitionTime,
      }

      this.log(`Executing operation: ${JSON.stringify(operation)}`)

      Promise.allSettled([
        ...Array.from(this.gateway.accessories.values())
          .filter(
            (accessory) =>
              accessoryIds.includes(accessory.instanceId) &&
              accessory.type === AccessoryTypes.lightbulb
          )
          .map((accessory) =>
            this.gateway.client.operateLight(accessory, operation)
          ),
        ...Array.from(this.gateway.groups.values())
          .filter((group) => groupIds.includes(group.instanceId))
          .map((group) => this.gateway.client.operateGroup(group, operation)),
      ])
        .then((results) => {
          this.log(`Light action result: ${JSON.stringify(results)}`)
        })
        .catch((err: Error) => {
          this.error(`Light action error: ${String(err)}`, message)
        })
    })
  }

  RED.nodes.registerType(
    'tradfri-light-control',
    tradfriLightControlNodeConstructor
  )
}
