define([
  'angular',
  'underscore',
  'kbn'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('kibana.services');

  module.factory('InfluxDatasource', function($q, $http) {

    function InfluxDatasource(datasource) {
      this.type = 'influxDB';
      this.editorSrc = 'app/partials/influxdb/editor.html';
      this.urls = datasource.urls;
      this.username = datasource.username;
      this.password = datasource.password;
      this.name = datasource.name;
      this.templateSettings = {
        interpolate : /\[\[([\s\S]+?)\]\]/g,
      };
    }

    InfluxDatasource.prototype.query = function(filterSrv, options) {
      var promises = _.map(options.targets, function(target) {
        var query;
        var alias = '';

        if (target.hide || !((target.series && target.column) || target.query)) {
          return [];
        }

        var timeFilter = getTimeFilter(options);
        var additionalGroups = [];
        
        if (target.rawQuery) {
          query = target.query;
          query = query.replace(";", "");
          var queryElements = query.split(" ");
          var lowerCaseQueryElements = query.toLowerCase().split(" ");
          var whereIndex = lowerCaseQueryElements.indexOf("where");
          var groupByIndex = lowerCaseQueryElements.indexOf("group");
          var orderIndex = lowerCaseQueryElements.indexOf("order");
          
          additionalGroups = lowerCaseQueryElements.slice(groupByIndex + 1,
            orderIndex >= 0 ? orderIndex : lowerCaseQueryElements.length).filter(function(w) {
            return ! /time\(/.test(w);
          });
          additionalGroups = _.map(additionalGroups, function(w) {
            return w.replace(",","");
          });

          if (whereIndex !== -1) {
            queryElements.splice(whereIndex+1, 0, timeFilter, "and");
          }
          else {
            if (groupByIndex !== -1) {
              queryElements.splice(groupByIndex, 0, "where", timeFilter);
            }
            else if (orderIndex !== -1) {
              queryElements.splice(orderIndex, 0, "where", timeFilter);
            }
            else {
              queryElements.push("where");
              queryElements.push(timeFilter);
            }
          }

          query = queryElements.join(" ");
          query = filterSrv.applyTemplateToTarget(query);
        }
        else {
          var template = "select [[group]][[group_comma]] [[func]](\"[[column]]\") as \"[[column]]_[[func]]\" from \"[[series]]\" " +
                         "where  [[timeFilter]] [[condition_add]] [[condition_key]] [[condition_op]] [[condition_value]] " +
                         "group by time([[interval]])[[group_comma]] [[group]] order asc";

          var templateData = {
            series: target.series,
            column: target.column,
            func: target.function,
            timeFilter: timeFilter,
            interval: target.interval || options.interval,
            condition_add: target.condition_filter ? target.condition_add : '',
            condition_key: target.condition_filter ? target.condition_key : '',
            condition_op: target.condition_filter ? target.condition_op : '',
            condition_value: target.condition_filter ? target.condition_value : '',
            group_comma: target.groupby_field_add && target.groupby_field ? ',' : '',
            group: target.groupby_field_add ? target.groupby_field : '',
          };

          if (target.groupby_field_add) {
            additionalGroups.push(target.groupby_field);
          }
          query = _.template(template, templateData, this.templateSettings);
          query = filterSrv.applyTemplateToTarget(query);

          if (target.alias) {
            alias = filterSrv.applyTemplateToTarget(target.alias);
          }

          target.query = query;
        }

        return this.doInfluxRequest(query, alias).then(handleInfluxQueryResponse(additionalGroups));

      }, this);

      return $q.all(promises).then(function(results) {
        return { data: _.flatten(results) };
      });

    };

    InfluxDatasource.prototype.listColumns = function(seriesName) {
      return this.doInfluxRequest('select * from "' + seriesName + '" limit 1').then(function(data) {
        if (!data) {
          return [];
        }

        return data[0].columns;
      });
    };

    InfluxDatasource.prototype.listSeries = function() {
      return this.doInfluxRequest('list series').then(function(data) {
        return _.map(data, function(series) {
          return series.name;
        });
      });
    };

    InfluxDatasource.prototype.metricFindQuery = function (filterSrv, query) {
      var interpolated;
      try {
        interpolated = filterSrv.applyTemplateToTarget(query);
      }
      catch(err) {
        return $q.reject(err);
      }

      return this.doInfluxRequest(query, 'filters')
        .then(function (results) {
          return _.map(results[0].points, function (metric) {
            return {
              text: metric[1],
              expandable: false
            };
          });
        });
    };

    function retry(deferred, callback, delay) {
      return callback().then(undefined, function(reason) {
        if (reason.status !== 0 || reason.status >= 300) {
          deferred.reject(reason);
        } 
        else {
          setTimeout(function() {
            return retry(deferred, callback, Math.min(delay * 2, 30000));
          }, delay);
        }
      });
    }

    InfluxDatasource.prototype.doInfluxRequest = function(query, alias) {
      var _this = this;
      var deferred = $q.defer();

      retry(deferred, function() {
        var currentUrl = _this.urls.shift();
        _this.urls.push(currentUrl);

        var params = {
          u: _this.username,
          p: _this.password,
          time_precision: 's',
          q: query
        };

        var options = {
          method: 'GET',
          url:    currentUrl + '/series',
          params: params,
        };

        return $http(options).success(function (data) {
          data.alias = alias;
          deferred.resolve(data);
        });
      }, 10);

      return deferred.promise;
    };

    function handleInfluxQueryResponse(additionalGroup) { 
      return function(data) {
        var output = [];

        _.each(data, function(series) {
          var timeCol = series.columns.indexOf('time');
          var groupCols = _.map(additionalGroup, function(col) { 
            return series.columns.indexOf(col);
          });
          var groupByColumn = _.find(groupCols, function(col) { return col > -1; });

          _.each(series.columns, function(column, index) {
            if (column === "time" || column === "sequence_number" || _.contains(additionalGroup, column)) {
              return;
            }

            var target = data.alias || series.name + "." + column;
            var datapoints = _.groupBy(series.points, function (point) { 
              if (groupByColumn === undefined) {
                return null;
              } else {
                return point[groupByColumn];
              }
            });
            datapoints = _.map(_.pairs(datapoints), function(values) {
              return [values[0], _.map(values[1], function (point) { return [isNaN(point[index]) ? null : point[index], point[timeCol]]; }) ];
            });
            
            _.each(datapoints, function(values) {
              // this gets stringified on its way out of _.pair... sigh
              if (values[0] == "null") {
                output.push({ target: target, datapoints: values[1]});
              } else {
                output.push({ target: values[0] + "-" + target, datapoints: values[1] });
              }
            });
          });
        });

        return output;
      };
    }

    function getTimeFilter(options) {
      var from = getInfluxTime(options.range.from);
      var until = getInfluxTime(options.range.to);

      if (until === 'now()') {
        return 'time > now() - ' + from;
      }

      return 'time > ' + from + ' and time < ' + until;
    }

    function getInfluxTime(date) {
      if (_.isString(date)) {
        if (date === 'now') {
          return 'now()';
        }
        else if (date.indexOf('now') >= 0) {
          return date.substring(4);
        }

        date = kbn.parseDate(date);
      }

      return to_utc_epoch_seconds(date);
    }

    function to_utc_epoch_seconds(date) {
      return (date.getTime() / 1000).toFixed(0) + 's';
    }


    return InfluxDatasource;

  });

});
