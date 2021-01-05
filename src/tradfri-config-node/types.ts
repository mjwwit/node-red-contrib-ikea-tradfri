import { Accessory, Group, TradfriClient } from 'node-tradfri-client'
import { Node } from 'node-red'

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
