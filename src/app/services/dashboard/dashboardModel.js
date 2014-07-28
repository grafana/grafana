define([
  'angular',
  'jquery',
  'kbn',
  'underscore'
],
function (angular, $, kbn, _) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('dashboard', function(timer, $rootScope, $timeout) {

    function DashboardModel (data) {

      if (!data) {
        data = {};
      }

      this.title = data.title;
      this.tags = data.tags || [];
      this.style = data.style || "dark";
      this.timezone = data.timezone || 'browser';
      this.editable = data.editble || true;
      this.rows = data.rows || [];
      this.pulldowns = data.pulldowns || [];
      this.nav = data.nav || [];
      this.services = data.services || {};
      this.loader = data.loader || {};

      _.defaults(this.loader, {
        save_gist: false,
        save_elasticsearch: true,
        save_default: true,
        save_temp: true,
        save_temp_ttl_enable: true,
        save_temp_ttl: '30d',
        load_gist: false,
        load_elasticsearch: true,
        hide: false
      });

      if (this.nav.length === 0) {
        this.nav.push({ type: 'timepicker' });
      }

      if (!_.findWhere(this.pulldowns, {type: 'filtering'})) {
        this.pulldowns.push({ type: 'filtering', enable: false });
      }

      if (!_.findWhere(this.pulldowns, {type: 'annotations'})) {
        this.pulldowns.push({ type: 'annotations', enable: false });
      }

      _.each(this.rows, function(row) {
        _.each(row.panels, function(panel) {
          if (panel.type === 'graphite') {
            panel.type = 'graph';
          }
        });
      });
    }

    var p = DashboardModel.prototype;

    p.emit_refresh = function() {
      $rootScope.$broadcast('refresh');
    };

    p.start_scheduled_refresh = function (after_ms) {
      this.cancel_scheduled_refresh();
      this.refresh_timer = timer.register($timeout(function () {
        this.start_scheduled_refresh(after_ms);
        this.emit_refresh();
      }.bind(this), after_ms));
    };

    p.cancel_scheduled_refresh = function () {
      timer.cancel(this.refresh_timer);
    };

    p.set_interval = function (interval) {
      this.refresh = interval;
      if (interval) {
        var _i = kbn.interval_to_ms(interval);
        this.start_scheduled_refresh(_i);
      } else {
        this.cancel_scheduled_refresh();
      }
    };

    return {
      create: function(dashboard) {
        return new DashboardModel(dashboard);
      }
    };

  });
});
