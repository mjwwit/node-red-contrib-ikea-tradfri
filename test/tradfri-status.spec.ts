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
import tradfriStatusNode from '../src/tradfri-status-node/tradfri-status'

describe('Tradfri switch control node', () => {
  afterEach(async () => {
    await helper.unload()
    jest.clearAllMocks()
  })

  it('should expose the configured action, accessories, and groups', async () => {
    mockTradfriClient.connect.mockResolvedValueOnce(void 0)
    mockTradfriClient.observeDevices.mockResolvedValueOnce(void 0)
    mockTradfriClient.observeGroupsAndScenes.mockResolvedValueOnce(void 0)

    const flow = [
      {
        id: 'n1',
        type: 'tradfri-config',
        name: 'test gateway',
        gatewayHost: 'host',
      },
      {
        id: 'n2',
        type: 'tradfri-status',
        name: 'monitor',
        gateway: 'n1',
      },
    ]
    await helper.load([tradfriConfigNode, tradfriStatusNode], flow, {
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

    const flow = [
      {
        id: 'n1',
        type: 'tradfri-config',
        name: 'test gateway',
        gatewayHost: 'host',
      },
      {
        id: 'n2',
        type: 'tradfri-status',
        name: 'monitor',
        gateway: 'n1',
        wires: [['n3']],
      },
      {
        id: 'n3',
        type: 'helper',
      },
    ]
    await helper.load([tradfriConfigNode, tradfriStatusNode], flow, {
      n1: {
        identity: 'id1',
        preSharedKey: 'psk',
      },
    })

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

    const messagePromise = new Promise((r) => {
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

    await expect(messagePromise).resolves.toMatchObject({
      updatedDevice: {
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
  })
})
