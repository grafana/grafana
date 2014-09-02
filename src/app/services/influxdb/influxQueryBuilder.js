define([
],
function () {
  'use strict';

  function InfluxQueryBuilder(target) {
    this.target = target;
  }

  var p = InfluxQueryBuilder.prototype;

  p.build = function() {
    return this.target.rawQuery ? this._modifyRawQuery() : this._buildQuery();
  };

  p._buildQuery = function() {
    var target = this.target;
    var query = 'select ';
    var seriesName = target.series;

    if(!seriesName.match('^/.*/')) {
      seriesName = '"' + seriesName+ '"';
    }

    if (target.groupby_field_add) {
      query += target.groupby_field + ', ';
    }

    query +=  target.function + '(' + target.column + ')';
    query += ' from ' + seriesName + ' where [[$timeFilter]]';

    if (target.condition_filter) {
      query += ' and ' + target.condition_expression;
    }

    query += ' group by time([[$interval]])';

    if (target.groupby_field_add) {
      query += ', ' + target.groupby_field;
      this.groupByField = target.groupby_field;
    }

    query += " order asc";

    return query;
  };

  p._modifyRawQuery = function () {
    var query = this.target.query.replace(";", "");

    var queryElements = query.split(" ");
    var lowerCaseQueryElements = query.toLowerCase().split(" ");
    var whereIndex = lowerCaseQueryElements.indexOf("where");
    var groupByIndex = lowerCaseQueryElements.indexOf("group");
    var orderIndex = lowerCaseQueryElements.indexOf("order");

    if (lowerCaseQueryElements[1].indexOf(',') !== -1) {
      this.groupByField = lowerCaseQueryElements[1].replace(',', '');
    }

    if (whereIndex !== -1) {
      queryElements.splice(whereIndex + 1, 0, '[[$timeFilter]]', "and");
    }
    else {
      if (groupByIndex !== -1) {
        queryElements.splice(groupByIndex, 0, "where", '[[$timeFilter]]');
      }
      else if (orderIndex !== -1) {
        queryElements.splice(orderIndex, 0, "where", '[[$timeFilter]]');
      }
      else {
        queryElements.push("where");
        queryElements.push('[[$timeFilter]]');
      }
    }

    return queryElements.join(" ");
  };

  return InfluxQueryBuilder;
});
