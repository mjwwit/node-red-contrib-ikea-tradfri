# Node-RED IKEA TRÅDFRI
Node-RED nodes to get updates from and control devices connected to an IKEA TRÅDFRI gateway. This project is based on [AlCalzone](https://github.com/AlCalzone)'s excellent [node-tradfri-client](https://github.com/AlCalzone/node-tradfri-client) module, which does not utilize any compiled binaries.

## Installation
```
npm install node-red-contrib-ikea-tradfri
```

Alternatively, you can install this module through the editor UI palette.

## Documentation
This module contains 5 nodes:
- tradfri-config for connecting to the gateway
- tradfri-switch-control for controlling on/off capable devices (plugs and lightbulbs)
- tradfri-monitor for monitoring devices and groups
- tradfri-state for retrieving the current state of one or more devices and/or groups
- tradfri-light-control for controlling dimmable and rgb lights

### tradfri-config
This node is responsible for connecting to an IKEA TRÅDFRI gateway on your network. An attempt is made to automatically discover a gateway on the network. If this is unsuccessful a valid hostname or ip-address has to be entered. You also need to enter the gateways security code, as printed on the sticker on the bottom of the gateway. As per IKEA's guidelines, this code is not stored in Node-RED, instead, only the identity and pre-shared key returned after successful authentication are stored within the node.

This node does not appear as a dedicated node in the palette. Gateways are configured in the settings of one of the other nodes.

### tradfri-switch-control
This node is able to control on/off capable devices connected to the gateway. It can do so in 2 different ways:

- you can configure which specific devices and/or groups to control within the nodes configuration,
- or you can specify these devices and/or groups in the input message passed to this node.

If both are specified, the node will pick the action (on or off) from the message, but execute that action on all devices and groups given in both the node configuration and the input message. Any combination of these input message and configuration properties is also possible.

#### Input
```json
{
  "topic": [1, 2],
  "payload": "on"
}

{
  "topic": 1,
  "payload": "off"
}

{
  "topic": 1,
}

{
  "payload": "on",
}

{}
```

### tradfri-monitor
This node will send messages when a device or group is updated or removed. Examples for updates are buttons presses, change of brightness or a switch being turned on. The message will contain all available details for the device or group. Due to how this system works these update messages are also sent when reconnecting to the gateway after a flow deploy.

Depending on the type of event, `payload.event` will have a different value.

In case of the `"device updated"` event, depending on the type of the updated device one of the `blind`, `lightbulb`, `sensor`, or `plug` properties will be set and the others will be `undefined`.

#### Output
```json
{
  "topic": 1,
  "payload": {
    "event": "device updated",
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
      "serialNumber": "device serial number if available (numeric)"
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

{
  "topic": 1,
  "payload": {
    "event": "device removed",
    "instanceId": 1
  }
}

{
  "topic": 1,
  "payload": {
    "event": "group updated",
    "instanceId": 1,
    "name": "the human friendly group name",
    "deviceIds": [2],
    "isOn": true,
    "dimmer": 65,
    "position": 0,
    "transitionTime": 500,
    "createdAt": "2021-01-01T12:00:00Z"
  }
}
```

### tradfri-state
This node will retrieve the current state of one or more devices and/or groups. The output message will contain all available details for the devices and/or groups.

In case of device state, depending on the type of the updated device one of the `blind`, `lightbulb`, `sensor`, or `plug` properties will be set and the others will be `undefined`.


#### Input
```json
{
  "topic": [1, 2]
}

{
  "topic": 1
}

{}
```

#### Output
```json
{
  "topic": [1, 2],
  "payload": {
    "1": {
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
    },
    "2": {
      "type": "group",
      "instanceId": 2,
      "name": "the human friendly device name",
      "deviceIds": [3],
      "isOn": true,
      "dimmer": 65,
      "position": 0,
      "transitionTime": 500,
      "createdAt": "2021-01-01T12:00:00Z"
    }
  }
}
```

### tradfri-light-control
This node is able to control lights connected to the gateway. It can do so in 2 different ways:

- you can configure which specific devices and/or groups to control within the nodes configuration,
- or you can specify these devices and/or groups in the input message passed to this node.

If both are specified, the node will pick the action (on or off) from the message, but execute that action on all devices and groups given in both the node configuration and the input message. Any combination of these input message and configuration properties is also possible.

The node is able to control dimmable lights, white spectrum lights, and RGB lights.

#### Input
```json
{
  "topic": [1, 2],
  "payload": {
    "onOff": true,
    "brightness": 50
  }
}

{
  "topic": 1,
  "payload": {
    "colorTemperature": 75,
    "brightness": 75
  }
}

{
  "topic": 1,
}

{
  "payload": {
    "color": "#ff0000",
    "brightness": 75
  },
}

{}
```

### tradfri-blind-control
This node is able to control blinds connected to the gateway. It can do so in 2 different ways:

- you can configure which specific devices and/or groups to control within the nodes configuration,
- or you can specify these devices and/or groups in the input message passed to this node.

If both are specified, the node will pick the operation from the message, but execute that action on all devices and groups given in both the node configuration and the input message. Any combination of these input message and configuration properties is also possible.

The node is able to control smart blinds.

#### Input
```json
{
  "topic": [1, 2],
  "payload": {
    "operation": "setPosition",
    "position": 50
  }
}

{
  "topic": 1,
  "payload": {
    "operation": "stop"
  }
}

{
  "topic": 1,
}

{
  "payload": {
    "operation": "setPosition"
  },
}

{}
```

## Changelog

### 0.5.0
- Add tradfri-blind-control node to control window blinds
- Dropped support for Node.js 10 (minimum is now 12)

### 0.4.8
- Fix issue with RGB bulbs always turning white when changing color
- Fix issue with RGB bulbs not remembering their color when turning on

### 0.4.7
- Add support for TRADFRI Gateway version 1.15.34

### 0.4.6
- Fix issue with setting colorTemperature through node config not working

### 0.4.5
- Fix issue where setting brightness of lights turns them off

### 0.4.4
- Fix issue where setting colorTemperature or color of lights turns off lights

### 0.4.3
- Add feedback for errors during gateway authentication
- Fix issue where authentication failed when Node-RED was hosted on a custom path

### 0.4.2
- Improve error reporting

### 0.4.1
- Fix combined tradfri-light-control action from input message and node configuration
- Fix event listener memory leak

### 0.4.0
- Add tradfri-light-control node to control dimmable and rgb lights

### 0.3.1
- Use node config when an invalid message is sent to tradfri-state or tradfri-switch-control

### 0.3.0
- Change node name of tradfri-status to tradfri-monitor
- Add tradfri-state node to get the current state of one or more devices / groups
- Include a polyfill for `Array.prototype.flat`

### 0.2.0
- Add node status to both tradfri-status and tradfri-switch-control nodes
- Switch from custom message properties to `payload` and `topic`
- Allow tradfri-status to watch for group updates as well
- Improve node help
- Support Node.js 10 by including a `Promise.allSettled` polyfill

### 0.1.0
- Initial release
