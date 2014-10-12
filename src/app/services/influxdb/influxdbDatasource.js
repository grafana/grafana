define([
  'angular',
  'lodash',
  'kbn',
  './influxSeries',
  './influxQueryBuilder'
],
function (angular, _, kbn, InfluxSeries, InfluxQueryBuilder) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('InfluxDatasource', function($q, $http, templateSrv) {

    function InfluxDatasource(datasource) {
      this.type = 'influxDB';
      this.editorSrc = 'app/partials/influxdb/editor.html';
      this.urls = datasource.urls;
      this.username = datasource.username;
      this.password = datasource.password;
      this.name = datasource.name;
      this.basicAuth = datasource.basicAuth;

      this.saveTemp = _.isUndefined(datasource.save_temp) ? true : datasource.save_temp;
      this.saveTempTTL = _.isUndefined(datasource.save_temp_ttl) ? '30d' : datasource.save_temp_ttl;

      this.grafanaDB = datasource.grafanaDB;
      this.supportAnnotations = true;
      this.supportMetrics = true;
      this.annotationEditorSrc = 'app/partials/influxdb/annotation_editor.html';
    }

    InfluxDatasource.prototype.query = function(options) {
      var timeFilter = getTimeFilter(options);

      var promises = _.map(options.targets, function(target) {
        if (target.hide || !((target.series && target.column) || target.query)) {
          return [];
        }

        // build query
        var queryBuilder = new InfluxQueryBuilder(target);
        var query = queryBuilder.build();

        // replace grafana variables
        query = query.replace('$timeFilter', timeFilter);
        query = query.replace('$interval', (target.interval || options.interval));

        // replace templated variables
        query = templateSrv.replace(query);

        var alias = target.alias ? templateSrv.replace(target.alias) : '';

        var handleResponse = _.partial(handleInfluxQueryResponse, alias, queryBuilder.groupByField);
        return this._seriesQuery(query).then(handleResponse);

      }, this);

      return $q.all(promises).then(function(results) {
        return { data: _.flatten(results) };
      });
    };

    InfluxDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
      var timeFilter = getTimeFilter({ range: rangeUnparsed });
      var query = annotation.query.replace('$timeFilter', timeFilter);
      query = templateSrv.replace(query);

      return this._seriesQuery(query).then(function(results) {
        return new InfluxSeries({ seriesList: results, annotation: annotation }).getAnnotations();
      });
    };

    InfluxDatasource.prototype.listColumns = function(seriesName) {
      var interpolated = templateSrv.replace(seriesName);
      if (interpolated[0] !== '/') {
        interpolated = '/' + interpolated + '/';
      }

      return this._seriesQuery('select * from ' + interpolated + ' limit 1').then(function(data) {
        if (!data) {
          return [];
        }
        return data[0].columns;
      });
    };

    InfluxDatasource.prototype.listSeries = function(query) {
      // wrap in regex
      if (query && query.length > 0 && query[0] !== '/')  {
        query = '/' + query + '/';
      }

      return this._seriesQuery('list series ' + query).then(function(data) {
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

    InfluxDatasource.prototype.metricFindQuery = function (query) {
      var interpolated;
      try {
        interpolated = templateSrv.replace(query);
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
          reason.message = 'InfluxDB Error: <br/>' + reason.data;
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
          data:   data,
          inspect: { type: 'influxdb' },
        };

        options.headers = options.headers || {};
        if (_this.basicAuth) {
          options.headers.Authorization = 'Basic ' + _this.basicAuth;
        }

        return $http(options).success(function (data) {
          deferred.resolve(data);
        });
      }, 10);

      return deferred.promise;
    };

    InfluxDatasource.prototype.saveDashboard = function(dashboard) {
      var tags = dashboard.tags.join(',');
      var title = dashboard.title;
      var temp = dashboard.temp;
      var id = kbn.slugifyForUrl(title);
      if (temp) { delete dashboard.temp; }

      var data = [{
        name: 'grafana.dashboard_' + btoa(id),
        columns: ['time', 'sequence_number', 'title', 'tags', 'dashboard', 'id'],
        points: [[1000000000000, 1, title, tags, angular.toJson(dashboard), id]]
      }];

      if (temp) {
        return this._saveDashboardTemp(data, title, id);
      }
      else {
        var self = this;
        return this._influxRequest('POST', '/series', data).then(function() {
          self._removeUnslugifiedDashboard(id, title, false);
          return { title: title, url: '/dashboard/db/' + id };
        }, function(err) {
          throw 'Failed to save dashboard to InfluxDB: ' + err.data;
        });
      }
    };

    InfluxDatasource.prototype._removeUnslugifiedDashboard = function(id, title, isTemp) {
      if (id === title) { return; }

      var self = this;
      self._getDashboardInternal(title, isTemp).then(function(dashboard) {
        if (dashboard !== null) {
          self.deleteDashboard(title);
        }
      });
    };

    InfluxDatasource.prototype._saveDashboardTemp = function(data, title, id) {
      data[0].name = 'grafana.temp_dashboard_' + btoa(id);
      data[0].columns.push('expires');
      data[0].points[0].push(this._getTempDashboardExpiresDate());

      return this._influxRequest('POST', '/series', data).then(function() {
        var baseUrl = window.location.href.replace(window.location.hash,'');
        var url = baseUrl + "#dashboard/temp/" + id;
        return { title: title, url: url };
      }, function(err) {
        throw 'Failed to save shared dashboard to InfluxDB: ' + err.data;
      });
    };

    InfluxDatasource.prototype._getTempDashboardExpiresDate = function() {
      var ttlLength = this.saveTempTTL.substring(0, this.saveTempTTL.length - 1);
      var ttlTerm = this.saveTempTTL.substring(this.saveTempTTL.length - 1, this.saveTempTTL.length).toLowerCase();
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
      return expires;
    };

    InfluxDatasource.prototype._getDashboardInternal = function(id, isTemp) {
      var queryString = 'select dashboard from "grafana.dashboard_' + btoa(id) + '"';

      if (isTemp) {
        queryString = 'select dashboard from "grafana.temp_dashboard_' + btoa(id) + '"';
      }

      return this._seriesQuery(queryString).then(function(results) {
        if (!results || !results.length) {
          return null;
        }

        var dashCol = _.indexOf(results[0].columns, 'dashboard');
        var dashJson = results[0].points[0][dashCol];

        return angular.fromJson(dashJson);
      }, function() {
        return null;
      });
    };

    InfluxDatasource.prototype.getDashboard = function(id, isTemp) {
      var self = this;
      return this._getDashboardInternal(id, isTemp).then(function(dashboard) {
        if (dashboard !== null)  {
          return dashboard;
        }

        // backward compatible load for unslugified ids
        var slug = kbn.slugifyForUrl(id);
        if (slug !== id) {
          return self.getDashboard(slug, isTemp);
        }

        throw "Dashboard not found";
      }, function(err) {
        throw  "Could not load dashboard, " + err.data;
      });
    };

    InfluxDatasource.prototype.deleteDashboard = function(id) {
      return this._seriesQuery('drop series "grafana.dashboard_' + btoa(id) + '"').then(function(results) {
        if (!results) {
          throw "Could not delete dashboard";
        }
        return id;
      }, function(err) {
        throw "Could not delete dashboard, " + err.data;
      });
    };

    InfluxDatasource.prototype.searchDashboards = function(queryString) {
      var influxQuery = 'select * from /grafana.dashboard_.*/ where ';

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

        for (var i = 0; i < results.length; i++) {
          var dashCol = _.indexOf(results[i].columns, 'title');
          var tagsCol = _.indexOf(results[i].columns, 'tags');
          var idCol = _.indexOf(results[i].columns, 'id');

          var hit =  {
            id: results[i].points[0][dashCol],
            title: results[i].points[0][dashCol],
            tags: results[i].points[0][tagsCol].split(",")
          };

          if (idCol !== -1) {
            hit.id = results[i].points[0][idCol];
          }

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
