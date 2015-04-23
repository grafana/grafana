define([
  'angular',
],
function (angular) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.controller('DashFromRaintankCtrl', function($scope, $rootScope, $http, $routeParams) {
    console.log("DashFromRaintankCtrl");
    var file_load = function(file) {
      return $http({
        url: "public/dashboards/raintank/"+file+'.json?' + new Date().getTime(),
             method: "GET",
             transformResponse: function(response) {
               return angular.fromJson(response);
             }
      }).then(function(result) {
        if(!result) {
          return false;
        }
        return result.data;
      },function() {
        $scope.appEvent('alert-error', ["Dashboard load failed", "Could not load <i>dashboards/"+file+"</i>. Please make sure it exists"]);
        return false;
      });
    };

    file_load($routeParams.slug).then(function(result) {
      $scope.initDashboard({meta: {isRaintank: true, canSave: false}, model: result}, $scope);
    });

  });
});