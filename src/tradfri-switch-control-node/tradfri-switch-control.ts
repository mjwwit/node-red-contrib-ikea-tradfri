import { Node, NodeAPI, NodeConstructor, NodeDef } from 'node-red'
import * as t from 'io-ts'
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
      switchControl: t.partial(
        {
          action: tradfriSwitchControlActionType,
          accessories: t.array(t.Int),
          groups: t.array(t.Int),
        },
        'TradfriSwitchControlMessagePayloadSwitchAction'
      ),
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

    this.on('input', (message) => {
      const maybeSwitchControlMessage = tradfriSwitchControlMessageType.decode(
        message
      )
      if (isLeft(maybeSwitchControlMessage)) {
        this.error('Invalid message received!')
        return
      }
      const switchControlMessage = maybeSwitchControlMessage.right
      const action = switchControlMessage.switchControl?.action || this.action
      const accessoryIds = [
        ...(switchControlMessage.switchControl?.accessories || []),
        ...(this.accessories || []),
      ]
      const groupIds = [
        ...(switchControlMessage.switchControl?.groups || []),
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
              this.error(`"On" action error: ${String(err)}`)
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
              this.error(`"Off" action error: ${String(err)}`)
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
