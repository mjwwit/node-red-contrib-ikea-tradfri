import { Node, NodeAPI, NodeConstructor, NodeDef, NodeMessage } from 'node-red'
import { AccessoryTypes, PowerSources, Spectrum } from 'node-tradfri-client'
import { DeviceType, deviceTypeMap } from '../common/tradfri-device-type'
import { TradfriConfigNode } from '../tradfri-config-node/types'

type PowerSource =
  | 'Unknown'
  | 'InternalBattery'
  | 'ExternalBattery'
  | 'Battery'
  | 'PowerOverEthernet'
  | 'USB'
  | 'ACPower'
  | 'Solar'

const powerSourceMap: Record<PowerSources, PowerSource> = {
  [PowerSources.Unknown]: 'Unknown',
  [PowerSources.InternalBattery]: 'InternalBattery',
  [PowerSources.ExternalBattery]: 'ExternalBattery',
  [PowerSources.Battery]: 'Battery',
  [PowerSources.PowerOverEthernet]: 'PowerOverEthernet',
  [PowerSources.USB]: 'USB',
  [PowerSources.AC_Power]: 'ACPower',
  [PowerSources.Solar]: 'Solar',
}

interface TradfriStatusNode extends Node<Record<string, never>> {
  gateway: TradfriConfigNode
}

interface TradfriStatusNodeDef extends NodeDef {
  gateway: string
}

interface TradfriDeviceUpdatedMessage extends NodeMessage {
  topic: number
  payload: {
    event: 'device updated'
    type: DeviceType
    instanceId: number
    name: string
    alive: boolean
    lastSeen: string
    deviceInfo: {
      battery?: number
      firmwareVersion: string
      manufacturer: string
      modelNumber: string
      power: PowerSource
      serialNumber: string
    }
    otaUpdateState: number
    blind?: {
      position: number
      trigger?: number
    }
    lightbulb?: {
      color?: string
      colorTemperature?: number
      dimmer: number
      hue?: number
      isDimmable: boolean
      isOn: boolean
      saturation?: number
      spectrum: Spectrum
      unit?: string
    }
    sensor?: {
      appType: string
      maxMeasuredValue: number
      maxRangeValue: number
      minMeasuredValue: number
      minRangeValue: number
      resetMinMaxMeasureValue: boolean
      sensorType: string
      sensorValue: number
      unit?: string
    }
    plug?: {
      cumulativeActivePower: number
      dimmer: number
      isDimmable: boolean
      isOn: boolean
      isSwitchable: boolean
      onTime: number
      powerFactor: number
    }
  }
}

interface TradfriDeviceRemovedMessage extends NodeMessage {
  topic: number
  payload: {
    event: 'device removed'
    instanceId: number
  }
}

interface TradfriGroupUpdatedMessage extends NodeMessage {
  topic: number
  payload: {
    event: 'group updated'
    instanceId: number
    name: string
    deviceIds: number[]
    sceneId?: number
    isOn: boolean
    dimmer?: number
    position?: number
    transitionTime: number
    createdAt: string
    trigger?: number
  }
}

interface TradfriGroupRemovedMessage extends NodeMessage {
  topic: number
  payload: {
    event: 'group removed'
    instanceId: number
  }
}

export = (RED: NodeAPI): void | Promise<void> => {
  const tradfriStatusNodeConstructor: NodeConstructor<
    TradfriStatusNode,
    TradfriStatusNodeDef,
    Record<string, never>
  > = function (nodeDef) {
    RED.nodes.createNode(this, nodeDef)

    this.gateway = RED.nodes.getNode(nodeDef.gateway) as TradfriConfigNode

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

    this.gateway.client.on('device updated', (accessory) => {
      const message: TradfriDeviceUpdatedMessage = {
        topic: accessory.instanceId,
        payload: {
          event: 'device updated',
          type: deviceTypeMap[accessory.type],
          instanceId: accessory.instanceId,
          name: accessory.name,
          alive: accessory.alive,
          lastSeen: new Date(accessory.lastSeen * 1000).toISOString(),
          deviceInfo: {
            ...accessory.deviceInfo,
            power: powerSourceMap[accessory.deviceInfo.power],
          },
          otaUpdateState: accessory.otaUpdateState,
          blind:
            accessory.type === AccessoryTypes.blind
              ? {
                  position: accessory.blindList[0].position,
                  trigger: accessory.blindList[0].trigger,
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
                  saturation: accessory.lightList[0].saturation,
                  spectrum: accessory.lightList[0].spectrum,
                  unit: accessory.lightList[0].unit,
                }
              : undefined,
          sensor:
            accessory.type === AccessoryTypes.motionSensor
              ? {
                  appType: accessory.sensorList[0].appType,
                  maxMeasuredValue: accessory.sensorList[0].maxMeasuredValue,
                  maxRangeValue: accessory.sensorList[0].maxRangeValue,
                  minMeasuredValue: accessory.sensorList[0].minMeasuredValue,
                  minRangeValue: accessory.sensorList[0].minRangeValue,
                  resetMinMaxMeasureValue:
                    accessory.sensorList[0].resetMinMaxMeasureValue,
                  sensorType: accessory.sensorList[0].sensorType,
                  sensorValue: accessory.sensorList[0].sensorValue,
                  unit: accessory.sensorList[0].unit,
                }
              : undefined,
          plug:
            accessory.type === AccessoryTypes.plug
              ? {
                  cumulativeActivePower:
                    accessory.plugList[0].cumulativeActivePower,
                  dimmer: accessory.plugList[0].dimmer,
                  isDimmable: accessory.plugList[0].isDimmable,
                  isOn: accessory.plugList[0].onOff,
                  isSwitchable: accessory.plugList[0].isSwitchable,
                  onTime: accessory.plugList[0].onTime,
                  powerFactor: accessory.plugList[0].powerFactor,
                }
              : undefined,
        },
      }
      this.send(message)
    })

    this.gateway.client.on('device removed', (instanceId) => {
      const message: TradfriDeviceRemovedMessage = {
        topic: instanceId,
        payload: {
          event: 'device removed',
          instanceId,
        },
      }
      this.send(message)
    })

    this.gateway.client.on('group updated', (group) => {
      const message: TradfriGroupUpdatedMessage = {
        topic: group.instanceId,
        payload: {
          event: 'group updated',
          instanceId: group.instanceId,
          deviceIds: group.deviceIDs,
          sceneId: group.sceneId,
          name: group.name,
          isOn: group.onOff,
          dimmer: group.dimmer,
          position: group.position,
          transitionTime: group.transitionTime,
          createdAt: new Date(group.createdAt * 1000).toISOString(),
          trigger: group.trigger,
        },
      }
      this.send(message)
    })

    this.gateway.client.on('group removed', (instanceId) => {
      const message: TradfriGroupRemovedMessage = {
        topic: instanceId,
        payload: {
          event: 'group removed',
          instanceId,
        },
      }
      this.send(message)
    })
  }

  RED.nodes.registerType('tradfri-status', tradfriStatusNodeConstructor)
}
