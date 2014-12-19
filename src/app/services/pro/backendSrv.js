define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('backendSrv', function($http, alertSrv) {

    this.get = function(url) {
      return this.request({ method: 'GET', url: url });
    };

    this.delete = function(url) {
      return this.request({ method: 'DELETE', url: url });
    };

    this.post = function(url, data) {
      return this.request({ method: 'POST', url: url, data: data });
    };

    this.put = function(url, data) {
      return this.request({ method: 'PUT', url: url, data: data });
    };

    this.request = function(options) {
      var httpOptions = {
        url: options.url,
        method: options.method,
        data: options.data
      };

      return $http(httpOptions).then(function(results) {
        if (options.method !== 'GET') {
          if (results && results.data.message) {
            alertSrv.set(results.data.message, '', 'success', 3000);
          }
        }
        return results.data;
      }, function(err) {
        var data = err.data || { message: 'Unexpected error' };

        if (_.isString(data)) {
          data = { message: data };
        }

        data.severity = 'error';

        if (err.status < 500) {
          data.severity = "warning";
        }

        if (data.message) {
          alertSrv.set("Error", data.message, data.severity, 10000);
        }

        throw data;
      });
    };

  });
});
