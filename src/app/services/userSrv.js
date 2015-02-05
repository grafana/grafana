define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('userSrv', function() {

    function User() {
      if (window.grafanaBootData.user) {
        _.extend(this, window.grafanaBootData.user);
      }
    }

    this.getSignedInUser = function() {
      return new User();
    };

  });

});
