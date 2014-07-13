define([
  'underscore',
  'kbn'
],
function (_, kbn) {
  'use strict';

  var ts = {};

  ts.ZeroFilled = function (opts) {
    this.datapoints = opts.datapoints;
    this.info = opts.info;
    this.label = opts.info.alias;
  };

  ts.ZeroFilled.prototype.getFlotPairs = function (fillStyle, yFormats) {
    var result = [];

    this.color = this.info.color;
    this.yaxis = this.info.yaxis;

    this.info.total = 0;
    this.info.max = -212312321312;
    this.info.min = 212312321312;

    var ignoreNulls = fillStyle === 'connected';
    var nullAsZero = fillStyle === 'null as zero';
    var currentTime;
    var currentValue;

    for (var i = 0; i < this.datapoints.length; i++) {
      currentValue = this.datapoints[i][0];
      currentTime = this.datapoints[i][1];

      if (currentValue === null) {
        if (ignoreNulls) { continue; }
        if (nullAsZero) {
          currentValue = 0;
        }
      }

      if (_.isNumber(currentValue)) {
        this.info.total += currentValue;
      }

      if (currentValue > this.info.max) {
        this.info.max = currentValue;
      }

      if (currentValue < this.info.min) {
        this.info.min = currentValue;
      }

      result.push([currentTime * 1000, currentValue]);
    }

    if (result.length > 2) {
      this.info.timeStep = result[1][0] - result[0][0];
    }

    if (result.length) {

      this.info.avg = (this.info.total / result.length);
      this.info.current = result[result.length-1][1];

      var formater = kbn.getFormatFunction(yFormats[this.yaxis - 1], 2);
      this.info.avg = this.info.avg != null ? formater(this.info.avg) : null;
      this.info.current = this.info.current != null ? formater(this.info.current) : null;
      this.info.min = this.info.min != null ? formater(this.info.min) : null;
      this.info.max = this.info.max != null ? formater(this.info.max) : null;
      this.info.total = this.info.total != null ? formater(this.info.total) : null;
    }

    return result;
  };

  return ts;
});