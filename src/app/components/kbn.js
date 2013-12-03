define(['jquery','underscore','moment','chromath'],
function($, _, moment) {
  'use strict';

  var kbn = {};

  kbn.get_object_fields = function(obj) {
    var field_array = [];
    obj = kbn.flatten_json(obj._source);
    for (var field in obj) {
      field_array.push(field);
    }
    return field_array.sort();
  };

  kbn.get_all_fields = function(data,flat) {
    return _.uniq(_.without(_.reduce(data,function(memo,hit) {
      return flat ? memo.concat(_.keys(kbn.flatten_json(hit._source))) : memo.concat(_.keys(hit._source));
    },[]),'$$hashkey'));
  };

  kbn.has_field = function(obj,field) {
    var obj_fields = kbn.get_object_fields(obj);
    if (_.inArray(obj_fields,field) < 0) {
      return false;
    } else {
      return true;
    }
  };

  kbn.get_related_fields = function(docs,field) {
    var field_array = [];
    _.each(docs, function(doc) {
      var keys = _.keys(doc);
      if(_.contains(keys,field)) {
        field_array = field_array.concat(keys);
      }
    });
    var counts = _.countBy(_.without(field_array,field),function(field){return field;});
    return _.map(counts, function(num, key){return {name:key,count:num};});
  };

  kbn.recurse_field_dots = function(object,field) {
    var value = null;
    var nested;
    if (typeof object[field] !== 'undefined') {
      value = object[field];
    }
    else if (nested = field.match(/(.*?)\.(.*)/)) {
      if(typeof object[nested[1]] !== 'undefined') {
        value = (typeof object[nested[1]][nested[2]] !== 'undefined') ?
          object[nested[1]][nested[2]] : kbn.recurse_field_dots(
            object[nested[1]],nested[2]);
      }
    }

    return value;
  };

  kbn.top_field_values = function(docs,field,count,grouped) {
    var all_values = _.pluck(docs,field),
      groups = {},
      counts,
      hasArrays;
    // manually grouping into pairs allows us to keep the original value,
    _.each(all_values, function (value) {
      var k;
      if(_.isArray(value)) {
        hasArrays =  true;
      }
      if(_.isArray(value) && !grouped) {
        k = value;
      } else {
        k = _.isUndefined(value) ? '' : [value.toString()];
      }
      _.each(k, function(key) {
        if (_.has(groups, key)) {
          groups[key][1] ++;
        } else {
          groups[key] = [(grouped ? value : key), 1];
        }
      });
    });

    counts = _.values(groups).sort(function(a, b) {
      return a[1] - b[1];
    }).reverse().slice(0,count);

    return {
      counts: counts,
      hasArrays : hasArrays
    };
  };

   /**
     * Calculate a graph interval
     *
     * from::           Date object containing the start time
     * to::             Date object containing the finish time
     * size::           Calculate to approximately this many bars
     * user_interval::  User specified histogram interval
     *
     */
  kbn.calculate_interval = function(from,to,size,user_interval) {
    if(_.isObject(from)) {
      from = from.valueOf();
    }
    if(_.isObject(to)) {
      to = to.valueOf();
    }
    return user_interval === 0 ? kbn.round_interval((to - from)/size) : user_interval;
  };

  kbn.round_interval = function(interval) {
    switch (true) {
    // 0.5s
    case (interval <= 500):
      return 100;       // 0.1s
    // 5s
    case (interval <= 5000):
      return 1000;      // 1s
    // 7.5s
    case (interval <= 7500):
      return 5000;      // 5s
    // 15s
    case (interval <= 15000):
      return 10000;     // 10s
    // 45s
    case (interval <= 45000):
      return 30000;     // 30s
    // 3m
    case (interval <= 180000):
      return 60000;     // 1m
    // 9m
    case (interval <= 450000):
      return 300000;    // 5m
    // 20m
    case (interval <= 1200000):
      return 600000;    // 10m
    // 45m
    case (interval <= 2700000):
      return 1800000;   // 30m
    // 2h
    case (interval <= 7200000):
      return 3600000;   // 1h
    // 6h
    case (interval <= 21600000):
      return 10800000;  // 3h
    // 24h
    case (interval <= 86400000):
      return 43200000;  // 12h
    // 48h
    case (interval <= 172800000):
      return 86400000;  // 24h
    // 1w
    case (interval <= 604800000):
      return 86400000;  // 24h
    // 3w
    case (interval <= 1814400000):
      return 604800000; // 1w
    // 2y
    case (interval < 3628800000):
      return 2592000000; // 30d
    default:
      return 31536000000; // 1y
    }
  };

  kbn.secondsToHms = function(seconds){
    var numyears = Math.floor(seconds / 31536000);
    if(numyears){
      return numyears + 'y';
    }
    var numdays = Math.floor((seconds % 31536000) / 86400);
    if(numdays){
      return numdays + 'd';
    }
    var numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
    if(numhours){
      return numhours + 'h';
    }
    var numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    if(numminutes){
      return numminutes + 'm';
    }
    var numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;
    if(numseconds){
      return numseconds + 's';
    }
    return 'less then a second'; //'just now' //or other string you like;
  };

  kbn.to_percent = function(number,outof) {
    return Math.floor((number/outof)*10000)/100 + "%";
  };

  kbn.addslashes = function(str) {
    str = str.replace(/\\/g, '\\\\');
    str = str.replace(/\'/g, '\\\'');
    str = str.replace(/\"/g, '\\"');
    str = str.replace(/\0/g, '\\0');
    return str;
  };

  kbn.interval_regex = /(\d+(?:\.\d+)?)([Mwdhmsy])/;

  // histogram & trends
  kbn.intervals_in_seconds = {
    y: 31536000,
    M: 2592000,
    w: 604800,
    d: 86400,
    h: 3600,
    m: 60,
    s: 1
  };

  kbn.describe_interval = function (string) {
    var matches = string.match(kbn.interval_regex);
    if (!matches || !_.has(kbn.intervals_in_seconds, matches[2])) {
      throw new Error('Invalid interval string, expexcting a number followed by one of "Mwdhmsy"');
    } else {
      return {
        sec: kbn.intervals_in_seconds[matches[2]],
        type: matches[2],
        count: parseInt(matches[1], 10)
      };
    }
  };

  kbn.interval_to_ms = function(string) {
    var info = kbn.describe_interval(string);
    return info.sec * 1000 * info.count;
  };

  kbn.interval_to_seconds = function (string) {
    var info = kbn.describe_interval(string);
    return info.sec * info.count;
  };

  // This should go away, moment.js can do this
  kbn.time_ago = function(string) {
    return new Date(new Date().getTime() - (kbn.interval_to_ms(string)));
  };

  /* This is a simplified version of elasticsearch's date parser */
  kbn.parseDate = function(text) {
    if(_.isDate(text)) {
      return text;
    }
    var time,
      mathString = "",
      index,
      parseString;
    if (text.substring(0,3) === "now") {
      time = new Date();
      mathString = text.substring("now".length);
    } else {
      index = text.indexOf("||");
      parseString;
      if (index === -1) {
        parseString = text;
        mathString = ""; // nothing else
      } else {
        parseString = text.substring(0, index);
        mathString = text.substring(index + 2);
      }
      // We're going to just require ISO8601 timestamps, k?
      time = new Date(parseString);
    }

    if (!mathString.length) {
      return time;
    }

    //return [time,parseString,mathString];
    return kbn.parseDateMath(mathString, time);
  };

  kbn.parseDateMath = function(mathString, time, roundUp) {
    var dateTime = moment(time);
    for (var i = 0; i < mathString.length; ) {
      var c = mathString.charAt(i++),
        type,
        num,
        unit;
      if (c === '/') {
        type = 0;
      } else if (c === '+') {
        type = 1;
      } else if (c === '-') {
        type = 2;
      } else {
        return false;
      }

      if (isNaN(mathString.charAt(i))) {
        num = 1;
      } else {
        var numFrom = i;
        while (!isNaN(mathString.charAt(i))) {
          i++;
        }
        num = parseInt(mathString.substring(numFrom, i),10);
      }
      if (type === 0) {
        // rounding is only allowed on whole numbers
        if (num !== 1) {
          return false;
        }
      }
      unit = mathString.charAt(i++);
      switch (unit) {
      case 'y':
        if (type === 0) {
          roundUp ? dateTime.endOf('year') : dateTime.startOf('year');
        } else if (type === 1) {
          dateTime.add('years',num);
        } else if (type === 2) {
          dateTime.subtract('years',num);
        }
        break;
      case 'M':
        if (type === 0) {
          roundUp ? dateTime.endOf('month') : dateTime.startOf('month');
        } else if (type === 1) {
          dateTime.add('months',num);
        } else if (type === 2) {
          dateTime.subtract('months',num);
        }
        break;
      case 'w':
        if (type === 0) {
          roundUp ? dateTime.endOf('week') : dateTime.startOf('week');
        } else if (type === 1) {
          dateTime.add('weeks',num);
        } else if (type === 2) {
          dateTime.subtract('weeks',num);
        }
        break;
      case 'd':
        if (type === 0) {
          roundUp ? dateTime.endOf('day') : dateTime.startOf('day');
        } else if (type === 1) {
          dateTime.add('days',num);
        } else if (type === 2) {
          dateTime.subtract('days',num);
        }
        break;
      case 'h':
      case 'H':
        if (type === 0) {
          roundUp ? dateTime.endOf('hour') : dateTime.startOf('hour');
        } else if (type === 1) {
          dateTime.add('hours',num);
        } else if (type === 2) {
          dateTime.subtract('hours',num);
        }
        break;
      case 'm':
        if (type === 0) {
          roundUp ? dateTime.endOf('minute') : dateTime.startOf('minute');
        } else if (type === 1) {
          dateTime.add('minutes',num);
        } else if (type === 2) {
          dateTime.subtract('minutes',num);
        }
        break;
      case 's':
        if (type === 0) {
          roundUp ? dateTime.endOf('second') : dateTime.startOf('second');
        } else if (type === 1) {
          dateTime.add('seconds',num);
        } else if (type === 2) {
          dateTime.subtract('seconds',num);
        }
        break;
      default:
        return false;
      }
    }
    return dateTime.toDate();
  };

  // LOL. hahahahaha. DIE.
  kbn.flatten_json = function(object,root,array) {
    if (typeof array === 'undefined') {
      array = {};
    }
    if (typeof root === 'undefined') {
      root = '';
    }
    for(var index in object) {
      var obj = object[index];
      var rootname = root.length === 0 ? index : root + '.' + index;
      if(typeof obj === 'object' ) {
        if(_.isArray(obj)) {
          if(obj.length > 0 && typeof obj[0] === 'object') {
            var strval = '';
            for (var objidx = 0, objlen = obj.length; objidx < objlen; objidx++) {
              if (objidx > 0) {
                strval = strval + ', ';
              }

              strval = strval + JSON.stringify(obj[objidx]);
            }
            array[rootname] = strval;
          } else if(obj.length === 1 && _.isNumber(obj[0])) {
            array[rootname] = parseFloat(obj[0]);
          } else {
            array[rootname] = typeof obj === 'undefined' ? null : obj;
          }
        } else {
          kbn.flatten_json(obj,rootname,array);
        }
      } else {
        array[rootname] = typeof obj === 'undefined' ? null : obj;
      }
    }
    return kbn.sortObj(array);
  };

  kbn.xmlEnt = function(value) {
    if(_.isString(value)) {
      var stg1 = value.replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r\n/g, '<br/>')
        .replace(/\r/g, '<br/>')
        .replace(/\n/g, '<br/>')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace(/  /g, '&nbsp;&nbsp;')
        .replace(/&lt;del&gt;/g, '<del>')
        .replace(/&lt;\/del&gt;/g, '</del>');
      return stg1;
    } else {
      return value;
    }
  };

  kbn.sortObj = function(arr) {
    // Setup Arrays
    var sortedKeys = [];
    var sortedObj = {};
    var i;
    // Separate keys and sort them
    for (i in arr) {
      sortedKeys.push(i);
    }
    sortedKeys.sort();

    // Reconstruct sorted obj based on keys
    for (i in sortedKeys) {
      sortedObj[sortedKeys[i]] = arr[sortedKeys[i]];
    }
    return sortedObj;
  };

  kbn.query_color_dot = function (color, diameter) {
    return '<div class="icon-circle" style="' + [
        'display:inline-block',
        'color:' + color,
        'font-size:' + diameter + 'px',
      ].join(';') + '"></div>';
  };

  kbn.colorSteps = function(col,steps) {

    var _d = steps > 5 ? 1.6/steps : 0.25, // distance between steps
      _p = []; // adjustment percentage

    // Create a range of numbers between -0.8 and 0.8
    for(var i = 1; i<steps+1; i+=1) {
      _p.push(i%2 ? ((i-1)*_d*-1)/2 : i*_d/2);
    }

    // Create the color range
    return _.map(_p.sort(function(a,b){return a-b;}),function(v) {
      return v<0 ? Chromath.darken(col,v*-1).toString() : Chromath.lighten(col,v).toString();
    });
  };

  // Find the smallest missing number in an array
  kbn.smallestMissing = function(arr,start,end) {
    start = start || 0;
    end = end || arr.length-1;

    if(start > end) {
      return end + 1;
    }
    if(start !== arr[start]) {
      return start;
    }
    var middle = Math.floor((start + end) / 2);

    if (arr[middle] > middle) {
      return kbn.smallestMissing(arr, start, middle);
    } else {
      return kbn.smallestMissing(arr, middle + 1, end);
    }
  };

  kbn.byteFormat = function(size, decimals) {
    var ext, steps = 0;

    if(_.isUndefined(decimals)) {
      decimals = 2;
    } else if (decimals === 0) {
      decimals = undefined;
    }

    while (Math.abs(size) >= 1024) {
      steps++;
      size /= 1024;
    }

    switch (steps) {
    case 0:
      ext = " B";
      break;
    case 1:
      ext = " KB";
      break;
    case 2:
      ext = " MB";
      break;
    case 3:
      ext = " GB";
      break;
    case 4:
      ext = " TB";
      break;
    case 5:
      ext = " PB";
      break;
    case 6:
      ext = " EB";
      break;
    case 7:
      ext = " ZB";
      break;
    case 8:
      ext = " YB";
      break;
    }

    return (size.toFixed(decimals) + ext);
  };

  kbn.shortFormat = function(size, decimals) {
    var ext, steps = 0;

    if(_.isUndefined(decimals)) {
      decimals = 2;
    } else if (decimals === 0) {
      decimals = undefined;
    }

    while (Math.abs(size) >= 1000) {
      steps++;
      size /= 1000;
    }

    switch (steps) {
    case 0:
      ext = "";
      break;
    case 1:
      ext = " K";
      break;
    case 2:
      ext = " Mil";
      break;
    case 3:
      ext = " Bil";
      break;
    case 4:
      ext = " Tri";
      break;
    case 5:
      ext = " Quadr";
      break;
    case 6:
      ext = " Quint";
      break;
    case 7:
      ext = " Sext";
      break;
    case 8:
      ext = " Sept";
      break;
    }

    return (size.toFixed(decimals) + ext);
  };

  return kbn;
});