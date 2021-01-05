# Node-RED IKEA TRÅDFRI
Node-RED nodes to get updates from and control devices connected to an IKEA TRADFRI gateway. This project is based on [AlCalzone](https://github.com/AlCalzone)'s excellent [node-tradfri-client](https://github.com/AlCalzone/node-tradfri-client) module, which does not utilize any compiled binaries.

## Installation
```
npm install node-red-contrib-ikea-tradfri
```

Alternatively, you can install this module through the editor UI palette.

## Documentation
This module contains 3 nodes:
- tradfri-config for connecting to the gateway
- tradfri-switch-control for controlling on/off capable devices (plugs and lightbulbs)
- tradfri-status for monitoring device status

### tradfri-config
This node is responsible for connecting to an IKEA TRÅDFRI gateway on your network. An attempt is made to automatically discover a gateway on the network. If this is unsuccessful a valid hostname or ip-address has to be entered. You also need to enter the gateways security code, as printed on the sticker on the bottom of the gateway. As per IKEA's guidelines, this code is not stored in Node-RED, instead, only the identity and pre-shared key returned after successful authentication are stored within the node.

### tradfri-switch-control
This node is able to control on/off capable devices connected to the gateway. It can do so in 2 different ways:

- you can configure which specific devices and/or groups to control within the nodes configuration,
- or you can specify these devices and/or groups in the input message passed to this node.

If both are specified, the node will pick the action (on or off) from the message, but execute that action on all devices and groups given in both the node configuration and the input message. Any combination of these input message and configuration properties is also possible.

#### Input
```json
{
  "switchControl": {
    "action": "on/off",
    "accessories": [1, 2, 3],
    "groups": [1, 2, 3]
  }
}
```

### tradfri-status
This node will send messages when a device state is updated. The message will contain all the specific details for the updated device. Due to how this system works these update messages are also sent when reconnecting to the gateway after a flow deploy.

Depending on the type of the updated device one of the `blind`, `lightbulb`, `sensor`, or `plug` properties will be set and the others will be `undefined`.

#### Output
```json
{
  "updatedDevice": {
    "type": "device type (lightbulb, plug, motionSensor, etc.)",
    "instanceId": 1,
    "name": "the human friendly device name",
    "alive": true,
    "lastSeen": "ISO8601 date when the device was last seen",
    "deviceInfo": {
      "battery": 100,
      "firmwareVersion": "version",
      "manufacturer": "device manufacturer",
      "modelNumber": "model number if available",
      "power": "power source (Battery, ACPower, Solar, etc.)",
      "serialNumber": "device serial number if available"
    },
    "blind": {
      "position": 50,
    },
    "lightbulb": {
      "color": "hexadecimal rgb color string",
      "colorTemperature": 65,
      "dimmer": 50,
      "hue": 0,
      "isDimmable": true,
      "isOn": true,
      "saturation": 0,
      "spectrum": "bulb color spectrum (none, white, or rgb)"
    },
    "sensor": {
      "sensorType": "sensor type (motionSensor)",
      "minRangeValue": 0,
      "minMeasuredValue": 10,
      "maxMeasuredValue": 90,
      "maxRangeValue": 100,
      "sensorValue": 25
    },
    "plug": {
      "isOn": true,
      "isSwitchable": true
    }
  }
}
```

## Changelog

### 0.1.0
- Initial release
