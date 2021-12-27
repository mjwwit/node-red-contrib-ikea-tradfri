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
  operateBlind: jest.Mock
  operateGroup: jest.Mock
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
  operateBlind: jest.fn().mockRejectedValue('Unexpected call to operateBlind'),
  operateGroup: jest.fn().mockRejectedValue('Unexpected call to operateGroup'),
}
const mockTradfriClientConstructor = jest
  .fn()
  .mockImplementation(() => mockTradfriClient)
const mockDiscoverGateway = jest
  .fn()
  .mockRejectedValue(new Error('Unexpected call to discoverGateway'))
jest.mock('node-tradfri-client', () => ({
  AccessoryTypes: {
    blind: 0,
  },
  PowerSources: {
    Unknown: 0,
  },
  discoverGateway: mockDiscoverGateway,
  TradfriClient: mockTradfriClientConstructor,
}))

import tradfriConfigNode from '../src/tradfri-config-node/tradfri-config'
import tradfriBlindControlNode from '../src/tradfri-blind-control-node/tradfri-blind-control'

describe('Tradfri light control node', () => {
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
        type: 'tradfri-blind-control',
        name: 'close blind',
        gateway: 'n1',
        action: '{"operation":"setPosition","position":0}',
        accessories: [1],
        groups: [2],
      },
    ]
    await helper.load([tradfriConfigNode, tradfriBlindControlNode], flow, {
      n1: {
        identity: 'id1',
        preSharedKey: 'psk',
      },
    })

    const n2 = helper.getNode('n2') as any
    expect(n2.action).toEqual({ operation: 'setPosition', position: 0 })
    expect(n2.accessories).toEqual([1])
    expect(n2.groups).toEqual([2])
  })

  it('should control blinds and groups', async () => {
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
        type: 'tradfri-blind-control',
        name: 'open blinds',
        gateway: 'n1',
        action: '{"operation":"setPosition","position":100}',
        accessories: ['1'],
        groups: ['2'],
      },
    ]
    await helper.load([tradfriConfigNode, tradfriBlindControlNode], flow, {
      n1: {
        identity: 'id1',
        preSharedKey: 'psk',
      },
    })

    const n2 = helper.getNode('n2')

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
    deviceUpdatedHandler({
      instanceId: 1,
      name: 'ac1',
      type: 0,
    })

    // Add group
    const registerGroupUpdatedHandlerCallArgs =
      mockTradfriClient.on.mock.calls.find(
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
    })

    // Opening

    expect(mockTradfriClient.operateBlind).not.toHaveBeenCalled()
    expect(mockTradfriClient.operateGroup).not.toHaveBeenCalled()

    n2.receive({})

    expect(mockTradfriClient.operateBlind).toHaveBeenCalledWith(
      {
        instanceId: 1,
        name: 'ac1',
        type: 0,
      },
      expect.objectContaining({ position: 100 })
    )
    expect(mockTradfriClient.operateGroup).toHaveBeenCalledWith(
      {
        instanceId: 2,
        name: 'g1',
      },
      expect.objectContaining({ position: 100 })
    )

    // Stopping

    n2.receive({ payload: { operation: 'stop' } })

    expect(mockTradfriClient.operateBlind).toHaveBeenCalledWith(
      {
        instanceId: 1,
        name: 'ac1',
        type: 0,
      },
      expect.objectContaining({ trigger: 0 })
    )
    expect(mockTradfriClient.operateGroup).toHaveBeenCalledWith(
      {
        instanceId: 2,
        name: 'g1',
      },
      expect.objectContaining({ trigger: 0 })
    )
  })
})
