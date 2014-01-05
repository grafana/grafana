define([
  'app/services/graphite/gfunc'
], function(gfunc) {

  describe('when creating func instance from func namae', function() {

    it('should return func instance', function() {
      var func = gfunc.createFuncInstance('sumSeries');
      expect(func).to.be.ok();
      expect(func.def.name).to.equal('sumSeries');
      expect(func.def.params.length).to.equal(0);
      expect(func.def.defaultParams.length).to.equal(0);
      expect(func.def.defaultParams.length).to.equal(0);
    });

    it('should return func instance with shortName', function() {
      var func = gfunc.createFuncInstance('sum');
      expect(func).to.be.ok();
    });

    it('should return func instance from funcDef', function() {
      var func = gfunc.createFuncInstance('sum');
      var func = gfunc.createFuncInstance(func.def);
      expect(func).to.be.ok();
    });

    it('func instance should have text representation', function() {
      var func = gfunc.createFuncInstance('groupByNode');
      func.params[0] = 5;
      func.params[1] = 'avg';
      func.updateText();
      expect(func.text).to.equal("groupByNode(5, avg)");
    });

  });

  describe('when requesting function categories', function() {

    it('should return function categories', function() {
      var catIndex = gfunc.getCategories();
      expect(catIndex.Special.length).to.equal(3);
    });

  });

});
