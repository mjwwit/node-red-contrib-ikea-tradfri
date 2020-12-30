import { Node, NodeAPI, NodeConstructor, NodeDef } from 'node-red'
import {
  Accessory,
  discoverGateway,
  Group,
  TradfriClient,
  TradfriError,
  TradfriErrorCodes,
} from 'node-tradfri-client'

export interface TradfriCredentials {
  identity: string
  preSharedKey: string
}

export interface TradfriConfigNode extends Node<TradfriCredentials> {
  gatewayHost: string
  client: TradfriClient
  accessories: Map<number, Accessory>
  groups: Map<number, Group>
}

interface TradfriConfigNodeDef extends NodeDef {
  gatewayHost: string
  securityCode: string
}

const TRADFRI_ERROR_CODES: Record<TradfriErrorCodes, string> = {
  '0': 'ConnectionFailed',
  '1': 'ConnectionTimedOut',
  '2': 'AuthenticationFailed',
  '3': 'NetworkReset',
}

module.exports = (RED: NodeAPI) => {
  const tradfriConfigNodeConstructor: NodeConstructor<
    TradfriConfigNode,
    TradfriConfigNodeDef,
    TradfriCredentials
  > = async function (nodeDef) {
    RED.nodes.createNode(this, nodeDef)
    this.name = nodeDef.name
    this.gatewayHost = nodeDef.gatewayHost
    this.accessories = new Map<number, Accessory>()

    this.client = new TradfriClient(this.gatewayHost, {
      watchConnection: {
        maximumReconnects: 5,
        maximumConnectionAttempts: 3,
      },
    })

    this.on('close', () => {
      this.client.destroy()
    })

    this.client.on('error', (e) => {
      const error = e as TradfriError
      this.error(
        `An error occurred with the TRADFRI gateway: ${
          TRADFRI_ERROR_CODES[error.code]
        }`
      )
    })

    try {
      if (!this.credentials.identity || !this.credentials.preSharedKey) {
        const { identity, psk } = await this.client.authenticate(
          nodeDef.securityCode
        )
        this.credentials.identity = identity
        this.credentials.preSharedKey = psk
      }

      await this.client.connect(
        this.credentials.identity,
        this.credentials.preSharedKey
      )

      this.log('Connected to TRADFRI gateway')

      await this.client
        .on('device updated', (accessory) => {
          this.accessories.set(accessory.instanceId, accessory)
        })
        .on('device removed', (instanceId) => {
          this.accessories.delete(instanceId)
        })
        .on('group updated', (group) => {
          this.groups.set(group.instanceId, group)
        })
        .on('group removed', (instanceId) => {
          this.groups.delete(instanceId)
        })
        .observeDevices()
    } catch (e) {
      const error = e as TradfriError
      this.error(
        `An error occurred while authenticating or connecting with the TRADFRI gateway: ${
          TRADFRI_ERROR_CODES[error.code]
        }`
      )
    }
  }

  RED.httpAdmin.get('/tradfri/gateway', (_req, res) => {
    discoverGateway(5000)
      .then((gateway) => {
        res
          .status(200)
          .json(gateway ? gateway.host || gateway.addresses[0] : null)
      })
      .catch((e: Error) => {
        res.status(500).json({
          ...e,
          name: e.name,
          message: e.message,
          stack: e.stack,
        })
      })
  })

  RED.nodes.registerType('tradfri-config', tradfriConfigNodeConstructor, {
    credentials: {
      identity: { type: 'text' },
      preSharedKey: { type: 'text' },
    },
  })
}
