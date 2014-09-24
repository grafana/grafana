define([
  'angular',
  'config',
  'lodash',
  'jquery',
  'store',
],
function (angular, config, _, $, store) {
  "use strict";

  var module = angular.module('grafana.controllers');

  module.controller('GrafanaCtrl', function($scope, alertSrv, grafanaVersion, $rootScope, $controller) {

    $scope.grafanaVersion = grafanaVersion[0] === '@' ? 'master' : grafanaVersion;
    $scope.consoleEnabled = store.getBool('grafanaConsole');

    $rootScope.profilingEnabled = store.getBool('profilingEnabled');
    $rootScope.performance = { loadStart: new Date().getTime() };

    $scope.init = function() {
      $scope._ = _;

      if ($rootScope.profilingEnabled) { $scope.initProfiling(); }

      $scope.dashAlerts = alertSrv;
      $scope.grafana = { style: 'dark' };
    };

    $scope.toggleConsole = function() {
      $scope.consoleEnabled = !$scope.consoleEnabled;
      store.set('grafanaConsole', $scope.consoleEnabled);
    };

    $scope.initDashboard = function(dashboardData, viewScope) {
      $controller('DashboardCtrl', { $scope: viewScope }).init(dashboardData);
    };

    $rootScope.onAppEvent = function(name, callback) {
      var unbind = $rootScope.$on(name, callback);
      this.$on('$destroy', unbind);
    };

    $rootScope.emitAppEvent = function(name, payload) {
      $rootScope.$emit(name, payload);
    };

    $rootScope.colors = [
      "#7EB26D","#EAB839","#6ED0E0","#EF843C","#E24D42","#1F78C1","#BA43A9","#705DA0", //1
      "#508642","#CCA300","#447EBC","#C15C17","#890F02","#0A437C","#6D1F62","#584477", //2
      "#B7DBAB","#F4D598","#70DBED","#F9BA8F","#F29191","#82B5D8","#E5A8E2","#AEA2E0", //3
      "#629E51","#E5AC0E","#64B0C8","#E0752D","#BF1B00","#0A50A1","#962D82","#614D93", //4
      "#9AC48A","#F2C96D","#65C5DB","#F9934E","#EA6460","#5195CE","#D683CE","#806EB7", //5
      "#3F6833","#967302","#2F575E","#99440A","#58140C","#052B51","#511749","#3F2B5B", //6
      "#E0F9D7","#FCEACA","#CFFAFF","#F9E2D2","#FCE2DE","#BADFF4","#F9D9F9","#DEDAF7"  //7
    ];

    $scope.getTotalWatcherCount = function() {
      var count = 0;
      var scopes = 0;
      var root = $(document.getElementsByTagName('body'));

      var f = function (element) {
        if (element.data().hasOwnProperty('$scope')) {
          scopes++;
          angular.forEach(element.data().$scope.$$watchers, function () {
            count++;
          });
        }

        angular.forEach(element.children(), function (childElement) {
          f($(childElement));
        });
      };

      f(root);
      $rootScope.performance.scopeCount = scopes;
      return count;
    };

    $scope.initProfiling = function() {
      var count = 0;

      $scope.$watch(function digestCounter() {
        count++;
      }, function() {
      });

      $scope.onAppEvent('setup-dashboard', function() {
        count = 0;

        setTimeout(function() {
          console.log("Dashboard::Performance Total Digests: " + count);
          console.log("Dashboard::Performance Total Watchers: " + $scope.getTotalWatcherCount());
          console.log("Dashboard::Performance Total ScopeCount: " + $rootScope.performance.scopeCount);

          var timeTaken = $rootScope.performance.allPanelsInitialized - $rootScope.performance.dashboardLoadStart;
          console.log("Dashboard::Performance - All panels initialized in " + timeTaken + " ms");

          // measure digest performance
          var rootDigestStart = window.performance.now();
          for (var i = 0; i < 30; i++) {
            $rootScope.$apply();
          }
          console.log("Dashboard::Performance Root Digest " + ((window.performance.now() - rootDigestStart) / 30));

        }, 3000);

      });

    };

    $scope.init();

  });
});
