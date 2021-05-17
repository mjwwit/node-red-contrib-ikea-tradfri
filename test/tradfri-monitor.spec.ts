/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import helper from 'node-red-node-test-helper'

const mockTradfriClient: {
  authenticate: jest.Mock
  destroy: jest.Mock
  on: jest.Mock
  once: jest.Mock
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
  once: jest.fn().mockImplementation(() => mockTradfriClient),
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
  PowerSources: {
    Unknown: 0,
  },
  discoverGateway: mockDiscoverGateway,
  TradfriClient: mockTradfriClientConstructor,
}))

import tradfriConfigNode from '../src/tradfri-config-node/tradfri-config'
import tradfriMonitorNode from '../src/tradfri-monitor-node/tradfri-monitor'

describe('Tradfri monitor node', () => {
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
        type: 'tradfri-monitor',
        name: 'monitor',
        gateway: 'n1',
      },
    ]
    await helper.load([tradfriConfigNode, tradfriMonitorNode], flow, {
      n1: {
        identity: 'id1',
        preSharedKey: 'psk',
      },
    })

    const n2 = helper.getNode('n2') as any
    expect(n2.gateway.client).toBe(mockTradfriClient)
  })

  it('should output changes to devices', async () => {
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
        type: 'tradfri-monitor',
        name: 'monitor',
        gateway: 'n1',
        wires: [['n3']],
      },
      {
        id: 'n3',
        type: 'helper',
      },
    ]
    await helper.load([tradfriConfigNode, tradfriMonitorNode], flow, {
      n1: {
        identity: 'id1',
        preSharedKey: 'psk',
      },
    })

    const n3 = helper.getNode('n3')

    // Add device
    const registerDeviceUpdatedHandlerCallArgs =
      mockTradfriClient.on.mock.calls.find(
        (call): call is ['device updated', (accessory: any) => void] =>
          Array.isArray(call) && call[0] === 'device updated'
      )
    if (!registerDeviceUpdatedHandlerCallArgs) {
      return fail(
        new Error('No call found to client.on for event "device updated"')
      )
    }
    const deviceUpdatedHandler = registerDeviceUpdatedHandlerCallArgs[1]

    const deviceUpdatedMessagePromise = new Promise((r) => {
      n3.once('input', (message) => {
        r(message)
      })
    })

    deviceUpdatedHandler({
      type: 0,
      instanceId: 1,
      name: 'ac1',
      alive: true,
      lastSeen: Math.floor(Date.now() / 1000),
      deviceInfo: {
        power: 0,
      },
      lightList: [
        {
          onOff: true,
          isDimmable: false,
          spectrum: 'none',
        },
      ],
    })

    await expect(deviceUpdatedMessagePromise).resolves.toMatchObject({
      topic: 1,
      payload: {
        event: 'device updated',
        type: 'lightbulb',
        instanceId: 1,
        name: 'ac1',
        alive: true,
        lastSeen: expect.any(String),
        deviceInfo: {
          power: 'Unknown',
        },
        lightbulb: {
          isDimmable: false,
          isOn: true,
          spectrum: 'none',
        },
      },
    })

    // Remove device
    const registerDeviceRemovedHandlerCallArgs =
      mockTradfriClient.on.mock.calls.find(
        (call): call is ['device removed', (accessoryId: number) => void] =>
          Array.isArray(call) && call[0] === 'device removed'
      )
    if (!registerDeviceRemovedHandlerCallArgs) {
      return fail(
        new Error('No call found to client.on for event "device removed"')
      )
    }
    const deviceRemovedHandler = registerDeviceRemovedHandlerCallArgs[1]

    const deviceRemovedMessagePromise = new Promise((r) => {
      n3.once('input', (message) => {
        r(message)
      })
    })

    deviceRemovedHandler(1)

    await expect(deviceRemovedMessagePromise).resolves.toMatchObject({
      topic: 1,
      payload: {
        event: 'device removed',
        instanceId: 1,
      },
    })
  })

  it('should output changes to groups', async () => {
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
        type: 'tradfri-monitor',
        name: 'monitor',
        gateway: 'n1',
        wires: [['n3']],
      },
      {
        id: 'n3',
        type: 'helper',
      },
    ]
    await helper.load([tradfriConfigNode, tradfriMonitorNode], flow, {
      n1: {
        identity: 'id1',
        preSharedKey: 'psk',
      },
    })

    const n3 = helper.getNode('n3')

    // Add group
    const registerGroupUpdatedHandlerCallArgs =
      mockTradfriClient.on.mock.calls.find(
        (call): call is ['group updated', (accessory: any) => void] =>
          Array.isArray(call) && call[0] === 'group updated'
      )
    if (!registerGroupUpdatedHandlerCallArgs) {
      return fail(
        new Error('No call found to client.on for event "group updated"')
      )
    }
    const groupUpdatedHandler = registerGroupUpdatedHandlerCallArgs[1]

    const groupUpdatedMessagePromise = new Promise((r) => {
      n3.once('input', (message) => {
        r(message)
      })
    })

    groupUpdatedHandler({
      instanceId: 2,
      name: 'g1',
      deviceIDs: [1],
      onOff: true,
      dimmer: 100,
      createdAt: Math.floor(Date.now() / 1000),
      transitionTime: 500,
    })

    await expect(groupUpdatedMessagePromise).resolves.toMatchObject({
      topic: 2,
      payload: {
        event: 'group updated',
        instanceId: 2,
        name: 'g1',
        deviceIds: [1],
        isOn: true,
        dimmer: 100,
        createdAt: expect.any(String),
        transitionTime: 500,
      },
    })

    // Remove group
    const registerGroupRemovedHandlerCallArgs =
      mockTradfriClient.on.mock.calls.find(
        (call): call is ['group removed', (accessoryId: number) => void] =>
          Array.isArray(call) && call[0] === 'group removed'
      )
    if (!registerGroupRemovedHandlerCallArgs) {
      return fail(
        new Error('No call found to client.on for event "group removed"')
      )
    }
    const groupRemovedHandler = registerGroupRemovedHandlerCallArgs[1]

    const groupRemovedMessagePromise = new Promise((r) => {
      n3.once('input', (message) => {
        r(message)
      })
    })

    groupRemovedHandler(2)

    await expect(groupRemovedMessagePromise).resolves.toMatchObject({
      topic: 2,
      payload: {
        event: 'group removed',
        instanceId: 2,
      },
    })
  })
})
