import { Node, NodeAPI, NodeConstructor, NodeDef } from 'node-red'
import { TradfriConfigNode } from '../tradfri-config-node/tradfri-config'

interface TradfriControlNode extends Node<Record<string, never>> {
  gateway: Node<TradfriConfigNode>
}

interface TradfriControlNodeDef extends NodeDef {
  gateway: string
}

module.exports = (RED: NodeAPI) => {
  const tradfriControlNodeConstructor: NodeConstructor<
    TradfriControlNode,
    TradfriControlNodeDef,
    Record<string, never>
  > = function (nodeDef) {
    RED.nodes.createNode(this, nodeDef)

    this.gateway = RED.nodes.getNode(nodeDef.gateway) as Node<TradfriConfigNode>


  }

  RED.nodes.registerType('tradfri-control', tradfriControlNodeConstructor)
}
