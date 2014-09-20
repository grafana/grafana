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

  module.controller('AccountCtrl', function($scope, $http, alertSrv) {

    $scope.collaborator = {};

    $scope.addCollaborator = function() {
      if (!$scope.addCollaboratorForm.$valid) {
        return;
      }

      $http.post('/api/account/collaborators/add', $scope.collaborator).then(function() {
        alertSrv.set('Collaborator added', '', 'success', 3000);
      }, function(err) {
        if (err.data && err.data.status) {
          alertSrv.set('Could not add collaborator', err.data.status, 'warning', 10000);
        }
        else if (err.statusText) {
          alertSrv.set('Could not add collaborator', err.data.status, 'warning', 10000);
        }
        console.log("value", err);
      });
    };

  });

});
