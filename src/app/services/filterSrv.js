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
      list : {},
      ids : []
    };

    // For convenience
    var ejs = ejsResource(config.elasticsearch);

    // Save a reference to this
    var self = this;

    // Call this whenever we need to reload the important stuff
    this.init = function() {
      // Populate defaults
      _.defaults(dashboard.current.services.filter,_d);

      // Accessors
      self.list = dashboard.current.services.filter.list;
      self.ids = dashboard.current.services.filter.ids;

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

      _.defaults(filter,{
        mandate:'must',
        active: true
      });

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
      var bool = ejs.BoolFilter();
      // there is no way to introspect the BoolFilter and find out if it has a filter. We must keep note.
      var added_a_filter = false;

      _.each(ids,function(id) {
        if(self.list[id].active) {
          added_a_filter = true;

          switch(self.list[id].mandate)
          {
          case 'mustNot':
            bool.mustNot(self.getEjsObj(id));
            break;
          case 'either':
            bool.should(self.getEjsObj(id));
            break;
          default:
            bool.must(self.getEjsObj(id));
          }
        }
      });
      // add a match filter so we'd get some data
      if (!added_a_filter) {
        bool.must(ejs.MatchAllFilter());
      }
      return bool;
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
      var idCount = dashboard.current.services.filter.ids.length;
      if(idCount > 0) {
        // Make a sorted copy of the ids array
        var ids = _.clone(dashboard.current.services.filter.ids).sort();
        return kbn.smallestMissing(ids);
      } else {
        // No ids currently in list
        return 0;
      }
    };

    // Now init
    self.init();
  });

});