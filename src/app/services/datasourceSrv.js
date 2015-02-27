define([
  'angular',
  'lodash',
  'config',
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('datasourceSrv', function($q, $injector, $rootScope) {
    var self = this;

    this.datasources = {};
    this.metricSources = [];
    this.annotationSources = [];
    this.grafanaDB = new ($injector.get("GrafanaDatasource"));

    this.init = function(dsSettingList) {
      config.datasources = dsSettingList;

      _.each(config.datasources, function(value, key) {
        if (value.meta && value.meta.metrics) {
          self.metricSources.push({ value: key, name: key });
        }
      });

      if (!config.defaultDatasource) {
        $rootScope.appEvent('alert-error', ["No default data source found", ""]);
      }
    };

    this.get = function(name) {
      if (!name) {
        return this.get(config.defaultDatasource);
      }

      if (this.datasources[name]) {
        return $q.when(this.datasources[name]);
      }

      return this.loadDatasource(name);
    };

    this.loadDatasource = function(name) {
      var dsConfig = config.datasources[name];
      var deferred = $q.defer();

      var pluginDef = dsConfig.meta;

      $rootScope.require([pluginDef.module], function() {
        var AngularService = $injector.get(pluginDef.serviceName);
        var instance = new AngularService(dsConfig, pluginDef);
        instance.meta = pluginDef;
        instance.name = name;
        self.datasources[name] = instance;
        deferred.resolve(instance);
      });

      return deferred.promise;
    };

    this.getAll = function() {
      return this.datasources;
    };

    this.getAnnotationSources = function() {
      return this.annotationSources;
    };

    this.getMetricSources = function() {
      return this.metricSources;
    };

    this.getGrafanaDB = function() {
      return this.grafanaDB;
    };

    this.init(config.datasources);
  });
});
