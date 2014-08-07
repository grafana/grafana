define([
  'angular',
  'lodash',
  'jquery',
  'config',
  'kbn',
  'moment'
],
function (angular, _, $, config, kbn, moment) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('GrafanaDatasource', function($q, $http) {

    function GrafanaDatasource(datasource) {
      this.type = 'grafana';
      this.grafanaDB = true;
    }

    GrafanaDatasource.prototype.getDashboard = function(id, isTemp) {
      var url = '/dashboard/' + id;

      if (isTemp) {
        url = '/temp/' + id;
      }

      return $http.get('/api/dashboards/' + id)
        .then(function(result) {
          if (result.data) {
            return angular.fromJson(result.data);
          } else {
            return false;
          }
        }, function(data) {
          if(data.status === 0) {
            throw "Could not contact Elasticsearch. Please ensure that Elasticsearch is reachable from your browser.";
          } else {
            throw "Could not find dashboard " + id;
          }
        });
    };

    return GrafanaDatasource;

  });

});
