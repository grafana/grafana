define([
  'angular',
  'config'
],
function(angular, config) {
  "use strict";

  var module = angular.module('kibana.services');

  module.service('elastic', function($http) {

    this._request = function(method, url, data) {
      var options = {
        url: config.elasticsearch + "/" + config.grafana_index + "/" + url,
        method: method,
        data: data
      };

      if (config.elasticsearchBasicAuth) {
        options.headers = {
          "Authorization": "Basic " + config.elasticsearchBasicAuth
        };
      }

      return $http(options);
    };

    this.post = function(url, data) {
      return this._request('POST', url, data)
        .then(function(results) {
          return results.data;
        }, function(err) {
          return err.data;
        });
    };

    this.saveDashboard = function(dashboard, title, ttl) {
      var dashboardClone = angular.copy(dashboard);
      title = dashboardClone.title = title ? title : dashboard.title;

      var data = {
        user: 'guest',
        group: 'guest',
        title: title,
        tags: dashboardClone.tags,
        dashboard: angular.toJson(dashboardClone)
      };

      return this._request('PUT', '/dashboard/' + encodeURIComponent(title), data)
        .then(function() {
          return { title: title, url: '/dashboard/elasticsearch/' + title };
        }, function(err) {
          throw 'Failed to save to elasticsearch ' + err.data;
        });
    };

  });
});
