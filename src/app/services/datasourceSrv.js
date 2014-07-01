define([
  'angular',
  'underscore',
  'config',
  './graphite/graphiteDatasource',
  './influxdb/influxdbDatasource',
  './opentsdb/opentsdbDatasource',
  './kairosdb/kairosdbDatasource',
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('datasourceSrv', function($q, filterSrv, $http, GraphiteDatasource, InfluxDatasource,
                                           OpenTSDBDatasource, KairosDBDatasource) {

    this.init = function() {
      var defaultDatasource = _.findWhere(_.values(config.datasources), { default: true });
      if (!defaultDatasource) {
        defaultDatasource = config.datasources[_.keys(config.datasources)[0]];
      }
      this.default = this.datasourceFactory(defaultDatasource);
    };

    this.datasourceFactory = function(ds) {
      switch(ds.type) {
      case 'graphite':
        return new GraphiteDatasource(ds);
      case 'influxdb':
        return new InfluxDatasource(ds);
      case 'opentsdb':
        return new OpenTSDBDatasource(ds);
      case 'kairosdb':
        return new KairosDBDatasource(ds);
      }
    };

    this.get = function(name) {
      if (!name) { return this.default; }

      var ds = config.datasources[name];
      if (!ds) {
        return null;
      }

      return this.datasourceFactory(ds);
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
