import {
  Node,
  NodeAPI,
  NodeConstructor,
  NodeDef,
  NodeMessageInFlow,
} from 'node-red'
import { TradfriConfigNode } from '../tradfri-config-node/tradfri-config'

type TradfriLightControlAction = 'on' | 'off' | 'dim'

interface TradfriLightControlNode extends Node<Record<string, never>> {
  gateway: TradfriConfigNode
  action?: TradfriLightControlAction
  accessories?: number[]
  groups?: number[]
}

interface TradfriLightControlNodeDef extends NodeDef {
  gateway: string
  action?: TradfriLightControlAction
  accessories?: number[]
  groups?: number[]
}

interface TradfriLightControlMessage extends NodeMessageInFlow {
  action?: TradfriLightControlAction
  accessories?: number[]
  groups?: number[]
}

module.exports = (RED: NodeAPI) => {
  const tradfriLightControlNodeConstructor: NodeConstructor<
    TradfriLightControlNode,
    TradfriLightControlNodeDef,
    Record<string, never>
  > = function (nodeDef) {
    RED.nodes.createNode(this, nodeDef)

    this.gateway = RED.nodes.getNode(nodeDef.gateway) as TradfriConfigNode
    this.action = nodeDef.action
    this.accessories = nodeDef.accessories?.map((id) => Number(id))
    this.groups = nodeDef.groups?.map((id) => Number(id))

    this.on('input', (message: TradfriLightControlMessage) => {
      const action = message.action || this.action
      const accessoryIds = [
        ...(message.accessories || []),
        ...(this.accessories || []),
      ]
      const groupIds = [...(message.groups || []), ...(this.groups || [])]

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
                  ...accessory.lightList?.map((l) => l.turnOn()),
                  ...accessory.plugList?.map((p) => p.turnOn()),
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
                  ...accessory.lightList?.map((l) => l.turnOff()),
                  ...accessory.plugList?.map((p) => p.turnOff()),
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
          this.error(`Unsupported tradfri-control action: "${action}"`)
          return
      }
    })
  }

  RED.nodes.registerType('tradfri-light-control', tradfriLightControlNodeConstructor)
}
