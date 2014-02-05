define([
  'underscore',
  './interval'
],
function (_, Interval) {
  'use strict';

  var ts = {};

  // map compatable parseInt
  function base10Int(val) {
    return parseInt(val, 10);
  }

  // trim the ms off of a time, but return it with empty ms.
  function getDatesTime(date) {
    return Math.floor(date.getTime() / 1000)*1000;
  }

  /**
   * Certain graphs require 0 entries to be specified for them to render
   * properly (like the line graph). So with this we will caluclate all of
   * the expected time measurements, and fill the missing ones in with 0
   * @param {object} opts  An object specifying some/all of the options
   *
   * OPTIONS:
   * @opt   {string}   interval    The interval notion describing the expected spacing between
   *                                each data point.
   * @opt   {date}     start_date  (optional) The start point for the time series, setting this and the
   *                                end_date will ensure that the series streches to resemble the entire
   *                                expected result
   * @opt   {date}     end_date    (optional) The end point for the time series, see start_date
   */
  ts.ZeroFilled = function (opts) {
    opts = _.defaults(opts, {
      start_date: null,
      end_date: null,
      datapoints: []
    });

    this.start_time = opts.start_date && getDatesTime(opts.start_date);
    this.end_time = opts.end_date && getDatesTime(opts.end_date);
    this.opts = opts;
    this.datapoints = opts.datapoints;
  };

  ts.ZeroFilled.prototype.getFlotPairs = function (fillStyle) {
    var result = [];

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
        if (fillStyle === 'null') {
          // do nothing
        }
      }

      result.push([currentTime * 1000, currentValue]);
    });

    return result;
  };


  return ts;
});