define(['jquery','underscore','moment'],
function($, _, moment) {
  'use strict';

  var kbn = {};

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

  kbn.secondsToHms = function(seconds) {
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
    for (var i = 0; i < mathString.length;) {
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

  kbn.query_color_dot = function (color, diameter) {
    return '<div class="icon-circle" style="' + [
      'display:inline-block',
      'color:' + color,
      'font-size:' + diameter + 'px',
    ].join(';') + '"></div>';
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
      ext = " KiB";
      break;
    case 2:
      ext = " MiB";
      break;
    case 3:
      ext = " GiB";
      break;
    case 4:
      ext = " TiB";
      break;
    case 5:
      ext = " PiB";
      break;
    case 6:
      ext = " EiB";
      break;
    case 7:
      ext = " ZiB";
      break;
    case 8:
      ext = " YiB";
      break;
    }

    return (size.toFixed(decimals) + ext);
  };

  kbn.bitFormat = function(size, decimals) {
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
      ext = " b";
      break;
    case 1:
      ext = " Kib";
      break;
    case 2:
      ext = " Mib";
      break;
    case 3:
      ext = " Gib";
      break;
    case 4:
      ext = " Tib";
      break;
    case 5:
      ext = " Pib";
      break;
    case 6:
      ext = " Eib";
      break;
    case 7:
      ext = " Zib";
      break;
    case 8:
      ext = " Yib";
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

  kbn.getFormatFunction = function(formatName, decimals) {
    switch(formatName) {
    case 'short':
      return function(val) {
        return kbn.shortFormat(val, decimals);
      };
    case 'bytes':
      return function(val) {
        return kbn.byteFormat(val, decimals);
      };
    case 'bits':
      return function(val) {
        return kbn.bitFormat(val, decimals);
      };
    case 's':
      return function(val) {
        return kbn.sFormat(val, decimals);
      };
    case 'ms':
      return function(val) {
        return kbn.msFormat(val, decimals);
      };
    case 'µs':
      return function(val) {
        return kbn.microsFormat(val, decimals);
      };
    case 'ns':
      return function(val) {
        return kbn.nanosFormat(val, decimals);
      };
    default:
      return function(val) {
        return val % 1 === 0 ? val : val.toFixed(decimals);
      };
    }
  };

  kbn.msFormat = function(size, decimals) {
    if (size < 1000) {
      return size.toFixed(0) + " ms";
    }
    // Less than 1 min
    else if (size < 60000) {
      return (size / 1000).toFixed(decimals) + " s";
    }
    // Less than 1 hour, devide in minutes
    else if (size < 3600000) {
      return (size / 60000).toFixed(decimals) + " min";
    }
    // Less than one day, devide in hours
    else if (size < 86400000) {
      return (size / 3600000).toFixed(decimals) + " hour";
    }
    // Less than one year, devide in days
    else if (size < 31536000000) {
      return (size / 86400000).toFixed(decimals) + " day";
    }

    return (size / 31536000000).toFixed(decimals) + " year";
  };

  kbn.sFormat = function(size, decimals) {
    // Less than 10 min, use seconds
    if (size < 600) {
      return size.toFixed(decimals) + " s";
    }
    // Less than 1 hour, devide in minutes
    else if (size < 3600) {
      return (size / 60).toFixed(decimals) + " min";
    }
    // Less than one day, devide in hours
    else if (size < 86400) {
      return (size / 3600).toFixed(decimals) + " hour";
    }
    // Less than one week, devide in days
    else if (size < 604800) {
      return (size / 86400).toFixed(decimals) + " day";
    }
    // Less than one year, devide in week
    else if (size < 31536000) {
      return (size / 604800).toFixed(decimals) + " week";
    }

    return (size / 3.15569e7).toFixed(decimals) + " year";
  };

  kbn.microsFormat = function(size, decimals) {
    if (size < 1000) {
      return size.toFixed(0) + " µs";
    }
    else if (size < 1000000) {
      return (size / 1000).toFixed(decimals) + " ms";
    }
    else {
      return (size / 1000000).toFixed(decimals) + " s";
    }
  };

  kbn.nanosFormat = function(size, decimals) {
    if (size < 1000) {
      return size.toFixed(0) + " ns";
    }
    else if (size < 1000000) {
      return (size / 1000).toFixed(decimals) + " µs";
    }
    else if (size < 1000000000) {
      return (size / 1000000).toFixed(decimals) + " ms";
    }
    else if (size < 60000000000){
      return (size / 1000000000).toFixed(decimals) + " s";
    }
    else {
      return (size / 60000000000).toFixed(decimals) + " m";
    }
  };

  return kbn;
});
