define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('alertSrv', function($timeout, $sce, $rootScope) {
    var self = this;

    this.init = function() {
      $rootScope.onAppEvent('alert-error', function(e, alert) {
        self.set(alert[0], alert[1], 'error');
      });
      $rootScope.onAppEvent('alert-warning', function(e, alert) {
        self.set(alert[0], alert[1], 'warning', 5000);
      });
      $rootScope.onAppEvent('alert-success', function(e, alert) {
        self.set(alert[0], alert[1], 'success', 3000);
      });
    };

    // List of all alert objects
    this.list = [];

    this.set = function(title,text,severity,timeout) {
      var
        _a = {
          title: title || '',
          text: $sce.trustAsHtml(text || ''),
          severity: severity || 'info',
        },
        _ca = angular.toJson(_a),
        _clist = _.map(self.list,function(alert) {return angular.toJson(alert);});

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
