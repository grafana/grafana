define([
  './helpers',
  'services/graphite/gfunc',
  'controllers/graphiteTarget'
], function(helpers, gfunc) {
  'use strict';

  describe('GraphiteTargetCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.controllers'));
    beforeEach(ctx.providePhase());
    beforeEach(ctx.createControllerPhase('GraphiteTargetCtrl'));

    beforeEach(function() {
      ctx.scope.target = {
        target: 'aliasByNode(scaleToSeconds(test.prod.*,1),2)'
      };

      ctx.scope.datasource = ctx.datasource;
      ctx.scope.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([]));
    });

    describe('init', function() {
      beforeEach(function() {
        ctx.scope.init();
        ctx.scope.$digest();
      });

      it('should validate metric key exists', function() {
        expect(ctx.scope.datasource.metricFindQuery.getCall(0).args[1]).to.be('test.prod.*');
      });

      it('should delete last segment if no metrics are found', function() {
        expect(ctx.scope.segments[2].value).to.be('select metric');
      });

      it('should parse expression and build function model', function() {
        expect(ctx.scope.functions.length).to.be(2);
      });
    });

    describe('when adding function', function() {
      beforeEach(function() {
        ctx.scope.target.target = 'test.prod.*.count';
        ctx.scope.datasource.metricFindQuery.returns(ctx.$q.when([{expandable: false}]));
        ctx.scope.init();
        ctx.scope.$digest();

        ctx.scope.$parent = { get_data: sinon.spy() };
        ctx.scope.addFunction(gfunc.getFuncDef('aliasByNode'));
      });

      it('should add function with correct node number', function() {
        expect(ctx.scope.functions[0].params[0]).to.be(2);
      });

      it('should update target', function() {
        expect(ctx.scope.target.target).to.be('aliasByNode(test.prod.*.count,2)');
      });

      it('should call get_data', function() {
        expect(ctx.scope.$parent.get_data.called).to.be(true);
      });
    });

    describe('targetChanged', function() {
      beforeEach(function() {
        ctx.scope.datasource.metricFindQuery.returns(ctx.$q.when([{expandable: false}]));
        ctx.scope.init();
        ctx.scope.$digest();

        ctx.scope.$parent = { get_data: sinon.spy() };
        ctx.scope.target.target = '';
        ctx.scope.targetChanged();
      });

      it('should rebuld target after expression model', function() {
        expect(ctx.scope.target.target).to.be('aliasByNode(scaleToSeconds(test.prod.*,1),2)');
      });

      it('should call get_data', function() {
        expect(ctx.scope.$parent.get_data.called).to.be(true);
      });
    });


  });
});
