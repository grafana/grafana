define([
  'angular',
  'underscore',
  'config',
  './graphite/graphiteDatasource',
  './influxdb/influxdbDatasource',
  './opentsdb/opentsdbDatasource',
  './elasticsearch/es-datasource',
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('datasourceSrv', function($q, filterSrv, $http, $injector) {
    var datasources = {};

    this.init = function() {
      _.each(config.datasources, function(value, key) {
        datasources[key] = this.datasourceFactory(value);
        if (value.default) {
          this.default = datasources[key];
        }
      }, this);

      if (!this.default) {
        this.default = datasources[_.keys(datasources)[0]];
        this.default.default = true;
      }
    };

    this.datasourceFactory = function(ds) {
      var Datasource = null;
      switch(ds.type) {
      case 'graphite':
        Datasource = $injector.get('GraphiteDatasource');
        break;
      case 'influxdb':
        Datasource = $injector.get('InfluxDatasource');
        break;
      case 'opentsdb':
        Datasource = $injector.get('OpenTSDBDatasource');
        break;
      case 'elasticsearch':
        Datasource = $injector.get('ElasticDatasource');
        break;
      }
      return new Datasource(ds);
    };

    this.get = function(name) {
      if (!name) { return this.default; }
      if (datasources[name]) { return datasources[name]; }

      throw "Unable to find datasource: " + name;
    };

    this.getAnnotationSources = function() {
      var results = [];
      _.each(datasources, function(value, key) {
        if (value.supportAnnotations) {
          results.push({
            name: key,
            editorSrc: value.annotationEditorSrc,
          });
        }
      });
      return results;
    };

    this.listOptions = function() {
      return _.map(config.datasources, function(value, key) {
        return {
          name: value.default ? key + ' (default)' : key,
          value: value.default ? null : key
        };
      });
    };

    this.init();
  });
});
