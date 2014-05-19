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
      list: [],
      time: {}
    };

    var result = {
        _updateTemplateData : function( initial ) {
            this._filterTemplateData = {};
            _.each(this.list, function(filter) {
            if (initial) {
                var urlValue = $routeParams[filter.name];
                if (urlValue) {
                    filter.current = { text: urlValue, value: urlValue };
                }
            }
            if (!filter.current || !filter.current.value) {
                return;
            }

            this._filterTemplateData[filter.name] = filter.current.value;
            });
        },

        filterOptionSelected : function(option) {
            this.current = option;
            this._updateTemplateData();
        },

        add : function(filter) {
            this.list.push(filter);
        },

        applyFilterToTarget : function(target) {
            if (target.indexOf('[[') === -1) {
                return target;
            }

            return _.template(target, this._filterTemplateData, this.templateSettings);
        },

        setTime : function(time) {
            _.extend(this.time, time);
            // disable refresh if we have an absolute time
            if (time.to !== 'now') {
                this.old_refresh = this.dashboard.refresh;
                dashboard.set_interval(false);
                return;
            }

            if (this.old_refresh && this.old_refresh !== this.dashboard.refresh) {
                dashboard.set_interval(this.old_refresh);
                this.old_refresh = null;
            }
        },

        timeRange : function(parse) {
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

        removeFilter : function( filter ) {
            this.list = _.without(this.list, filter);
        },
        init : function( dashboard ) {
            _.defaults(this, _d);
            this.dashboard = dashboard;
            this.templateSettings = { interpolate : /\[\[([\s\S]+?)\]\]/g };
            if( dashboard && dashboard.services && dashboard.services.filter ) {
                // compatiblity hack
                this.time = dashboard.services.filter.time;
            }

        }
    }; 
    return result;
  });

});
