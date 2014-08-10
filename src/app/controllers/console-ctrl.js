define([
  'angular',
  'moment',
],
function (angular, moment) {
  'use strict';

  var module = angular.module('grafana.controllers');
  var consoleEnabled = window.localStorage && window.localStorage.grafanaConsole === 'true';

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
      this.title = data.config.method + ' ' + this.title;
      this.elapsed = new Date().getTime() - data.config.$grafana_timestamp;
      this.title = this.title + ' (' + this.elapsed + ' ms)';
      if (data.config.params && data.config.params.q) {
        this.query = data.config.params.q;
      }
    }
  }

  module.config(function($httpProvider) {
    $httpProvider.interceptors.push(function() {
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
            console.log(response);
          }
          return response;
        }
      };
    });
  });

  module.controller('ConsoleCtrl', function($scope) {

    $scope.events = events;

  });

});
