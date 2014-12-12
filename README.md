# Adding Intelligence to Amazon Lambda

## Introduction

You might have noticed that we at 2lemetry are pretty excited about Amazon's newest AWS product [Lambda](http://aws.amazon.com/lambda/). Several engineers [experimented](http://2lemetry.com/tag/lambda/) with how lambdas function and work together with the MQTT protocol and [ThingFabric](https://app.thingfabric.com). I decided to work on a small high level experiment that involves real computations to see how neural networks can be used inside lambdas in the context of the Internet of Things. I'm going to heavily utilize the MQTT foundation described by Kyle, our CEO, in his recent [blog post](http://2lemetry.com/2014/12/05/native-mqtt-lambda/).

## Use Case

It's easy to imagine a large facility or a factory that has thousands of different sensors in various combinations. Let's imagine that a factory has hydraulic pumps along the assembly line with two major sets of sensors for temperature and pressure. Certain temperature and pressure combinations are hazardous and should trigger an alarm. However, because of various factors, the relationship between the three variables (temperature, pressure, and alarm signal) can't be described with a concrete equation. In cases like this machines learning can be used.
 
In my Lambda experiment I decided to emulate this scenario in which pairs of sensors report their values to some kind of centralized hub every few seconds and then the hub deploys a combined payload snapshot to Amazon S3, which triggers a lambda with a neural network in it, and then, finally, publishes an MQTT message to ThingFabric if the alarm value is greater than a certain threshold.
 
## Setting Up Lambda
 
To better understand how we should setup our lambda let's describe all events that are going to happen in the system:
 
- A payload with temperature and pressure values is deployed to a specific S3 bucket.
- Our lambda is triggered.
- A neural network gets initialized with an appropriate training set.
- Neural network sequentially evaluates payload values and triggers an MQTT publish call to a specific topic in ThingFabric.
- ThingFabric receives a message and does something meaningful with it (e.g., shuts off a valve, sends a text message or email, etc.)
 
Now that we have a better understanding of what's going on in the system let's setup our lambda appropriately. First, create a lambda on the new lambda page and assign a role to it that has access to the S3 bucket that you are going to use for your payload deployments.
 
Now, let's write some boilerplate code for our lambda!

``` javascript
var aws = require('aws-sdk');
var s3 = new aws.S3({apiVersion: '2006-03-01'});
var brain = require("brain");
var mqtt = require('mqtt');

var config = {
  mqtt: {
    clientId: "yourClientId",
    username: "thingFabricUsername",
    md5Pass: "thingFabricMd5Password",
    outputTopic: "yourThingFabricDomain/lambda"
  },
  alarm: {
    maxTemp: 200,
    maxPressure: 800,
    alarmThreshold: 0.7
  }
};

exports.handler = function(event, context) {
  return context.done(null, "DONE");
};
```

Here we just setup some initial config variables for our lambda and the main event handler. We are going to rely on these variables in the MQTT connection and the neural network. The cool thing about Amazon Lambda is that you can use almost any Node.js library in your projects. You'll have to install all of your libraries locally in the same directory as your project, since Amazon doesn't have any facilities that would allow it to process `package.json`. In our example we are only using three Node libraries: `aws-sdk`, `brain`, and `mqtt`. Once you install them in the `./node_modules` folder, you are good to go.
 
## Parsing S3 Payloads and Sending MQTT messages

As I mentioned earlier, Kyle's already [described](http://2lemetry.com/2014/12/05/native-mqtt-lambda/) how to parse S3 payloads and easily send MQTT messages to ThingFabric in great detail, so I'm only going to briefly cover it here. First, let's describe the data format for our payloads. I decided to keep it minimal and only include a device ID that corresponds to a specific MQTT topic and a temperature/pressure sensor value pair. It looks something like this:

``` json
{ device_id: "foo", values: { t: 100, p: 400 } },
{ device_id: "bar", values: { t: 120, p: 320 } },
{ device_id: "foobar", values: { t: 90, p: 220 } }
```

In order to parse an object from S3 let's create a simple helper parser:

``` javascript
function S3Parser() {
  var _this = this;

  _this.parseS3Object = function(cb) {
    var s3 = new aws.S3({apiVersion: '2006-03-01'});

    s3.getObject({
      Bucket: event.Records[0].s3.bucket.name,
      Key: event.Records[0].s3.object.key
    }, function (err, data) {
      return cb(JSON.parse(data.Body.toString()));
    });
  };
}
```

Now let's write a simple MQTT client:

``` javascript
function MqttClient(config, onClose, onError) {
  var _this = this;
  _this.username = config.username;
  _this.pass = config.md5Pass;
  _this.clientId = config.clientId;

  _this.client = mqtt.connect(
      "mqtt://" + _this.username + ":" + _this.pass + "@q.m2m.io:1883", { "clientId": _this.clientId }
  );

  _this.client.on("close", onClose);

  _this.client.on("error", function(error) { onError(error) });

  _this.publish = function(topicName, dataPoint) {
    return _this.client.publish(topicName, JSON.stringify({ alarm: true, values: dataPoint }));
  };
}
```

Now we have all of the boilerplate code setup, so let's add some neural entwork logic! 

## Adding a Neural Network

I'm going to use the neural network implementation by [Brain.js](https://github.com/harthur/brain) in our lambda. All it needs is a training dataset that in our case will look like this:

``` javascript
var trainingData = [
  {input: { t: 10, p: 275 }, output: { alarm: 0 }},
  {input: { t: 14, p: 230 }, output: { alarm: 0 }},
  {input: { t: 65, p: 240 }, output: { alarm: 0 }},
  {input: { t: 89, p: 301 }, output: { alarm: 1 }},
  ...
];
```

These are alarm values that were added by a human supervisor who knows for sure when the alarm should be triggered. In our case we don't need very many values to get to a small training error. I've only used 19 values to get to good stable neural network output.

Once we have our training data, let's setup the alarm object that does all the interesting work in our lambda:

``` javascript
function Alarm(config) {
  var _this = this;

  _this.maxTemp = config.maxTemp;
  _this.maxPressure = config.maxPressure;
  _this.alarmThreshold = config.alarmThreshold;
  _this.nn = new brain.NeuralNetwork();

  _this.tempToInput = function(t) {
    return t / _this.maxTemp;
  };

  _this.pressureToInput = function(p) {
    return p / _this.maxPressure;
  };

  _this.parseTrainingData = function(data) {
    return data.map(function(point) {
      return {
        input: { t: _this.tempToInput(point.input.t), p: _this.pressureToInput(point.input.p) },
        output: { alarm: point.output.alarm }
      }
    });
  };

  _this.train = function(data) {
    return _this.nn.train(_this.parseTrainingData(data));
  };

  _this.isTriggered = function(data) {
    var guessedAlarm = _this.nn.run({ t: _this.tempToInput(data.t), p: _this.pressureToInput(data.p) });

    return (guessedAlarm.alarm > _this.alarmThreshold);
  };
}
```

## Putting It All Together

Now it's time to put all pieces together and write the handler function that Amazon Lambda is going to process:

``` javascript
exports.handler = function(event, context) {
  var parser = new S3Parser();
  var mqtt = new MqttClient(
    config.mqtt,
    function () {
      return context.done(null, "DONE");
    },
    function (error) {
      console.log(error);

      return context.done(null, "ERROR");
    }
  );

  parser.parseS3Object(function(payload) {
    payload.readings.forEach(function(reading) {
      var dataPoint = reading.values;

      if (dataPoint.t > config.alarm.maxTemp || dataPoint.p > config.alarm.maxPressure) {
        mqtt.publish(config.mqtt.outputTopic + "/critical" + reading.device_id, dataPoint);
      } else {
        var alarm = new Alarm(config.alarm);

        alarm.train(trainingData);

        if (alarm.isTriggered(dataPoint)) {
          mqtt.publish(config.mqtt.outputTopic + "/" + reading.device_id, dataPoint);
        }
      }
    });

    mqtt.client.end();
  });
};
```

Once `handler` is triggered, we read the S3 object and then make an MQTT publish call to the device topic if either temperature or pressure exceeded critical values of `200` and `800` or if the alarm is triggered by some combination of the two inside the neural network.

## Outro
