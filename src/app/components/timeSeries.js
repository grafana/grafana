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
  }

  function matchSeriesOverride(aliasOrRegex, seriesAlias) {
    if (!aliasOrRegex) { return false; }

    if (aliasOrRegex[0] === '/') {
      var match = aliasOrRegex.match(new RegExp('^/(.*?)/(g?i?m?y?)$'));
      var regex = new RegExp(match[1], match[2]);
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

  TimeSeries.prototype.getHeatmapData = function (fillStyle, yFormats, bucketMin, bucketMax) {
    var result = {};

    if (!this.info.isHistogram) {
      return result;
    }

    this.color = this.info.color;
    this.yaxis = this.info.yaxis;

    this.info.total = 0;
    this.info.max = -212312321312;
    this.info.min = 212312321312;
    this.info.bucketMax = -212312321312;
    this.info.bucketMin = 212312321312;
    this.info.bucketCount = 20;
    this.info.timePointCount = 100;
    this.info.showOutsideValues = false;

    var ignoreNulls = fillStyle === 'connected';
    var nullAsZero = fillStyle === 'null as zero';
    var currentTime;
    var currentBucketStart;
    var currentCount;
    var timePoints = new Set();

    for (var i = 0; i < this.datapoints.length; i++) {
      var datapoints = this.datapoints[i];
      currentBucketStart = datapoints[0];
      currentCount = datapoints[1];
      currentTime = datapoints[2];
      currentCount = currentCount === null ? 0 : currentCount;
      timePoints.add(currentTime);

      this.info.total += currentCount;
      this.info.bucketMax = Math.max(this.info.bucketMax, currentBucketStart);
      this.info.bucketMin = Math.min(this.info.bucketMin, currentBucketStart);
    }
    if (bucketMin !== null){
      this.info.bucketMin = bucketMin;
    }
    if (bucketMax !== null){
      this.info.bucketMax = bucketMax;
    }

    result.buckets = [];
    result.bucketSize = ((this.info.bucketMax - this.info.bucketMin) / this.info.bucketCount);
    for (var i = 0; i < this.info.bucketCount; i++) {
      result.buckets.push(this.info.bucketMin + result.bucketSize * i);
    }
    result.values = [];
    var prevTime = null
    var timePointNo = 0;

    //Rescaling of source bucckets to the target ones and merging source time points to fit into the given amount of target time points
    for (var i = 0; i < this.datapoints.length; i++) {
      currentBucketStart = this.datapoints[i][0];
      currentCount = this.datapoints[i][1];
      currentTime = this.datapoints[i][2];
      currentCount = currentCount === null ? 0 : currentCount;

      if (prevTime != currentTime) {
        if (timePointNo == 0 || Math.floor((timePointNo * this.info.timePointCount) / timePoints.size) > Math.floor(((timePointNo - 1) * this.info.timePointCount) / timePoints.size)) {
          var bucketArray = Array.apply(null, new Array(result.buckets.length)).map(Number.prototype.valueOf, 0); // Generates an array filled with zeros
          result.values.push([currentTime * 1000, bucketArray]);
        }
        ++timePointNo;
      }
      prevTime = currentTime;
      var bucketIndex = Math.round((currentBucketStart - this.info.bucketMin) / result.bucketSize); //Map the source bucket to the target bucket
      if ((bucketIndex >= 0 && bucketIndex < result.buckets.length) || this.info.showOutsideValues) {
        bucketIndex = Math.max(0, Math.min(bucketIndex, result.buckets.length - 1)); //Make sure value is in boundaries
        result.values[result.values.length - 1][1][bucketIndex] += currentCount;
      }
    }

    for (var i = 0; i < result.values.length; i++) {
      var values = result.values[i];
      for (var j = 0; j < values.length; j++) {
        this.info.max = Math.max(this.info.max, values[1][j]);
        this.info.min = Math.min(this.info.min, values[1][j]);
      }
    }
    result.min = this.info.min;
    result.max = this.info.max;

    if (result.values.length > 2) {
      this.info.timeStep = result.values[1][0] - result.values[0][0];
    }

    if (result.values.length) {
      this.info.avg = (this.info.total / (result.values.length * result.buckets.length));
      this.info.current = result.values[result.values.length-1][1][0];

      var formater = kbn.getFormatFunction(yFormats[this.yaxis - 1], 2);
      this.info.avg = this.info.avg != null ? formater(this.info.avg) : null;
      this.info.current = this.info.current != null ? formater(this.info.current) : null;
      this.info.min = this.info.min != null ? formater(this.info.min) : null;
      this.info.max = this.info.max != null ? formater(this.info.max) : null;
      this.info.total = this.info.total != null ? formater(this.info.total) : null;
    }

    return result;
  };

  TimeSeries.prototype.getFlotPairs = function (fillStyle, yFormats) {
    var result = [];

    if (this.info.isHistogram) {
      return result;
    }

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

  return TimeSeries;

});
