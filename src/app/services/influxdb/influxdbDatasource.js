define([
  'angular',
  'underscore',
  'kbn',
  './influxSeries'
],
function (angular, _, kbn, InfluxSeries) {
  'use strict';

  var module = angular.module('grafana.services');

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

      this.grafanaDB = datasource.grafanaDB;
      this.supportAnnotations = true;
      this.supportMetrics = true;
      this.annotationEditorSrc = 'app/partials/influxdb/annotation_editor.html';
    }

    InfluxDatasource.prototype.query = function(filterSrv, options) {
      var promises = _.map(options.targets, function(target) {
        var query;
        var alias = '';

        if (target.hide || !((target.series && target.column) || target.query)) {
          return [];
        }

        var timeFilter = getTimeFilter(options);
        var groupByField;

        if (target.rawQuery) {
          query = target.query;
          query = query.replace(";", "");
          var queryElements = query.split(" ");
          var lowerCaseQueryElements = query.toLowerCase().split(" ");
          var whereIndex = lowerCaseQueryElements.indexOf("where");
          var groupByIndex = lowerCaseQueryElements.indexOf("group");
          var orderIndex = lowerCaseQueryElements.indexOf("order");

          if (lowerCaseQueryElements[1].indexOf(',') !== -1) {
            groupByField = lowerCaseQueryElements[1].replace(',', '');
          }

          if (whereIndex !== -1) {
            queryElements.splice(whereIndex + 1, 0, timeFilter, "and");
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

          var template = "select [[group]][[group_comma]] [[func]]([[column]]) from [[series]] " +
                         "where  [[timeFilter]] [[condition_add]] [[condition_key]] [[condition_op]] [[condition_value]] " +
                         "group by time([[interval]])[[group_comma]] [[group]] order asc";

          var templateData = {
            series: target.series,
            column: target.column,
            func: target.function,
            timeFilter: timeFilter,
            interval: target.interval || options.interval,
            condition_add: target.condition_filter ? 'and' : '',
            condition_key: target.condition_filter ? target.condition_key : '',
            condition_op: target.condition_filter ? target.condition_op : '',
            condition_value: target.condition_filter ? target.condition_value : '',
            group_comma: target.groupby_field_add && target.groupby_field ? ',' : '',
            group: target.groupby_field_add ? target.groupby_field : '',
          };

          if(!templateData.series.match('^/.*/')) {
            templateData.series = '"' + templateData.series + '"';
          }

          query = _.template(template, templateData, this.templateSettings);
          query = filterSrv.applyTemplateToTarget(query);

          if (target.groupby_field_add) {
            groupByField = target.groupby_field;
          }

          target.query = query;
        }

        if (target.alias) {
          alias = filterSrv.applyTemplateToTarget(target.alias);
        }

        var handleResponse = _.partial(handleInfluxQueryResponse, alias, groupByField);
        return this._seriesQuery(query).then(handleResponse);

      }, this);

      return $q.all(promises).then(function(results) {
        return { data: _.flatten(results) };
      });

    };

    InfluxDatasource.prototype.annotationQuery = function(annotation, filterSrv, rangeUnparsed) {
      var timeFilter = getTimeFilter({ range: rangeUnparsed });
      var query = _.template(annotation.query, { timeFilter: timeFilter }, this.templateSettings);

      return this._seriesQuery(query).then(function(results) {
        return new InfluxSeries({ seriesList: results, annotation: annotation }).getAnnotations();
      });
    };

    InfluxDatasource.prototype.listColumns = function(seriesName) {
      return this._seriesQuery('select * from /' + seriesName + '/ limit 1').then(function(data) {
        if (!data) {
          return [];
        }
        return data[0].columns;
      });
    };

    InfluxDatasource.prototype.listSeries = function() {
      return this._seriesQuery('list series').then(function(data) {
        if (!data || data.length === 0) {
          return [];
        }
        // influxdb >= 1.8
        if (data[0].points.length > 0) {
          return _.map(data[0].points, function(point) {
            return point[1];
          });
        }
        else { // influxdb <= 1.7
          return _.map(data, function(series) {
            return series.name; // influxdb < 1.7
          });
        }
      });
    };

    InfluxDatasource.prototype.metricFindQuery = function (filterSrv, query) {
      var interpolated;
      try {
        interpolated = filterSrv.applyTemplateToTarget(query);
      }
      catch (err) {
        return $q.reject(err);
      }

      return this._seriesQuery(interpolated)
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

    InfluxDatasource.prototype._seriesQuery = function(query) {
      return this._influxRequest('GET', '/series', {
        q: query,
        time_precision: 's',
      });
    };

    InfluxDatasource.prototype._influxRequest = function(method, url, data) {
      var _this = this;
      var deferred = $q.defer();

      retry(deferred, function() {
        var currentUrl = _this.urls.shift();
        _this.urls.push(currentUrl);

        var params = {
          u: _this.username,
          p: _this.password,
        };

        if (method === 'GET') {
          _.extend(params, data);
          data = null;
        }

        var options = {
          method: method,
          url:    currentUrl + url,
          params: params,
          data:   data
        };

        return $http(options).success(function (data) {
          deferred.resolve(data);
        });
      }, 10);

      return deferred.promise;
    };

    InfluxDatasource.prototype.saveDashboard = function(dashboard, title) {
      var dashboardClone = angular.copy(dashboard);
      var tags = dashboardClone.tags.join(',');
      title = dashboardClone.title = title ? title : dashboard.title;

      var data = [{
        name: 'grafana.dashboard_' + btoa(title),
        columns: ['time', 'sequence_number', 'title', 'tags', 'dashboard'],
        points: [[1, 1, title, tags, angular.toJson(dashboardClone)]]
      }];

      return this._influxRequest('POST', '/series', data).then(function() {
        return { title: title, url: '/dashboard/db/' + title };
      }, function(err) {
        throw 'Failed to save dashboard to InfluxDB: ' + err.data;
      });
    };

    InfluxDatasource.prototype.saveDashboardTemp = function(dashboard, title) {
      var dashboardClone = angular.copy(dashboard);
      var tags = dashboardClone.tags.join(',');
      title = dashboardClone.title = title ? title : dashboard.title;
      var ttl = dashboard.loader.save_temp_ttl;
      var ttlLength = ttl.substring(0, ttl.length-1);
      var ttlTerm = ttl.substring(ttl.length-1, ttl.length).toLowerCase();
      var expires = Date.now();
      switch(ttlTerm) {
        case "m":
          expires += ttlLength * 60000;
          break;
        case "d":
          expires += ttlLength * 86400000;
          break;
        case "w":
          expires += ttlLength * 604800000;
          break;
        default:
          throw "Unknown ttl duration format";
      }

      var data = [{
        name: 'grafana.dashboard_' + btoa(title),
        columns: ['time', 'sequence_number', 'title', 'tags', 'dashboard', 'expires'],
        points: [[1, 1, title, tags, angular.toJson(dashboardClone), expires]]
      }];

      return this._influxRequest('POST', '/series', data).then(function() {
        var baseUrl = window.location.href.replace(window.location.hash,'');
        var url = baseUrl + "#dashboard/temp/" + title;
        return { title: title, url: url };
      }, function(err) {
        throw 'Failed to save shared dashboard to InfluxDB: ' + err.data;
      });
    };
    InfluxDatasource.prototype.getDashboard = function(id) {
      var queryString = 'select dashboard from "grafana.dashboard_' + btoa(id) + '"';
      // hack to check if it is a temp dashboard
      if (window.location.href.indexOf('dashboard/temp') > 0) {
        var isTemp = true;
        queryString = 'select dashboard, expires from "grafana.dashboard_' + btoa(id) + '"';
      }
      return this._seriesQuery(queryString).then(function(results) {
        if (!results || !results.length) {
          throw "Dashboard not found";
        }
        var expiresCol = _.indexOf(results[0].columns, 'expires');
        var expiresTime = results[0].points[0][expiresCol];
        if (Date.now() > expiresTime && isTemp) {
          throw "Dashboard has expired";
        }
        var dashCol = _.indexOf(results[0].columns, 'dashboard');
        var dashJson = results[0].points[0][dashCol];
        return angular.fromJson(dashJson);
      }, function(err) {
        return "Could not load dashboard, " + err.data;
      });
    };

    InfluxDatasource.prototype.deleteDashboard = function(id) {
      return this._seriesQuery('drop series "grafana.dashboard_' + btoa(id) + '"').then(function(results) {
        if (!results) {
          throw "Could not delete dashboard";
        }
        return id;
      }, function(err) {
        return "Could not delete dashboard, " + err.data;
      });
    };

    InfluxDatasource.prototype.searchDashboards = function(queryString) {
      var influxQuery = 'select title, tags from /grafana.dashboard_.*/ where ';

      var tagsOnly = queryString.indexOf('tags!:') === 0;
      if (tagsOnly) {
        var tagsQuery = queryString.substring(6, queryString.length);
        influxQuery = influxQuery + 'tags =~ /.*' + tagsQuery + '.*/i';
      }
      else {
        var titleOnly = queryString.indexOf('title:') === 0;
        if (titleOnly) {
          var titleQuery = queryString.substring(6, queryString.length);
          influxQuery = influxQuery + ' title =~ /.*' + titleQuery + '.*/i';
        }
        else {
          influxQuery = influxQuery + '(tags =~ /.*' + queryString + '.*/i or title =~ /.*' + queryString + '.*/i)';
        }
      }

      return this._seriesQuery(influxQuery).then(function(results) {
        var hits = { dashboards: [], tags: [], tagsOnly: false };

        if (!results || !results.length) {
          return hits;
        }

        var dashCol = _.indexOf(results[0].columns, 'title');
        var tagsCol = _.indexOf(results[0].columns, 'tags');

        for (var i = 0; i < results.length; i++) {
          var hit =  {
            id: results[i].points[0][dashCol],
            tags: results[i].points[0][tagsCol].split(",")
          };
          hit.tags = hit.tags[0] ? hit.tags : [];
          hits.dashboards.push(hit);
        }
        return hits;
      });
    };

    function handleInfluxQueryResponse(alias, groupByField, seriesList) {
      var influxSeries = new InfluxSeries({
        seriesList: seriesList,
        alias: alias,
        groupByField: groupByField
      });

      return influxSeries.getTimeSeries();
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
