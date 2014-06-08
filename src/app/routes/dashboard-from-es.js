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
      .when('/dashboard/elasticsearch/:id', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromElasticProvider',
      })
      .when('/dashboard/file/:jsonFile', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromFileProvider',
      });
  });

  module.controller('DashFromElasticProvider', function($scope, $rootScope, $http, $routeParams, alertSrv) {

    var elasticsearch_load = function(id) {
      var url = config.elasticsearch + "/" + config.grafana_index + "/dashboard/" + id;

      var options = {
        url: url +'?' + new Date().getTime(),
        method: "GET",
        transformResponse: function(response) {
          var dashJson = angular.fromJson(response)._source.dashboard;
          return angular.fromJson(dashJson);
        }
      };

      if (config.elasticsearchBasicAuth) {
        options.withCredentials = true;
        options.headers = {
          "Authorization": "Basic " + config.elasticsearchBasicAuth
        };
      }

      return $http(options)
        .error(function(data, status) {
          if(status === 0) {
            alertSrv.set('Error',"Could not contact Elasticsearch at " +
              config.elasticsearch + ". Please ensure that Elasticsearch is reachable from your browser.",'error');
          } else {
            alertSrv.set('Error',"Could not find dashboard " + id, 'error');
          }
          return false;
        });
    };

    elasticsearch_load($routeParams.id).then(function(result) {
      $scope.emitAppEvent('setup-dashboard', result.data);
    });

  });

  module.controller('DashFromFileProvider', function(
    $scope, $rootScope, $http, $routeParams, alertSrv, dashboard, filterSrv, panelMoveSrv) {

    $scope.init = function() {

      file_load($routeParams.jsonFile).then(function(data) {
        $scope.dashboard = dashboard.create(data);
        $scope.filter = filterSrv;
        $scope.filter.init($scope.dashboard);

        var panelMove = panelMoveSrv.create($scope.dashboard);
        // For moving stuff around the dashboard.
        $scope.panelMoveDrop = panelMove.onDrop;
        $scope.panelMoveStart = panelMove.onStart;
        $scope.panelMoveStop = panelMove.onStop;
        $scope.panelMoveOver = panelMove.onOver;
        $scope.panelMoveOut = panelMove.onOut;

        $rootScope.$emit("dashboard-loaded", $scope.dashboard);
      });
    };

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

    $scope.init();

  });

});
