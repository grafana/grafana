define([
  'angular',
  'jquery',
  'config',
  'lodash'
],
function (angular, $, config, _) {
  "use strict";

  var module = angular.module('grafana.routes.standalone');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/dashboard/file/:jsonFile', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromFileProvider',
        reloadOnSearch: false,
      })
      .when('/dashboard/new', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromFileProvider',
        reloadOnSearch: false,
        newDashboard: true,
      });
  });

  module.controller('DashFromFileProvider', function($scope, $rootScope, $http, $routeParams, $route) {

    var renderTemplate = function(json,params) {
      var _r;
      _.templateSettings = {interpolate : /\{\{(.+?)\}\}/g};
      var template = _.template(json);
      var rendered = template({ARGS:params});
      try {
        _r = angular.fromJson(rendered);
      } catch(e) {
        _r = false;
      }
      return _r;
    };

    var file_load = function(file) {
      return $http({
        url: "/dashboards/"+file.replace(/\.(?!json)/,"/")+'?' + new Date().getTime(),
        method: "GET",
        transformResponse: function(response) {
          return renderTemplate(response,$routeParams);
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

    var fileToLoad = $routeParams.jsonFile;
    if ($route.current.newDashboard) {
      fileToLoad = 'empty.json';
    }

    file_load(fileToLoad).then(function(result) {
      $scope.initDashboard({meta: {}, model: result}, $scope);
    });

  });

});
