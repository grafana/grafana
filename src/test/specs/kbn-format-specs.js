define([
  'kbn'
], function(kbn) {
  'use strict';

  describe('millisecond formating', function() {

    it('should translate 4378634603 as 50.68 day', function() {
      var str = kbn.msFormat(4378634603, 0.23);
      expect(str).to.be('50.68 day');
    });

    it('should translate 3654454 as 1.02 hour', function() {
      var str = kbn.msFormat(3654454, 0.11);
      expect(str).to.be('1.02 hour');
    });

    it('should translate 365445 as 6.091 min', function() {
      var str = kbn.msFormat(365445, 0.022);
      expect(str).to.be('6.091 min');
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

  describe('nanosecond formatting', function () {

    it('should translate 25 to 25.0 ns', function () {
      var str = kbn.nanosFormat(25, 5);
      expect(str).to.be("25.0 ns");
    });

    it('should translate 2558 to 2.56 µs', function () {
      var str = kbn.nanosFormat(2558, 0.44);
      expect(str).to.be("2.56 µs");
    });

    it('should translate 2558000 to 2.558 ms', function () {
      var str = kbn.nanosFormat(2558000, 0.011);
      expect(str).to.be("2.558 ms");
    });

    it('should translate 2019962000 to 2.0500 s', function () {
      var str = kbn.nanosFormat(2049962000, 0.0077);
      expect(str).to.be("2.0500 s");
    });

    it('should translate 95199620000 to 1.58666 m', function () {
      var str = kbn.nanosFormat(95199620000, 0.0005);
      expect(str).to.be("1.58666 m");
    });

  });
});
