import {
  Accessory,
  AccessoryTypes,
  Group,
  PowerSources,
  Spectrum,
} from 'node-tradfri-client'

export type DeviceType =
  | 'blind'
  | 'lightbulb'
  | 'motionSensor'
  | 'plug'
  | 'remote'
  | 'signalRepeater'
  | 'slaveRemote'
  | 'soundRemote'

export const deviceTypeMap: Record<AccessoryTypes, DeviceType> = {
  [AccessoryTypes.blind]: 'blind',
  [AccessoryTypes.lightbulb]: 'lightbulb',
  [AccessoryTypes.motionSensor]: 'motionSensor',
  [AccessoryTypes.plug]: 'plug',
  [AccessoryTypes.remote]: 'remote',
  [AccessoryTypes.signalRepeater]: 'signalRepeater',
  [AccessoryTypes.slaveRemote]: 'slaveRemote',
  [AccessoryTypes.soundRemote]: 'soundRemote',
}

export type PowerSource =
  | 'Unknown'
  | 'InternalBattery'
  | 'ExternalBattery'
  | 'Battery'
  | 'PowerOverEthernet'
  | 'USB'
  | 'ACPower'
  | 'Solar'

export const powerSourceMap: Record<PowerSources, PowerSource> = {
  [PowerSources.Unknown]: 'Unknown',
  [PowerSources.InternalBattery]: 'InternalBattery',
  [PowerSources.ExternalBattery]: 'ExternalBattery',
  [PowerSources.Battery]: 'Battery',
  [PowerSources.PowerOverEthernet]: 'PowerOverEthernet',
  [PowerSources.USB]: 'USB',
  [PowerSources.AC_Power]: 'ACPower',
  [PowerSources.Solar]: 'Solar',
}

export interface TradfriDeviceState {
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
    serialNumber: number
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

export interface TradfriGroupState {
  type: 'group'
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

export const createDeviceState = (
  accessory: Accessory
): TradfriDeviceState => ({
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
          cumulativeActivePower: accessory.plugList[0].cumulativeActivePower,
          dimmer: accessory.plugList[0].dimmer,
          isDimmable: accessory.plugList[0].isDimmable,
          isOn: accessory.plugList[0].onOff,
          isSwitchable: accessory.plugList[0].isSwitchable,
          onTime: accessory.plugList[0].onTime,
          powerFactor: accessory.plugList[0].powerFactor,
        }
      : undefined,
})

export const createGroupState = (group: Group): TradfriGroupState => ({
  type: 'group',
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
})
