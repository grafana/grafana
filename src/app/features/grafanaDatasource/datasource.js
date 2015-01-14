define([
  'angular',
  'lodash',
  'kbn',
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('GrafanaDatasource', function($q, backendSrv) {

    function GrafanaDatasource() {
      this.type = 'grafana';
      this.grafanaDB = true;
      this.name = "grafana";
      this.supportMetrics = true;
      this.editorSrc = 'app/features/grafanaDatasource/partials/query.editor.html';
    }

    GrafanaDatasource.prototype.getDashboard = function(id, isTemp) {
      var url = '/dashboard/' + id;

      if (isTemp) {
        url = '/temp/' + id;
      }

      return backendSrv.get('/api/dashboard/' + id)
        .then(function(data) {
          if (data) {
            return angular.fromJson(data);
          } else {
            return false;
          }
        });
    };

    GrafanaDatasource.prototype.query = function(options) {
      // get from & to in seconds
      var from = kbn.parseDate(options.range.from).getTime();
      var to = kbn.parseDate(options.range.to).getTime();

      return backendSrv.get('/api/metrics/test', { from: from, to: to, maxDataPoints: options.maxDataPoints });
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
      return backendSrv.get('/api/search/', {q: query})
        .then(function(data) {
          _.each(data.dashboards, function(item) {
            item.id = item.slug;
          });
          return data;
        });
    };

    return GrafanaDatasource;

  });

});
