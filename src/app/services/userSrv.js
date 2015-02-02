define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('userSrv', function(backendSrv, $q) {

    function User() {
      if (window.grafanaBootData.user) {
        _.extend(this, window.grafanaBootData.user);
      }
    }

    User.prototype.getStars = function() {
      if (!this.isSignedIn) {
        return $q.when([]);
      }

      return backendSrv.get('/api/user/stars').then(function(stars) {
        return stars;
      });
    };

    this.getSignedInUser = function() {
      return new User();
    };

  });

});
