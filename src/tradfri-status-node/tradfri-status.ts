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

interface TradfriStatusMessage extends NodeMessage {
  updatedDevice: {
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

export = (RED: NodeAPI): void | Promise<void> => {
  const tradfriStatusNodeConstructor: NodeConstructor<
    TradfriStatusNode,
    TradfriStatusNodeDef,
    Record<string, never>
  > = function (nodeDef) {
    RED.nodes.createNode(this, nodeDef)

    this.gateway = RED.nodes.getNode(nodeDef.gateway) as TradfriConfigNode

    this.gateway.client.on('device updated', (accessory) => {
      const message: TradfriStatusMessage = {
        updatedDevice: {
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
  }

  RED.nodes.registerType('tradfri-status', tradfriStatusNodeConstructor)
}
