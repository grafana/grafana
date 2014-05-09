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

    it('should translate 365445 as 6.09 min', function() {
      var str = kbn.msFormat(365445, 2);
      expect(str).to.be('6.09 min');
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
});
