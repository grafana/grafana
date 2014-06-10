define([
  'angular',
  'config'
],
function(angular, config) {
  "use strict";

  var module = angular.module('kibana.services');

  module.service('elastic', function($http) {

    this.put = function(url, data) {
      url = config.elasticsearch + '/' + config.grafana_index + url;

      var options = {
        url: url,
        method: 'PUT',
        data: data
      };

      return $http(options);
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

      return this.put('/dashboard/' + encodeURIComponent(title), data)
        .then(function() {
          return { title: title, url: '/dashboard/elasticsearch/' + title };
        }, function(err) {
          throw 'Failed to save to elasticsearch ' + err.data;
        });
    };

  });

});
