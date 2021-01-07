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
    lightbulb: 2,
    plug: 3,
  },
  PowerSources: {
    Unknown: 0,
  },
  discoverGateway: mockDiscoverGateway,
  TradfriClient: mockTradfriClientConstructor,
}))

import tradfriConfigNode from '../src/tradfri-config-node/tradfri-config'
import tradfriStateNode from '../src/tradfri-state-node/tradfri-state'

describe('Tradfri state node', () => {
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
        type: 'tradfri-state',
        name: 'get state of stuff',
        gateway: 'n1',
        accessories: [1],
        groups: [2],
      },
    ]
    await helper.load([tradfriConfigNode, tradfriStateNode], flow, {
      n1: {
        identity: 'id1',
        preSharedKey: 'psk',
      },
    })

    const n2 = helper.getNode('n2') as any
    expect(n2.accessories).toEqual([1])
    expect(n2.groups).toEqual([2])
  })

  it('should get state of accessories and groups', async () => {
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
        type: 'tradfri-state',
        name: 'get state of stuff',
        gateway: 'n1',
        accessories: ['1'],
        groups: ['2'],
        wires: [['n3']],
      },
      {
        id: 'n3',
        type: 'helper',
      },
    ]
    await helper.load([tradfriConfigNode, tradfriStateNode], flow, {
      n1: {
        identity: 'id1',
        preSharedKey: 'psk',
      },
    })

    const n2 = helper.getNode('n2')
    const n3 = helper.getNode('n3')

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
      type: 2,
      name: 'ac1',
      alive: true,
      lastSeen: Math.floor(Date.now() / 1000),
      deviceInfo: {
        power: 0,
      },
      lightList: [{ onOff: true }],
    })
    deviceUpdatedHandler({
      instanceId: 3,
      type: 3,
      name: 'ac2',
      alive: true,
      lastSeen: Math.floor(Date.now() / 1000),
      deviceInfo: {
        power: 0,
      },
      plugList: [{ onOff: false }],
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
      onOff: false,
      deviceIDs: [3],
      createdAt: Math.floor(Date.now() / 1000),
    })

    const stateMessagePromise1 = new Promise((r) => {
      n3.once('input', (message) => {
        r(message)
      })
    })

    // Getting state of configured accessories and groups
    n2.receive({})

    await expect(stateMessagePromise1).resolves.toMatchObject({
      topic: [1, 2],
      payload: {
        1: {
          type: 'lightbulb',
          instanceId: 1,
          name: 'ac1',
          alive: true,
          lastSeen: expect.any(String),
          deviceInfo: {
            power: 'Unknown',
          },
          lightbulb: {
            isOn: true,
          },
        },
        2: {
          type: 'group',
          instanceId: 2,
          name: 'g1',
          isOn: false,
          deviceIds: [3],
          createdAt: expect.any(String),
        },
      },
    })

    // Also getting state of input message accessories and groups
    const stateMessagePromise2 = new Promise((r) => {
      n3.once('input', (message) => {
        r(message)
      })
    })

    n2.receive({ topic: 3 } as any)

    await expect(stateMessagePromise2).resolves.toMatchObject({
      topic: expect.arrayContaining([1, 2, 3]),
      payload: {
        1: {
          type: 'lightbulb',
          instanceId: 1,
          name: 'ac1',
          alive: true,
          lastSeen: expect.any(String),
          deviceInfo: {
            power: 'Unknown',
          },
          lightbulb: {
            isOn: true,
          },
        },
        2: {
          type: 'group',
          instanceId: 2,
          name: 'g1',
          isOn: false,
          deviceIds: [3],
          createdAt: expect.any(String),
        },
        3: {
          type: 'plug',
          instanceId: 3,
          name: 'ac2',
          alive: true,
          lastSeen: expect.any(String),
          deviceInfo: {
            power: 'Unknown',
          },
          plug: {
            isOn: false,
          },
        },
      },
    })
  })
})
