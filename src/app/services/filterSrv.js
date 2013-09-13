define([
  'angular',
  'underscore',
  'config'
], function (angular, _, config) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('filterSrv', function(dashboard, ejsResource) {
    // Create an object to hold our service state on the dashboard
    dashboard.current.services.filter = dashboard.current.services.filter || {};

    // Defaults for it
    var _d = {
      idQueue : [],
      list : {},
      ids : []
    };

    // For convenience
    var ejs = ejsResource(config.elasticsearch);
    var _f = dashboard.current.services.filter;

    // Save a reference to this
    var self = this;

    // Call this whenever we need to reload the important stuff
    this.init = function() {
      // Populate defaults
      _.defaults(dashboard.current.services.filter,_d);

      // Accessors
      self.list = dashboard.current.services.filter.list;
      self.ids = dashboard.current.services.filter.ids;
      _f = dashboard.current.services.filter;

      _.each(self.getByType('time',true),function(time) {
        self.list[time.id].from = new Date(time.from);
        self.list[time.id].to = new Date(time.to);
      });

    };

    // This is used both for adding filters and modifying them.
    // If an id is passed, the filter at that id is updated
    this.set = function(filter,id) {
      _.defaults(filter,{mandate:'must'});
      filter.active = true;
      if(!_.isUndefined(id)) {
        if(!_.isUndefined(self.list[id])) {
          _.extend(self.list[id],filter);
          return id;
        } else {
          return false;
        }
      } else {
        if(_.isUndefined(filter.type)) {
          return false;
        } else {
          var _id = nextId();
          var _filter = {
            alias: '',
            id: _id
          };
          _.defaults(filter,_filter);
          self.list[_id] = filter;
          self.ids.push(_id);
          return _id;
        }
      }
    };

    this.getBoolFilter = function(ids) {
      // A default match all filter, just in case there are no other filters
      var bool = ejs.BoolFilter().must(ejs.MatchAllFilter());
      var either_bool = ejs.BoolFilter().must(ejs.MatchAllFilter());
      _.each(ids,function(id) {
        if(self.list[id].active) {
          switch(self.list[id].mandate)
          {
          case 'mustNot':
            bool = bool.mustNot(self.getEjsObj(id));
            break;
          case 'either':
            either_bool = either_bool.should(self.getEjsObj(id));
            break;
          default:
            bool = bool.must(self.getEjsObj(id));
          }
        }
      });
      return bool.must(either_bool);
    };

    this.getEjsObj = function(id) {
      return self.toEjsObj(self.list[id]);
    };

    this.toEjsObj = function (filter) {
      if(!filter.active) {
        return false;
      }
      switch(filter.type)
      {
      case 'time':
        return ejs.RangeFilter(filter.field)
          .from(filter.from.valueOf())
          .to(filter.to.valueOf());
      case 'range':
        return ejs.RangeFilter(filter.field)
          .from(filter.from)
          .to(filter.to);
      case 'querystring':
        return ejs.QueryFilter(ejs.QueryStringQuery(filter.query)).cache(true);
      case 'field':
        return ejs.QueryFilter(ejs.FieldQuery(filter.field,filter.query)).cache(true);
      case 'terms':
        return ejs.TermsFilter(filter.field,filter.value);
      case 'exists':
        return ejs.ExistsFilter(filter.field);
      case 'missing':
        return ejs.MissingFilter(filter.field);
      default:
        return false;
      }
    };

    this.getByType = function(type,inactive) {
      return _.pick(self.list,self.idsByType(type,inactive));
    };

    this.removeByType = function(type) {
      var ids = self.idsByType(type);
      _.each(ids,function(id) {
        self.remove(id);
      });
      return ids;
    };

    this.idsByType = function(type,inactive) {
      var _require = inactive ? {type:type} : {type:type,active:true};
      return _.pluck(_.where(self.list,_require),'id');
    };

    // TOFIX: Error handling when there is more than one field
    this.timeField = function() {
      return _.pluck(self.getByType('time'),'field');
    };

    // This special function looks for all time filters, and returns a time range according to the mode
    // No idea when max would actually be used
    this.timeRange = function(mode) {
      var _t = _.where(self.list,{type:'time',active:true});
      if(_t.length === 0) {
        return false;
      }
      switch(mode) {
      case "min":
        return {
          from: new Date(_.max(_.pluck(_t,'from'))),
          to: new Date(_.min(_.pluck(_t,'to')))
        };
      case "max":
        return {
          from: new Date(_.min(_.pluck(_t,'from'))),
          to: new Date(_.max(_.pluck(_t,'to')))
        };
      default:
        return false;
      }
    };

    this.remove = function(id) {
      if(!_.isUndefined(self.list[id])) {
        delete self.list[id];
        // This must happen on the full path also since _.without returns a copy
        self.ids = dashboard.current.services.filter.ids = _.without(self.ids,id);
        _f.idQueue.unshift(id);
        _f.idQueue.sort(function(v,k){return v-k;});
        return true;
      } else {
        return false;
      }
    };


    var nextId = function() {
      if(_f.idQueue.length > 0) {
        return _f.idQueue.shift();
      } else {
        return self.ids.length;
      }
    };

    // Now init
    self.init();
  });

});