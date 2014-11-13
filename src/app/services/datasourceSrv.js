define([
  'angular',
  'lodash',
  'config',
  './graphite/graphiteDatasource',
  './influxdb/influxdbDatasource',
  './opentsdb/opentsdbDatasource',
  './elasticsearch/es-datasource',
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('datasourceSrv', function($q, $http, $injector) {
    var datasources = {};
    var metricSources = [];
    var annotationSources = [];
    var grafanaDB = {};

    this.init = function() {
      _.each(config.datasources, function(value, key) {
        var ds = this.datasourceFactory(value);
        if (value.default) {
          this.default = ds;
          ds.default = true;
        }
        datasources[key] = ds;
      }, this);

      if (!this.default) {
        this.default = datasources[_.keys(datasources)[0]];
        this.default.default = true;
      }

      // create list of different source types
      _.each(datasources, function(value, key) {
        if (value.supportMetrics) {
          metricSources.push({
            name: value.name,
            value: value.default ? null : key,
            default: value.default,
          });
        }
        if (value.supportAnnotations) {
          annotationSources.push({
            name: key,
            editorSrc: value.annotationEditorSrc,
          });
        }
        if (value.grafanaDB) {
          grafanaDB = value;
        }
      });

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
      default:
        Datasource = $injector.get(ds.type);
      }
      return new Datasource(ds);
    };

    this.add = function(dt) {
      datasources[dt.name] = dt;
      if(_.findIndex(metricSources,{name: dt.name}) === -1){
        //add only if not exists yet
        metricSources.push({name: dt.name, value: dt.value});
      }
    };

    this.remove = function(dtname) {
      if(datasources[dtname]){
        delete datasources[dtname];
      }
      var i=_.findIndex(metricSources, { name: dtname });
      if(i !== -1) {
        metricSources.splice(i, 1);
      }
    };
    //reset all its variable datasources ( owned by dashboards).
    this.reset = function() {
      for (var key in datasources){
        if(key.match(/^\$./) != null) {
          delete datasources[key];
          console.log('deleting:'+key);
        }
      }
      //reset metric sources
      metricSources.forEach(function(obj,i) {
        if(obj.name.match(/^\$./) != null) {
          console.log('deleting:'+obj.name);
          delete metricSources[i];
        }
      });
    };

    this.get = function(name) {
      if (!name) { return this.default; }
      if (datasources[name]) { return datasources[name]; }

      return this.default;
    };

    this.getAnnotationSources = function() {
      return annotationSources;
    };

    this.getMetricSources = function() {
      return metricSources;
    };

    this.getGrafanaDB = function() {
      return grafanaDB;
    };

    this.init();
  });
});
