define([
  'app/services/graphite/gfunc'
], function(gfunc) {

  describe('when creating func instance from func names', function() {

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

  describe('when rendering func instance', function() {

    it('should handle single metric param', function() {
      var func = gfunc.createFuncInstance('sumSeries');
      expect(func.render('hello.metric')).to.equal("sumSeries(hello.metric)");
    });

    it('should handle metric param and int param and string param', function() {
      var func = gfunc.createFuncInstance('groupByNode');
      func.params[0] = 5;
      func.params[1] = 'avg';
      expect(func.render('hello.metric')).to.equal("groupByNode(hello.metric,5,'avg')");
    });

    it('should handle function with no metric param', function() {
      var func = gfunc.createFuncInstance('randomWalk');
      func.params[0] = 'test';
      expect(func.render(undefined)).to.equal("randomWalk('test')");
    });

  });

  describe('when requesting function categories', function() {

    it('should return function categories', function() {
      var catIndex = gfunc.getCategories();
      expect(catIndex.Special.length).to.equal(8);
    });

  });

});
