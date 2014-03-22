define([
  'angular',
  'underscore',
  'config',
  'kbn'
], function (angular, _, config, kbn) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('filterSrv', function(dashboard, $rootScope, $timeout, $routeParams) {
    // defaults
    var _d = {
      list: [],
      time: {}
    };

    // Save a reference to this
    var self = this;

    // Call this whenever we need to reload the important stuff
    this.init = function() {
      dashboard.current.services.filter = dashboard.current.services.filter || {};

      _.defaults(dashboard.current.services.filter, _d);

      self.list = dashboard.current.services.filter.list;
      self.time = dashboard.current.services.filter.time;

      self.templateSettings = {
        interpolate : /\[\[([\s\S]+?)\]\]/g,
      };

      if (self.list.length) {
        this._updateTemplateData(true);
      }
    };

    this._updateTemplateData = function(initial) {
      self._filterTemplateData = {};

      _.each(self.list, function(filter) {
        if (initial) {
          var urlValue = $routeParams[filter.name];
          if (urlValue) {
            filter.current = { text: urlValue, value: urlValue };
          }
        }
        if (!filter.current || !filter.current.value) {
          return;
        }

        self._filterTemplateData[filter.name] = filter.current.value;
      });
    };

    this.filterOptionSelected = function(filter, option) {
      filter.current = option;
      this._updateTemplateData();
      dashboard.refresh();
    };

    this.add = function(filter) {
      self.list.push(filter);
    };

    this.applyFilterToTarget = function(target) {
      if (target.indexOf('[[') === -1) {
        return target;
      }

      return _.template(target, self._filterTemplateData, self.templateSettings);
    };

    this.remove = function(filter) {
      self.list = dashboard.current.services.filter.list = _.without(self.list, filter);

      if(!$rootScope.$$phase) {
        $rootScope.$apply();
      }

      $timeout(function(){
        dashboard.refresh();
      },0);
    };

    this.setTime = function(time) {
      _.extend(self.time, time);

      $timeout(function(){
        dashboard.refresh();
      },0);
    };

    this.timeRange = function(parse) {
      var _t = self.time;

      if(_.isUndefined(_t)) {
        return false;
      }
      if(parse === false) {
        return {
          from: _t.from,
          to: _t.to
        };
      } else {
        var
          _from = _t.from,
          _to = _t.to || new Date();

        return {
          from : kbn.parseDate(_from),
          to : kbn.parseDate(_to)
        };
      }
    };

    // Now init
    self.init();
  });

});