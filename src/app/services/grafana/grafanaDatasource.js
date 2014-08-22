define([
  'angular',
  'lodash',
  'jquery',
  'config',
  'kbn',
  'moment'
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('GrafanaDatasource', function($q, $http) {

    function GrafanaDatasource() {
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

    GrafanaDatasource.prototype.saveDashboard = function(dashboard) {
      // remove id if title has changed
      if (dashboard.title !== dashboard.originalTitle) {
        dashboard.id = null;
      }

      return $http.post('/api/dashboard/', { dashboard: dashboard })
        .then(function(result) {
          return { title: dashboard.title, url: '/dashboard/db/' + result.data.slug };
        }, function(data) {
          throw "Failed to search: " + data;
        });
    };

    GrafanaDatasource.prototype.searchDashboards = function(query) {
      return $http.get('/api/search/', { params: { q: query } })
        .then(function(results) {
          var hits = { dashboards: [], tags: [] };
          hits.dashboards = results.data;
          return hits;
        }, function(data) {
          throw "Failed to search: " + data;
        });
    };

    return GrafanaDatasource;

  });

});
