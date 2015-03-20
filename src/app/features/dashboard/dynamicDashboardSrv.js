define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('dynamicDashboardSrv', function()  {

    this.init = function(dashboard) {
      this.removeLinkedPanels(dashboard);
      this.handlePanelRepeats(dashboard);
    };

    this.update = function(dashboard) {
      this.removeLinkedPanels(dashboard);
      this.handlePanelRepeats(dashboard);
    };

    this.removeLinkedPanels = function(dashboard) {
      var i, j, row, panel;
      for (i = 0; i < dashboard.rows.length; i++) {
        row = dashboard.rows[i];
        for (j = 0; j < row.panels.length; j++) {
          panel = row.panels[j];
          if (panel.linked) {
            console.log('removing panel: ' + panel.id);
            row.panels = _.without(row.panels, panel);
            j = j - 1;
          }
        }
      }
    };

    this.handlePanelRepeats = function(dashboard) {
      var i, j, row, panel;
      for (i = 0; i < dashboard.rows.length; i++) {
        row = dashboard.rows[i];
        for (j = 0; j < row.panels.length; j++) {
          panel = row.panels[j];
          if (panel.repeat) {
            this.repeatPanel(panel, row, dashboard);
          }
        }
      }
    };

    this.repeatPanel = function(panel, row, dashboard) {
      var variables = dashboard.templating.list;
      var variable = _.findWhere(variables, {name: panel.repeat.replace('$', '')});
      if (!variable) {
        return;
      }

      var selected;
      if (variable.current.text === 'All') {
        selected = variable.options.slice(1, variable.options.length);
      } else {
        selected = _.filter(variable.options, {selected: true});
      }

      _.each(selected, function(option, index) {
        if (index > 0) {
          var copy = dashboard.duplicatePanel(panel, row);
          copy.repeat = null;
          copy.linked = true;
          copy.scopedVars = {};
          copy.scopedVars[variable.name] = option;
        } else {
          panel.scopedVars = {};
          panel.scopedVars[variable.name] = option;
        }
        console.log('duplicatePanel');
      });
    };


  });

});


