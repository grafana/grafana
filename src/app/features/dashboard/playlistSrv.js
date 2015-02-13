define([
  'angular',
  'lodash',
  'kbn',
  'store'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('playlistSrv', function($location, $rootScope, $timeout) {
    var self = this;

    this.next = function() {
      $timeout.cancel(self.cancelPromise);

      angular.element(window).unbind('resize');
      var dash = self.dashboards[self.index % self.dashboards.length];
      var relativeUrl = dash.url.substring($location.absUrl().length - $location.url().length);

      $location.url(relativeUrl);
      self.index++;

      self.cancelPromise = $timeout(self.next, self.interval);
    };

    this.prev = function() {
      self.index = Math.max(self.index - 2, 0);
      self.next();
    };

    this.start = function(dashboards, timespan) {
      this.stop();

      self.interval = kbn.interval_to_ms(timespan);
      self.dashboards = dashboards;
      $rootScope.playlistSrv = this;

      self.cancelPromise = $timeout(self.next, self.interval);
    };

    this.stop = function() {
      self.index = 0;

      if (self.cancelPromise) {
        $timeout.cancel(self.cancelPromise);
      }

      $rootScope.playlistSrv = null;
    };

  });

});
