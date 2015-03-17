define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('dynamicDashboardSrv', function()  {

    this.init = function(dashboard) {
      this.handlePanelRepeats(dashboard);
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

      dashboard.scopedVars = {
        panel: {}
      };

      _.each(variable.options, function(option) {
        var copy = dashboard.duplicatePanel(panel, row);
        copy.repeat = null;
        dashboard.scopedVars.panel[panel.id] = {};
        dashboard.scopedVars.panel[panel.id][variable.name] = option.value;
        console.log('duplicatePanel');
      });
    };


  });

});


