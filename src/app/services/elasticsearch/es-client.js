define([
  'angular',
  'config'
],
function(angular, config) {
  "use strict";

  var module = angular.module('kibana.services');

  module.service('elasticClient', function($http) {

    this.post = function(url, data) {

      var options = {
        url: config.elasticsearch + "/" + config.grafana_index + "/" + url,
        method: 'POST',
        data: data
      };

      if (config.elasticsearchBasicAuth) {
        options.headers = {
          "Authorization": "Basic " + config.elasticsearchBasicAuth
        };
      }

      return $http(options)
        .then(function(results) {
          return results.data;
        }, function(results) {
          return results.data;
        });
    };

  });
});
