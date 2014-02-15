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

    if (result.length) {
      this.info.avg = (this.info.total / result.length);
      this.info.current = result[result.length-1][1];

      var formater = getFormater(yFormats[this.yaxis - 1]);
      this.info.avg = formater(this.info.avg);
      this.info.current = formater(this.info.current);
      this.info.min = formater(this.info.min);
      this.info.max = formater(this.info.max);
      this.info.total = formater(this.info.total);
    }

    return result;
  };

  function getFormater(yformat) {
    switch(yformat) {
    case 'bytes':
      return kbn.byteFormat;
    case 'short':
      return kbn.shortFormat;
    case 'ms':
      return kbn.msFormat;
    default:
      return function(val) {
        if (val % 1 === 0) {
          return val;
        }
        else {
          return val.toFixed(2);
        }
      };
    }
  }

  return ts;
});