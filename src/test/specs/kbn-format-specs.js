define([
  'kbn'
], function(kbn) {
  'use strict';

  describe('millisecond formating', function() {

    it('should translate 4378634603 as 1.67 years', function() {
      var str = kbn.msFormat(4378634603, 2);
      expect(str).to.be('50.68 day');
    });

    it('should translate 3654454 as 1.02 hour', function() {
      var str = kbn.msFormat(3654454, 2);
      expect(str).to.be('1.02 hour');
    });

    it('should not downscale when value is zero', function() {
      var str = kbn.msFormat(0, 2);
      expect(str).to.be('0.00 ms');
    });


    it('should translate 365445 as 6.09 min', function() {
      var str = kbn.msFormat(365445, 2);
      expect(str).to.be('6.09 min');
    });

  });

  describe('high negative exponent, issue #696', function() {
    it('should ignore decimal correction if exponent', function() {
      var str = kbn.getFormatFunction('')(2.75e-10, { tickDecimals: 12 });
      expect(str).to.be('2.75e-10');
    });
    it('should format 0 correctly', function() {
      var str = kbn.getFormatFunction('')(0.0, { tickDecimals: 12 });
      expect(str).to.be('0');
    });
  });

  describe('none format tests', function() {
    it('should translate 2 as 2.0000 if axis decimals is 4', function() {
      var str = kbn.getFormatFunction('')(2, { tickDecimals: 4 });
      expect(str).to.be('2.0000');
    });
  });

  describe('nanosecond formatting', function () {
    it('should translate 25 to 25 ns', function () {
      var str = kbn.nanosFormat(25, 2);
      expect(str).to.be("25 ns");
    });

    it('should translate 2558 to 2.56 µs', function () {
      var str = kbn.nanosFormat(2558, 2);
      expect(str).to.be("2.56 µs");
    });

    it('should translate 2558000 to 2.56 ms', function () {
      var str = kbn.nanosFormat(2558000, 2);
      expect(str).to.be("2.56 ms");
    });

    it('should translate 2019962000 to 2.02 s', function () {
      var str = kbn.nanosFormat(2049962000, 2);
      expect(str).to.be("2.05 s");
    });

    it('should translate 95199620000 to 1.59 m', function () {
      var str = kbn.nanosFormat(95199620000, 2);
      expect(str).to.be("1.59 m");
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
