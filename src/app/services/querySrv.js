define([
  'angular',
  'underscore',
  'config'
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('querySrv', function(dashboard, ejsResource) {
    // Create an object to hold our service state on the dashboard
    dashboard.current.services.query = dashboard.current.services.query || {};
    _.defaults(dashboard.current.services.query,{
      idQueue : [],
      list : {},
      ids : [],
    });

    // Defaults for query objects
    var _query = {
      query: '*',
      alias: '',
      pin: false,
      type: 'lucene'
    };

    // For convenience
    var ejs = ejsResource(config.elasticsearch);
    var _q = dashboard.current.services.query;

    this.colors = [
      "#7EB26D","#EAB839","#6ED0E0","#EF843C","#E24D42","#1F78C1","#BA43A9","#705DA0", //1
      "#508642","#CCA300","#447EBC","#C15C17","#890F02","#0A437C","#6D1F62","#584477", //2
      "#B7DBAB","#F4D598","#70DBED","#F9BA8F","#F29191","#82B5D8","#E5A8E2","#AEA2E0", //3
      "#629E51","#E5AC0E","#64B0C8","#E0752D","#BF1B00","#0A50A1","#962D82","#614D93", //4
      "#9AC48A","#F2C96D","#65C5DB","#F9934E","#EA6460","#5195CE","#D683CE","#806EB7", //5
      "#3F6833","#967302","#2F575E","#99440A","#58140C","#052B51","#511749","#3F2B5B", //6
      "#E0F9D7","#FCEACA","#CFFAFF","#F9E2D2","#FCE2DE","#BADFF4","#F9D9F9","#DEDAF7"  //7
    ];


    // Save a reference to this
    var self = this;

    this.init = function() {
      _q = dashboard.current.services.query;
      self.list = dashboard.current.services.query.list;
      self.ids = dashboard.current.services.query.ids;

      // Check each query object, populate its defaults
      _.each(self.list,function(query,id) {
        _.defaults(query,_query);
        query.color = colorAt(id);
      });

      if (self.ids.length === 0) {
        self.set({});
      }
    };

    // This is used both for adding queries and modifying them. If an id is passed, the query at that id is updated
    this.set = function(query,id) {
      if(!_.isUndefined(id)) {
        if(!_.isUndefined(self.list[id])) {
          _.extend(self.list[id],query);
          return id;
        } else {
          return false;
        }
      } else {
        var _id = query.id || nextId();
        query.id = _id;
        query.color = query.color || colorAt(_id);
        _.defaults(query,_query);

        self.list[_id] = query;
        self.ids.push(_id);
        return _id;
      }
    };

    this.remove = function(id) {
      if(!_.isUndefined(self.list[id])) {
        delete self.list[id];
        // This must happen on the full path also since _.without returns a copy
        self.ids = dashboard.current.services.query.ids = _.without(self.ids,id);
        _q.idQueue.unshift(id);
        _q.idQueue.sort(function(v,k){
          return v-k;
        });
        return true;
      } else {
        return false;
      }
    };

    this.getEjsObj = function(id) {
      return self.toEjsObj(self.list[id]);
    };

    this.toEjsObj = function (q) {
      switch(q.type)
      {
      case 'lucene':
        return ejs.QueryStringQuery(q.query || '*');
      default:
        return _.isUndefined(q.query) ? false : ejs.QueryStringQuery(q.query || '*');
      }
    };

    this.findQuery = function(queryString) {
      return _.findWhere(self.list,{query:queryString});
    };

    this.idsByMode = function(config) {
      switch(config.mode)
      {
      case 'all':
        return self.ids;
      case 'pinned':
        return _.pluck(_.where(self.list,{pin:true}),'id');
      case 'unpinned':
        return _.difference(self.ids,_.pluck(_.where(self.list,{pin:true}),'id'));
      case 'selected':
        return _.intersection(self.ids,config.ids);
      default:
        return self.ids;
      }
    };

    var nextId = function() {
      if(_q.idQueue.length > 0) {
        return _q.idQueue.shift();
      } else {
        return self.ids.length;
      }
    };

    var colorAt = function(id) {
      return self.colors[id % self.colors.length];
    };

    self.init();
  });

});