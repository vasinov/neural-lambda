var aws = require('aws-sdk');
var brain = require("brain");
var mqtt = require('mqtt');

var config = {
  mqtt: {
    clientId: "",
    username: "",
    md5Pass: "",
    outputTopic: ""
  },
  alarm: {
    maxTemp: 200,
    maxPressure: 800,
    alarmThreshold: 0.6
  }
};

var trainingData = [
  { input: { t: 10, p: 275 }, output: { alarm: 0 } },
  { input: { t: 14, p: 230 }, output: { alarm: 0 } },
  { input: { t: 65, p: 240 }, output: { alarm: 0 } },
  { input: { t: 89, p: 301 }, output: { alarm: 1 } },
  { input: { t: 93, p: 290 }, output: { alarm: 1 } },
  { input: { t: 20, p: 400 }, output: { alarm: 0 } },
  { input: { t: 32, p: 503 }, output: { alarm: 1 } },
  { input: { t: 55, p: 600 }, output: { alarm: 1 } },
  { input: { t: 120, p: 250 }, output: { alarm: 1 } },
  { input: { t: 99, p: 275 }, output: { alarm: 0 } },
  { input: { t: 15, p: 104 }, output: { alarm: 0 } },
  { input: { t: 42, p: 400 }, output: { alarm: 0 } },
  { input: { t: 102, p: 275 }, output: { alarm: 0 } },
  { input: { t: 82, p: 302 }, output: { alarm: 1 } },
  { input: { t: 51, p: 101 }, output: { alarm: 0 } },
  { input: { t: 10, p: 590 }, output: { alarm: 0 } },
  { input: { t: 51, p: 321 }, output: { alarm: 1 } },
  { input: { t: 22, p: 275 }, output: { alarm: 0 } },
  { input: { t: 32, p: 275 }, output: { alarm: 0 } }
];

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
    var guessedAlarm = _this.nn.run({ t: _this.tempToInput(data.t), p: _this.pressureToInput(data.p) }).alarm;

    return {
      triggered: (guessedAlarm > _this.alarmThreshold),
      guessedAlarm: guessedAlarm
    };
  };
}

function S3Parser() {
  var _this = this;

  _this.parseFakeS3Object = function(cb) {
    var rs = { readings: [
      { device_id: "foo", values: { t: 100, p: 300 } },
      { device_id: "bar", values: { t: 120, p: 320 } },
      { device_id: "foobar", values: { t: 90, p: 120 } }
    ] };

    return cb(rs);
  };

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

  _this.publish = function(topicName, payload) {
    return _this.client.publish(topicName, JSON.stringify(payload));
  };
  
  _this.disconnect = function() {
    return _this.client.end();  
  };
}

exports.handler = function(event, context) {
  var
    parser = new S3Parser(),

    mqtt = new MqttClient(
      config.mqtt,
      function () {
        return context.done(null);
      },
      function (error) {
        return context.done(null, error);
      }
    ),

    alarm = new Alarm(config.alarm);

  parser.parseFakeS3Object(function(payload) {
    payload.readings.forEach(function(reading) {
      var
        dataPoint = reading.values,
        outputTopic = config.mqtt.outputTopic + "/" + reading.device_id;

      if (dataPoint.t > config.alarm.maxTemp || dataPoint.p > config.alarm.maxPressure) {
        mqtt.publish(
          outputTopic, { alarm: 1, values: dataPoint }
        );
      } else {
        alarm.train(trainingData);

        var trigger = alarm.isTriggered(dataPoint);

        if (trigger.triggered) {
          mqtt.publish(
            outputTopic, { alarm: trigger.guessedAlarm, values: dataPoint }
          );
        }
      }
    });

    mqtt.disconnect();
  });
};

exports.handler();