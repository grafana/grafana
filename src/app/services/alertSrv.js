define([
  'angular',
  'underscore'
],
function (angular, _) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('alertSrv', function($timeout) {
    var self = this;

    // List of all alert objects
    this.list = [];

    this.set = function(title,text,severity,timeout) {
      var
        _a = {
          title: title || '',
          text: text || '',
          severity: severity || 'info',
        },
        _ca = angular.toJson(_a),
        _clist = _.map(self.list,function(alert){return angular.toJson(alert);});

      // If we already have this alert, remove it and add a new one
      // Why do this instead of skipping the add because it resets the timer
      if(_.contains(_clist,_ca)) {
        _.remove(self.list,_.indexOf(_clist,_ca));
      }

      self.list.push(_a);
      if (timeout > 0) {
        $timeout(function() {
          self.list = _.without(self.list,_a);
        }, timeout);
      }
      return(_a);
    };

    this.clear = function(alert) {
      self.list = _.without(self.list,alert);
    };

    this.clearAll = function() {
      self.list = [];
    };
  });
});