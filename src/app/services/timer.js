define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('timer', function($timeout) {
    // This service really just tracks a list of $timeout promises to give us a
    // method for cancelling them all when we need to

    var timers = [];

    this.register = function(promise) {
      timers.push(promise);
      return promise;
    };

    this.cancel = function(promise) {
      timers = _.without(timers,promise);
      $timeout.cancel(promise);
    };

    this.cancel_all = function() {
      _.each(timers, function(t) {
        $timeout.cancel(t);
      });
      timers = [];
    };
  });

});