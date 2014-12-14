# Machine Learning with Amazon Lambda

This repository contains source code for an Amazon Lambda project described in this [blog post](http://wp.me/p4TGrR-s5) on 2lemetry.

Here is a brief description of the project:

> It's easy to imagine a large facility or a factory that has thousands of different sensors in various combinations. Let's imagine that a factory has hydraulic pumps along an assembly line with two major sets of sensors for temperature and pressure. Certain temperature and pressure combinations are hazardous and should trigger an alarm at the low alarm threshold and shut them off completely at the high threshold. The problem is that, because of various factors, the relationship between temperature, pressure, and alarm signal can't be described with a concrete equation. In cases like this machines learning can be used.

> In my Lambda experiment I decided to emulate this scenario in which pairs of sensors report their values to some kind of centralized hub every few seconds and then the hub deploys a combined payload snapshot to Amazon S3, which triggers a lambda with a neural network in it. The lambda publishes an MQTT message to ThingFabric if the alarm value is greater than a certain threshold. On ThingFabric end we can setup some rules that will send a text message and shut off the device by sending another MQTT message.

Read the rest of the post in the [2lemetry blog](http://wp.me/p4TGrR-s5).
