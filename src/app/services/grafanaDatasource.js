define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('GrafanaDatasource', function($q, backendSrv) {

    function GrafanaDatasource() {
      this.type = 'grafana';
      this.grafanaDB = true;
    }

    GrafanaDatasource.prototype.getDashboard = function(id, isTemp) {
      var url = '/dashboard/' + id;

      if (isTemp) {
        url = '/temp/' + id;
      }

      return backendSrv.get('/api/dashboards/' + id)
        .then(function(data) {
          if (data) {
            return angular.fromJson(data);
          } else {
            return false;
          }
        });
    };

    GrafanaDatasource.prototype.saveDashboard = function(dashboard) {
      // remove id if title has changed
      if (dashboard.title !== dashboard.originalTitle) {
        dashboard.id = null;
      }

      return backendSrv.post('/api/dashboard/', { dashboard: dashboard })
        .then(function(data) {
          return { title: dashboard.title, url: '/dashboard/db/' + data.slug };
        });
    };

    GrafanaDatasource.prototype.deleteDashboard = function(id) {
      return backendSrv.delete('/api/dashboard/' + id)
        .then(function(data) {
          return data.title;
        });
    };

    GrafanaDatasource.prototype.searchDashboards = function(query) {
      return backendSrv.get('/api/search/', { params: { q: query } })
        .then(function(data) {
          var hits = { dashboards: [], tags: [] };
          hits.dashboards = _.map(data, function(item) {
            item.id = item.slug;
            return item;
          });
          return hits;
        });
    };

    return GrafanaDatasource;

  });

});
