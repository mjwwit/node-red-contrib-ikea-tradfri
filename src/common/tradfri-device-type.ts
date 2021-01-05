import { AccessoryTypes } from 'node-tradfri-client'

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
