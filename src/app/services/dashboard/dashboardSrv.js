define([
  'angular',
  'jquery',
  'kbn',
  'lodash',
  '../timer',
],
function (angular, $, kbn, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('dashboardSrv', function(timer, $rootScope, $timeout) {

    function DashboardModel (data) {

      if (!data) {
        data = {};
      }

      this.title = data.title || 'No Title';
      this.tags = data.tags || [];
      this.style = data.style || "dark";
      this.timezone = data.timezone || 'browser';
      this.editable = data.editble || true;
      this.rows = data.rows || [];
      this.pulldowns = data.pulldowns || [];
      this.nav = data.nav || [];
      this.time = data.time || { from: 'now-6h', to: 'now' };
      this.templating = data.templating || { list: [] };
      this.refresh = data.refresh;
      this.version = data.version || 0;
      this.$state = data.$state;

      if (this.nav.length === 0) {
        this.nav.push({ type: 'timepicker' });
      }

      if (!_.findWhere(this.pulldowns, {type: 'filtering'})) {
        this.pulldowns.push({ type: 'filtering', enable: false });
      }

      if (!_.findWhere(this.pulldowns, {type: 'annotations'})) {
        this.pulldowns.push({ type: 'annotations', enable: false });
      }

      this.updateSchema(data);
    }

    var p = DashboardModel.prototype;

    p.getNextPanelId = function() {
      var i, j, row, panel, max = 0;
      for (i = 0; i < this.rows.length; i++) {
        row = this.rows[i];
        for (j = 0; j < row.panels.length; j++) {
          panel = row.panels[j];
          if (panel.id > max) { max = panel.id; }
        }
      }
      return max + 1;
    };

    p.rowSpan = function(row) {
      return _.reduce(row.panels, function(p,v) {
        return p + v.span;
      },0);
    };

    p.add_panel = function(panel, row) {
      var rowSpan = this.rowSpan(row);
      var panelCount = row.panels.length;
      var space = (12 - rowSpan) - panel.span;
      panel.id = this.getNextPanelId();

      // try to make room of there is no space left
      if (space <= 0) {
        if (panelCount === 1) {
          row.panels[0].span = 6;
          panel.span = 6;
        }
        else if (panelCount === 2) {
          row.panels[0].span = 4;
          row.panels[1].span = 4;
          panel.span = 4;
        }
      }

      row.panels.push(panel);
    };

    p.duplicatePanel = function(panel, row) {
      var rowIndex = _.indexOf(this.rows, row);
      var newPanel = angular.copy(panel);
      newPanel.id = this.getNextPanelId();

      while(rowIndex < this.rows.length) {
        var currentRow = this.rows[rowIndex];
        if (this.rowSpan(currentRow) <= 9) {
          currentRow.panels.push(newPanel);
          return;
        }
        rowIndex++;
      }

      var newRow = angular.copy(row);
      newRow.panels = [newPanel];
      this.rows.push(newRow);
    };

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

    p.updateSchema = function(old) {
      var i, j, row, panel;
      var oldVersion = this.version;
      this.version = 3;

      if (oldVersion === 3) {
        return;
      }

      // Version 3 schema changes
      // ensure panel ids
      var maxId = this.getNextPanelId();
      for (i = 0; i < this.rows.length; i++) {
        row = this.rows[i];
        for (j = 0; j < row.panels.length; j++) {
          panel = row.panels[j];
          if (!panel.id) {
            panel.id = maxId;
            maxId += 1;
          }
        }
      }

      if (oldVersion === 2) {
        return;
      }

      // Version 2 schema changes
      if (old.services) {
        if (old.services.filter) {
          this.time = old.services.filter.time;
          this.templating.list = old.services.filter.list;
        }
        delete this.services;
      }

      for (i = 0; i < this.rows.length; i++) {
        row = this.rows[i];
        for (j = 0; j < row.panels.length; j++) {
          panel = row.panels[j];
          if (panel.type === 'graphite') {
            panel.type = 'graph';
          }

          if (panel.type === 'graph') {
            if (_.isBoolean(panel.legend)) {
              panel.legend = { show: panel.legend };
            }

            if (panel.grid) {
              if (panel.grid.min) {
                panel.grid.leftMin = panel.grid.min;
                delete panel.grid.min;
              }

              if (panel.grid.max) {
                panel.grid.leftMax = panel.grid.max;
                delete panel.grid.max;
              }
            }

            if (panel.y_format) {
              panel.y_formats[0] = panel.y_format;
              delete panel.y_format;
            }

            if (panel.y2_format) {
              panel.y_formats[1] = panel.y2_format;
              delete panel.y2_format;
            }
          }
        }
      }

      this.version = 3;
    };

    return {
      create: function(dashboard) {
        return new DashboardModel(dashboard);
      }
    };

  });
});
