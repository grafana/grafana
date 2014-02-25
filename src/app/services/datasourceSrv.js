define([
  'angular',
  'underscore',
  'config'
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('datasourceSrv', function($q, filterSrv, $http, GraphiteDatasource) {

    var defaultDatasource = _.findWhere(_.values(config.datasources), { default: true } );

    this.default = new GraphiteDatasource(defaultDatasource, $q, filterSrv, $http);

    this.get = function(name) {
      if (!name) {
        return this.default;
      }

      return new GraphiteDatasource(config.datasources[name], $q, filterSrv, $http);
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