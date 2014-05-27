define([
        'angular',
        'underscore',
        'kbn'
    ],
    function (angular, _, kbn) {
        'use strict';

        var module = angular.module('kibana.services');

        module.factory('MonDatasource', function ($q, $http) {

            function MonDatasource(datasource) {
                this.type = 'mon';
                this.editorSrc = 'app/partials/mon/editor.html';
                this.urls = datasource.urls;
                this.access_token = datasource.access_token;
                this.name = datasource.name;
            }

            MonDatasource.prototype.query = function (options) {

                var promises = _.map(options.targets, function (target) {
                    var query;

                    if (target.hide || !((target.series && target.column) || target.query)) {
                        return [];
                    }

                    var startTime = getMonTime(options.range.from);
                    var endTime = getMonTime(options.range.to);

                    if (target.rawQuery) {
                        alert("Raw queries not supported")
                        return [];
                    }
                    else {
                        var params = {
                            //dimensions: target.column,
                            statistics: target.function,
                            start_time: startTime,
                            //end_time: endTime
                        };
                        if (target.series !== '') {
                            params.name = target.series;
                        }
                        return this.doGetStatisticsRequest(params, target.alias).then(handleGetStatisticsResponse);
                    }
                    return [];
                }, this);

                return $q.all(promises).then(function (results) {
                    return { data: _.flatten(results) };
                });
            };

            MonDatasource.prototype.listColumns = function (seriesName) {
                return this.doGetMetricsRequest(seriesName).then(function (data) {
                    if (!data) {
                        return [];
                    }
                    var columns = []
                    for (var i = 0; i < data.length; i++) {
                        var dimensions = data[i].dimensions;
                        for (var dimension in dimensions) {
                            if (columns.indexOf(dimension) == -1) {
                                columns.push(dimension);
                            }
                        }
                    }
                    return columns;
                });
            };

            MonDatasource.prototype.listSeries = function () {
                return this.doGetMetricsRequest(null).then(function (data) {
                    if (!data) {
                        return [];
                    }
                    var names = []
                    for (var i = 0; i < data.length; i++) {
                        var name = data[i].name;
                        if (names.indexOf(name) == -1) {
                            names.push(name);
                        }
                    }
                    return names;
                });
            };

            function retry(deferred, callback, delay) {
                return callback().then(undefined, function (reason) {
                    if (reason.status !== 0) {
                        deferred.reject(reason);
                    }
                    setTimeout(function () {
                        return retry(deferred, callback, Math.min(delay * 2, 30000));
                    }, delay);
                });
            }

            MonDatasource.prototype.doGetStatisticsRequest = function (params, alias) {
                var _this = this;
                var deferred = $q.defer();

                retry(deferred, function () {
                    var currentUrl = _this.urls.shift();
                    _this.urls.push(currentUrl);

                    var headers = {
                        'X-Auth-Token': _this.access_token,
                        'Content-Type': 'application/json'
                    };

                    var options = {
                        method: 'GET',
                        url: currentUrl + '/metrics/statistics',
                        params: params,
                        headers: headers
                    };

                    if ('statistics' in params) {
                        options.url = currentUrl + '/metrics/statistics'
                    }

                    return $http(options).success(function (data) {
                        data.alias = alias;
                        deferred.resolve(data);
                    });
                }, 10);

                return deferred.promise;
            };

            MonDatasource.prototype.doGetMetricsRequest = function (metricName, alias) {
                var _this = this;
                var deferred = $q.defer();
                var seriesName = metricName;

                retry(deferred, function () {
                    var currentUrl = _this.urls.shift();
                    _this.urls.push(currentUrl);

                    var headers = {
                        'X-Auth-Token': _this.access_token,
                        'Content-Type': 'application/json'
                    };

                    var params = {
                        name: seriesName
                    };

                    var options = {
                        method: 'GET',
                        url: currentUrl + '/metrics',
                        params: params,
                        headers: headers
                    };

                    return $http(options).success(function (data) {
                        data.alias = alias;
                        deferred.resolve(data);
                    });
                }, 10);

                return deferred.promise;
            };

            function handleGetStatisticsResponse(data) {
                var output = [];

                _.each(data, function (series) {
                    var timeCol = series.columns.indexOf('timestamp');

                    _.each(series.columns, function (column, index) {
                        if (column === "timestamp" || column === "id") {
                            return;
                        }

                        var target = data.alias || series.name + "." + column;
                        var datapoints = [];

                        for (var i = 0; i < series.statistics.length; i++) {
                            var myDate = new Date(series.statistics[i][timeCol]);
                            var result = myDate.getTime() / 1000;
                            datapoints[i] = [series.statistics[i][index], result];
                        }

                        output.push({ target: target, datapoints: datapoints });
                    });
                });

                return output;
            }

            function getMonTime(date) {
                if (_.isString(date)) {
                    if (date === 'now') {
                        var date = new Date();
                        return date.toISOString().slice(0, -5) + 'Z';
                    }
                    else if (date.indexOf('now') >= 0) {
                        return kbn.parseDate(date).toISOString().slice(0,-5) + 'Z';
                    }
                    date = kbn.parseDate(date).toISOString().slice(0,-15) + 'Z';
                }
                return date.toISOString().slice(0,-5) + 'Z';
            }

            return MonDatasource;
        });

    });
