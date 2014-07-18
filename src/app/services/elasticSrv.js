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

      //TODO be smart on size parameter
    this.query = function(esQuery) {
      var url = config.elasticsearch + "/" + esQuery.index + "/_search";
      var data = {
        "query": {
          "filtered": {
            "query": {
              "bool": {
                "should": [{
                  "query_string": {
                    "query": esQuery.query
                  }
                }]
              }
            }
          }
        },
        "size": 100
      }
      var options = {
      };
      if (config.elasticsearchBasicAuth) {
        options.withCredentials = true;
        options.headers = {
          "Authorization": "Basic " + config.elasticsearchBasicAuth
        };
      }
      return $http.post(url, data, options)
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
