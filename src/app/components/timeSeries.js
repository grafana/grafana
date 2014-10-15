define([
  'lodash',
  'kbn'
],
function (_, kbn) {
  'use strict';

  function TimeSeries(opts) {
    this.datapoints = opts.datapoints;
    this.info = opts.info;
    this.label = opts.info.alias;
    this.id = opts.info.alias;
    this.valueFormater = kbn.valueFormats.none;
    this.stats = {};
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
      if (override.fillBelowTo !== void 0) { this.fillBelowTo = override.fillBelowTo; }

      if (override.yaxis !== void 0) {
        this.info.yaxis = override.yaxis;
      }
    }
  };

  TimeSeries.prototype.getFlotPairs = function (fillStyle) {
    var result = [];

    this.color = this.info.color;
    this.yaxis = this.info.yaxis;

    this.stats.total = 0;
    this.stats.max = Number.MIN_VALUE;
    this.stats.min = Number.MAX_VALUE;
    this.stats.avg = null;
    this.stats.current = null;

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
        this.stats.total += currentValue;
      }

      if (currentValue > this.stats.max) {
        this.stats.max = currentValue;
      }

      if (currentValue < this.stats.min) {
        this.stats.min = currentValue;
      }

      result.push([currentTime * 1000, currentValue]);
    }

    if (this.datapoints.length >= 2) {
      this.stats.timeStep = (this.datapoints[1][1] - this.datapoints[0][1]) * 1000;
    }

    if (this.stats.max === Number.MIN_VALUE) { this.stats.max = null; }
    if (this.stats.min === Number.MAX_VALUE) { this.stats.min = null; }

    if (result.length) {
      this.stats.avg = (this.stats.total / result.length);
      this.stats.current = result[result.length-1][1];
    }

    return result;
  };

  TimeSeries.prototype.updateLegendValues = function(formater, decimals, scaledDecimals) {
    this.valueFormater = formater;
    this.decimals = decimals;
    this.scaledDecimals = scaledDecimals;

    this.info.avg = this.formatValue(this.stats.avg);
    this.info.current = this.formatValue(this.stats.current);
    this.info.min = this.formatValue(this.stats.min);
    this.info.max = this.formatValue(this.stats.max);
    this.info.total = this.formatValue(this.stats.total);
  };

  TimeSeries.prototype.formatValue = function(value) {
    return this.valueFormater(value, this.decimals, this.scaledDecimals);
  };

  return TimeSeries;

});
