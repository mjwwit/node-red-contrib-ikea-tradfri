/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import helper from 'node-red-node-test-helper'

const mockTradfriClient: {
  authenticate: jest.Mock
  destroy: jest.Mock
  on: jest.Mock
  connect: jest.Mock
  observeDevices: jest.Mock
  observeGroupsAndScenes: jest.Mock
  ping: jest.Mock
} = {
  authenticate: jest
    .fn()
    .mockRejectedValue(new Error('Unexpected call to authenticate')),
  destroy: jest.fn(),
  on: jest.fn().mockImplementation(() => mockTradfriClient),
  connect: jest.fn().mockRejectedValue(new Error('Unexpected call to connect')),
  observeDevices: jest
    .fn()
    .mockRejectedValue(new Error('Unexpected call to observeDevices')),
  observeGroupsAndScenes: jest
    .fn()
    .mockRejectedValue(new Error('Unexpected call to observeGroupsAndScenes')),
  ping: jest.fn().mockRejectedValue(new Error('Unexpected call to ping')),
}
const mockTradfriClientConstructor = jest
  .fn()
  .mockImplementation(() => mockTradfriClient)
const mockDiscoverGateway = jest
  .fn()
  .mockRejectedValue(new Error('Unexpected call to discoverGateway'))
jest.mock('node-tradfri-client', () => ({
  AccessoryTypes: {
    lightbulb: 0,
  },
  discoverGateway: mockDiscoverGateway,
  TradfriClient: mockTradfriClientConstructor,
}))

import tradfriConfigNode from '../src/tradfri-config-node/tradfri-config'
import tradfriSwitchControlNode from '../src/tradfri-switch-control-node/tradfri-switch-control'

describe('Tradfri switch control node', () => {
  afterEach(async () => {
    await helper.unload()
    jest.clearAllMocks()
  })

  it('should expose the configured action, accessories, and groups', async () => {
    mockTradfriClient.connect.mockResolvedValueOnce(void 0)
    mockTradfriClient.observeDevices.mockResolvedValueOnce(void 0)
    mockTradfriClient.observeGroupsAndScenes.mockResolvedValueOnce(void 0)
    mockTradfriClient.ping.mockResolvedValueOnce(true)

    const flow = [
      {
        id: 'n1',
        type: 'tradfri-config',
        name: 'test gateway',
        gatewayHost: 'host',
      },
      {
        id: 'n2',
        type: 'tradfri-switch-control',
        name: 'turn on light',
        gateway: 'n1',
        action: 'on',
        accessories: [1],
        groups: [2],
      },
    ]
    await helper.load([tradfriConfigNode, tradfriSwitchControlNode], flow, {
      n1: {
        identity: 'id1',
        preSharedKey: 'psk',
      },
    })

    const n2 = helper.getNode('n2') as any
    expect(n2.action).toBe('on')
    expect(n2.accessories).toEqual([1])
    expect(n2.groups).toEqual([2])
  })

  it('should control accessories and groups', async () => {
    mockTradfriClient.connect.mockResolvedValueOnce(void 0)
    mockTradfriClient.observeDevices.mockResolvedValueOnce(void 0)
    mockTradfriClient.observeGroupsAndScenes.mockResolvedValueOnce(void 0)
    mockTradfriClient.ping.mockResolvedValueOnce(true)

    const flow = [
      {
        id: 'n1',
        type: 'tradfri-config',
        name: 'test gateway',
        gatewayHost: 'host',
      },
      {
        id: 'n2',
        type: 'tradfri-switch-control',
        name: 'turn on light',
        gateway: 'n1',
        action: 'on',
        accessories: ['1'],
        groups: ['2'],
      },
    ]
    await helper.load([tradfriConfigNode, tradfriSwitchControlNode], flow, {
      n1: {
        identity: 'id1',
        preSharedKey: 'psk',
      },
    })

    const n2 = helper.getNode('n2')

    const accessoryTurnOnFn = jest.fn().mockResolvedValue(true)
    const accessoryTurnOffFn = jest.fn().mockResolvedValue(true)
    const groupTurnOnFn = jest.fn().mockResolvedValue(true)
    const groupTurnOffFn = jest.fn().mockResolvedValue(true)

    // Add device
    const registerDeviceUpdatedHandlerCallArgs = mockTradfriClient.on.mock.calls.find(
      (call): call is ['device updated', (accessory: any) => void] =>
        Array.isArray(call) && call[0] === 'device updated'
    )
    if (!registerDeviceUpdatedHandlerCallArgs) {
      return fail(
        new Error('No call found to client.on for event "device updated"')
      )
    }
    const deviceUpdatedHandler = registerDeviceUpdatedHandlerCallArgs[1]
    deviceUpdatedHandler({
      instanceId: 1,
      name: 'ac1',
      lightList: [{ turnOn: accessoryTurnOnFn, turnOff: accessoryTurnOffFn }],
    })

    // Add group
    const registerGroupUpdatedHandlerCallArgs = mockTradfriClient.on.mock.calls.find(
      (call): call is ['group updated', (accessory: any) => void] =>
        Array.isArray(call) && call[0] === 'group updated'
    )
    if (!registerGroupUpdatedHandlerCallArgs) {
      return fail(
        new Error('No call found to client.on for event "device updated"')
      )
    }
    const groupUpdatedHandler = registerGroupUpdatedHandlerCallArgs[1]
    groupUpdatedHandler({
      instanceId: 2,
      name: 'g1',
      turnOn: groupTurnOnFn,
      turnOff: groupTurnOffFn,
    })

    // Turning on

    expect(accessoryTurnOnFn).not.toHaveBeenCalled()
    expect(groupTurnOnFn).not.toHaveBeenCalled()

    n2.receive({})

    expect(accessoryTurnOnFn).toHaveBeenCalledTimes(1)
    expect(groupTurnOnFn).toHaveBeenCalledTimes(1)

    // Turning off

    expect(accessoryTurnOffFn).not.toHaveBeenCalled()
    expect(groupTurnOffFn).not.toHaveBeenCalled()

    n2.receive({ payload: 'off' } as any)

    expect(accessoryTurnOffFn).toHaveBeenCalledTimes(1)
    expect(groupTurnOffFn).toHaveBeenCalledTimes(1)
  })
})
