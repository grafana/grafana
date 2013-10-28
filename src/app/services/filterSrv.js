define([
  'angular',
  'underscore',
  'config',
  'kbn'
], function (angular, _, config, kbn) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('filterSrv', function(dashboard, ejsResource, $rootScope, $timeout) {
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

      _.each(self.list,function(f) {
        self.set(f,f.id,true);
      });

      // Date filters hold strings now, not dates
      /*
      _.each(self.getByType('time',true),function(time) {
        self.list[time.id].from = new Date(time.from);
        self.list[time.id].to = new Date(time.to);
      });
      */

    };

    // This is used both for adding filters and modifying them.
    // If an id is passed, the filter at that id is updated
    this.set = function(filter,id,noRefresh) {
      var _r;
      _.defaults(filter,{mandate:'must'});
      filter.active = true;
      if(!_.isUndefined(id)) {
        if(!_.isUndefined(self.list[id])) {
          _.extend(self.list[id],filter);
          _r = id;
        } else {
          _r = false;
        }
      } else {
        if(_.isUndefined(filter.type)) {
          _r = false;
        } else {
          var _id = nextId();
          var _filter = {
            alias: '',
            id: _id,
            mandate: 'must'
          };
          _.defaults(filter,_filter);
          self.list[_id] = filter;
          self.ids.push(_id);
          _r = _id;
        }
      }
      if(!$rootScope.$$phase) {
        $rootScope.$apply();
      }
      if(noRefresh !== true) {
        $timeout(function(){
          dashboard.refresh();
        },0);
      }
      $rootScope.$broadcast('filter');
      return _r;
    };

    this.remove = function(id,noRefresh) {
      var _r;
      if(!_.isUndefined(self.list[id])) {
        delete self.list[id];
        // This must happen on the full path also since _.without returns a copy
        self.ids = dashboard.current.services.filter.ids = _.without(self.ids,id);
        _f.idQueue.unshift(id);
        _f.idQueue.sort(function(v,k){return v-k;});
        _r = true;
      } else {
        _r = false;
      }
      if(!$rootScope.$$phase) {
        $rootScope.$apply();
      }
      if(noRefresh !== true) {
        $timeout(function(){
          dashboard.refresh();
        },0);
      }
      $rootScope.$broadcast('filter');
      return _r;
    };

    this.removeByType = function(type,noRefresh) {
      var ids = self.idsByType(type);
      _.each(ids,function(id) {
        self.remove(id,true);
      });
      if(noRefresh !== true) {
        $timeout(function(){
          dashboard.refresh();
        },0);
      }
      return ids;
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
        var _f = ejs.RangeFilter(filter.field).from(kbn.parseDate(filter.from).valueOf());
        if(!_.isUndefined(filter.to)) {
          _f = _f.to(filter.to.valueOf());
        }
        return _f;
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

    this.idsByType = function(type,inactive) {
      var _require = inactive ? {type:type} : {type:type,active:true};
      return _.pluck(_.where(self.list,_require),'id');
    };

    // TOFIX: Error handling when there is more than one field
    this.timeField = function() {
      return _.pluck(self.getByType('time'),'field');
    };

    // Parse is used when you need to know about the raw filter
    this.timeRange = function(parse) {
      var _t = _.last(_.where(self.list,{type:'time',active:true}));
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