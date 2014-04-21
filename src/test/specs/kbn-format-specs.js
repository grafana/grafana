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
});
