/*
  ## Dashcontrol

  ### Parameters
  * save
  ** gist :: Allow saving to gist. Requires registering an oauth domain with Github
  ** elasticsearch :: Allow saving to a special Kibana index within Elasticsearch
  ** local :: Allow saving to local file
  * load
  ** gist :: Allow loading from gists
  ** elasticsearch :: Allow searching and loading of elasticsearch saved dashboards
  ** local :: Allow loading of dashboards from Elasticsearch
  * hide_control :: Upon save, hide this panel
  * elasticsearch_size :: show this many dashboards under the ES section in the load drop down
  * temp :: Allow saving of temp dashboards
  * ttl :: Enable setting ttl.
  * temp_ttl :: How long should temp dashboards persist
*/
define([
  'angular',
  'app',
  'underscore'
],
function(angular, app, _) {
  'use strict';

  var module = angular.module('kibana.panels.dashcontrol', []);
  app.useModule(module);

  module.controller('dashcontrol', function($scope, $http, timer, dashboard, alertSrv) {
    $scope.panelMeta = {
      status  : "Deprecated",
      description : "This panel has been moved to the navigation bar. See the dashboard setting editor to configure it."
    };

    $scope.panel = $scope.panel || {};
    // Set and populate defaults
    var _d = {
      save : {
        gist: false,
        elasticsearch: true,
        local: true,
        'default': true
      },
      load : {
        gist: true,
        elasticsearch: true,
        local: true
      },
      hide_control: false,
      elasticsearch_size: 20,
      temp: true,
      ttl_enable: true,
      temp_ttl: '30d'
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.gist_pattern = /(^\d{5,}$)|(^[a-z0-9]{10,}$)|(gist.github.com(\/*.*)\/[a-z0-9]{5,}\/*$)/;
      $scope.gist = {};
      $scope.elasticsearch = {};
    };

    $scope.set_default = function() {
      if(dashboard.set_default()) {
        alertSrv.set('Local Default Set',dashboard.current.title+' has been set as your local default','success',5000);
      } else {
        alertSrv.set('Incompatible Browser','Sorry, your browser is too old for this feature','error',5000);
      }
    };

    $scope.purge_default = function() {
      if(dashboard.purge_default()) {
        alertSrv.set('Local Default Clear','Your local default dashboard has been cleared','success',5000);
      } else {
        alertSrv.set('Incompatible Browser','Sorry, your browser is too old for this feature','error',5000);
      }
    };

    $scope.elasticsearch_save = function(type,ttl) {
      dashboard.elasticsearch_save(
        type,
        ($scope.elasticsearch.title || dashboard.current.title),
        ($scope.panel.ttl_enable ? ttl : false)
      ).then(
        function(result) {
        if(!_.isUndefined(result._id)) {
          alertSrv.set('Dashboard Saved','This dashboard has been saved to Elasticsearch as "' +
            result._id + '"','success',5000);
          if(type === 'temp') {
            $scope.share = dashboard.share_link(dashboard.current.title,'temp',result._id);
          }
        } else {
          alertSrv.set('Save failed','Dashboard could not be saved to Elasticsearch','error',5000);
        }
      });
    };

    $scope.elasticsearch_delete = function(id) {
      dashboard.elasticsearch_delete(id).then(
        function(result) {
          if(!_.isUndefined(result)) {
            if(result.found) {
              alertSrv.set('Dashboard Deleted',id+' has been deleted','success',5000);
              // Find the deleted dashboard in the cached list and remove it
              var toDelete = _.where($scope.elasticsearch.dashboards,{_id:id})[0];
              $scope.elasticsearch.dashboards = _.without($scope.elasticsearch.dashboards,toDelete);
            } else {
              alertSrv.set('Dashboard Not Found','Could not find '+id+' in Elasticsearch','warning',5000);
            }
          } else {
            alertSrv.set('Dashboard Not Deleted','An error occurred deleting the dashboard','error',5000);
          }
        }
      );
    };

    $scope.elasticsearch_dblist = function(query) {
      dashboard.elasticsearch_list(query,$scope.panel.elasticsearch_size).then(
        function(result) {
        if(!_.isUndefined(result.hits)) {
          $scope.panel.error =  false;
          $scope.hits = result.hits.total;
          $scope.elasticsearch.dashboards = result.hits.hits;
        }
      });
    };

    $scope.save_gist = function() {
      dashboard.save_gist($scope.gist.title).then(
        function(link) {
        if(!_.isUndefined(link)) {
          $scope.gist.last = link;
          alertSrv.set('Gist saved','You will be able to access your exported dashboard file at '+
            '<a href="'+link+'">'+link+'</a> in a moment','success');
        } else {
          alertSrv.set('Save failed','Gist could not be saved','error',5000);
        }
      });
    };

    $scope.gist_dblist = function(id) {
      dashboard.gist_list(id).then(
        function(files) {
        if(files && files.length > 0) {
          $scope.gist.files = files;
        } else {
          alertSrv.set('Gist Failed','Could not retrieve dashboard list from gist','error',5000);
        }
      });
    };
  });

  module.directive('dashUpload', function(timer, dashboard, alertSrv){
    return {
      restrict: 'A',
      link: function(scope) {
        function file_selected(evt) {
          var files = evt.target.files; // FileList object

          // unused.. var output = []; // files is a FileList of File objects. List some properties.
          var readerOnload = function() {
            return function(e) {
              dashboard.dash_load(JSON.parse(e.target.result));
              scope.$apply();
            };
          };
          for (var i = 0, f; f = files[i]; i++) {
            var reader = new FileReader();
            reader.onload = (readerOnload)(f);
            reader.readAsText(f);
          }
        }

        // Check for the various File API support.
        if (window.File && window.FileReader && window.FileList && window.Blob) {
          // Something
          document.getElementById('dashupload').addEventListener('change', file_selected, false);
        } else {
          alertSrv.set('Oops','Sorry, the HTML5 File APIs are not fully supported in this browser.','error');
        }
      }
    };
  });

  module.filter('gistid', function() {
    var gist_pattern = /(\d{5,})|([a-z0-9]{10,})|(gist.github.com(\/*.*)\/[a-z0-9]{5,}\/*$)/;
    return function(input) {
      //return input+"boners"
      if(!(_.isUndefined(input))) {
        var output = input.match(gist_pattern);
        if(!_.isNull(output) && !_.isUndefined(output)) {
          return output[0].replace(/.*\//, '');
        }
      }
    };
  });
});