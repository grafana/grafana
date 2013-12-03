/** @scratch /panels/5
 * include::panels/pie.asciidoc[]
 */

/** @scratch /panels/pie/0
 * == Pie
 * Status: *Deprecated*
 *
 * The pie panel has been largely replaced by the +terms+ panel. It exists for backwards compatibility
 * for now, but will be removed in a future release
 *
 */
define([
  'angular',
  'app',
  'underscore',
  'jquery',
  'kbn',
  'config'
], function (angular, app, _, $, kbn) {
  'use strict';

  var module = angular.module('kibana.panels.pie', []);
  app.useModule(module);

  module.controller('pie', function($scope, $rootScope, querySrv, dashboard, filterSrv) {

    $scope.panelMeta = {
      editorTabs : [
        {title:'Queries', src:'app/partials/querySelect.html'}
      ],
      modals : [
        {
          description: "Inspect",
          icon: "icon-info-sign",
          partial: "app/partials/inspector.html",
          show: $scope.panel.spyable
        }
      ],
      status  : "Deprecated",
      description : "Uses an Elasticsearch terms facet to create a pie chart. You should really only"+
        " point this at not_analyzed fields for that reason. This panel is going away soon, it has"+
        " <strong>been replaced by the terms panel</strong>. Please use that one instead."
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/pie/3
       * === Parameters
       *
       * mode:: terms or goal. Terms mode finds the top N most popular terms, Goal mode display
       * progress towards a fix goal in terms of documents matched
       */
      mode    : "terms",
      /** @scratch /panels/pie/3
       * size:: The max number of results to display in +terms+ mode.
       */
      size    : 10,
      /** @scratch /panels/pie/3
       * exclude:: Exclude these terms in terms mode
       */
      exclude : [],
      /** @scratch /panels/pie/3
       * donut:: Draw a hole in the middle of the pie, creating a tasty donut.
       */
      donut   : false,
      /** @scratch /panels/pie/3
       * tilt:: Tilt the pie back into an oval shape
       */
      tilt    : false,
      /** @scratch /panels/pie/3
       * legend:: The location of the legend, above, below or none
       */
      legend  : "above",
      /** @scratch /panels/pie/3
       * labels:: Set to false to disable drawing labels inside the pie slices
       */
      labels  : true,
      /** @scratch /panels/pie/3
       * spyable:: Set to false to disable the inspect function.
       */
      spyable : true,
      /** @scratch /panels/pie/3
       * ==== Query
       *
       * query object:: This confusingly named object has properties to set the terms mode field,
       * and the fixed goal for the goal mode
       * query.field::: the field to facet on in terms mode
       * query.goal::: the fixed goal for goal mode
       */
      query   : { field:"_type", goal: 100},
      /** @scratch /panels/pie/5
       * ==== Queries
       *
       * queries object:: This object describes the queries to use on this panel.
       * queries.mode::: Of the queries available, which to use. Options: +all, pinned, unpinned, selected+
       * queries.ids::: In +selected+ mode, which query ids are selected.
       */
      queries     : {
        mode        : 'all',
        ids         : []
      },
      default_field : '_type',

    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.$on('refresh',function(){$scope.get_data();});
      $scope.get_data();
    };

    $scope.set_mode = function(mode) {
      switch(mode)
      {
      case 'terms':
        $scope.panel.query = {field:"_all"};
        break;
      case 'goal':
        $scope.panel.query = {goal:100};
        break;
      }
    };

    $scope.set_refresh = function (state) {
      $scope.refresh = state;
    };

    $scope.close_edit = function() {
      if($scope.refresh) {
        $scope.get_data();
      }
      $scope.refresh =  false;
      $scope.$emit('render');
    };

    $scope.get_data = function() {

      // Make sure we have everything for the request to complete
      if(dashboard.indices.length === 0) {
        return;
      }


      $scope.panelMeta.loading = true;
      var request = $scope.ejs.Request().indices(dashboard.indices);

      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
      var queries = querySrv.getQueryObjs($scope.panel.queries.ids);

      // This could probably be changed to a BoolFilter
      var boolQuery = $scope.ejs.BoolQuery();
      _.each(queries,function(q) {
        boolQuery = boolQuery.should(querySrv.toEjsObj(q));
      });

      var results;

      // Terms mode
      if ($scope.panel.mode === "terms") {
        request = request
          .facet($scope.ejs.TermsFacet('pie')
            .field($scope.panel.query.field || $scope.panel.default_field)
            .size($scope.panel.size)
            .exclude($scope.panel.exclude)
            .facetFilter($scope.ejs.QueryFilter(
              $scope.ejs.FilteredQuery(
                boolQuery,
                filterSrv.getBoolFilter(filterSrv.ids)
                )))).size(0);

        $scope.inspector = angular.toJson(JSON.parse(request.toString()),true);

        results = request.doSearch();

        // Populate scope when we have results
        results.then(function(results) {
          $scope.panelMeta.loading = false;
          $scope.hits = results.hits.total;
          $scope.data = [];
          var k = 0;
          _.each(results.facets.pie.terms, function(v) {
            var slice = { label : v.term, data : v.count };
            $scope.data.push();
            $scope.data.push(slice);
            k = k + 1;
          });
          $scope.$emit('render');
        });
      // Goal mode
      } else {
        request = request
          .query(boolQuery)
          .filter(filterSrv.getBoolFilter(filterSrv.ids))
          .size(0);

        $scope.inspector = angular.toJson(JSON.parse(request.toString()),true);

        results = request.doSearch();

        results.then(function(results) {
          $scope.panelMeta.loading = false;
          var complete  = results.hits.total;
          var remaining = $scope.panel.query.goal - complete;
          $scope.data = [
            { label : 'Complete', data : complete, color: '#BF6730' },
            { data : remaining, color: '#e2d0c4' }
          ];
          $scope.$emit('render');
        });
      }
    };

  });

  module.directive('pie', function(querySrv, filterSrv) {
    return {
      restrict: 'A',
      link: function(scope, elem) {

        elem.html('<center><img src="img/load_big.gif"></center>');

        // Receive render events
        scope.$on('render',function(){
          render_panel();
        });

        // Or if the window is resized
        angular.element(window).bind('resize', function(){
          render_panel();
        });

        // Function for rendering panel
        function render_panel() {
          // IE doesn't work without this
          elem.css({height:scope.panel.height||scope.row.height});

          var label;

          if(scope.panel.mode === 'goal') {
            label = {
              show: scope.panel.labels,
              radius: 0,
              formatter: function(label, series){
                var font = parseInt(scope.row.height.replace('px',''),10)/8 + String('px');
                if(!(_.isUndefined(label))) {
                  return '<div style="font-size:'+font+';font-weight:bold;text-align:center;padding:2px;color:#fff;">'+
                  Math.round(series.percent)+'%</div>';
                } else {
                  return '';
                }
              },
            };
          } else {
            label = {
              show: scope.panel.labels,
              radius: 2/3,
              formatter: function(label, series){
                return '<div "style="font-size:8pt;text-align:center;padding:2px;color:white;">'+
                  label+'<br/>'+Math.round(series.percent)+'%</div>';
              },
              threshold: 0.1
            };
          }

          var pie = {
            series: {
              pie: {
                innerRadius: scope.panel.donut ? 0.45 : 0,
                tilt: scope.panel.tilt ? 0.45 : 1,
                radius: 1,
                show: true,
                combine: {
                  color: '#999',
                  label: 'The Rest'
                },
                label: label,
                stroke: {
                  width: 0
                }
              }
            },
            //grid: { hoverable: true, clickable: true },
            grid:   {
              backgroundColor: null,
              hoverable: true,
              clickable: true
            },
            legend: { show: false },
            colors: querySrv.colors
          };

          // Populate legend
          if(elem.is(":visible")){
            require(['jquery.flot.pie'], function(){
              scope.legend = $.plot(elem, scope.data, pie).getData();
              if(!scope.$$phase) {
                scope.$apply();
              }
            });
          }

        }

        elem.bind('plotclick', function (event, pos, object) {
          if (!object) {
            return;
          }
          if(scope.panel.mode === 'terms') {
            filterSrv.set({type:'terms',field:scope.panel.query.field,value:object.series.label});
          }
        });

        var $tooltip = $('<div>');
        elem.bind('plothover', function (event, pos, item) {
          if (item) {
            $tooltip
              .html([
                kbn.query_color_dot(item.series.color, 15),
                (item.series.label || ''),
                parseFloat(item.series.percent).toFixed(1) + '%'
              ].join(' '))
              .place_tt(pos.pageX, pos.pageY, {
                offset: 10
              });
          } else {
            $tooltip.remove();
          }
        });

      }
    };
  });
});