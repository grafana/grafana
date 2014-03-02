define([
  'angular',
  'underscore',
  'config',
  './graphite/graphiteDatasource',
  './influxdb/influxdbDatasource',
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('datasourceSrv', function($q, filterSrv, $http, GraphiteDatasource, InfluxDatasource) {

    var defaultDatasource = _.findWhere(_.values(config.datasources), { default: true } );

    this.default = new GraphiteDatasource(defaultDatasource);

    this.get = function(name) {
      if (!name) { return this.default; }

      var ds = config.datasources[name];
      if (!ds) {
        return null;
      }

      switch(ds.type) {
      case 'graphite':
        return new GraphiteDatasource(ds);
      case 'influxdb':
        return new InfluxDatasource(ds);
      }
    };

    this.listOptions = function() {
      return _.map(config.datasources, function(value, key) {
        return {
          name: value.default ? key + ' (default)' : key,
          value: value.default ? null : key
        };
      });
    };
  });
});