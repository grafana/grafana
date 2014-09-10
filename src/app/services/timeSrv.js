define([
  'angular',
  'lodash',
  'config',
  'kbn',
  'moment'
], function (angular, _, config, kbn, moment) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('timeSrv', function($rootScope, $timeout, $routeParams, timer) {
    var self = this;

    this.init = function(dashboard) {
      timer.cancel_all();

      this.dashboard = dashboard;
      this.time = dashboard.time;

      this._initTimeFromUrl();

      if(this.dashboard.refresh) {
        this.set_interval(this.dashboard.refresh);
      }
    };

    this._parseUrlParam = function(value) {
      if (value.indexOf('now') !== -1) {
        return value;
      }
      if (value.length === 8) {
        return moment.utc(value, 'YYYYMMDD').toDate();
      }
      if (value.length === 15) {
        return moment.utc(value, 'YYYYMMDDTHHmmss').toDate();
      }
      var epoch = parseInt(value);
      if (!_.isNaN(epoch)) {
        return new Date(epoch);
      }

      return null;
    };

    this._initTimeFromUrl = function() {
      if ($routeParams.from) {
        this.time.from = this._parseUrlParam($routeParams.from) || this.time.from;
      }
      if ($routeParams.to) {
        this.time.to = this._parseUrlParam($routeParams.to) || this.time.to;
      }
    };

    this.set_interval = function (interval) {
      this.dashboard.refresh = interval;
      if (interval) {
        var _i = kbn.interval_to_ms(interval);
        this.start_scheduled_refresh(_i);
      } else {
        this.cancel_scheduled_refresh();
      }
    };

    this.refreshDashboard = function() {
      $rootScope.$broadcast('refresh');
    };

    this.start_scheduled_refresh = function (after_ms) {
      self.cancel_scheduled_refresh();
      self.refresh_timer = timer.register($timeout(function () {
        self.start_scheduled_refresh(after_ms);
        self.refreshDashboard();
      }, after_ms));
    };

    this.cancel_scheduled_refresh = function () {
      timer.cancel(this.refresh_timer);
    };

    this.setTime = function(time) {
      _.extend(this.time, time);

      // disable refresh if we have an absolute time
      if (time.to !== 'now') {
        this.old_refresh = this.dashboard.refresh;
        this.set_interval(false);
      }
      else if (this.old_refresh && this.old_refresh !== this.dashboard.refresh) {
        this.set_interval(this.old_refresh);
        this.old_refresh = null;
      }

      $rootScope.emitAppEvent('time-range-changed', this.time);
      $timeout(this.refreshDashboard, 0);
    };

    this.timeRange = function(parse) {
      var _t = this.time;
      if(_.isUndefined(_t) || _.isUndefined(_t.from)) {
        return false;
      }
      if(parse === false) {
        return {
          from: _t.from,
          to: _t.to
        };
      } else {
        var _from = _t.from;
        var _to = _t.to || new Date();

        return {
          from: kbn.parseDate(_from),
          to: kbn.parseDate(_to)
        };
      }
    };

  });

});
