define([
  'angular',
  'underscore',
  'config',
  'kbn'
], function (angular, _, config, kbn) {
  'use strict';

  var module = angular.module('kibana.services');

  module.factory('filterSrv', function(dashboard, $rootScope, $timeout, $routeParams) {
    // defaults
    var _d = {
      templateParameters: [],
      time: {}
    };

    var result = {

      updateTemplateData: function(initial) {
        var _templateData = {};
        _.each(this.templateParameters, function(templateParameter) {
          if (initial) {
            var urlValue = $routeParams[ templateParameter.name ];
            if (urlValue) {
              templateParameter.current = { text: urlValue, value: urlValue };
            }
          }
          if (!templateParameter.current || !templateParameter.current.value) {
            return;
          }
          _templateData[templateParameter.name] = templateParameter.current.value;
        });
        this._templateData = _templateData;
      },

      addTemplateParameter: function(templateParameter) {
        this.templateParameters.push(templateParameter);
        this.updateTemplateData();
      },

      applyTemplateToTarget: function(target) {
        if (target.indexOf('[[') === -1) {
          return target;
        }

        return _.template(target, this._templateData, this.templateSettings);
      },

      setTime: function(time) {
        _.extend(this.time, time);

        // disable refresh if we have an absolute time
        if (time.to !== 'now') {
          this.old_refresh = this.dashboard.refresh;
          dashboard.set_interval(false);
        }
        else if (this.old_refresh && this.old_refresh !== this.dashboard.refresh) {
          dashboard.set_interval(this.old_refresh);
          this.old_refresh = null;
        }

        $timeout(function() {
          dashboard.refresh();
        },0);
      },

      timeRange: function(parse) {
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
            from : kbn.parseDate(_from),
            to : kbn.parseDate(_to)
          };
        }
      },

      removeTemplateParameter: function(templateParameter) {
        this.templateParameters = _.without(this.templateParameters, templateParameter);
        this.dashboard.services.filter.list = this.templateParameters;
      },

      init: function(dashboard) {
        _.defaults(this, _d);
        this.dashboard = dashboard;
        this.templateSettings = { interpolate : /\[\[([\s\S]+?)\]\]/g };

        if(dashboard.services && dashboard.services.filter) {
          this.time = dashboard.services.filter.time;
          this.templateParameters = dashboard.services.filter.list || [];
          this.updateTemplateData(true);
        }

      }
    };
    return result;
  });

});
