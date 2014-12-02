define([
  'angular',
  'jquery',
  'config',
  'lodash',
  'kbn',
  'moment'
],
function (angular, $, config, _, kbn, moment) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/dashboard/script/:jsFile', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromScriptProvider',
        reloadOnSearch: false,
      });
  });

  module.controller('DashFromScriptProvider', function($scope, $rootScope, $http, $routeParams, $q, dashboardSrv, datasourceSrv, $timeout) {

    var execute_script = function(result) {
      var services = {
        dashboardSrv: dashboardSrv,
        datasourceSrv: datasourceSrv,
        $q: $q,
      };

      /*jshint -W054 */
      var script_func = new Function('ARGS','kbn','_','moment','window','document','$','jQuery', 'services', result.data);
      var script_result = script_func($routeParams, kbn, _ , moment, window, document, $, $, services);

      // Handle async dashboard scripts
      if (_.isFunction(script_result)) {
        var deferred = $q.defer();
        script_result(function(dashboard) {
          $timeout(function() {
            deferred.resolve({ data: dashboard });
          });
        });
        return deferred.promise;
      }

      return { data: script_result };
    };

    var script_load = function(file) {
      var url = 'app/dashboards/'+file.replace(/\.(?!js)/,"/") + '?' + new Date().getTime();

      return $http({ url: url, method: "GET" })
      .then(execute_script)
      .then(null,function(err) {
        console.log('Script dashboard error '+ err);
        $scope.appEvent('alert-error', ["Script Error", "Please make sure it exists and returns a valid dashboard"]);
        return false;
      });
    };

    script_load($routeParams.jsFile).then(function(result) {
      $scope.initDashboard(result.data, $scope);
    });

  });

});
