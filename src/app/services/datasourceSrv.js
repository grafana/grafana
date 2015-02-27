define([
  'angular',
  'lodash',
  'config',
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.services');
  var typeMap = {
    'graphite': 'GraphiteDatasource',
    'influxdb': 'InfluxDatasource',
    'influxdb_08': 'InfluxDatasource_08',
    'elasticsearch': 'ElasticDatasource',
    'opentsdb': 'OpenTSDBDatasource',
    'grafana': 'GrafanaDatasource',
  };

  var plugins = {
    datasources: {
      'graphite': {
        'serviceName': 'GraphiteDatasource',
        'module': 'features/graphite/datasource'
      }
    }
  };

  module.service('datasourceSrv', function($q, $injector, $rootScope) {
    var self = this;

    this.datasources = {};

    this.init = function(dsSettingList) {
      config.datasources = dsSettingList;
    };

    this.datasourceFactory = function(ds) {
      var type = typeMap[ds.type] || ds.type;
      var Datasource = $injector.get(type);
      return new Datasource(ds);
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
      var datasourceConfig = config.datasources[name];
      var pluginDef = plugins.datasources[datasourceConfig.type];

      if (!pluginDef) {
        throw { message: "No plugin definition for data source: " + name };
      }

      var deferred = $q.defer();

      $rootScope.require([pluginDef.module], function() {
        var AngularService = $injector.get(pluginDef.serviceName);
        var instance = new AngularService(datasourceConfig);
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
