import { Node, NodeAPI, NodeConstructor, NodeDef, NodeMessage } from 'node-red'
import {
  createDeviceState,
  createGroupState,
  TradfriDeviceState,
  TradfriGroupState,
} from '../common/tradfri-state-to-payload'
import { TradfriConfigNode } from '../tradfri-config-node/types'

interface TradfriMonitorNode extends Node<Record<string, never>> {
  gateway: TradfriConfigNode
}

interface TradfriMonitorNodeDef extends NodeDef {
  gateway: string
}

interface TradfriDeviceUpdatedMessage extends NodeMessage {
  topic: number
  payload: {
    event: 'device updated'
  } & TradfriDeviceState
}

interface TradfriDeviceRemovedMessage extends NodeMessage {
  topic: number
  payload: {
    event: 'device removed'
    instanceId: number
  }
}

interface TradfriGroupUpdatedMessage extends NodeMessage {
  topic: number
  payload: {
    event: 'group updated'
  } & TradfriGroupState
}

interface TradfriGroupRemovedMessage extends NodeMessage {
  topic: number
  payload: {
    event: 'group removed'
    instanceId: number
  }
}

export = (RED: NodeAPI): void | Promise<void> => {
  const tradfriMonitorNodeConstructor: NodeConstructor<
    TradfriMonitorNode,
    TradfriMonitorNodeDef,
    Record<string, never>
  > = function (nodeDef) {
    RED.nodes.createNode(this, nodeDef)

    this.gateway = RED.nodes.getNode(nodeDef.gateway) as TradfriConfigNode

    const setConnected = () => {
      this.status({ fill: 'green', shape: 'dot', text: 'connected' })
    }

    const setDisconnected = () => {
      this.status({ fill: 'red', shape: 'ring', text: 'disconnected' })
    }

    const setConnecting = () => {
      this.status({ fill: 'yellow', shape: 'ring', text: 'connecting...' })
    }

    setConnecting()

    this.gateway.client
      .on('connection alive', setConnected)
      .on('connection lost', setDisconnected)
      .on('connection failed', setDisconnected)
      .on('reconnecting', setConnecting)
      .on('ping succeeded', setConnected)
      .on('ping failed', setDisconnected)
      .ping()
      .catch((err) => {
        this.error(`Unable to ping gateway! ${String(err)}`)
      })

    this.gateway.client.on('device updated', (accessory) => {
      const message: TradfriDeviceUpdatedMessage = {
        topic: accessory.instanceId,
        payload: {
          event: 'device updated',
          ...createDeviceState(accessory),
        },
      }
      this.send(message)
    })

    this.gateway.client.on('device removed', (instanceId) => {
      const message: TradfriDeviceRemovedMessage = {
        topic: instanceId,
        payload: {
          event: 'device removed',
          instanceId,
        },
      }
      this.send(message)
    })

    this.gateway.client.on('group updated', (group) => {
      const message: TradfriGroupUpdatedMessage = {
        topic: group.instanceId,
        payload: {
          event: 'group updated',
          ...createGroupState(group),
        },
      }
      this.send(message)
    })

    this.gateway.client.on('group removed', (instanceId) => {
      const message: TradfriGroupRemovedMessage = {
        topic: instanceId,
        payload: {
          event: 'group removed',
          instanceId,
        },
      }
      this.send(message)
    })
  }

  RED.nodes.registerType('tradfri-monitor', tradfriMonitorNodeConstructor)
}
