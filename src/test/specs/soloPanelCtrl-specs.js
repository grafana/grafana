define([
  'helpers',
  'features/panel/soloPanelCtrl',
  'features/dashboard/dashboardSrv',
], function(helpers) {
  'use strict';

  describe('SoloPanelCtrl', function() {
    var ctx = new helpers.ControllerTestContext();
    var datasource = {};
    var routeParams = {};
    var search = {};

    beforeEach(module('grafana.routes'));
    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase({
      $routeParams: routeParams,
      $location: {
        search: function() {
          return search;
        }
      },
      datasourceSrv: {
        getGrafanaDB: sinon.stub().returns(datasource)
      }
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
        datasource.getDashboard = sinon.stub().returns(ctx.$q.when(dashboard));

        ctx.scope.init();
        ctx.scope.$digest();
      });

      it('should load dashboard and extract panel and setup panel scope', function() {
        expect(ctx.scope.panel.id).to.be(23);
        expect(ctx.scope.panel.some).to.be('prop');
      });

    });

  });

});
