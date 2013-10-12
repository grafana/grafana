define([
  'angular',
  'underscore',
  'config'
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('esVersion', function($http, alertSrv) {

    this.versions = [];

    // save a reference to this
    var self = this;

    this.init = function() {
      getVersions();
    };

    var getVersions = function() {
      var nodeInfo = $http({
        url: config.elasticsearch + '/_nodes',
        method: "GET"
      }).error(function(data, status) {
        if(status === 0) {
          alertSrv.set('Error',"Could not contact Elasticsearch at "+config.elasticsearch+
            ". Please ensure that Elasticsearch is reachable from your system." ,'error');
        } else {
          alertSrv.set('Error',"Could not reach "+config.elasticsearch+"/_nodes. If you"+
          " are using a proxy, ensure it is configured correctly",'error');
        }
      });

      return nodeInfo.then(function(p) {
        _.each(p.data.nodes, function(v) {
          self.versions.push(v.version.split('-')[0]);
        });
        self.versions = sortVersions(_.uniq(self.versions));
      });
    };

    // Get the max version in this cluster
    this.max = function() {
      return _.last(self.versions);
    };

    // Return the lowest version in the cluster
    this.min = function() {
      return _.first(self.versions);
    };

    // Sort versions from lowest to highest
    var sortVersions = function(versions) {
      var _versions = _.clone(versions),
        _r = [];

      while(_r.length < versions.length) {
        var _h = "0";
        /*jshint -W083 */
        _.each(_versions,function(v){
          if(self.compare(_h,v)) {
            _h = v;
          }
        });
        _versions = _.without(_versions,_h);
        _r.push(_h);
      }
      return _r.reverse();
    };

    /*
      Takes a version string with one of the following optional comparison prefixes: >,>=,<.<=
      and evaluates if the cluster meets the requirement. If the prefix is omitted exact match
      is assumed
    */
    this.is = function(equation) {
      var _v = equation,
        _cf;

      if(_v.charAt(0) === '>') {
        _cf = _v.charAt(1) === '=' ? self.gte(_v.slice(2)) : self.gt(_v.slice(1));
      } else if (_v.charAt(0) === '<') {
        _cf = _v.charAt(1) === '=' ? self.lte(_v.slice(2)) : self.lt(_v.slice(1));
      } else {
        _cf = self.eq(_v);
      }

      return _cf;
    };

    // check if lowest version in cluster = `version`
    this.eq = function(version) {
      return version === self.min() ? true : false;
    };

    // version > lowest version in cluster?
    this.gt = function(version) {
      return version === self.min() ? false : self.gte(version);
    };

    // version < highest version in cluster?
    this.lt = function(version) {
      return version === self.max() ? false : self.lte(version);
    };

    // Check if the lowest version in the cluster is >= to `version`
    this.gte = function(version) {
      return self.compare(version,self.min());
    };

    // Check if the highest version in the cluster is <= to `version`
    this.lte = function(version) {
      return self.compare(self.max(),version);
    };

    // Determine if a specific version is greater than or equal to another
    this.compare = function (required,installed) {
      var a = installed.split('.');
      var b = required.split('.');
      var i;

      for (i = 0; i < a.length; ++i) {
        a[i] = Number(a[i]);
      }
      for (i = 0; i < b.length; ++i) {
        b[i] = Number(b[i]);
      }
      if (a.length === 2) {
        a[2] = 0;
      }

      if (a[0] > b[0]){return true;}
      if (a[0] < b[0]){return false;}

      if (a[1] > b[1]){return true;}
      if (a[1] < b[1]){return false;}

      if (a[2] > b[2]){return true;}
      if (a[2] < b[2]){return false;}

      return true;
    };

    this.init();

  });

});