# Adding Intelligence to Amazon Lambda

## Introduction

You might have noticed that we at 2lemetry got pretty excited about Amazon's newest AWS product [Lambda](http://aws.amazon.com/lambda/). Several engineers [experimented](http://2lemetry.com/blogs-resources/) with how lambdas fit together with the MQTT protocol and [ThingFabric](https://app.thingfabric.com). I decided to run a small experiment with real computations and see how neural networks can be applied inside lambdas in the context of the Internet of Things. I'm going to heavily utilize the MQTT foundation described by Kyle, our CEO, in his [blog post](http://2lemetry.com/2014/12/05/native-mqtt-lambda/).

## Use Case

It's easy to imagine a large facility or a factory that has thousands of different sensors in various setups. Let's imagine that a factory has hydraulic pumps along the assembly line with two major sensors for temperature and pressure. Certain temperature and pressure combinations are hazardous and should trigger an alarm. However, because of various factors, the relationship between the three variables (temperature, pressure, alarm signal) can't be described by a concrete equation. In cases like that machines learning can be used.
 
 In my Lambda experiment I decided to emulate this scenario in which pairs of sensors report their values to some kind of centralized hub every few seconds and then the hub deploys a combined payload snapshot to Amazon S3, which triggers a lambda with a neural network in it, and then, finally, publishes an MQTT message to ThingFabric if the alarm value is greater than the threshold.
 
 ## Setting Up Lambda
 
 ## Adding a Neural Network
 
 ## Parsing S3 Payloads
 
 ## Putting It All Together
 
 ## Outro