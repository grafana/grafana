define([
    'kbn',
    'lodash'
], function(kbn, _) {
  'use strict';

  function ControllerTestContext() {
    var self = this;

    this.datasource = {};
    this.annotationsSrv = {};
    this.timeSrv = new TimeSrvStub();
    this.templateSrv = new TemplateSrvStub();
    this.datasourceSrv = {
      getMetricSources: function() {},
      get: function() { return self.datasource; }
    };

    this.providePhase = function() {
      return module(function($provide) {
        $provide.value('datasourceSrv', self.datasourceSrv);
        $provide.value('annotationsSrv', self.annotationsSrv);
        $provide.value('timeSrv', self.timeSrv);
        $provide.value('templateSrv', self.templateSrv);
      });
    };

    this.createControllerPhase = function(controllerName) {
      return inject(function($controller, $rootScope, $q) {
        self.scope = $rootScope.$new();
        self.scope.panel = {};
        self.scope.row = { panels:[] };
        self.scope.dashboard = {};
        self.scope.dashboardViewState = new DashboardViewStateStub();

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
    self.templateSrv = new TemplateSrvStub();
    self.timeSrv = new TimeSrvStub();
    self.datasourceSrv = {};
    self.$routeParams = {};

    this.providePhase = function(mocks) {
     return module(function($provide) {
       _.each(mocks, function(key) {
         $provide.value(key, self[key]);
       });
      });
    };

    this.createService = function(name) {
      return inject(function($q, $rootScope, $httpBackend, $injector) {
        self.$q = $q;
        self.$rootScope = $rootScope;
        self.$httpBackend =  $httpBackend;

        self.$rootScope.onAppEvent = function() {};
        self.$rootScope.appEvent = function() {};

        self.service = $injector.get(name);
      });
    };
  }

  function DashboardViewStateStub() {
    this.registerPanel = function() {
    };
  }

  function TimeSrvStub() {
    this.time = { from:'now-1h', to: 'now'};
    this.timeRange = function(parse) {
      if (parse === false) {
        return this.time;
      }
      return {
        from : kbn.parseDate(this.time.from),
        to : kbn.parseDate(this.time.to)
      };
    };

    this.replace = function(target) {
      return target;
    };
  }

  function TemplateSrvStub() {
    this.variables = [];
    this.templateSettings = { interpolate : /\[\[([\s\S]+?)\]\]/g };
    this.data = {};
    this.replace = function(text) {
      return _.template(text, this.data,  this.templateSettings);
    };
    this.init = function() {};
    this.updateTemplateData = function() { };
    this.variableExists = function() { return false; };
    this.highlightVariablesAsHtml = function(str) { return str; };
    this.setGrafanaVariable = function(name, value) {
      this.data[name] = value;
    };
  }

  return {
    ControllerTestContext: ControllerTestContext,
    TimeSrvStub: TimeSrvStub,
    ServiceTestContext: ServiceTestContext
  };

});
