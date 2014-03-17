/** @scratch /panels/5
 * include::panels/uptime.asciidoc[]
 */

/** @scratch /panels/uptime/0
 * == uptime
 * Status: *Experimental*
 *
 * The uptime panel is used for displaying percent uptime, where uptime is defined as the time that a
 * given metric is below a given threshold.
 *
 */
define([
  'angular',
  'app',
  'jquery',
  'underscore',
  'kbn',
],
function (angular, app, $, _, kbn) {
  'use strict';

  var module = angular.module('kibana.panels.text', []);
  app.useModule(module);

  module.controller('uptime', function($scope, $rootScope, filterSrv, datasourceSrv) {
    $scope.panelMeta = {
      description : "An text panel that displayed percent uptime, where "
      +"uptime is the percent of time that a given metric is below a given threshold"
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/text/5
       * metric:: the metric to measure
       *
       *
       */
      target1    : "",
      threshold1 : "",
      target2    : "",
      threshold2 : "",
      uptime: "",
      style: {},
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.initPanel($scope);
      $scope.datasources = datasourceSrv.listOptions();
      $scope.setDatasource($scope.panel.datasource);
    };

    $scope.setDatasource = function(datasource) {
      $scope.panel.datasource = datasource;
      $scope.datasource = datasourceSrv.get(datasource);
      if (!$scope.datasource) {
        $scope.panel.error = "Cannot find datasource " + datasource;
        console.log("Cannot find datasource",datasource);
        return;
      }
      $scope.get_data();
    };

    /** this is the return value from the graphite data fetch */
    $scope.dataHandler = function(data) {
        // compute uptime from response data
        var sla = [ $scope.panel.threshold1, $scope.panel.threshold2 ];
        var response = data.data;
        var timesegments_total = 0.0;
        var timesegments_out_of_sla = 0;
        // convert the response, which is separate series, into one
        var results = {};
        for (var i in response) {
          var datapoints = response[i].datapoints;
          for (var j in datapoints) {
            var value = datapoints[j][0];
            var timestamp = datapoints[j][1];
            if (!(timestamp in results)) {
              results[timestamp] = {};
            }
            results[timestamp][i] = value;
          }
        }
        // now scan and generate uptime
        for (i in results) {
          var metric0 = parseFloat(results[i][0]);
          var target1 = parseFloat(results[i][1]);
          timesegments_total += 1;
          var out_of_sla = false;
          if (metric0 > sla[0])  {
            timesegments_out_of_sla += 1;
            out_of_sla = true;
          }
          if (target1 > sla[1]) {
            timesegments_out_of_sla += 1;
            out_of_sla = true;
          }
          //console.log("sla check",i,metric0,sla[0],eetric1,sla[1],out_of_sla);
          //console.log( results[i][0] + "=" + p95 + ":" + results[i][1] + "=" + error_percentage + ":" + out_of_sla);
        }
        var uptime = (1.0 - (timesegments_out_of_sla/timesegments_total)) * 100.0;
        // round to 2 decimals
        uptime = parseFloat(Math.round(uptime * 100) / 100).toFixed(2);
        //console.log("xxx gotdata computed uptime",timesegments_out_of_sla,"/",timesegments_total,"=",uptime);
        $scope.panel.uptime = uptime;
      };

    $scope.updateTimeRange = function () {
      $scope.range = filterSrv.timeRange();
      $scope.rangeUnparsed = filterSrv.timeRange(false);
      $scope.resolution = Math.ceil(($(window).width() * ($scope.panel.span / 12)) / 2);
      $scope.interval = '10m';
      if ($scope.range) {
        $scope.interval = kbn.secondsToHms(
          kbn.calculate_interval($scope.range.from, $scope.range.to, $scope.resolution, 0) / 1000
        );
      }
    };

    $scope.get_data = function() {
      $scope.updateTimeRange();
      delete $scope.panel.error;
      var graphiteQuery = {
        range: $scope.rangeUnparsed,
        interval: $scope.interval,
        targets: [ 
            { target: $scope.panel.target1 },
            { target: $scope.panel.target2 },
          ],
          format: "json",
          datasource: $scope.datasource
        };

      return $scope.datasource.query(graphiteQuery)
        .then($scope.dataHandler)
        .then(null, function(err) {
            console.log("datasource.query error:" + err.message);
            console.log(err.stack);
            //$scope.panel.error = err.message || "Graphite HTTP Request Error";  
            // we see this when one of the two graphs has no data points (e.g. no errors)
            // This may be fixed by https://github.com/graphite-project/graphite-web/pull/646
            // for now, let's try just fetching the first metric, see if that works
            graphiteQuery.targets = [ { target: $scope.panel.target1 } ]
            return $scope.datasource.query(graphiteQuery).then($scope.dataHandler);
          });

    };


    $scope.render = function(data) {
      $scope.$emit('render', data);
    };


  });

  module.directive('uptime', function() {
    return {
      restrict: 'E',
      link: function(scope) {

        scope.$on('render', function() {
          render_panel();
        });

        scope.$on('refresh',function() {
          scope.get_data();
        });

        function render_panel() {
            // console.log("render_panel: ",scope.panel.metric,scope.panel.threshold,scope.panel.uptime);
            // element.html("xxblah blah:" + scope.panel.metric + ":" + scope.panel.threshold + ":" + scope.panel.uptime);
            // For whatever reason, this fixes chrome. I don't like it, I think
            // it makes things slow?
            //if(!scope.$$phase) { scope.$apply(); }
        }

        render_panel();
      }
    };
  });




});


