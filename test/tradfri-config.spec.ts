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
  discoverGateway: mockDiscoverGateway,
  TradfriClient: mockTradfriClientConstructor,
}))

import tradfriConfigNode from '../src/tradfri-config-node/tradfri-config'
import { TradfriConfigNode } from '../src/tradfri-config-node/types'

describe('Tradfri config node', () => {
  afterEach(async () => {
    await helper.unload()
    jest.clearAllMocks()
  })

  it('should expose the gateway client', async () => {
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
    ]
    await helper.load(tradfriConfigNode, flow, {
      n1: {
        identity: 'id1',
        preSharedKey: 'psk',
      },
    })
    expect(mockTradfriClientConstructor).toHaveBeenCalledWith('host', {
      watchConnection: {
        maximumReconnects: 5,
        maximumConnectionAttempts: 3,
      },
    })
    expect(mockTradfriClient.connect).toHaveBeenCalledWith('id1', 'psk')
    expect(mockTradfriClient.observeDevices).toHaveBeenCalled()
    expect(mockTradfriClient.observeGroupsAndScenes).toHaveBeenCalled()

    const n1 = helper.getNode('n1') as TradfriConfigNode
    expect(n1.client).toBe(mockTradfriClient)
  })

  it('should monitor devices and groups', async () => {
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
    ]
    await helper.load(tradfriConfigNode, flow, {
      n1: {
        identity: 'id1',
        preSharedKey: 'psk',
      },
    })

    const n1 = helper.getNode('n1') as TradfriConfigNode
    expect(n1.accessories.size).toBe(0)
    expect(n1.groups.size).toBe(0)

    // Device updated
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
    deviceUpdatedHandler({ instanceId: 1, name: 'ac1' })

    expect(n1.accessories.size).toBe(1)
    expect(n1.accessories.get(1)).toEqual({ instanceId: 1, name: 'ac1' })

    // Group updated
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
    groupUpdatedHandler({ instanceId: 2, name: 'g1' })

    expect(n1.groups.size).toBe(1)
    expect(n1.groups.get(2)).toEqual({ instanceId: 2, name: 'g1' })
  })

  it('should expose endpoints to discover, authenticate, retrieve devices, and retrieve groups', async () => {
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
    ]
    await helper.load(tradfriConfigNode, flow, {
      n1: {
        identity: 'id1',
        preSharedKey: 'psk',
      },
    })

    // Discover gateway
    mockDiscoverGateway.mockResolvedValueOnce({ host: 'gateway.host' })
    await helper.request().get('/tradfri/gateway').expect(200, '"gateway.host"')

    // Authenticate
    mockTradfriClient.authenticate.mockResolvedValueOnce({
      identity: 'id2',
      psk: 'psk2',
    })
    await helper
      .request()
      .post('/tradfri/gateway/gateway.host/authenticate')
      .send({ securityCode: 'code' })
      .expect(201, JSON.stringify({ identity: 'id2', preSharedKey: 'psk2' }))

    // Get accessories
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
    deviceUpdatedHandler({ instanceId: 1, name: 'ac1', type: '0' })
    await helper
      .request()
      .get('/tradfri/gateway/n1/accessories')
      .expect(
        200,
        JSON.stringify([{ name: 'ac1', instanceId: 1, type: 'lightbulb' }])
      )

    // Get groups
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
    groupUpdatedHandler({ instanceId: 2, name: 'g1' })
    await helper
      .request()
      .get('/tradfri/gateway/n1/groups')
      .expect(200, JSON.stringify([{ name: 'g1', instanceId: 2 }]))
  })
})
