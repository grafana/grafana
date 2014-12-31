define([
  'kbn'
], function(kbn) {
  'use strict';

  function describeValueFormat(desc, value, tickSize, tickDecimals, result) {

    describe('value format: ' + desc, function() {
      it('should translate ' + value + ' as ' + result, function() {
        var scaledDecimals = tickDecimals - Math.floor(Math.log(tickSize) / Math.LN10);
        var str = kbn.valueFormats[desc](value, tickDecimals, scaledDecimals);
        expect(str).to.be(result);
      });
    });

  }

  describeValueFormat('ms', 0.0024, 0.0005, 4, '0.0024 ms');
  describeValueFormat('ms', 100, 1, 0, '100 ms');
  describeValueFormat('ms', 1250, 10, 0, '1.25 s');
  describeValueFormat('ms', 1250, 300, 0, '1.3 s');
  describeValueFormat('ms', 65150, 10000, 0, '1.1 min');
  describeValueFormat('ms', 6515000, 1500000, 0, '1.8 hour');
  describeValueFormat('ms', 651500000, 150000000, 0, '8 day');

  describeValueFormat('none', 2.75e-10, 0, 10, '3e-10');
  describeValueFormat('none', 0, 0, 2, '0');

  describeValueFormat('ns', 25, 1, 0, '25 ns');
  describeValueFormat('ns', 2558, 50, 0, '2.56 µs');

  describe('kbn.toFixed and negative decimals', function() {
    it('should treat as zero decimals', function() {
      var str = kbn.toFixed(186.123, -2);
      expect(str).to.be('186');
    });
  });

  describe('calculateInterval', function() {
    it('1h 100 resultion', function() {
      var range = { from: kbn.parseDate('now-1h'), to: kbn.parseDate('now') };
      var str = kbn.calculateInterval(range, 100, null);
      expect(str).to.be('30s');
    });

    it('10m 1600 resolution', function() {
      var range = { from: kbn.parseDate('now-10m'), to: kbn.parseDate('now') };
      var str = kbn.calculateInterval(range, 1600, null);
      expect(str).to.be('0.1s');
    });

    it('fixed user interval', function() {
      var range = { from: kbn.parseDate('now-10m'), to: kbn.parseDate('now') };
      var str = kbn.calculateInterval(range, 1600, '10s');
      expect(str).to.be('10s');
    });

    it('short time range and user low limit', function() {
      var range = { from: kbn.parseDate('now-10m'), to: kbn.parseDate('now') };
      var str = kbn.calculateInterval(range, 1600, '>10s');
      expect(str).to.be('10s');
    });

    it('large time range and user low limit', function() {
      var range = { from: kbn.parseDate('now-14d'), to: kbn.parseDate('now') };
      var str = kbn.calculateInterval(range, 1000, '>10s');
      expect(str).to.be('30m');
    });

  });

});
