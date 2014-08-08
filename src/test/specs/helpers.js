define([
    'kbn'
], function(kbn) {
  'use strict';

  function ControllerTestContext() {
    var self = this;

    this.timeRange = { from:'now-1h', to: 'now'};
    this.datasource = {};
    this.annotationsSrv = {};
    this.datasourceSrv = {
      getMetricSources: function() {},
      get: function() { return self.datasource; }
    };

    this.providePhase = function() {
      return module(function($provide) {
        $provide.value('datasourceSrv', self.datasourceSrv);
        $provide.value('annotationsSrv', self.annotationsSrv);
      });
    };

    this.createControllerPhase = function(controllerName) {
      return inject(function($controller, $rootScope, $q) {
        self.scope = $rootScope.$new();
        self.scope.panel = {};
        self.scope.filter = {
          timeRange: function(parse) {
            if (!parse) {
              return self.timeRange;
            }
            return {
              from : kbn.parseDate(self.timeRange.from),
              to : kbn.parseDate(self.timeRange.to)
            };
          }
        };

        self.scope.colors = [];
        for (var i = 0; i < 50; i++) { self.scope.colors.push('#' + i); }

        self.$q = $q;
        self.scope.skipDataOnInit = true;
        self.controller = $controller(controllerName, {
          $scope: self.scope
        });

      });
    };
  }


  return {
    ControllerTestContext: ControllerTestContext
  };

});
