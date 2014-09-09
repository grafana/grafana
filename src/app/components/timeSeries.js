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

  //Helper function for heatmap calculation of target buckets, their sizes and time point count
  TimeSeries.prototype.calculateHeatmapBucketSizes = function (bucketMin, bucketMax) {

    var currentTime;
    var currentBucketStart;
    var timePoints = {}; //This dictionary is used as a set

    //Get all unique time points and min/max buckets
    for (var i = 0; i < this.datapoints.length; i++) {
      var datapoints = this.datapoints[i];
      currentBucketStart = datapoints[0];
      currentTime = datapoints[2];
      timePoints[currentTime] = true;
      this.info.bucketMax = Math.max(this.info.bucketMax, currentBucketStart);
      this.info.bucketMin = Math.min(this.info.bucketMin, currentBucketStart);
    }
    //Bucket min/max could be predefined, if not we use the source values
    if (bucketMin !== null){
      this.info.bucketMin = bucketMin;
    }
    if (bucketMax !== null){
      this.info.bucketMax = bucketMax;
    }

    this.info.sourceTimePointCount = _.size(timePoints);
    //Time point count could be predefined, if not we use the source values.
    if (this.info.targetTimePointCount == null) {
      this.info.targetTimePointCount = this.info.sourceTimePointCount;
    }

    //Create a definition of target buckets
    this.info.buckets = [];
    this.info.bucketSize = ((this.info.bucketMax - this.info.bucketMin) / this.info.bucketCount);
    for (i = 0; i < this.info.bucketCount; i++) {
      this.info.buckets.push(this.info.bucketMin + this.info.bucketSize * i);
    }
  };

  //This function takes the raw data from DB and transforms them into buckets adjusted to the current display settings.
  //This can lead to "merging" of buckets if the source has higher resolution as the target. The same applies for horizontal. scaling.
  //Input data needs to be pre sorted by time point, value, otherwise this will not work properly.
  TimeSeries.prototype.getHeatmapData = function (bucketMin, bucketMax, timePointCount, bucketCount) {
    var result = [];

    if (!this.info.isHistogram) {
      return result;
    }

    this.color = this.info.color;
    this.yaxis = this.info.yaxis;

    this.info.max = -212312321312;
    this.info.min = 212312321312;
    this.info.bucketMax = -212312321312;
    this.info.bucketMin = 212312321312;
    this.info.bucketCount = bucketCount;
    this.info.targetTimePointCount = timePointCount;
    this.info.sourceTimePointCount = 0;
    this.info.showOutsideValues = false;
    this.info.buckets = [];
    this.info.bucketSize = 0;

    this.calculateHeatmapBucketSizes(bucketMin, bucketMax);

    var prevTime = null;
    var timePointNo = 0;

    //Rescaling of source buckets to the target ones and merging source time points to fit into the given amount of target time points
    for (var i = 0; i < this.datapoints.length; i++) {
      var currentBucketStart = this.datapoints[i][0];
      var currentCount = this.datapoints[i][1] !== null ? this.datapoints[i][1] : 0;
      var currentTime = this.datapoints[i][2];

      if (prevTime !== currentTime) {
        //If the time difference is big enough to force moving to the next target point
        var currentBucketValue = Math.floor((timePointNo * this.info.targetTimePointCount) / this.info.sourceTimePointCount);
        var prevBucketValue = Math.floor(((timePointNo - 1) * this.info.targetTimePointCount) / this.info.sourceTimePointCount);

        if (currentBucketValue >= prevBucketValue) {
           //Generates an array filled with zeros
          var bucketArray = Array.apply(null, new Array(this.info.buckets.length)).map(Number.prototype.valueOf, 0);
          result.push([currentTime * 1000, bucketArray]);
        }
        ++timePointNo;
      }
      prevTime = currentTime;
      //Map the source bucket to the target bucket
      var bucketIndex = Math.round((currentBucketStart - this.info.bucketMin) / this.info.bucketSize);
      if ((bucketIndex >= 0 && bucketIndex < this.info.buckets.length) || this.info.showOutsideValues) {
        bucketIndex = Math.max(0, Math.min(bucketIndex, this.info.buckets.length - 1)); //Make sure value is in boundaries
        result[result.length - 1][1][bucketIndex] += currentCount;
      }
    }

    //Get the min and max values (needed for proper heatmap depth drawing)
    for (i = 0; i < result.length; i++) {
      var values = result[i];
      for (var j = 0; j < values.length; j++) {
        this.info.max = Math.max(this.info.max, values[1][j]);
        this.info.min = Math.min(this.info.min, values[1][j]);
      }
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
