define([
  'angular',
  'controllers/pro/loginCtrl',
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/login', {
        templateUrl: 'app/partials/pro/login.html',
        controller : 'LoginCtrl',
      })
      .when('/register', {
        templateUrl: 'app/partials/pro/register.html',
        controller : 'RegisterCtrl',
      });
  });

  module.controller('RegisterCtrl', function($scope, $http, $location) {
    $scope.loginModel = {};
    $scope.grafana.sidemenu = false;

    $scope.register = function() {
      delete $scope.registerError;

      if (!$scope.loginForm.$valid) { return; }
      if ($scope.loginModel.password !== $scope.loginModel.password2) {
        $scope.registerError = "Passwords do not match";
        return;
      }

      $http.post('/api/account', $scope.loginModel).then(function() {
        $location.path('/login');
      }, function(err) {
        $scope.registerError = "Unexpected error: " + err;
      });
    };

  });

});
