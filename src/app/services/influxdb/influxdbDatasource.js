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
      this.urls_rr_lb = datasource.urls;
      this.urls_hash_lb = datasource.lb_hashing;
      this.username = datasource.username;
      this.password = datasource.password;
      this.name = datasource.name;
      this.avoid_empty_data = datasource.avoid_empty_data;
      
      this.templateSettings = {
        interpolate : /\[\[([\s\S]+?)\]\]/g,
      };
    }

    InfluxDatasource.prototype.query = function(filterSrv, options) {
      var promises = _.map(options.targets, function(target) {
        var query;

        if (target.hide || !((target.series && target.column) || target.query)) {
          return [];
        }

        var timeFilter = getTimeFilter(options);

        if (target.rawQuery) {
          query = target.query;
          query = query.replace(";", "");
          var queryElements = query.split(" ");
          var lowerCaseQueryElements = query.toLowerCase().split(" ");
          var whereIndex = lowerCaseQueryElements.indexOf("where");
          var groupByIndex = lowerCaseQueryElements.indexOf("group");
          var orderIndex = lowerCaseQueryElements.indexOf("order");

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
        }
        else {
          var template = "select [[func]](\"[[column]]\") as \"[[column]]_[[func]]\" from \"[[series]]\" " +
                         "where  [[timeFilter]] [[condition_add]] [[condition_key]] [[condition_op]] [[condition_value]] " +
                         "group by time([[interval]]) order asc";

          var templateData = {
            series: target.series,
            column: target.column,
            func: target.function,
            timeFilter: timeFilter,
            interval: target.interval || options.interval,
            condition_add: target.condiction_filter ? target.condition_add : '',
            condition_key: target.condiction_filter ? target.condition_key : '',
            condition_op: target.condiction_filter ? target.condition_op : '',
            condition_value: target.condiction_filter ? target.condition_value: ''
          };

          query = _.template(template, templateData, this.templateSettings);
          target.query = query;
        }

	return this.doInfluxRequest(query, target.alias).then(handleInfluxQueryResponse);
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

    function retry(deferred, callback, delay) {
      return callback().then(undefined, function(reason) {
        if (reason.status !== 0) {
          deferred.reject(reason);
        }
        setTimeout(function() {
          return retry(deferred, callback, Math.min(delay * 2, 30000));
        }, delay);
      });
    }

    InfluxDatasource.prototype.doInfluxRequest = function(query, alias, influxUrl) {
      var _this = this;
      var deferred = $q.defer();

      retry(deferred, function() {
	var currentUrl = null;
	/* Should we use RR load-balancing or hashing? */
	if (_this.urls_hash_lb) {
		for (var i=0; i<_this.urls_hash_lb.length; i++) {
			var matches = query.match(_this.urls_hash_lb[i].regexp);
			if (matches) {
				var index = _this.urls_hash_lb[i].url_index;
				currentUrl = _this.urls[index];
				if (currentUrl) {
					break;
				}
			}
		}
	}
	if (!currentUrl) {
		currentUrl = _this.urls_rr_lb.shift();
		_this.urls_rr_lb.push(currentUrl);
	}
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

    function handleInfluxQueryResponse(data) {
      var output = [];

      _.each(data, function(series) {
        var timeCol = series.columns.indexOf('time');

        _.each(series.columns, function(column, index) {
          if (column === "time" || column === "sequence_number") {
            return;
          }

          var target = data.alias || series.name + "." + column;
          var datapoints = [];

          for(var i = 0; i < series.points.length; i++) {
            datapoints[i] = [series.points[i][index], series.points[i][timeCol]];
          }

          output.push({ target:target, datapoints:datapoints });
        });
      });
      return output;
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
