define([
  'angular',
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/admin/datasources', {
        templateUrl: 'app/partials/pro/admin_datasources.html',
        controller : 'AdminCtrl',
      });
  });

  module.config(function($routeProvider) {
    $routeProvider
      .when('/account', {
        templateUrl: 'app/partials/pro/account.html',
        controller : 'AccountCtrl',
      });
  });

  module.controller('AdminCtrl', function() {

  });

  module.controller('AccountCtrl', function($scope, $http) {

    $scope.collaborator = {};

    $scope.addCollaborator = function() {
      if (!$scope.addCollaboratorForm.$valid) {
        return;
      }

      $http.post('/api/account/collaborators/add', $scope.collaborator).then(function(results) {

      }, function(err) {

      });
    };

  });

});
