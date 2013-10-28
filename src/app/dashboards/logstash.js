/* global _ */

/*
 * Complex scripted Logstash dashboard
 * This script generates a dashboard object that Kibana can load. It also takes a number of user
 * supplied URL parameters, none are required:
 *
 * index :: Which index to search? If this is specified, interval is set to 'none'
 * pattern :: Does nothing if index is specified. Set a timestamped index pattern. Default: [logstash-]YYYY.MM.DD
 * interval :: Sets the index interval (eg: day,week,month,year), Default: day
 *
 * split :: The character to split the queries on Default: ','
 * query :: By default, a comma seperated list of queries to run. Default: *
 *
 * from :: Search this amount of time back, eg 15m, 1h, 2d. Default: 15m
 * timefield :: The field containing the time to filter on, Default: @timestamp
 *
 * fields :: comma seperated list of fields to show in the table
 * sort :: comma seperated field to sort on, and direction, eg sort=@timestamp,desc
 *
 */

'use strict';

// Setup some variables
var dashboard, queries, _d_timespan;

// All url parameters are available via the ARGS object
var ARGS;

// Set a default timespan if one isn't specified
_d_timespan = '1d';

// Intialize a skeleton with nothing but a rows array and service object
dashboard = {
  rows : [],
  services : {}
};

// Set a title
dashboard.title = 'Logstash Search';

// Allow the user to set the index, if they dont, fall back to logstash.
if(!_.isUndefined(ARGS.index)) {
  dashboard.index = {
    default: ARGS.index,
    interval: 'none'
  };
} else {
  // Don't fail to default
  dashboard.failover = false;
  dashboard.index = {
    default: ARGS.index||'ADD_A_TIME_FILTER',
    pattern: ARGS.pattern||'[logstash-]YYYY.MM.DD',
    interval: ARGS.interval||'day'
  };
}

// In this dashboard we let users pass queries as comma seperated list to the query parameter.
// Or they can specify a split character using the split aparameter
// If query is defined, split it into a list of query objects
// NOTE: ids must be integers, hence the parseInt()s
if(!_.isUndefined(ARGS.query)) {
  queries = _.object(_.map(ARGS.query.split(ARGS.split||','), function(v,k) {
    return [k,{
      query: v,
      id: parseInt(k,10),
      alias: v
    }];
  }));
} else {
  // No queries passed? Initialize a single query to match everything
  queries = {
    0: {
      query: '*',
      id: 0,
    }
  };
}

// Now populate the query service with our objects
dashboard.services.query = {
  list : queries,
  ids : _.map(_.keys(queries),function(v){return parseInt(v,10);})
};

// Lets also add a default time filter, the value of which can be specified by the user
dashboard.services.filter = {
  list: {
    0: {
      from: "now-"+(ARGS.from||_d_timespan),
      to: "now",
      field: ARGS.timefield||"@timestamp",
      type: "time",
      active: true,
      id: 0,
    }
  },
  ids: [0]
};

// Ok, lets make some rows. The Filters row is collapsed by default
dashboard.rows = [
  {
    title: "Chart",
    height: "300px"
  },
  {
    title: "Events",
    height: "400px"
  }
];

// And a histogram that allows the user to specify the interval and time field
dashboard.rows[0].panels = [
  {
    title: 'events over time',
    type: 'histogram',
    time_field: ARGS.timefield||"@timestamp",
    auto_int: true,
    span: 12
  }
];

// And a table row where you can specify field and sort order
dashboard.rows[1].panels = [
  {
    title: 'all events',
    type: 'table',
    fields: !_.isUndefined(ARGS.fields) ? ARGS.fields.split(',') : [],
    sort: !_.isUndefined(ARGS.sort) ? ARGS.sort.split(',') : [ARGS.timefield||'@timestamp','desc'],
    overflow: 'expand',
    span: 12
  }
];

// Now return the object and we're good!
return dashboard;
