define([
  'angular',
  'lodash',
  'moment',
  'store'
],
function (angular, _, moment, store) {
  'use strict';

  var module = angular.module('grafana.controllers');
  var consoleEnabled = store.getBool('grafanaConsole');

  if (!consoleEnabled) {
    return;
  }

  var events = [];

  function ConsoleEvent(type, title, data) {
    this.type = type;
    this.title = title;
    this.data = data;
    this.time = moment().format('hh:mm:ss');

    if (data.config) {
      this.method = data.config.method;
      this.elapsed = (new Date().getTime() - data.config.$grafana_timestamp) + ' ms';
      if (data.config.params && data.config.params.q) {
        this.field2 = data.config.params.q;
      }
      if (_.isString(data.config.data)) {
        this.field2 = data.config.data;
      }
      if (data.status !== 200) {
        this.error = true;
        this.field3 = data.data;
      }

      if (_.isArray(data.data)) {
        this.extractTimeseriesInfo(data.data);
      }
    }
  }

  ConsoleEvent.prototype.extractTimeseriesInfo = function(series) {
    if (series.length === 0) {
      return;
    }

    var points = 0;
    var ok = false;

    if (series[0].datapoints) {
      points = _.reduce(series, function(memo, val) {
        return memo + val.datapoints.length;
      }, 0);
      ok = true;
    }
    if (series[0].columns) {
      points = _.reduce(series, function(memo, val) {
        return memo + val.points.length;
      }, 0);
      ok = true;
    }

    if (ok) {
      this.field1 = '(' + series.length + ' series';
      this.field1 += ', ' + points + ' points)';
    }
  };

  module.config(function($provide, $httpProvider) {
    $provide.factory('mupp', function($q) {
      return {
        'request': function(config) {
          if (config.inspect) {
            config.$grafana_timestamp = new Date().getTime();
          }
          return config;
        },
        'response': function(response) {
          if (response.config.inspect) {
            events.push(new ConsoleEvent(response.config.inspect.type, response.config.url, response));
          }
          return response;
        },
        'requestError': function(rejection) {
          console.log('requestError', rejection);
          return $q.reject(rejection);
        },
        'responseError': function (rejection) {
          var inspect = rejection.config.inspect || { type: 'error' };
          events.push(new ConsoleEvent(inspect.type, rejection.config.url, rejection));
          return $q.reject(rejection);
        }
      };
    });

    $httpProvider.interceptors.push('mupp');
  });

  module.controller('ConsoleCtrl', function($scope) {

    $scope.events = events;

  });

});
