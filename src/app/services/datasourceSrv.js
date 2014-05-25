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

  module.service('datasourceSrv', function($q, filterSrv, $http, GraphiteDatasource, InfluxDatasource, dashboard, $rootScope) {
    var datasourcePanel;

    this.init = function() {
      var defaultDatasource = _.findWhere(_.values(config.datasources), { default: true } );
      this.default = this.datasourceFactory(defaultDatasource);
      $rootScope.$on('dashboard-loaded', this.dashboardLoaded);
      this.dashboardLoaded();
    };

    this.dashboardLoaded = function () {
      datasourcePanel = _.findWhere(dashboard.current.pulldowns, { type: 'datasource' });
    };

    this.datasourceFactory = function(ds) {
      switch(ds.type) {
      case 'graphite':
        return new GraphiteDatasource(ds);
      case 'influxdb':
        return new InfluxDatasource(ds);
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

    /**
     * Returns the list of data sources for global override.
     */
    this.listOptionsForGlobalOverride = function() {
      return _.map(config.datasources, function(value, key) {
        return {
          name: key,
          value: key // even for the default value, return actual key instead of null, since we want to save the override
        };
      });
    };

    /**
     * Returns the name of the global datasource, if one exists. This overrides panel-level settings on this dashboard.
     */
    this.getGlobalDatasource = function() {
      if (!datasourcePanel || !datasourcePanel.enable) {
        return null;
      }
      return datasourcePanel.datasource;
    };

    /**
     * Returns the count of datasources.
     */
    this.getCount = function() {
      return _.size(config.datasources);
    };

    /**
     * Sets the datasource with the given name as the default.
     * @param name the datasource name
     */
    this.setDefault = function(name) {
      var ds = this.get(name);
      if (!ds) {
        return;
      }
      this.default = this.datasourceFactory(ds);
    };

    this.init();
  });
});