var aws = require('aws-sdk');
var s3 = new aws.S3({apiVersion: '2006-03-01'});
var brain = require("brain");
var mqtt = require('mqtt');

var mqttClientId = "";
var mqttUserName = "";
var mqttMd5Pass = "";
var mqttOutputTopic = "";
var client = mqtt.connect("mqtt://" + mqttUserName + ":" + mqttMd5Pass + "@q.m2m.io:1883", { "clientId": mqttClientId });

var maxTemp = 200;
var maxPressure = 800;
var alarmThreshold = 0.7;
var trainingData = [
  {input: { t: 10, p: 275 }, output: { alarm: 0 }},
  {input: { t: 14, p: 230 }, output: { alarm: 0 }},
  {input: { t: 65, p: 240 }, output: { alarm: 0 }},
  {input: { t: 89, p: 301 }, output: { alarm: 1 }},
  {input: { t: 93, p: 290 }, output: { alarm: 1 }},
  {input: { t: 20, p: 400 }, output: { alarm: 0 }},
  {input: { t: 32, p: 503 }, output: { alarm: 1 }},
  {input: { t: 55, p: 600 }, output: { alarm: 1 }},
  {input: { t: 120, p: 250 }, output: { alarm: 1 }},
  {input: { t: 99, p: 275 }, output: { alarm: 0 }},
  {input: { t: 15, p: 104 }, output: { alarm: 0 }},
  {input: { t: 42, p: 400 }, output: { alarm: 0 }},
  {input: { t: 102, p: 275 }, output: { alarm: 0 }},
  {input: { t: 82, p: 302 }, output: { alarm: 1 }},
  {input: { t: 51, p: 101 }, output: { alarm: 0 }},
  {input: { t: 10, p: 590 }, output: { alarm: 0 }},
  {input: { t: 51, p: 321 }, output: { alarm: 1 }},
  {input: { t: 22, p: 275 }, output: { alarm: 0 }},
  {input: { t: 32, p: 275 }, output: { alarm: 0 }}
];

function FactoryAlarm(maxTemp, maxPressure, alarmThreshold) {
  var _this = this;

  _this.maxTemp = maxTemp;
  _this.maxPressure = maxPressure;
  _this.alarmThreshold = alarmThreshold;
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

  _this.trigger = function(data) {
    var guessedAlarm = _this.nn.run({ t: _this.tempToInput(data.t), p: _this.pressureToInput(data.p) });

    return (guessedAlarm.alarm > alarmThreshold);
  };
}

exports.handler = function(event, context) {
  s3.getObject({
    Bucket: event.Records[0].s3.bucket.name,
    Key: event.Records[0].s3.object.key
  }, function (err, data) {
    var readings = JSON.parse(data.Body.toString());

    // TODO: remove once S3 integration is tested
    rs = { readings: [
      { device_id: "foo", values: { t: 100, p: 400 } },
      { device_id: "bar", values: { t: 120, p: 320 } },
      { device_id: "foobar", values: { t: 90, p: 220 } }
    ] };

    rs.readings.forEach(function(reading) {
      var dataPoint = reading.values;

      if (dataPoint.t > maxTemp || dataPoint.p > maxPressure) {
        client.publish(mqttOutputTopic, JSON.stringify({ alarm: true, values: dataPoint }));
      } else {
        var alarm = new FactoryAlarm(maxTemp, maxPressure, alarmThreshold);

        alarm.train(trainingData);

        if (alarm.trigger(dataPoint)) {
          client.publish(mqttOutputTopic + "/" + reading.device_id, JSON.stringify({ alarm: true, values: dataPoint }));
        }
      }
    });

    client.end();

    client.on("close", (function () {
      return context.done(null, "DONE");
    }));

    client.on("error", (function () {
      return context.done(null, "ERROR");
    }));
  });
};
