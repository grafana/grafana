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

  module.service('datasourceSrv', function($q, $http, $injector) {

    this.init = function(dsSettingList) {
      config.datasources = dsSettingList;

      this.datasources = {};
      this.metricSources = [];
      this.annotationSources = [];

      _.each(dsSettingList, function(value, key) {
        var ds = this.datasourceFactory(value);
        ds.name = key;
        if (value.default) {
          this.default = ds;
          ds.default = true;
        }
        this.datasources[key] = ds;
      }, this);

      if (!this.default) {
        this.default = this.datasources[_.keys(this.datasources)[0]];
        this.default.default = true;
      }

      // create list of different source types
      _.each(this.datasources, function(value, key) {
        if (value.supportMetrics) {
          this.metricSources.push({
            name: value.name,
            value: value.default ? null : key,
            default: value.default,
          });
        }
        if (value.supportAnnotations) {
          this.annotationSources.push({ name: key, editorSrc: value.annotationEditorSrc });
        }
        if (value.grafanaDB) {
          this.grafanaDB = value;
        }
      }, this);
    };

    this.datasourceFactory = function(ds) {
      var type = typeMap[ds.type] || ds.type;
      var Datasource = $injector.get(type);
      return new Datasource(ds);
    };

    this.get = function(name) {
      if (!name) { return this.default; }
      if (this.datasources[name]) { return this.datasources[name]; }

      return this.default;
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
