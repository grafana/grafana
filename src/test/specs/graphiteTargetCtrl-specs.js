define([
  './helpers',
  'controllers/graphiteTarget'
], function(helpers) {
  'use strict';

  describe('GraphiteTargetCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.controllers'));
    beforeEach(ctx.providePhase());
    beforeEach(ctx.createControllerPhase('GraphiteTargetCtrl'));

    describe('init', function() {
      beforeEach(function() {
        ctx.scope.target = {
          target: 'aliasByNode(scaleToSeconds(test.prod.*,1),2)'
        };

        ctx.scope.datasource = ctx.datasource;
        ctx.scope.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([]));
        ctx.scope.init();
      });

      it('should validate metric key exists', function() {
        expect(ctx.scope.datasource.metricFindQuery.getCall(0).args[1]).to.be('test.prod.*');
      });

      it('should parse expression and build function model', function() {
        expect(ctx.scope.functions.length).to.be(2);
      });

    });
  });
});
