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
  > = function (nodeDef) {
    RED.nodes.createNode(this, nodeDef)
    this.name = nodeDef.name
    this.gatewayHost = nodeDef.gatewayHost
    this.accessories = new Map<number, Accessory>()
    this.groups = new Map<number, Group>()

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
        `An error occurred while communicating with the TRADFRI gateway: ${
          TRADFRI_ERROR_CODES[error.code]
        }`
      )
    })

    this.client
      .connect(this.credentials.identity, this.credentials.preSharedKey)
      .then(() => {
        this.log('Connected to TRADFRI gateway')

        return Promise.all([
          this.client
            .on('device updated', (accessory) => {
              this.log(
                `Accessory updated: ${accessory.instanceId} ${accessory.name}`
              )
              this.accessories.set(accessory.instanceId, accessory)
            })
            .on('device removed', (instanceId) => {
              this.log(`Accessory removed: ${instanceId}`)
              this.accessories.delete(instanceId)
            })
            .observeDevices(),
          this.client
            .on('group updated', (group) => {
              this.log(`Group updated: ${group.instanceId} ${group.name}`)
              this.groups.set(group.instanceId, group)
            })
            .on('group removed', (instanceId) => {
              this.log(`Group removed: ${instanceId}`)
              this.groups.delete(instanceId)
            })
            .observeGroupsAndScenes(),
        ])
      })
      .catch((e: TradfriError) => {
        this.error(
          `An error occurred while connecting with the TRADFRI gateway: ${
            TRADFRI_ERROR_CODES[e.code]
          }`
        )
      })
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

  RED.httpAdmin.post<{ address: string }, any, { securityCode?: string }>(
    '/tradfri/gateway/:address/authenticate',
    (req, res) => {
      if (
        typeof req.body !== 'object' ||
        typeof req.body.securityCode !== 'string'
      ) {
        res.status(400).send('Bad Request')
        return
      }
      const client = new TradfriClient(req.params.address)
      client
        .authenticate(req.body.securityCode)
        .then(({ identity, psk }) => {
          res.status(201).json({
            identity,
            preSharedKey: psk,
          })
        })
        .catch((e: Error) => {
          res.status(500).json({
            ...e,
            name: e.name,
            message: e.message,
            stack: e.stack,
          })
        })
    }
  )

  RED.httpAdmin.get<{ node: string }>(
    '/tradfri/gateway/:node/accessories',
    (req, res) => {
      const gateway = RED.nodes.getNode(req.params.node) as
        | TradfriConfigNode
        | undefined
      if (!gateway) {
        RED.log.warn(`Unable to find tradfri-config node "${req.params.node}"`)
        res.status(404).send('Not found')
        return
      }
      res.status(200).json(
        gateway.accessories &&
          Array.from(gateway.accessories.values()).map((a) => ({
            name: a.name,
            instanceId: a.instanceId,
          }))
      )
    }
  )

  RED.httpAdmin.get<{ node: string }>(
    '/tradfri/gateway/:node/groups',
    (req, res) => {
      const gateway = RED.nodes.getNode(req.params.node) as
        | TradfriConfigNode
        | undefined
      if (!gateway) {
        RED.log.warn(`Unable to find tradfri-config node "${req.params.node}"`)
        res.status(404).send('Not found')
        return
      }
      res.status(200).json(
        gateway.groups &&
          Array.from(gateway.groups.values()).map((g) => ({
            name: g.name,
            instanceId: g.instanceId,
          }))
      )
    }
  )

  RED.nodes.registerType('tradfri-config', tradfriConfigNodeConstructor, {
    credentials: {
      identity: { type: 'text' },
      preSharedKey: { type: 'text' },
    },
  })
}
