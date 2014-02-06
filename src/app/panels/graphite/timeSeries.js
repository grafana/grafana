define([
  'underscore'
],
function (_) {
  'use strict';

  var ts = {};

  ts.ZeroFilled = function (opts) {
    this.datapoints = opts.datapoints;
    this.info = opts.info;
    this.label = opts.info.alias;
    this.color = opts.info.color;
    this.yaxis = opts.info.yaxis;
  };

  ts.ZeroFilled.prototype.getFlotPairs = function (fillStyle) {
    var result = [];

    this.info.total = 0;
    this.info.max = null;
    this.info.min = 212312321312;

    _.each(this.datapoints, function(valueArray) {
      var currentTime = valueArray[1];
      var currentValue = valueArray[0];
      if (currentValue === null) {
        if (fillStyle === 'connected') {
          return;
        }
        if (fillStyle === 'null as zero') {
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
    }, this);

    this.info.avg = this.info.total / result.length;
    this.info.current = result[result.length-1][1];

    return result;
  };


  return ts;
});