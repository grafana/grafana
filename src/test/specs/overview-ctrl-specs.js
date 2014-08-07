define([
    'panels/overview/module'
], function() {
  'use strict';

  function ControllerTestContext() {
    var self = this;

    this.datasource = {};
    this.datasourceSrv = {
      getMetricSources: function() {},
      get: function() { return self.datasource; }
    };

    this.providePhase = function() {
      return module(function($provide) {
        $provide.value('datasourceSrv', self.datasourceSrv);
      });
    };

    this.createControllerPhase = function(controllerName) {
      return inject(function($controller, $rootScope, $q) {
        self.scope = $rootScope.$new();
        self.scope.panel = {};
        self.scope.filter = {
          timeRange: function() {}
        };

        self.$q = $q;
        self.scope.skipDataOnInit = true;
        self.controller = $controller(controllerName, {
          $scope: self.scope
        });

      });
    };

  }

  describe('OverviewCtrl', function() {
    var ctx = new ControllerTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(module('grafana.panels.overview'));

    beforeEach(ctx.providePhase());
    beforeEach(ctx.createControllerPhase('OverviewCtrl'));

    describe('when query return error', function() {
      beforeEach(function() {
        ctx.datasource.query =  function() {
          return ctx.$q.reject({ message: 'Some error' });
        };
        ctx.scope.get_data();
        ctx.scope.$digest();
      });

      it('panel.error should be set', function() {
        expect(ctx.scope.panel.error).to.be("Some error");
      });
    });
  });
});
