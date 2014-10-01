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

    this.request = function(options) {
      var httpOptions = {
        url: options.url,
        method: options.method,
        data: options.data
      };

      return $http(httpOptions).then(function(results) {
        if (options.method !== 'GET') {
          alertSrv.set(options.desc + ' OK ', '', 'success', 3000);
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

        alertSrv.set(options.desc + ' failed', data.message, data.severity, 10000);
      });
    };

  });
});
