define([
  'helpers',
  'features/panel/soloPanelCtrl',
  'features/dashboard/dashboardSrv',
], function(helpers) {
  'use strict';

  describe('SoloPanelCtrl', function() {
    var ctx = new helpers.ControllerTestContext();
    var backendSrv = {};
    var routeParams = {};
    var search = {};
    var contextSrv = {};

    beforeEach(module('grafana.routes'));
    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase({
      $routeParams: routeParams,
      contextSrv: contextSrv,
      $location: {
        search: function() {
          return search;
        }
      },
      templateValuesSrv: { init: sinon.stub() },
      backendSrv: backendSrv
    }));

    beforeEach(ctx.createControllerPhase('SoloPanelCtrl'));

    describe('setting up solo panel scope', function() {

      beforeEach(function() {
        var dashboard = {
          model: {
            rows: [
              {
                panels: [
                  {
                    id: 23,
                    some: 'prop'
                  }
                ]
              }
            ]
          }
        };

        routeParams.id = 1;
        search.panelId = 23;
        backendSrv.getDashboard = sinon.stub().returns(ctx.$q.when(dashboard));

        ctx.scope.init();
        ctx.scope.$digest();
      });

      it('should load dashboard and extract panel and setup panel scope', function() {
        expect(ctx.scope.panel.id).to.be(23);
        expect(ctx.scope.panel.some).to.be('prop');
      });

      it('should hide sidemenu', function() {
        expect(contextSrv.sidemenu).to.be(false);
      });

    });

  });

});
