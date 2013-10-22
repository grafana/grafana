/*

  ## Better maps

  ### Parameters
  * size :: How many results to show, more results = slower
  * field :: field containing a 2 element array in the format [lon,lat]
  * tooltip :: field to extract the tool tip value from
  * spyable :: Show the 'eye' icon that reveals the last ES query
*/
define([
  'angular',
  'app',
  'underscore',
  './leaflet/leaflet-src',
  'require',

  'css!./module.css',
  'css!./leaflet/leaflet.css',
  'css!./leaflet/plugins.css'
],
function (angular, app, _, L, localRequire) {
  'use strict';

  var module = angular.module('kibana.panels.bettermap', []);
  app.useModule(module);

  module.controller('bettermap', function($scope, querySrv, dashboard, filterSrv) {
    $scope.panelMeta = {
      editorTabs : [
        {
          title: 'Queries',
          src: 'app/partials/querySelect.html'
        }
      ],
      modals : [
        {
          description: "Inspect",
          icon: "icon-info-sign",
          partial: "app/partials/inspector.html",
          show: $scope.panel.spyable
        }
      ],
      status  : "Experimental",
      description : "Displays geo points in clustered groups on a map. The cavaet for this panel is"+
        " that, for better or worse, it does NOT use the terms facet and it <b>does</b> query "+
        "sequentially. This however means that it transfers more data and is generally heavier to"+
        " compute, while showing less actual data. If you have a time filter, it will attempt to"+
        " show to most recent points in your search, up to your defined limit"
    };

    // Set and populate defaults
    var _d = {
      queries     : {
        mode        : 'all',
        ids         : []
      },
      size    : 1000,
      spyable : true,
      tooltip : "_id",
      field   : null
    };

    _.defaults($scope.panel,_d);
    $scope.requireContext = localRequire;

    // inorder to use relative paths in require calls, require needs a context to run. Without
    // setting this property the paths would be relative to the app not this context/file.

    $scope.init = function() {
      $scope.$on('refresh',function(){
        $scope.get_data();
      });
      $scope.get_data();
    };

    $scope.get_data = function(segment,query_id) {
      $scope.require(['./leaflet/plugins'], function () {
        $scope.panel.error =  false;

        // Make sure we have everything for the request to complete
        if(dashboard.indices.length === 0) {
          return;
        }

        if(_.isUndefined($scope.panel.field)) {
          $scope.panel.error = "Please select a field that contains geo point in [lon,lat] format";
          return;
        }

        // Determine the field to sort on
        var timeField = _.uniq(_.pluck(filterSrv.getByType('time'),'field'));
        if(timeField.length > 1) {
          $scope.panel.error = "Time field must be consistent amongst time filters";
        } else if(timeField.length === 0) {
          timeField = null;
        } else {
          timeField = timeField[0];
        }

        var _segment = _.isUndefined(segment) ? 0 : segment;

        $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
        var queries = querySrv.getQueryObjs($scope.panel.queries.ids);

        var boolQuery = $scope.ejs.BoolQuery();
        _.each(queries,function(q) {
          boolQuery = boolQuery.should(querySrv.toEjsObj(q));
        });

        var request = $scope.ejs.Request().indices(dashboard.indices[_segment])
          .query($scope.ejs.FilteredQuery(
            boolQuery,
            filterSrv.getBoolFilter(filterSrv.ids).must($scope.ejs.ExistsFilter($scope.panel.field))
          ))
          .fields([$scope.panel.field,$scope.panel.tooltip])
          .size($scope.panel.size);

        if(!_.isNull(timeField)) {
          request = request.sort(timeField,'desc');
        }

        $scope.populate_modal(request);

        var results = request.doSearch();

        // Populate scope when we have results
        results.then(function(results) {
          $scope.panelMeta.loading = false;

          if(_segment === 0) {
            $scope.hits = 0;
            $scope.data = [];
            query_id = $scope.query_id = new Date().getTime();
          }

          // Check for error and abort if found
          if(!(_.isUndefined(results.error))) {
            $scope.panel.error = $scope.parse_error(results.error);
            return;
          }

          // Check that we're still on the same query, if not stop
          if($scope.query_id === query_id) {

            // Keep only what we need for the set
            $scope.data = $scope.data.slice(0,$scope.panel.size).concat(_.map(results.hits.hits, function(hit) {
              return {
                coordinates : new L.LatLng(hit.fields[$scope.panel.field][1],hit.fields[$scope.panel.field][0]),
                tooltip : hit.fields[$scope.panel.tooltip]
              };
            }));

          } else {
            return;
          }

          $scope.$emit('draw');

          // Get $size results then stop querying
          if($scope.data.length < $scope.panel.size && _segment+1 < dashboard.indices.length) {
            $scope.get_data(_segment+1,$scope.query_id);
          }

        });
      });
    };

    $scope.populate_modal = function(request) {
      $scope.inspector = angular.toJson(JSON.parse(request.toString()),true);
    };

  });

  module.directive('bettermap', function() {
    return {
      restrict: 'A',
      link: function(scope, elem, attrs) {

        elem.html('<center><img src="img/load_big.gif"></center>');

        // Receive render events
        scope.$on('draw',function(){
          render_panel();
        });

        scope.$on('render', function(){
          if(!_.isUndefined(map)) {
            map.invalidateSize();
            map.getPanes();
          }
        });

        var map, layerGroup;

        function render_panel() {
          scope.require(['./leaflet/plugins'], function () {
            scope.panelMeta.loading = false;
            L.Icon.Default.imagePath = 'app/panels/bettermap/leaflet/images';
            if(_.isUndefined(map)) {
              map = L.map(attrs.id, {
                scrollWheelZoom: false,
                center: [40, -86],
                zoom: 10
              });

              L.tileLayer('http://{s}.tile.cloudmade.com/57cbb6ca8cac418dbb1a402586df4528/22677/256/{z}/{x}/{y}.png', {
                maxZoom: 18,
                minZoom: 2
              }).addTo(map);
              layerGroup = new L.MarkerClusterGroup({maxClusterRadius:30});
            } else {
              layerGroup.clearLayers();
            }

            _.each(scope.data, function(p) {
              if(!_.isUndefined(p.tooltip) && p.tooltip !== '') {
                layerGroup.addLayer(L.marker(p.coordinates).bindLabel(p.tooltip));
              } else {
                layerGroup.addLayer(L.marker(p.coordinates));
              }
            });

            layerGroup.addTo(map);

            map.fitBounds(_.pluck(scope.data,'coordinates'));
          });
        }
      }
    };
  });

});
