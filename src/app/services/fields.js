define([
  'angular',
  'underscore',
  'config'
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('fields', function(dashboard, $rootScope, $http, alertSrv) {
    // Save a reference to this
    var self = this;

    this.list = ['_type'];
    this.indices = [];

    // Stop tracking the full mapping, too expensive, instead we only remember the index names
    // we've already seen.
    //
    $rootScope.$watch(function(){return dashboard.indices;},function(n) {
      if(!_.isUndefined(n) && n.length && dashboard.current.index.warm_fields) {
        // Only get the mapping for indices we don't know it for
        var indices = _.difference(n,_.keys(self.indices));
        // Only get the mapping if there are new indices
        if(indices.length > 0) {
          self.map(indices).then(function(result) {
            self.indices = _.union(self.indices,_.keys(result));
            self.list = mapFields(result);
          });
        // Otherwise just use the cached mapping
        }
      }
    });

    var mapFields = function (m) {
      var fields = [];
      _.each(m, function(types) {
        _.each(types, function(type) {
          fields = _.without(_.union(fields,_.keys(type)),'_all','_source');
        });
      });
      return fields;
    };

    this.map = function(indices) {
      var request = $http({
        url: config.elasticsearch + "/" + indices.join(',') + "/_mapping",
        method: "GET"
      }).error(function(data, status) {
        if(status === 0) {
          alertSrv.set('Error',"Could not contact Elasticsearch at "+config.elasticsearch+
            ". Please ensure that Elasticsearch is reachable from your system." ,'error');
        } else {
          alertSrv.set('Error',"No index found at "+config.elasticsearch+"/" +
            indices.join(',')+"/_mapping. Please create at least one index."  +
            "If you're using a proxy ensure it is configured correctly.",'error');
        }
      });

      // Flatten the mapping of each index into dot notated keys.
      return request.then(function(p) {
        var mapping = {};
        _.each(p.data, function(type,index) {
          mapping[index] = {};
          _.each(type, function (fields,typename) {
            mapping[index][typename] = flatten(fields);
          });
        });
        return mapping;
      });
    };

    var flatten = function(obj,prefix) {
      var propName = (prefix) ? prefix :  '',
        dot = (prefix) ? '.':'',
        ret = {};
      for(var attr in obj){
        // For now only support multi field on the top level
        // and if there is a default field set.
        if(obj[attr]['type'] === 'multi_field') {
          ret[attr] = obj[attr]['fields'][attr] || obj[attr];
          continue;
        }
        if (attr === 'properties') {
          _.extend(ret,flatten(obj[attr], propName));
        } else if(typeof obj[attr] === 'object'){
          _.extend(ret,flatten(obj[attr], propName + dot + attr));
        } else {
          ret[propName] = obj;
        }
      }
      return ret;
    };

  });

});