define([
  'angular',
  'underscore',
  'config',
  './graphite/graphiteDatasource',
  './influxdb/influxdbDatasource',
  './opentsdb/opentsdbDatasource',
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('datasourceSrv', function($q, filterSrv, $http, GraphiteDatasource, InfluxDatasource, OpenTSDBDatasource) {
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
      switch(ds.type) {
      case 'graphite':
        return new GraphiteDatasource(ds);
      case 'influxdb':
        return new InfluxDatasource(ds);
      case 'opentsdb':
        return new OpenTSDBDatasource(ds);
      }
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
