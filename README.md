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
- Neural network sequentially evaluates payload values and triggers and MQTT publish call to a specific topic on ThingFabric.
- ThingFabric receives a message and does something meaningful with it (e.g., shuts off a valve, sends a text message or email, etc.)
 
Now that we have a better understanding of what's going on in the system let's setup our lambda appropriately. First, create a lambda on the new lambda page and assign an appropriate role to it that has access to an S3 bucket that you are going to use for your payload deployments.
 
Now, let's write some boilerplate code for our lambda!

``` javascript
var aws = require('aws-sdk');
var s3 = new aws.S3({apiVersion: '2006-03-01'});
var brain = require("brain");
var mqtt = require('mqtt');

var mqttClientId = "yourClientId";
var mqttUserName = "thingFabricUsername";
var mqttMd5Pass = "thingFabricPassword";
var mqttOutputTopic = "thingFabricDomain/lambda";
var client = mqtt.connect("mqtt://" + mqttUserName + ":" + mqttMd5Pass + "@q.m2m.io:1883", { "clientId": mqttClientId });

var maxTemp = 200;
var maxPressure = 800;
var alarmThreshold = 0.7;

exports.handler = function(event, context) {
  return context.done(null, "DONE");
};
```

Here we just setup some initial config variables for the lambda and the main event handler. The cool thing about Amazon Lambda is that you can use almost any Node.js library in your projects. You'll have to install all of your libraries in the same folder as your lambda, since Amazon doesn't have any facilities that would allow you to process `package.json`. In our example we are only using three Node libraries: `aws-sdk`, `brain`, and `mqtt`. Once you install them in the `./node_modules` folder, you are good to go.
 
## Parsing S3 Payloads

## Adding a Neural Network

## Putting It All Together

## Outro
