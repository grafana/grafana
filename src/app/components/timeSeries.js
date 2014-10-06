define([
  'lodash',
  'kbn'
],
function (_, kbn) {
  'use strict';

  function defaultValueFormater(value) {
    return kbn.valueFormats.none(value, 2, 2);
  }

  function TimeSeries(opts) {
    this.datapoints = opts.datapoints;
    this.info = opts.info;
    this.label = opts.info.alias;
    this.valueFormater = defaultValueFormater;
  }

  function matchSeriesOverride(aliasOrRegex, seriesAlias) {
    if (!aliasOrRegex) { return false; }

    if (aliasOrRegex[0] === '/') {
      var regex = kbn.stringToJsRegex(aliasOrRegex);
      return seriesAlias.match(regex) != null;
    }

    return aliasOrRegex === seriesAlias;
  }

  function translateFillOption(fill) {
    return fill === 0 ? 0.001 : fill/10;
  }

  TimeSeries.prototype.applySeriesOverrides = function(overrides) {
    this.lines = {};
    this.points = {};
    this.bars = {};
    this.info.yaxis = 1;
    this.zindex = 0;
    delete this.stack;

    for (var i = 0; i < overrides.length; i++) {
      var override = overrides[i];
      if (!matchSeriesOverride(override.alias, this.info.alias)) {
        continue;
      }
      if (override.lines !== void 0) { this.lines.show = override.lines; }
      if (override.points !== void 0) { this.points.show = override.points; }
      if (override.bars !== void 0) { this.bars.show = override.bars; }
      if (override.fill !== void 0) { this.lines.fill = translateFillOption(override.fill); }
      if (override.stack !== void 0) { this.stack = override.stack; }
      if (override.linewidth !== void 0) { this.lines.lineWidth = override.linewidth; }
      if (override.pointradius !== void 0) { this.points.radius = override.pointradius; }
      if (override.steppedLine !== void 0) { this.lines.steps = override.steppedLine; }
      if (override.zindex !== void 0) { this.zindex = override.zindex; }
      if (override.yaxis !== void 0) {
        this.info.yaxis = override.yaxis;
      }
    }
  };

  TimeSeries.prototype.getFlotPairs = function (fillStyle) {
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
    }

    return result;
  };

  TimeSeries.prototype.updateLegendValues = function(formater, decimals, scaledDecimals) {
    this.valueFormater = function(value) {
      return formater(value, decimals, scaledDecimals);
    };
    this.info.avg = this.valueFormater(this.info.avg);
    this.info.current = this.valueFormater(this.info.current);
    this.info.min = this.valueFormater(this.info.min);
    this.info.max = this.valueFormater(this.info.max);
    this.info.total = this.valueFormater(this.info.total);
  };

  return TimeSeries;

});
