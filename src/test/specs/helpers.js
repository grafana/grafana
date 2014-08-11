define([
    'kbn'
], function(kbn) {
  'use strict';

  function ControllerTestContext() {
    var self = this;

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
        self.scope.row = { panels:[] };
        self.scope.filter = new FilterSrvStub();

        $rootScope.colors = [];
        for (var i = 0; i < 50; i++) { $rootScope.colors.push('#' + i); }

        self.$q = $q;
        self.scope.skipDataOnInit = true;
        self.controller = $controller(controllerName, {
          $scope: self.scope
        });

      });
    };
  }

  function ServiceTestContext() {
    var self = this;

    this.createService = function(name) {
      return inject([name, '$q', '$rootScope', '$httpBackend', function(InfluxDatasource, $q, $rootScope, $httpBackend) {
        self.service = InfluxDatasource;
        self.$q = $q;
        self.$rootScope = $rootScope;
        self.filterSrv = new FilterSrvStub();
        self.$httpBackend =  $httpBackend;
      }]);
    };
  }

  function FilterSrvStub() {
    this.time = { from:'now-1h', to: 'now'};
    this.timeRange = function(parse) {
      if (!parse) {
        return this.time;
      }
      return {
        from : kbn.parseDate(this.time.from),
             to : kbn.parseDate(this.time.to)
      };
    };

    this.applyTemplateToTarget = function(target) {
      return target;
    };
  }


  return {
    ControllerTestContext: ControllerTestContext,
    FilterSrvStub: FilterSrvStub,
    ServiceTestContext: ServiceTestContext
  };

});
