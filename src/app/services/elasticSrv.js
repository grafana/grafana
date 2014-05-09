define([
  'angular',
  'jquery',
  'kbn',
  'underscore',
  'config'
],
function (angular, $, kbn, _, config) {
  'use strict';

  var module = angular.module('kibana.services');
  module.service('elasticSrv', function(
    $routeParams, $http, $rootScope, $injector, $location, $timeout,
    ejsResource, timer, alertSrv
  ) {
      // An elasticJS client to use TODO use it instead of direct $http
      //var ejs = ejsResource(config.elasticsearch, config.elasticsearchBasicAuth);

      //TODO be smart on size parameter
    this.query = function(esQuery) {
      var options = {
        url: config.elasticsearch + "/" + esQuery.index + "/_search?q=" + esQuery.query + "&size=100",
        method: "GET"
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
        alertSrv.set('Error',"Could not contact Elasticsearch at "+config.elasticsearch+
          ". Please ensure that Elasticsearch is reachable from your system." ,'error');
      } else {
        alertSrv.set('Error',"Could not search for "+ esQuery.query +". If you"+
          " are using a proxy, ensure it is configured correctly",'error');
      }
      return false;
    }).success(function() {
      //console.log(data);
    });
    };
  });
});
