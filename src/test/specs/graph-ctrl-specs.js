define([
  'helpers',
  'features/dashboard/panelSrv',
  'panels/graph/module'
], function(helpers) {
  'use strict';

  describe('GraphCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(module('grafana.panels.graph'));

    beforeEach(ctx.providePhase());
    beforeEach(ctx.createControllerPhase('GraphCtrl'));

    describe('get_data with 2 series', function() {
      beforeEach(function() {
        ctx.annotationsSrv.getAnnotations = sinon.stub().returns(ctx.$q.when([]));
        ctx.datasource.query = sinon.stub().returns(ctx.$q.when({
          data: [
            { target: 'test.cpu1', datapoints: [[1, 10]]},
            { target: 'test.cpu2', datapoints: [[1, 10]]}
          ],

          errors: []
        }));
        ctx.scope.render = sinon.spy();
        ctx.scope.get_data();
        ctx.scope.$digest();
      });

      it('should send time series to render', function() {
        var data = ctx.scope.render.getCall(0).args[0];
        expect(data.length).to.be(2);
      });

      describe('get_data failure following success', function() {
        beforeEach(function() {
          ctx.datasource.query = sinon.stub().returns(ctx.$q.reject('Datasource Error'));
          ctx.scope.get_data();
          ctx.scope.$digest();
        });

      });

    });

    describe('get_data with varying degrees of success', function() {
      beforeEach(function() {
        ctx.scope.dataHandlerTotalFailure = sinon.spy();
        ctx.scope.dataHandlerPartialFailure = sinon.spy();
      });


      it ('should not call error handlers when completely successful', function() {
        ctx.datasource.query = sinon.stub().returns(ctx.$q.when({
          data: [
            { target: 'test.cpu1', datapoints: [[1, 10]]},
            { target: 'test.cpu2', datapoints: [[1, 10]]}
          ],

          errors: []
        }));

        ctx.scope.get_data();
        ctx.scope.$digest();

        sinon.assert.callCount(ctx.scope.dataHandlerTotalFailure, 0);
        sinon.assert.callCount(ctx.scope.dataHandlerPartialFailure, 0);
      });

      it ('should call partial error handler on partial success', function() {
        ctx.datasource.query = sinon.stub().returns(ctx.$q.when({
          data: [
            { target: 'test.cpu1', datapoints: [[1, 10]]}
          ],

          errors: [
            { 'target': 'whocares1' }
          ]
        }));

        ctx.scope.get_data();
        ctx.scope.$digest();

        sinon.assert.callCount(ctx.scope.dataHandlerTotalFailure, 0);
        sinon.assert.callCount(ctx.scope.dataHandlerPartialFailure, 1);
      });


      it ('should call total error handler on total failure', function() {
        ctx.datasource.query = sinon.stub().returns(ctx.$q.when({
          data: [
          ],

          errors: [
            { 'target': 'whocares1' }
          ]
        }));

        ctx.scope.get_data();
        ctx.scope.$digest();

        sinon.assert.callCount(ctx.scope.dataHandlerTotalFailure, 1);
      });



    });

  });

});

