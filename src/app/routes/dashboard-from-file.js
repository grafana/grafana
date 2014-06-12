define([
  'angular',
  'jquery',
  'config',
  'underscore'
],
function (angular, $, config, _) {
  "use strict";

  var module = angular.module('kibana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/dashboard/file/:jsonFile', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromFileProvider',
      })
      .when('/', {
        redirectTo: function() {
          if (window.localStorage && window.localStorage.grafanaDashboardDefault) {
            return window.localStorage.grafanaDashboardDefault;
          }
          else {
            return config.default_route;
          }
        }
      });
  });

  module.controller('DashFromFileProvider', function($scope, $rootScope, $http, $routeParams, alertSrv) {

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
        url: "app/dashboards/"+file.replace(/\.(?!json)/,"/")+'?' + new Date().getTime(),
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
        alertSrv.set('Error',"Could not load <i>dashboards/"+file+"</i>. Please make sure it exists" ,'error');
        return false;
      });
    };

    file_load($routeParams.jsonFile).then(function(result) {
      $scope.emitAppEvent('setup-dashboard', result);
    });

  });

});
