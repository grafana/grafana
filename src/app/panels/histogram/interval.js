define([
  'kbn'
],
function (kbn) {
  'use strict';

  /**
   * manages the interval logic
   * @param {[type]} interval_string  An interval string in the format '1m', '1y', etc
   */
  function Interval(interval_string) {
    this.string = interval_string;
    this.ms = kbn.interval_to_ms(interval_string);

    var matches = interval_string.match(kbn.interval_regex);
    this.count = parseInt(matches[1], 10);
    this.type = matches[2];

    // does the length of the interval change based on the current time?
    if (this.type === 'y' || this.type === 'M') {
      // we will just modify this time object rather that create a new one constantly
      this.get = this.get_complex;
      this.date = new Date(0);
    } else {
      this.get = this.get_simple;
    }
  }

  Interval.prototype = {
    toString: function () {
      return this.string;
    },
    after: function(current_ms) {
      return this.get(current_ms, this.count);
    },
    before: function (current_ms) {
      return this.get(current_ms, -this.count);
    },
    get_complex: function (current, delta) {
      this.date.setTime(current);
      switch(this.type) {
      case 'M':
        this.date.setUTCMonth(this.date.getUTCMonth() + delta);
        break;
      case 'y':
        this.date.setUTCFullYear(this.date.getUTCFullYear() + delta);
        break;
      }
      return this.date.getTime();
    },
    get_simple: function (current, delta) {
      return current + (delta * this.ms);
    }
  };

  return Interval;

});