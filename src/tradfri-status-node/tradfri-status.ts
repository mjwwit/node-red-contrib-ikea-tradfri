import { Node, NodeAPI, NodeConstructor, NodeDef, NodeMessage } from 'node-red'
import { AccessoryTypes, Spectrum } from 'node-tradfri-client'
import { TradfriConfigNode } from '../tradfri-config-node/tradfri-config'

type DeviceType =
  | 'blind'
  | 'lightbulb'
  | 'motionSensor'
  | 'plug'
  | 'remote'
  | 'signalRepeater'
  | 'slaveRemote'
  | 'soundRemote'

const AccessoryToDeviceType: Record<AccessoryTypes, DeviceType> = {
  [AccessoryTypes.blind]: 'blind',
  [AccessoryTypes.lightbulb]: 'lightbulb',
  [AccessoryTypes.motionSensor]: 'motionSensor',
  [AccessoryTypes.plug]: 'plug',
  [AccessoryTypes.remote]: 'remote',
  [AccessoryTypes.signalRepeater]: 'signalRepeater',
  [AccessoryTypes.slaveRemote]: 'slaveRemote',
  [AccessoryTypes.soundRemote]: 'soundRemote',
}

interface TradfriStatusNode extends Node<Record<string, never>> {
  gateway: TradfriConfigNode
}

interface TradfriStatusNodeDef extends NodeDef {
  gateway: string
}

interface TradfriStatusMessage extends NodeMessage {
  payload: {
    type: DeviceType
    instanceId: number
    name: string
    alive: boolean
    lastSeen: string
    blind?: {
      name: string
      position: number
    }
    lightbulb?: {
      color: string
      colorTemperature: number
      dimmer: number
      hue: number
      isDimmable: boolean
      isOn: boolean
      name: string
      saturation: number
      spectrum: Spectrum
      unit: string
    }
    motionSensor?: {
      name: string
    }
  }
}

module.exports = (RED: NodeAPI) => {
  const tradfriStatusNodeConstructor: NodeConstructor<
    TradfriStatusNode,
    TradfriStatusNodeDef,
    Record<string, never>
  > = function (nodeDef) {
    RED.nodes.createNode(this, nodeDef)

    this.gateway = RED.nodes.getNode(nodeDef.gateway) as TradfriConfigNode

    this.gateway.client.on('device updated', (accessory) => {
      const message: TradfriStatusMessage = {
        payload: {
          type: AccessoryToDeviceType[accessory.type],
          instanceId: accessory.instanceId,
          name: accessory.name,
          alive: accessory.alive,
          lastSeen: new Date(accessory.lastSeen * 1000).toISOString(),
          blind:
            accessory.type === AccessoryTypes.blind
              ? {
                  name: accessory.blindList[0].name,
                  position: accessory.blindList[0].position,
                }
              : undefined,
          lightbulb:
            accessory.type === AccessoryTypes.lightbulb
              ? {
                  color: accessory.lightList[0].color,
                  colorTemperature: accessory.lightList[0].colorTemperature,
                  dimmer: accessory.lightList[0].dimmer,
                  hue: accessory.lightList[0].hue,
                  isDimmable: accessory.lightList[0].isDimmable,
                  isOn: accessory.lightList[0].onOff,
                  name: accessory.lightList[0].name,
                  saturation: accessory.lightList[0].saturation,
                  spectrum: accessory.lightList[0].spectrum,
                  unit: accessory.lightList[0].unit,
                }
              : undefined,
          motionSensor:
            accessory.type === AccessoryTypes.motionSensor
              ? {
                  name: accessory.sensorList[0].name,
                }
              : undefined,
        },
      }
      this.send(message)
    })
  }

  RED.nodes.registerType('tradfri-status', tradfriStatusNodeConstructor)
}
