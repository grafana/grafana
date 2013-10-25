/*
  ## Terms

  ### Parameters
  * style :: A hash of css styles
  * size :: top N
  * arrangement :: How should I arrange the query results? 'horizontal' or 'vertical'
  * chart :: Show a chart? 'none', 'bar', 'pie'
  * donut :: Only applies to 'pie' charts. Punches a hole in the chart for some reason
  * tilt :: Only 'pie' charts. Janky 3D effect. Looks terrible 90% of the time.
  * lables :: Only 'pie' charts. Labels on the pie?
*/
define([
  'angular',
  'app',
  'underscore',
  'jquery',
  'kbn'
],
function (angular, app, _, $, kbn) {
  'use strict';

  var module = angular.module('kibana.panels.terms', []);
  app.useModule(module);

  module.controller('terms', function($scope, querySrv, dashboard, filterSrv) {
    $scope.panelMeta = {
      modals : [
        {
          description: "Inspect",
          icon: "icon-info-sign",
          partial: "app/partials/inspector.html",
          show: $scope.panel.spyable
        }
      ],
      editorTabs : [
        {title:'Queries', src:'app/partials/querySelect.html'}
      ],
      status  : "Stable",
      description : "Displays the results of an elasticsearch facet as a pie chart, bar chart, or a "+
        "table"
    };

    // Set and populate defaults
    var _d = {
      queries     : {
        mode        : 'all',
        ids         : []
      },
      field   : '_type',
      exclude : [],
      missing : true,
      other   : true,
      size    : 10,
      order   : 'count',
      style   : { "font-size": '10pt'},
      donut   : false,
      tilt    : false,
      labels  : true,
      arrangement : 'horizontal',
      chart       : 'bar',
      counter_pos : 'above',
      spyable     : true
    };
    _.defaults($scope.panel,_d);

    $scope.init = function () {
      $scope.hits = 0;

      $scope.$on('refresh',function(){
        $scope.get_data();
      });
      $scope.get_data();

    };

    $scope.get_data = function() {
      // Make sure we have everything for the request to complete
      if(dashboard.indices.length === 0) {
        return;
      }

      $scope.panelMeta.loading = true;
      var request,
        results,
        boolQuery,
        queries;

      request = $scope.ejs.Request().indices(dashboard.indices);

      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
      queries = querySrv.getQueryObjs($scope.panel.queries.ids);

      // This could probably be changed to a BoolFilter
      boolQuery = $scope.ejs.BoolQuery();
      _.each(queries,function(q) {
        boolQuery = boolQuery.should(querySrv.toEjsObj(q));
      });


      // Terms mode
      request = request
        .facet($scope.ejs.TermsFacet('terms')
          .field($scope.panel.field)
          .size($scope.panel.size)
          .order($scope.panel.order)
          .exclude($scope.panel.exclude)
          .facetFilter($scope.ejs.QueryFilter(
            $scope.ejs.FilteredQuery(
              boolQuery,
              filterSrv.getBoolFilter(filterSrv.ids)
              )))).size(0);

      // Populate the inspector panel
      $scope.inspector = angular.toJson(JSON.parse(request.toString()),true);

      results = request.doSearch();

      // Populate scope when we have results
      results.then(function(results) {
        var k = 0;
        $scope.panelMeta.loading = false;
        $scope.hits = results.hits.total;
        $scope.data = [];
        _.each(results.facets.terms.terms, function(v) {
          var slice = { label : v.term, data : [[k,v.count]], actions: true};
          $scope.data.push(slice);
          k = k + 1;
        });

        $scope.data.push({label:'Missing field',
          data:[[k,results.facets.terms.missing]],meta:"missing",color:'#aaa',opacity:0});
        $scope.data.push({label:'Other values',
          data:[[k+1,results.facets.terms.other]],meta:"other",color:'#444'});

        $scope.$emit('render');
      });
    };

    $scope.build_search = function(term,negate) {
      if(_.isUndefined(term.meta)) {
        filterSrv.set({type:'terms',field:$scope.panel.field,value:term.label,
          mandate:(negate ? 'mustNot':'must')});
      } else if(term.meta === 'missing') {
        filterSrv.set({type:'exists',field:$scope.panel.field,
          mandate:(negate ? 'must':'mustNot')});
      } else {
        return;
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

    $scope.showMeta = function(term) {
      if(_.isUndefined(term.meta)) {
        return true;
      }
      if(term.meta === 'other' && !$scope.panel.other) {
        return false;
      }
      if(term.meta === 'missing' && !$scope.panel.missing) {
        return false;
      }
      return true;
    };

  });

  module.directive('termsChart', function(querySrv) {
    return {
      restrict: 'A',
      link: function(scope, elem) {

        // Receive render events
        scope.$on('render',function(){
          render_panel();
        });

        // Re-render if the window is resized
        angular.element(window).bind('resize', function(){
          render_panel();
        });

        // Function for rendering panel
        function render_panel() {
          var plot, chartData;

          // IE doesn't work without this
          elem.css({height:scope.panel.height||scope.row.height});

          // Make a clone we can operate on.
          chartData = _.clone(scope.data);
          chartData = scope.panel.missing ? chartData :
            _.without(chartData,_.findWhere(chartData,{meta:'missing'}));
          chartData = scope.panel.other ? chartData :
          _.without(chartData,_.findWhere(chartData,{meta:'other'}));

          // Populate element.
          require(['jquery.flot.pie'], function(){
            // Populate element
            try {
              // Add plot to scope so we can build out own legend
              if(scope.panel.chart === 'bar') {
                plot = $.plot(elem, chartData, {
                  legend: { show: false },
                  series: {
                    lines:  { show: false, },
                    bars:   { show: true,  fill: 1, barWidth: 0.8, horizontal: false },
                    shadowSize: 1
                  },
                  yaxis: { show: true, min: 0, color: "#c8c8c8" },
                  xaxis: { show: false },
                  grid: {
                    borderWidth: 0,
                    borderColor: '#eee',
                    color: "#eee",
                    hoverable: true,
                    clickable: true
                  },
                  colors: querySrv.colors
                });
              }
              if(scope.panel.chart === 'pie') {
                var labelFormat = function(label, series){
                  return '<div ng-click="build_search(panel.field,\''+label+'\')'+
                    ' "style="font-size:8pt;text-align:center;padding:2px;color:white;">'+
                    label+'<br/>'+Math.round(series.percent)+'%</div>';
                };

                plot = $.plot(elem, chartData, {
                  legend: { show: false },
                  series: {
                    pie: {
                      innerRadius: scope.panel.donut ? 0.4 : 0,
                      tilt: scope.panel.tilt ? 0.45 : 1,
                      radius: 1,
                      show: true,
                      combine: {
                        color: '#999',
                        label: 'The Rest'
                      },
                      stroke: {
                        width: 0
                      },
                      label: {
                        show: scope.panel.labels,
                        radius: 2/3,
                        formatter: labelFormat,
                        threshold: 0.1
                      }
                    }
                  },
                  //grid: { hoverable: true, clickable: true },
                  grid:   { hoverable: true, clickable: true },
                  colors: querySrv.colors
                });
              }

              // Populate legend
              if(elem.is(":visible")){
                setTimeout(function(){
                  scope.legend = plot.getData();
                  if(!scope.$$phase) {
                    scope.$apply();
                  }
                });
              }

            } catch(e) {
              elem.text(e);
            }
          });
        }

        elem.bind("plotclick", function (event, pos, object) {
          if(object) {
            scope.build_search(scope.data[object.seriesIndex]);
          }
        });

        var $tooltip = $('<div>');
        elem.bind("plothover", function (event, pos, item) {
          if (item) {
            var value = scope.panel.chart === 'bar' ? item.datapoint[1] : item.datapoint[1][0][1];
            $tooltip
              .html(
                kbn.query_color_dot(item.series.color, 20) + ' ' +
                item.series.label + " (" + value.toFixed(0)+")"
              )
              .place_tt(pos.pageX, pos.pageY);
          } else {
            $tooltip.remove();
          }
        });

      }
    };
  });

});