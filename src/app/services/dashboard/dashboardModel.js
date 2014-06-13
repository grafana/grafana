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
      this.timezone = data.browser || 'browser';
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

    p.set_interval = function(interval) {
      this.refresh = interval;

      if (interval) {
        var _i = kbn.interval_to_ms(interval);
        timer.cancel(this.refresh_timer);
        var self = this;

        this.refresh_timer = timer.register($timeout(function() {
          self.set_interval(interval);
          self.emit_refresh();
        },_i));
        this.emit_refresh();
      } else {
        timer.cancel(this.refresh_timer);
      }
    };

    return {
      create: function(dashboard) {
        return new DashboardModel(dashboard);
      }
    };

    /*
    var gist_pattern = /(^\d{5,}$)|(^[a-z0-9]{10,}$)|(gist.github.com(\/*.*)\/[a-z0-9]{5,}\/*$)/;

    this.gist_id = function(string) {
      if(self.is_gist(string)) {
        return string.match(gist_pattern)[0].replace(/.*\//, '');
      }
    };

    this.is_gist = function(string) {
      if(!_.isUndefined(string) && string !== '' && !_.isNull(string.match(gist_pattern))) {
        return string.match(gist_pattern).length > 0 ? true : false;
      } else {
        return false;
      }
    };

    this.save_gist = function(title,dashboard) {
      var save = _.clone(dashboard || self.current);
      save.title = title || self.current.title;
      return $http({
        url: "https://api.github.com/gists",
        method: "POST",
        data: {
          "description": save.title,
          "public": false,
          "files": {
            "kibana-dashboard.json": {
              "content": angular.toJson(save,true)
            }
          }
        }
      }).then(function(data) {
        return data.data.html_url;
      }, function() {
        return false;
      });
    };

    this.gist_list = function(id) {
      return $http.jsonp("https://api.github.com/gists/"+id+"?callback=JSON_CALLBACK"
      ).then(function(response) {
        var files = [];
        _.each(response.data.data.files,function(v) {
          try {
            var file = JSON.parse(v.content);
            files.push(file);
          } catch(e) {
            return false;
          }
        });
        return files;
      }, function() {
        return false;
      });
    };
    */

  });
});
