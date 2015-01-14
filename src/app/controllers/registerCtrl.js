define([
  'angular',
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.controller('RegisterCtrl', function($scope, backendSrv, $location) {
    $scope.loginModel = {};
    $scope.grafana.sidemenu = false;

    $scope.register = function() {
      delete $scope.registerError;

      if (!$scope.loginForm.$valid) { return; }
      if ($scope.loginModel.password !== $scope.loginModel.password2) {
        $scope.registerError = "Passwords do not match";
        return;
      }

      backendSrv.post('/api/account/signup', $scope.loginModel).then(function() {
        $location.path('/login');
      });
    };

  });

});
