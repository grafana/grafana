/*! elastic.js - v1.0.0 - 2013-04-04
* https://github.com/fullscale/elastic.js
* Copyright (c) 2013 FullScale Labs, LLC; Licensed MIT */

/**
 @namespace
 @name ejs
 @desc All elastic.js modules are organized under the ejs namespace.
 */
(function () {
  'use strict';

  var 

    // save reference to global object
    // `window` in browser
    // `exports` on server
    root = this,
    
    // save the previous version of ejs
    _ejs = root && root.ejs,

    // from underscore.js, used in utils
    ArrayProto = Array.prototype, 
    ObjProto = Object.prototype, 
    slice = ArrayProto.slice,
    toString = ObjProto.toString,
    hasOwnProp = ObjProto.hasOwnProperty,
    nativeForEach = ArrayProto.forEach,
    nativeIsArray = Array.isArray,
    breaker = {},
    has,
    each,
    extend,
    isArray,
    isObject,
    isString,
    isNumber,
    isFunction,
    isEJSObject, // checks if valid ejs object
    isQuery, // checks valid ejs Query object
    isFilter, // checks valid ejs Filter object
    isFacet, // checks valid ejs Facet object
    isScriptField, // checks valid ejs ScriptField object
    isGeoPoint, // checks valid ejs GeoPoint object
    isIndexedShape, // checks valid ejs IndexedShape object
    isShape, // checks valid ejs Shape object
    isSort, // checks valid ejs Sort object
    isHighlight, // checks valid ejs Highlight object
    isSuggest, // checks valid ejs Suggest object
    isGenerator, // checks valid ejs Generator object
    
    // create ejs object
    ejs;
    
  if (typeof exports !== 'undefined') {
    ejs = exports;
  } else {
    ejs = root.ejs = {};
  }

  /* Utility methods, most of which are pulled from underscore.js. */
  
  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  has = function (obj, key) {
    return hasOwnProp.call(obj, key);
  };
    
  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  each = function (obj, iterator, context) {
    if (obj == null) {
      return;
    }
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, l = obj.length; i < l; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) {
          return;
        }
      }
    } else {
      for (var key in obj) {
        if (has(obj, key)) {
          if (iterator.call(context, obj[key], key, obj) === breaker) {
            return;
          }
        }
      }
    }
  };
      
  // Extend a given object with all the properties in passed-in object(s).
  extend = function (obj) {
    each(slice.call(arguments, 1), function (source) {
      for (var prop in source) {
        obj[prop] = source[prop];
      }
    });
    return obj;
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  // switched to ===, not sure why underscore used ==
  isArray = nativeIsArray || function (obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  isObject = function (obj) {
    return obj === Object(obj);
  };
  
  // switched to ===, not sure why underscore used ==
  isString = function (obj) {
    return toString.call(obj) === '[object String]';
  };
  
  // switched to ===, not sure why underscore used ==
  isNumber = function (obj) {
    return toString.call(obj) === '[object Number]';
  };
  
  // switched to ===, not sure why underscore used ==
  if (typeof (/./) !== 'function') {
    isFunction = function (obj) {
      return typeof obj === 'function';
    };
  } else {
    isFunction = function (obj) {
      return toString.call(obj) === '[object Function]';
    };
  }
  
  // Is a given value an ejs object?
  // Yes if object and has "_type", "_self", and "toString" properties
  isEJSObject = function (obj) {
    return (isObject(obj) &&
      has(obj, '_type') &&
      has(obj, '_self') && 
      has(obj, 'toString'));
  };
  
  isQuery = function (obj) {
    return (isEJSObject(obj) && obj._type() === 'query');
  };
  
  isFilter = function (obj) {
    return (isEJSObject(obj) && obj._type() === 'filter');
  };
  
  isFacet = function (obj) {
    return (isEJSObject(obj) && obj._type() === 'facet');
  };
  
  isScriptField = function (obj) {
    return (isEJSObject(obj) && obj._type() === 'script field');
  };
  
  isGeoPoint = function (obj) {
    return (isEJSObject(obj) && obj._type() === 'geo point');
  };
  
  isIndexedShape = function (obj) {
    return (isEJSObject(obj) && obj._type() === 'indexed shape');
  };
  
  isShape = function (obj) {
    return (isEJSObject(obj) && obj._type() === 'shape');
  };
  
  isSort = function (obj) {
    return (isEJSObject(obj) && obj._type() === 'sort');
  };
  
  isHighlight = function (obj) {
    return (isEJSObject(obj) && obj._type() === 'highlight');
  };
  
  isSuggest = function (obj) {
    return (isEJSObject(obj) && obj._type() === 'suggest');
  };
  
  isGenerator = function (obj) {
    return (isEJSObject(obj) && obj._type() === 'generator');
  };
  
  /**
    @class
    <p>The DateHistogram facet works with time-based values by building a histogram across time
       intervals of the <code>value</code> field. Each value is <em>rounded</em> into an interval (or
       placed in a bucket), and statistics are provided per interval/bucket (count and total).</p>

    <p>Facets are similar to SQL <code>GROUP BY</code> statements but perform much
       better. You can also construct several <em>"groups"</em> at once by simply
       specifying multiple facets.</p>

    <div class="alert-message block-message info">
        <p>
            <strong>Tip: </strong>
            For more information on faceted navigation, see
            <a href="http://en.wikipedia.org/wiki/Faceted_classification">this</a>
            Wikipedia article on Faceted Classification.
        </p>
    </div>

    @name ejs.DateHistogramFacet

    @desc
    <p>A facet which returns the N most frequent terms within a collection
       or set of collections.</p>

    @param {String} name The name which be used to refer to this facet. For instance,
        the facet itself might utilize a field named <code>doc_authors</code>. Setting
        <code>name</code> to <code>Authors</code> would allow you to refer to the
        facet by that name, possibly simplifying some of the display logic.

    */
  ejs.DateHistogramFacet = function (name) {

    /**
        The internal facet object.
        @member ejs.DateHistogramFacet
        @property {Object} facet
        */
    var facet = {};

    facet[name] = {
      date_histogram: {}
    };

    return {

      /**
            Sets the field to be used to construct the this facet.

            @member ejs.DateHistogramFacet
            @param {String} fieldName The field name whose data will be used to construct the facet.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (fieldName) {
        if (fieldName == null) {
          return facet[name].date_histogram.field;
        }
      
        facet[name].date_histogram.field = fieldName;
        return this;
      },

      /**
            Allows you to specify a different key field to be used to group intervals.

            @member ejs.DateHistogramFacet
            @param {String} fieldName The name of the field to be used.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      keyField: function (fieldName) {
        if (fieldName == null) {
          return facet[name].date_histogram.key_field;
        }
      
        facet[name].date_histogram.key_field = fieldName;
        return this;
      },
      
      /**
            Allows you to specify a different value field to aggrerate over.

            @member ejs.DateHistogramFacet
            @param {String} fieldName The name of the field to be used.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      valueField: function (fieldName) {
        if (fieldName == null) {
          return facet[name].date_histogram.value_field;
        }
      
        facet[name].date_histogram.value_field = fieldName;
        return this;
      },
      
      /**
            Sets the bucket interval used to calculate the distribution.

            @member ejs.DateHistogramFacet
            @param {String} timeInterval The bucket interval. Valid values are <code>year, month, week, day, hour,</code> and <code>minute</code>.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      interval: function (timeInterval) {
        if (timeInterval == null) {
          return facet[name].date_histogram.interval;
        }
      
        facet[name].date_histogram.interval = timeInterval;
        return this;
      },

      /**
            <p>By default, time values are stored in UTC format.<p> 

            <p>This method allows users to set a time zone value that is then used 
            to compute intervals before rounding on the interval value. Equalivent to 
            <coe>preZone</code>.  Use <code>preZone</code> if possible. The 
            value is an offset from UTC.<p>
            
            <p>For example, to use EST you would set the value to <code>-5</code>.</p>

            @member ejs.DateHistogramFacet
            @param {Integer} tz An offset value from UTC.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      timeZone: function (tz) {
        if (tz == null) {
          return facet[name].date_histogram.time_zone;
        }
      
        facet[name].date_histogram.time_zone = tz;
        return this;
      },

      /**
            <p>By default, time values are stored in UTC format.<p> 

            <p>This method allows users to set a time zone value that is then used to 
            compute intervals before rounding on the interval value.  The value is an 
            offset from UTC.<p>
            
            <p>For example, to use EST you would set the value to <code>-5</code>.</p>

            @member ejs.DateHistogramFacet
            @param {Integer} tz An offset value from UTC.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      preZone: function (tz) {
        if (tz == null) {
          return facet[name].date_histogram.pre_zone;
        }
      
        facet[name].date_histogram.pre_zone = tz;
        return this;
      },
      
      /**
            <p>Enables large date interval conversions (day and up).</p>  

            <p>Set to true to enable and then set the <code>interval</code> to an 
            interval greater than a day.</p>
            
            @member ejs.DateHistogramFacet
            @param {Boolean} trueFalse A valid boolean value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      preZoneAdjustLargeInterval: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].date_histogram.pre_zone_adjust_large_interval;
        }
      
        facet[name].date_histogram.pre_zone_adjust_large_interval = trueFalse;
        return this;
      },
      
      /**
            <p>By default, time values are stored in UTC format.<p> 

            <p>This method allows users to set a time zone value that is then used to compute 
            intervals after rounding on the interval value.  The value is an offset from UTC.  
            The tz offset value is simply added to the resulting bucket's date value.<p>
            
            <p>For example, to use EST you would set the value to <code>-5</code>.</p>

            @member ejs.DateHistogramFacet
            @param {Integer} tz An offset value from UTC.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      postZone: function (tz) {
        if (tz == null) {
          return facet[name].date_histogram.post_zone;
        }
      
        facet[name].date_histogram.post_zone = tz;
        return this;
      },

      /**
            Set's a specific pre-rounding offset.  Format is 1d, 1h, etc.

            @member ejs.DateHistogramFacet
            @param {String} offset The offset as a string (1d, 1h, etc)
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      preOffset: function (offset) {
        if (offset == null) {
          return facet[name].date_histogram.pre_offset;
        }
      
        facet[name].date_histogram.pre_offset = offset;
        return this;
      },
      
      /**
            Set's a specific post-rounding offset.  Format is 1d, 1h, etc.

            @member ejs.DateHistogramFacet
            @param {String} offset The offset as a string (1d, 1h, etc)
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      postOffset: function (offset) {
        if (offset == null) {
          return facet[name].date_histogram.post_offset;
        }
      
        facet[name].date_histogram.post_offset = offset;
        return this;
      },
      
      /**
            <p>The date histogram works on numeric values (since time is stored 
            in milliseconds since the epoch in UTC).<p> 

            <p>But, sometimes, systems will store a different resolution (like seconds since UTC) 
            in a numeric field. The factor parameter can be used to change the value in the field 
            to milliseconds to actual do the relevant rounding, and then be applied again to get to 
            the original unit.</p>

            <p>For example, when storing in a numeric field seconds resolution, 
            the factor can be set to 1000.<p>

            @member ejs.DateHistogramFacet
            @param {Integer} f The conversion factor.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      factor: function (f) {
        if (f == null) {
          return facet[name].date_histogram.factor;
        }
      
        facet[name].date_histogram.factor = f;
        return this;
      },
      
      /**
            Allows you modify the <code>value</code> field using a script. The modified value
            is then used to compute the statistical data.

            @member ejs.DateHistogramFacet
            @param {String} scriptCode A valid script string to execute.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      valueScript: function (scriptCode) {
        if (scriptCode == null) {
          return facet[name].date_histogram.value_script;
        }
      
        facet[name].date_histogram.value_script = scriptCode;
        return this;
      },

      /**
            <p>Sets the type of ordering that will be performed on the date
            buckets.  Valid values are:<p>
            
            <dl>
                <dd><code>time</code> - the default, sort by the buckets start time in milliseconds.</dd>
                <dd><code>count</code> - sort by the number of items in the bucket</dd>
                <dd><code>total</code> - sort by the sum/total of the items in the bucket</dd>
            <dl>
            
            @member ejs.DateHistogramFacet
            @param {String} o The ordering method: time, count, or total.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      order: function (o) {
        if (o == null) {
          return facet[name].date_histogram.order;
        }
      
        o = o.toLowerCase();
        if (o === 'time' || o === 'count' || o === 'total') {
          facet[name].date_histogram.order = o;
        }
        
        return this;
      },
      
      /**
            The script language being used. Currently supported values are
            <code>javascript</code>, <code>groovy</code>, and <code>mvel</code>.

            @member ejs.DateHistogramFacet
            @param {String} language The language of the script.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lang: function (language) {
        if (language == null) {
          return facet[name].date_histogram.lang;
        }
      
        facet[name].date_histogram.lang = language;
        return this;
      },

      /**
            Sets parameters that will be applied to the script.  Overwrites 
            any existing params.

            @member ejs.DateHistogramFacet
            @param {Object} p An object where the keys are the parameter name and 
              values are the parameter value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      params: function (p) {
        if (p == null) {
          return facet[name].date_histogram.params;
        }
    
        facet[name].date_histogram.params = p;
        return this;
      },
      
      /**
            <p>Allows you to reduce the documents used for computing facet results.</p>

            @member ejs.DateHistogramFacet
            @param {Object} oFilter A valid <code>Filter</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      facetFilter: function (oFilter) {
        if (oFilter == null) {
          return facet[name].facet_filter;
        }
      
        if (!isFilter(oFilter)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        facet[name].facet_filter = oFilter._self();
        return this;
      },

      /**
            <p>Computes values across the entire index</p>

            @member ejs.DateHistogramFacet
            @param {Boolean} trueFalse Calculate facet counts globally or not.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      global: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].global;
        }
        
        facet[name].global = trueFalse;
        return this;
      },

      /**
            <p>Sets the mode the facet will use.<p>
            
            <dl>
                <dd><code>collector</code></dd>
                <dd><code>post</code></dd>
            <dl>
            
            @member ejs.DateHistogramFacet
            @param {String} m The mode: collector or post.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      mode: function (m) {
        if (m == null) {
          return facet[name].mode;
        }
      
        m = m.toLowerCase();
        if (m === 'collector' || m === 'post') {
          facet[name].mode = m;
        }
        
        return this;
      },
            
      /**
            <p>Computes values across the the specified scope</p>

            @deprecated since elasticsearch 0.90
            @member ejs.DateHistogramFacet
            @param {String} scope The scope name to calculate facet counts with.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (scope) {
        return this;
      },
      
      /**
            <p>Enables caching of the <code>facetFilter</code></p>

            @member ejs.DateHistogramFacet
            @param {Boolean} trueFalse If the facetFilter should be cached or not
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheFilter: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].cache_filter;
        }
        
        facet[name].cache_filter = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the path to the nested document if faceting against a
            nested field.</p>

            @member ejs.DateHistogramFacet
            @param {String} path The nested path
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      nested: function (path) {
        if (path == null) {
          return facet[name].nested;
        }
        
        facet[name].nested = path;
        return this;
      },
      
      /**
            <p>Allows you to serialize this object into a JSON encoded string.</p>

            @member ejs.DateHistogramFacet
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(facet);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.DateHistogramFacet
            @returns {String} the type of object
            */
      _type: function () {
        return 'facet';
      },
      
      /**
            <p>Retrieves the internal <code>facet</code> object. This is typically used by
               internal API functions so use with caution.</p>

            @member ejs.DateHistogramFacet
            @returns {String} returns this object's internal <code>facet</code> property.
            */
      _self: function () {
        return facet;
      }
    };
  };

  /**
    @class
    <p>The FilterFacet allows you to specify any valid <code>Filter</code> and
    have the number of matching hits returned as the value.</p>

    <p>Facets are similar to SQL <code>GROUP BY</code> statements but perform much
       better. You can also construct several <em>"groups"</em> at once by simply
       specifying multiple facets.</p>

    <div class="alert-message block-message info">
        <p>
            <strong>Tip: </strong>
            For more information on faceted navigation, see
            <a href="http://en.wikipedia.org/wiki/Faceted_classification">this</a>
            Wikipedia article on Faceted Classification.
        </p>
    </div>

    @name ejs.FilterFacet

    @desc
    <p>A facet that return a count of the hits matching the given filter.</p>

    @param {String} name The name which be used to refer to this facet. For instance,
        the facet itself might utilize a field named <code>doc_authors</code>. Setting
        <code>name</code> to <code>Authors</code> would allow you to refer to the
        facet by that name, possibly simplifying some of the display logic.

    */
  ejs.FilterFacet = function (name) {

    /**
        The internal facet object.
        @member ejs.FilterFacet
        @property {Object} facet
        */
    var facet = {};
    facet[name] = {};

    return {

      /**
            <p>Sets the filter to be used for this facet.</p>

            @member ejs.FilterFacet
            @param {Object} oFilter A valid <code>Query</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      filter: function (oFilter) {
        if (oFilter == null) {
          return facet[name].filter;
        }
      
        if (!isFilter(oFilter)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        facet[name].filter = oFilter._self();
        return this;
      },

      /**
            <p>Allows you to reduce the documents used for computing facet results.</p>

            @member ejs.FilterFacet
            @param {Object} oFilter A valid <code>Filter</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      facetFilter: function (oFilter) {
        if (oFilter == null) {
          return facet[name].facet_filter;
        }
      
        if (!isFilter(oFilter)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        facet[name].facet_filter = oFilter._self();
        return this;
      },

      /**
            <p>Computes values across the entire index</p>

            @member ejs.FilterFacet
            @param {Boolean} trueFalse Calculate facet counts globally or not.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      global: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].global;
        }
        
        facet[name].global = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the mode the facet will use.<p>
            
            <dl>
                <dd><code>collector</code></dd>
                <dd><code>post</code></dd>
            <dl>
            
            @member ejs.FilterFacet
            @param {String} m The mode: collector or post.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      mode: function (m) {
        if (m == null) {
          return facet[name].mode;
        }
      
        m = m.toLowerCase();
        if (m === 'collector' || m === 'post') {
          facet[name].mode = m;
        }
        
        return this;
      },
      
      /**
            <p>Computes values across the the specified scope</p>

            @deprecated since elasticsearch 0.90
            @member ejs.FilterFacet
            @param {String} scope The scope name to calculate facet counts with.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (scope) {
        return this;
      },
      
      /**
            <p>Enables caching of the <code>facetFilter</code></p>

            @member ejs.FilterFacet
            @param {Boolean} trueFalse If the facetFilter should be cached or not
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheFilter: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].cache_filter;
        }
        
        facet[name].cache_filter = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the path to the nested document if faceting against a
            nested field.</p>

            @member ejs.FilterFacet
            @param {String} path The nested path
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      nested: function (path) {
        if (path == null) {
          return facet[name].nested;
        }
        
        facet[name].nested = path;
        return this;
      },
      
      /**
            <p>Allows you to serialize this object into a JSON encoded string.</p>

            @member ejs.FilterFacet
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(facet);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.FilterFacet
            @returns {String} the type of object
            */
      _type: function () {
        return 'facet';
      },
      
      /**
            <p>Retrieves the internal <code>facet</code> object. This is typically used by
               internal API functions so use with caution.</p>

            @member ejs.FilterFacet
            @returns {String} returns this object's internal <code>facet</code> property.
            */
      _self: function () {
        return facet;
      }
    };
  };

  /**
    @class
    <p>The geoDistanceFacet facet provides information over a range of distances from a
    provided point. This includes the number of hits that fall within each range,
    along with aggregate information (like total).</p>

    <p>Facets are similar to SQL <code>GROUP BY</code> statements but perform much
       better. You can also construct several <em>"groups"</em> at once by simply
       specifying multiple facets.</p>

    <div class="alert-message block-message info">
        <p>
            <strong>Tip: </strong>
            For more information on faceted navigation, see
            <a href="http://en.wikipedia.org/wiki/Faceted_classification">this</a>
            Wikipedia article on Faceted Classification.
        </p>
    </div>

    @name ejs.GeoDistanceFacet

    @desc
    <p>A facet which provides information over a range of distances from a provided point.</p>

    @param {String} name The name which be used to refer to this facet. For instance,
        the facet itself might utilize a field named <code>doc_authors</code>. Setting
        <code>name</code> to <code>Authors</code> would allow you to refer to the
        facet by that name, possibly simplifying some of the display logic.

    */
  ejs.GeoDistanceFacet = function (name) {

    /**
        The internal facet object.
        @member ejs.GeoDistanceFacet
        @property {Object} facet
        */
    var facet = {},
        point = ejs.GeoPoint([0, 0]),
        field = 'location';

    facet[name] = {
      geo_distance: {
        location: point._self(),
        ranges: []
      }
    };

    return {

      /**
            Sets the document field containing the geo-coordinate to be used 
            to calculate the distance.  Defaults to "location".

            @member ejs.GeoDistanceFacet
            @param {String} fieldName The field name whose data will be used to construct the facet.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (fieldName) {
        var oldValue = facet[name].geo_distance[field];
        
        if (fieldName == null) {
          return field;
        }

        delete facet[name].geo_distance[field];
        field = fieldName;
        facet[name].geo_distance[fieldName] = oldValue;
        
        return this;
      },

      /**
            Sets the point of origin from where distances will be measured.

            @member ejs.GeoDistanceFacet
            @param {GeoPoint} p A valid GeoPoint object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      point: function (p) {
        if (p == null) {
          return point;
        }
      
        if (!isGeoPoint(p)) {
          throw new TypeError('Argument must be a GeoPoint');
        }
        
        point = p;
        facet[name].geo_distance[field] = p._self();
        return this;
      },

      /**
            Adds a new bounded range.

            @member ejs.GeoDistanceFacet
            @param {Number} from The lower bound of the range
            @param {Number} to The upper bound of the range
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      addRange: function (from, to) {
        if (arguments.length === 0) {
          return facet[name].geo_distance.ranges;
        }
      
        facet[name].geo_distance.ranges.push({
          from: from,
          to: to
        });
        
        return this;
      },

      /**
            Adds a new unbounded lower limit.

            @member ejs.GeoDistanceFacet
            @param {Number} from The lower limit of the unbounded range
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      addUnboundedFrom: function (from) {
        if (from == null) {
          return facet[name].geo_distance.ranges;
        }
      
        facet[name].geo_distance.ranges.push({
          from: from
        });
        
        return this;
      },

      /**
            Adds a new unbounded upper limit.

            @member ejs.GeoDistanceFacet
            @param {Number} to The upper limit of the unbounded range
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      addUnboundedTo: function (to) {
        if (to == null) {
          return facet[name].geo_distance.ranges;
        }
      
        facet[name].geo_distance.ranges.push({
          to: to
        });
        
        return this;
      },

      /**
             Sets the distance unit.  Valid values are "mi" for miles or "km"
             for kilometers. Defaults to "km".

             @member ejs.GeoDistanceFacet
             @param {Number} unit the unit of distance measure.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      unit: function (unit) {
        if (unit == null) {
          return facet[name].geo_distance.unit;
        }
      
        unit = unit.toLowerCase();
        if (unit === 'mi' || unit === 'km') {
          facet[name].geo_distance.unit = unit;
        }
        
        return this;
      },
      
      /**
            How to compute the distance. Can either be arc (better precision) 
            or plane (faster). Defaults to arc.

            @member ejs.GeoDistanceFacet
            @param {String} type The execution type as a string.  
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      distanceType: function (type) {
        if (type == null) {
          return facet[name].geo_distance.distance_type;
        }

        type = type.toLowerCase();
        if (type === 'arc' || type === 'plane') {
          facet[name].geo_distance.distance_type = type;
        }
        
        return this;
      },

      /**
            If the lat/long points should be normalized to lie within their
            respective normalized ranges.
            
            Normalized ranges are:
            lon = -180 (exclusive) to 180 (inclusive) range
            lat = -90 to 90 (both inclusive) range

            @member ejs.GeoDistanceFacet
            @param {String} trueFalse True if the coordinates should be normalized. False otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      normalize: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].geo_distance.normalize;
        }

        facet[name].geo_distance.normalize = trueFalse;
        return this;
      },
      
      /**
            Allows you to specify a different value field to aggrerate over.

            @member ejs.GeoDistanceFacet
            @param {String} fieldName The name of the field to be used.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      valueField: function (fieldName) {
        if (fieldName == null) {
          return facet[name].geo_distance.value_field;
        }
      
        facet[name].geo_distance.value_field = fieldName;
        return this;
      },
      
      /**
            Allows you modify the <code>value</code> field using a script. The modified value
            is then used to compute the statistical data.

            @member ejs.GeoDistanceFacet
            @param {String} scriptCode A valid script string to execute.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      valueScript: function (scriptCode) {
        if (scriptCode == null) {
          return facet[name].geo_distance.value_script;
        }
      
        facet[name].geo_distance.value_script = scriptCode;
        return this;
      },
      
      /**
            The script language being used. Currently supported values are
            <code>javascript</code>, <code>groovy</code>, and <code>mvel</code>.

            @member ejs.GeoDistanceFacet
            @param {String} language The language of the script.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lang: function (language) {
        if (language == null) {
          return facet[name].geo_distance.lang;
        }
      
        facet[name].geo_distance.lang = language;
        return this;
      },
      
      /**
            Sets parameters that will be applied to the script.  Overwrites 
            any existing params.

            @member ejs.GeoDistanceFacet
            @param {Object} p An object where the keys are the parameter name and 
              values are the parameter value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      params: function (p) {
        if (p == null) {
          return facet[name].geo_distance.params;
        }
    
        facet[name].geo_distance.params = p;
        return this;
      },
      
      /**
            <p>Allows you to reduce the documents used for computing facet results.</p>

            @member ejs.GeoDistanceFacet
            @param {Object} oFilter A valid <code>Filter</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      facetFilter: function (oFilter) {
        if (oFilter == null) {
          return facet[name].facet_filter;
        }
      
        if (!isFilter(oFilter)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        facet[name].facet_filter = oFilter._self();
        return this;
      },

      /**
            <p>Computes values across the entire index</p>

            @member ejs.GeoDistanceFacet
            @param {Boolean} trueFalse Calculate facet counts globally or not.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      global: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].global;
        }
        
        facet[name].global = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the mode the facet will use.<p>
            
            <dl>
                <dd><code>collector</code></dd>
                <dd><code>post</code></dd>
            <dl>
            
            @member ejs.GeoDistanceFacet
            @param {String} m The mode: collector or post.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      mode: function (m) {
        if (m == null) {
          return facet[name].mode;
        }
      
        m = m.toLowerCase();
        if (m === 'collector' || m === 'post') {
          facet[name].mode = m;
        }
        
        return this;
      },
      
      /**
            <p>Computes values across the the specified scope</p>

            @deprecated since elasticsearch 0.90
            @member ejs.GeoDistanceFacet
            @param {String} scope The scope name to calculate facet counts with.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (scope) {
        return this;
      },
      
      /**
            <p>Enables caching of the <code>facetFilter</code></p>

            @member ejs.GeoDistanceFacet
            @param {Boolean} trueFalse If the facetFilter should be cached or not
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheFilter: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].cache_filter;
        }
        
        facet[name].cache_filter = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the path to the nested document if faceting against a
            nested field.</p>

            @member ejs.GeoDistanceFacet
            @param {String} path The nested path
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      nested: function (path) {
        if (path == null) {
          return facet[name].nested;
        }
        
        facet[name].nested = path;
        return this;
      },
      
      /**
            <p>Allows you to serialize this object into a JSON encoded string.</p>

            @member ejs.GeoDistanceFacet
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(facet);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.GeoDistanceFacet
            @returns {String} the type of object
            */
      _type: function () {
        return 'facet';
      },
      
      /**
            <p>Retrieves the internal <code>facet</code> object. This is typically used by
               internal API functions so use with caution.</p>

            @member ejs.GeoDistanceFacet
            @returns {String} returns this object's internal <code>facet</code> property.
            */
      _self: function () {
        return facet;
      }
    };
  };

  /**
    @class
    <p>The histogram facet works with numeric data by building a histogram across intervals
       of the field values. Each value is <em>rounded</em> into an interval (or placed in a
       bucket), and statistics are provided per interval/bucket (count and total).</p>

    <p>Facets are similar to SQL <code>GROUP BY</code> statements but perform much
       better. You can also construct several <em>"groups"</em> at once by simply
       specifying multiple facets.</p>

    <div class="alert-message block-message info">
        <p>
            <strong>Tip: </strong>
            For more information on faceted navigation, see
            <a href="http://en.wikipedia.org/wiki/Faceted_classification">this</a>
            Wikipedia article on Faceted Classification.
        </p>
    </div>

    @name ejs.HistogramFacet

    @desc
    <p>A facet which returns the N most frequent terms within a collection
       or set of collections.</p>

    @param {String} name The name which be used to refer to this facet. For instance,
        the facet itself might utilize a field named <code>doc_authors</code>. Setting
        <code>name</code> to <code>Authors</code> would allow you to refer to the
        facet by that name, possibly simplifying some of the display logic.

    */
  ejs.HistogramFacet = function (name) {

    /**
        The internal facet object.
        @member ejs.HistogramFacet
        @property {Object} facet
        */
    var facet = {};

    facet[name] = {
      histogram: {}
    };

    return {

      /**
            Sets the field to be used to construct the this facet.

            @member ejs.HistogramFacet
            @param {String} fieldName The field name whose data will be used to construct the facet.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (fieldName) {
        if (fieldName == null) {
          return facet[name].histogram.field;
        }
      
        facet[name].histogram.field = fieldName;
        return this;
      },

      /**
            Sets the bucket interval used to calculate the distribution.

            @member ejs.HistogramFacet
            @param {Number} numericInterval The bucket interval in which to group values.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      interval: function (numericInterval) {
        if (numericInterval == null) {
          return facet[name].histogram.interval;
        }
      
        facet[name].histogram.interval = numericInterval;
        return this;
      },

      /**
            Sets the bucket interval used to calculate the distribution based
            on a time value such as "1d", "1w", etc.

            @member ejs.HistogramFacet
            @param {Number} timeInterval The bucket interval in which to group values.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      timeInterval: function (timeInterval) {
        if (timeInterval == null) {
          return facet[name].histogram.time_interval;
        }
      
        facet[name].histogram.time_interval = timeInterval;
        return this;
      },

      /**
            Sets the "from", "start", or lower bounds bucket.  For example if 
            you have a value of 1023, an interval of 100, and a from value of 
            1500, it will be placed into the 1500 bucket vs. the normal bucket 
            of 1000.

            @member ejs.HistogramFacet
            @param {Number} from the lower bounds bucket value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      from: function (from) {
        if (from == null) {
          return facet[name].histogram.from;
        }
      
        facet[name].histogram.from = from;
        return this;
      },

      /**
            Sets the "to", "end", or upper bounds bucket.  For example if 
            you have a value of 1023, an interval of 100, and a to value of 
            900, it will be placed into the 900 bucket vs. the normal bucket 
            of 1000.

            @member ejs.HistogramFacet
            @param {Number} to the upper bounds bucket value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      to: function (to) {
        if (to == null) {
          return facet[name].histogram.to;
        }
      
        facet[name].histogram.to = to;
        return this;
      },
                  
      /**
            Allows you to specify a different value field to aggrerate over.

            @member ejs.HistogramFacet
            @param {String} fieldName The name of the field to be used.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      valueField: function (fieldName) {
        if (fieldName == null) {
          return facet[name].histogram.value_field;
        }
      
        facet[name].histogram.value_field = fieldName;
        return this;
      },

      /**
            Allows you to specify a different key field to be used to group intervals.

            @member ejs.HistogramFacet
            @param {String} fieldName The name of the field to be used.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      keyField: function (fieldName) {
        if (fieldName == null) {
          return facet[name].histogram.key_field;
        }
      
        facet[name].histogram.key_field = fieldName;
        return this;
      },

      /**
            Allows you modify the <code>value</code> field using a script. The modified value
            is then used to compute the statistical data.

            @member ejs.HistogramFacet
            @param {String} scriptCode A valid script string to execute.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      valueScript: function (scriptCode) {
        if (scriptCode == null) {
          return facet[name].histogram.value_script;
        }
      
        facet[name].histogram.value_script = scriptCode;
        return this;
      },

      /**
            Allows you modify the <code>key</code> field using a script. The modified value
            is then used to generate the interval.

            @member ejs.HistogramFacet
            @param {String} scriptCode A valid script string to execute.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      keyScript: function (scriptCode) {
        if (scriptCode == null) {
          return facet[name].histogram.key_script;
        }
      
        facet[name].histogram.key_script = scriptCode;
        return this;
      },

      /**
            The script language being used. Currently supported values are
            <code>javascript</code>, <code>groovy</code>, and <code>mvel</code>.

            @member ejs.HistogramFacet
            @param {String} language The language of the script.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lang: function (language) {
        if (language == null) {
          return facet[name].histogram.lang;
        }
      
        facet[name].histogram.lang = language;
        return this;
      },

      /**
            Sets parameters that will be applied to the script.  Overwrites 
            any existing params.

            @member ejs.HistogramFacet
            @param {Object} p An object where the keys are the parameter name and 
              values are the parameter value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      params: function (p) {
        if (p == null) {
          return facet[name].histogram.params;
        }
    
        facet[name].histogram.params = p;
        return this;
      },
      
      /**
            Sets the type of ordering that will be performed on the date
            buckets.  Valid values are:
            
            key - the default, sort by the bucket's key value
            count - sort by the number of items in the bucket
            total - sort by the sum/total of the items in the bucket
            
            @member ejs.HistogramFacet
            @param {String} o The ordering method: key, count, or total.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      order: function (o) {
        if (o == null) {
          return facet[name].histogram.order;
        }
      
        o = o.toLowerCase();
        if (o === 'key' || o === 'count' || o === 'total') {
          facet[name].histogram.order = o;
        }
        
        return this;
      },
      
      /**
            <p>Allows you to reduce the documents used for computing facet results.</p>

            @member ejs.HistogramFacet
            @param {Object} oFilter A valid <code>Filter</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      facetFilter: function (oFilter) {
        if (oFilter == null) {
          return facet[name].facet_filter;
        }
      
        if (!isFilter(oFilter)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        facet[name].facet_filter = oFilter._self();
        return this;
      },

      /**
            <p>Computes values across the entire index</p>

            @member ejs.HistogramFacet
            @param {Boolean} trueFalse Calculate facet counts globally or not.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      global: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].global;
        }
        
        facet[name].global = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the mode the facet will use.<p>
            
            <dl>
                <dd><code>collector</code></dd>
                <dd><code>post</code></dd>
            <dl>
            
            @member ejs.HistogramFacet
            @param {String} m The mode: collector or post.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      mode: function (m) {
        if (m == null) {
          return facet[name].mode;
        }
      
        m = m.toLowerCase();
        if (m === 'collector' || m === 'post') {
          facet[name].mode = m;
        }
        
        return this;
      },
      
      /**
            <p>Computes values across the the specified scope</p>

            @deprecated since elasticsearch 0.90
            @member ejs.HistogramFacet
            @param {String} scope The scope name to calculate facet counts with.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (scope) {
        return this;
      },
      
      /**
            <p>Enables caching of the <code>facetFilter</code></p>

            @member ejs.HistogramFacet
            @param {Boolean} trueFalse If the facetFilter should be cached or not
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheFilter: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].cache_filter;
        }
        
        facet[name].cache_filter = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the path to the nested document if faceting against a
            nested field.</p>

            @member ejs.HistogramFacet
            @param {String} path The nested path
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      nested: function (path) {
        if (path == null) {
          return facet[name].nested;
        }
        
        facet[name].nested = path;
        return this;
      },

      /**
            <p>Allows you to serialize this object into a JSON encoded string.</p>

            @member ejs.HistogramFacet
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(facet);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.HistogramFacet
            @returns {String} the type of object
            */
      _type: function () {
        return 'facet';
      },
      
      /**
            <p>Retrieves the internal <code>facet</code> object. This is typically used by
               internal API functions so use with caution.</p>

            @member ejs.HistogramFacet
            @returns {String} returns this object's internal <code>facet</code> property.
            */
      _self: function () {
        return facet;
      }
    };
  };

  /**
    @class
    <p>The QueryFacet facet allows you to specify any valid <code>Query</code> and
    have the number of matching hits returned as the value.</p>

    <p>Facets are similar to SQL <code>GROUP BY</code> statements but perform much
       better. You can also construct several <em>"groups"</em> at once by simply
       specifying multiple facets.</p>

    <div class="alert-message block-message info">
        <p>
            <strong>Tip: </strong>
            For more information on faceted navigation, see
            <a href="http://en.wikipedia.org/wiki/Faceted_classification">this</a>
            Wikipedia article on Faceted Classification.
        </p>
    </div>

    @name ejs.QueryFacet

    @desc
    <p>A facet that return a count of the hits matching the given query.</p>

    @param {String} name The name which be used to refer to this facet. For instance,
        the facet itself might utilize a field named <code>doc_authors</code>. Setting
        <code>name</code> to <code>Authors</code> would allow you to refer to the
        facet by that name, possibly simplifying some of the display logic.

    */
  ejs.QueryFacet = function (name) {

    /**
        The internal facet object.
        @member ejs.QueryFacet
        @property {Object} facet
        */
    var facet = {};
    facet[name] = {};

    return {

      /**
            <p>Sets the query to be used for this facet.</p>

            @member ejs.QueryFacet
            @param {Object} oQuery A valid <code>Query</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (oQuery) {
        if (oQuery == null) {
          return facet[name].query;
        }
      
        if (!isQuery(oQuery)) {
          throw new TypeError('Argument must be a Query');
        }
        
        facet[name].query = oQuery._self();
        return this;
      },

      /**
            <p>Allows you to reduce the documents used for computing facet results.</p>

            @member ejs.QueryFacet
            @param {Object} oFilter A valid <code>Filter</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      facetFilter: function (oFilter) {
        if (oFilter == null) {
          return facet[name].facet_filter;
        }
      
        if (!isFilter(oFilter)) {
          throw new TypeError('Argumnet must be a Filter');
        }
        
        facet[name].facet_filter = oFilter._self();
        return this;
      },

      /**
            <p>Computes values across the entire index</p>

            @member ejs.QueryFacet
            @param {Boolean} trueFalse Calculate facet counts globally or not.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      global: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].global;
        }
        
        facet[name].global = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the mode the facet will use.<p>
            
            <dl>
                <dd><code>collector</code></dd>
                <dd><code>post</code></dd>
            <dl>
            
            @member ejs.QueryFacet
            @param {String} m The mode: collector or post.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      mode: function (m) {
        if (m == null) {
          return facet[name].mode;
        }
      
        m = m.toLowerCase();
        if (m === 'collector' || m === 'post') {
          facet[name].mode = m;
        }
        
        return this;
      },
      
      /**
            <p>Computes values across the the specified scope</p>

            @deprecated since elasticsearch 0.90
            @member ejs.QueryFacet
            @param {String} scope The scope name to calculate facet counts with.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (scope) {
        return this;
      },
      
      /**
            <p>Enables caching of the <code>facetFilter</code></p>

            @member ejs.QueryFacet
            @param {Boolean} trueFalse If the facetFilter should be cached or not
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheFilter: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].cache_filter;
        }
        
        facet[name].cache_filter = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the path to the nested document if faceting against a
            nested field.</p>

            @member ejs.QueryFacet
            @param {String} path The nested path
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      nested: function (path) {
        if (path == null) {
          return facet[name].nested;
        }
        
        facet[name].nested = path;
        return this;
      },

      /**
            <p>Allows you to serialize this object into a JSON encoded string.</p>

            @member ejs.QueryFacet
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(facet);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.QueryFacet
            @returns {String} the type of object
            */
      _type: function () {
        return 'facet';
      },
      
      /**
            <p>Retrieves the internal <code>facet</code> object. This is typically used by
               internal API functions so use with caution.</p>

            @member ejs.QueryFacet
            @returns {String} returns this object's internal <code>facet</code> property.
            */
      _self: function () {
        return facet;
      }
    };
  };

  /**
    @class
    <p>A RangeFacet allows you to specify a set of ranges and get both the number of docs (count) that
       fall within each range, and aggregated data based on the field, or another specified field.</p>

    <p>Facets are similar to SQL <code>GROUP BY</code> statements but perform much
       better. You can also construct several <em>"groups"</em> at once by simply
       specifying multiple facets.</p>

    <div class="alert-message block-message info">
        <p>
            <strong>Tip: </strong>
            For more information on faceted navigation, see
            <a href="http://en.wikipedia.org/wiki/Faceted_classification">this</a>
            Wikipedia article on Faceted Classification.
        </p>
    </div>

    @name ejs.RangeFacet

    @desc
    <p>A facet which provides information over a range of numeric intervals.</p>

    @param {String} name The name which be used to refer to this facet. For instance,
        the facet itself might utilize a field named <code>doc_authors</code>. Setting
        <code>name</code> to <code>Authors</code> would allow you to refer to the
        facet by that name, possibly simplifying some of the display logic.

    */
  ejs.RangeFacet = function (name) {

    /**
        The internal facet object.
        @member ejs.RangeFacet
        @property {Object} facet
        */
    var facet = {};

    facet[name] = {
      range: {
        ranges: []
      }
    };

    return {

      /**
            Sets the document field to be used for the facet.

            @member ejs.RangeFacet
            @param {String} fieldName The field name whose data will be used to compute the interval.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (fieldName) {
        if (fieldName == null) {
          return facet[name].range.field;
        }
      
        facet[name].range.field = fieldName;
        return this;
      },

      /**
            Allows you to specify an alternate key field to be used to compute the interval.

            @member ejs.RangeFacet
            @param {String} fieldName The field name whose data will be used to compute the interval.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      keyField: function (fieldName) {
        if (fieldName == null) {
          return facet[name].range.key_field;
        }
      
        facet[name].range.key_field = fieldName;
        return this;
      },

      /**
            Allows you to specify an alternate value field to be used to compute statistical information.

            @member ejs.RangeFacet
            @param {String} fieldName The field name whose data will be used to compute statistics.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      valueField: function (fieldName) {
        if (fieldName == null) {
          return facet[name].range.value_field;
        }
      
        facet[name].range.value_field = fieldName;
        return this;
      },

      /**
            Allows you modify the <code>value</code> field using a script. The modified value
            is then used to compute the statistical data.

            @member ejs.RangeFacet
            @param {String} scriptCode A valid script string to execute.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      valueScript: function (scriptCode) {
        if (scriptCode == null) {
          return facet[name].range.value_script;
        }
      
        facet[name].range.value_script = scriptCode;
        return this;
      },

      /**
            Allows you modify the <code>key</code> field using a script. The modified value
            is then used to generate the interval.

            @member ejs.RangeFacet
            @param {String} scriptCode A valid script string to execute.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      keyScript: function (scriptCode) {
        if (scriptCode == null) {
          return facet[name].range.key_script;
        }
      
        facet[name].range.key_script = scriptCode;
        return this;
      },

      /**
            The script language being used. Currently supported values are
            <code>javascript</code>, <code>groovy</code>, and <code>mvel</code>.

            @member ejs.RangeFacet
            @param {String} language The language of the script.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lang: function (language) {
        if (language == null) {
          return facet[name].range.lang;
        }
      
        facet[name].range.lang = language;
        return this;
      },

      /**
            Sets parameters that will be applied to the script.  Overwrites 
            any existing params.

            @member ejs.RangeFacet
            @param {Object} p An object where the keys are the parameter name and 
              values are the parameter value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      params: function (p) {
        if (p == null) {
          return facet[name].range.params;
        }
    
        facet[name].range.params = p;
        return this;
      },
      
      /**
            Adds a new bounded range.

            @member ejs.RangeFacet
            @param {Number} from The lower bound of the range (can also be <code>Date</code>).
            @param {Number} to The upper bound of the range (can also be <code>Date</code>).
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      addRange: function (from, to) {
        if (arguments.length === 0) {
          return facet[name].range.ranges;
        }
      
        facet[name].range.ranges.push({
          from: from,
          to: to
        });
        
        return this;
      },

      /**
            Adds a new unbounded lower limit.

            @member ejs.RangeFacet
            @param {Number} from The lower limit of the unbounded range (can also be <code>Date</code>).
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      addUnboundedFrom: function (from) {
        if (from == null) {
          return facet[name].range.ranges;
        }
      
        facet[name].range.ranges.push({
          from: from
        });
        
        return this;
      },

      /**
            Adds a new unbounded upper limit.

            @member ejs.RangeFacet
            @param {Number} to The upper limit of the unbounded range (can also be <code>Date</code>).
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      addUnboundedTo: function (to) {
        if (to == null) {
          return facet[name].range.ranges;
        }
      
        facet[name].range.ranges.push({
          to: to
        });
        
        return this;
      },

      /**
            <p>Allows you to reduce the documents used for computing facet results.</p>

            @member ejs.RangeFacet
            @param {Object} oFilter A valid <code>Filter</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      facetFilter: function (oFilter) {
        if (oFilter == null) {
          return facet[name].facet_filter;
        }
      
        if (!isFilter(oFilter)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        facet[name].facet_filter = oFilter._self();
        return this;
      },

      /**
            <p>Computes values across the entire index</p>

            @member ejs.RangeFacet
            @param {Boolean} trueFalse Calculate facet counts globally or not.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      global: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].global;
        }
        
        facet[name].global = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the mode the facet will use.<p>
            
            <dl>
                <dd><code>collector</code></dd>
                <dd><code>post</code></dd>
            <dl>
            
            @member ejs.RangeFacet
            @param {String} m The mode: collector or post.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      mode: function (m) {
        if (m == null) {
          return facet[name].mode;
        }
      
        m = m.toLowerCase();
        if (m === 'collector' || m === 'post') {
          facet[name].mode = m;
        }
        
        return this;
      },
      
      /**
            <p>Computes values across the the specified scope</p>

            @deprecated since elasticsearch 0.90
            @member ejs.RangeFacet
            @param {String} scope The scope name to calculate facet counts with.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (scope) {
        return this;
      },
      
      /**
            <p>Enables caching of the <code>facetFilter</code></p>

            @member ejs.RangeFacet
            @param {Boolean} trueFalse If the facetFilter should be cached or not
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheFilter: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].cache_filter;
        }
        
        facet[name].cache_filter = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the path to the nested document if faceting against a
            nested field.</p>

            @member ejs.RangeFacet
            @param {String} path The nested path
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      nested: function (path) {
        if (path == null) {
          return facet[name].nested;
        }
        
        facet[name].nested = path;
        return this;
      },
      
      /**
            <p>Allows you to serialize this object into a JSON encoded string.</p>

            @member ejs.RangeFacet
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(facet);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.RangeFacet
            @returns {String} the type of object
            */
      _type: function () {
        return 'facet';
      },
      
      /**
            <p>Retrieves the internal <code>facet</code> object. This is typically used by
               internal API functions so use with caution.</p>

            @member ejs.RangeFacet
            @returns {String} returns this object's internal <code>facet</code> property.
            */
      _self: function () {
        return facet;
      }
    };
  };

  /**
    @class
    <p>A statistical facet allows you to compute statistical data over a numeric fields. Statistical data includes
    the count, total, sum of squares, mean (average), minimum, maximum, variance, and standard deviation.</p>

    <p>Facets are similar to SQL <code>GROUP BY</code> statements but perform much
       better. You can also construct several <em>"groups"</em> at once by simply
       specifying multiple facets.</p>

    <div class="alert-message block-message info">
        <p>
            <strong>Tip: </strong>
            For more information on faceted navigation, see
            <a href="http://en.wikipedia.org/wiki/Faceted_classification">this</a>
            Wikipedia article on Faceted Classification.
        </p>
    </div>

    @name ejs.StatisticalFacet

    @desc
    <p>A facet which returns statistical information about a numeric field</p>

    @param {String} name The name which be used to refer to this facet. For instance,
        the facet itself might utilize a field named <code>doc_authors</code>. Setting
        <code>name</code> to <code>Authors</code> would allow you to refer to the
        facet by that name, possibly simplifying some of the display logic.

    */
  ejs.StatisticalFacet = function (name) {

    /**
        The internal facet object.
        @member ejs.StatisticalFacet
        @property {Object} facet
        */
    var facet = {};

    facet[name] = {
      statistical: {}
    };

    return {

      /**
            Sets the field to be used to construct the this facet.

            @member ejs.StatisticalFacet
            @param {String} fieldName The field name whose data will be used to construct the facet.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (fieldName) {
        if (fieldName == null) {
          return facet[name].statistical.field;
        }
      
        facet[name].statistical.field = fieldName;
        return this;
      },

      /**
            Aggregate statistical info across a set of fields.

            @member ejs.StatisticalFacet
            @param {Array} aFieldName An array of field names.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fields: function (fields) {
        if (fields == null) {
          return facet[name].statistical.fields;
        }
      
        if (!isArray(fields)) {
          throw new TypeError('Argument must be an array');
        }
        
        facet[name].statistical.fields = fields;
        return this;
      },

      /**
            Define a script to evaluate of which the result will be used to generate
            the statistical information.

            @member ejs.StatisticalFacet
            @param {String} code The script code to execute.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      script: function (code) {
        if (code == null) {
          return facet[name].statistical.script;
        }
      
        facet[name].statistical.script = code;
        return this;
      },

      /**
            The script language being used. Currently supported values are
            <code>javascript</code>, <code>groovy</code>, and <code>mvel</code>.

            @member ejs.StatisticalFacet
            @param {String} language The language of the script.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lang: function (language) {
        if (language == null) {
          return facet[name].statistical.lang;
        }
      
        facet[name].statistical.lang = language;
        return this;
      },

      /**
            Allows you to set script parameters to be used during the execution of the script.

            @member ejs.StatisticalFacet
            @param {Object} oParams An object containing key/value pairs representing param name/value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      params: function (oParams) {
        if (oParams == null) {
          return facet[name].statistical.params;
        }
      
        facet[name].statistical.params = oParams;
        return this;
      },

      /**
            <p>Allows you to reduce the documents used for computing facet results.</p>

            @member ejs.StatisticalFacet
            @param {Object} oFilter A valid <code>Filter</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      facetFilter: function (oFilter) {
        if (oFilter == null) {
          return facet[name].facet_filter;
        }
      
        if (!isFilter(oFilter)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        facet[name].facet_filter = oFilter._self();
        return this;
      },

      /**
            <p>Computes values across the entire index</p>

            @member ejs.StatisticalFacet
            @param {Boolean} trueFalse Calculate facet counts globally or not.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      global: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].global;
        }
        
        facet[name].global = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the mode the facet will use.<p>
            
            <dl>
                <dd><code>collector</code></dd>
                <dd><code>post</code></dd>
            <dl>
            
            @member ejs.StatisticalFacet
            @param {String} m The mode: collector or post.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      mode: function (m) {
        if (m == null) {
          return facet[name].mode;
        }
      
        m = m.toLowerCase();
        if (m === 'collector' || m === 'post') {
          facet[name].mode = m;
        }
        
        return this;
      },
      
      /**
            <p>Computes values across the the specified scope</p>

            @deprecated since elasticsearch 0.90
            @member ejs.StatisticalFacet
            @param {String} scope The scope name to calculate facet counts with.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (scope) {
        return this;
      },
      
      /**
            <p>Enables caching of the <code>facetFilter</code></p>

            @member ejs.StatisticalFacet
            @param {Boolean} trueFalse If the facetFilter should be cached or not
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheFilter: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].cache_filter;
        }
        
        facet[name].cache_filter = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the path to the nested document if faceting against a
            nested field.</p>

            @member ejs.StatisticalFacet
            @param {String} path The nested path
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      nested: function (path) {
        if (path == null) {
          return facet[name].nested;
        }
        
        facet[name].nested = path;
        return this;
      },

      /**
            <p>Allows you to serialize this object into a JSON encoded string.</p>

            @member ejs.StatisticalFacet
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(facet);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.StatisticalFacet
            @returns {String} the type of object
            */
      _type: function () {
        return 'facet';
      },
      
      /**
            <p>Retrieves the internal <code>facet</code> object. This is typically used by
               internal API functions so use with caution.</p>

            @member ejs.StatisticalFacet
            @returns {String} returns this object's internal <code>facet</code> property.
            */
      _self: function () {
        return facet;
      }
    };
  };

  /**
    @class
    <p>A termsStatsFacet allows you to compute statistics over an aggregate key (term). Essentially this
    facet provides the functionality of what is often refered to as a <em>pivot table</em>.</p>

    <p>Facets are similar to SQL <code>GROUP BY</code> statements but perform much
       better. You can also construct several <em>"groups"</em> at once by simply
       specifying multiple facets.</p>

    <div class="alert-message block-message info">
        <p>
            <strong>Tip: </strong>
            For more information on faceted navigation, see
            <a href="http://en.wikipedia.org/wiki/Faceted_classification">this</a>
            Wikipedia article on Faceted Classification.
        </p>
    </div>

    @name ejs.TermStatsFacet

    @desc
    <p>A facet which computes statistical data based on an aggregate key.</p>

    @param {String} name The name which be used to refer to this facet. For instance,
        the facet itself might utilize a field named <code>doc_authors</code>. Setting
        <code>name</code> to <code>Authors</code> would allow you to refer to the
        facet by that name, possibly simplifying some of the display logic.

    */
  ejs.TermStatsFacet = function (name) {

    /**
        The internal facet object.
        @member ejs.TermStatsFacet
        @property {Object} facet
        */
    var facet = {};

    facet[name] = {
      terms_stats: {}
    };

    return {

      /**
            Sets the field for which statistical information will be generated.

            @member ejs.TermStatsFacet
            @param {String} fieldName The field name whose data will be used to construct the facet.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      valueField: function (fieldName) {
        if (fieldName == null) {
          return facet[name].terms_stats.value_field;
        }
      
        facet[name].terms_stats.value_field = fieldName;
        return this;
      },

      /**
            Sets the field which will be used to pivot on (group-by).

            @member ejs.TermStatsFacet
            @param {String} fieldName The field name whose data will be used to construct the facet.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      keyField: function (fieldName) {
        if (fieldName == null) {
          return facet[name].terms_stats.key_field;
        }
      
        facet[name].terms_stats.key_field = fieldName;
        return this;
      },

      /**
            Sets a script that will provide the terms for a given document.

            @member ejs.TermStatsFacet
            @param {String} script The script code.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scriptField: function (script) {
        if (script == null) {
          return facet[name].terms_stats.script_field;
        }
      
        facet[name].terms_stats.script_field = script;
        return this;
      },
      
      /**
            Define a script to evaluate of which the result will be used to generate
            the statistical information.

            @member ejs.TermStatsFacet
            @param {String} code The script code to execute.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      valueScript: function (code) {
        if (code == null) {
          return facet[name].terms_stats.value_script;
        }
      
        facet[name].terms_stats.value_script = code;
        return this;
      },

      /**
            <p>Allows you to return all terms, even if the frequency count is 0. This should not be
               used on fields that contain a large number of unique terms because it could cause
               <em>out-of-memory</em> errors.</p>

            @member ejs.TermStatsFacet
            @param {String} trueFalse <code>true</code> or <code>false</code>
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      allTerms: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].terms_stats.all_terms;
        }
      
        facet[name].terms_stats.all_terms = trueFalse;
        return this;
      },
      
      /**
            The script language being used. Currently supported values are
            <code>javascript</code>, <code>groovy</code>, and <code>mvel</code>.

            @member ejs.TermStatsFacet
            @param {String} language The language of the script.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lang: function (language) {
        if (language == null) {
          return facet[name].terms_stats.lang;
        }
      
        facet[name].terms_stats.lang = language;
        return this;
      },

      /**
            Allows you to set script parameters to be used during the execution of the script.

            @member ejs.TermStatsFacet
            @param {Object} oParams An object containing key/value pairs representing param name/value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      params: function (oParams) {
        if (oParams == null) {
          return facet[name].terms_stats.params;
        }
      
        facet[name].terms_stats.params = oParams;
        return this;
      },

      /**
            Sets the number of facet entries that will be returned for this facet. For instance, you
            might ask for only the top 5 aggregate keys although there might be hundreds of
            unique keys. <strong>Higher settings could cause memory strain</strong>.

            @member ejs.TermStatsFacet
            @param {Integer} facetSize The numer of facet entries to be returned.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      size: function (facetSize) {
        if (facetSize == null) {
          return facet[name].terms_stats.size;
        }
      
        facet[name].terms_stats.size = facetSize;
        return this;
      },

      /**
            Sets the type of ordering that will be performed on the date
            buckets.  Valid values are:
            
            count - default, sort by the number of items in the bucket
            term - sort by term value.
            reverse_count - reverse sort of the number of items in the bucket
            reverse_term - reverse sort of the term value.
            total - sorts by the total value of the bucket contents
            reverse_total - reverse sort of the total value of bucket contents
            min - the minimum value in the bucket
            reverse_min - the reverse sort of the minimum value
            max - the maximum value in the bucket
            reverse_max - the reverse sort of the maximum value
            mean - the mean value of the bucket contents
            reverse_mean - the reverse sort of the mean value of bucket contents.
            
            @member ejs.TermStatsFacet
            @param {String} o The ordering method
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      order: function (o) {
        if (o == null) {
          return facet[name].terms_stats.order;
        }
      
        o = o.toLowerCase();
        if (o === 'count' || o === 'term' || o === 'reverse_count' || 
          o === 'reverse_term' || o === 'total' || o === 'reverse_total' || 
          o === 'min' || o === 'reverse_min' || o === 'max' || 
          o === 'reverse_max' || o === 'mean' || o === 'reverse_mean') {
          
          facet[name].terms_stats.order = o;
        }
        
        return this;
      },

      /**
            <p>Allows you to reduce the documents used for computing facet results.</p>

            @member ejs.TermStatsFacet
            @param {Object} oFilter A valid <code>Filter</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      facetFilter: function (oFilter) {
        if (oFilter == null) {
          return facet[name].facet_filter;
        }
      
        if (!isFilter(oFilter)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        facet[name].facet_filter = oFilter._self();
        return this;
      },

      /**
            <p>Computes values across the entire index</p>

            @member ejs.TermStatsFacet
            @param {Boolean} trueFalse Calculate facet counts globally or not.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      global: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].global;
        }
        
        facet[name].global = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the mode the facet will use.<p>
            
            <dl>
                <dd><code>collector</code></dd>
                <dd><code>post</code></dd>
            <dl>
            
            @member ejs.TermStatsFacet
            @param {String} m The mode: collector or post.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      mode: function (m) {
        if (m == null) {
          return facet[name].mode;
        }
      
        m = m.toLowerCase();
        if (m === 'collector' || m === 'post') {
          facet[name].mode = m;
        }
        
        return this;
      },
      
      /**
            <p>Computes values across the the specified scope</p>

            @deprecated since elasticsearch 0.90
            @member ejs.TermStatsFacet
            @param {String} scope The scope name to calculate facet counts with.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (scope) {
        return this;
      },
      
      /**
            <p>Enables caching of the <code>facetFilter</code></p>

            @member ejs.TermStatsFacet
            @param {Boolean} trueFalse If the facetFilter should be cached or not
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheFilter: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].cache_filter;
        }
        
        facet[name].cache_filter = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the path to the nested document if faceting against a
            nested field.</p>

            @member ejs.TermStatsFacet
            @param {String} path The nested path
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      nested: function (path) {
        if (path == null) {
          return facet[name].nested;
        }
        
        facet[name].nested = path;
        return this;
      },
      
      /**
            <p>Allows you to serialize this object into a JSON encoded string.</p>

            @member ejs.TermStatsFacet
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(facet);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.TermStatsFacet
            @returns {String} the type of object
            */
      _type: function () {
        return 'facet';
      },
      
      /**
            <p>Retrieves the internal <code>facet</code> object. This is typically used by
               internal API functions so use with caution.</p>

            @member ejs.TermStatsFacet
            @returns {String} returns this object's internal <code>facet</code> property.
            */
      _self: function () {
        return facet;
      }
    };
  };

  /**
    @class
    <p>A facet which returns the N most frequent terms within a collection
       or set of collections. Term facets are useful for building constructs
       which allow users to refine search results by filtering on terms returned
       by the facet.</p>

    <p>Facets are similar to SQL <code>GROUP BY</code> statements but perform much
       better. You can also construct several <em>"groups"</em> at once by simply
       specifying multiple facets.</p>

    <p>For more information on faceted navigation, see this Wikipedia article on
       <a href="http://en.wikipedia.org/wiki/Faceted_classification">Faceted Classification</a></p<

    @name ejs.TermsFacet

    @desc
    <p>A facet which returns the N most frequent terms within a collection
       or set of collections.</p>

    @param {String} name The name which be used to refer to this facet. For instance,
        the facet itself might utilize a field named <code>doc_authors</code>. Setting
        <code>name</code> to <code>Authors</code> would allow you to refer to the
        facet by that name, possibly simplifying some of the display logic.

    */
  ejs.TermsFacet = function (name) {

    /**
        The internal facet object.
        @member ejs.TermsFacet
        @property {Object} facet
        */
    var facet = {};

    facet[name] = {
      terms: {}
    };

    return {

      /**
            Sets the field to be used to construct the this facet.  Set to
            _index to return a facet count of hits per _index the search was 
            executed on.

            @member ejs.TermsFacet
            @param {String} fieldName The field name whose data will be used to construct the facet.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (fieldName) {
        if (fieldName == null) {
          return facet[name].terms.field;
        }
      
        facet[name].terms.field = fieldName;
        return this;
      },

      /**
            Aggregate statistical info across a set of fields.

            @member ejs.TermsFacet
            @param {Array} aFieldName An array of field names.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fields: function (fields) {
        if (fields == null) {
          return facet[name].terms.fields;
        }
      
        if (!isArray(fields)) {
          throw new TypeError('Argument must be an array');
        }
        
        facet[name].terms.fields = fields;
        return this;
      },

      /**
            Sets a script that will provide the terms for a given document.

            @member ejs.TermsFacet
            @param {String} script The script code.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scriptField: function (script) {
        if (script == null) {
          return facet[name].terms.script_field;
        }
      
        facet[name].terms.script_field = script;
        return this;
      },
            
      /**
            Sets the number of facet entries that will be returned for this facet. For instance, you
            might ask for only the top 5 <code>authors</code> although there might be hundreds of
            unique authors.

            @member ejs.TermsFacet
            @param {Integer} facetSize The numer of facet entries to be returned.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      size: function (facetSize) {
        if (facetSize == null) {
          return facet[name].terms.size;
        }
      
        facet[name].terms.size = facetSize;
        return this;
      },

      /**
            Sets the type of ordering that will be performed on the date
            buckets.  Valid values are:
            
            count - default, sort by the number of items in the bucket
            term - sort by term value.
            reverse_count - reverse sort of the number of items in the bucket
            reverse_term - reverse sort of the term value.
            
            @member ejs.TermsFacet
            @param {String} o The ordering method
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      order: function (o) {
        if (o == null) {
          return facet[name].terms.order;
        }
      
        o = o.toLowerCase();
        if (o === 'count' || o === 'term' || 
          o === 'reverse_count' || o === 'reverse_term') {
          
          facet[name].terms.order = o;
        }
        
        return this;
      },

      /**
            <p>Allows you to return all terms, even if the frequency count is 0. This should not be
               used on fields that contain a large number of unique terms because it could cause
               <em>out-of-memory</em> errors.</p>

            @member ejs.TermsFacet
            @param {String} trueFalse <code>true</code> or <code>false</code>
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      allTerms: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].terms.all_terms;
        }
      
        facet[name].terms.all_terms = trueFalse;
        return this;
      },

      /**
            <p>Allows you to filter out unwanted facet entries. When passed
            a single term, it is appended to the list of currently excluded
            terms.  If passed an array, it overwrites all existing values.</p>

            @member ejs.TermsFacet
            @param {String || Array} exclude A single term to exclude or an 
              array of terms to exclude.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      exclude: function (exclude) {
        if (facet[name].terms.exclude == null) {
          facet[name].terms.exclude = [];
        }
        
        if (exclude == null) {
          return facet[name].terms.exclude;
        }
      
        if (isString(exclude)) {
          facet[name].terms.exclude.push(exclude);
        } else if (isArray(exclude)) {
          facet[name].terms.exclude = exclude;
        } else {
          throw new TypeError('Argument must be string or array');
        }
        
        return this;
      },

      /**
            <p>Allows you to only include facet entries matching a specified regular expression.</p>

            @member ejs.TermsFacet
            @param {String} exp A valid regular expression.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      regex: function (exp) {
        if (exp == null) {
          return facet[name].terms.regex;
        }
      
        facet[name].terms.regex = exp;
        return this;
      },

      /**
            <p>Allows you to set the regular expression flags to be used
            with the <code>regex</code></p>

            @member ejs.TermsFacet
            @param {String} flags A valid regex flag - see <a href="http://docs.oracle.com/javase/6/docs/api/java/util/regex/Pattern.html#field_summary">Java Pattern API</a>
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      regexFlags: function (flags) {
        if (flags == null) {
          return facet[name].terms.regex_flags;
        }
      
        facet[name].terms.regex_flags = flags;
        return this;
      },

      /**
            Allows you modify the term using a script. The modified value
            is then used in the facet collection.

            @member ejs.TermsFacet
            @param {String} scriptCode A valid script string to execute.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      script: function (scriptCode) {
        if (scriptCode == null) {
          return facet[name].terms.script;
        }
      
        facet[name].terms.script = scriptCode;
        return this;
      },

      /**
            The script language being used. Currently supported values are
            <code>javascript</code>, <code>groovy</code>, and <code>mvel</code>.

            @member ejs.TermsFacet
            @param {String} language The language of the script.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lang: function (language) {
        if (language == null) {
          return facet[name].terms.lang;
        }
      
        facet[name].terms.lang = language;
        return this;
      },

      /**
            Sets parameters that will be applied to the script.  Overwrites 
            any existing params.

            @member ejs.TermsFacet
            @param {Object} p An object where the keys are the parameter name and 
              values are the parameter value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      params: function (p) {
        if (p == null) {
          return facet[name].terms.params;
        }
    
        facet[name].terms.params = p;
        return this;
      },
      
      /**
            Sets the execution hint determines how the facet is computed.  
            Currently only supported value is "map".

            @member ejs.TermsFacet
            @param {Object} h The hint value as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      executionHint: function (h) {
        if (h == null) {
          return facet[name].terms.execution_hint;
        }
    
        facet[name].terms.execution_hint = h;
        return this;
      },
      
      /**
            <p>Allows you to reduce the documents used for computing facet results.</p>

            @member ejs.TermsFacet
            @param {Object} oFilter A valid <code>Filter</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      facetFilter: function (oFilter) {
        if (oFilter == null) {
          return facet[name].facet_filter;
        }
      
        if (!isFilter(oFilter)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        facet[name].facet_filter = oFilter._self();
        return this;
      },

      /**
            <p>Computes values across the entire index</p>

            @member ejs.TermsFacet
            @param {Boolean} trueFalse Calculate facet counts globally or not.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      global: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].global;
        }
        
        facet[name].global = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the mode the facet will use.<p>
            
            <dl>
                <dd><code>collector</code></dd>
                <dd><code>post</code></dd>
            <dl>
            
            @member ejs.TermsFacet
            @param {String} m The mode: collector or post.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      mode: function (m) {
        if (m == null) {
          return facet[name].mode;
        }
      
        m = m.toLowerCase();
        if (m === 'collector' || m === 'post') {
          facet[name].mode = m;
        }
        
        return this;
      },
      
      /**
            <p>Computes values across the the specified scope</p>

            @deprecated since elasticsearch 0.90
            @member ejs.TermsFacet
            @param {String} scope The scope name to calculate facet counts with.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (scope) {
        return this;
      },
      
      /**
            <p>Enables caching of the <code>facetFilter</code></p>

            @member ejs.TermsFacet
            @param {Boolean} trueFalse If the facetFilter should be cached or not
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheFilter: function (trueFalse) {
        if (trueFalse == null) {
          return facet[name].cache_filter;
        }
        
        facet[name].cache_filter = trueFalse;
        return this;
      },
      
      /**
            <p>Sets the path to the nested document if faceting against a
            nested field.</p>

            @member ejs.TermsFacet
            @param {String} path The nested path
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      nested: function (path) {
        if (path == null) {
          return facet[name].nested;
        }
        
        facet[name].nested = path;
        return this;
      },
      
      /**
            <p>Allows you to serialize this object into a JSON encoded string.</p>

            @member ejs.TermsFacet
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(facet);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.TermsFacet
            @returns {String} the type of object
            */
      _type: function () {
        return 'facet';
      },
      
      /**
            <p>Retrieves the internal <code>facet</code> property. This is typically used by
               internal API functions so use with caution.</p>

            @member ejs.TermsFacet
            @returns {String} returns this object's internal <code>facet</code> property.
            */
      _self: function () {
        return facet;
      }
    };
  };

  /**
    @class
    A container Filter that allows Boolean AND composition of Filters.

    @name ejs.AndFilter

    @desc
    A container Filter that allows Boolean AND composition of Filters.

    @param {Filter || Array} f A single Filter object or an array of valid 
      Filter objects.
    */
  ejs.AndFilter = function (f) {

    /**
         The internal filter object. Use <code>_self()</code>

         @member ejs.AndFilter
         @property {Object} filter
         */
    var i,
      len,
      filter = {
        and: {
          filters: []
        }
      };

    if (isFilter(f)) {
      filter.and.filters.push(f._self());
    } else if (isArray(f)) {
      for (i = 0, len = f.length; i < len; i++) {
        if (!isFilter(f[i])) {
          throw new TypeError('Array must contain only Filter objects');
        }
        
        filter.and.filters.push(f[i]._self());
      }
    } else {
      throw new TypeError('Argument must be a Filter or Array of Filters');
    }

    return {

      /**
             Sets the filters for the filter.  If fltr is a single 
             Filter, it is added to the current filters.  If fltr is an array
             of Filters, then they replace all existing filters.

             @member ejs.AndFilter
             @param {Filter || Array} fltr A valid filter object or an array of filters.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      filters: function (fltr) {
        var i,
          len;
          
        if (fltr == null) {
          return filter.and.filters;
        }
      
        if (isFilter(fltr)) {
          filter.and.filters.push(fltr._self());
        } else if (isArray(fltr)) {
          filter.and.filters = [];
          for (i = 0, len = fltr.length; i < len; i++) {
            if (!isFilter(fltr[i])) {
              throw new TypeError('Array must contain only Filter objects');
            }
            
            filter.and.filters.push(fltr[i]._self());
          }
        } else {
          throw new TypeError('Argument must be a Filter or an Array of Filters');
        }
        
        return this;
      },

      /**
            Sets the filter name.

            @member ejs.AndFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.and._name;
        }

        filter.and._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.AndFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.and._cache;
        }

        filter.and._cache = trueFalse;
        return this;
      },
  
      /**
            Sets the cache key.

            @member ejs.AndFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.and._cache_key;
        }

        filter.and._cache_key = key;
        return this;
      },
      
      /**
             Returns the filter container as a JSON string

             @member ejs.AndFilter
             @returns {String} JSON representation of the andFilter object
             */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.AndFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
             Returns the filter object.

             @member ejs.AndFilter
             @returns {Object} filter object
             */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>A <code>BoolFilter</code> allows you to build <em>Boolean</em> filter constructs
    from individual filters. Similar in concept to Boolean query, except that 
    the clauses are other filters. Can be placed within queries that accept a 
    filter.
  
    @name ejs.BoolFilter

    @desc
    A Filter that matches documents matching boolean combinations of other
    filters.

    */
  ejs.BoolFilter = function () {

    /**
         The internal filter object. <code>Use _self()</code>
         @member ejs.BoolFilter
         @property {Object} filter
         */
    var filter = {
      bool: {}
    };

    return {

      /**
             Adds filter to boolean container. Given filter "must" appear in 
             matching documents.  If passed a single Filter it is added to the
             list of existing filters.  If passed an array of Filters, they
             replace all existing filters.

             @member ejs.BoolFilter
             @param {Filter || Array} oFilter A valid Filter or array of
              Filter objects.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      must: function (oFilter) {
        var i, len;
        
        if (filter.bool.must == null) {
          filter.bool.must = [];
        }
    
        if (oFilter == null) {
          return filter.bool.must;
        }

        if (isFilter(oFilter)) {
          filter.bool.must.push(oFilter._self());
        } else if (isArray(oFilter)) {
          filter.bool.must = [];
          for (i = 0, len = oFilter.length; i < len; i++) {
            if (!isFilter(oFilter[i])) {
              throw new TypeError('Argument must be an array of Filters');
            }
            
            filter.bool.must.push(oFilter[i]._self());
          }
        } else {
          throw new TypeError('Argument must be a Filter or array of Filters');
        }
        
        return this;
      },

      /**
             Adds filter to boolean container. Given filter "must not" appear 
             in matching documents. If passed a single Filter it is added to 
             the list of existing filters.  If passed an array of Filters, 
             they replace all existing filters.

             @member ejs.BoolFilter
             @param {Filter || Array} oFilter A valid Filter or array of
               Filter objects.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      mustNot: function (oFilter) {
        var i, len;
        
        if (filter.bool.must_not == null) {
          filter.bool.must_not = [];
        }

        if (oFilter == null) {
          return filter.bool.must_not;
        }
    
        if (isFilter(oFilter)) {
          filter.bool.must_not.push(oFilter._self());
        } else if (isArray(oFilter)) {
          filter.bool.must_not = [];
          for (i = 0, len = oFilter.length; i < len; i++) {
            if (!isFilter(oFilter[i])) {
              throw new TypeError('Argument must be an array of Filters');
            }
            
            filter.bool.must_not.push(oFilter[i]._self());
          }
        } else {
          throw new TypeError('Argument must be a Filter or array of Filters');
        }
        
        return this;
      },

      /**
             Adds filter to boolean container. Given filter "should" appear in 
             matching documents. If passed a single Filter it is added to 
             the list of existing filters.  If passed an array of Filters, 
             they replace all existing filters.

             @member ejs.BoolFilter
             @param {Filter || Array} oFilter A valid Filter or array of
                Filter objects.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      should: function (oFilter) {
        var i, len;
        
        if (filter.bool.should == null) {
          filter.bool.should = [];
        }

        if (oFilter == null) {
          return filter.bool.should;
        }
    
        if (isFilter(oFilter)) {
          filter.bool.should.push(oFilter._self());
        } else if (isArray(oFilter)) {
          filter.bool.should = [];
          for (i = 0, len = oFilter.length; i < len; i++) {
            if (!isFilter(oFilter[i])) {
              throw new TypeError('Argument must be an array of Filters');
            }
            
            filter.bool.should.push(oFilter[i]._self());
          }
        } else {
          throw new TypeError('Argument must be a Filter or array of Filters');
        }
        
        return this;
      },

      /**
            Sets the filter name.

            @member ejs.BoolFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.bool._name;
        }

        filter.bool._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.BoolFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.bool._cache;
        }

        filter.bool._cache = trueFalse;
        return this;
      },
  
      /**
            Sets the cache key.

            @member ejs.BoolFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.bool._cache_key;
        }

        filter.bool._cache_key = key;
        return this;
      },
    
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.BoolFilter
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.BoolFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
            Retrieves the internal <code>filter</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.BoolFilter
            @returns {String} returns this object's internal <code>filter</code> property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>An existsFilter matches documents where the specified field is present
    and the field contains a legitimate value.</p>

    @name ejs.ExistsFilter

    @desc
    Filters documents where a specified field exists and contains a value.

    @param {String} fieldName the field name that must exists and contain a value.
    */
  ejs.ExistsFilter = function (fieldName) {

    /**
         The internal filter object. Use <code>get()</code>

         @member ejs.ExistsFilter
         @property {Object} filter
         */
    var filter = {
      exists: {
        field: fieldName
      }
    };

    return {

      /**
            Sets the field to check for missing values.

            @member ejs.ExistsFilter
            @param {String} name A name of the field.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (name) {
        if (name == null) {
          return filter.exists.field;
        }

        filter.exists.field = name;
        return this;
      },
      
      /**
            Sets the filter name.

            @member ejs.ExistsFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.exists._name;
        }

        filter.exists._name = name;
        return this;
      },
      
      /**
             Returns the filter container as a JSON string

             @member ejs.ExistsFilter
             @returns {String} JSON representation of the existsFilter object
             */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.ExistsFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
             Returns the filter object.

             @member ejs.ExistsFilter
             @returns {Object} filter object
             */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>A filter that restricts matched results/docs to a geographic bounding box described by
    the specified lon and lat coordinates. The format conforms with the GeoJSON specification.</p>

    @name ejs.GeoBboxFilter

    @desc
    Filter results to those which are contained within the defined bounding box.

    @param {String} fieldName the document property/field containing the Geo Point (lon/lat).

    */
  ejs.GeoBboxFilter = function (fieldName) {

    /**
         The internal filter object. Use <code>_self()</code>

         @member ejs.GeoBboxFilter
         @property {Object} filter
         */
    var filter = {
      geo_bounding_box: {}
    };

    filter.geo_bounding_box[fieldName] = {};

    return {

      /**
            Sets the fields to filter against.

            @member ejs.GeoBboxFilter
            @param {String} f A valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (f) {
        var oldValue = filter.geo_bounding_box[fieldName];
    
        if (f == null) {
          return fieldName;
        }

        delete filter.geo_bounding_box[fieldName];
        fieldName = f;
        filter.geo_bounding_box[f] = oldValue;
    
        return this;
      },
      
      /**
             Sets the top-left coordinate of the bounding box

             @member ejs.GeoBboxFilter
             @param {GeoPoint} p A valid GeoPoint object
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      topLeft: function (p) {
        if (p == null) {
          return filter.geo_bounding_box[fieldName].top_left;
        }
      
        if (isGeoPoint(p)) {
          filter.geo_bounding_box[fieldName].top_left = p._self();
        } else {
          throw new TypeError('Argument must be a GeoPoint');
        }
        
        return this;
      },

      /**
             Sets the bottom-right coordinate of the bounding box

             @member ejs.GeoBboxFilter
             @param {GeoPoint} p A valid GeoPoint object
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      bottomRight: function (p) {
        if (p == null) {
          return filter.geo_bounding_box[fieldName].bottom_right;
        }
      
        if (isGeoPoint(p)) {
          filter.geo_bounding_box[fieldName].bottom_right = p._self();
        } else {
          throw new TypeError('Argument must be a GeoPoint');
        }
        
        return this;
      },

      /**
            Sets the type of the bounding box execution. Valid values are
            "memory" and "indexed".  Default is memory.

            @member ejs.GeoBboxFilter
            @param {String} type The execution type as a string.  
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      type: function (type) {
        if (type == null) {
          return filter.geo_bounding_box.type;
        }

        type = type.toLowerCase();
        if (type === 'memory' || type === 'indexed') {
          filter.geo_bounding_box.type = type;
        }
        
        return this;
      },
      
      /**
            If the lat/long points should be normalized to lie within their
            respective normalized ranges.
            
            Normalized ranges are:
            lon = -180 (exclusive) to 180 (inclusive) range
            lat = -90 to 90 (both inclusive) range

            @member ejs.GeoBboxFilter
            @param {String} trueFalse True if the coordinates should be normalized. False otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      normalize: function (trueFalse) {
        if (trueFalse == null) {
          return filter.geo_bounding_box.normalize;
        }

        filter.geo_bounding_box.normalize = trueFalse;
        return this;
      },
      
      /**
            Sets the filter name.

            @member ejs.GeoBboxFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.geo_bounding_box._name;
        }

        filter.geo_bounding_box._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.GeoBboxFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.geo_bounding_box._cache;
        }

        filter.geo_bounding_box._cache = trueFalse;
        return this;
      },
    
      /**
            Sets the cache key.

            @member ejs.GeoBboxFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.geo_bounding_box._cache_key;
        }

        filter.geo_bounding_box._cache_key = key;
        return this;
      },
      
      /**
             Returns the filter container as a JSON string

             @member ejs.GeoBboxFilter
             @returns {String} JSON representation of the notFilter object
             */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.GeoBboxFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
             Returns the filter object.

             @member ejs.GeoBboxFilter
             @returns {Object} filter object
             */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>A filter that restricts matched results/docs to a given distance from the
    point of origin. The format conforms with the GeoJSON specification.</p>

    @name ejs.GeoDistanceFilter

    @desc
    Filter results to those which fall within the given distance of the point of origin.

    @param {String} fieldName the document property/field containing the Geo Point (lon/lat).

    */
  ejs.GeoDistanceFilter = function (fieldName) {

    /**
         The internal filter object. Use <code>_self()</code>

         @member ejs.GeoDistanceFilter
         @property {Object} filter
         */
    var filter = {
      geo_distance: {
      }
    };

    filter.geo_distance[fieldName] = [0, 0];
    
    return {

      /**
            Sets the fields to filter against.

            @member ejs.GeoDistanceFilter
            @param {String} f A valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (f) {
        var oldValue = filter.geo_distance[fieldName];
    
        if (f == null) {
          return fieldName;
        }

        delete filter.geo_distance[fieldName];
        fieldName = f;
        filter.geo_distance[f] = oldValue;
    
        return this;
      },
      
      /**
             Sets the numeric distance to be used.  The distance can be a 
             numeric value, and then the unit (either mi or km can be set) 
             controlling the unit. Or a single string with the unit as well.

             @member ejs.GeoDistanceFilter
             @param {Number} numericDistance the numeric distance
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      distance: function (numericDistance) {
        if (numericDistance == null) {
          return filter.geo_distance.distance;
        }
      
        if (!isNumber(numericDistance)) {
          throw new TypeError('Argument must be a numeric value');
        }
        
        filter.geo_distance.distance = numericDistance;
        return this;
      },

      /**
             Sets the distance unit.  Valid values are "mi" for miles or "km"
             for kilometers. Defaults to "km".

             @member ejs.GeoDistanceFilter
             @param {Number} unit the unit of distance measure.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      unit: function (unit) {
        if (unit == null) {
          return filter.geo_distance.unit;
        }
      
        unit = unit.toLowerCase();
        if (unit === 'mi' || unit === 'km') {
          filter.geo_distance.unit = unit;
        }
        
        return this;
      },

      /**
             Sets the point of origin in which distance will be measured from

             @member ejs.GeoDistanceFilter
             @param {GeoPoint} p A valid GeoPoint object.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      point: function (p) {
        if (p == null) {
          return filter.geo_distance[fieldName];
        }
      
        if (isGeoPoint(p)) {
          filter.geo_distance[fieldName] = p._self();
        } else {
          throw new TypeError('Argument must be a GeoPoint');
        }
        
        return this;
      },


      /**
            How to compute the distance. Can either be arc (better precision) 
            or plane (faster). Defaults to arc.

            @member ejs.GeoDistanceFilter
            @param {String} type The execution type as a string.  
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      distanceType: function (type) {
        if (type == null) {
          return filter.geo_distance.distance_type;
        }

        type = type.toLowerCase();
        if (type === 'arc' || type === 'plane') {
          filter.geo_distance.distance_type = type;
        }
        
        return this;
      },
      
      /**
            If the lat/long points should be normalized to lie within their
            respective normalized ranges.
            
            Normalized ranges are:
            lon = -180 (exclusive) to 180 (inclusive) range
            lat = -90 to 90 (both inclusive) range

            @member ejs.GeoDistanceFilter
            @param {String} trueFalse True if the coordinates should be normalized. False otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      normalize: function (trueFalse) {
        if (trueFalse == null) {
          return filter.geo_distance.normalize;
        }

        filter.geo_distance.normalize = trueFalse;
        return this;
      },
      
      /**
            Will an optimization of using first a bounding box check will be 
            used. Defaults to memory which will do in memory checks. Can also 
            have values of indexed to use indexed value check, or none which 
            disables bounding box optimization.

            @member ejs.GeoDistanceFilter
            @param {String} t optimization type of memory, indexed, or none.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      optimizeBbox: function (t) {
        if (t == null) {
          return filter.geo_distance.optimize_bbox;
        }

        t = t.toLowerCase();
        if (t === 'memory' || t === 'indexed' || t === 'none') {
          filter.geo_distance.optimize_bbox = t;
        }
        
        return this;
      },
      
      /**
            Sets the filter name.

            @member ejs.GeoDistanceFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.geo_distance._name;
        }

        filter.geo_distance._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.GeoDistanceFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.geo_distance._cache;
        }

        filter.geo_distance._cache = trueFalse;
        return this;
      },
    
      /**
            Sets the cache key.

            @member ejs.GeoDistanceFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.geo_distance._cache_key;
        }

        filter.geo_distance._cache_key = key;
        return this;
      },
      
      /**
             Returns the filter container as a JSON string

             @member ejs.GeoDistanceFilter
             @returns {String} JSON representation of the notFilter object
             */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.GeoDistanceFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
             Returns the filter object.

             @member ejs.GeoDistanceFilter
             @returns {Object} filter object
             */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>A filter that restricts matched results/docs to a given distance range from the
    point of origin. The format conforms with the GeoJSON specification.</p>

    @name ejs.GeoDistanceRangeFilter

    @desc
    Filter results to those which fall within the given distance range of the point of origin.

    @param {String} fieldName the document property/field containing the Geo Point (lon/lat).

    */
  ejs.GeoDistanceRangeFilter = function (fieldName) {

    /**
         The internal filter object. Use <code>_self()</code>

         @member ejs.GeoDistanceRangeFilter
         @property {Object} filter
         */
    var filter = {
      geo_distance_range: {}
    };

    filter.geo_distance_range[fieldName] = [0, 0];
    
    return {

     /**
            Sets the fields to filter against.

            @member ejs.GeoDistanceRangeFilter
            @param {String} f A valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (f) {
        var oldValue = filter.geo_distance_range[fieldName];

        if (f == null) {
          return fieldName;
        }

        delete filter.geo_distance_range[fieldName];
        fieldName = f;
        filter.geo_distance_range[f] = oldValue;

        return this;
      },
      
      /**
             * Sets the start point of the distance range

             @member ejs.GeoDistanceRangeFilter
             @param {Number} numericDistance the numeric distance
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      from: function (numericDistance) {
        if (numericDistance == null) {
          return filter.geo_distance_range.from;
        }
      
        if (!isNumber(numericDistance)) {
          throw new TypeError('Argument must be a numeric value');
        }
        
        filter.geo_distance_range.from = numericDistance;
        return this;
      },

      /**
             * Sets the end point of the distance range

             @member ejs.GeoDistanceRangeFilter
             @param {Number} numericDistance the numeric distance
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      to: function (numericDistance) {
        if (numericDistance == null) {
          return filter.geo_distance_range.to;
        }

        if (!isNumber(numericDistance)) {
          throw new TypeError('Argument must be a numeric value');
        }
            
        filter.geo_distance_range.to = numericDistance;
        return this;
      },

      /**
            Should the first from (if set) be inclusive or not. 
            Defaults to true

            @member ejs.GeoDistanceRangeFilter
            @param {Boolean} trueFalse true to include, false to exclude 
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      includeLower: function (trueFalse) {
        if (trueFalse == null) {
          return filter.geo_distance_range.include_lower;
        }

        filter.geo_distance_range.include_lower = trueFalse;
        return this;
      },

      /**
            Should the last to (if set) be inclusive or not. Defaults to true.

            @member ejs.GeoDistanceRangeFilter
            @param {Boolean} trueFalse true to include, false to exclude 
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      includeUpper: function (trueFalse) {
        if (trueFalse == null) {
          return filter.geo_distance_range.include_upper;
        }

        filter.geo_distance_range.include_upper = trueFalse;
        return this;
      },

      /**
            Greater than value.  Same as setting from to the value, and 
            include_lower to false,

            @member ejs.GeoDistanceRangeFilter
            @param {Number} val the numeric distance
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      gt: function (val) {
        if (val == null) {
          return filter.geo_distance_range.gt;
        }

        if (!isNumber(val)) {
          throw new TypeError('Argument must be a numeric value');
        }
        
        filter.geo_distance_range.gt = val;
        return this;
      },

      /**
            Greater than or equal to value.  Same as setting from to the value,
            and include_lower to true.

            @member ejs.GeoDistanceRangeFilter
            @param {Number} val the numeric distance
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      gte: function (val) {
        if (val == null) {
          return filter.geo_distance_range.gte;
        }

        if (!isNumber(val)) {
          throw new TypeError('Argument must be a numeric value');
        }
        
        filter.geo_distance_range.gte = val;
        return this;
      },

      /**
            Less than value.  Same as setting to to the value, and include_upper 
            to false.

            @member ejs.GeoDistanceRangeFilter
            @param {Number} val the numeric distance
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lt: function (val) {
        if (val == null) {
          return filter.geo_distance_range.lt;
        }

        if (!isNumber(val)) {
          throw new TypeError('Argument must be a numeric value');
        }
        
        filter.geo_distance_range.lt = val;
        return this;
      },

      /**
            Less than or equal to value.  Same as setting to to the value, 
            and include_upper to true.

            @member ejs.GeoDistanceRangeFilter
            @param {Number} val the numeric distance
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lte: function (val) {
        if (val == null) {
          return filter.geo_distance_range.lte;
        }

        if (!isNumber(val)) {
          throw new TypeError('Argument must be a numeric value');
        }
        
        filter.geo_distance_range.lte = val;
        return this;
      },
      
      /**
             Sets the distance unit.  Valid values are "mi" for miles or "km"
             for kilometers. Defaults to "km".

             @member ejs.GeoDistanceRangeFilter
             @param {Number} unit the unit of distance measure.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      unit: function (unit) {
        if (unit == null) {
          return filter.geo_distance_range.unit;
        }
      
        unit = unit.toLowerCase();
        if (unit === 'mi' || unit === 'km') {
          filter.geo_distance_range.unit = unit;
        }
        
        return this;
      },

      /**
             Sets the point of origin in which distance will be measured from

             @member ejs.GeoDistanceRangeFilter
             @param {GeoPoint} p A valid GeoPoint object.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      point: function (p) {
        if (p == null) {
          return filter.geo_distance_range[fieldName];
        }
      
        if (isGeoPoint(p)) {
          filter.geo_distance_range[fieldName] = p._self();
        } else {
          throw new TypeError('Argument must be a GeoPoint');
        }
        
        return this;
      },


      /**
            How to compute the distance. Can either be arc (better precision) 
            or plane (faster). Defaults to arc.

            @member ejs.GeoDistanceRangeFilter
            @param {String} type The execution type as a string.  
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      distanceType: function (type) {
        if (type == null) {
          return filter.geo_distance_range.distance_type;
        }

        type = type.toLowerCase();
        if (type === 'arc' || type === 'plane') {
          filter.geo_distance_range.distance_type = type;
        }
        
        return this;
      },
      
      /**
            If the lat/long points should be normalized to lie within their
            respective normalized ranges.
            
            Normalized ranges are:
            lon = -180 (exclusive) to 180 (inclusive) range
            lat = -90 to 90 (both inclusive) range

            @member ejs.GeoDistanceRangeFilter
            @param {String} trueFalse True if the coordinates should be normalized. False otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      normalize: function (trueFalse) {
        if (trueFalse == null) {
          return filter.geo_distance_range.normalize;
        }

        filter.geo_distance_range.normalize = trueFalse;
        return this;
      },
      
      /**
            Will an optimization of using first a bounding box check will be 
            used. Defaults to memory which will do in memory checks. Can also 
            have values of indexed to use indexed value check, or none which 
            disables bounding box optimization.

            @member ejs.GeoDistanceRangeFilter
            @param {String} t optimization type of memory, indexed, or none.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      optimizeBbox: function (t) {
        if (t == null) {
          return filter.geo_distance_range.optimize_bbox;
        }

        t = t.toLowerCase();
        if (t === 'memory' || t === 'indexed' || t === 'none') {
          filter.geo_distance_range.optimize_bbox = t;
        }
        
        return this;
      },
      
      /**
            Sets the filter name.

            @member ejs.GeoDistanceRangeFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.geo_distance_range._name;
        }

        filter.geo_distance_range._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.GeoDistanceRangeFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.geo_distance_range._cache;
        }

        filter.geo_distance_range._cache = trueFalse;
        return this;
      },
    
      /**
            Sets the cache key.

            @member ejs.GeoDistanceRangeFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.geo_distance_range._cache_key;
        }

        filter.geo_distance_range._cache_key = key;
        return this;
      },
      /**
             Returns the filter container as a JSON string

             @member ejs.GeoDistanceRangeFilter
             @returns {String} JSON representation of the notFilter object
             */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.GeoDistanceRangeFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
             Returns the filter object.

             @member ejs.GeoDistanceRangeFilter
             @returns {Object} filter object
             */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>A filter for locating documents that fall within a polygon of points. Simply provide a lon/lat
    for each document as a Geo Point type. The format conforms with the GeoJSON specification.</p>

    @name ejs.GeoPolygonFilter

    @desc
    Filter results to those which are contained within the polygon of points.

    @param {String} fieldName the document property/field containing the Geo Point (lon/lat).
    */
  ejs.GeoPolygonFilter = function (fieldName) {

    /**
         The internal filter object. Use <code>_self()</code>

         @member ejs.GeoPolygonFilter
         @property {Object} filter
         */
    var filter = {
      geo_polygon: {}
    };

    filter.geo_polygon[fieldName] = {
      points: []
    };

    return {

      /**
           Sets the fields to filter against.

           @member ejs.GeoPolygonFilter
           @param {String} f A valid field name.
           @returns {Object} returns <code>this</code> so that calls can be chained.
           */
      field: function (f) {
        var oldValue = filter.geo_polygon[fieldName];

        if (f == null) {
          return fieldName;
        }

        delete filter.geo_polygon[fieldName];
        fieldName = f;
        filter.geo_polygon[f] = oldValue;

        return this;
      },
       
      /**
             Sets a series of points that represent a polygon.  If passed a 
             single <code>GeoPoint</code> object, it is added to the current 
             list of points.  If passed an array of <code>GeoPoint</code> 
             objects it replaces all current values. 

             @member ejs.GeoPolygonFilter
             @param {Array} pointsArray the array of points that represent the polygon
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      points: function (p) {
        var i, len;
        
        if (p == null) {
          return filter.geo_polygon[fieldName].points;
        }
      
        if (isGeoPoint(p)) {
          filter.geo_polygon[fieldName].points.push(p._self());
        } else if (isArray(p)) {
          filter.geo_polygon[fieldName].points = [];
          for (i = 0, len = p.length; i < len; i++) {
            if (!isGeoPoint(p[i])) {
              throw new TypeError('Argument must be Array of GeoPoints');
            }
            
            filter.geo_polygon[fieldName].points.push(p[i]._self());
          }
        } else {
          throw new TypeError('Argument must be a GeoPoint or Array of GeoPoints');
        }
        
        return this;
      },

      /**
            If the lat/long points should be normalized to lie within their
            respective normalized ranges.
            
            Normalized ranges are:
            lon = -180 (exclusive) to 180 (inclusive) range
            lat = -90 to 90 (both inclusive) range

            @member ejs.GeoPolygonFilter
            @param {String} trueFalse True if the coordinates should be normalized. False otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      normalize: function (trueFalse) {
        if (trueFalse == null) {
          return filter.geo_polygon.normalize;
        }

        filter.geo_polygon.normalize = trueFalse;
        return this;
      },
      
      /**
            Sets the filter name.

            @member ejs.GeoPolygonFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.geo_polygon._name;
        }

        filter.geo_polygon._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.GeoPolygonFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.geo_polygon._cache;
        }

        filter.geo_polygon._cache = trueFalse;
        return this;
      },
    
      /**
            Sets the cache key.

            @member ejs.GeoPolygonFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.geo_polygon._cache_key;
        }

        filter.geo_polygon._cache_key = key;
        return this;
      },
      
      /**
             Returns the filter container as a JSON string

             @member ejs.GeoPolygonFilter
             @returns {String} JSON representation of the notFilter object
             */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.GeoPolygonFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
             Returns the filter object.

             @member ejs.GeoPolygonFilter
             @returns {Object} filter object
             */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>Efficient filtering of documents containing shapes indexed using the 
    geo_shape type.</p>

    <p>Much like the geo_shape type, the geo_shape filter uses a grid square 
    representation of the filter shape to find those documents which have shapes 
    that relate to the filter shape in a specified way. In order to do this, the 
    field being queried must be of geo_shape type. The filter will use the same 
    PrefixTree configuration as defined for the field.</p>

    @name ejs.GeoShapeFilter

    @desc
    A Filter to find documents with a geo_shapes matching a specific shape.

    */
  ejs.GeoShapeFilter = function (field) {

    /**
         The internal filter object. <code>Use _self()</code>
         @member ejs.GeoShapeFilter
         @property {Object} GeoShapeFilter
         */
    var filter = {
      geo_shape: {}
    };

    filter.geo_shape[field] = {};

    return {

      /**
            Sets the field to filter against.

            @member ejs.GeoShapeFilter
            @param {String} f A valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (f) {
        var oldValue = filter.geo_shape[field];
  
        if (f == null) {
          return field;
        }

        delete filter.geo_shape[field];
        field = f;
        filter.geo_shape[f] = oldValue;
  
        return this;
      },

      /**
            Sets the shape

            @member ejs.GeoShapeFilter
            @param {String} shape A valid <code>Shape</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      shape: function (shape) {
        if (shape == null) {
          return filter.geo_shape[field].shape;
        }

        if (filter.geo_shape[field].indexed_shape != null) {
          delete filter.geo_shape[field].indexed_shape;
        }
      
        filter.geo_shape[field].shape = shape._self();
        return this;
      },

      /**
            Sets the indexed shape.  Use this if you already have shape definitions
            already indexed.

            @member ejs.GeoShapeFilter
            @param {String} indexedShape A valid <code>IndexedShape</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      indexedShape: function (indexedShape) {
        if (indexedShape == null) {
          return filter.geo_shape[field].indexed_shape;
        }

        if (filter.geo_shape[field].shape != null) {
          delete filter.geo_shape[field].shape;
        }
      
        filter.geo_shape[field].indexed_shape = indexedShape._self();
        return this;
      },

      /**
            Sets the shape relation type.  A relationship between a Query Shape 
            and indexed Shapes that will be used to determine if a Document 
            should be matched or not.  Valid values are:  intersects, disjoint,
            and within.

            @member ejs.GeoShapeFilter
            @param {String} indexedShape A valid <code>IndexedShape</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      relation: function (relation) {
        if (relation == null) {
          return filter.geo_shape[field].relation;
        }

        relation = relation.toLowerCase();
        if (relation === 'intersects' || relation === 'disjoint' || relation === 'within') {
          filter.geo_shape[field].relation = relation;
        }
    
        return this;
      },

      /**
            <p>Sets the spatial strategy.</p>  
            <p>Valid values are:</p>
            
            <dl>
                <dd><code>recursive</code> - default, recursively traverse nodes in
                  the spatial prefix tree.  This strategy has support for 
                  searching non-point shapes.</dd>
                <dd><code>term</code> - uses a large TermsFilter on each node
                  in the spatial prefix tree.  It only supports the search of 
                  indexed Point shapes.</dd>
            </dl>

            <p>This is an advanced setting, use with care.</p>
            
            @since elasticsearch 0.90
            @member ejs.GeoShapeFilter
            @param {String} strategy The strategy as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      strategy: function (strategy) {
        if (strategy == null) {
          return filter.geo_shape[field].strategy;
        }

        strategy = strategy.toLowerCase();
        if (strategy === 'recursive' || strategy === 'term') {
          filter.geo_shape[field].strategy = strategy;
        }
        
        return this;
      },
        
      /**
            Sets the filter name.

            @member ejs.GeoShapeFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.geo_shape._name;
        }

        filter.geo_shape._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.GeoShapeFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.geo_shape._cache;
        }

        filter.geo_shape._cache = trueFalse;
        return this;
      },
    
      /**
            Sets the cache key.

            @member ejs.GeoShapeFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.geo_shape._cache_key;
        }

        filter.geo_shape._cache_key = key;
        return this;
      },
        
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.GeoShapeFilter
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.GeoShapeFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
            Retrieves the internal <code>filter</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.GeoShapeFilter
            @returns {String} returns this object's internal <code>filter</code> property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>The has_child filter results in parent documents that have child docs 
    matching the query being returned.</p>

    @name ejs.HasChildFilter

    @desc
    Returns results that have child documents matching the filter.

    @param {Object} qry A valid query object.
    @param {String} type The child type
    */
  ejs.HasChildFilter = function (qry, type) {

    if (!isQuery(qry)) {
      throw new TypeError('No Query object found');
    }
    
    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.HasChildFilter
         @property {Object} query
         */
    var filter = {
      has_child: {
        query: qry._self(),
        type: type
      }
    };

    return {

      /**
            Sets the query

            @member ejs.HasChildFilter
            @param {Query} q A valid Query object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (q) {
        if (q == null) {
          return filter.has_child.query;
        }
  
        if (!isQuery(q)) {
          throw new TypeError('Argument must be a Query object');
        }
        
        filter.has_child.query = q._self();
        return this;
      },

      /**
            Sets the filter

            @since elasticsearch 0.90
            @member ejs.HasChildFilter
            @param {Query} f A valid Filter object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      filter: function (f) {
        if (f == null) {
          return filter.has_child.filter;
        }
  
        if (!isFilter(f)) {
          throw new TypeError('Argument must be a Filter object');
        }
        
        filter.has_child.filter = f._self();
        return this;
      },

      /**
            Sets the child document type to search against

            @member ejs.HasChildFilter
            @param {String} t A valid type name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      type: function (t) {
        if (t == null) {
          return filter.has_child.type;
        }
  
        filter.has_child.type = t;
        return this;
      },

      /**
            Sets the scope of the filter.  A scope allows to run facets on the 
            same scope name that will work against the child documents. 

            @deprecated since elasticsearch 0.90
            @member ejs.HasChildFilter
            @param {String} s The scope name as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (s) {
        return this;
      },

      /**
            Sets the filter name.

            @member ejs.HasChildFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.has_child._name;
        }

        filter.has_child._name = name;
        return this;
      },
          
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.HasChildFilter
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.HasChildFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
            Retrieves the internal <code>filter</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.HasChildFilter
            @returns {String} returns this object's internal <code>filter</code> property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>The has_parent results in child documents that have parent docs matching 
    the query being returned.</p>

    @name ejs.HasParentFilter

    @desc
    Returns results that have parent documents matching the filter.

    @param {Object} qry A valid query object.
    @param {String} parentType The child type
    */
  ejs.HasParentFilter = function (qry, parentType) {

    if (!isQuery(qry)) {
      throw new TypeError('No Query object found');
    }
    
    /**
         The internal filter object. <code>Use _self()</code>
         @member ejs.HasParentFilter
         @property {Object} query
         */
    var filter = {
      has_parent: {
        query: qry._self(),
        parent_type: parentType
      }
    };

    return {

      /**
            Sets the query

            @member ejs.HasParentFilter
            @param {Object} q A valid Query object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (q) {
        if (q == null) {
          return filter.has_parent.query;
        }

        if (!isQuery(q)) {
          throw new TypeError('Argument must be a Query object');
        }
        
        filter.has_parent.query = q._self();
        return this;
      },
      
      /**
            Sets the filter

            @since elasticsearch 0.90
            @member ejs.HasParentFilter
            @param {Object} f A valid Filter object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      filter: function (f) {
        if (f == null) {
          return filter.has_parent.filter;
        }

        if (!isFilter(f)) {
          throw new TypeError('Argument must be a Filter object');
        }
        
        filter.has_parent.filter = f._self();
        return this;
      },

      /**
            Sets the child document type to search against

            @member ejs.HasParentFilter
            @param {String} t A valid type name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      parentType: function (t) {
        if (t == null) {
          return filter.has_parent.parent_type;
        }

        filter.has_parent.parent_type = t;
        return this;
      },

      /**
            Sets the scope of the filter.  A scope allows to run facets on the 
            same scope name that will work against the parent documents. 

            @deprecated since elasticsearch 0.90
            @member ejs.HasParentFilter
            @param {String} s The scope name as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (s) {
        return this;
      },
    
      /**
            Sets the filter name.

            @member ejs.HasParentFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.has_parent._name;
        }

        filter.has_parent._name = name;
        return this;
      },
    
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.HasParentFilter
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.HasParentFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
            Retrieves the internal <code>filter</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.HasParentFilter
            @returns {String} returns this object's internal <code>filter</code> property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>Filters documents that only have the provided ids. Note, this filter 
    does not require the _id field to be indexed since it works using the 
    _uid field.</p>

    @name ejs.IdsFilter

    @desc
    Matches documents with the specified id(s).

    @param {Array || String} ids A single document id or a list of document ids.
    */
  ejs.IdsFilter = function (ids) {

    /**
         The internal filter object. <code>Use get()</code>
         @member ejs.IdsFilter
         @property {Object} filter
         */
    var filter = {
      ids: {}
    };
  
    if (isString(ids)) {
      filter.ids.values = [ids];
    } else if (isArray(ids)) {
      filter.ids.values = ids;
    } else {
      throw new TypeError('Argument must be a string or an array');
    }

    return {

      /**
            Sets the values array or adds a new value. if val is a string, it
            is added to the list of existing document ids.  If val is an
            array it is set as the document values and replaces any existing values.

            @member ejs.IdsFilter
            @param {Array || String} val An single document id or an array of document ids.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      values: function (val) {
        if (val == null) {
          return filter.ids.values;
        }
  
        if (isString(val)) {
          filter.ids.values.push(val);
        } else if (isArray(val)) {
          filter.ids.values = val;
        } else {
          throw new TypeError('Argument must be a string or an array');
        }
      
        return this;
      },

      /**
            Sets the type as a single type or an array of types.  If type is a
            string, it is added to the list of existing types.  If type is an
            array, it is set as the types and overwrites an existing types. This
            parameter is optional.

            @member ejs.IdsFilter
            @param {Array || String} type A type or a list of types
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      type: function (type) {
        if (filter.ids.type == null) {
          filter.ids.type = [];
        }
      
        if (type == null) {
          return filter.ids.type;
        }
      
        if (isString(type)) {
          filter.ids.type.push(type);
        } else if (isArray(type)) {
          filter.ids.type = type;
        } else {
          throw new TypeError('Argument must be a string or an array');
        }
      
        return this;
      },

      /**
            Sets the filter name.

            @member ejs.IdsFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.ids._name;
        }

        filter.ids._name = name;
        return this;
      },
             
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.IdsFilter
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.IdsFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
            Retrieves the internal <code>filter</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.IdsFilter
            @returns {String} returns this object's internal <code>filter</code> property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>The indices filter can be used when executed across multiple indices, 
    allowing to have a filter that executes only when executed on an index that 
    matches a specific list of indices, and another filter that executes when it 
    is executed on an index that does not match the listed indices.</p>

    @name ejs.IndicesFilter

    @desc
    A configurable filter that is dependent on the index name.

    @param {Object} fltr A valid filter object.
    @param {String || Array} indices a single index name or an array of index 
      names.
    */
  ejs.IndicesFilter = function (fltr, indices) {

    if (!isFilter(fltr)) {
      throw new TypeError('Argument must be a Filter');
    }
  
    /**
         The internal filter object. <code>Use _self()</code>
         @member ejs.IndicesFilter
         @property {Object} filter
         */
    var filter = {
      indices: {
        filter: fltr._self()
      }
    };

    if (isString(indices)) {
      filter.indices.indices = [indices];
    } else if (isArray(indices)) {
      filter.indices.indices = indices;
    } else {
      throw new TypeError('Argument must be a string or array');
    }

    return {

      /**
            Sets the indicies the filter should match.  When passed a string,
            the index name is added to the current list of indices.  When passed
            an array, it overwites all current indices.

            @member ejs.IndicesFilter
            @param {String || Array} i A single index name or an array of index names.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      indices: function (i) {
        if (i == null) {
          return filter.indices.indices;
        }

        if (isString(i)) {
          filter.indices.indices.push(i);
        } else if (isArray(i)) {
          filter.indices.indices = i;
        } else {
          throw new TypeError('Argument must be a string or array');
        }

        return this;
      },
  
      /**
            Sets the filter to be used when executing on one of the indicies 
            specified.

            @member ejs.IndicesFilter
            @param {Object} f A valid Filter object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      filter: function (f) {
        if (f == null) {
          return filter.indices.filter;
        }

        if (!isFilter(f)) {
          throw new TypeError('Argument must be a Filter');
        }
      
        filter.indices.filter = f._self();
        return this;
      },

      /**
            Sets the filter to be used on an index that does not match an index
            name in the indices list.  Can also be set to "none" to not match any
            documents or "all" to match all documents.

            @member ejs.IndicesFilter
            @param {Object || String} f A valid Filter object or "none" or "all"
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      noMatchFilter: function (f) {
        if (f == null) {
          return filter.indices.no_match_filter;
        }

        if (isString(f)) {
          f = f.toLowerCase();
          if (f === 'none' || f === 'all') {
            filter.indices.no_match_filter = f;
          }
        } else if (isFilter(f)) {
          filter.indices.no_match_filter = f._self();
        } else {
          throw new TypeError('Argument must be string or Filter');
        }
    
        return this;
      },
    
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.IndicesFilter
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.IndicesFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
            Retrieves the internal <code>filter</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.IndicesFilter
            @returns {String} returns this object's internal <code>filter</code> property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>A limit filter limits the number of documents (per shard) to execute on.</p>

    @name ejs.LimitFilter

    @desc
    Limits the number of documents to execute on.

    @param {Integer} limit The number of documents to execute on.
    */
  ejs.LimitFilter = function (limit) {

    /**
         The internal filter object. <code>Use get()</code>
         @member ejs.LimitFilter
         @property {Object} filter
         */
    var filter = {
      limit: {
        value: limit
      }
    };

    return {

      /**
            Sets the limit value.

            @member ejs.LimitFilter
            @param {Integer} val An The number of documents to execute on.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      value: function (val) {
        if (val == null) {
          return filter.limit.value;
        }

        if (!isNumber(val)) {
          throw new TypeError('Argument must be a numeric value');
        }
            
        filter.limit.value = val;
        return this;
      },
           
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.LimitFilter
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.LimitFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
            Retrieves the internal <code>filter</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.LimitFilter
            @returns {String} returns this object's internal <code>filter</code> property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>This filter can be used to match on all the documents
    in a given set of collections and/or types.</p>

    @name ejs.MatchAllFilter

    @desc
    <p>A filter that matches on all documents</p>

     */
  ejs.MatchAllFilter = function () {

    /**
         The internal Query object. Use <code>get()</code>.
         @member ejs.MatchAllFilter
         @property {Object} filter
         */
    var filter = {
      match_all: {}
    };

    return {

      /**
             Serializes the internal <em>filter</em> object as a JSON string.
             @member ejs.MatchAllFilter
             @returns {String} Returns a JSON representation of the object.
             */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.MatchAllFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
            This method is used to retrieve the raw filter object. It's designed
            for internal use when composing and serializing queries.
            @member ejs.MatchAllFilter
            @returns {Object} Returns the object's <em>filter</em> property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>An missingFilter matches documents where the specified field contains no legitimate value.</p>

    @name ejs.MissingFilter

    @desc
    Filters documents where a specific field has no value present.

    @param {String} fieldName the field name to check for missing values.
    */
  ejs.MissingFilter = function (fieldName) {

    /**
         The internal filter object. Use <code>get()</code>

         @member ejs.MissingFilter
         @property {Object} filter
         */
    var filter = {
      missing: {
        field: fieldName
      }
    };

    return {

      /**
            Sets the field to check for missing values.

            @member ejs.MissingFilter
            @param {String} name A name of the field.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (name) {
        if (name == null) {
          return filter.missing.field;
        }

        filter.missing.field = name;
        return this;
      },
      
      /**
            Checks if the field doesn't exist.

            @member ejs.MissingFilter
            @param {Boolean} trueFalse True to check if the field doesn't exist.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      existence: function (trueFalse) {
        if (trueFalse == null) {
          return filter.missing.existence;
        }

        filter.missing.existence = trueFalse;
        return this;
      },

      /**
            Checks if the field has null values.

            @member ejs.MissingFilter
            @param {Boolean} trueFalse True to check if the field has nulls.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      nullValue: function (trueFalse) {
        if (trueFalse == null) {
          return filter.missing.null_value;
        }

        filter.missing.null_value = trueFalse;
        return this;
      },
            
      /**
            Sets the filter name.

            @member ejs.MissingFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.missing._name;
        }

        filter.missing._name = name;
        return this;
      },
      
      /**
             Returns the filter container as a JSON string

             @member ejs.MissingFilter
             @returns {String} JSON representation of the missingFilter object
             */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.MissingFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
             Returns the filter object.

             @member ejs.MissingFilter
             @returns {Object} filter object
             */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>Nested filters allow you to search against content within objects that are
       embedded inside of other objects. It is similar to <code>XPath</code> 
       expressions in <code>XML</code> both conceptually and syntactically.</p>

    <p>
    The filter is executed against the nested objects / docs as if they were 
    indexed as separate docs and resulting in the root 
    parent doc (or parent nested mapping).</p>
  
    @name ejs.NestedFilter

    @desc
    <p>Constructs a filter that is capable of executing a filter against objects
       nested within a document.</p>

    @param {String} path The nested object path.

     */
  ejs.NestedFilter = function (path) {

    /**
         The internal Filter object. Use <code>_self()</code>.
         @member ejs.NestedFilter
         @property {Object} filter
         */
    var filter = {
      nested: {
        path: path
      }
    };

    return {
    
      /**
             Sets the root context for the nested filter.
             @member ejs.NestedFilter
             @param {String} p The path defining the root for the nested filter.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      path: function (p) {
        if (p == null) {
          return filter.nested.path;
        }
    
        filter.nested.path = p;
        return this;
      },

      /**
             Sets the nested query to be executed.
             @member ejs.NestedFilter
             @param {Query} oQuery A valid Query object
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      query: function (oQuery) {
        if (oQuery == null) {
          return filter.nested.query;
        }
    
        if (!isQuery(oQuery)) {
          throw new TypeError('Argument must be a Query object');
        }
        
        filter.nested.query = oQuery._self();
        return this;
      },


      /**
             Sets the nested filter to be executed.
             @member ejs.NestedFilter
             @param {Object} oFilter A valid Filter object
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      filter: function (oFilter) {
        if (oFilter == null) {
          return filter.nested.filter;
        }
    
        if (!isFilter(oFilter)) {
          throw new TypeError('Argument must be a Filter object');
        }
        
        filter.nested.filter = oFilter._self();
        return this;
      },

      /**
            Sets the boost value of the nested <code>Query</code>.

            @member ejs.NestedFilter
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return filter.nested.boost;
        }

        filter.nested.boost = boost;
        return this;
      },
    
      /**
            If the nested query should be "joined" with the parent document.
            Defaults to false.

            @member ejs.NestedFilter
            @param {Boolean} trueFalse If the query should be joined or not.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      join: function (trueFalse) {
        if (trueFalse == null) {
          return filter.nested.join;
        }

        filter.nested.join = trueFalse;
        return this;
      },
    
      /**
            Sets the scope of the filter.  A scope allows to run facets on the 
            same scope name that will work against the nested documents. 

            @deprecated since elasticsearch 0.90
            @member ejs.NestedFilter
            @param {String} s The scope name as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (s) {
        return this;
      },
      
      /**
            Sets the filter name.

            @member ejs.NestedFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.nested._name;
        }

        filter.nested._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.NestedFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.nested._cache;
        }

        filter.nested._cache = trueFalse;
        return this;
      },
  
      /**
            Sets the cache key.

            @member ejs.NestedFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.nested._cache_key;
        }

        filter.nested._cache_key = key;
        return this;
      },
    
      /**
             Serializes the internal <em>filter</em> object as a JSON string.
             @member ejs.NestedFilter
             @returns {String} Returns a JSON representation of the termFilter object.
             */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.NestedFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
            This method is used to retrieve the raw filter object. It's designed
            for internal use when composing and serializing filters.
            
            @member ejs.NestedFilter
            @returns {Object} Returns the object's <em>filter</em> property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>A container Filter that excludes the documents matched by the
    contained filter.</p>

    @name ejs.NotFilter

    @desc
    Container filter that excludes the matched documents of the contained filter.

    @param {Object} oFilter a valid Filter object such as a termFilter, etc.
    */
  ejs.NotFilter = function (oFilter) {

    if (!isFilter(oFilter)) {
      throw new TypeError('Argument must be a Filter');
    }
    
    /**
         The internal filter object. Use <code>_self()</code>

         @member ejs.NotFilter
         @property {Object} filter
         */
    var filter = {
      not: oFilter._self()
    };

    return {

      /**
             Sets the filter

             @member ejs.NotFilter
             @param {Object} fltr A valid filter object such as a termFilter, etc.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      filter: function (fltr) {
        if (fltr == null) {
          return filter.not;
        }
      
        if (!isFilter(fltr)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        filter.not = fltr._self();
        return this;
      },

      /**
            Sets the filter name.

            @member ejs.NotFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.not._name;
        }

        filter.not._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.NotFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.not._cache;
        }

        filter.not._cache = trueFalse;
        return this;
      },
    
      /**
            Sets the cache key.

            @member ejs.NotFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.not._cache_key;
        }

        filter.not._cache_key = key;
        return this;
      },
      
      /**
             Returns the filter container as a JSON string

             @member ejs.NotFilter
             @returns {String} JSON representation of the notFilter object
             */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.NotFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
             Returns the filter object.

             @member ejs.NotFilter
             @returns {Object} filter object
             */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>Filters documents with fields that have values within a certain numeric 
    range. Similar to range filter, except that it works only with numeric 
    values, and the filter execution works differently.</p>
    
    <p>The numeric range filter works by loading all the relevant field values 
    into memory, and checking for the relevant docs if they satisfy the range 
    requirements. This requires more memory since the numeric range data are 
    loaded to memory, but can provide a significant increase in performance.</p> 
    
    <p>Note, if the relevant field values have already been loaded to memory, 
    for example because it was used in facets or was sorted on, then this 
    filter should be used.</p>

    @name ejs.NumericRangeFilter

    @desc
    A Filter that only accepts numeric values within a specified range.

    @param {string} fieldName The name of the field to filter on.
    */
  ejs.NumericRangeFilter = function (fieldName) {

    /**
         The internal filter object. Use <code>get()</code>

         @member ejs.NumericRangeFilter
         @property {Object} filter
         */
    var filter = {
      numeric_range: {}
    };

    filter.numeric_range[fieldName] = {};

    return {

      /**
             Returns the field name used to create this object.

             @member ejs.NumericRangeFilter
             @param {String} field the field name
             @returns {Object} returns <code>this</code> so that calls can be 
              chained. Returns {String}, field name when field is not specified.
             */
      field: function (field) {
        var oldValue = filter.numeric_range[fieldName];
      
        if (field == null) {
          return fieldName;
        }
      
        delete filter.numeric_range[fieldName];
        fieldName = field;
        filter.numeric_range[fieldName] = oldValue;
      
        return this;
      },
      
      /**
             Sets the endpoint for the current range.

             @member ejs.NumericRangeFilter
             @param {Number} startPoint A numeric value representing the start of the range
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      from: function (from) {
        if (from == null) {
          return filter.numeric_range[fieldName].from;
        }
        
        if (!isNumber(from)) {
          throw new TypeError('Argument must be a numeric value');
        }
        
        filter.numeric_range[fieldName].from = from;
        return this;
      },

      /**
             Sets the endpoint for the current range.

             @member ejs.NumericRangeFilter
             @param {Number} endPoint A numeric value representing the end of the range
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      to: function (to) {
        if (to == null) {
          return filter.numeric_range[fieldName].to;
        }

        if (!isNumber(to)) {
          throw new TypeError('Argument must be a numeric value');
        }
        
        filter.numeric_range[fieldName].to = to;
        return this;
      },

      /**
            Should the first from (if set) be inclusive or not. 
            Defaults to true

            @member ejs.NumericRangeFilter
            @param {Boolean} trueFalse true to include, false to exclude 
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      includeLower: function (trueFalse) {
        if (trueFalse == null) {
          return filter.numeric_range[fieldName].include_lower;
        }

        filter.numeric_range[fieldName].include_lower = trueFalse;
        return this;
      },

      /**
            Should the last to (if set) be inclusive or not. Defaults to true.

            @member ejs.NumericRangeFilter
            @param {Boolean} trueFalse true to include, false to exclude 
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      includeUpper: function (trueFalse) {
        if (trueFalse == null) {
          return filter.numeric_range[fieldName].include_upper;
        }

        filter.numeric_range[fieldName].include_upper = trueFalse;
        return this;
      },

      /**
            Greater than value.  Same as setting from to the value, and 
            include_lower to false,

            @member ejs.NumericRangeFilter
            @param {Variable Type} val the value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      gt: function (val) {
        if (val == null) {
          return filter.numeric_range[fieldName].gt;
        }

        if (!isNumber(val)) {
          throw new TypeError('Argument must be a numeric value');
        }
        
        filter.numeric_range[fieldName].gt = val;
        return this;
      },

      /**
            Greater than or equal to value.  Same as setting from to the value,
            and include_lower to true.

            @member ejs.NumericRangeFilter
            @param {Variable Type} val the value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      gte: function (val) {
        if (val == null) {
          return filter.numeric_range[fieldName].gte;
        }

        if (!isNumber(val)) {
          throw new TypeError('Argument must be a numeric value');
        }
        
        filter.numeric_range[fieldName].gte = val;
        return this;
      },

      /**
            Less than value.  Same as setting to to the value, and include_upper 
            to false.

            @member ejs.NumericRangeFilter
            @param {Variable Type} val the value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lt: function (val) {
        if (val == null) {
          return filter.numeric_range[fieldName].lt;
        }

        if (!isNumber(val)) {
          throw new TypeError('Argument must be a numeric value');
        }
        
        filter.numeric_range[fieldName].lt = val;
        return this;
      },

      /**
            Less than or equal to value.  Same as setting to to the value, 
            and include_upper to true.

            @member ejs.NumericRangeFilter
            @param {Variable Type} val the value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lte: function (val) {
        if (val == null) {
          return filter.numeric_range[fieldName].lte;
        }

        if (!isNumber(val)) {
          throw new TypeError('Argument must be a numeric value');
        }
        
        filter.numeric_range[fieldName].lte = val;
        return this;
      },
                          
      /**
            Sets the filter name.

            @member ejs.NumericRangeFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.numeric_range._name;
        }

        filter.numeric_range._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.NumericRangeFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.numeric_range._cache;
        }

        filter.numeric_range._cache = trueFalse;
        return this;
      },

      /**
            Sets the cache key.

            @member ejs.NumericRangeFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.numeric_range._cache_key;
        }

        filter.numeric_range._cache_key = key;
        return this;
      },
      
      /**
             Returns the filter container as a JSON string.

             @member ejs.NumericRangeFilter
             @returns {String} JSON representation of the numericRangeFilter object
             */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.NumericRangeFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
             Returns the filter object.

             @member ejs.NumericRangeFilter
             @returns {Object} filter object
             */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    A container filter that allows Boolean OR composition of filters.

    @name ejs.OrFilter

    @desc
    A container Filter that allows Boolean OR composition of filters.

    @param {Filter || Array} filters A valid Filter or array of Filters.
    */
  ejs.OrFilter = function (filters) {

    /**
         The internal filter object. Use <code>_self()</code>

         @member ejs.OrFilter
         @property {Object} filter
         */
    var filter, i, len;

    filter = {
      or: {
        filters: []
      }
    };

    if (isFilter(filters)) {
      filter.or.filters.push(filters._self());
    } else if (isArray(filters)) {
      for (i = 0, len = filters.length; i < len; i++) {
        if (!isFilter(filters[i])) {
          throw new TypeError('Argument must be array of Filters');
        }
        
        filter.or.filters.push(filters[i]._self());
      }
    } else {
      throw new TypeError('Argument must be a Filter or array of Filters');
    }

    return {

      /**
             Updates the filters.  If passed a single Filter it is added to 
             the existing filters.  If passed an array of Filters, they 
             replace all existing Filters.

             @member ejs.OrFilter
             @param {Filter || Array} fltr A Filter or array of Filters
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      filters: function (fltr) {
        var i, len;
        
        if (fltr == null) {
          return filter.or.filters;
        }
      
        if (isFilter(fltr)) {
          filter.or.filters.push(fltr._self());
        } else if (isArray(fltr)) {
          filter.or.filters = [];
          for (i = 0, len = fltr.length; i < len; i++) {
            if (!isFilter(fltr[i])) {
              throw new TypeError('Argument must be an array of Filters');
            }
            
            filter.or.filters.push(fltr[i]._self());
          }
        } else {
          throw new TypeError('Argument must be a Filter or array of Filters');
        }
        
        return this;
      },

      /**
            Sets the filter name.

            @member ejs.OrFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.or._name;
        }

        filter.or._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.OrFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.or._cache;
        }

        filter.or._cache = trueFalse;
        return this;
      },

      /**
            Sets the cache key.

            @member ejs.OrFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.or._cache_key;
        }

        filter.or._cache_key = key;
        return this;
      },
      
      /**
             Returns the filter container as a JSON string

             @member ejs.OrFilter
             @returns {String} JSON representation of the orFilter object
             */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.OrFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
             Returns the filter object.

             @member ejs.OrFilter
             @returns {Object} filter object
             */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>Filters documents that have fields containing terms with a specified prefix (not analyzed). Similar
    to phrase query, except that it acts as a filter. Can be placed within queries that accept a filter.</p>

    @name ejs.PrefixFilter

    @desc
    Filters documents that have fields containing terms with a specified prefix.

    @param {String} fieldName the field name to be used during matching.
    @param {String} prefix the prefix value.
    */
  ejs.PrefixFilter = function (fieldName, prefix) {

    /**
         The internal filter object. Use <code>get()</code>

         @member ejs.PrefixFilter
         @property {Object} filter
         */
    var filter = {
      prefix: {}
    };

    filter.prefix[fieldName] = prefix;
    
    return {

      /**
             Returns the field name used to create this object.

             @member ejs.PrefixFilter
             @param {String} field the field name
             @returns {Object} returns <code>this</code> so that calls can be 
              chained. Returns {String}, field name when field is not specified.
             */
      field: function (field) {
        var oldValue = filter.prefix[fieldName];
      
        if (field == null) {
          return fieldName;
        }
      
        delete filter.prefix[fieldName];
        fieldName = field;
        filter.prefix[fieldName] = oldValue;
      
        return this;
      },
      
      /**
             Sets the prefix to search for.

             @member ejs.PrefixFilter
             @param {String} value the prefix value to match
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      prefix: function (value) {
        if (value == null) {
          return filter.prefix[fieldName];
        }
      
        filter.prefix[fieldName] = value;
        return this;
      },

      /**
            Sets the filter name.

            @member ejs.PrefixFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.prefix._name;
        }

        filter.prefix._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.PrefixFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.prefix._cache;
        }

        filter.prefix._cache = trueFalse;
        return this;
      },

      /**
            Sets the cache key.

            @member ejs.PrefixFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.prefix._cache_key;
        }

        filter.prefix._cache_key = key;
        return this;
      },
      
      /**
             Returns the filter container as a JSON string

             @member ejs.PrefixFilter
             @returns {String} JSON representation of the prefixFilter object
             */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.PrefixFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
             Returns the filter object.

             @member ejs.PrefixFilter
             @returns {Object} filter object
             */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>Wraps any query to be used as a filter. Can be placed within queries 
    that accept a filter.</p>

    <p>The result of the filter is not cached by default.  Set the cache 
    parameter to true to cache the result of the filter. This is handy when the 
    same query is used on several (many) other queries.</p> 
  
    <p>Note, the process of caching the first execution is higher when not 
    caching (since it needs to satisfy different queries).</p>
  
    @name ejs.QueryFilter

    @desc
    Filters documents matching the wrapped query.

    @param {Object} qry A valid query object.
    */
  ejs.QueryFilter = function (qry) {

    if (!isQuery(qry)) {
      throw new TypeError('Argument must be a Query');
    }
    
    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.QueryFilter
         @property {Object} query
         */
    var filter = {
      fquery: {
        query: qry._self()
      }
    };

    return {

      /**
            Sets the query

            @member ejs.QueryFilter
            @param {Object} q A valid Query object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (q) {
        if (q == null) {
          return filter.fquery.query;
        }

        if (!isQuery(q)) {
          throw new TypeError('Argument must be a Query');
        }
        
        filter.fquery.query = q._self();
        return this;
      },

      /**
            Sets the filter name.

            @member ejs.QueryFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.fquery._name;
        }

        filter.fquery._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.QueryFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.fquery._cache;
        }

        filter.fquery._cache = trueFalse;
        return this;
      },
  
      /**
            Sets the cache key.

            @member ejs.QueryFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.fquery._cache_key;
        }

        filter.fquery._cache_key = key;
        return this;
      },
            
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.QueryFilter
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.QueryFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
            Retrieves the internal <code>filter</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.QueryFilter
            @returns {String} returns this object's internal <code>filter</code> property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>Matches documents with fields that have terms within a certain range.</p>

    @name ejs.RangeFilter

    @desc
    Filters documents with fields that have terms within a certain range.

    @param {String} field A valid field name.
    */
  ejs.RangeFilter = function (field) {

    /**
         The internal filter object. <code>Use get()</code>
         @member ejs.RangeFilter
         @property {Object} filter
         */
    var filter = {
      range: {}
    };

    filter.range[field] = {};

    return {

      /**
             The field to run the filter against.

             @member ejs.RangeFilter
             @param {String} f A single field name.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      field: function (f) {
        var oldValue = filter.range[field];

        if (f == null) {
          return field;
        }

        delete filter.range[field];
        field = f;
        filter.range[f] = oldValue;

        return this;
      },

      /**
            The lower bound. Defaults to start from the first.

            @member ejs.RangeFilter
            @param {Variable Type} f the lower bound value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      from: function (f) {
        if (f == null) {
          return filter.range[field].from;
        }

        filter.range[field].from = f;
        return this;
      },

      /**
            The upper bound. Defaults to unbounded.

            @member ejs.RangeFilter
            @param {Variable Type} t the upper bound value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      to: function (t) {
        if (t == null) {
          return filter.range[field].to;
        }

        filter.range[field].to = t;
        return this;
      },

      /**
            Should the first from (if set) be inclusive or not. 
            Defaults to true

            @member ejs.RangeFilter
            @param {Boolean} trueFalse true to include, false to exclude 
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      includeLower: function (trueFalse) {
        if (trueFalse == null) {
          return filter.range[field].include_lower;
        }

        filter.range[field].include_lower = trueFalse;
        return this;
      },

      /**
            Should the last to (if set) be inclusive or not. Defaults to true.

            @member ejs.RangeFilter
            @param {Boolean} trueFalse true to include, false to exclude 
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      includeUpper: function (trueFalse) {
        if (trueFalse == null) {
          return filter.range[field].include_upper;
        }

        filter.range[field].include_upper = trueFalse;
        return this;
      },

      /**
            Greater than value.  Same as setting from to the value, and 
            include_lower to false,

            @member ejs.RangeFilter
            @param {Variable Type} val the value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      gt: function (val) {
        if (val == null) {
          return filter.range[field].gt;
        }

        filter.range[field].gt = val;
        return this;
      },

      /**
            Greater than or equal to value.  Same as setting from to the value,
            and include_lower to true.

            @member ejs.RangeFilter
            @param {Variable Type} val the value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      gte: function (val) {
        if (val == null) {
          return filter.range[field].gte;
        }

        filter.range[field].gte = val;
        return this;
      },

      /**
            Less than value.  Same as setting to to the value, and include_upper 
            to false.

            @member ejs.RangeFilter
            @param {Variable Type} val the value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lt: function (val) {
        if (val == null) {
          return filter.range[field].lt;
        }

        filter.range[field].lt = val;
        return this;
      },

      /**
            Less than or equal to value.  Same as setting to to the value, 
            and include_upper to true.

            @member ejs.RangeFilter
            @param {Variable Type} val the value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lte: function (val) {
        if (val == null) {
          return filter.range[field].lte;
        }

        filter.range[field].lte = val;
        return this;
      },
                          
      /**
            Sets the filter name.

            @member ejs.RangeFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.range._name;
        }

        filter.range._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.RangeFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.range._cache;
        }

        filter.range._cache = trueFalse;
        return this;
      },

      /**
            Sets the cache key.

            @member ejs.RangeFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.range._cache_key;
        }

        filter.range._cache_key = key;
        return this;
      },
    
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.RangeFilter
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.RangeFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
            Retrieves the internal <code>filter</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.RangeFilter
            @returns {String} returns this object's internal <code>filter</code> property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>Filters documents that have a field value matching a regular expression. 
    Based on Lucene 4.0 RegexpFilter which uses automaton to efficiently iterate 
    over index terms.</p>

    @name ejs.RegexpFilter

    @desc
    Matches documents that have fields matching a regular expression.

    @param {String} field A valid field name.
    @param {String} value A regex pattern.
    */
  ejs.RegexpFilter = function (field, value) {

    /**
         The internal filter object. <code>Use get()</code>
         @member ejs.RegexpFilter
         @property {Object} filter
         */
    var filter = {
      regexp: {}
    };

    filter.regexp[field] = {
      value: value
    };

    return {

      /**
             The field to run the filter against.

             @member ejs.RegexpFilter
             @param {String} f A single field name.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      field: function (f) {
        var oldValue = filter.regexp[field];

        if (f == null) {
          return field;
        }

        delete filter.regexp[field];
        field = f;
        filter.regexp[f] = oldValue;

        return this;
      },

      /**
            The regexp value.

            @member ejs.RegexpFilter
            @param {String} p A string regexp
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      value: function (p) {
        if (p == null) {
          return filter.regexp[field].value;
        }

        filter.regexp[field].value = p;
        return this;
      },

      /**
            The regex flags to use.  Valid flags are:
        
            INTERSECTION - Support for intersection notation
            COMPLEMENT - Support for complement notation
            EMPTY - Support for the empty language symbol: #
            ANYSTRING - Support for the any string symbol: @
            INTERVAL - Support for numerical interval notation: <n-m>
            NONE - Disable support for all syntax options
            ALL - Enables support for all syntax options
        
            Use multiple flags by separating with a "|" character.  Example:
        
            INTERSECTION|COMPLEMENT|EMPTY

            @member ejs.RegexpFilter
            @param {String} f The flags as a string, separate multiple flags with "|".
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      flags: function (f) {
        if (f == null) {
          return filter.regexp[field].flags;
        }

        filter.regexp[field].flags = f;
        return this;
      },
  
      /**
            The regex flags to use as a numeric value.  Advanced use only,
            it is probably better to stick with the <code>flags</code> option.
        
            @member ejs.RegexpFilter
            @param {String} v The flags as a numeric value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      flagsValue: function (v) {
        if (v == null) {
          return filter.regexp[field].flags_value;
        }

        filter.regexp[field].flags_value = v;
        return this;
      },

      /**
            Sets the filter name.

            @member ejs.RegexpFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.regexp._name;
        }

        filter.regexp._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.RegexpFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.regexp._cache;
        }

        filter.regexp._cache = trueFalse;
        return this;
      },

      /**
            Sets the cache key.

            @member ejs.RegexpFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.regexp._cache_key;
        }

        filter.regexp._cache_key = key;
        return this;
      },
      
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.RegexpFilter
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
        
            @member ejs.RegexpFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
  
      /**
            Retrieves the internal <code>filter</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.RegexpFilter
            @returns {String} returns this object's internal <code>filter</code> property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>A filter allowing to define scripts as filters</p>

    @name ejs.ScriptFilter

    @desc
    A filter allowing to define scripts as filters.

    @param {String} script The script as a string.
    */
  ejs.ScriptFilter = function (script) {

    /**
         The internal filter object. <code>Use get()</code>
         @member ejs.ScriptFilter
         @property {Object} filter
         */
    var filter = {
      script: {
        script: script
      }
    };

    return {

      /**
            Sets the script.

            @member ejs.ScriptFilter
            @param {String} s The script as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      script: function (s) {
        if (s == null) {
          return filter.script.script;
        }
  
        filter.script.script = s;
        return this;
      },

      /**
            Sets parameters that will be applied to the script.  Overwrites 
            any existing params.

            @member ejs.ScriptFilter
            @param {Object} p An object where the keys are the parameter name and 
              values are the parameter value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      params: function (p) {
        if (p == null) {
          return filter.script.params;
        }
    
        filter.script.params = p;
        return this;
      },
    
      /**
            Sets the script language.

            @member ejs.ScriptFilter
            @param {String} lang The script language, default mvel.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lang: function (lang) {
        if (lang == null) {
          return filter.script.lang;
        }
  
        filter.script.lang = lang;
        return this;
      },
    
      /**
            Sets the filter name.

            @member ejs.ScriptFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.script._name;
        }

        filter.script._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.ScriptFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.script._cache;
        }

        filter.script._cache = trueFalse;
        return this;
      },

      /**
            Sets the cache key.

            @member ejs.ScriptFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.script._cache_key;
        }

        filter.script._cache_key = key;
        return this;
      },
             
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.ScriptFilter
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.ScriptFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
            Retrieves the internal <code>filter</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.ScriptFilter
            @returns {String} returns this object's internal <code>filter</code> property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>Constructs a filter for docs matching any of the terms added to this
    object. Unlike a RangeFilter this can be used for filtering on multiple
    terms that are not necessarily in a sequence.</p>

    @name ejs.TermFilter

    @desc
    Constructs a filter for docs matching the term added to this object.

    @param {string} fieldName The document field/fieldName to execute the filter against.
    @param {string} term The literal term used to filter the results.
    */
  ejs.TermFilter = function (fieldName, term) {

    /**
         The internal filter object. Use the get() method for access.
         @member ejs.TermFilter
         @property {Object} filter
         */
    var filter = {
      term: {}
    };

    filter.term[fieldName] = term;

    return {

      /**
             Provides access to the filter fieldName used to construct the 
             termFilter object.
             
             @member ejs.TermFilter
             @param {String} f the fieldName term
             @returns {Object} returns <code>this</code> so that calls can be chained.
              When k is not specified, Returns {String}, the filter fieldName used to construct 
              the termFilter object.
             */
      field: function (f) {
        var oldValue = filter.term[fieldName];
      
        if (f == null) {
          return fieldName;
        }
      
        delete filter.term[fieldName];
        fieldName = f;
        filter.term[fieldName] = oldValue;
      
        return this;
      },

      /**
             Provides access to the filter term used to construct the 
             termFilter object.
             
             @member ejs.TermFilter
             @returns {Object} returns <code>this</code> so that calls can be chained.
              When k is not specified, Returns {String}, the filter term used 
              to construct the termFilter object.
             */
      term: function (v) {
        if (v == null) {
          return filter.term[fieldName];
        }
      
        filter.term[fieldName] = v;
        return this;
      },

      /**
            Sets the filter name.

            @member ejs.TermFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.term._name;
        }

        filter.term._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.TermFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.term._cache;
        }

        filter.term._cache = trueFalse;
        return this;
      },

      /**
            Sets the cache key.

            @member ejs.TermFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.term._cache_key;
        }

        filter.term._cache_key = key;
        return this;
      },
      
      /**
             Serializes the internal filter object as a JSON string.
             
             @member ejs.TermFilter
             @returns {String} Returns a JSON representation of the termFilter object.
             */
      toString: function () {
        return JSON.stringify(filter);
      },
    
      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.TermFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
            Returns the filter object.  For internal use only.
            
            @member ejs.TermFilter
            @returns {Object} Returns the object's filter property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>Filters documents that have fields that match any of the provided 
    terms (not analyzed)</p>

    @name ejs.TermsFilter

    @desc
    A Filter that matches documents containing provided terms. 

    @param {String} field the document field/key to filter against
    @param {String || Array} terms a single term or an array of terms.
    */
  ejs.TermsFilter = function (field, terms) {

    /**
         The internal filter object. <code>Use get()</code>
         @member ejs.TermsFilter
         @property {Object} filter
         */
    var filter = {
      terms: {}
    },
    
    // make sure we are setup for a list of terms
    setupTerms = function () {
      if (!isArray(filter.terms[field])) {
        filter.terms[field] = [];
      }
    },
    
    // make sure we are setup for a terms lookup
    setupLookup = function () {
      if (isArray(filter.terms[field])) {
        filter.terms[field] = {};
      }
    };
   
    if (isArray(terms)) {
      filter.terms[field] = terms;
    } else {
      filter.terms[field] = [terms];
    }

    return {

      /**
            Sets the fields to filter against.

            @member ejs.TermsFilter
            @param {String} f A valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (f) {
        var oldValue = filter.terms[field];
    
        if (f == null) {
          return field;
        }

        delete filter.terms[field];
        field = f;
        filter.terms[f] = oldValue;
    
        return this;
      },
  
      /**
            Sets the terms.  If t is a String, it is added to the existing
            list of terms.  If t is an array, the list of terms replaces the
            existing terms.

            @member ejs.TermsFilter
            @param {String || Array} t A single term or an array or terms.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      terms: function (t) {
        setupTerms();
        if (t == null) {
          return filter.terms[field];
        }
        
        if (isArray(t)) {
          filter.terms[field] = t;
        } else {
          filter.terms[field].push(t);
        }
    
        return this;
      },

      /**
            Sets the index the document containing the terms is in when 
            performing a terms lookup.  Defaults to the index currently 
            being searched.

            @since elasticsearch 0.90
            @member ejs.TermsFilter
            @param {String} idx A valid index name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      index: function (idx) {
        setupLookup();
        if (idx == null) {
          return filter.terms[field].index;
        }
        
        filter.terms[field].index = idx;
        return this;
      },

      /**
            Sets the type the document containing the terms when performing a 
            terms lookup.

            @since elasticsearch 0.90
            @member ejs.TermsFilter
            @param {String} type A valid type name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      type: function (type) {
        setupLookup();
        if (type == null) {
          return filter.terms[field].type;
        }
        
        filter.terms[field].type = type;
        return this;
      },


      /**
            Sets the document id of the document containing the terms to use
            when performing a terms lookup.

            @since elasticsearch 0.90
            @member ejs.TermsFilter
            @param {String} id A valid index name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      id: function (id) {
        setupLookup();
        if (id == null) {
          return filter.terms[field].id;
        }
        
        filter.terms[field].id = id;
        return this;
      },
      
      /**
            Sets the path/field name where the terms in the source document
            are located when performing a terms lookup.

            @since elasticsearch 0.90
            @member ejs.TermsFilter
            @param {String} path A valid index name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      path: function (path) {
        setupLookup();
        if (path == null) {
          return filter.terms[field].path;
        }
        
        filter.terms[field].path = path;
        return this;
      },
      
      /**
            Sets the way terms filter executes is by iterating over the terms 
            provided and finding matches docs (loading into a bitset) and 
            caching it.  Valid values are: plain, bool, bool_nocache, and, 
            and_nocache, or, or_nocache.  Defaults to plain.

            @member ejs.TermsFilter
            @param {String} e A valid execution method.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      execution: function (e) {
        if (e == null) {
          return filter.terms.execution;
        }
      
        e = e.toLowerCase();
        if (e === 'plain' || e === 'bool' || e === 'bool_nocache' || 
          e === 'and' || e === 'and_nocache' || e === 'or' || e === 'or_nocache') {
          filter.terms.execution = e;
        }
      
        return this;
      },
    
      /**
            Sets the filter name.

            @member ejs.TermsFilter
            @param {String} name A name for the filter.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      name: function (name) {
        if (name == null) {
          return filter.terms._name;
        }

        filter.terms._name = name;
        return this;
      },

      /**
            Enable or disable caching of the filter

            @member ejs.TermsFilter
            @param {Boolean} trueFalse True to cache the filter, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return filter.terms._cache;
        }

        filter.terms._cache = trueFalse;
        return this;
      },
  
      /**
            Sets the cache key.

            @member ejs.TermsFilter
            @param {String} key the cache key as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (key) {
        if (key == null) {
          return filter.terms._cache_key;
        }

        filter.terms._cache_key = key;
        return this;
      },
    
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.TermsFilter
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.TermsFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
            Retrieves the internal <code>filter</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.TermsFilter
            @returns {String} returns this object's internal <code>filter</code> property.
            */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>A Filter that filters results by a specified index type.</p>

    @name ejs.TypeFilter

    @desc
    Filter results by a specified index type.

    @param {String} type the index type to filter on.
    */
  ejs.TypeFilter = function (type) {

    /**
         The internal filter object. Use <code>get()</code>

         @member ejs.TypeFilter
         @property {Object} filter
         */
    var filter = {
      "type": {
        "value": type
      }
    };

    return {

      /**
             * Sets the type

             @member ejs.TypeFilter
             @param {String} type the index type to filter on
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      type: function (type) {
        if (type == null) {
          return filter.type.value;
        }
      
        filter.type.value = type;
        return this;
      },

      /**
             Returns the filter container as a JSON string

             @member ejs.TypeFilter
             @returns {String} JSON representation of the notFilter object
             */
      toString: function () {
        return JSON.stringify(filter);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.TypeFilter
            @returns {String} the type of object
            */
      _type: function () {
        return 'filter';
      },
      
      /**
             Returns the filter object.

             @member ejs.TypeFilter
             @returns {Object} filter object
             */
      _self: function () {
        return filter;
      }
    };
  };

  /**
    @class
    <p>The <code>Document</code> object provides an interface for working with
    Documents.  Some example operations avaiable are storing documents,
    retreiving documents, updating documents, and deleting documents from an
    index.</p>

    @name ejs.Document

    @desc
    Object used to create, replace, update, and delete documents

    <div class="alert-message block-message info">
        <p>
            <strong>Tip: </strong>
            It is not necessary to first create a index or content-type. If either of these
            do not exist, they will be automatically created when you attempt to store the document.
        </p>
    </div>
    
    @param {String} index The index the document belongs to.
    @param {String} type The type the document belongs to.
    @param {String} id The id of the document.  The id is required except 
      for indexing.  If no id is specified during indexing, one will be
      created for you.
      
    */
  ejs.Document = function (index, type, id) {

    var params = {},
    
      // converts client params to a string param1=val1&param2=val1
      genParamStr = function () {
        var clientParams = genClientParams(),
        parts = [];
        
        for (var p in clientParams) {
          if (!has(clientParams, p)) {
            continue;
          }
          
          parts.push(p + '=' + encodeURIComponent(clientParams[p]));
        }
        
        return parts.join('&');
      },
      
      // Converts the stored params into parameters that will be passed
      // to a client.  Certain parameter are skipped, and others require
      // special processing before being sent to the client.
      genClientParams = function () {
        var clientParams = {};
        
        for (var param in params) {
          if (!has(params, param)) {
            continue;
          }
          
          // skip params that don't go in the query string
          if (param === 'upsert' || param === 'source' ||
            param === 'script' || param === 'lang' || param === 'params') {
            continue;
          }
                    
          // process all over params
          var paramVal = params[param];
          if (isArray(paramVal)) {
            paramVal = paramVal.join();
          }
            
          clientParams[param] = paramVal;
        }
        
        return clientParams;
      };
      
    return {

      /**
             Sets the index the document belongs to.

             @member ejs.Document
             @param {String} idx The index name
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      index: function (idx) {
        if (idx == null) {
          return index;
        }
        
        index = idx;
        return this;
      },
      
      /**
             Sets the type of the document.

             @member ejs.Document
             @param {String} t The type name
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      type: function (t) {
        if (t == null) {
          return type;
        }
        
        type = t;
        return this;
      },
      
      /**
             Sets the id of the document.

             @member ejs.Document
             @param {String} i The document id
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      id: function (i) {
        if (i == null) {
          return id;
        }
        
        id = i;
        return this;
      },
      
      /**
             <p>Sets the routing value.<p> 

             <p>By default, the shard the document is placed on is controlled by using a 
             hash of the document’s id value. For more explicit control, this routing value 
             will be fed into the hash function used by the router.</p>
             
             <p>This option is valid during the following operations:
                <code>index, delete, get, and update</code></p>

             @member ejs.Document
             @param {String} route The routing value
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      routing: function (route) {
        if (route == null) {
          return params.routing;
        }
        
        params.routing = route;
        return this;
      },
      
      /**
             <p>Sets parent value for a child document.</p>  

             <p>When indexing a child document, the routing value is automatically set to be 
             the same as it’s parent, unless the routing value is explicitly specified 
             using the routing parameter.</p>
             
             <p>This option is valid during the following operations:
                 <code>index, delete, get, and update.</code></p>

             @member ejs.Document
             @param {String} parent The parent value
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      parent: function (parent) {
        if (parent == null) {
          return params.parent;
        }
        
        params.parent = parent;
        return this;
      },
      
      /**
             <p>Sets timestamp of the document.</p>  

             <p>By default the timestamp will be set to the time the docuement was indexed.</p>
             
             <p>This option is valid during the following operations:
                <code>index</code> and <code>update</code></p>

             @member ejs.Document
             @param {String} parent The parent value
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      timestamp: function (ts) {
        if (ts == null) {
          return params.timestamp;
        }
        
        params.timestamp = ts;
        return this;
      },
      
      /**
             </p>Sets the documents time to live (ttl).</p>  

             The expiration date that will be set for a document with a provided ttl is relative 
             to the timestamp of the document, meaning it can be based on the time of indexing or 
             on any time provided.</p> 

             <p>The provided ttl must be strictly positive and can be a number (in milliseconds) 
             or any valid time value such as <code>"1d", "2h", "5m",</code> etc.</p>
             
             <p>This option is valid during the following operations:
                <code>index</code> and <code>update</code></p>

             @member ejs.Document
             @param {String} length The amount of time after which the document
              will expire.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      ttl: function (length) {
        if (length == null) {
          return params.ttl;
        }
        
        params.ttl = length;
        return this;
      },
      
      /**
             <p>Set's a timeout for the given operation.</p>  

             If the primary shard has not completed the operation before this value, an error will
             occur.  The default timeout is 1 minute. The provided timeout must be strictly positive 
             and can be a number (in milliseconds) or any valid time value such as 
             <code>"1d", "2h", "5m",</code> etc.</p>
             
             <p>This option is valid during the following operations:
                <code>index, delete,</code> and <code>update</code></p>

             @member ejs.Document
             @param {String} length The amount of time after which the operation
              will timeout.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      timeout: function (length) {
        if (length == null) {
          return params.timeout;
        }
        
        params.timeout = length;
        return this;
      },
      
      /**
             <p>Enables the index to be refreshed immediately after the operation
             occurs. This is an advanced setting and can lead to performance
             issues.</p>
             
             <p>This option is valid during the following operations:
                <code>index, delete, get,</code> and <code>update</code></p>

             @member ejs.Document
             @param {Boolean} trueFalse If the index should be refreshed or not.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      refresh: function (trueFalse) {
        if (trueFalse == null) {
          return params.refresh;
        }
        
        params.refresh = trueFalse;
        return this;
      },
      
      /**
             <p>Sets the document version.</p>  

             Used for optimistic concurrency control when set.  If the version of the currently 
             indexed document is less-than or equal to the version specified, an error is produced, 
             otherwise the operation is permitted.</p>

             <p>By default, internal versioning is used that starts at <code>1</code> and 
             increments with each update.</p>
             
             <p>This option is valid during the following operations:
                <code>index, delete,</code> and <code>update</code></p>

             @member ejs.Document
             @param {Long} version A positive long value
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      version: function (version) {
        if (version == null) {
          return params.version;
        }
        
        params.version = version;
        return this;
      },
      
      /**
             <p>Sets the version type.</p>  

             </p>Possible values are:</p>
             
             <dl>
                <dd><code>internal</code> - the default</dd>
                <dd><code>external</code> - to use your own version (ie. version number from a database)</dd>
             </dl>
             
             <p>This option is valid during the following operations:
                <code>index, delete,</code> and <code>update</code></p>

             @member ejs.Document
             @param {String} vt A version type (internal or external)
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      versionType: function (vt) {
        // internal or external
        if (vt == null) {
          return params.version_type;
        }
        
        vt = vt.toLowerCase();
        if (vt === 'internal' || vt === 'external') {
          params.version_type = vt;
        }
        
        return this;
      },
      
      /**
             <p>Perform percolation at index time.</p>  

             <p>Set to * to run document against all registered queries.  It is also possible 
             to set this value to a string in query string format, ie. <code>"color:green"</code>.</p>
             
             <p>This option is valid during the following operations:
                <code>index</code> and <code>update</code></p>

             @member ejs.Document
             @param {String} qry A percolation query string
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      percolate: function (qry) {
        if (qry == null) {
          return params.percolate;
        }
        
        params.percolate = qry;
        return this;
      },
      
      /**
             <p>Sets the indexing operation type.</p>  

             <p>Valid values are:</p>
             
             <dl>
                <dd><code>index</code> - the default, create or replace</dd>
                <dd><code>create</code> - create only</dd>
             </dl>
             
             <p>This option is valid during the following operations:
                <code>index</code></p>

             @member ejs.Document
             @param {String} op The operation type (index or create)
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      opType: function (op) {
        if (op == null) {
          return params.op_type;
        }
        
        op = op.toLowerCase();
        if (op === 'index' || op === 'create') {
          params.op_type = op;
        }
        
        return this;
      },
      
      /**
             <p>Sets the replication mode.</p>  

             <p>Valid values are:</p>
             
             <dl>
                <dd><code>async</code> - asynchronous replication to slaves</dd>
                <dd><code>sync</code> - synchronous replication to the slaves</dd>
                <dd><code>default</code> - the currently configured system default.</dd> 
             </dl>
             
             <p>This option is valid during the following operations:
                <code>index, delete,</code> and <code>update</code></p>

             @member ejs.Document
             @param {String} r The replication mode (async, sync, or default)
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      replication: function (r) {
        if (r == null) {
          return params.replication;
        }
        
        r = r.toLowerCase();
        if (r === 'async' || r === 'sync' || r === 'default') {
          params.replication = r;
        }
        
        return this;
      },
      
      /**
             <p>Sets the write consistency.</p>  

             <p>Valid values are:</p>
             
             <dl>
                <dd><code>one - only requires write to one shard</dd>
                <dd><code>quorum - requires writes to quorum <code>(N/2 + 1)</code></dd>
                <dd><code>all - requires write to succeed on all shards</dd>
                <dd><code>default - the currently configured system default</dd>
             </dl>
             
             <p>This option is valid during the following operations:
                <code>index, delete,</code> and <code>update</code></p>

             @member ejs.Document
             @param {String} c The write consistency (one, quorum, all, or default)
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      consistency: function (c) {
        if (c == null) {
          return params.consistency;
        }
        
        c = c.toLowerCase();
        if (c === 'default' || c === 'one' || c === 'quorum' || c === 'all') {
          params.consistency = c;
        }
        
        return this;
      },
      
      /**
             <p>Sets the preference of which shard replicas to execute the get 
             request on.</p> 

             <p>By default, the operation is randomized between the shard replicas.  
             This value can be:</p>
             
             <dl>
                <dd><code>_primary</code> - execute only on the primary shard</dd>
                <dd><code>_local</code> - the local shard if possible</dd>
                <dd><code>any string value</code> - to guarentee the same shards will always be used</dd>
             </dl>
             
             <p>This option is valid during the following operations:
                <code>get</code></p>

             @member ejs.Document
             @param {String} p The preference value as a string
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      preference: function (p) {
        if (p == null) {
          return params.preference;
        }
        
        params.preference = p;
        return this;
      },
      
      /**
             <p>Sets if the get request is performed in realtime or waits for
             the indexing operations to complete.  By default it is realtime.</p>
             
             <p>This option is valid during the following operations:
                <code>get</code></p>

             @member ejs.Document
             @param {Boolean} trueFalse If realtime get is used or not.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      realtime: function (trueFalse) {
        if (trueFalse == null) {
          return params.realtime;
        }
        
        params.realtime = trueFalse;
        return this;
      },
      
      /**
             <p>Sets the fields of the document to return.</p>  

             <p>By default the <code>_source</code> field is returned.  Pass a single value 
             to append to the current list of fields, pass an array to overwrite the current
             list of fields.  The returned fields will either be loaded if they are stored, 
             or fetched from the <code>_source</code></p>
             
             <p>This option is valid during the following operations:
                <code>get</code> and <code>update</code></p>

             @member ejs.Document
             @param {String || Array} fields a single field name or array of field names.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      fields: function (fields) {
        if (params.fields == null) {
          params.fields = [];
        }
        
        if (fields == null) {
          return params.fields;
        }
        
        if (isString(fields)) {
          params.fields.push(fields);
        } else if (isArray(fields)) {
          params.fields = fields;
        } else {
          throw new TypeError('Argument must be string or array');
        }
        
        return this;
      },
      
      /**
             <p>Sets the update script.</p>
             
             <p>This option is valid during the following operations:
                <code>update</code></p>

             @member ejs.Document
             @param {String} script a script to use for docuement updates
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      script: function (script) {
        if (script == null) {
          return params.script;
        }
        
        params.script = script;
        return this;
      },
      
      /**
             <p>Sets the update script lanauge.  Defaults to <code>mvel</code></p>.
             
             <p>This option is valid during the following operations:
                <code>update</code></p>

             @member ejs.Document
             @param {String} lang a valid script lanauge type such as mvel.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      lang: function (lang) {
        if (lang == null) {
          return params.lang;
        }
        
        params.lang = lang;
        return this;
      },
      
      /**
             <p>Sets the parameters sent to the update script.</p>  

             <p>The params must be an object where the key is the parameter name and 
             the value is the parameter value to use in the script.</p>
             
             <p>This option is valid during the following operations:
                <code>update</code></p>

             @member ejs.Document
             @param {Object} p a object with script parameters.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      params: function (p) {
        // accept object, prefix keys as sp_{key}
        if (p == null) {
          return params.params;
        }
        
        if (!isObject(p)) {
          throw new TypeError('Argument must be an object');
        }
        
        params.params = p;
        return this;
      },
      
       /**
               <p>Sets how many times to retry if there is a version conflict 
               between getting the document and indexing / deleting it.</p>

               <p>Defaults to <code>0</code>.<p>

               <p>This option is valid during the following operations:
                <code>update</code></p>

               @member ejs.Document
               @param {Integer} num the number of times to retry operation.
               @returns {Object} returns <code>this</code> so that calls can be chained.
               */
      retryOnConflict: function (num) {
        if (num == null) {
          return params.retry_on_conflict;
        }
        
        params.retry_on_conflict = num;
        return this;
      },
      
      /**
               <p>Sets the upsert document.</p>  
        
               <p>The upsert document is used during updates when the specified document 
               you are attempting to update does not exist.</p>

               <p>This option is valid during the following operations:
                    <code>update</code></p>

               @member ejs.Document
               @param {Object} doc the upset document.
               @returns {Object} returns <code>this</code> so that calls can be chained.
               */
      upsert: function (doc) {
        if (doc == null) {
          return params.upsert;
        }
        
        if (!isObject(doc)) {
          throw new TypeError('Argument must be an object');
        }
        
        params.upsert = doc;
        return this;
      },
      
      /**
               <p>Sets the source document.</p>  

               <p>When set during an update operation, it is used as the partial update document.</p>

               <p>This option is valid during the following operations:
                    <code>index</code> and <code>update</code></p>

               @member ejs.Document
               @param {Object} doc the source document.
               @returns {Object} returns <code>this</code> so that calls can be chained.
               */
      source: function (doc) {
        if (doc == null) {
          return params.source;
        }
        
        if (!isObject(doc)) {
          throw new TypeError('Argument must be an object');
        }
        
        params.source = doc;
        return this;
      },
      
      /**
            <p>Allows you to serialize this object into a JSON encoded string.</p>

            @member ejs.Document
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(params);
      },
      
      /**
            <p>The type of ejs object.  For internal use only.</p>
            
            @member ejs.Document
            @returns {String} the type of object
            */
      _type: function () {
        return 'document';
      },
      
      /**
            <p>Retrieves the internal <code>document</code> object. This is 
            typically used by internal API functions so use with caution.</p>

            @member ejs.Document
            @returns {Object} returns this object's internal object.
            */
      _self: function () {
        return params;
      },
      
      /**
            <p>Retrieves a document from the given index and type.</p>

            @member ejs.Document
            @param {Function} successcb A callback function that handles the response.
            @param {Function} errorcb A callback function that handles errors.
            @returns {Object} The return value is dependent on client implementation.
            */
      doGet: function (successcb, errorcb) {
        // make sure the user has set a client
        if (ejs.client == null) {
          throw new Error("No Client Set");
        }
        
        if (index == null || type == null || id == null) {
          throw new Error('Index, Type, and ID must be set');
        }
        
        // we don't need to convert the client params to a string
        // on get requests, just create the url and pass the client
        // params as the data
        var url = '/' + index + '/' + type + '/' + id;
        
        return ejs.client.get(url, genClientParams(), successcb, errorcb);
      },

      /**
            <p>Stores a document in the given index and type.  If no id 
            is set, one is created during indexing.</p>

            @member ejs.Document
            @param {Function} successcb A callback function that handles the response.
            @param {Function} errorcb A callback function that handles errors.
            @returns {Object} The return value is dependent on client implementation.
            */
      doIndex: function (successcb, errorcb) {
        // make sure the user has set a client
        if (ejs.client == null) {
          throw new Error("No Client Set");
        }
        
        if (index == null || type == null) {
          throw new Error('Index and Type must be set');
        }
        
        if (params.source == null) {
          throw new Error('No source document found');
        }
        
        var url = '/' + index + '/' + type,
          data = JSON.stringify(params.source),
          paramStr = genParamStr(),
          response;
          
        if (id != null) {
          url = url + '/' + id;
        }
        
        if (paramStr !== '') {
          url = url + '?' + paramStr;
        }
        
        // do post if id not set so one is created
        if (id == null) {
          response = ejs.client.post(url, data, successcb, errorcb);
        } else {
          // put when id is specified
          response = ejs.client.put(url, data, successcb, errorcb);
        }
        
        return response;
      },

      /**
            <p>Updates a document in the given index and type.</p>  

            <p>If the document is not found in the index, the "upsert" value is used
            if set.  The document is updated via an update script or partial document.</p>

            <p>To use a script, set the script option, to use a 
            partial document, set the source with the partial document.</p>

            @member ejs.Document
            @param {Function} successcb A callback function that handles the response.
            @param {Function} errorcb A callback function that handles errors.
            @returns {Object} The return value is dependent on client implementation.
            */
      doUpdate: function (successcb, errorcb) {
        // make sure the user has set a client
        if (ejs.client == null) {
          throw new Error("No Client Set");
        }
        
        if (index == null || type == null || id == null) {
          throw new Error('Index, Type, and ID must be set');
        }
        
        if (params.script == null && params.source == null) {
          throw new Error('Update script or document required');
        }
        
        var url = '/' + index + '/' + type + '/' + id + '/_update',
          data = {},
          paramStr = genParamStr();
        
        if (paramStr !== '') {
          url = url + '?' + paramStr;
        }
        
        if (params.script != null) {
          data.script = params.script;
        }
        
        if (params.lang != null) {
          data.lang = params.lang;
        }
        
        if (params.params != null) {
          data.params = params.params;
        }
        
        if (params.upsert != null) {
          data.upsert = params.upsert;
        }
        
        if (params.source != null) {
          data.doc = params.source;
        }
        
        return ejs.client.post(url, JSON.stringify(data), successcb, errorcb);
      },

      /**
            <p>Deletes the document from the given index and type using the 
            speciifed id.</p>

            @member ejs.Document
            @param {Function} successcb A callback function that handles the response.
            @param {Function} errorcb A callback function that handles errors.
            @returns {void} Returns the value of the callback when executing on the server.
            */
      doDelete: function (successcb, errorcb) {
        // make sure the user has set a client
        if (ejs.client == null) {
          throw new Error("No Client Set");
        }
        
        if (index == null || type == null || id == null) {
          throw new Error('Index, Type, and ID must be set');
        }
        
        var url = '/' + index + '/' + type + '/' + id,
          data = '',
          paramStr = genParamStr();
        
        if (paramStr !== '') {
          url = url + '?' + paramStr;
        }
        
        return ejs.client.del(url, data, successcb, errorcb);
      }

    };
  };


  /**
    @class
    <p>A <code>boolQuery</code> allows you to build <em>Boolean</em> query constructs
    from individual term or phrase queries. For example you might want to search
    for documents containing the terms <code>javascript</code> and <code>python</code>.</p>

    @name ejs.BoolQuery

    @desc
    A Query that matches documents matching boolean combinations of other
    queries, e.g. <code>termQuerys, phraseQuerys</code> or other <code>boolQuerys</code>.

    */
  ejs.BoolQuery = function () {

    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.BoolQuery
         @property {Object} query
         */
    var query = {
      bool: {}
    };

    return {

      /**
             Adds query to boolean container. Given query "must" appear in matching documents.

             @member ejs.BoolQuery
             @param {Object} oQuery A valid <code>Query</code> object
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      must: function (oQuery) {
        var i, len;
        
        if (query.bool.must == null) {
          query.bool.must = [];
        }
    
        if (oQuery == null) {
          return query.bool.must;
        }

        if (isQuery(oQuery)) {
          query.bool.must.push(oQuery._self());
        } else if (isArray(oQuery)) {
          query.bool.must = [];
          for (i = 0, len = oQuery.length; i < len; i++) {
            if (!isQuery(oQuery[i])) {
              throw new TypeError('Argument must be an array of Queries');
            }
            
            query.bool.must.push(oQuery[i]._self());
          }
        } else {
          throw new TypeError('Argument must be a Query or array of Queries');
        }
        
        return this;
      },

      /**
             Adds query to boolean container. Given query "must not" appear in matching documents.

             @member ejs.BoolQuery
             @param {Object} oQuery A valid query object
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      mustNot: function (oQuery) {
        var i, len;
        
        if (query.bool.must_not == null) {
          query.bool.must_not = [];
        }

        if (oQuery == null) {
          return query.bool.must_not;
        }
    
        if (isQuery(oQuery)) {
          query.bool.must_not.push(oQuery._self());
        } else if (isArray(oQuery)) {
          query.bool.must_not = [];
          for (i = 0, len = oQuery.length; i < len; i++) {
            if (!isQuery(oQuery[i])) {
              throw new TypeError('Argument must be an array of Queries');
            }
            
            query.bool.must_not.push(oQuery[i]._self());
          }
        } else {
          throw new TypeError('Argument must be a Query or array of Queries');
        }
        
        return this;
      },

      /**
             Adds query to boolean container. Given query "should" appear in matching documents.

             @member ejs.BoolQuery
             @param {Object} oQuery A valid query object
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      should: function (oQuery) {
        var i, len;
        
        if (query.bool.should == null) {
          query.bool.should = [];
        }

        if (oQuery == null) {
          return query.bool.should;
        }
    
        if (isQuery(oQuery)) {
          query.bool.should.push(oQuery._self());
        } else if (isArray(oQuery)) {
          query.bool.should = [];
          for (i = 0, len = oQuery.length; i < len; i++) {
            if (!isQuery(oQuery[i])) {
              throw new TypeError('Argument must be an array of Queries');
            }
            
            query.bool.should.push(oQuery[i]._self());
          }
        } else {
          throw new TypeError('Argument must be a Query or array of Queries');
        }
        
        return this;
      },

      /**
            Sets the boost value for documents matching the <code>Query</code>.

            @member ejs.BoolQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.bool.boost;
        }

        query.bool.boost = boost;
        return this;
      },

      /**
            Enables or disables similarity coordinate scoring of documents
            matching the <code>Query</code>. Default: false.

            @member ejs.BoolQuery
            @param {String} trueFalse A <code>true/false</code value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      disableCoord: function (trueFalse) {
        if (trueFalse == null) {
          return query.bool.disable_coord;
        }

        query.bool.disable_coord = trueFalse;
        return this;
      },

      /**
            <p>Sets the number of optional clauses that must match.</p>
      
            <p>By default no optional clauses are necessary for a match
            (unless there are no required clauses).  If this method is used,
            then the specified number of clauses is required.</p>

            <p>Use of this method is totally independent of specifying that
            any specific clauses are required (or prohibited).  This number will
            only be compared against the number of matching optional clauses.</p>
   
            @member ejs.BoolQuery
            @param {Integer} minMatch A positive <code>integer</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minimumNumberShouldMatch: function (minMatch) {
        if (minMatch == null) {
          return query.bool.minimum_number_should_match;
        }

        query.bool.minimum_number_should_match = minMatch;
        return this;
      },

      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.BoolQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.BoolQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.BoolQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>The boosting query can be used to effectively demote results that match 
    a given query. Unlike the “NOT” clause in bool query, this still selects 
    documents that contain undesirable terms, but reduces their overall 
    score.</p>

    @name ejs.BoostingQuery

    @desc
    <p>Constructs a query that can demote search results.  A negative boost.</p>

    @param {Object} positiveQry Valid query object used to select all matching docs.
    @param {Object} negativeQry Valid query object to match the undesirable docs 
      returned within the positiveQry result set.
    @param {Double} negativeBoost A double value where 0 < n < 1.
     */
  ejs.BoostingQuery = function (positiveQry, negativeQry, negativeBoost) {

    if (!isQuery(positiveQry) || !isQuery(negativeQry)) {
      throw new TypeError('Arguments must be Queries');
    }
    
    /**
         The internal Query object. Use <code>_self()</code>.
         @member ejs.BoostingQuery
         @property {Object} BoostingQuery
         */
    var query = {
      boosting: {
        positive: positiveQry._self(),
        negative: negativeQry._self(),
        negative_boost: negativeBoost
      }
    };

    return {
    
      /**
             Sets the "master" query that determines which results are returned.

             @member ejs.BoostingQuery
             @param {Object} oQuery A valid <code>Query</code> object
             @returns {Object} returns <code>this</code> so that calls can be 
              chained. Returns {Object} current positive query if oQuery is
              not specified.
             */
      positive: function (oQuery) {
        if (oQuery == null) {
          return query.boosting.positive;
        }
    
        if (!isQuery(oQuery)) {
          throw new TypeError('Argument must be a Query');
        }
        
        query.boosting.positive = oQuery._self();
        return this;
      },

      /**
             Sets the query used to match documents in the <code>positive</code>
             query that will be negatively boosted.

             @member ejs.BoostingQuery
             @param {Object} oQuery A valid <code>Query</code> object
             @returns {Object} returns <code>this</code> so that calls can be 
              chained. Returns {Object} current negative query if oQuery is
              not specified.
             */
      negative: function (oQuery) {
        if (oQuery == null) {
          return query.boosting.negative;
        }
    
        if (!isQuery(oQuery)) {
          throw new TypeError('Argument must be a Query');
        }
        
        query.boosting.negative = oQuery._self();
        return this;
      },
   
      /**
            Sets the negative boost value.

            @member ejs.BoostingQuery
            @param {Double} boost A positive <code>double</code> value where 0 < n < 1.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      negativeBoost: function (negBoost) {
        if (negBoost == null) {
          return query.boosting.negative_boost;
        }

        query.boosting.negative_boost = negBoost;
        return this;
      },
    
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.BoostingQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.boosting.boost;
        }

        query.boosting.boost = boost;
        return this;
      },

      /**
             Serializes the internal <em>query</em> object as a JSON string.
             @member ejs.BoostingQuery
             @returns {String} Returns a JSON representation of the Query object.
             */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.BoostingQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            This method is used to retrieve the raw query object. It's designed
            for internal use when composing and serializing queries.
            
            @member ejs.BoostingQuery
            @returns {Object} Returns the object's <em>query</em> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>A query that executes high-frequency terms in a optional sub-query to 
    prevent slow queries due to "common" terms like stopwords.</p>
  
    <p>This query basically builds two queries out of the terms in the query 
    string where low-frequency terms are added to a required boolean clause and 
    high-frequency terms are added to an optional boolean clause. The optional 
    clause is only executed if the required "low-frequency' clause matches.</p>
  
    <p><code>CommonTermsQuery</code> has several advantages over stopword 
    filtering at index or query time since a term can be "classified" based on 
    the actual document frequency in the index and can prevent slow queries even 
    across domains without specialized stopword files.</p>
  
    @name ejs.CommonTermsQuery
    @since elasticsearch 0.90
  
    @desc
    A query that executes high-frequency terms in a optional sub-query.

    @param {String} field the document field/key to query against
    @param {String} qstr the query string
    */
  ejs.CommonTermsQuery = function (field, qstr) {

    /**
         The internal query object. <code>Use get()</code>
         @member ejs.CommonTermsQuery
         @property {Object} query
         */
    var query = {
      common: {}
    };
  
    // support for full Builder functionality where no constructor is used
    // use dummy field until one is set
    if (field == null) {
      field = 'no_field_set';
    }
  
    query.common[field] = {};
  
    // only set the query is one is passed in
    if (qstr != null) {
      query.common[field].query = qstr;
    }
  
    return {

      /**
            Sets the field to query against.

            @member ejs.CommonTermsQuery
            @param {String} f A valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (f) {
        var oldValue = query.common[field];
    
        if (f == null) {
          return field;
        }

        delete query.common[field];
        field = f;
        query.common[f] = oldValue;
    
        return this;
      },
  
      /**
            Sets the query string.

            @member ejs.CommonTermsQuery
            @param {String} qstr The query string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (qstr) {
        if (qstr == null) {
          return query.common[field].query;
        }

        query.common[field].query = qstr;
        return this;
      },

      /**
            Sets the analyzer name used to analyze the <code>Query</code> object.

            @member ejs.CommonTermsQuery
            @param {String} analyzer A valid analyzer name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      analyzer: function (analyzer) {
        if (analyzer == null) {
          return query.common[field].analyzer;
        }

        query.common[field].analyzer = analyzer;
        return this;
      },
    
      /**
            Enables or disables similarity coordinate scoring of documents
            commoning the <code>Query</code>. Default: false.

            @member ejs.CommonTermsQuery
            @param {String} trueFalse A <code>true/false</code value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      disableCoords: function (trueFalse) {
        if (trueFalse == null) {
          return query.common[field].disable_coords;
        }

        query.common[field].disable_coords = trueFalse;
        return this;
      },
          
      /**
            Sets the maximum threshold/frequency to be considered a low 
            frequency term.  Set to a value between 0 and 1.

            @member ejs.CommonTermsQuery
            @param {Number} freq A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cutoffFrequency: function (freq) {
        if (freq == null) {
          return query.common[field].cutoff_frequency;
        }

        query.common[field].cutoff_frequency = freq;
        return this;
      },

      /**
            Sets the boolean operator to be used for high frequency terms.
            Default: AND

            @member ejs.CommonTermsQuery
            @param {String} op Any of "and" or "or", no quote characters.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      highFreqOperator: function (op) {
        if (op == null) {
          return query.common[field].high_freq_operator;
        }

        op = op.toLowerCase();
        if (op === 'and' || op === 'or') {
          query.common[field].high_freq_operator = op;
        }

        return this;
      },
    
      /**
            Sets the boolean operator to be used for low frequency terms.
            Default: AND
          
            @member ejs.CommonTermsQuery
            @param {String} op Any of "and" or "or", no quote characters.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lowFreqOperator: function (op) {
        if (op == null) {
          return query.common[field].low_freq_operator;
        }

        op = op.toLowerCase();
        if (op === 'and' || op === 'or') {
          query.common[field].low_freq_operator = op;
        }

        return this;
      },
    
      /**
            Sets the minimum number of common that need to common in a document
            before that document is returned in the results.

            @member ejs.CommonTermsQuery
            @param {Integer} min A positive integer.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minimumShouldMatch: function (min) {
        if (min == null) {
          return query.common[field].minimum_should_match;
        }
    
        query.common[field].minimum_should_match = min;
        return this;
      },

      /**
            Sets the boost value for documents commoning the <code>Query</code>.

            @member ejs.CommonTermsQuery
            @param {Number} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.common[field].boost;
        }

        query.common[field].boost = boost;
        return this;
      },
    
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.CommonTermsQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
          
            @member ejs.CommonTermsQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
    
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.CommonTermsQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>A constant score query wraps another <code>Query</code> or
    <code>Filter</code> and returns a constant score for each
    result that is equal to the query boost.</p>

    <p>Note that lucene's query normalization (queryNorm) attempts
    to make scores between different queries comparable.  It does not
    change the relevance of your query, but it might confuse you when
    you look at the score of your documents and they are not equal to
    the query boost value as expected.  The scores were normalized by
    queryNorm, but maintain the same relevance.</p>

    @name ejs.ConstantScoreQuery

    @desc
    <p>Constructs a query where each documents returned by the internal
    query or filter have a constant score equal to the boost factor.</p>

     */
  ejs.ConstantScoreQuery = function () {

    /**
         The internal Query object. Use <code>_self()</code>.
         @member ejs.ConstantScoreQuery
         @property {Object} query
         */
    var query = {
      constant_score: {}
    };

    return {
      /**
             Adds the query to apply a constant score to.

             @member ejs.ConstantScoreQuery
             @param {Object} oQuery A valid <code>Query</code> object
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      query: function (oQuery) {
        if (oQuery == null) {
          return query.constant_score.query;
        }
      
        if (!isQuery(oQuery)) {
          throw new TypeError('Argument must be a Query');
        }
        
        query.constant_score.query = oQuery._self();
        return this;
      },

      /**
             Adds the filter to apply a constant score to.

             @member ejs.ConstantScoreQuery
             @param {Object} oFilter A valid <code>Filter</code> object
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      filter: function (oFilter) {
        if (oFilter == null) {
          return query.constant_score.filter;
        }
      
        if (!isFilter(oFilter)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        query.constant_score.filter = oFilter._self();
        return this;
      },

      /**
            Enables caching of the filter.

            @member ejs.ConstantScoreQuery
            @param {Boolean} trueFalse A boolean value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return query.constant_score._cache;
        }

        query.constant_score._cache = trueFalse;
        return this;
      },
      
      /**
            Set the cache key.

            @member ejs.ConstantScoreQuery
            @param {String} k A string cache key.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (k) {
        if (k == null) {
          return query.constant_score._cache_key;
        }

        query.constant_score._cache_key = k;
        return this;
      },
      
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.ConstantScoreQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.constant_score.boost;
        }

        query.constant_score.boost = boost;
        return this;
      },

      /**
             Serializes the internal <em>query</em> object as a JSON string.
             @member ejs.ConstantScoreQuery
             @returns {String} Returns a JSON representation of the Query object.
             */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.ConstantScoreQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            This method is used to retrieve the raw query object. It's designed
            for internal use when composing and serializing queries.
            
            @member ejs.ConstantScoreQuery
            @returns {Object} Returns the object's <em>query</em> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>A query allows to wrap another query and multiply its score by the 
    provided boost_factor. This can sometimes be desired since boost value set 
    on specific queries gets normalized, while this query boost factor does not.</p>

    @name ejs.CustomBoostFactorQuery

    @desc
    Boosts a queries score without that boost being normalized.

    @param {Object} qry A valid query object.
    */
  ejs.CustomBoostFactorQuery = function (qry) {

    if (!isQuery(qry)) {
      throw new TypeError('Argument must be a Query');
    }
    
    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.CustomBoostFactorQuery
         @property {Object} query
         */
    var query = {
      custom_boost_factor: {
        query: qry._self()
      }
    };

    return {

      /**
            Sets the query to be apply the custom boost to.

            @member ejs.CustomBoostFactorQuery
            @param {Object} q A valid Query object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (q) {
        if (q == null) {
          return query.custom_boost_factor.query;
        }
    
        if (!isQuery(q)) {
          throw new TypeError('Argument must be a Query');
        }
        
        query.custom_boost_factor.query = q._self();
        return this;
      },
  
      /**
            Sets the language used in the script.  

            @member ejs.CustomBoostFactorQuery
            @param {Double} boost The boost value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boostFactor: function (boost) {
        if (boost == null) {
          return query.custom_boost_factor.boost_factor;
        }

        query.custom_boost_factor.boost_factor = boost;
        return this;
      },
  
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.CustomBoostFactorQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.custom_boost_factor.boost;
        }

        query.custom_boost_factor.boost = boost;
        return this;
      },
        
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.CustomBoostFactorQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.CustomBoostFactorQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.CustomBoostFactorQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>A custom_filters_score query allows to execute a query, and if the hit 
    matches a provided filter (ordered), use either a boost or a script 
    associated with it to compute the score.</p>

    <p>This can considerably simplify and increase performance for parameterized 
    based scoring since filters are easily cached for faster performance, and 
    boosting / script is considerably simpler.</p>
  
    @name ejs.CustomFiltersScoreQuery

    @desc
    Returned documents matched by the query and scored based on if the document
    matched in a filter.  

    @param {Object} qry A valid query object.
    @param {Object || Array} filters A single object or array of objects.  Each 
      object must have a 'filter' property and either a 'boost' or 'script' 
      property.
    */
  ejs.CustomFiltersScoreQuery = function (qry, filters) {

    if (!isQuery(qry)) {
      throw new TypeError('Argument must be a Query');
    }
    
    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.CustomFiltersScoreQuery
         @property {Object} query
         */
    var query = {
      custom_filters_score: {
        query: qry._self(),
        filters: []
      }
    },
  
    // generate a valid filter object that can be inserted into the filters
    // array.  Returns null when an invalid filter is passed in.
    genFilterObject = function (filter) {
      var obj = null;
    
      if (filter.filter && isFilter(filter.filter)) {
        obj = {
          filter: filter.filter._self()
        };
      
        if (filter.boost) {
          obj.boost = filter.boost;
        } else if (filter.script) {
          obj.script = filter.script;
        } else {
          // invalid filter, must boost or script must be specified
          obj = null;
        }
      }
    
      return obj;
    }; 

    each((isArray(filters) ? filters : [filters]), function (filter) {
      var fObj = genFilterObject(filter);
      if (fObj !== null) {
        query.custom_filters_score.filters.push(fObj);
      }
    });
  
    return {

      /**
            Sets the query to be apply the custom boost to.

            @member ejs.CustomFiltersScoreQuery
            @param {Object} q A valid Query object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (q) {
        if (q == null) {
          return query.custom_filters_score.query;
        }
  
        if (!isQuery(q)) {
          throw new TypeError('Argument must be a Query');
        }
        
        query.custom_filters_score.query = q._self();
        return this;
      },

      /**
            <p>Sets the filters and their related boost or script scoring method.</p>

            <p>Takes an array of objects where each object has a 'filter' property
            and either a 'boost' or 'script' property.  Pass a single object to
            add to the current list of filters or pass a list of objects to
            overwrite all existing filters.</p>
          
            <code>
            {filter: someFilter, boost: 2.1}
            </code>

            @member ejs.CustomFiltersScoreQuery
            @param {Object || Array} fltrs An object or array of objects 
              contining a filter and either a boost or script property.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      filters: function (fltrs) {
        if (fltrs == null) {
          return query.custom_filters_score.filters;
        }
  
        if (isArray(fltrs)) {
          query.custom_filters_score.filters = [];
        }
        
        each((isArray(fltrs) ? fltrs : [fltrs]), function (f) {
          var fObj = genFilterObject(f);
          if (fObj !== null) {
            query.custom_filters_score.filters.push(fObj);
          }
        });
      
        return this;
      },
    
      /**
            <p>A score_mode can be defined to control how multiple matching 
            filters control the score.<p> 

            <p>By default, it is set to first which means the first matching filter 
            will control the score of the result. It can also be set to 
            <code>min/max/total/avg/multiply</code> which will aggregate the result from all 
            matching filters based on the aggregation type.<p>

            @member ejs.CustomFiltersScoreQuery
            @param {String} s The scoring type as a string. 
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scoreMode: function (s) {
        if (s == null) {
          return query.custom_filters_score.score_mode;
        }

        s = s.toLowerCase();
        if (s === 'first' || s === 'min' || s === 'max' || s === 'total' || s === 'avg' || s === 'multiply') {
          query.custom_filters_score.score_mode = s;
        }
    
        return this;
      },
    
      /**
            Sets parameters that will be applied to the script.  Overwrites 
            any existing params.

            @member ejs.CustomFiltersScoreQuery
            @param {Object} q An object where the keys are the parameter name and 
              values are the parameter value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      params: function (p) {
        if (p == null) {
          return query.custom_filters_score.params;
        }
    
        query.custom_filters_score.params = p;
        return this;
      },
  
      /**
            Sets the language used in the script.  

            @member ejs.CustomFiltersScoreQuery
            @param {String} l The script language, defatuls to mvel.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lang: function (l) {
        if (l == null) {
          return query.custom_filters_score.lang;
        }

        query.custom_filters_score.lang = l;
        return this;
      },

      /**
            Sets the maximum value a computed boost can reach.

            @member ejs.CustomFiltersScoreQuery
            @param {Double} max A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxBoost: function (max) {
        if (max == null) {
          return query.custom_filters_score.max_boost;
        }

        query.custom_filters_score.max_boost = max;
        return this;
      },
        
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.CustomFiltersScoreQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.custom_filters_score.boost;
        }

        query.custom_filters_score.boost = boost;
        return this;
      },
      
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.CustomFiltersScoreQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.CustomFiltersScoreQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.CustomFiltersScoreQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>A query that wraps another query and customize the scoring of it 
    optionally with a computation derived from other field values in the 
    doc (numeric ones) using script expression.</p>

    @name ejs.CustomScoreQuery

    @desc
    Scores a query based on a script.

    @param {Object} qry A valid query object.
    @param {String} script A valid script expression.
    */
  ejs.CustomScoreQuery = function (qry, script) {

    if (!isQuery(qry)) {
      throw new TypeError('Argument must be a Query');
    }
    
    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.CustomScoreQuery
         @property {Object} query
         */
    var query = {
      custom_score: {
        query: qry._self(),
        script: script
      }
    };

    return {

      /**
            Sets the query to be apply the custom score to.

            @member ejs.CustomScoreQuery
            @param {Object} q A valid Query object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (q) {
        if (q == null) {
          return query.custom_score.query;
        }
      
        if (!isQuery(q)) {
          throw new TypeError('Argument must be a Query');
        }
        
        query.custom_score.query = q._self();
        return this;
      },

      /**
            Sets the script that calculates the custom score

            @member ejs.CustomScoreQuery
            @param {String} s A valid script expression
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      script: function (s) {
        if (s == null) {
          return query.custom_score.script;
        }
      
        query.custom_score.script = s;
        return this;
      },

      /**
            Sets parameters that will be applied to the script.  Overwrites 
            any existing params.

            @member ejs.CustomScoreQuery
            @param {Object} p An object where the keys are the parameter name and 
              values are the parameter value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      params: function (p) {
        if (p == null) {
          return query.custom_score.params;
        }
      
        query.custom_score.params = p;
        return this;
      },
    
      /**
            Sets the language used in the script.  

            @member ejs.CustomScoreQuery
            @param {String} l The script language, defatuls to mvel.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lang: function (l) {
        if (l == null) {
          return query.custom_score.lang;
        }

        query.custom_score.lang = l;
        return this;
      },
    
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.CustomScoreQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.custom_score.boost;
        }

        query.custom_score.boost = boost;
        return this;
      },
          
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.CustomScoreQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.CustomScoreQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.CustomScoreQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    A query that generates the union of documents produced by its subqueries, and
    that scores each document with the maximum score for that document as produced
    by any subquery, plus a tie breaking increment for any additional matching
    subqueries.

    @name ejs.DisMaxQuery

    @desc
    A query that generates the union of documents produced by its subqueries such
    as <code>termQuerys, phraseQuerys</code>, <code>boolQuerys</code>, etc.

    */
  ejs.DisMaxQuery = function () {

    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.DisMaxQuery
         @property {Object} query
         */
    var query = {
      dis_max: {}
    };

    return {

      /**
            Updates the queries.  If passed a single Query, it is added to the
            list of existing queries.  If passed an array of Queries, it 
            replaces all existing values.

            @member ejs.DisMaxQuery
            @param {Query || Array} qs A single Query or an array of Queries
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      queries: function (qs) {
        var i, len;
        
        if (qs == null) {
          return query.dis_max.queries;
        }
      
        if (query.dis_max.queries == null) {
          query.dis_max.queries = [];
        }
        
        if (isQuery(qs)) {
          query.dis_max.queries.push(qs._self());
        } else if (isArray(qs)) {
          query.dis_max.queries = [];
          for (i = 0, len = qs.length; i < len; i++) {
            if (!isQuery(qs[i])) {
              throw new TypeError('Argument must be array of Queries');
            }
            
            query.dis_max.queries.push(qs[i]._self());
          }
        } else {
          throw new TypeError('Argument must be a Query or array of Queries');
        }

        return this;
      },

      /**
            Sets the boost value of the <code>Query</code>.  Default: 1.0.

            @member ejs.DisMaxQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.dis_max.boost;
        }

        query.dis_max.boost = boost;
        return this;
      },


      /**
            <p>The tie breaker value.</p>  

            <p>The tie breaker capability allows results that include the same term in multiple 
            fields to be judged better than results that include this term in only the best of those 
            multiple fields, without confusing this with the better case of two different terms in 
            the multiple fields.</p>  

            <p>Default: 0.0.</p>

            @member ejs.DisMaxQuery
            @param {Double} tieBreaker A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      tieBreaker: function (tieBreaker) {
        if (tieBreaker == null) {
          return query.dis_max.tie_breaker;
        }

        query.dis_max.tie_breaker = tieBreaker;
        return this;
      },

      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.DisMaxQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.DisMaxQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.DisMaxQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };
  

  /**
    @class
    <p>Wrapper to allow SpanQuery objects participate in composite single-field 
    SpanQueries by 'lying' about their search field. That is, the masked 
    SpanQuery will function as normal, but when asked for the field it 
    queries against, it will return the value specified as the masked field vs.
    the real field used in the wrapped span query.</p>

    @name ejs.FieldMaskingSpanQuery

    @desc
    Wraps a SpanQuery and hides the real field being searched across.

    @param {Query} spanQry A valid SpanQuery
    @param {Integer} field the maximum field position in a match.
  
    */
  ejs.FieldMaskingSpanQuery = function (spanQry, field) {

    if (!isQuery(spanQry)) {
      throw new TypeError('Argument must be a SpanQuery');
    }
  
    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.FieldMaskingSpanQuery
         @property {Object} query
         */
    var query = {
      field_masking_span: {
        query: spanQry._self(),
        field: field
      }
    };

    return {

      /**
            Sets the span query to wrap.

            @member ejs.FieldMaskingSpanQuery
            @param {Query} spanQuery Any valid span type query.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (spanQuery) {
        if (spanQuery == null) {
          return query.field_masking_span.query;
        }
    
        if (!isQuery(spanQuery)) {
          throw new TypeError('Argument must be a SpanQuery');
        }
      
        query.field_masking_span.query = spanQuery._self();
        return this;
      },

      /**
            Sets the value of the "masked" field.  

            @member ejs.FieldMaskingSpanQuery
            @param {String} f A field name the wrapped span query should use
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (f) {
        if (f == null) {
          return query.field_masking_span.field;
        }
    
        query.field_masking_span.field = f;
        return this;
      },

      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.FieldMaskingSpanQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.field_masking_span.boost;
        }

        query.field_masking_span.boost = boost;
        return this;
      },
    
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.FieldMaskingSpanQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.FieldMaskingSpanQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.FieldMaskingSpanQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    A query that executes against a given field or document property. It is a simplified version
    of the <code><a href="/jsdocs/ejs.queryString.html">queryString</a></code> object.

    @name ejs.FieldQuery

    @desc
    A query that executes against a given field or document property.

    @param {String} field The field or document property to search against.
    @param {String} qstr The value to match.
    */
  ejs.FieldQuery = function (field, qstr) {

    /**
         The internal query object. <code>Use get()</code>
         @member ejs.FieldQuery
         @property {Object} query
         */
    var query = {
      field: {}
    };
    
    query.field[field] = {
      query: qstr
    };

    return {

      /**
             The field to run the query against.

             @member ejs.FieldQuery
             @param {String} f A single field name.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      field: function (f) {
        var oldValue = query.field[field];

        if (f == null) {
          return field;
        }

        delete query.field[field];
        field = f;
        query.field[f] = oldValue;

        return this;
      },
      
      /**
             <p>Sets the query string.</p>

             @member ejs.FieldQuery
             @param {String} q The lucene query string.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      query: function (q) {
        if (q == null) {
          return query.field[field].query;
        }

        query.field[field].query = q;
        return this;
      },
      
      /**
            <p>Set the default <code>Boolean</code> operator.</p> 

            <p>This operator is used to join individual query terms when no operator is 
            explicity used in the query string (i.e., <code>this AND that</code>).
            Defaults to <code>OR</code> (<em>same as Google</em>).</p>

            @member ejs.FieldQuery
            @param {String} op The operator, AND or OR.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      defaultOperator: function (op) {
        if (op == null) {
          return query.field[field].default_operator;
        }
      
        op = op.toUpperCase();
        if (op === 'AND' || op === 'OR') {
          query.field[field].default_operator = op;
        }
        
        return this;
      },

      /**
            <p>Sets the analyzer name used to analyze the <code>Query</code> object.</p>

            @member ejs.FieldQuery
            @param {String} analyzer A valid analyzer name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      analyzer: function (analyzer) {
        if (analyzer == null) {
          return query.field[field].analyzer;
        }

        query.field[field].analyzer = analyzer;
        return this;
      },

      /**
            <p>Sets the quote analyzer name used to analyze the <code>query</code>
            when in quoted text.</p>

            @member ejs.FieldQuery
            @param {String} analyzer A valid analyzer name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      quoteAnalyzer: function (analyzer) {
        if (analyzer == null) {
          return query.field[field].quote_analyzer;
        }

        query.field[field].quote_analyzer = analyzer;
        return this;
      },
      
      /**
            <p>Sets whether or not we should auto generate phrase queries *if* the
            analyzer returns more than one term. Default: false.</p>

            @member ejs.FieldQuery
            @param {Boolean} trueFalse A <code>true/false</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      autoGeneratePhraseQueries: function (trueFalse) {
        if (trueFalse == null) {
          return query.field[field].auto_generate_phrase_queries;
        }

        query.field[field].auto_generate_phrase_queries = trueFalse;
        return this;
      },

      /**
            <p>Sets whether or not wildcard characters (* and ?) are allowed as the
            first character of the <code>Query</code>.</p>  

            <p>Default: <code>true</code>.</p>

            @member ejs.FieldQuery
            @param {Boolean} trueFalse A <code>true/false</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      allowLeadingWildcard: function (trueFalse) {
        if (trueFalse == null) {
          return query.field[field].allow_leading_wildcard;
        }

        query.field[field].allow_leading_wildcard = trueFalse;
        return this;
      },

      /**
            <p>Sets whether or not terms from <code>wildcard, prefix, fuzzy,</code> and
            <code>range</code> queries should automatically be lowercased in the <code>Query</code>
            since they are not analyzed.</p>  

            <p>Default: <code>true</code>.</p>

            @member ejs.FieldQuery
            @param {Boolean} trueFalse A <code>true/false</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lowercaseExpandedTerms: function (trueFalse) {
        if (trueFalse == null) {
          return query.field[field].lowercase_expanded_terms;
        }

        query.field[field].lowercase_expanded_terms = trueFalse;
        return this;
      },

      /**
            <p>Sets whether or not position increments will be used in the
            <code>Query</code>.</p> 

            <p>Default: <code>true</code>.</p>

            @member ejs.FieldQuery
            @param {Boolean} trueFalse A <code>true/false</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      enablePositionIncrements: function (trueFalse) {
        if (trueFalse == null) {
          return query.field[field].enable_position_increments;
        }

        query.field[field].enable_position_increments = trueFalse;
        return this;
      },

      /**
            <p>Set the minimum similarity for fuzzy queries.</p>  

            <p>Default: <code>0.5</code>.</p>

            @member ejs.FieldQuery
            @param {Double} minSim A <code>double</code> value between 0 and 1.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fuzzyMinSim: function (minSim) {
        if (minSim == null) {
          return query.field[field].fuzzy_min_sim;
        }

        query.field[field].fuzzy_min_sim = minSim;
        return this;
      },

      /**
            <p>Sets the boost value of the <code>Query</code>.</p>  

            <p>Default: <code>1.0</code>.</p>

            @member ejs.FieldQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.field[field].boost;
        }

        query.field[field].boost = boost;
        return this;
      },

      /**
            <p>Sets the prefix length for fuzzy queries.</p>  
    
            <p>Default: <code>0</code>.</p>

            @member ejs.FieldQuery
            @param {Integer} fuzzLen A positive <code>integer</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fuzzyPrefixLength: function (fuzzLen) {
        if (fuzzLen == null) {
          return query.field[field].fuzzy_prefix_length;
        }

        query.field[field].fuzzy_prefix_length = fuzzLen;
        return this;
      },

      /**
            <p>Sets the max number of term expansions for fuzzy queries.</p>

            @member ejs.FieldQuery
            @param {Integer} max A positive <code>integer</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fuzzyMaxExpansions: function (max) {
        if (max == null) {
          return query.field[field].fuzzy_max_expansions;
        }

        query.field[field].fuzzy_max_expansions = max;
        return this;
      },

      /**
            <p>Sets fuzzy rewrite method.<p>  

            <p>Valid values are:</p>
            
            <dl>
                <dd><code>constant_score_auto</code> - tries to pick the best constant-score rewrite 
                 method based on term and document counts from the query</dd>
              
                <dd><code>scoring_boolean</code> - translates each term into boolean should and 
                 keeps the scores as computed by the query</dd>
              
                <dd><code>constant_score_boolean</code> - same as scoring_boolean, expect no scores
                 are computed.</dd>
              
                <dd><code>constant_score_filter</code> - first creates a private Filter, by visiting 
                 each term in sequence and marking all docs for that term</dd>
              
                <dd><code>top_terms_boost_N</code> - first translates each term into boolean should
                 and scores are only computed as the boost using the top <code>N</code>
                 scoring terms.  Replace <code>N</code> with an integer value.</dd>
              
                <dd><code>top_terms_N</code> - first translates each term into boolean should
                 and keeps the scores as computed by the query. Only the top <code>N</code>
                 scoring terms are used.  Replace <code>N</code> with an integer value.</dd>
            </dl>
            
            <p>Default is <code>constant_score_auto</code>.</p>

            <p>This is an advanced option, use with care.</p>
            
            @member ejs.FieldQuery
            @param {String} m The rewrite method as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fuzzyRewrite: function (m) {
        if (m == null) {
          return query.field[field].fuzzy_rewrite;
        }

        m = m.toLowerCase();
        if (m === 'constant_score_auto' || m === 'scoring_boolean' ||
          m === 'constant_score_boolean' || m === 'constant_score_filter' ||
          m.indexOf('top_terms_boost_') === 0 || 
          m.indexOf('top_terms_') === 0) {
            
          query.field[field].fuzzy_rewrite = m;
        }
        
        return this;
      },

      /**
            <p>Sets rewrite method.</p>  

            <p>Valid values are:</p>
            
            <dl>
                <dd><code>constant_score_auto</code> - tries to pick the best constant-score rewrite 
                 method based on term and document counts from the query</dd>
              
                <dd><code>scoring_boolean</code> - translates each term into boolean should and 
                 keeps the scores as computed by the query</dd>
              
                <dd><code>constant_score_boolean</code> - same as scoring_boolean, expect no scores
                 are computed.</p>
              
                <dd><code>constant_score_filter</code> - first creates a private Filter, by visiting 
                 each term in sequence and marking all docs for that term</dd>
              
                <dd><code>top_terms_boost_N</code> - first translates each term into boolean should
                 and scores are only computed as the boost using the top <code>N</code>
                 scoring terms.  Replace <code>N</code> with an integer value.</dd>
              
                <dd><code>top_terms_N</code> - first translates each term into boolean should
                 and keeps the scores as computed by the query. Only the top <code>N</code>
                 scoring terms are used.  Replace <code>N</code> with an integer value.</dd>
            </dl>
            
            <p>Default is <code>constant_score_auto</code>.</p>

            This is an advanced option, use with care.

            @member ejs.FieldQuery
            @param {String} m The rewrite method as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      rewrite: function (m) {
        if (m == null) {
          return query.field[field].rewrite;
        }
        
        m = m.toLowerCase();
        if (m === 'constant_score_auto' || m === 'scoring_boolean' ||
          m === 'constant_score_boolean' || m === 'constant_score_filter' ||
          m.indexOf('top_terms_boost_') === 0 || 
          m.indexOf('top_terms_') === 0) {
            
          query.field[field].rewrite = m;
        }
        
        return this;
      },

      /**
            <p>Sets the suffix to automatically add to the field name when 
            performing a quoted search.</p>

            @member ejs.FieldQuery
            @param {String} s The suffix as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      quoteFieldSuffix: function (s) {
        if (s == null) {
          return query.field[field].quote_field_suffix;
        }

        query.field[field].quote_field_suffix = s;
        return this;
      },
                        
      /**
            <p>Sets the default slop for phrases. If zero, then exact phrase matches
            are required.</p>  

            <p>Default: <code>0</code>.</p>

            @member ejs.FieldQuery
            @param {Integer} slop A positive <code>integer</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      phraseSlop: function (slop) {
        if (slop == null) {
          return query.field[field].phrase_slop;
        }

        query.field[field].phrase_slop = slop;
        return this;
      },

      /**
            <p>Sets whether or not we should attempt to analyzed wilcard terms in the
            <code>Query</code>.</p> 

            <p>By default, wildcard terms are not analyzed. Analysis of wildcard characters is not perfect.</p>  

            <p>Default: <code>false</code>.</p>

            @member ejs.FieldQuery
            @param {Boolean} trueFalse A <code>true/false</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      analyzeWildcard: function (trueFalse) {
        if (trueFalse == null) {
          return query.field[field].analyze_wildcard;
        }

        query.field[field].analyze_wildcard = trueFalse;
        return this;
      },

      /**
            <p>If the query string should be escaped or not.</p>

            @member ejs.FieldQuery
            @param {Boolean} trueFalse A <code>true/false</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      escape: function (trueFalse) {
        if (trueFalse == null) {
          return query.field[field].escape;
        }

        query.field[field].escape = trueFalse;
        return this;
      },
      
      /**
            <p>Sets a percent value controlling how many <code>should</code> clauses in the
            resulting <code>Query</code> should match.</p>

            @member ejs.FieldQuery
            @param {Integer} minMatch An <code>integer</code> between 0 and 100.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minimumShouldMatch: function (minMatch) {
        if (minMatch == null) {
          return query.field[field].minimum_should_match;
        }

        query.field[field].minimum_should_match = minMatch;
        return this;
      },

      /**
            <p>Allows you to serialize this object into a JSON encoded string.</p>

            @member ejs.FieldQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            <p>The type of ejs object.  For internal use only.</p>
            
            @member ejs.FieldQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            <p>Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.</p>

            @member ejs.FieldQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>Filter queries allow you to restrict the results returned by a query. There are
    several different types of filters that can be applied
    (see <a href="/jsdocs/ejs.filter.html">filter</a> module). A <code>filterQuery</code>
    takes a <code>Query</code> and a <code>Filter</code> object as arguments and constructs
    a new <code>Query</code> that is then used for the search.</p>

    @name ejs.FilteredQuery

    @desc
    <p>A query that applies a filter to the results of another query.</p>

    @param {Object} someQuery a valid <code>Query</code> object
    @param {Object} someFilter a valid <code>Filter</code> object.  This parameter
      is optional.

     */
  ejs.FilteredQuery = function (someQuery, someFilter) {

    if (!isQuery(someQuery)) {
      throw new TypeError('Argument must be a Query');
    }
    
    if (someFilter != null && !isFilter(someFilter)) {
      throw new TypeError('Argument must be a Filter');
    }
    
    /**
         The internal query object. Use <code>_self()</code>
         @member ejs.FilteredQuery
         @property {Object} query
         */
    var query = {
      filtered: {
        query: someQuery._self()
      }
    };

    if (someFilter != null) {
      query.filtered.filter = someFilter._self();
    }
    
    return {

      /**
             <p>Adds the query to apply a constant score to.</p>

             @member ejs.FilteredQuery
             @param {Object} oQuery A valid <code>Query</code> object
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      query: function (oQuery) {
        if (oQuery == null) {
          return query.filtered.query;
        }
      
        if (!isQuery(oQuery)) {
          throw new TypeError('Argument must be a Query');
        }
        
        query.filtered.query = oQuery._self();
        return this;
      },

      /**
             <p>Adds the filter to apply a constant score to.</p>

             @member ejs.FilteredQuery
             @param {Object} oFilter A valid <code>Filter</code> object
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      filter: function (oFilter) {
        if (oFilter == null) {
          return query.filtered.filter;
        }
      
        if (!isFilter(oFilter)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        query.filtered.filter = oFilter._self();
        return this;
      },

      /**
            <p>Sets the filter strategy.</p>  

            <p>The strategy defines how the filter is applied during document collection.  
            Valid values are:</p>
            
            <dl>
                <dd><code>query_first</code> - advance query scorer first then filter</dd>
                <dd><code>random_access_random</code> - random access filter</dd>
                <dd><code>leap_frog</code> - query scorer and filter "leap-frog", query goes first</dd>
                <dd><code>leap_frog_filter_first</code> - same as <code>leap_frog</code>, but filter goes first</dd>
                <dd><code>random_access_N</code> - replace <code>N</code> with integer, same as random access 
                 except you can specify a custom threshold</dd>
            </dl>

            <p>This is an advanced setting, use with care.</p>
            
            @member ejs.FilteredQuery
            @param {String} strategy The strategy as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      strategy: function (strategy) {
        if (strategy == null) {
          return query.filtered.strategy;
        }

        strategy = strategy.toLowerCase();
        if (strategy === 'query_first' || strategy === 'random_access_always' ||
          strategy === 'leap_frog' || strategy === 'leap_frog_filter_first' ||
          strategy.indexOf('random_access_') === 0) {
            
          query.filtered.strategy = strategy;
        }
        
        return this;
      },
      
      /**
            <p>Enables caching of the filter.</p>

            @member ejs.FilteredQuery
            @param {Boolean} trueFalse A boolean value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cache: function (trueFalse) {
        if (trueFalse == null) {
          return query.filtered._cache;
        }

        query.filtered._cache = trueFalse;
        return this;
      },
      
      /**
            <p>Set the cache key.</p>

            @member ejs.FilteredQuery
            @param {String} k A string cache key.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cacheKey: function (k) {
        if (k == null) {
          return query.filtered._cache_key;
        }

        query.filtered._cache_key = k;
        return this;
      },
      
      /**
            <p>Sets the boost value of the <code>Query</code>.</p>

            @member ejs.FilteredQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.filtered.boost;
        }

        query.filtered.boost = boost;
        return this;
      },
      
      /**
             <p>Converts this object to a json string</p>

             @member ejs.FilteredQuery
             @returns {Object} string
             */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            <p>The type of ejs object.  For internal use only.</p>
            
            @member ejs.FilteredQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
             <p>returns the query object.</p>

             @member ejs.FilteredQuery
             @returns {Object} query object
             */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>The fuzzy_like_this_field query is the same as the fuzzy_like_this 
    query, except that it runs against a single field. It provides nicer query 
    DSL over the generic fuzzy_like_this query, and support typed fields 
    query (automatically wraps typed fields with type filter to match only on 
    the specific type).</p>

    <p>Fuzzifies ALL terms provided as strings and then picks the best n 
    differentiating terms. In effect this mixes the behaviour of FuzzyQuery and 
    MoreLikeThis but with special consideration of fuzzy scoring factors. This 
    generally produces good results for queries where users may provide details 
    in a number of fields and have no knowledge of boolean query syntax and 
    also want a degree of fuzzy matching and a fast query.</p>

    <p>For each source term the fuzzy variants are held in a BooleanQuery with 
    no coord factor (because we are not looking for matches on multiple variants 
    in any one doc). Additionally, a specialized TermQuery is used for variants 
    and does not use that variant term’s IDF because this would favour rarer 
    terms eg misspellings. Instead, all variants use the same IDF 
    ranking (the one for the source query term) and this is factored into the 
    variant’s boost. If the source query term does not exist in the index the 
    average IDF of the variants is used.</p>

    @name ejs.FuzzyLikeThisFieldQuery

    @desc
    <p>Constructs a query where each documents returned are “like” provided text</p>

    @param {String} field The field to run the query against.
    @param {String} likeText The text to find documents like it.
    */
  ejs.FuzzyLikeThisFieldQuery = function (field, likeText) {

    /**
         The internal Query object. Use <code>get()</code>.
         @member ejs.FuzzyLikeThisFieldQuery
         @property {Object} query
         */
    var query = {
      flt_field: {}
    };

    query.flt_field[field] = {
      like_text: likeText
    };
  
    return {
  
      /**
             The field to run the query against.

             @member ejs.FuzzyLikeThisFieldQuery
             @param {String} f A single field name.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      field: function (f) {
        var oldValue = query.flt_field[field];
      
        if (f == null) {
          return field;
        }
    
        delete query.flt_field[field];
        field = f;
        query.flt_field[f] = oldValue;
    
        return this;
      },
  
      /**
            The text to find documents like

            @member ejs.FuzzyLikeThisFieldQuery
            @param {String} s A text string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      likeText: function (txt) {
        if (txt == null) {
          return query.flt_field[field].like_text;
        }
  
        query.flt_field[field].like_text = txt;
        return this;
      },

      /**
            Should term frequency be ignored. Defaults to false.

            @member ejs.FuzzyLikeThisFieldQuery
            @param {Boolean} trueFalse A boolean value
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      ignoreTf: function (trueFalse) {
        if (trueFalse == null) {
          return query.flt_field[field].ignore_tf;
        }
  
        query.flt_field[field].ignore_tf = trueFalse;
        return this;
      },

      /**
            The maximum number of query terms that will be included in any 
            generated query. Defaults to 25.

            @member ejs.FuzzyLikeThisFieldQuery
            @param {Integer} max A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxQueryTerms: function (max) {
        if (max == null) {
          return query.flt_field[field].max_query_terms;
        }
  
        query.flt_field[field].max_query_terms = max;
        return this;
      },

      /**
            The minimum similarity of the term variants. Defaults to 0.5.

            @member ejs.FuzzyLikeThisFieldQuery
            @param {Double} min A positive double value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minSimilarity: function (min) {
        if (min == null) {
          return query.flt_field[field].min_similarity;
        }
  
        query.flt_field[field].min_similarity = min;
        return this;
      },

      /**
            Length of required common prefix on variant terms. Defaults to 0..

            @member ejs.FuzzyLikeThisFieldQuery
            @param {Integer} len A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      prefixLength: function (len) {
        if (len == null) {
          return query.flt_field[field].prefix_length;
        }
  
        query.flt_field[field].prefix_length = len;
        return this;
      },

      /**
            The analyzer that will be used to analyze the text. Defaults to the 
            analyzer associated with the field.

            @member ejs.FuzzyLikeThisFieldQuery
            @param {String} analyzerName The name of the analyzer.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      analyzer: function (analyzerName) {
        if (analyzerName == null) {
          return query.flt_field[field].analyzer;
        }
  
        query.flt_field[field].analyzer = analyzerName;
        return this;
      },
                      
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.FuzzyLikeThisFieldQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.flt_field[field].boost;
        }

        query.flt_field[field].boost = boost;
        return this;
      },

      /**
             Serializes the internal <em>query</em> object as a JSON string.
             @member ejs.FuzzyLikeThisFieldQuery
             @returns {String} Returns a JSON representation of the Query object.
             */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.FuzzyLikeThisFieldQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            This method is used to retrieve the raw query object. It's designed
            for internal use when composing and serializing queries.
            @member ejs.FuzzyLikeThisFieldQuery
            @returns {Object} Returns the object's <em>query</em> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>Fuzzy like this query find documents that are “like” provided text by 
    running it against one or more fields.</p>

    <p>Fuzzifies ALL terms provided as strings and then picks the best n 
    differentiating terms. In effect this mixes the behaviour of FuzzyQuery and 
    MoreLikeThis but with special consideration of fuzzy scoring factors. This 
    generally produces good results for queries where users may provide details 
    in a number of fields and have no knowledge of boolean query syntax and 
    also want a degree of fuzzy matching and a fast query.</p>
  
    <p>For each source term the fuzzy variants are held in a BooleanQuery with 
    no coord factor (because we are not looking for matches on multiple variants 
    in any one doc). Additionally, a specialized TermQuery is used for variants 
    and does not use that variant term’s IDF because this would favour rarer 
    terms eg misspellings. Instead, all variants use the same IDF 
    ranking (the one for the source query term) and this is factored into the 
    variant’s boost. If the source query term does not exist in the index the 
    average IDF of the variants is used.</p>

    @name ejs.FuzzyLikeThisQuery

    @desc
    <p>Constructs a query where each documents returned are “like” provided text</p>

    @param {String} likeText The text to find documents like it.
    */
  ejs.FuzzyLikeThisQuery = function (likeText) {

    /**
         The internal Query object. Use <code>get()</code>.
         @member ejs.FuzzyLikeThisQuery
         @property {Object} query
         */
    var query = {
      flt: {
        like_text: likeText
      }
    };

    return {
    
      /**
             The fields to run the query against.  If you call with a single field,
             it is added to the existing list of fields.  If called with an array
             of field names, it replaces any existing values with the new array.

             @member ejs.FuzzyLikeThisQuery
             @param {String || Array} f A single field name or a list of field names.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      fields: function (f) {
        if (query.flt.fields == null) {
          query.flt.fields = [];
        }
      
        if (f == null) {
          return query.flt.fields;
        }
      
        if (isString(f)) {
          query.flt.fields.push(f);
        } else if (isArray(f)) {
          query.flt.fields = f;
        } else {
          throw new TypeError('Argument must be a string or array');
        }
      
        return this;
      },
    
      /**
            The text to find documents like

            @member ejs.FuzzyLikeThisQuery
            @param {String} s A text string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      likeText: function (txt) {
        if (txt == null) {
          return query.flt.like_text;
        }
    
        query.flt.like_text = txt;
        return this;
      },

      /**
            Should term frequency be ignored. Defaults to false.

            @member ejs.FuzzyLikeThisQuery
            @param {Boolean} trueFalse A boolean value
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      ignoreTf: function (trueFalse) {
        if (trueFalse == null) {
          return query.flt.ignore_tf;
        }
    
        query.flt.ignore_tf = trueFalse;
        return this;
      },

      /**
            The maximum number of query terms that will be included in any 
            generated query. Defaults to 25.

            @member ejs.FuzzyLikeThisQuery
            @param {Integer} max A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxQueryTerms: function (max) {
        if (max == null) {
          return query.flt.max_query_terms;
        }
    
        query.flt.max_query_terms = max;
        return this;
      },

      /**
            The minimum similarity of the term variants. Defaults to 0.5.

            @member ejs.FuzzyLikeThisQuery
            @param {Double} min A positive double value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minSimilarity: function (min) {
        if (min == null) {
          return query.flt.min_similarity;
        }
    
        query.flt.min_similarity = min;
        return this;
      },

      /**
            Length of required common prefix on variant terms. Defaults to 0..

            @member ejs.FuzzyLikeThisQuery
            @param {Integer} len A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      prefixLength: function (len) {
        if (len == null) {
          return query.flt.prefix_length;
        }
    
        query.flt.prefix_length = len;
        return this;
      },

      /**
            The analyzer that will be used to analyze the text. Defaults to the 
            analyzer associated with the field.

            @member ejs.FuzzyLikeThisQuery
            @param {String} analyzerName The name of the analyzer.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      analyzer: function (analyzerName) {
        if (analyzerName == null) {
          return query.flt.analyzer;
        }
    
        query.flt.analyzer = analyzerName;
        return this;
      },
                        
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.FuzzyLikeThisQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.flt.boost;
        }

        query.flt.boost = boost;
        return this;
      },

      /**
             Serializes the internal <em>query</em> object as a JSON string.
             @member ejs.FuzzyLikeThisQuery
             @returns {String} Returns a JSON representation of the Query object.
             */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.FuzzyLikeThisQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            This method is used to retrieve the raw query object. It's designed
            for internal use when composing and serializing queries.
            @member ejs.FuzzyLikeThisQuery
            @returns {Object} Returns the object's <em>query</em> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>A fuzzy search query based on the Damerau-Levenshtein (optimal string 
    alignment) algorithm, though you can explicitly choose classic Levenshtein 
    by passing false to the transpositions parameter./p>
  
    <p>fuzzy query on a numeric field will result in a range query “around” 
    the value using the min_similarity value. As an example, if you perform a
    fuzzy query against a field value of "12" with a min similarity setting
    of "2", the query will search for values between "10" and "14".</p>

    @name ejs.FuzzyQuery

    @desc
    <p>Constructs a query where each documents returned are “like” provided text</p>
    
    @param {String} field The field to run the fuzzy query against.
    @param {String} value The value to fuzzify.
    
     */
  ejs.FuzzyQuery = function (field, value) {

    /**
         The internal Query object. Use <code>get()</code>.
         @member ejs.FuzzyQuery
         @property {Object} query
         */
    var query = {
      fuzzy: {}
    };

    query.fuzzy[field] = {
      value: value
    };

    return {

      /**
             <p>The field to run the query against.</p>

             @member ejs.FuzzyQuery
             @param {String} f A single field name.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      field: function (f) {
        var oldValue = query.fuzzy[field];
    
        if (f == null) {
          return field;
        }
  
        delete query.fuzzy[field];
        field = f;
        query.fuzzy[f] = oldValue;
  
        return this;
      },

      /**
            <p>The query text to fuzzify.</p>

            @member ejs.FuzzyQuery
            @param {String} s A text string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      value: function (txt) {
        if (txt == null) {
          return query.fuzzy[field].value;
        }

        query.fuzzy[field].value = txt;
        return this;
      },

      /**
            <p>Set to false to use classic Levenshtein edit distance.</p>

            @member ejs.FuzzyQuery
            @param {Boolean} trueFalse A boolean value
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      transpositions: function (trueFalse) {
        if (trueFalse == null) {
          return query.fuzzy[field].transpositions;
        }

        query.fuzzy[field].transpositions = trueFalse;
        return this;
      },

      /**
            <p>The maximum number of query terms that will be included in any 
            generated query. Defaults to <code>50</code>.<p>

            @member ejs.FuzzyQuery
            @param {Integer} max A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxExpansions: function (max) {
        if (max == null) {
          return query.fuzzy[field].max_expansions;
        }

        query.fuzzy[field].max_expansions = max;
        return this;
      },

      /**
            <p>The minimum similarity of the term variants. Defaults to <code>0.5</code>.</p>

            @member ejs.FuzzyQuery
            @param {Double} min A positive double value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minSimilarity: function (min) {
        if (min == null) {
          return query.fuzzy[field].min_similarity;
        }

        query.fuzzy[field].min_similarity = min;
        return this;
      },

      /**
            <p>Length of required common prefix on variant terms. Defaults to <code>0</code>.</p>

            @member ejs.FuzzyQuery
            @param {Integer} len A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      prefixLength: function (len) {
        if (len == null) {
          return query.fuzzy[field].prefix_length;
        }

        query.fuzzy[field].prefix_length = len;
        return this;
      },
      
      /**
            <p>Sets rewrite method.  Valid values are:</p> 
            
            <dl>
                <dd><code>constant_score_auto</code> - tries to pick the best constant-score rewrite 
                 method based on term and document counts from the query</dd>
              
                <dd><code>scoring_boolean</code> - translates each term into boolean should and 
                 keeps the scores as computed by the query</dd>
              
                <dd><code>constant_score_boolean</code> - same as scoring_boolean, expect no scores
                 are computed.</dd>
              
                <dd><code>constant_score_filter</code> - first creates a private Filter, by visiting 
                 each term in sequence and marking all docs for that term</dd>
              
                <dd><code>top_terms_boost_N</code> - first translates each term into boolean should
                 and scores are only computed as the boost using the top <code>N</code>
                 scoring terms.  Replace <code>N</code> with an integer value.</dd>
              
                <dd><code>top_terms_N</code> - first translates each term into boolean should
                 and keeps the scores as computed by the query. Only the top <code>N</code>
                 scoring terms are used.  Replace <code>N</code> with an integer value.</dd>
            </dl>
            
            <p>Default is <code>constant_score_auto</code>.</p>

            <p>This is an advanced option, use with care.</p>

            @member ejs.FuzzyQuery
            @param {String} m The rewrite method as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      rewrite: function (m) {
        if (m == null) {
          return query.fuzzy[field].rewrite;
        }
        
        m = m.toLowerCase();
        if (m === 'constant_score_auto' || m === 'scoring_boolean' ||
          m === 'constant_score_boolean' || m === 'constant_score_filter' ||
          m.indexOf('top_terms_boost_') === 0 || 
          m.indexOf('top_terms_') === 0) {
            
          query.fuzzy[field].rewrite = m;
        }
        
        return this;
      },
      
                    
      /**
            <p>Sets the boost value of the <code>Query</code>.</p>

            @member ejs.FuzzyQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.fuzzy[field].boost;
        }

        query.fuzzy[field].boost = boost;
        return this;
      },

      /**
             <p>Serializes the internal <code>query</code> object as a JSON string.</p>

             @member ejs.FuzzyQuery
             @returns {String} Returns a JSON representation of the Query object.
             */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            <p>The type of ejs object.  For internal use only.</p>
            
            @member ejs.FuzzyQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            <p>This method is used to retrieve the raw query object. It's designed
            for internal use when composing and serializing queries.</p>

            @member ejs.FuzzyQuery
            @returns {Object} Returns the object's <em>query</em> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>Efficient querying of documents containing shapes indexed using the 
    geo_shape type.</p>

    <p>Much like the geo_shape type, the geo_shape query uses a grid square 
    representation of the query shape to find those documents which have shapes 
    that relate to the query shape in a specified way. In order to do this, the 
    field being queried must be of geo_shape type. The query will use the same 
    PrefixTree configuration as defined for the field.</p>
  
    @name ejs.GeoShapeQuery

    @desc
    A Query to find documents with a geo_shapes matching a specific shape.

    */
  ejs.GeoShapeQuery = function (field) {

    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.GeoShapeQuery
         @property {Object} GeoShapeQuery
         */
    var query = {
      geo_shape: {}
    };

    query.geo_shape[field] = {};

    return {

      /**
            Sets the field to query against.

            @member ejs.GeoShapeQuery
            @param {String} f A valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (f) {
        var oldValue = query.geo_shape[field];
    
        if (f == null) {
          return field;
        }

        delete query.geo_shape[field];
        field = f;
        query.geo_shape[f] = oldValue;
    
        return this;
      },

      /**
            Sets the shape

            @member ejs.GeoShapeQuery
            @param {String} shape A valid <code>Shape</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      shape: function (shape) {
        if (shape == null) {
          return query.geo_shape[field].shape;
        }

        if (query.geo_shape[field].indexed_shape != null) {
          delete query.geo_shape[field].indexed_shape;
        }
        
        query.geo_shape[field].shape = shape._self();
        return this;
      },

      /**
            Sets the indexed shape.  Use this if you already have shape definitions
            already indexed.

            @member ejs.GeoShapeQuery
            @param {String} indexedShape A valid <code>IndexedShape</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      indexedShape: function (indexedShape) {
        if (indexedShape == null) {
          return query.geo_shape[field].indexed_shape;
        }

        if (query.geo_shape[field].shape != null) {
          delete query.geo_shape[field].shape;
        }
        
        query.geo_shape[field].indexed_shape = indexedShape._self();
        return this;
      },

      /**
            Sets the shape relation type.  A relationship between a Query Shape 
            and indexed Shapes that will be used to determine if a Document 
            should be matched or not.  Valid values are:  intersects, disjoint,
            and within.

            @member ejs.GeoShapeQuery
            @param {String} indexedShape A valid <code>IndexedShape</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      relation: function (relation) {
        if (relation == null) {
          return query.geo_shape[field].relation;
        }

        relation = relation.toLowerCase();
        if (relation === 'intersects' || relation === 'disjoint' || relation === 'within') {
          query.geo_shape[field].relation = relation;
        }
      
        return this;
      },

      /**
            <p>Sets the spatial strategy.</p>  
            <p>Valid values are:</p>
            
            <dl>
                <dd><code>recursive</code> - default, recursively traverse nodes in
                  the spatial prefix tree.  This strategy has support for 
                  searching non-point shapes.</dd>
                <dd><code>term</code> - uses a large TermsFilter on each node
                  in the spatial prefix tree.  It only supports the search of 
                  indexed Point shapes.</dd>
            </dl>

            <p>This is an advanced setting, use with care.</p>
            
            @since elasticsearch 0.90
            @member ejs.GeoShapeQuery
            @param {String} strategy The strategy as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      strategy: function (strategy) {
        if (strategy == null) {
          return query.geo_shape[field].strategy;
        }

        strategy = strategy.toLowerCase();
        if (strategy === 'recursive' || strategy === 'term') {
          query.geo_shape[field].strategy = strategy;
        }
        
        return this;
      },
             
      /**
            Sets the boost value for documents matching the <code>Query</code>.

            @member ejs.GeoShapeQuery
            @param {Number} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.geo_shape[field].boost;
        }

        query.geo_shape[field].boost = boost;
        return this;
      },

      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.GeoShapeQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.GeoShapeQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.GeoShapeQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>The has_child query works the same as the has_child filter, 
    by automatically wrapping the filter with a constant_score. Results in 
    parent documents that have child docs matching the query being returned.</p>
  
    @name ejs.HasChildQuery

    @desc
    Returns results that have child documents matching the query.

    @param {Object} qry A valid query object.
    @param {String} type The child type
    */
  ejs.HasChildQuery = function (qry, type) {

    if (!isQuery(qry)) {
      throw new TypeError('Argument must be a valid Query');
    }
    
    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.HasChildQuery
         @property {Object} query
         */
    var query = {
      has_child: {
        query: qry._self(),
        type: type
      }
    };

    return {

      /**
            Sets the query

            @member ejs.HasChildQuery
            @param {Object} q A valid Query object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (q) {
        if (q == null) {
          return query.has_child.query;
        }
    
        if (!isQuery(q)) {
          throw new TypeError('Argument must be a valid Query');
        }
        
        query.has_child.query = q._self();
        return this;
      },

      /**
            Sets the child document type to search against

            @member ejs.HasChildQuery
            @param {String} t A valid type name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      type: function (t) {
        if (t == null) {
          return query.has_child.type;
        }
    
        query.has_child.type = t;
        return this;
      },

      /**
            Sets the scope of the query.  A scope allows to run facets on the 
            same scope name that will work against the child documents. 

            @deprecated since elasticsearch 0.90
            @member ejs.HasChildQuery
            @param {String} s The scope name as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (s) {
        return this;
      },

      /**
            Sets the scoring method.  Valid values are:
            
            none - the default, no scoring
            max - the highest score of all matched child documents is used
            sum - the sum the all the matched child documents is used
            avg - the average of all matched child documents is used

            @member ejs.HasChildQuery
            @param {String} s The score type as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scoreType: function (s) {
        if (s == null) {
          return query.has_child.score_type;
        }
    
        s = s.toLowerCase();
        if (s === 'none' || s === 'max' || s === 'sum' || s === 'avg') {
          query.has_child.score_type = s;
        }
        
        return this;
      },
      
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.HasChildQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.has_child.boost;
        }

        query.has_child.boost = boost;
        return this;
      },
        
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.HasChildQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.HasChildQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.HasChildQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>The has_parent query works the same as the has_parent filter, by 
    automatically wrapping the filter with a constant_score. Results in 
    child documents that have parent docs matching the query being returned.</p>

    @name ejs.HasParentQuery

    @desc
    Returns results that have parent documents matching the query.

    @param {Object} qry A valid query object.
    @param {String} parentType The child type
    */
  ejs.HasParentQuery = function (qry, parentType) {

    if (!isQuery(qry)) {
      throw new TypeError('Argument must be a Query');
    }
    
    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.HasParentQuery
         @property {Object} query
         */
    var query = {
      has_parent: {
        query: qry._self(),
        parent_type: parentType
      }
    };

    return {

      /**
            Sets the query

            @member ejs.HasParentQuery
            @param {Object} q A valid Query object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (q) {
        if (q == null) {
          return query.has_parent.query;
        }
  
        if (!isQuery(q)) {
          throw new TypeError('Argument must be a Query');
        }
        
        query.has_parent.query = q._self();
        return this;
      },

      /**
            Sets the child document type to search against

            @member ejs.HasParentQuery
            @param {String} t A valid type name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      parentType: function (t) {
        if (t == null) {
          return query.has_parent.parent_type;
        }
  
        query.has_parent.parent_type = t;
        return this;
      },

      /**
            Sets the scope of the query.  A scope allows to run facets on the 
            same scope name that will work against the parent documents. 

            @deprecated since elasticsearch 0.90
            @member ejs.HasParentQuery
            @param {String} s The scope name as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (s) {
        return this;
      },

      /**
            Sets the scoring method.  Valid values are:
            
            none - the default, no scoring
            score - the score of the parent is used in all child documents.

            @member ejs.HasParentQuery
            @param {String} s The score type as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scoreType: function (s) {
        if (s == null) {
          return query.has_parent.score_type;
        }
    
        s = s.toLowerCase();
        if (s === 'none' || s === 'score') {
          query.has_parent.score_type = s;
        }
        
        return this;
      },
      
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.HasParentQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.has_parent.boost;
        }

        query.has_parent.boost = boost;
        return this;
      },
      
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.HasParentQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.HasParentQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.HasParentQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>Filters documents that only have the provided ids. Note, this filter 
    does not require the _id field to be indexed since it works using the 
    _uid field.</p>

    @name ejs.IdsQuery

    @desc
    Matches documents with the specified id(s).

    @param {Array || String} ids A single document id or a list of document ids.
    */
  ejs.IdsQuery = function (ids) {

    /**
         The internal query object. <code>Use get()</code>
         @member ejs.IdsQuery
         @property {Object} query
         */
    var query = {
      ids: {}
    };
    
    if (isString(ids)) {
      query.ids.values = [ids];
    } else if (isArray(ids)) {
      query.ids.values = ids;
    } else {
      throw new TypeError('Argument must be string or array');
    }

    return {

      /**
            Sets the values array or adds a new value. if val is a string, it
            is added to the list of existing document ids.  If val is an
            array it is set as the document values and replaces any existing values.

            @member ejs.IdsQuery
            @param {Array || String} val An single document id or an array of document ids.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      values: function (val) {
        if (val == null) {
          return query.ids.values;
        }
    
        if (isString(val)) {
          query.ids.values.push(val);
        } else if (isArray(val)) {
          query.ids.values = val;
        } else {
          throw new TypeError('Argument must be string or array');
        }
        
        return this;
      },

      /**
            Sets the type as a single type or an array of types.  If type is a
            string, it is added to the list of existing types.  If type is an
            array, it is set as the types and overwrites an existing types. This
            parameter is optional.

            @member ejs.IdsQuery
            @param {Array || String} type A type or a list of types
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      type: function (type) {
        if (query.ids.type == null) {
          query.ids.type = [];
        }
        
        if (type == null) {
          return query.ids.type;
        }
        
        if (isString(type)) {
          query.ids.type.push(type);
        } else if (isArray(type)) {
          query.ids.type = type;
        } else {
          throw new TypeError('Argument must be string or array');
        }
        
        return this;
      },

      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.IdsQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.ids.boost;
        }

        query.ids.boost = boost;
        return this;
      },
            
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.IdsQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.IdsQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.IdsQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>The indices query can be used when executed across multiple indices, 
    allowing to have a query that executes only when executed on an index that 
    matches a specific list of indices, and another query that executes when it 
    is executed on an index that does not match the listed indices.</p>

    @name ejs.IndicesQuery

    @desc
    A configurable query that is dependent on the index name.

    @param {Object} qry A valid query object.
    @param {String || Array} indices a single index name or an array of index 
      names.
    */
  ejs.IndicesQuery = function (qry, indices) {

    if (!isQuery(qry)) {
      throw new TypeError('Argument must be a Query');
    }
    
    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.IndicesQuery
         @property {Object} query
         */
    var query = {
      indices: {
        query: qry._self()
      }
    };

    if (isString(indices)) {
      query.indices.indices = [indices];
    } else if (isArray(indices)) {
      query.indices.indices = indices;
    } else {
      throw new TypeError('Argument must be a string or array');
    }
  
    return {

      /**
            Sets the indicies the query should match.  When passed a string,
            the index name is added to the current list of indices.  When passed
            an array, it overwites all current indices.

            @member ejs.IndicesQuery
            @param {String || Array} i A single index name or an array of index names.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      indices: function (i) {
        if (i == null) {
          return query.indices.indices;
        }
  
        if (isString(i)) {
          query.indices.indices.push(i);
        } else if (isArray(i)) {
          query.indices.indices = i;
        } else {
          throw new TypeError('Argument must be a string or array');
        }

        return this;
      },
    
      /**
            Sets the query to be executed against the indices specified.

            @member ejs.IndicesQuery
            @param {Object} q A valid Query object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (q) {
        if (q == null) {
          return query.indices.query;
        }
  
        if (!isQuery(q)) {
          throw new TypeError('Argument must be a Query');
        }
        
        query.indices.query = q._self();
        return this;
      },

      /**
            Sets the query to be used on an index that does not match an index
            name in the indices list.  Can also be set to "none" to not match any
            documents or "all" to match all documents.

            @member ejs.IndicesQuery
            @param {Object || String} q A valid Query object or "none" or "all"
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      noMatchQuery: function (q) {
        if (q == null) {
          return query.indices.no_match_query;
        }
  
        if (isString(q)) {
          q = q.toLowerCase();
          if (q === 'none' || q === 'all') {
            query.indices.no_match_query = q;
          }
        } else if (isQuery(q)) {
          query.indices.no_match_query = q._self();
        } else {
          throw new TypeError('Argument must be string or Query');
        }
      
        return this;
      },
    
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.IndicesQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.indices.boost;
        }

        query.indices.boost = boost;
        return this;
      },
      
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.IndicesQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.IndicesQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.IndicesQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>This query can be used to match all the documents
    in a given set of collections and/or types.</p>

    @name ejs.MatchAllQuery

    @desc
    <p>A query that returns all documents.</p>

     */
  ejs.MatchAllQuery = function () {

    /**
         The internal Query object. Use <code>get()</code>.
         @member ejs.MatchAllQuery
         @property {Object} query
         */
    var query = {
      match_all: {}
    };

    return {

      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.MatchAllQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.match_all.boost;
        }

        query.match_all.boost = boost;
        return this;
      },
      
      /**
             Serializes the internal <em>query</em> object as a JSON string.
             @member ejs.MatchAllQuery
             @returns {String} Returns a JSON representation of the Query object.
             */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.MatchAllQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            This method is used to retrieve the raw query object. It's designed
            for internal use when composing and serializing queries.
            
            @member ejs.MatchAllQuery
            @returns {Object} Returns the object's <em>query</em> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    A <code>MatchQuery</code> is a type of <code>Query</code> that accepts 
    text/numerics/dates, analyzes it, generates a query based on the
    <code>MatchQuery</code> type.
  
    @name ejs.MatchQuery

    @desc
    A Query that appects text, analyzes it, generates internal query based
    on the MatchQuery type.

    @param {String} field the document field/field to query against
    @param {String} qstr the query string
    */
  ejs.MatchQuery = function (field, qstr) {

    /**
         The internal query object. <code>Use get()</code>
         @member ejs.MatchQuery
         @property {Object} query
         */
    var query = {
      match: {}
    };
    
    query.match[field] = {
      query: qstr
    };

    return {

      /**
            Sets the boost value for documents matching the <code>Query</code>.

            @member ejs.MatchQuery
            @param {Number} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.match[field].boost;
        }

        query.match[field].boost = boost;
        return this;
      },

      /**
            Sets the query string for the <code>Query</code>.

            @member ejs.MatchQuery
            @param {String} qstr The query string to search for.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (qstr) {
        if (qstr == null) {
          return query.match[field].query;
        }

        query.match[field].query = qstr;
        return this;
      },

      /**
            Sets the type of the <code>MatchQuery</code>.  Valid values are
            boolean, phrase, and phrase_prefix.

            @member ejs.MatchQuery
            @param {String} type Any of boolean, phrase, phrase_prefix.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      type: function (type) {
        if (type == null) {
          return query.match[field].type;
        }

        type = type.toLowerCase();
        if (type === 'boolean' || type === 'phrase' || type === 'phrase_prefix') {
          query.match[field].type = type;
        }

        return this;
      },

      /**
            Sets the fuzziness value for the <code>Query</code>.

            @member ejs.MatchQuery
            @param {Double} fuzz A <code>double</code> value between 0.0 and 1.0.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fuzziness: function (fuzz) {
        if (fuzz == null) {
          return query.match[field].fuzziness;
        }

        query.match[field].fuzziness = fuzz;
        return this;
      },

      /**
            Sets the maximum threshold/frequency to be considered a low 
            frequency term in a <code>CommonTermsQuery</code>.  
            Set to a value between 0 and 1.

            @member ejs.MatchQuery
            @param {Number} freq A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cutoffFrequency: function (freq) {
        if (freq == null) {
          return query.match[field].cutoff_frequency;
        }

        query.match[field].cutoff_frequency = freq;
        return this;
      },
      
      /**
            Sets the prefix length for a fuzzy prefix <code>MatchQuery</code>.

            @member ejs.MatchQuery
            @param {Integer} l A positive <code>integer</code> length value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      prefixLength: function (l) {
        if (l == null) {
          return query.match[field].prefix_length;
        }

        query.match[field].prefix_length = l;
        return this;
      },

      /**
            Sets the max expansions of a fuzzy <code>MatchQuery</code>.

            @member ejs.MatchQuery
            @param {Integer} e A positive <code>integer</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxExpansions: function (e) {
        if (e == null) {
          return query.match[field].max_expansions;
        }

        query.match[field].max_expansions = e;
        return this;
      },

      /**
            Sets default operator of the <code>Query</code>.  Default: or.

            @member ejs.MatchQuery
            @param {String} op Any of "and" or "or", no quote characters.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      operator: function (op) {
        if (op == null) {
          return query.match[field].operator;
        }

        op = op.toLowerCase();
        if (op === 'and' || op === 'or') {
          query.match[field].operator = op;
        }

        return this;
      },

      /**
            Sets the default slop for phrases. If zero, then exact phrase matches
            are required.  Default: 0.

            @member ejs.MatchQuery
            @param {Integer} slop A positive <code>integer</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      slop: function (slop) {
        if (slop == null) {
          return query.match[field].slop;
        }

        query.match[field].slop = slop;
        return this;
      },

      /**
            Sets the analyzer name used to analyze the <code>Query</code> object.

            @member ejs.MatchQuery
            @param {String} analyzer A valid analyzer name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      analyzer: function (analyzer) {
        if (analyzer == null) {
          return query.match[field].analyzer;
        }

        query.match[field].analyzer = analyzer;
        return this;
      },

      /**
            Sets a percent value controlling how many "should" clauses in the
            resulting <code>Query</code> should match.

            @member ejs.MatchQuery
            @param {Integer} minMatch An <code>integer</code> between 0 and 100.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minimumShouldMatch: function (minMatch) {
        if (minMatch == null) {
          return query.match[field].minimum_should_match;
        }

        query.match[field].minimum_should_match = minMatch;
        return this;
      },
      
      /**
            Sets rewrite method.  Valid values are: 
            
            constant_score_auto - tries to pick the best constant-score rewrite 
              method based on term and document counts from the query
              
            scoring_boolean - translates each term into boolean should and 
              keeps the scores as computed by the query
              
            constant_score_boolean - same as scoring_boolean, expect no scores
              are computed.
              
            constant_score_filter - first creates a private Filter, by visiting 
              each term in sequence and marking all docs for that term
              
            top_terms_boost_N - first translates each term into boolean should
              and scores are only computed as the boost using the top N
              scoring terms.  Replace N with an integer value.
              
            top_terms_N -   first translates each term into boolean should
                and keeps the scores as computed by the query. Only the top N
                scoring terms are used.  Replace N with an integer value.
            
            Default is constant_score_auto.

            This is an advanced option, use with care.

            @member ejs.MatchQuery
            @param {String} m The rewrite method as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      rewrite: function (m) {
        if (m == null) {
          return query.match[field].rewrite;
        }
        
        m = m.toLowerCase();
        if (m === 'constant_score_auto' || m === 'scoring_boolean' ||
          m === 'constant_score_boolean' || m === 'constant_score_filter' ||
          m.indexOf('top_terms_boost_') === 0 || 
          m.indexOf('top_terms_') === 0) {
            
          query.match[field].rewrite = m;
        }
        
        return this;
      },
      
      /**
            Sets fuzzy rewrite method.  Valid values are: 
            
            constant_score_auto - tries to pick the best constant-score rewrite 
              method based on term and document counts from the query
              
            scoring_boolean - translates each term into boolean should and 
              keeps the scores as computed by the query
              
            constant_score_boolean - same as scoring_boolean, expect no scores
              are computed.
              
            constant_score_filter - first creates a private Filter, by visiting 
              each term in sequence and marking all docs for that term
              
            top_terms_boost_N - first translates each term into boolean should
              and scores are only computed as the boost using the top N
              scoring terms.  Replace N with an integer value.
              
            top_terms_N -   first translates each term into boolean should
                and keeps the scores as computed by the query. Only the top N
                scoring terms are used.  Replace N with an integer value.
            
            Default is constant_score_auto.

            This is an advanced option, use with care.
            
            @member ejs.MatchQuery
            @param {String} m The rewrite method as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fuzzyRewrite: function (m) {
        if (m == null) {
          return query.match[field].fuzzy_rewrite;
        }

        m = m.toLowerCase();
        if (m === 'constant_score_auto' || m === 'scoring_boolean' ||
          m === 'constant_score_boolean' || m === 'constant_score_filter' ||
          m.indexOf('top_terms_boost_') === 0 || 
          m.indexOf('top_terms_') === 0) {
            
          query.match[field].fuzzy_rewrite = m;
        }
        
        return this;
      },
      
      /**
            Set to false to use classic Levenshtein edit distance in the 
            fuzzy query.

            @member ejs.MatchQuery
            @param {Boolean} trueFalse A boolean value
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fuzzyTranspositions: function (trueFalse) {
        if (trueFalse == null) {
          return query.match[field].fuzzy_transpositions;
        }

        query.match[field].fuzzy_transpositions = trueFalse;
        return this;
      },

      /**
            Enables lenient parsing of the query string.

            @member ejs.MatchQuery
            @param {Boolean} trueFalse A boolean value
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lenient: function (trueFalse) {
        if (trueFalse == null) {
          return query.match[field].lenient;
        }

        query.match[field].lenient = trueFalse;
        return this;
      },
    
      /**
            Sets what happens when no terms match.  Valid values are
            "all" or "none".  

            @member ejs.MatchQuery
            @param {String} q A no match action, "all" or "none".
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      zeroTermsQuery: function (q) {
        if (q == null) {
          return query.match[field].zero_terms_query;
        }

        q = q.toLowerCase();
        if (q === 'all' || q === 'none') {
          query.match[field].zero_terms_query = q;
        }
        
        return this;
      },
              
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.MatchQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.MatchQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.MatchQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>The more_like_this_field query is the same as the more_like_this query, 
    except it runs against a single field.</p>

    @name ejs.MoreLikeThisFieldQuery

    @desc
    <p>Constructs a query where each documents returned are “like” provided text</p>

    @param {String} field The field to run the query against.
    @param {String} likeText The text to find documents like it.

     */
  ejs.MoreLikeThisFieldQuery = function (field, likeText) {

    /**
         The internal Query object. Use <code>get()</code>.
         @member ejs.MoreLikeThisFieldQuery
         @property {Object} query
         */
    var query = {
      mlt_field: {}
    };

    query.mlt_field[field] = {
      like_text: likeText
    };
  
    return {

      /**
             The field to run the query against.

             @member ejs.MoreLikeThisFieldQuery
             @param {String} f A single field name.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      field: function (f) {
        var oldValue = query.mlt_field[field];
    
        if (f == null) {
          return field;
        }
  
        delete query.mlt_field[field];
        field = f;
        query.mlt_field[f] = oldValue;
  
        return this;
      },

      /**
            The text to find documents like

            @member ejs.MoreLikeThisFieldQuery
            @param {String} s A text string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      likeText: function (txt) {
        if (txt == null) {
          return query.mlt_field[field].like_text;
        }

        query.mlt_field[field].like_text = txt;
        return this;
      },

      /**
            The percentage of terms to match on (float value). 
            Defaults to 0.3 (30 percent).

            @member ejs.MoreLikeThisFieldQuery
            @param {Double} percent A double value between 0 and 1.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      percentTermsToMatch: function (percent) {
        if (percent == null) {
          return query.mlt_field[field].percent_terms_to_match;
        }

        query.mlt_field[field].percent_terms_to_match = percent;
        return this;
      },

      /**
            The frequency below which terms will be ignored in the source doc. 
            The default frequency is 2.

            @member ejs.MoreLikeThisFieldQuery
            @param {Integer} freq A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minTermFreq: function (freq) {
        if (freq == null) {
          return query.mlt_field[field].min_term_freq;
        }

        query.mlt_field[field].min_term_freq = freq;
        return this;
      },
      
      /**
            The maximum number of query terms that will be included in any 
            generated query. Defaults to 25.

            @member ejs.MoreLikeThisFieldQuery
            @param {Integer} max A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxQueryTerms: function (max) {
        if (max == null) {
          return query.mlt_field[field].max_query_terms;
        }

        query.mlt_field[field].max_query_terms = max;
        return this;
      },

      /**
            An array of stop words. Any word in this set is considered 
            “uninteresting” and ignored. Even if your Analyzer allows stopwords, 
            you might want to tell the MoreLikeThis code to ignore them, as for 
            the purposes of document similarity it seems reasonable to assume 
            that “a stop word is never interesting”.
        
            @member ejs.MoreLikeThisFieldQuery
            @param {Array} stopWords An array of string stopwords
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      stopWords: function (stopWords) {
        if (stopWords == null) {
          return query.mlt_field[field].stop_words;
        }

        query.mlt_field[field].stop_words = stopWords;
        return this;
      },

      /**
            The frequency at which words will be ignored which do not occur in 
            at least this many docs. Defaults to 5.

            @member ejs.MoreLikeThisFieldQuery
            @param {Integer} min A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minDocFreq: function (min) {
        if (min == null) {
          return query.mlt_field[field].min_doc_freq;
        }

        query.mlt_field[field].min_doc_freq = min;
        return this;
      },

      /**
            The maximum frequency in which words may still appear. Words that 
            appear in more than this many docs will be ignored. 
            Defaults to unbounded.

            @member ejs.MoreLikeThisFieldQuery
            @param {Integer} max A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxDocFreq: function (max) {
        if (max == null) {
          return query.mlt_field[field].max_doc_freq;
        }

        query.mlt_field[field].max_doc_freq = max;
        return this;
      },

      /**
            The minimum word length below which words will be ignored. 
            Defaults to 0.
        
            @member ejs.MoreLikeThisFieldQuery
            @param {Integer} len A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minWordLen: function (len) {
        if (len == null) {
          return query.mlt_field[field].min_word_len;
        }

        query.mlt_field[field].min_word_len = len;
        return this;
      },

      /**
            The maximum word length above which words will be ignored. 
            Defaults to unbounded (0).
        
            @member ejs.MoreLikeThisFieldQuery
            @param {Integer} len A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxWordLen: function (len) {
        if (len == null) {
          return query.mlt_field[field].max_word_len;
        }

        query.mlt_field[field].max_word_len = len;
        return this;
      },
          
      /**
            The analyzer that will be used to analyze the text. Defaults to the 
            analyzer associated with the field.

            @member ejs.MoreLikeThisFieldQuery
            @param {String} analyzerName The name of the analyzer.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      analyzer: function (analyzerName) {
        if (analyzerName == null) {
          return query.mlt_field[field].analyzer;
        }

        query.mlt_field[field].analyzer = analyzerName;
        return this;
      },
  
      /**
            Sets the boost factor to use when boosting terms. 
            Defaults to 1.

            @member ejs.MoreLikeThisFieldQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boostTerms: function (boost) {
        if (boost == null) {
          return query.mlt_field[field].boost_terms;
        }

        query.mlt_field[field].boost_terms = boost;
        return this;
      },
                    
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.MoreLikeThisFieldQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.mlt_field[field].boost;
        }

        query.mlt_field[field].boost = boost;
        return this;
      },

      /**
             Serializes the internal <em>query</em> object as a JSON string.
             @member ejs.MoreLikeThisFieldQuery
             @returns {String} Returns a JSON representation of the Query object.
             */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.MoreLikeThisFieldQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            This method is used to retrieve the raw query object. It's designed
            for internal use when composing and serializing queries.
            @member ejs.MoreLikeThisFieldQuery
            @returns {Object} Returns the object's <em>query</em> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>More like this query find documents that are “like” provided text by 
    running it against one or more fields.</p>

    @name ejs.MoreLikeThisQuery

    @desc
    <p>Constructs a query where each documents returned are “like” provided text</p>

    @param {String || Array} fields A single field or array of fields to run against.
    @param {String} likeText The text to find documents like it.
  
     */
  ejs.MoreLikeThisQuery = function (fields, likeText) {

    /**
         The internal Query object. Use <code>get()</code>.
         @member ejs.MoreLikeThisQuery
         @property {Object} query
         */
    var query = {
      mlt: {
        like_text: likeText,
        fields: []
      }
    };

    if (isString(fields)) {
      query.mlt.fields.push(fields);
    } else if (isArray(fields)) {
      query.mlt.fields = fields;
    } else {
      throw new TypeError('Argument must be string or array');
    }
    
    return {
  
      /**
             The fields to run the query against.  If you call with a single field,
             it is added to the existing list of fields.  If called with an array
             of field names, it replaces any existing values with the new array.

             @member ejs.MoreLikeThisQuery
             @param {String || Array} f A single field name or a list of field names.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      fields: function (f) {
        if (f == null) {
          return query.mlt.fields;
        }
    
        if (isString(f)) {
          query.mlt.fields.push(f);
        } else if (isArray(f)) {
          query.mlt.fields = f;
        } else {
          throw new TypeError('Argument must be a string or array');
        }
    
        return this;
      },
  
      /**
            The text to find documents like

            @member ejs.MoreLikeThisQuery
            @param {String} s A text string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      likeText: function (txt) {
        if (txt == null) {
          return query.mlt.like_text;
        }
  
        query.mlt.like_text = txt;
        return this;
      },

      /**
            The percentage of terms to match on (float value). 
            Defaults to 0.3 (30 percent).

            @member ejs.MoreLikeThisQuery
            @param {Double} percent A double value between 0 and 1.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      percentTermsToMatch: function (percent) {
        if (percent == null) {
          return query.mlt.percent_terms_to_match;
        }
  
        query.mlt.percent_terms_to_match = percent;
        return this;
      },

      /**
            The frequency below which terms will be ignored in the source doc. 
            The default frequency is 2.

            @member ejs.MoreLikeThisQuery
            @param {Integer} freq A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minTermFreq: function (freq) {
        if (freq == null) {
          return query.mlt.min_term_freq;
        }
  
        query.mlt.min_term_freq = freq;
        return this;
      },
        
      /**
            The maximum number of query terms that will be included in any 
            generated query. Defaults to 25.

            @member ejs.MoreLikeThisQuery
            @param {Integer} max A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxQueryTerms: function (max) {
        if (max == null) {
          return query.mlt.max_query_terms;
        }
  
        query.mlt.max_query_terms = max;
        return this;
      },

      /**
            An array of stop words. Any word in this set is considered 
            “uninteresting” and ignored. Even if your Analyzer allows stopwords, 
            you might want to tell the MoreLikeThis code to ignore them, as for 
            the purposes of document similarity it seems reasonable to assume 
            that “a stop word is never interesting”.
          
            @member ejs.MoreLikeThisQuery
            @param {Array} stopWords An array of string stopwords
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      stopWords: function (stopWords) {
        if (stopWords == null) {
          return query.mlt.stop_words;
        }
  
        query.mlt.stop_words = stopWords;
        return this;
      },

      /**
            The frequency at which words will be ignored which do not occur in 
            at least this many docs. Defaults to 5.

            @member ejs.MoreLikeThisQuery
            @param {Integer} min A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minDocFreq: function (min) {
        if (min == null) {
          return query.mlt.min_doc_freq;
        }
  
        query.mlt.min_doc_freq = min;
        return this;
      },

      /**
            The maximum frequency in which words may still appear. Words that 
            appear in more than this many docs will be ignored. 
            Defaults to unbounded.

            @member ejs.MoreLikeThisQuery
            @param {Integer} max A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxDocFreq: function (max) {
        if (max == null) {
          return query.mlt.max_doc_freq;
        }
  
        query.mlt.max_doc_freq = max;
        return this;
      },

      /**
            The minimum word length below which words will be ignored. 
            Defaults to 0.
          
            @member ejs.MoreLikeThisQuery
            @param {Integer} len A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minWordLen: function (len) {
        if (len == null) {
          return query.mlt.min_word_len;
        }
  
        query.mlt.min_word_len = len;
        return this;
      },

      /**
            The maximum word length above which words will be ignored. 
            Defaults to unbounded (0).
          
            @member ejs.MoreLikeThisQuery
            @param {Integer} len A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxWordLen: function (len) {
        if (len == null) {
          return query.mlt.max_word_len;
        }
  
        query.mlt.max_word_len = len;
        return this;
      },
            
      /**
            The analyzer that will be used to analyze the text. Defaults to the 
            analyzer associated with the field.

            @member ejs.MoreLikeThisQuery
            @param {String} analyzerName The name of the analyzer.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      analyzer: function (analyzerName) {
        if (analyzerName == null) {
          return query.mlt.analyzer;
        }
  
        query.mlt.analyzer = analyzerName;
        return this;
      },
    
      /**
            Sets the boost factor to use when boosting terms. 
            Defaults to 1.

            @member ejs.MoreLikeThisQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boostTerms: function (boost) {
        if (boost == null) {
          return query.mlt.boost_terms;
        }

        query.mlt.boost_terms = boost;
        return this;
      },
                      
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.MoreLikeThisQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.mlt.boost;
        }

        query.mlt.boost = boost;
        return this;
      },

      /**
             Serializes the internal <em>query</em> object as a JSON string.
             @member ejs.MoreLikeThisQuery
             @returns {String} Returns a JSON representation of the Query object.
             */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.MoreLikeThisQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            This method is used to retrieve the raw query object. It's designed
            for internal use when composing and serializing queries.
            @member ejs.MoreLikeThisQuery
            @returns {Object} Returns the object's <em>query</em> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    A <code>MultiMatchQuery</code> query builds further on top of the 
    <code>MatchQuery</code> by allowing multiple fields to be specified. 
    The idea here is to allow to more easily build a concise match type query 
    over multiple fields instead of using a relatively more expressive query 
    by using multiple match queries within a bool query.
  
    @name ejs.MultiMatchQuery

    @desc
    A Query that allow to more easily build a MatchQuery 
    over multiple fields

    @param {String || Array} fields the single field or array of fields to search across
    @param {String} qstr the query string
    */
  ejs.MultiMatchQuery = function (fields, qstr) {

    /**
         The internal query object. <code>Use get()</code>
         @member ejs.MultiMatchQuery
         @property {Object} query
         */
    var query = {
      multi_match: {
        query: qstr,
        fields: []
      }
    };

    if (isString(fields)) {
      query.multi_match.fields.push(fields);
    } else if (isArray(fields)) {
      query.multi_match.fields = fields;
    } else {
      throw new TypeError('Argument must be string or array');
    }
    
    return {

      /**
            Sets the fields to search across.  If passed a single value it is
            added to the existing list of fields.  If passed an array of 
            values, they overwite all existing values.

            @member ejs.MultiMatchQuery
            @param {String || Array} f A single field or list of fields names to 
              search across.
            @returns {Object} returns <code>this</code> so that calls can be 
              chained. Returns {Array} current value if `f` not specified.
            */
      fields: function (f) {
        if (f == null) {
          return query.multi_match.fields;
        }

        if (isString(f)) {
          query.multi_match.fields.push(f);
        } else if (isArray(f)) {
          query.multi_match.fields = f;
        } else {
          throw new TypeError('Argument must be string or array');
        }
        
        return this;
      },

      /**
            Sets whether or not queries against multiple fields should be combined using Lucene's
            <a href="http://lucene.apache.org/java/3_0_0/api/core/org/apache/lucene/search/DisjunctionMaxQuery.html">
            DisjunctionMaxQuery</a>

            @member ejs.MultiMatchQuery
            @param {String} trueFalse A <code>true/false</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      useDisMax: function (trueFalse) {
        if (trueFalse == null) {
          return query.multi_match.use_dis_max;
        }
      
        query.multi_match.use_dis_max = trueFalse;
        return this;
      },

      /**
            The tie breaker value.  The tie breaker capability allows results
            that include the same term in multiple fields to be judged better than
            results that include this term in only the best of those multiple
            fields, without confusing this with the better case of two different
            terms in the multiple fields.  Default: 0.0.

            @member ejs.MultiMatchQuery
            @param {Double} tieBreaker A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      tieBreaker: function (tieBreaker) {
        if (tieBreaker == null) {
          return query.multi_match.tie_breaker;
        }

        query.multi_match.tie_breaker = tieBreaker;
        return this;
      },

      /**
            Sets the maximum threshold/frequency to be considered a low 
            frequency term in a <code>CommonTermsQuery</code>.  
            Set to a value between 0 and 1.

            @member ejs.MultiMatchQuery
            @param {Number} freq A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      cutoffFrequency: function (freq) {
        if (freq == null) {
          return query.multi_match.cutoff_frequency;
        }

        query.multi_match.cutoff_frequency = freq;
        return this;
      },
      
      /**
            Sets a percent value controlling how many "should" clauses in the
            resulting <code>Query</code> should match.

            @member ejs.MultiMatchQuery
            @param {Integer} minMatch An <code>integer</code> between 0 and 100.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minimumShouldMatch: function (minMatch) {
        if (minMatch == null) {
          return query.multi_match.minimum_should_match;
        }

        query.multi_match.minimum_should_match = minMatch;
        return this;
      },
      
      /**
            Sets rewrite method.  Valid values are: 
            
            constant_score_auto - tries to pick the best constant-score rewrite 
              method based on term and document counts from the query
              
            scoring_boolean - translates each term into boolean should and 
              keeps the scores as computed by the query
              
            constant_score_boolean - same as scoring_boolean, expect no scores
              are computed.
              
            constant_score_filter - first creates a private Filter, by visiting 
              each term in sequence and marking all docs for that term
              
            top_terms_boost_N - first translates each term into boolean should
              and scores are only computed as the boost using the top N
              scoring terms.  Replace N with an integer value.
              
            top_terms_N -   first translates each term into boolean should
                and keeps the scores as computed by the query. Only the top N
                scoring terms are used.  Replace N with an integer value.
            
            Default is constant_score_auto.

            This is an advanced option, use with care.

            @member ejs.MultiMatchQuery
            @param {String} m The rewrite method as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      rewrite: function (m) {
        if (m == null) {
          return query.multi_match.rewrite;
        }
        
        m = m.toLowerCase();
        if (m === 'constant_score_auto' || m === 'scoring_boolean' ||
          m === 'constant_score_boolean' || m === 'constant_score_filter' ||
          m.indexOf('top_terms_boost_') === 0 || 
          m.indexOf('top_terms_') === 0) {
            
          query.multi_match.rewrite = m;
        }
        
        return this;
      },
      
      /**
            Sets fuzzy rewrite method.  Valid values are: 
            
            constant_score_auto - tries to pick the best constant-score rewrite 
              method based on term and document counts from the query
              
            scoring_boolean - translates each term into boolean should and 
              keeps the scores as computed by the query
              
            constant_score_boolean - same as scoring_boolean, expect no scores
              are computed.
              
            constant_score_filter - first creates a private Filter, by visiting 
              each term in sequence and marking all docs for that term
              
            top_terms_boost_N - first translates each term into boolean should
              and scores are only computed as the boost using the top N
              scoring terms.  Replace N with an integer value.
              
            top_terms_N -   first translates each term into boolean should
                and keeps the scores as computed by the query. Only the top N
                scoring terms are used.  Replace N with an integer value.
            
            Default is constant_score_auto.

            This is an advanced option, use with care.
            
            @member ejs.MultiMatchQuery
            @param {String} m The rewrite method as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fuzzyRewrite: function (m) {
        if (m == null) {
          return query.multi_match.fuzzy_rewrite;
        }

        m = m.toLowerCase();
        if (m === 'constant_score_auto' || m === 'scoring_boolean' ||
          m === 'constant_score_boolean' || m === 'constant_score_filter' ||
          m.indexOf('top_terms_boost_') === 0 || 
          m.indexOf('top_terms_') === 0) {
            
          query.multi_match.fuzzy_rewrite = m;
        }
        
        return this;
      },

      /**
            Enables lenient parsing of the query string.

            @member ejs.MultiMatchQuery
            @param {Boolean} trueFalse A boolean value
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lenient: function (trueFalse) {
        if (trueFalse == null) {
          return query.multi_match.lenient;
        }

        query.multi_match.lenient = trueFalse;
        return this;
      },
                 
      /**
            Sets the boost value for documents matching the <code>Query</code>.

            @member ejs.MultiMatchQuery
            @param {Number} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.multi_match.boost;
        }

        query.multi_match.boost = boost;
        return this;
      },

      /**
            Sets the query string for the <code>Query</code>.

            @member ejs.MultiMatchQuery
            @param {String} qstr The query string to search for.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (qstr) {
        if (qstr == null) {
          return query.multi_match.query;
        }

        query.multi_match.query = qstr;
        return this;
      },

      /**
            Sets the type of the <code>MultiMatchQuery</code>.  Valid values are
            boolean, phrase, and phrase_prefix or phrasePrefix.

            @member ejs.MultiMatchQuery
            @param {String} type Any of boolean, phrase, phrase_prefix or phrasePrefix.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      type: function (type) {
        if (type == null) {
          return query.multi_match.type;
        }

        type = type.toLowerCase();
        if (type === 'boolean' || type === 'phrase' || type === 'phrase_prefix') {
          query.multi_match.type = type;
        }

        return this;
      },

      /**
            Sets the fuzziness value for the <code>Query</code>.

            @member ejs.MultiMatchQuery
            @param {Double} fuzz A <code>double</code> value between 0.0 and 1.0.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fuzziness: function (fuzz) {
        if (fuzz == null) {
          return query.multi_match.fuzziness;
        }

        query.multi_match.fuzziness = fuzz;
        return this;
      },

      /**
            Sets the prefix length for a fuzzy prefix <code>Query</code>.

            @member ejs.MultiMatchQuery
            @param {Integer} l A positive <code>integer</code> length value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      prefixLength: function (l) {
        if (l == null) {
          return query.multi_match.prefix_length;
        }

        query.multi_match.prefix_length = l;
        return this;
      },

      /**
            Sets the max expansions of a fuzzy <code>Query</code>.

            @member ejs.MultiMatchQuery
            @param {Integer} e A positive <code>integer</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxExpansions: function (e) {
        if (e == null) {
          return query.multi_match.max_expansions;
        }

        query.multi_match.max_expansions = e;
        return this;
      },

      /**
            Sets default operator of the <code>Query</code>.  Default: or.

            @member ejs.MultiMatchQuery
            @param {String} op Any of "and" or "or", no quote characters.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      operator: function (op) {
        if (op == null) {
          return query.multi_match.operator;
        }

        op = op.toLowerCase();
        if (op === 'and' || op === 'or') {
          query.multi_match.operator = op;
        }

        return this;
      },

      /**
            Sets the default slop for phrases. If zero, then exact phrase matches
            are required.  Default: 0.

            @member ejs.MultiMatchQuery
            @param {Integer} slop A positive <code>integer</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      slop: function (slop) {
        if (slop == null) {
          return query.multi_match.slop;
        }

        query.multi_match.slop = slop;
        return this;
      },

      /**
            Sets the analyzer name used to analyze the <code>Query</code> object.

            @member ejs.MultiMatchQuery
            @param {String} analyzer A valid analyzer name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      analyzer: function (analyzer) {
        if (analyzer == null) {
          return query.multi_match.analyzer;
        }

        query.multi_match.analyzer = analyzer;
        return this;
      },

      /**
            Sets what happens when no terms match.  Valid values are
            "all" or "none".  

            @member ejs.MultiMatchQuery
            @param {String} q A no match action, "all" or "none".
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      zeroTermsQuery: function (q) {
        if (q == null) {
          return query.multi_match.zero_terms_query;
        }

        q = q.toLowerCase();
        if (q === 'all' || q === 'none') {
          query.multi_match.zero_terms_query = q;
        }
        
        return this;
      },
      
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.MultiMatchQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.MultiMatchQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>Query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.MultiMatchQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>Nested queries allow you to search against content within objects that are
       embedded inside of other objects. It is similar to <code>XPath</code> expressions
       in <code>XML</code> both conceptually and syntactically.</p>

    <p>The query is executed against the nested objects / docs as if they were 
    indexed as separate docs and resulting in the rootparent doc (or parent 
    nested mapping).</p>
    
    @name ejs.NestedQuery

    @desc
    <p>Constructs a query that is capable of executing a search against objects
       nested within a document.</p>

    @param {String} path The nested object path.

     */
  ejs.NestedQuery = function (path) {

    /**
         The internal Query object. Use <code>_self()</code>.
         
         @member ejs.NestedQuery
         @property {Object} query
         */
    var query = {
      nested: {
        path: path
      }
    };

    return {
      
      /**
             Sets the root context for the nested query.
             
             @member ejs.NestedQuery
             @param {String} path The path defining the root context for the nested query.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      path: function (path) {
        if (path == null) {
          return query.nested.path;
        }
      
        query.nested.path = path;
        return this;
      },

      /**
             Sets the nested query to be executed.
             
             @member ejs.NestedQuery
             @param {Object} oQuery A valid Query object
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      query: function (oQuery) {
        if (oQuery == null) {
          return query.nested.query;
        }
    
        if (!isQuery(oQuery)) {
          throw new TypeError('Argument must be a Query');
        }
        
        query.nested.query = oQuery._self();
        return this;
      },


      /**
             Sets the nested filter to be executed.
             
             @member ejs.NestedQuery
             @param {Object} oFilter A valid Filter object
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      filter: function (oFilter) {
        if (oFilter == null) {
          return query.nested.filter;
        }
    
        if (!isFilter(oFilter)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        query.nested.filter = oFilter._self();
        return this;
      },

      /**
             Sets how the inner (nested) matches affect scoring on the parent document.
             
             @member ejs.NestedQuery
             @param {String} mode The mode of scoring to be used for nested matches.
                             Options are avg, total, max, none - defaults to avg
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      scoreMode: function (mode) {
        if (mode == null) {
          return query.nested.score_mode;
        }
      
        mode = mode.toLowerCase();
        if (mode === 'avg' || mode === 'total' || mode === 'max' || 
          mode === 'none') {
            
          query.nested.score_mode = mode;
        }
        
        return this;
      },

      /**
            Sets the scope of the query.  A scope allows to run facets on the 
            same scope name that will work against the nested documents. 

            @deprecated since elasticsearch 0.90
            @member ejs.NestedQuery
            @param {String} s The scope name as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (s) {
        return this;
      },
      
      /**
            Sets the boost value of the nested <code>Query</code>.

            @member ejs.NestedQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.nested.boost;
        }

        query.nested.boost = boost;
        return this;
      },
      
      /**
             Serializes the internal <em>query</em> object as a JSON string.
             
             @member ejs.NestedQuery
             @returns {String} Returns a JSON representation of the termFilter object.
             */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.NestedQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            This method is used to retrieve the raw query object. It's designed
            for internal use when composing and serializing queries.
            
            @member ejs.NestedQuery
            @returns {Object} Returns the object's <em>query</em> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>Matches documents that have fields containing terms with a specified 
    prefix (not analyzed). The prefix query maps to Lucene PrefixQuery.</p>

    @name ejs.PrefixQuery

    @desc
    Matches documents containing the specified un-analyzed prefix.

    @param {String} field A valid field name.
    @param {String} value A string prefix.
    */
  ejs.PrefixQuery = function (field, value) {

    /**
         The internal query object. <code>Use get()</code>
         @member ejs.PrefixQuery
         @property {Object} query
         */
    var query = {
      prefix: {}
    };

    query.prefix[field] = {
      value: value
    };
  
    return {

      /**
             The field to run the query against.

             @member ejs.PrefixQuery
             @param {String} f A single field name.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      field: function (f) {
        var oldValue = query.prefix[field];
  
        if (f == null) {
          return field;
        }

        delete query.prefix[field];
        field = f;
        query.prefix[f] = oldValue;

        return this;
      },

      /**
            The prefix value.

            @member ejs.PrefixQuery
            @param {String} p A string prefix
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      value: function (p) {
        if (p == null) {
          return query.prefix[field].value;
        }

        query.prefix[field].value = p;
        return this;
      },

      /**
            Sets rewrite method.  Valid values are: 
            
            constant_score_auto - tries to pick the best constant-score rewrite 
              method based on term and document counts from the query
              
            scoring_boolean - translates each term into boolean should and 
              keeps the scores as computed by the query
              
            constant_score_boolean - same as scoring_boolean, expect no scores
              are computed.
              
            constant_score_filter - first creates a private Filter, by visiting 
              each term in sequence and marking all docs for that term
              
            top_terms_boost_N - first translates each term into boolean should
              and scores are only computed as the boost using the top N
              scoring terms.  Replace N with an integer value.
              
            top_terms_N -   first translates each term into boolean should
                and keeps the scores as computed by the query. Only the top N
                scoring terms are used.  Replace N with an integer value.
            
            Default is constant_score_auto.

            This is an advanced option, use with care.

            @member ejs.PrefixQuery
            @param {String} m The rewrite method as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      rewrite: function (m) {
        if (m == null) {
          return query.prefix[field].rewrite;
        }
        
        m = m.toLowerCase();
        if (m === 'constant_score_auto' || m === 'scoring_boolean' ||
          m === 'constant_score_boolean' || m === 'constant_score_filter' ||
          m.indexOf('top_terms_boost_') === 0 || 
          m.indexOf('top_terms_') === 0) {
            
          query.prefix[field].rewrite = m;
        }
        
        return this;
      },
      
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.PrefixQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.prefix[field].boost;
        }

        query.prefix[field].boost = boost;
        return this;
      },
      
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.PrefixQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.PrefixQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.PrefixQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>A query that is parsed using Lucene's default query parser. Although Lucene provides the
    ability to create your own queries through its API, it also provides a rich query language
    through the Query Parser, a lexer which interprets a string into a Lucene Query.</p>

    </p>See the Lucene <a href="http://lucene.apache.org/java/2_9_1/queryparsersyntax.html">Query Parser Syntax</a>
    for more information.</p>

    @name ejs.QueryStringQuery

    @desc
    A query that is parsed using Lucene's default query parser.

    @param {String} qstr A valid Lucene query string.
    */
  ejs.QueryStringQuery = function (qstr) {

    /**
         The internal Query object. Use <code>get()</code>.
         @member ejs.QueryStringQuery
         @property {Object} query
         */
    var query = {
      query_string: {}
    };

    query.query_string.query = qstr;

    return {

      /**
            Sets the query string on this <code>Query</code> object.

            @member ejs.QueryStringQuery
            @param {String} qstr A valid Lucene query string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (qstr) {
        if (qstr == null) {
          return query.query_string.query;
        }

        query.query_string.query = qstr;
        return this;
      },

      /**
            Sets the default field/property this query should execute against.

            @member ejs.QueryStringQuery
            @param {String} fieldName The name of document field/property.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      defaultField: function (fieldName) {
        if (fieldName == null) {
          return query.query_string.default_field;
        }
      
        query.query_string.default_field = fieldName;
        return this;
      },

      /**
            A set of fields/properties this query should execute against.  
            Pass a single value to add to the existing list of fields and 
            pass an array to overwrite all existing fields.  For each field, 
            you can apply a field specific boost by appending a ^boost to the 
            field name.  For example, title^10, to give the title field a
            boost of 10.

            @member ejs.QueryStringQuery
            @param {Array} fieldNames A list of document fields/properties.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fields: function (fieldNames) {
        if (query.query_string.fields == null) {
          query.query_string.fields = [];
        }
        
        if (fieldNames == null) {
          return query.query_string.fields;
        }
      
        if (isString(fieldNames)) {
          query.query_string.fields.push(fieldNames);
        } else if (isArray(fieldNames)) {
          query.query_string.fields = fieldNames;
        } else {
          throw new TypeError('Argument must be a string or array');
        }
        
        return this;
      },

      /**
            Sets whether or not queries against multiple fields should be combined using Lucene's
            <a href="http://lucene.apache.org/java/3_0_0/api/core/org/apache/lucene/search/DisjunctionMaxQuery.html">
            DisjunctionMaxQuery</a>

            @member ejs.QueryStringQuery
            @param {String} trueFalse A <code>true/false</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      useDisMax: function (trueFalse) {
        if (trueFalse == null) {
          return query.query_string.use_dis_max;
        }
      
        query.query_string.use_dis_max = trueFalse;
        return this;
      },

      /**
            Set the default <em>Boolean</em> operator. This operator is used to join individual query
            terms when no operator is explicity used in the query string (i.e., <code>this AND that</code>).
            Defaults to <code>OR</code> (<em>same as Google</em>).

            @member ejs.QueryStringQuery
            @param {String} op The operator to use, AND or OR.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      defaultOperator: function (op) {
        if (op == null) {
          return query.query_string.default_operator;
        }
      
        op = op.toUpperCase();
        if (op === 'AND' || op === 'OR') {
          query.query_string.default_operator = op;
        }
        
        return this;
      },

      /**
            Sets the analyzer name used to analyze the <code>Query</code> object.

            @member ejs.QueryStringQuery
            @param {String} analyzer A valid analyzer name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      analyzer: function (analyzer) {
        if (analyzer == null) {
          return query.query_string.analyzer;
        }

        query.query_string.analyzer = analyzer;
        return this;
      },

      /**
            Sets the quote analyzer name used to analyze the <code>query</code>
            when in quoted text.

            @member ejs.QueryStringQuery
            @param {String} analyzer A valid analyzer name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      quoteAnalyzer: function (analyzer) {
        if (analyzer == null) {
          return query.query_string.quote_analyzer;
        }

        query.query_string.quote_analyzer = analyzer;
        return this;
      },
      
      /**
            Sets whether or not wildcard characters (* and ?) are allowed as the
            first character of the <code>Query</code>.  Default: true.

            @member ejs.QueryStringQuery
            @param {Boolean} trueFalse A <code>true/false</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      allowLeadingWildcard: function (trueFalse) {
        if (trueFalse == null) {
          return query.query_string.allow_leading_wildcard;
        }

        query.query_string.allow_leading_wildcard = trueFalse;
        return this;
      },

      /**
            Sets whether or not terms from wildcard, prefix, fuzzy, and
            range queries should automatically be lowercased in the <code>Query</code>
            since they are not analyzed.  Default: true.

            @member ejs.QueryStringQuery
            @param {Boolean} trueFalse A <code>true/false</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lowercaseExpandedTerms: function (trueFalse) {
        if (trueFalse == null) {
          return query.query_string.lowercase_expanded_terms;
        }

        query.query_string.lowercase_expanded_terms = trueFalse;
        return this;
      },

      /**
            Sets whether or not position increments will be used in the
            <code>Query</code>. Default: true.

            @member ejs.QueryStringQuery
            @param {Boolean} trueFalse A <code>true/false</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      enablePositionIncrements: function (trueFalse) {
        if (trueFalse == null) {
          return query.query_string.enable_position_increments;
        }

        query.query_string.enable_position_increments = trueFalse;
        return this;
      },


      /**
            Sets the prefix length for fuzzy queries.  Default: 0.

            @member ejs.QueryStringQuery
            @param {Integer} fuzzLen A positive <code>integer</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fuzzyPrefixLength: function (fuzzLen) {
        if (fuzzLen == null) {
          return query.query_string.fuzzy_prefix_length;
        }

        query.query_string.fuzzy_prefix_length = fuzzLen;
        return this;
      },

      /**
            Set the minimum similarity for fuzzy queries.  Default: 0.5.

            @member ejs.QueryStringQuery
            @param {Double} minSim A <code>double</code> value between 0 and 1.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fuzzyMinSim: function (minSim) {
        if (minSim == null) {
          return query.query_string.fuzzy_min_sim;
        }

        query.query_string.fuzzy_min_sim = minSim;
        return this;
      },

      /**
            Sets the default slop for phrases. If zero, then exact phrase matches
            are required.  Default: 0.

            @member ejs.QueryStringQuery
            @param {Integer} slop A positive <code>integer</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      phraseSlop: function (slop) {
        if (slop == null) {
          return query.query_string.phrase_slop;
        }

        query.query_string.phrase_slop = slop;
        return this;
      },

      /**
            Sets the boost value of the <code>Query</code>.  Default: 1.0.

            @member ejs.QueryStringQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.query_string.boost;
        }

        query.query_string.boost = boost;
        return this;
      },

      /**
            Sets whether or not we should attempt to analyzed wilcard terms in the
            <code>Query</code>. By default, wildcard terms are not analyzed.
            Analysis of wildcard characters is not perfect.  Default: false.

            @member ejs.QueryStringQuery
            @param {Boolean} trueFalse A <code>true/false</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      analyzeWildcard: function (trueFalse) {
        if (trueFalse == null) {
          return query.query_string.analyze_wildcard;
        }

        query.query_string.analyze_wildcard = trueFalse;
        return this;
      },

      /**
            Sets whether or not we should auto generate phrase queries *if* the
            analyzer returns more than one term. Default: false.

            @member ejs.QueryStringQuery
            @param {Boolean} trueFalse A <code>true/false</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      autoGeneratePhraseQueries: function (trueFalse) {
        if (trueFalse == null) {
          return query.query_string.auto_generate_phrase_queries;
        }

        query.query_string.auto_generate_phrase_queries = trueFalse;
        return this;
      },

      /**
            Sets a percent value controlling how many "should" clauses in the
            resulting <code>Query</code> should match.

            @member ejs.QueryStringQuery
            @param {Integer} minMatch An <code>integer</code> between 0 and 100.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minimumShouldMatch: function (minMatch) {
        if (minMatch == null) {
          return query.query_string.minimum_should_match;
        }

        query.query_string.minimum_should_match = minMatch;
        return this;
      },

      /**
            Sets the tie breaker value for a <code>Query</code> using
            <code>DisMax</code>.  The tie breaker capability allows results
            that include the same term in multiple fields to be judged better than
            results that include this term in only the best of those multiple
            fields, without confusing this with the better case of two different
            terms in the multiple fields.  Default: 0.0.

            @member ejs.QueryStringQuery
            @param {Double} tieBreaker A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      tieBreaker: function (tieBreaker) {
        if (tieBreaker == null) {
          return query.query_string.tie_breaker;
        }

        query.query_string.tie_breaker = tieBreaker;
        return this;
      },

      /**
            If they query string should be escaped or not.

            @member ejs.QueryStringQuery
            @param {Boolean} trueFalse A <code>true/false</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      escape: function (trueFalse) {
        if (trueFalse == null) {
          return query.query_string.escape;
        }

        query.query_string.escape = trueFalse;
        return this;
      },

      /**
            Sets the max number of term expansions for fuzzy queries.  

            @member ejs.QueryStringQuery
            @param {Integer} max A positive <code>integer</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fuzzyMaxExpansions: function (max) {
        if (max == null) {
          return query.query_string.fuzzy_max_expansions;
        }

        query.query_string.fuzzy_max_expansions = max;
        return this;
      },

      /**
            Sets fuzzy rewrite method.  Valid values are: 
            
            constant_score_auto - tries to pick the best constant-score rewrite 
              method based on term and document counts from the query
              
            scoring_boolean - translates each term into boolean should and 
              keeps the scores as computed by the query
              
            constant_score_boolean - same as scoring_boolean, expect no scores
              are computed.
              
            constant_score_filter - first creates a private Filter, by visiting 
              each term in sequence and marking all docs for that term
              
            top_terms_boost_N - first translates each term into boolean should
              and scores are only computed as the boost using the top N
              scoring terms.  Replace N with an integer value.
              
            top_terms_N -   first translates each term into boolean should
                and keeps the scores as computed by the query. Only the top N
                scoring terms are used.  Replace N with an integer value.
            
            Default is constant_score_auto.

            This is an advanced option, use with care.
            
            @member ejs.QueryStringQuery
            @param {String} m The rewrite method as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fuzzyRewrite: function (m) {
        if (m == null) {
          return query.query_string.fuzzy_rewrite;
        }

        m = m.toLowerCase();
        if (m === 'constant_score_auto' || m === 'scoring_boolean' ||
          m === 'constant_score_boolean' || m === 'constant_score_filter' ||
          m.indexOf('top_terms_boost_') === 0 || 
          m.indexOf('top_terms_') === 0) {
            
          query.query_string.fuzzy_rewrite = m;
        }
        
        return this;
      },

      /**
            Sets rewrite method.  Valid values are: 
            
            constant_score_auto - tries to pick the best constant-score rewrite 
              method based on term and document counts from the query
              
            scoring_boolean - translates each term into boolean should and 
              keeps the scores as computed by the query
              
            constant_score_boolean - same as scoring_boolean, expect no scores
              are computed.
              
            constant_score_filter - first creates a private Filter, by visiting 
              each term in sequence and marking all docs for that term
              
            top_terms_boost_N - first translates each term into boolean should
              and scores are only computed as the boost using the top N
              scoring terms.  Replace N with an integer value.
              
            top_terms_N -   first translates each term into boolean should
                and keeps the scores as computed by the query. Only the top N
                scoring terms are used.  Replace N with an integer value.
            
            Default is constant_score_auto.

            This is an advanced option, use with care.

            @member ejs.QueryStringQuery
            @param {String} m The rewrite method as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      rewrite: function (m) {
        if (m == null) {
          return query.query_string.rewrite;
        }
        
        m = m.toLowerCase();
        if (m === 'constant_score_auto' || m === 'scoring_boolean' ||
          m === 'constant_score_boolean' || m === 'constant_score_filter' ||
          m.indexOf('top_terms_boost_') === 0 || 
          m.indexOf('top_terms_') === 0) {
            
          query.query_string.rewrite = m;
        }
        
        return this;
      },

      /**
            Sets the suffix to automatically add to the field name when 
            performing a quoted search.

            @member ejs.QueryStringQuery
            @param {String} s The suffix as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      quoteFieldSuffix: function (s) {
        if (s == null) {
          return query.query_string.quote_field_suffix;
        }

        query.query_string.quote_field_suffix = s;
        return this;
      },
      
      /**
            Enables lenient parsing of the query string.

            @member ejs.QueryStringQuery
            @param {Boolean} trueFalse A boolean value
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lenient: function (trueFalse) {
        if (trueFalse == null) {
          return query.query_string.lenient;
        }

        query.query_string.lenient = trueFalse;
        return this;
      },
      
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.QueryStringQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.QueryStringQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.QueryStringQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>Matches documents with fields that have terms within a certain range. 
    The type of the Lucene query depends on the field type, for string fields, 
    the TermRangeQuery, while for number/date fields, the query is a 
    NumericRangeQuery.</p>

    @name ejs.RangeQuery

    @desc
    Matches documents with fields that have terms within a certain range.

    @param {String} field A valid field name.
    */
  ejs.RangeQuery = function (field) {

    /**
         The internal query object. <code>Use get()</code>
         @member ejs.RangeQuery
         @property {Object} query
         */
    var query = {
      range: {}
    };

    query.range[field] = {};

    return {

      /**
             The field to run the query against.

             @member ejs.RangeQuery
             @param {String} f A single field name.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      field: function (f) {
        var oldValue = query.range[field];

        if (f == null) {
          return field;
        }

        delete query.range[field];
        field = f;
        query.range[f] = oldValue;

        return this;
      },

      /**
            The lower bound. Defaults to start from the first.

            @member ejs.RangeQuery
            @param {Variable Type} f the lower bound value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      from: function (f) {
        if (f == null) {
          return query.range[field].from;
        }

        query.range[field].from = f;
        return this;
      },

      /**
            The upper bound. Defaults to unbounded.

            @member ejs.RangeQuery
            @param {Variable Type} t the upper bound value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      to: function (t) {
        if (t == null) {
          return query.range[field].to;
        }

        query.range[field].to = t;
        return this;
      },

      /**
            Should the first from (if set) be inclusive or not. 
            Defaults to true

            @member ejs.RangeQuery
            @param {Boolean} trueFalse true to include, false to exclude 
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      includeLower: function (trueFalse) {
        if (trueFalse == null) {
          return query.range[field].include_lower;
        }

        query.range[field].include_lower = trueFalse;
        return this;
      },

      /**
            Should the last to (if set) be inclusive or not. Defaults to true.

            @member ejs.RangeQuery
            @param {Boolean} trueFalse true to include, false to exclude 
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      includeUpper: function (trueFalse) {
        if (trueFalse == null) {
          return query.range[field].include_upper;
        }

        query.range[field].include_upper = trueFalse;
        return this;
      },

      /**
            Greater than value.  Same as setting from to the value, and 
            include_lower to false,

            @member ejs.RangeQuery
            @param {Variable Type} val the value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      gt: function (val) {
        if (val == null) {
          return query.range[field].gt;
        }

        query.range[field].gt = val;
        return this;
      },

      /**
            Greater than or equal to value.  Same as setting from to the value,
            and include_lower to true.

            @member ejs.RangeQuery
            @param {Variable Type} val the value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      gte: function (val) {
        if (val == null) {
          return query.range[field].gte;
        }

        query.range[field].gte = val;
        return this;
      },

      /**
            Less than value.  Same as setting to to the value, and include_upper 
            to false.

            @member ejs.RangeQuery
            @param {Variable Type} val the value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lt: function (val) {
        if (val == null) {
          return query.range[field].lt;
        }

        query.range[field].lt = val;
        return this;
      },

      /**
            Less than or equal to value.  Same as setting to to the value, 
            and include_upper to true.

            @member ejs.RangeQuery
            @param {Variable Type} val the value, type depends on field type
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lte: function (val) {
        if (val == null) {
          return query.range[field].lte;
        }

        query.range[field].lte = val;
        return this;
      },
                            
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.RangeQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.range[field].boost;
        }

        query.range[field].boost = boost;
        return this;
      },
    
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.RangeQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.RangeQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.RangeQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>Matches documents that have fields matching a regular expression. Based 
    on Lucene 4.0 RegexpQuery which uses automaton to efficiently iterate over 
    index terms.</p>

    @name ejs.RegexpQuery

    @desc
    Matches documents that have fields matching a regular expression.

    @param {String} field A valid field name.
    @param {String} value A regex pattern.
    */
  ejs.RegexpQuery = function (field, value) {

    /**
         The internal query object. <code>Use get()</code>
         @member ejs.RegexpQuery
         @property {Object} query
         */
    var query = {
      regexp: {}
    };

    query.regexp[field] = {
      value: value
    };

    return {

      /**
             The field to run the query against.

             @member ejs.RegexpQuery
             @param {String} f A single field name.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      field: function (f) {
        var oldValue = query.regexp[field];

        if (f == null) {
          return field;
        }

        delete query.regexp[field];
        field = f;
        query.regexp[f] = oldValue;

        return this;
      },

      /**
            The regexp value.

            @member ejs.RegexpQuery
            @param {String} p A string regexp
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      value: function (p) {
        if (p == null) {
          return query.regexp[field].value;
        }

        query.regexp[field].value = p;
        return this;
      },

      /**
            The regex flags to use.  Valid flags are:
          
            INTERSECTION - Support for intersection notation
            COMPLEMENT - Support for complement notation
            EMPTY - Support for the empty language symbol: #
            ANYSTRING - Support for the any string symbol: @
            INTERVAL - Support for numerical interval notation: <n-m>
            NONE - Disable support for all syntax options
            ALL - Enables support for all syntax options
          
            Use multiple flags by separating with a "|" character.  Example:
          
            INTERSECTION|COMPLEMENT|EMPTY

            @member ejs.RegexpQuery
            @param {String} f The flags as a string, separate multiple flags with "|".
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      flags: function (f) {
        if (f == null) {
          return query.regexp[field].flags;
        }

        query.regexp[field].flags = f;
        return this;
      },
    
      /**
            The regex flags to use as a numeric value.  Advanced use only,
            it is probably better to stick with the <code>flags</code> option.
          
            @member ejs.RegexpQuery
            @param {String} v The flags as a numeric value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      flagsValue: function (v) {
        if (v == null) {
          return query.regexp[field].flags_value;
        }

        query.regexp[field].flags_value = v;
        return this;
      },
    
      /**
            Sets rewrite method.  Valid values are: 
          
            constant_score_auto - tries to pick the best constant-score rewrite 
              method based on term and document counts from the query
            
            scoring_boolean - translates each term into boolean should and 
              keeps the scores as computed by the query
            
            constant_score_boolean - same as scoring_boolean, expect no scores
              are computed.
            
            constant_score_filter - first creates a private Filter, by visiting 
              each term in sequence and marking all docs for that term
            
            top_terms_boost_N - first translates each term into boolean should
              and scores are only computed as the boost using the top N
              scoring terms.  Replace N with an integer value.
            
            top_terms_N -   first translates each term into boolean should
                and keeps the scores as computed by the query. Only the top N
                scoring terms are used.  Replace N with an integer value.
          
            Default is constant_score_auto.

            This is an advanced option, use with care.

            @member ejs.RegexpQuery
            @param {String} m The rewrite method as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      rewrite: function (m) {
        if (m == null) {
          return query.regexp[field].rewrite;
        }
      
        m = m.toLowerCase();
        if (m === 'constant_score_auto' || m === 'scoring_boolean' ||
          m === 'constant_score_boolean' || m === 'constant_score_filter' ||
          m.indexOf('top_terms_boost_') === 0 || 
          m.indexOf('top_terms_') === 0) {
          
          query.regexp[field].rewrite = m;
        }
      
        return this;
      },
    
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.RegexpQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.regexp[field].boost;
        }

        query.regexp[field].boost = boost;
        return this;
      },
    
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.RegexpQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
          
            @member ejs.RegexpQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
    
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.RegexpQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>Matches spans near the beginning of a field. The spanFirstQuery allows you to search
    for Spans that start and end within the first <code>n</code> positions of the document.
    The span first query maps to Lucene SpanFirstQuery.</p>

    @name ejs.SpanFirstQuery

    @desc
    Matches spans near the beginning of a field.

    @param {Query} spanQry A valid SpanQuery
    @param {Integer} end the maximum end position in a match.
    
    */
  ejs.SpanFirstQuery = function (spanQry, end) {

    if (!isQuery(spanQry)) {
      throw new TypeError('Argument must be a SpanQuery');
    }
    
    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.SpanFirstQuery
         @property {Object} query
         */
    var query = {
      span_first: {
        match: spanQry._self(),
        end: end
      }
    };

    return {

      /**
            Sets the span query to match on.

            @member ejs.SpanFirstQuery
            @param {Object} spanQuery Any valid span type query.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      match: function (spanQuery) {
        if (spanQuery == null) {
          return query.span_first.match;
        }
      
        if (!isQuery(spanQuery)) {
          throw new TypeError('Argument must be a SpanQuery');
        }
        
        query.span_first.match = spanQuery._self();
        return this;
      },

      /**
            Sets the maximum end position permitted in a match.

            @member ejs.SpanFirstQuery
            @param {Number} position The maximum position length to consider.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      end: function (position) {
        if (position == null) {
          return query.span_first.end;
        }
      
        query.span_first.end = position;
        return this;
      },

      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.SpanFirstQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.span_first.boost;
        }

        query.span_first.boost = boost;
        return this;
      },
      
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.SpanFirstQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.SpanFirstQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.SpanFirstQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>A spanNearQuery will look to find a number of spanQuerys within a given
    distance from each other.</p>

    @name ejs.SpanNearQuery

    @desc
    Matches spans which are near one another.

    @param {Query || Array} clauses A single SpanQuery or array of SpanQueries
    @param {Integer} slop The number of intervening unmatched positions

    */
  ejs.SpanNearQuery = function (clauses, slop) {

    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.SpanNearQuery
         @property {Object} query
         */
    var i, len,
      query = {
        span_near: {
          clauses: [],
          slop: slop
        }
      };
    
    if (isQuery(clauses)) {
      query.span_near.clauses.push(clauses._self());
    } else if (isArray(clauses)) {
      for (i = 0, len = clauses.length; i < len; i++) {
        if (!isQuery(clauses[i])) {
          throw new TypeError('Argument must be array of SpanQueries');
        }
        
        query.span_near.clauses.push(clauses[i]._self());
      }
    } else {
      throw new TypeError('Argument must be SpanQuery or array of SpanQueries');
    }

    return {

      /**
            Sets the clauses used.  If passed a single SpanQuery, it is added
            to the existing list of clauses.  If passed an array of
            SpanQueries, they replace any existing clauses.

            @member ejs.SpanNearQuery
            @param {Query || Array} clauses A SpanQuery or array of SpanQueries.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      clauses: function (clauses) {
        var i, len;
        
        if (clauses == null) {
          return query.span_near.clauses;
        }
      
        if (isQuery(clauses)) {
          query.span_near.clauses.push(clauses._self());
        } else if (isArray(clauses)) {
          query.span_near.clauses = [];
          for (i = 0, len = clauses.length; i < len; i++) {
            if (!isQuery(clauses[i])) {
              throw new TypeError('Argument must be array of SpanQueries');
            }

            query.span_near.clauses.push(clauses[i]._self());
          }
        } else {
          throw new TypeError('Argument must be SpanQuery or array of SpanQueries');
        }
        
        return this;
      },

      /**
            Sets the maximum number of intervening unmatched positions.

            @member ejs.SpanNearQuery
            @param {Number} distance The number of intervening unmatched positions.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      slop: function (distance) {
        if (distance == null) {
          return query.span_near.slop;
        }
      
        query.span_near.slop = distance;
        return this;
      },

      /**
            Sets whether or not matches are required to be in-order.

            @member ejs.SpanNearQuery
            @param {Boolean} trueFalse Determines if matches must be in-order.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      inOrder: function (trueFalse) {
        if (trueFalse == null) {
          return query.span_near.in_order;
        }
      
        query.span_near.in_order = trueFalse;
        return this;
      },

      /**
            Sets whether or not payloads are being used. A payload is an arbitrary
            byte array stored at a specific position (i.e. token/term).

            @member ejs.SpanNearQuery
            @param {Boolean} trueFalse Whether or not to return payloads.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      collectPayloads: function (trueFalse) {
        if (trueFalse == null) {
          return query.span_near.collect_payloads;
        }
      
        query.span_near.collect_payloads = trueFalse;
        return this;
      },

      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.SpanNearQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.span_near.boost;
        }

        query.span_near.boost = boost;
        return this;
      },
      
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.SpanNearQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.SpanNearQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.SpanNearQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>Removes matches which overlap with another span query.
    The span not query maps to Lucene SpanNotQuery.</p>

    @name ejs.SpanNotQuery

    @desc
    Removes matches which overlap with another span query.

    @param {Query} includeQry a valid SpanQuery whose matching docs will be returned.
    @param {Query} excludeQry a valid SpanQuery whose matching docs will not be returned
    
    */
  ejs.SpanNotQuery = function (includeQry, excludeQry) {

    if (!isQuery(includeQry) || !isQuery(excludeQry)) {
      throw new TypeError('Argument must be a SpanQuery');
    }
    
    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.SpanNotQuery
         @property {Object} query
         */
    var query = {
      span_not: {
        include: includeQry._self(),
        exclude: excludeQry._self()
      }
    };

    return {

      /**
            Set the span query whose matches are filtered.

            @member ejs.SpanNotQuery
            @param {Object} spanQuery Any valid span type query.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      include: function (spanQuery) {
        if (spanQuery == null) {
          return query.span_not.include;
        }
      
        if (!isQuery(spanQuery)) {
          throw new TypeError('Argument must be a SpanQuery');
        }
        
        query.span_not.include = spanQuery._self();
        return this;
      },

      /**
            Sets the span query whose matches must not overlap those returned.

            @member ejs.SpanNotQuery
            @param {Object} spanQuery Any valid span type query.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      exclude: function (spanQuery) {
        if (spanQuery == null) {
          return query.span_not.exclude;
        }
      
        if (!isQuery(spanQuery)) {
          throw new TypeError('Argument must be a SpanQuery');
        }
        
        query.span_not.exclude = spanQuery._self();
        return this;
      },

      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.SpanNotQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.span_not.boost;
        }

        query.span_not.boost = boost;
        return this;
      },
      
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.SpanNotQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.SpanNotQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.SpanNotQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>The spanOrQuery takes an array of SpanQuerys and will match if any of the
    underlying SpanQueries match. The span or query maps to Lucene SpanOrQuery.</p>

    @name ejs.SpanOrQuery

    @desc
    Matches the union of its span clauses.

    @param {Object} clauses A single SpanQuery or array of SpanQueries.

    */
  ejs.SpanOrQuery = function (clauses) {

    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.SpanOrQuery
         @property {Object} query
         */
    var i, 
      len,
      query = {
        span_or: {
          clauses: []
        }
      };

    if (isQuery(clauses)) {
      query.span_or.clauses.push(clauses._self());
    } else if (isArray(clauses)) {
      for (i = 0, len = clauses.length; i < len; i++) {
        if (!isQuery(clauses[i])) {
          throw new TypeError('Argument must be array of SpanQueries');
        }
        
        query.span_or.clauses.push(clauses[i]._self());
      }
    } else {
      throw new TypeError('Argument must be SpanQuery or array of SpanQueries');
    }

    return {

      /**
            Sets the clauses used.  If passed a single SpanQuery, it is added
            to the existing list of clauses.  If passed an array of
            SpanQueries, they replace any existing clauses.

            @member ejs.SpanOrQuery
            @param {Query || Array} clauses A SpanQuery or array of SpanQueries.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      clauses: function (clauses) {
        var i, len;
        
        if (clauses == null) {
          return query.span_or.clauses;
        }
      
        if (isQuery(clauses)) {
          query.span_or.clauses.push(clauses._self());
        } else if (isArray(clauses)) {
          query.span_or.clauses = [];
          for (i = 0, len = clauses.length; i < len; i++) {
            if (!isQuery(clauses[i])) {
              throw new TypeError('Argument must be array of SpanQueries');
            }

            query.span_or.clauses.push(clauses[i]._self());
          }
        } else {
          throw new TypeError('Argument must be SpanQuery or array of SpanQueries');
        }
        
        return this;
      },

      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.SpanOrQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.span_or.boost;
        }

        query.span_or.boost = boost;
        return this;
      },
      
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.SpanOrQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.SpanOrQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.SpanOrQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>A spanTermQuery is the basic unit of Lucene's Span Query which allows for nested,
    positional restrictions when matching documents. The spanTermQuery simply matches
    spans containing a term. It's essentially a termQuery with positional information asscoaited.</p>

    @name ejs.SpanTermQuery

    @desc
    Matches spans containing a term

    @param {String} field the document field/field to query against
    @param {String} value the literal value to be matched
    */
  ejs.SpanTermQuery = function (field, value) {

    /**
         The internal query object. <code>Use get()</code>
         @member ejs.SpanTermQuery
         @property {Object} query
         */
    var query = {
      span_term: {}
    };

    query.span_term[field] = {
      term: value
    };

    return {

      /**
            Sets the field to query against.

            @member ejs.SpanTermQuery
            @param {String} f A valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (f) {
        var oldValue = query.span_term[field];
      
        if (f == null) {
          return field;
        }

        delete query.span_term[field];
        field = f;
        query.span_term[f] = oldValue;
      
        return this;
      },
    
      /**
            Sets the term.

            @member ejs.SpanTermQuery
            @param {String} t A single term.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      term: function (t) {
        if (t == null) {
          return query.span_term[field].term;
        }

        query.span_term[field].term = t;
        return this;
      },
      
      /**
            Sets the boost value for documents matching the <code>Query</code>.

            @member ejs.SpanTermQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.span_term[field].boost;
        }

        query.span_term[field].boost = boost;
        return this;
      },

      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.SpanTermQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.SpanTermQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.SpanTermQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>A <code>TermQuery</code> can be used to return documents containing a given
    keyword or <em>term</em>. For instance, you might want to retieve all the
    documents/objects that contain the term <code>Javascript</code>. Term filters
    often serve as the basis for more complex queries such as <em>Boolean</em> queries.</p>

    @name ejs.TermQuery

    @desc
    A Query that matches documents containing a term. This may be
    combined with other terms with a BooleanQuery.

    @param {String} field the document field/key to query against
    @param {String} term the literal value to be matched
    */
  ejs.TermQuery = function (field, term) {

    /**
         The internal query object. <code>Use get()</code>
         @member ejs.TermQuery
         @property {Object} query
         */
    var query = {
      term: {}
    };

    query.term[field] = {
      term: term
    };

    return {

      /**
            Sets the fields to query against.

            @member ejs.TermQuery
            @param {String} f A valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (f) {
        var oldValue = query.term[field];
      
        if (f == null) {
          return field;
        }

        delete query.term[field];
        field = f;
        query.term[f] = oldValue;
      
        return this;
      },
    
      /**
            Sets the term.

            @member ejs.TermQuery
            @param {String} t A single term.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      term: function (t) {
        if (t == null) {
          return query.term[field].term;
        }

        query.term[field].term = t;
        return this;
      },
      
      /**
            Sets the boost value for documents matching the <code>Query</code>.

            @member ejs.TermQuery
            @param {Number} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.term[field].boost;
        }

        query.term[field].boost = boost;
        return this;
      },

      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.TermQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.TermQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.TermQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>A query that match on any (configurable) of the provided terms. This is 
    a simpler syntax query for using a bool query with several term queries 
    in the should clauses.</p>

    @name ejs.TermsQuery

    @desc
    A Query that matches documents containing provided terms. 

    @param {String} field the document field/key to query against
    @param {String || Array} terms a single term or array of "terms" to match
    */
  ejs.TermsQuery = function (field, terms) {

    /**
         The internal query object. <code>Use get()</code>
         @member ejs.TermsQuery
         @property {Object} query
         */
    var query = {
      terms: {}
    };
    
    if (isString(terms)) {
      query.terms[field] = [terms];
    } else if (isArray(terms)) {
      query.terms[field] = terms;
    } else {
      throw new TypeError('Argument must be string or array');
    }
    
    return {

      /**
            Sets the fields to query against.

            @member ejs.TermsQuery
            @param {String} f A valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (f) {
        var oldValue = query.terms[field];
      
        if (f == null) {
          return field;
        }

        delete query.terms[field];
        field = f;
        query.terms[f] = oldValue;
      
        return this;
      },
    
      /**
            Sets the terms.  If you t is a String, it is added to the existing
            list of terms.  If t is an array, the list of terms replaces the
            existing terms.

            @member ejs.TermsQuery
            @param {String || Array} t A single term or an array or terms.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      terms: function (t) {
        if (t == null) {
          return query.terms[field];
        }

        if (isString(t)) {
          query.terms[field].push(t);
        } else if (isArray(t)) {
          query.terms[field] = t;
        } else {
          throw new TypeError('Argument must be string or array');
        }
      
        return this;
      },

      /**
            Sets the minimum number of terms that need to match in a document
            before that document is returned in the results.

            @member ejs.TermsQuery
            @param {Integer} min A positive integer.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minimumShouldMatch: function (min) {
        if (min == null) {
          return query.terms.minimum_should_match;
        }
      
        query.terms.minimum_should_match = min;
        return this;
      },
      
      /**
            Enables or disables similarity coordinate scoring of documents
            matching the <code>Query</code>. Default: false.

            @member ejs.TermsQuery
            @param {String} trueFalse A <code>true/false</code value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      disableCoord: function (trueFalse) {
        if (trueFalse == null) {
          return query.terms.disable_coord;
        }

        query.terms.disable_coord = trueFalse;
        return this;
      },
            
      /**
            Sets the boost value for documents matching the <code>Query</code>.

            @member ejs.TermsQuery
            @param {Number} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.terms.boost;
        }

        query.terms.boost = boost;
        return this;
      },

      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.TermsQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.TermsQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.TermsQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>TThe top_children query runs the child query with an estimated hits size, 
    and out of the hit docs, aggregates it into parent docs. If there aren’t 
    enough parent docs matching the requested from/size search request, then it 
    is run again with a wider (more hits) search.</p>

    <p>The top_children also provide scoring capabilities, with the ability to 
    specify max, sum or avg as the score type.</p>

    @name ejs.TopChildrenQuery

    @desc
    Returns child documents matching the query aggregated into the parent docs.

    @param {Object} qry A valid query object.
    @param {String} type The child type to execute the query on
    */
  ejs.TopChildrenQuery = function (qry, type) {

    if (!isQuery(qry)) {
      throw new TypeError('Argument must be a Query');
    }
    
    /**
         The internal query object. <code>Use _self()</code>
         @member ejs.TopChildrenQuery
         @property {Object} query
         */
    var query = {
      top_children: {
        query: qry._self(),
        type: type
      }
    };

    return {

      /**
            Sets the query

            @member ejs.TopChildrenQuery
            @param {Object} q A valid Query object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (q) {
        if (q == null) {
          return query.top_children.query;
        }
  
        if (!isQuery(q)) {
          throw new TypeError('Argument must be a Query');
        }
        
        query.top_children.query = q._self();
        return this;
      },

      /**
            Sets the child document type to search against

            @member ejs.TopChildrenQuery
            @param {String} t A valid type name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      type: function (t) {
        if (t == null) {
          return query.top_children.type;
        }
  
        query.top_children.type = t;
        return this;
      },

      /**
            Sets the scope of the query.  A scope allows to run facets on the 
            same scope name that will work against the child documents. 

            @deprecated since elasticsearch 0.90
            @member ejs.TopChildrenQuery
            @param {String} s The scope name as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scope: function (s) {
        return this;
      },

      /**
            Sets the scoring type.  Valid values are max, sum, or avg. If
            another value is passed it we silently ignore the value.

            @member ejs.TopChildrenQuery
            @param {String} s The scoring type as a string. 
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      score: function (s) {
        if (s == null) {
          return query.top_children.score;
        }
  
        s = s.toLowerCase();
        if (s === 'max' || s === 'sum' || s === 'avg') {
          query.top_children.score = s;
        }
      
        return this;
      },
  
      /**
            Sets the factor which is the number of hits that are asked for in
            the child query.  Defaults to 5.

            @member ejs.TopChildrenQuery
            @param {Integer} f A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      factor: function (f) {
        if (f == null) {
          return query.top_children.factor;
        }

        query.top_children.factor = f;
        return this;
      },

      /**
            Sets the incremental factor.  The incremental factor is used when not
            enough child documents are returned so the factor is multiplied by
            the incremental factor to fetch more results.  Defaults to 52

            @member ejs.TopChildrenQuery
            @param {Integer} f A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      incrementalFactor: function (f) {
        if (f == null) {
          return query.top_children.incremental_factor;
        }

        query.top_children.incremental_factor = f;
        return this;
      },
        
      /**
            Sets the boost value of the <code>Query</code>.

            @member ejs.TopChildrenQuery
            @param {Double} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.top_children.boost;
        }

        query.top_children.boost = boost;
        return this;
      },
      
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.TopChildrenQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.TopChildrenQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.TopChildrenQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>Matches documents that have fields matching a wildcard expression 
    (not analyzed). Supported wildcards are *, which matches any character 
    sequence (including the empty one), and ?, which matches any single 
    character. Note this query can be slow, as it needs to iterate over many 
    wildcards. In order to prevent extremely slow wildcard queries, a wildcard 
    wildcard should not start with one of the wildcards * or ?. The wildcard query 
    maps to Lucene WildcardQuery.</p>

    @name ejs.WildcardQuery

    @desc
    A Query that matches documents containing a wildcard. This may be
    combined with other wildcards with a BooleanQuery.

    @param {String} field the document field/key to query against
    @param {String} value the literal value to be matched
    */
  ejs.WildcardQuery = function (field, value) {

    /**
         The internal query object. <code>Use get()</code>
         @member ejs.WildcardQuery
         @property {Object} query
         */
    var query = {
      wildcard: {}
    };

    query.wildcard[field] = {
      value: value
    };

    return {

      /**
            Sets the fields to query against.

            @member ejs.WildcardQuery
            @param {String} f A valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (f) {
        var oldValue = query.wildcard[field];
    
        if (f == null) {
          return field;
        }

        delete query.wildcard[field];
        field = f;
        query.wildcard[f] = oldValue;
    
        return this;
      },
  
      /**
            Sets the wildcard query value.

            @member ejs.WildcardQuery
            @param {String} v A single term.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      value: function (v) {
        if (v == null) {
          return query.wildcard[field].value;
        }

        query.wildcard[field].value = v;
        return this;
      },
    
      /**
            Sets rewrite method.  Valid values are: 
            
            constant_score_auto - tries to pick the best constant-score rewrite 
              method based on term and document counts from the query
              
            scoring_boolean - translates each term into boolean should and 
              keeps the scores as computed by the query
              
            constant_score_boolean - same as scoring_boolean, expect no scores
              are computed.
              
            constant_score_filter - first creates a private Filter, by visiting 
              each term in sequence and marking all docs for that term
              
            top_terms_boost_N - first translates each term into boolean should
              and scores are only computed as the boost using the top N
              scoring terms.  Replace N with an integer value.
              
            top_terms_N -   first translates each term into boolean should
                and keeps the scores as computed by the query. Only the top N
                scoring terms are used.  Replace N with an integer value.
            
            Default is constant_score_auto.

            This is an advanced option, use with care.

            @member ejs.WildcardQuery
            @param {String} m The rewrite method as a string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      rewrite: function (m) {
        if (m == null) {
          return query.wildcard[field].rewrite;
        }
        
        m = m.toLowerCase();
        if (m === 'constant_score_auto' || m === 'scoring_boolean' ||
          m === 'constant_score_boolean' || m === 'constant_score_filter' ||
          m.indexOf('top_terms_boost_') === 0 || 
          m.indexOf('top_terms_') === 0) {
            
          query.wildcard[field].rewrite = m;
        }
        
        return this;
      },
      
      /**
            Sets the boost value for documents matching the <code>Query</code>.

            @member ejs.WildcardQuery
            @param {Number} boost A positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boost: function (boost) {
        if (boost == null) {
          return query.wildcard[field].boost;
        }

        query.wildcard[field].boost = boost;
        return this;
      },

      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.WildcardQuery
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.WildcardQuery
            @returns {String} the type of object
            */
      _type: function () {
        return 'query';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.WildcardQuery
            @returns {String} returns this object's internal <code>query</code> property.
            */
      _self: function () {
        return query;
      }
    };
  };

  /**
    @class
    <p>A GeoPoint object that can be used in queries and filters that 
    take a GeoPoint.  GeoPoint supports various input formats.</p>

    <p>See http://www.elasticsearch.org/guide/reference/mapping/geo-point-type.html</p>

    @name ejs.GeoPoint

    @desc
    <p>Defines a point</p>

    @param {Array} p An optional point as an array in [lat, lon] format.
    */
  ejs.GeoPoint = function (p) {

    var point = [0, 0];

    // p  = [lat, lon], convert it to GeoJSON format of [lon, lat]
    if (p != null && isArray(p) && p.length === 2) {
      point = [p[1], p[0]];
    }
  
    return {

      /**
            Sets the GeoPoint as properties on an object.  The object must have
            a 'lat' and 'lon' property.  
          
            Example:
            {lat: 41.12, lon: -71.34}

            @member ejs.GeoPoint
            @param {Object} obj an object with a lat and lon property.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      properties: function (obj) {
        if (obj == null) {
          return point;
        }
      
        if (isObject(obj) && has(obj, 'lat') && has(obj, 'lon')) {
          point = {
            lat: obj.lat,
            lon: obj.lon
          };
        }
      
        return this;
      },

      /**
            Sets the GeoPoint as a string.  The format is "lat,lon".
          
            Example:
          
            "41.12,-71.34"

            @member ejs.GeoPoint
            @param {String} s a String point in "lat,lon" format.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      string: function (s) {
        if (s == null) {
          return point;
        }
      
        if (isString(s) && s.indexOf(',') !== -1) {
          point = s;
        }
      
        return this;
      },
    
      /**
            Sets the GeoPoint as a GeoHash.  The hash is a string of 
            alpha-numeric characters with a precision length that defaults to 12.
          
            Example:
            "drm3btev3e86"

            @member ejs.GeoPoint
            @param {String} hash an GeoHash as a string
            @param {Integer} precision an optional precision length, defaults
              to 12 if not specified.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      geohash: function (hash, precision) {
        // set precision, default to 12
        precision = (precision != null && isNumber(precision)) ? precision : 12;
      
        if (hash == null) {
          return point;
        }
      
        if (isString(hash) && hash.length === precision) {
          point = hash;
        }
      
        return this;
      },
    
      /**
            Sets the GeoPoint from an array point.  The array must contain only
            2 values.  The first value is the lat and the 2nd value is the lon.
          
            Example:
            [41.12, -71.34]

            @member ejs.GeoPoint
            @param {Array} a an array of length 2.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      array: function (a) {
        if (a == null) {
          return point;
        }
      
      
        // convert to GeoJSON format of [lon, lat]
        if (isArray(a) && a.length === 2) {
          point = [a[1], a[0]];
        }
      
        return this;
      },
    
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.GeoPoint
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(point);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.GeoPoint
            @returns {String} the type of object
            */
      _type: function () {
        return 'geo point';
      },
      
      /**
            Retrieves the internal <code>script</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.GeoPoint
            @returns {String} returns this object's internal object representation.
            */
      _self: function () {
        return point;
      }
    };
  };

  /**
    @class
    <p>Allows to highlight search results on one or more fields.  In order to 
    perform highlighting, the actual content of the field is required. If the 
    field in question is stored (has store set to yes in the mapping), it will 
    be used, otherwise, the actual _source will be loaded and the relevant 
    field will be extracted from it.</p>

    <p>If no term_vector information is provided (by setting it to 
    with_positions_offsets in the mapping), then the plain highlighter will be 
    used. If it is provided, then the fast vector highlighter will be used. 
    When term vectors are available, highlighting will be performed faster at 
    the cost of bigger index size.</p>

    <p>See http://www.elasticsearch.org/guide/reference/api/search/highlighting.html</p>

    @name ejs.Highlight

    @desc
    <p>Allows to highlight search results on one or more fields.</p>

    @param {String || Array} fields An optional field or array of fields to highlight.
    */
  ejs.Highlight = function (fields) {
  
    var highlight = {
      fields: {}
    },
  
    addOption = function (field, option, val) {
      if (field == null) {
        highlight[option] = val;
      } else {
        if (!has(highlight.fields, field)) {
          highlight.fields[field] = {};
        }
      
        highlight.fields[field][option] = val;
      }
    };

    if (fields != null) {
      if (isString(fields)) {
        highlight.fields[fields] = {};
      } else if (isArray(fields)) {
        each(fields, function (field) {
          highlight.fields[field] = {};
        });
      }
    }
  
    return {

      /**
            Allows you to set the fields that will be highlighted.  You can 
            specify a single field or an array of fields.  All fields are 
            added to the current list of fields.

            @member ejs.Highlight
            @param {String || Array} vals A field name or array of field names.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fields: function (vals) {
        if (vals == null) {
          return highlight.fields;
        }
      
        if (isString(vals)) {
          if (!has(highlight.fields, vals)) {
            highlight.fields[vals] = {};
          }
        } else if (isArray(vals)) {
          each(vals, function (field) {
            if (!has(highlight.fields, field)) {
              highlight.fields[field] = {};
            }
          });
        }
      },
    
      /**
            Sets the pre tags for highlighted fragments.  You can apply the
            tags to a specific field by passing the field name in to the 
            <code>oField</code> parameter.
        
            @member ejs.Highlight
            @param {String || Array} tags A single tag or an array of tags.
            @param {String} oField An optional field name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      preTags: function (tags, oField) {
        if (tags === null && oField != null) {
          return highlight.fields[oField].pre_tags;
        } else if (tags == null) {
          return highlight.pre_tags;
        }
  
        if (isString(tags)) {
          addOption(oField, 'pre_tags', [tags]);
        } else if (isArray(tags)) {
          addOption(oField, 'pre_tags', tags);
        }
        
        return this;
      },

      /**
            Sets the post tags for highlighted fragments.  You can apply the
            tags to a specific field by passing the field name in to the 
            <code>oField</code> parameter.
        
            @member ejs.Highlight
            @param {String || Array} tags A single tag or an array of tags.
            @param {String} oField An optional field name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      postTags: function (tags, oField) {
        if (tags === null && oField != null) {
          return highlight.fields[oField].post_tags;
        } else if (tags == null) {
          return highlight.post_tags;
        }
  
        if (isString(tags)) {
          addOption(oField, 'post_tags', [tags]);
        } else if (isArray(tags)) {
          addOption(oField, 'post_tags', tags);
        }
        
        return this;
      },
      
      /**
            Sets the order of highlight fragments.  You can apply the option
            to a specific field by passing the field name in to the 
            <code>oField</code> parameter.  Valid values for order are:
            
            score - the score calculated by Lucene's highlighting framework.
        
            @member ejs.Highlight
            @param {String} o The order.  Currently only "score".
            @param {String} oField An optional field name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      order: function (o, oField) {
        if (o === null && oField != null) {
          return highlight.fields[oField].order;
        } else if (o == null) {
          return highlight.order;
        }
  
        o = o.toLowerCase();
        if (o === 'score') {
          addOption(oField, 'order', o);
        }
        
        return this;
      },
      
      /**
            Sets the schema to be used for the tags. Valid values are:
            
            styled - 10 <em> pre tags with css class of hltN, where N is 1-10
        
            @member ejs.Highlight
            @param {String} s The schema.  Currently only "styled".
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      tagsSchema: function (s) {
        if (s == null) {
          return highlight.tags_schema;
        }
  
        s = s.toLowerCase();
        if (s === 'styled') {
          highlight.tags_schema = s;
        }
        
        return this;
      },
      
      /**
            Enables highlights in documents matched by a filter.  
            You can apply the option to a specific field by passing the field 
            name in to the <code>oField</code> parameter.  Defaults to false.
            
            @member ejs.Highlight
            @param {Boolean} trueFalse If filtered docs should be highlighted.
            @param {String} oField An optional field name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      highlightFilter: function (trueFalse, oField) {
        if (trueFalse === null && oField != null) {
          return highlight.fields[oField].highlight_filter;
        } else if (trueFalse == null) {
          return highlight.highlight_filter;
        }
  
        addOption(oField, 'highlight_filter', trueFalse);
        return this;
      },
      
      /**
            Sets the size of each highlight fragment in characters.  
            You can apply the option to a specific field by passing the field 
            name in to the <code>oField</code> parameter. Default:  100
            
            @member ejs.Highlight
            @param {Integer} size The fragment size in characters.
            @param {String} oField An optional field name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fragmentSize: function (size, oField) {
        if (size === null && oField != null) {
          return highlight.fields[oField].fragment_size;
        } else if (size == null) {
          return highlight.fragment_size;
        }
  
        addOption(oField, 'fragment_size', size);
        return this;
      },
      
      /**
            Sets the number of highlight fragments.
            You can apply the option to a specific field by passing the field 
            name in to the <code>oField</code> parameter. Default:  5

            @member ejs.Highlight
            @param {Integer} cnt The fragment size in characters.
            @param {String} oField An optional field name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      numberOfFragments: function (cnt, oField) {
        if (cnt === null && oField != null) {
          return highlight.fields[oField].number_of_fragments;
        } else if (cnt == null) {
          return highlight.number_of_fragments;
        }

        addOption(oField, 'number_of_fragments', cnt);
        return this;
      },       

      /**
            Sets highlight encoder.  Valid values are:
            
            default - the default, no encoding
            html - to encode html characters if you use html tags
        
            @member ejs.Highlight
            @param {String} e The encoder.  default or html
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      encoder: function (e) {
        if (e == null) {
          return highlight.encoder;
        }
  
        e = e.toLowerCase();
        if (e === 'default' || e === 'html') {
          highlight.encoder = e;
        }
        
        return this;
      },

      /**
            When enabled it will cause a field to be highlighted only if a 
            query matched that field. false means that terms are highlighted 
            on all requested fields regardless if the query matches 
            specifically on them.  You can apply the option to a specific 
            field by passing the field name in to the <code>oField</code> 
            parameter.  Defaults to false.
            
            @member ejs.Highlight
            @param {Boolean} trueFalse If filtered docs should be highlighted.
            @param {String} oField An optional field name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      requireFieldMatch: function (trueFalse, oField) {
        if (trueFalse === null && oField != null) {
          return highlight.fields[oField].require_field_match;
        } else if (trueFalse == null) {
          return highlight.require_field_match;
        }
  
        addOption(oField, 'require_field_match', trueFalse);
        return this;
      },

      /**
            Sets the max number of characters to scan while looking for the 
            start of a boundary character. You can apply the option to a 
            specific field by passing the field name in to the 
            <code>oField</code> parameter. Default:  20

            @member ejs.Highlight
            @param {Integer} cnt The max characters to scan.
            @param {String} oField An optional field name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boundaryMaxScan: function (cnt, oField) {
        if (cnt === null && oField != null) {
          return highlight.fields[oField].boundary_max_scan;
        } else if (cnt == null) {
          return highlight.boundary_max_scan;
        }

        addOption(oField, 'boundary_max_scan', cnt);
        return this;
      },       

      /**
            Set's the boundary characters.  When highlighting a field that is 
            mapped with term vectors, boundary_chars can be configured to 
            define what constitutes a boundary for highlighting. It’s a single 
            string with each boundary character defined in it. You can apply
            the option to a specific field by passing the field name in to 
            the <code>oField</code> parameter. It defaults to ".,!? \t\n".
            
            @member ejs.Highlight
            @param {String} charStr The boundary chars in a string.
            @param {String} oField An optional field name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      boundaryChars: function (charStr, oField) {
        if (charStr === null && oField != null) {
          return highlight.fields[oField].boundary_chars;
        } else if (charStr == null) {
          return highlight.boundary_chars;
        }
  
        addOption(oField, 'boundary_chars', charStr);
        return this;
      },
      
      /**
            Sets the highligher type.  You can apply the option
            to a specific field by passing the field name in to the 
            <code>oField</code> parameter.  Valid values for order are:
            
            fast-vector-highlighter - the fast vector based highligher
            highlighter - the slower plain highligher
        
            @member ejs.Highlight
            @param {String} t The highligher. 
            @param {String} oField An optional field name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      type: function (t, oField) {
        if (t === null && oField != null) {
          return highlight.fields[oField].type;
        } else if (t == null) {
          return highlight.type;
        }
  
        t = t.toLowerCase();
        if (t === 'fast-vector-highlighter' || t === 'highlighter') {
          addOption(oField, 'type', t);
        }
        
        return this;
      },

      /**
            Sets the fragmenter type.  You can apply the option
            to a specific field by passing the field name in to the 
            <code>oField</code> parameter.  Valid values for order are:
            
            simple - breaks text up into same-size fragments with no concerns 
              over spotting sentence boundaries.
            span - breaks text up into same-size fragments but does not split 
              up Spans.
            
            @member ejs.Highlight
            @param {String} f The fragmenter. 
            @param {String} oField An optional field name
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fragmenter: function (f, oField) {
        if (f === null && oField != null) {
          return highlight.fields[oField].fragmenter;
        } else if (f == null) {
          return highlight.fragmenter;
        }
  
        f = f.toLowerCase();
        if (f === 'simple' || f === 'span') {
          addOption(oField, 'fragmenter', f);
        }
        
        return this;
      },
      
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.Highlight
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(highlight);
      },

      /**
            The type of ejs object.  For internal use only.
          
            @member ejs.Highlight
            @returns {String} the type of object
            */
      _type: function () {
        return 'highlight';
      },
    
      /**
            Retrieves the internal <code>script</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.Highlight
            @returns {String} returns this object's internal object representation.
            */
      _self: function () {
        return highlight;
      }
    };
  };

  /**
    @class
    <p>A shape which has already been indexed in another index and/or index 
    type. This is particularly useful for when you have a pre-defined list of 
    shapes which are useful to your application and you want to reference this 
    using a logical name (for example ‘New Zealand’) rather than having to 
    provide their coordinates each time.</p>

    @name ejs.IndexedShape

    @desc
    <p>Defines a shape that already exists in an index/type.</p>

    @param {String} type The name of the type where the shape is indexed.
    @param {String} id The document id of the shape.

    */
  ejs.IndexedShape = function (type, id) {

    var indexedShape = {
      type: type,
      id: id
    };

    return {

      /**
            Sets the type which the shape is indexed under.

            @member ejs.IndexedShape
            @param {String} t a valid shape type.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      type: function (t) {
        if (t == null) {
          return indexedShape.type;
        }
    
        indexedShape.type = t;
        return this;
      },

      /**
            Sets the document id of the indexed shape.

            @member ejs.IndexedShape
            @param {String} id a valid document id.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      id: function (id) {
        if (id == null) {
          return indexedShape.id;
        }
    
        indexedShape.id = id;
        return this;
      },

      /**
            Sets the index which the shape is indexed under. 
            Defaults to "shapes".

            @member ejs.IndexedShape
            @param {String} idx a valid index name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      index: function (idx) {
        if (idx == null) {
          return indexedShape.index;
        }
    
        indexedShape.index = idx;
        return this;
      },

      /**
            Sets the field name containing the indexed shape. 
            Defaults to "shape".

            @member ejs.IndexedShape
            @param {String} field a valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      shapeFieldName: function (field) {
        if (field == null) {
          return indexedShape.shape_field_name;
        }
    
        indexedShape.shape_field_name = field;
        return this;
      },
              
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.IndexedShape
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(indexedShape);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.IndexedShape
            @returns {String} the type of object
            */
      _type: function () {
        return 'indexed shape';
      },
      
      /**
            Retrieves the internal <code>script</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.IndexedShape
            @returns {String} returns this object's internal object representation.
            */
      _self: function () {
        return indexedShape;
      }
    };
  };

  /**
    @class
    <p>The <code>Request</code> object provides methods generating and 
    executing search requests.</p>

    @name ejs.Request

    @desc
    <p>Provides methods for executing search requests</p>

    @param {Object} conf A configuration object containing the initilization
      parameters.  The following parameters can be set in the conf object:
        indices - single index name or array of index names
        types - single type name or array of types
        routing - the shard routing value
    */
  ejs.Request = function (conf) {

    var query, indices, types, params = {},
    
      // gernerates the correct url to the specified REST endpoint
      getRestPath = function (endpoint) {
        var searchUrl = '', 
          parts = [];
        
        // join any indices
        if (indices.length > 0) {
          searchUrl = searchUrl + '/' + indices.join();
        }

        // join any types
        if (types.length > 0) {
          searchUrl = searchUrl + '/' + types.join();
        }
        
        // add the endpoint
        if (endpoint.length > 0 && endpoint[0] !== '/') {
          searchUrl = searchUrl + '/';
        }
        
        searchUrl = searchUrl + endpoint;
        
        for (var p in params) {
          if (!has(params, p) || params[p] === '') {
            continue;
          }
          
          parts.push(p + '=' + encodeURIComponent(params[p]));
        }
        
        if (parts.length > 0) {
          searchUrl = searchUrl + '?' + parts.join('&');
        }
        
        return searchUrl;
      };

    /**
        The internal query object.
        @member ejs.Request
        @property {Object} query
        */
    query = {};

    conf = conf || {};
    // check if we are searching across any specific indeices        
    if (conf.indices == null) {
      indices = [];
    } else if (isString(conf.indices)) {
      indices = [conf.indices];
    } else {
      indices = conf.indices;
    }

    // check if we are searching across any specific types
    if (conf.types == null) {
      types = [];
    } else if (isString(conf.types)) {
      types = [conf.types];
    } else {
      types = conf.types;
    }

    // check that an index is specified when a type is
    // if not, search across _all indices
    if (indices.length === 0 && types.length > 0) {
      indices = ["_all"];
    }

    if (conf.routing != null) {
      params.routing = conf.routing;
    }
    
    return {

      /**
            <p>Sets the sorting for the query.  This accepts many input formats.</p>
            
            <dl>
                <dd><code>sort()</code> - The current sorting values are returned.</dd>
                <dd><code>sort(fieldName)</code> - Adds the field to the current list of sorting values.</dd>
                <dd><code>sort(fieldName, order)</code> - Adds the field to the current list of
                    sorting with the specified order.  Order must be asc or desc.</dd>
                <dd><code>sort(ejs.Sort)</code> - Adds the Sort value to the current list of sorting values.</dd>
                <dd><code>sort(array)</code> - Replaces all current sorting values with values
                    from the array.  The array must contain only strings and Sort objects.</dd>
            </dl>

            <p>Multi-level sorting is supported so the order in which sort fields 
            are added to the query requests is relevant.</p>
            
            <p>It is recommended to use <code>Sort</code> objects when possible.</p>
            
            @member ejs.Request
            @param {String} fieldName The field to be sorted by.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      sort: function () {
        var i, len;
        
        if (!has(query, "sort")) {
          query.sort = [];
        }

        if (arguments.length === 0) {
          return query.sort;
        }
      
        // if passed a single argument
        if (arguments.length === 1) {
          var sortVal = arguments[0];
          
          if (isString(sortVal)) {
            // add  a single field name
            query.sort.push(sortVal);
          } else if (isSort(sortVal)) {
            // add the Sort object
            query.sort.push(sortVal._self());
          } else if (isArray(sortVal)) {
            // replace with all values in the array
            // the values must be a fieldName (string) or a
            // Sort object.  Any other type throws an Error.
            query.sort = [];
            for (i = 0, len = sortVal.length; i < len; i++) {
              if (isString(sortVal[i])) {
                query.sort.push(sortVal[i]);
              } else if (isSort(sortVal[i])) {
                query.sort.push(sortVal[i]._self());
              } else {
                throw new TypeError('Invalid object in array');
              }
            }
          } else {
            // Invalid object type as argument.
            throw new TypeError('Argument must be string, Sort, or array');
          } 
        } else if (arguments.length === 2) {
          // handle the case where a single field name and order are passed
          var field = arguments[0],
            order = arguments[1];
            
          if (isString(field) && isString(order)) {
            order = order.toLowerCase();
            if (order === 'asc' || order === 'desc') {
              var sortObj = {};
              sortObj[field] = {order: order};
              query.sort.push(sortObj);
            }
          }
        }

        return this;
      },

      /**
           Enables score computation and tracking during sorting.  Be default, 
           when sorting scores are not computed.

            @member ejs.Request
            @param {Boolean} trueFalse If scores should be computed and tracked.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      trackScores: function (trueFalse) {
        if (trueFalse == null) {
          return query.track_scores;
        }
      
        query.track_scores = trueFalse;
        return this;
      },
      
      /**
            Sets the number of results/documents to be returned. This is set on a per page basis.

            @member ejs.Request
            @param {Integer} s The number of results that are to be returned by the search.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      size: function (s) {
        if (s == null) {
          return query.size;
        }
      
        query.size = s;
        return this;
      },

      /**
            A timeout, bounding the request to be executed within the 
            specified time value and bail when expired. Defaults to no timeout.

            <p>This option is valid during the following operations:
                <code>search</code> and <code>delete by query</code></p>
    
            @member ejs.Request
            @param {Long} t The timeout value in milliseconds.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      timeout: function (t) {
        if (t == null) {
          return params.timeout;
        }
      
        params.timeout = t;
        return this;
      },
                  
      /**
            Sets the shard routing parameter.  Only shards matching routing
            values will be searched.  Set to an empty string to disable routing.
            Disabled by default.

            <p>This option is valid during the following operations:
                <code>search, count</code> and <code>delete by query</code></p>
    
            @member ejs.Request
            @param {String} route The routing values as a comma-separated string.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      routing: function (route) {
        if (route == null) {
          return params.routing;
        }
      
        params.routing = route;
        return this;
      },

      /**
             <p>Sets the replication mode.</p>  

             <p>Valid values are:</p>
             
             <dl>
                <dd><code>async</code> - asynchronous replication to slaves</dd>
                <dd><code>sync</code> - synchronous replication to the slaves</dd>
                <dd><code>default</code> - the currently configured system default.</dd> 
             </dl>
             
             <p>This option is valid during the following operations:
                <code>delete by query</code></p>

             @member ejs.Request
             @param {String} r The replication mode (async, sync, or default)
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      replication: function (r) {
        if (r == null) {
          return params.replication;
        }
        
        r = r.toLowerCase();
        if (r === 'async' || r === 'sync' || r === 'default') {
          params.replication = r;
        }
        
        return this;
      },
      
      /**
             <p>Sets the write consistency.</p>  

             <p>Valid values are:</p>
             
             <dl>
                <dd><code>one</code> - only requires write to one shard</dd>
                <dd><code>quorum</code> - requires writes to quorum <code>(N/2 + 1)</code></dd>
                <dd><code>all</code> - requires write to succeed on all shards</dd>
                <dd><code>default</code> - the currently configured system default</dd>
             </dl>
             
             <p>This option is valid during the following operations:
                <code>delete by query</code></p>

             @member ejs.Request
             @param {String} c The write consistency (one, quorum, all, or default)
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      consistency: function (c) {
        if (c == null) {
          return params.consistency;
        }
        
        c = c.toLowerCase();
        if (c === 'default' || c === 'one' || c === 'quorum' || c === 'all') {
          params.consistency = c;
        }
        
        return this;
      },
      
      /**
             <p>Sets the search execution type for the request.</p>  

             <p>Valid values are:</p>
             
             <dl>
                <dd><code>dfs_query_then_fetch</code> - same as query_then_fetch, 
                  except distributed term frequencies are calculated first.</dd>
                <dd><code>dfs_query_and_fetch</code> - same as query_and_fetch,
                  except distributed term frequencies are calculated first.</dd>
                <dd><code>query_then_fetch</code> - executed against all 
                  shards, but only enough information is returned.  When ready,
                  only the relevant shards are asked for the actual document 
                  content</dd>
                <dd><code>query_and_fetch</code> - execute the query on all 
                  relevant shards and return the results, including content.</dd>
                <dd><code>scan</code> - efficiently scroll a large result set</dd>
                <dd><code>count</code> -  special search type that returns the 
                  count that matched the search request without any docs </dd>
             </dl>
             
             <p>This option is valid during the following operations:
                <code>search</code></p>

             @member ejs.Request
             @param {String} t The search execution type
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      searchType: function (t) {
        if (t == null) {
          return params.search_type;
        }
        
        t = t.toLowerCase();
        if (t === 'dfs_query_then_fetch' || t === 'dfs_query_and_fetch' || 
          t === 'query_then_fetch' || t === 'query_and_fetch' || 
          t === 'scan' || t === 'count') {
            
          params.search_type = t;
        }
        
        return this;
      },
      
      /**
            By default, searches return full documents, meaning every property or field.
            This method allows you to specify which fields you want returned.
            
            Pass a single field name and it is appended to the current list of
            fields.  Pass an array of fields and it replaces all existing 
            fields.

            @member ejs.Request
            @param {String || Array} s The field as a string or fields as array
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      fields: function (fieldList) {
        if (fieldList == null) {
          return query.fields;
        }
      
        if (query.fields == null) {
          query.fields = [];
        }
        
        if (isString(fieldList)) {
          query.fields.push(fieldList);
        } else if (isArray(fieldList)) {
          query.fields = fieldList;
        } else {
          throw new TypeError('Argument must be string or array');
        }
        
        return this;
      },

      /**
            A search result set could be very large (think Google). Setting the
            <code>from</code> parameter allows you to page through the result set
            by making multiple request. This parameters specifies the starting
            result/document number point. Combine with <code>size()</code> to achieve paging.

            @member ejs.Request
            @param {Array} f The offset at which to start fetching results/documents from the result set.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      from: function (f) {
        if (f == null) {
          return query.from;
        }
        
        query.from = f;
        return this;
      },

      /**
            Allows you to set the specified query on this search object. This is the
            query that will be used when the search is executed.

            @member ejs.Request
            @param {Query} someQuery Any valid <code>Query</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      query: function (someQuery) {
        if (someQuery == null) {
          return query.query;
        }
      
        if (!isQuery(someQuery)) {
          throw new TypeError('Argument must be a Query');
        }
        
        query.query = someQuery._self();
        return this;
      },

      /**
            Allows you to set the specified indices on this request object. This is the
            set of indices that will be used when the search is executed.

            @member ejs.Request
            @param {Array} indexArray An array of collection names.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      indices: function (indexArray) {
        if (indexArray == null) {
          return indices;
        } else if (isString(indexArray)) {
          indices = [indexArray];
        } else if (isArray(indexArray)) {
          indices = indexArray;
        } else {
          throw new TypeError('Argument must be a string or array');
        }

        // check that an index is specified when a type is
        // if not, search across _all indices
        if (indices.length === 0 && types.length > 0) {
          indices = ["_all"];
        }

        return this;
      },

      /**
            Allows you to set the specified content-types on this request object. This is the
            set of indices that will be used when the search is executed.

            @member ejs.Request
            @param {Array} typeArray An array of content-type names.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      types: function (typeArray) {
        if (typeArray == null) {
          return types;
        } else if (isString(typeArray)) {
          types = [typeArray];
        } else if (isArray(typeArray)) {
          types = typeArray;
        } else {
          throw new TypeError('Argument must be a string or array');
        }

        // check that an index is specified when a type is
        // if not, search across _all indices
        if (indices.length === 0 && types.length > 0) {
          indices = ["_all"];
        }

        return this;
      },

      /**
            Allows you to set the specified facet on this request object. Multiple facets can
            be set, all of which will be returned when the search is executed.

            @member ejs.Request
            @param {Facet} facet Any valid <code>Facet</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      facet: function (facet) {
        if (facet == null) {
          return query.facets;
        }
      
        if (query.facets == null) {
          query.facets = {};
        }
      
        if (!isFacet(facet)) {
          throw new TypeError('Argument must be a Facet');
        }
        
        extend(query.facets, facet._self());

        return this;
      },

      /**
            Allows you to set a specified filter on this request object.

            @member ejs.Request
            @param {Object} filter Any valid <code>Filter</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      filter: function (filter) {
        if (filter == null) {
          return query.filter;
        }
      
        if (!isFilter(filter)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        query.filter = filter._self();
        return this;
      },

      /**
            Performs highlighting based on the <code>Highlight</code> 
            settings.

            @member ejs.Request
            @param {Highlight} h A valid Highlight object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      highlight: function (h) {
        if (h == null) {
          return query.highlight;
        }
      
        if (!isHighlight(h)) {
          throw new TypeError('Argument must be a Highlight object');
        }

        query.highlight = h._self();
        return this;
      },

      /**
            Allows you to set the specified suggester on this request object. 
            Multiple suggesters can be set, all of which will be returned when 
            the search is executed.  Global suggestion text can be set by 
            passing in a string vs. a <code>Suggest</code> object.

            @since elasticsearch 0.90
            
            @member ejs.Request
            @param {String || Suggest} s A valid Suggest object or a String to 
              set as the global suggest text.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      suggest: function (s) {
        if (s == null) {
          return query.suggest;
        }
      
        if (query.suggest == null) {
          query.suggest = {};
        }
      
        if (isString(s)) {
          query.suggest.text = s;
        } else if (isSuggest(s)) {
          extend(query.suggest, s._self());
        } else {
          throw new TypeError('Argument must be a string or Suggest object');
        }

        return this;
      },
      
      /**
            Computes a document property dynamically based on the supplied <code>ScriptField</code>.

            @member ejs.Request
            @param {ScriptField} oScriptField A valid <code>ScriptField</code>.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      scriptField: function (oScriptField) {
        if (oScriptField == null) {
          return query.script_fields;
        }
      
        if (query.script_fields == null) {
          query.script_fields = {};
        }
      
        if (!isScriptField(oScriptField)) {
          throw new TypeError('Argument must be a ScriptField');
        }
        
        extend(query.script_fields, oScriptField._self());
        return this;
      },

      /**
            <p>Controls the preference of which shard replicas to execute the search request on.
            By default, the operation is randomized between the each shard replicas.  The
            preference can be one of the following:</p>

            <dl>
                <dd><code>_primary</code> - the operation will only be executed on primary shards</dd>
                <dd><code>_local</code> - the operation will prefer to be executed on local shards</dd>
                <dd><code>_only_node:$nodeid</code> - the search will only be executed on node with id $nodeid</dd>
                <dd><code>custom</code> - any string, will guarentee searches always happen on same node.</dd>
            </dl>

            <p>This option is valid during the following operations:
                <code>search</code> and <code>count</code></p>
                
            @member ejs.Request
            @param {String} perf the preference, any of <code>_primary</code>, <code>_local</code>, 
                <code>_only_:$nodeid</code>, or a custom string value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      preference: function (perf) {
        if (perf == null) {
          return params.preference;
        }
      
        params.preference = perf;
        return this;
      },

      /**
            <p>Determines what type of indices to exclude from a request.  The
            value can be one of the following:</p>

            <dl>
                <dd><code>none</code> - No indices / aliases will be excluded from a request</dd>
                <dd><code>missing</code> - Indices / aliases that are missing will be excluded from a request</dd>
            </dl>

            <p>This option is valid during the following operations:
                <code>search, count</code> and <code>delete by query</code></p>
                
            @member ejs.Request
            @param {String} ignoreType the type of ignore (none or missing).
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      ignoreIndices: function (ignoreType) {
        if (ignoreType == null) {
          return params.ignore_indices;
        }
      
        ignoreType = ignoreType.toLowerCase();
        if (ignoreType === 'none' || ignoreType === 'missing') {
          params.ignore_indices = ignoreType;
        }
        
        return this;
      },
      
      /**
            Boosts hits in the specified index by the given boost value.

            @member ejs.Request
            @param {String} index the index to boost
            @param {Double} boost the boost value
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      indexBoost: function (index, boost) {
        if (query.indices_boost == null) {
          query.indices_boost = {};
        }

        if (arguments.length === 0) {
          return query.indices_boost;
        }
      
        query.indices_boost[index] = boost;
        return this;
      },

      /**
            Enable/Disable explanation of score for each search result.

            @member ejs.Request
            @param {Boolean} trueFalse true to enable, false to disable
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      explain: function (trueFalse) {
        if (trueFalse == null) {
          return query.explain;
        } 
        
        query.explain = trueFalse;
        return this;
      },

      /**
            Enable/Disable returning version number for each search result.

            @member ejs.Request
            @param {Boolean} trueFalse true to enable, false to disable
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      version: function (trueFalse) {
        if (trueFalse == null) {
          return query.version;
        }
        
        query.version = trueFalse;
        return this;
      },

      /**
            Filters out search results will scores less than the specified minimum score.

            @member ejs.Request
            @param {Double} min a positive <code>double</code> value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minScore: function (min) {
        if (min == null) {
          return query.min_score;
        }
        
        query.min_score = min;
        return this;
      },

      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.Request
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(query);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.Request
            @returns {String} the type of object
            */
      _type: function () {
        return 'request';
      },
      
      /**
            Retrieves the internal <code>query</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.Request
            @returns {String} returns this object's internal object representation.
            */
      _self: function () {
        return query;
      },

      /**
            Executes a delete by query request using the current query.
            
            @member ejs.Request
            @param {Function} successcb A callback function that handles the response.
            @param {Function} errorcb A callback function that handles errors.
            @returns {Object} Returns a client specific object.
            */
      doDeleteByQuery: function (successcb, errorcb) {
        var queryData = JSON.stringify(query.query);
      
        // make sure the user has set a client
        if (ejs.client == null) {
          throw new Error("No Client Set");
        }
        
        return ejs.client.del(getRestPath('_query'), queryData, successcb, errorcb);
      },

      /**
            Executes a count request using the current query.
            
            @member ejs.Request
            @param {Function} successcb A callback function that handles the count response.
            @param {Function} errorcb A callback function that handles errors.
            @returns {Object} Returns a client specific object.
            */
      doCount: function (successcb, errorcb) {
        var queryData = JSON.stringify(query.query);
      
        // make sure the user has set a client
        if (ejs.client == null) {
          throw new Error("No Client Set");
        }
        
        return ejs.client.post(getRestPath('_count'), queryData, successcb, errorcb);
      },
            
      /**
            Executes the search. 

            @member ejs.Request
            @param {Function} successcb A callback function that handles the search response.
            @param {Function} errorcb A callback function that handles errors.
            @returns {Object} Returns a client specific object.
            */
      doSearch: function (successcb, errorcb) {
        var queryData = JSON.stringify(query);
      
        // make sure the user has set a client
        if (ejs.client == null) {
          throw new Error("No Client Set");
        }
        
        return ejs.client.post(getRestPath('_search'), queryData, successcb, errorcb);
      }
    };
  };

  /**
    @class
    <p>ScriptField's allow you create dynamic fields on stored documents at query
    time. For example, you might have a set of document thats containsthe fields
    <code>price</code> and <code>quantity</code>. At query time, you could define a computed
    property that dynamically creates a new field called <code>total</code>in each document
    based on the calculation <code>price * quantity</code>.</p>

    @name ejs.ScriptField

    @desc
    <p>Computes dynamic document properties based on information from other fields.</p>

    @param {String} fieldName A name of the script field to create.

    */
  ejs.ScriptField = function (fieldName) {
    var script = {};

    script[fieldName] = {};

    return {

      /**
            The script language being used. Currently supported values are
            <code>javascript</code> and <code>mvel</code>.

            @member ejs.ScriptField
            @param {String} language The language of the script.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lang: function (language) {
        if (language == null) {
          return script[fieldName].lang;
        }
      
        script[fieldName].lang = language;
        return this;
      },

      /**
            Sets the script/code that will be used to perform the calculation.

            @member ejs.ScriptField
            @param {String} expression The script/code to use.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      script: function (expression) {
        if (expression == null) {
          return script[fieldName].script;
        }
      
        script[fieldName].script = expression;
        return this;
      },

      /**
            Allows you to set script parameters to be used during the execution of the script.

            @member ejs.ScriptField
            @param {Object} oParams An object containing key/value pairs representing param name/value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      params: function (oParams) {
        if (oParams == null) {
          return script[fieldName].params;
        }
      
        script[fieldName].params = oParams;
        return this;
      },

      /**
            If execeptions thrown from the script should be ignored or not.
            Default: false

            @member ejs.ScriptField
            @param {Boolean} trueFalse if execptions should be ignored
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      ignoreFailure: function (trueFalse) {
        if (trueFalse == null) {
          return script[fieldName].ignore_failure;
        }
        
        script[fieldName].ignore_failure = trueFalse;
        return this;
      },
      
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.ScriptField
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(script);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.ScriptField
            @returns {String} the type of object
            */
      _type: function () {
        return 'script field';
      },
      
      /**
            Retrieves the internal <code>script</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.ScriptField
            @returns {String} returns this object's internal <code>facet</code> property.
            */
      _self: function () {
        return script;
      }
    };
  };

  /**
    @class
    <p>A Shape object that can be used in queries and filters that 
    take a Shape.  Shape uses the GeoJSON format.</p>

    <p>See http://www.geojson.org/</p>

    @name ejs.Shape

    @desc
    <p>Defines a shape</p>

    @param {String} type A valid shape type.
    @param {Array} coords An valid coordinat definition for the given shape.

    */
  ejs.Shape = function (type, coords) {
  
    var 
      shape = {},
      validType = function (t) {
        var valid = false;
        if (t === 'point' || t === 'linestring' || t === 'polygon' || 
          t === 'multipoint' || t === 'envelope' || t === 'multipolygon') {
          valid = true;
        }

        return valid;
      };
    
    type = type.toLowerCase();
    if (validType(type)) {
      shape.type = type;
      shape.coordinates = coords;
    }  
  
    return {

      /**
            Sets the shape type.  Can be set to one of:  point, linestring, polygon,
            multipoint, envelope, or multipolygon.

            @member ejs.Shape
            @param {String} t a valid shape type.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      type: function (t) {
        if (t == null) {
          return shape.type;
        }
      
        t = t.toLowerCase();
        if (validType(t)) {
          shape.type = t;
        }
      
        return this;
      },

      /**
            Sets the coordinates for the shape definition.  Note, the coordinates
            are not validated in this api.  Please see GeoJSON and ElasticSearch
            documentation for correct coordinate definitions.

            @member ejs.Shape
            @param {Array} c a valid coordinates definition for the shape.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      coordinates: function (c) {
        if (c == null) {
          return shape.coordinates;
        }

        shape.coordinates = c;
        return this;
      },
        
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.Shape
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(shape);
      },

      /**
            The type of ejs object.  For internal use only.
            
            @member ejs.Shape
            @returns {String} the type of object
            */
      _type: function () {
        return 'shape';
      },
      
      /**
            Retrieves the internal <code>script</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.Shape
            @returns {String} returns this object's internal object representation.
            */
      _self: function () {
        return shape;
      }
    };
  };

  /**
    @class
    <p>A Sort object that can be used in on the Request object to specify 
    various types of sorting.</p>

    <p>See http://www.elasticsearch.org/guide/reference/api/search/sort.html</p>

    @name ejs.Sort

    @desc
    <p>Defines a sort value</p>

    @param {String} fieldName The fieldName to sort against.  Defaults to _score
      if not specified.
    */
  ejs.Sort = function (fieldName) {

    // default to sorting against the documents score.
    if (fieldName == null) {
      fieldName = '_score';
    }
  
    var sort = {},
      key = fieldName, // defaults to field search
      geo_key = '_geo_distance', // used when doing geo distance sort
      script_key = '_script'; // used when doing script sort
    
    // defaults to a field sort
    sort[key] = {};

    return {

      /**
            Set's the field to sort on

            @member ejs.Sort
            @param {String} f The name of a field 
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (f) {
        var oldValue = sort[key];
      
        if (f == null) {
          return fieldName;
        }
    
        delete sort[key];      
        fieldName = f;
        key = f;
        sort[key] = oldValue;
      
        return this;
      },

      /**
            Enables sorting based on a distance from a GeoPoint

            @member ejs.Sort
            @param {GeoPoint} point A valid GeoPoint object
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      geoDistance: function (point) {
        var oldValue = sort[key];
      
        if (point == null) {
          return sort[key][fieldName];
        }
    
        if (!isGeoPoint(point)) {
          throw new TypeError('Argument must be a GeoPoint');
        }
      
        delete sort[key];
        key = geo_key;
        sort[key] = oldValue;
        sort[key][fieldName] = point._self();
      
        return this;
      },
    
      /**
            Enables sorting based on a script.

            @member ejs.Sort
            @param {String} scriptCode The script code as a string
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      script: function (scriptCode) {
        var oldValue = sort[key];
      
        if (scriptCode == null) {
          return sort[key].script;
        }
      
        delete sort[key];
        key = script_key;
        sort[key] = oldValue;
        sort[key].script = scriptCode;
      
        return this;
      },
    
      /**
            Sets the sort order.  Valid values are:
          
            asc - for ascending order
            desc - for descending order

            Valid during sort types:  field, geo distance, and script
          
            @member ejs.Sort
            @param {String} o The sort order as a string, asc or desc.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      order: function (o) {
        if (o == null) {
          return sort[key].order;
        }
    
        o = o.toLowerCase();
        if (o === 'asc' || o === 'desc') {
          sort[key].order = o;  
        }
      
        return this;
      },
    
      /**
            Sets the sort order to ascending (asc).  Same as calling
            <code>order('asc')</code>.
          
            @member ejs.Sort
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      asc: function () {
        sort[key].order = 'asc';
        return this;
      },
      
      /**
            Sets the sort order to descending (desc).  Same as calling
            <code>order('desc')</code>.
          
            @member ejs.Sort
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      desc: function () {
        sort[key].order = 'desc';
        return this;
      },
      
      /**
            Sets the order with a boolean value.  
          
            true = descending sort order
            false = ascending sort order

            Valid during sort types:  field, geo distance, and script
          
            @member ejs.Sort
            @param {Boolean} trueFalse If sort should be in reverse order.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      reverse: function (trueFalse) {
        if (trueFalse == null) {
          return sort[key].reverse;
        }
    
        sort[key].reverse = trueFalse;  
        return this;
      },
    
      /**
            Sets the value to use for missing fields.  Valid values are:
          
            _last - to put documents with the field missing last
            _first - to put documents with the field missing first
            {String} - any string value to use as the sort value.

            Valid during sort types:  field
          
            @member ejs.Sort
            @param {String} m The value to use for documents with the field missing.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      missing: function (m) {
        if (m == null) {
          return sort[key].missing;
        }
    
        sort[key].missing = m;  
        return this;
      },
    
      /**
            Sets if the sort should ignore unmapped fields vs throwing an error.

            Valid during sort types:  field
          
            @member ejs.Sort
            @param {Boolean} trueFalse If sort should ignore unmapped fields.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      ignoreUnmapped: function (trueFalse) {
        if (trueFalse == null) {
          return sort[key].ignore_unmapped;
        }
    
        sort[key].ignore_unmapped = trueFalse;  
        return this;
      },
    
      /**
             Sets the distance unit.  Valid values are "mi" for miles or "km"
             for kilometers. Defaults to "km".

             Valid during sort types:  geo distance
           
             @member ejs.Sort
             @param {Number} unit the unit of distance measure.
             @returns {Object} returns <code>this</code> so that calls can be chained.
             */
      unit: function (unit) {
        if (unit == null) {
          return sort[key].unit;
        }
    
        unit = unit.toLowerCase();
        if (unit === 'mi' || unit === 'km') {
          sort[key].unit = unit;
        }
      
        return this;
      },
    
      /**
            If the lat/long points should be normalized to lie within their
            respective normalized ranges.
          
            Normalized ranges are:
            lon = -180 (exclusive) to 180 (inclusive) range
            lat = -90 to 90 (both inclusive) range

            Valid during sort types:  geo distance
          
            @member ejs.Sort
            @param {String} trueFalse True if the coordinates should be normalized. False otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      normalize: function (trueFalse) {
        if (trueFalse == null) {
          return sort[key].normalize;
        }

        sort[key].normalize = trueFalse;
        return this;
      },
    
      /**
            How to compute the distance. Can either be arc (better precision) 
            or plane (faster). Defaults to arc.

            Valid during sort types:  geo distance
          
            @member ejs.Sort
            @param {String} type The execution type as a string.  
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      distanceType: function (type) {
        if (type == null) {
          return sort[key].distance_type;
        }

        type = type.toLowerCase();
        if (type === 'arc' || type === 'plane') {
          sort[key].distance_type = type;
        }
      
        return this;
      },
    
      /**
            Sets parameters that will be applied to the script.  Overwrites 
            any existing params.

            Valid during sort types:  script
          
            @member ejs.Sort
            @param {Object} p An object where the keys are the parameter name and 
              values are the parameter value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      params: function (p) {
        if (p == null) {
          return sort[key].params;
        }
  
        sort[key].params = p;
        return this;
      },
  
      /**
            Sets the script language.

            Valid during sort types:  script
          
            @member ejs.Sort
            @param {String} lang The script language, default mvel.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      lang: function (lang) {
        if (lang == null) {
          return sort[key].lang;
        }

        sort[key].lang = lang;
        return this;
      },
    
      /**
            Sets the script sort type.  Valid values are:
          
            <dl>
                <dd><code>string</code> - script return value is sorted as a string</dd>
                <dd><code>number</code> - script return value is sorted as a number</dd>
            <dl>

            Valid during sort types:  script
          
            @member ejs.Sort
            @param {String} type The sort type.  Either string or number.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      type: function (type) {
        if (type == null) {
          return sort[key].type;
        }

        type = type.toLowerCase();
        if (type === 'string' || type === 'number') {
          sort[key].type = type;
        }
      
        return this;
      },

      /**
            Sets the sort mode.  Valid values are:
          
            <dl>
                <dd><code>min</code> - sort by lowest value</dd>
                <dd><code>max</code> - sort by highest value</dd>
                <dd><code>sum</code> - sort by the sum of all values</dd>
                <dd><code>avg</code> - sort by the average of all values</dd>
            <dl>
            
            Valid during sort types:  field
          
            @since elasticsearch 0.90
            @member ejs.Sort
            @param {String} m The sort mode.  Either min, max, sum, or avg.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      mode: function (m) {
        if (m == null) {
          return sort[key].mode;
        }

        m = m.toLowerCase();
        if (m === 'min' || m === 'max' || m === 'sum' || m === 'avg') {
          sort[key].mode = m;
        }
      
        return this;
      },
      
      /**
            Sets the path of the nested object.

            Valid during sort types:  field
          
            @since elasticsearch 0.90
            @member ejs.Sort
            @param {String} path The nested path value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      nestedPath: function (path) {
        if (path == null) {
          return sort[key].nested_path;
        }

        sort[key].nested_path = path;
        return this;
      },
      
      /**
            <p>Allows you to set a filter that nested objects must match
            in order to be considered during sorting.</p>

            @since elasticsearch 0.90
            @member ejs.Sort
            @param {Object} oFilter A valid <code>Filter</code> object.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      nestedFilter: function (oFilter) {
        if (oFilter == null) {
          return sort[key].nested_filter;
        }
      
        if (!isFilter(oFilter)) {
          throw new TypeError('Argument must be a Filter');
        }
        
        sort[key].nested_filter = oFilter._self();
        return this;
      },
          
      /**
            Allows you to serialize this object into a JSON encoded string.

            @member ejs.Sort
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(sort);
      },

      /**
            The type of ejs object.  For internal use only.
          
            @member ejs.Sort
            @returns {String} the type of object
            */
      _type: function () {
        return 'sort';
      },
    
      /**
            Retrieves the internal <code>script</code> object. This is typically used by
            internal API functions so use with caution.

            @member ejs.Sort
            @returns {String} returns this object's internal object representation.
            */
      _self: function () {
        return sort;
      }
    };
  };

  /**
    @class
    <p>DirectGenerator is a candidate generator for <code>PhraseSuggester</code>.
    It generates terms based on edit distance and operators much like the
    <code>TermSuggester</code>.</p>

    @name ejs.DirectGenerator

    @since elasticsearch 0.90
  
    @desc
    <p>A candidate generator that generates terms based on edit distance.</p>

    @borrows ejs.DirectSettingsMixin.accuracy as accuracy
    @borrows ejs.DirectSettingsMixin.suggestMode as suggestMode
    @borrows ejs.DirectSettingsMixin.sort as sort
    @borrows ejs.DirectSettingsMixin.stringDistance as stringDistance
    @borrows ejs.DirectSettingsMixin.maxEdits as maxEdits
    @borrows ejs.DirectSettingsMixin.maxInspections as maxInspections
    @borrows ejs.DirectSettingsMixin.maxTermFreq as maxTermFreq
    @borrows ejs.DirectSettingsMixin.prefixLength as prefixLength
    @borrows ejs.DirectSettingsMixin.minWordLen as minWordLen
    @borrows ejs.DirectSettingsMixin.minDocFreq as minDocFreq
    */
  ejs.DirectGenerator = function () {

  
    var

    // common suggester options used in this generator
    _common = ejs.DirectSettingsMixin(),
  
    /**
        The internal generator object.
        @member ejs.DirectGenerator
        @property {Object} suggest
        */
    generator = _common._self();

    return extend(_common, {

      /**
            <p>Sets an analyzer that is applied to each of the tokens passed to 
            this generator.  The analyzer is applied to the original tokens,
            not the generated tokens.</p>

            @member ejs.DirectGenerator
            @param {String} analyzer A valid analyzer name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      preFilter: function (analyzer) {
        if (analyzer == null) {
          return generator.pre_filter;
        }
  
        generator.pre_filter = analyzer;
        return this;
      },
    
      /**
            <p>Sets an analyzer that is applied to each of the generated tokens 
            before they are passed to the actual phrase scorer.</p>

            @member ejs.DirectGenerator
            @param {String} analyzer A valid analyzer name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      postFilter: function (analyzer) {
        if (analyzer == null) {
          return generator.post_filter;
        }
  
        generator.post_filter = analyzer;
        return this;
      },
    
      /**
            <p>Sets the field used to generate suggestions from.</p>

            @member ejs.DirectGenerator
            @param {String} field A valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (field) {
        if (field == null) {
          return generator.field;
        }
  
        generator.field = field;
        return this;
      },
    
      /**
            <p>Sets the number of suggestions returned for each token.</p>

            @member ejs.DirectGenerator
            @param {Integer} s A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      size: function (s) {
        if (s == null) {
          return generator.size;
        }
  
        generator.size = s;
        return this;
      },
    
      /**
            <p>Allows you to serialize this object into a JSON encoded string.</p>

            @member ejs.DirectGenerator
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(generator);
      },

      /**
            The type of ejs object.  For internal use only.
        
            @member ejs.DirectGenerator
            @returns {String} the type of object
            */
      _type: function () {
        return 'generator';
      },
  
      /**
            <p>Retrieves the internal <code>generator</code> object. This is typically used by
               internal API functions so use with caution.</p>

            @member ejs.DirectGenerator
            @returns {String} returns this object's internal <code>generator</code> property.
            */
      _self: function () {
        return generator;
      }
    });
  };

  /**
    @mixin
    <p>The DirectSettingsMixin provides support for common options used across 
    various <code>Suggester</code> implementations.  This object should not be 
    used directly.</p>

    @name ejs.DirectSettingsMixin
    */
  ejs.DirectSettingsMixin = function () {

    /**
        The internal settings object.
        @member ejs.DirectSettingsMixin
        @property {Object} settings
        */
    var settings = {};

    return {
        
      /**
            <p>Sets the accuracy.  How similar the suggested terms at least 
            need to be compared to the original suggest text.</p>

            @member ejs.DirectSettingsMixin
            @param {Double} a A positive double value between 0 and 1.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      accuracy: function (a) {
        if (a == null) {
          return settings.accuracy;
        }
  
        settings.accuracy = a;
        return this;
      },
    
      /**
            <p>Sets the suggest mode.  Valid values are:</p>

            <dl>
              <dd><code>missing</code> - Only suggest terms in the suggest text that aren't in the index</dd>
              <dd><code>popular</code> - Only suggest suggestions that occur in more docs then the original suggest text term</dd>
              <dd><code>always</code> - Suggest any matching suggestions based on terms in the suggest text</dd> 
            </dl>

            @member ejs.DirectSettingsMixin
            @param {String} m The mode of missing, popular, or always.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      suggestMode: function (m) {
        if (m == null) {
          return settings.suggest_mode;
        }
  
        m = m.toLowerCase();
        if (m === 'missing' || m === 'popular' || m === 'always') {
          settings.suggest_mode = m;
        }
      
        return this;
      },
    
      /**
            <p>Sets the sort mode.  Valid values are:</p>

            <dl>
              <dd><code>score</code> - Sort by score first, then document frequency, and then the term itself</dd>
              <dd><code>frequency</code> - Sort by document frequency first, then simlarity score and then the term itself</dd>
            </dl>

            @member ejs.DirectSettingsMixin
            @param {String} s The score type of score or frequency.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      sort: function (s) {
        if (s == null) {
          return settings.sort;
        }
  
        s = s.toLowerCase();
        if (s === 'score' || s === 'frequency') {
          settings.sort = s;
        }
      
        return this;
      },
    
      /**
            <p>Sets what string distance implementation to use for comparing 
            how similar suggested terms are.  Valid values are:</p>

            <dl>
              <dd><code>internal</code> - based on damerau_levenshtein but but highly optimized for comparing string distance for terms inside the index</dd>
              <dd><code>damerau_levenshtein</code> - String distance algorithm based on Damerau-Levenshtein algorithm</dd>
              <dd><code>levenstein</code> - String distance algorithm based on Levenstein edit distance algorithm</dd>
              <dd><code>jarowinkler</code> - String distance algorithm based on Jaro-Winkler algorithm</dd>
              <dd><code>ngram</code> - String distance algorithm based on character n-grams</dd>
            </dl>

            @member ejs.DirectSettingsMixin
            @param {String} s The string distance algorithm name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      stringDistance: function (s) {
        if (s == null) {
          return settings.string_distance;
        }
  
        s = s.toLowerCase();
        if (s === 'internal' || s === 'damerau_levenshtein' || 
            s === 'levenstein' || s === 'jarowinkler' || s === 'ngram') {
          settings.string_distance = s;
        }
      
        return this;
      },
    
      /**
            <p>Sets the maximum edit distance candidate suggestions can have 
            in order to be considered as a suggestion.</p>

            @member ejs.DirectSettingsMixin
            @param {Integer} max An integer value greater than 0.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxEdits: function (max) {
        if (max == null) {
          return settings.max_edits;
        }
  
        settings.max_edits = max;
        return this;
      },
    
      /**
            <p>The factor that is used to multiply with the size in order 
            to inspect more candidate suggestions.</p>

            @member ejs.DirectSettingsMixin
            @param {Integer} max A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxInspections: function (max) {
        if (max == null) {
          return settings.max_inspections;
        }
  
        settings.max_inspections = max;
        return this;
      },
    
      /**
            <p>Sets a maximum threshold in number of documents a suggest text 
            token can exist in order to be corrected.</p>

            @member ejs.DirectSettingsMixin
            @param {Double} max A positive double value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxTermFreq: function (max) {
        if (max == null) {
          return settings.max_term_freq;
        }
  
        settings.max_term_freq = max;
        return this;
      },
    
      /**
            <p>Sets the number of minimal prefix characters that must match in 
            order be a candidate suggestion.</p>

            @member ejs.DirectSettingsMixin
            @param {Integer} len A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      prefixLength: function (len) {
        if (len == null) {
          return settings.prefix_length;
        }
  
        settings.prefix_length = len;
        return this;
      },
    
      /**
            <p>Sets the minimum length a suggest text term must have in order 
            to be corrected.</p>

            @member ejs.DirectSettingsMixin
            @param {Integer} len A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minWordLen: function (len) {
        if (len == null) {
          return settings.min_word_len;
        }
  
        settings.min_word_len = len;
        return this;
      },
    
      /**
            <p>Sets a minimal threshold of the number of documents a suggested 
            term should appear in.</p>

            @member ejs.DirectSettingsMixin
            @param {Double} min A positive double value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      minDocFreq: function (min) {
        if (min == null) {
          return settings.min_doc_freq;
        }
  
        settings.min_doc_freq = min;
        return this;
      },
  
      /**
            <p>Retrieves the internal <code>settings</code> object. This is typically used by
               internal API functions so use with caution.</p>

            @member ejs.DirectSettingsMixin
            @returns {String} returns this object's internal <code>settings</code> property.
            */
      _self: function () {
        return settings;
      }
    };
  };

  /**
    @class
    <p>PhraseSuggester extends the <code>PhraseSuggester</code> and suggests
    entire corrected phrases instead of individual tokens.  The individual
    phrase suggestions are weighted based on ngram-langugage models. In practice 
    it will be able to make better decision about which tokens to pick based on 
    co-occurence and frequencies.</p>

    @name ejs.PhraseSuggester

    @since elasticsearch 0.90
    
    @desc
    <p>A suggester that suggests entire corrected phrases.</p>

    @param {String} name The name which be used to refer to this suggester.
    */
  ejs.PhraseSuggester = function (name) {

    /**
        The internal suggest object.
        @member ejs.PhraseSuggester
        @property {Object} suggest
        */
    var suggest = {};
    suggest[name] = {phrase: {}};

    return {

      /**
            <p>Sets the text to get suggestions for.  If not set, the global
            suggestion text will be used.</p>

            @member ejs.PhraseSuggester
            @param {String} txt A string to get suggestions for.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      text: function (txt) {
        if (txt == null) {
          return suggest[name].text;
        }
    
        suggest[name].text = txt;
        return this;
      },

      /**
            <p>Sets analyzer used to analyze the suggest text.</p>

            @member ejs.PhraseSuggester
            @param {String} analyzer A valid analyzer name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      analyzer: function (analyzer) {
        if (analyzer == null) {
          return suggest[name].phrase.analyzer;
        }
    
        suggest[name].phrase.analyzer = analyzer;
        return this;
      },
      
      /**
            <p>Sets the field used to generate suggestions from.</p>

            @member ejs.PhraseSuggester
            @param {String} field A valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (field) {
        if (field == null) {
          return suggest[name].phrase.field;
        }
    
        suggest[name].phrase.field = field;
        return this;
      },
      
      /**
            <p>Sets the number of suggestions returned for each token.</p>

            @member ejs.PhraseSuggester
            @param {Integer} s A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      size: function (s) {
        if (s == null) {
          return suggest[name].phrase.size;
        }
    
        suggest[name].phrase.size = s;
        return this;
      },
      
      /**
            <p>Sets the maximum number of suggestions to be retrieved from 
            each individual shard.</p>

            @member ejs.PhraseSuggester
            @param {Integer} s A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      shardSize: function (s) {
        if (s == null) {
          return suggest[name].phrase.shard_size;
        }
    
        suggest[name].phrase.shard_size = s;
        return this;
      },
      
      /**
            <p>Sets the likelihood of a term being a misspelled even if the 
            term exists in the dictionary. The default it 0.95 corresponding 
            to 5% or the real words are misspelled.</p>

            @member ejs.PhraseSuggester
            @param {Double} l A positive double value greater than 0.0.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      realWorldErrorLikelihood: function (l) {
        if (l == null) {
          return suggest[name].phrase.real_world_error_likelihood;
        }
    
        suggest[name].phrase.real_world_error_likelihood = l;
        return this;
      },
      
      /**
            <p>Sets the confidence level defines a factor applied to the input 
            phrases score which is used as a threshold for other suggest 
            candidates. Only candidates that score higher than the threshold 
            will be included in the result.</p>

            @member ejs.PhraseSuggester
            @param {Double} c A positive double value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      confidence: function (c) {
        if (c == null) {
          return suggest[name].phrase.confidence;
        }
    
        suggest[name].phrase.confidence = c;
        return this;
      },
      
      /**
            <p>Sets the separator that is used to separate terms in the bigram 
            field. If not set the whitespce character is used as a 
            separator.</p>

            @member ejs.PhraseSuggester
            @param {String} sep A string separator.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      separator: function (sep) {
        if (sep == null) {
          return suggest[name].phrase.separator;
        }
    
        suggest[name].phrase.separator = sep;
        return this;
      },
      
      /**
            <p>Sets the maximum percentage of the terms that at most 
            considered to be misspellings in order to form a correction.</p>

            @member ejs.PhraseSuggester
            @param {Double} c A positive double value greater between 0 and 1.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      maxErrors: function (max) {
        if (max == null) {
          return suggest[name].phrase.max_errors;
        }
    
        suggest[name].phrase.max_errors = max;
        return this;
      },
      
      /**
            <p>Sets the max size of the n-grams (shingles) in the field. If 
            the field doesn't contain n-grams (shingles) this should be 
            omitted or set to 1.</p>

            @member ejs.PhraseSuggester
            @param {Integer} s A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      gramSize: function (s) {
        if (s == null) {
          return suggest[name].phrase.gram_size;
        }
    
        suggest[name].phrase.gram_size = s;
        return this;
      },
      
      /**
            <p>Forces the use of unigrams.</p>

            @member ejs.PhraseSuggester
            @param {Boolean} trueFalse True to force unigrams, false otherwise.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      forceUnigrams: function (trueFalse) {
        if (trueFalse == null) {
          return suggest[name].phrase.force_unigrams;
        }
    
        suggest[name].phrase.force_unigrams = trueFalse;
        return this;
      },
      
      /**
            <p>A smoothing model that takes the weighted mean of the unigrams, 
            bigrams and trigrams based on user supplied weights (lambdas). The
            sum of tl, bl, and ul must equal 1.</p>

            @member ejs.PhraseSuggester
            @param {Double} tl A positive double value used for trigram weight.
            @param {Double} bl A positive double value used for bigram weight.
            @param {Double} ul A positive double value used for unigram weight.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      linearSmoothing: function (tl, bl, ul) {
        if (arguments.length === 0) {
          return suggest[name].phrase.smoothing;
        }
    
        suggest[name].phrase.smoothing = {
          linear: {
            trigram_lambda: tl,
            bigram_lambda: bl,
            unigram_lambda: ul
          }
        };
        
        return this;
      },
      
      /**
            <p>A smoothing model that uses an additive smoothing model where a 
            constant (typically 1.0 or smaller) is added to all counts to 
            balance weights, The default alpha is 0.5.</p>

            @member ejs.PhraseSuggester
            @param {Double} alpha A double value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      laplaceSmoothing: function (alpha) {
        if (alpha == null) {
          return suggest[name].phrase.smoothing;
        }
    
        suggest[name].phrase.smoothing = {
          laplace: {
            alpha: alpha
          }
        };
        
        return this;
      },
      
      /**
            <p>A simple backoff model that backs off to lower order n-gram 
            models if the higher order count is 0 and discounts the lower 
            order n-gram model by a constant factor. The default discount is 
            0.4.</p>

            @member ejs.PhraseSuggester
            @param {Double} discount A double value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      stupidBackoffSmoothing: function (discount) {
        if (discount == null) {
          return suggest[name].phrase.smoothing;
        }
    
        suggest[name].phrase.smoothing = {
          stupid_backoff: {
            discount: discount
          }
        };
        
        return this;
      },
      
      /**
            Adds a direct generator. If passed a single <code>Generator</code>
            it is added to the list of existing generators.  If passed an 
            array of Generators, they replace all existing generators.

            @member ejs.PhraseSuggester
            @param {Generator || Array} oGenerator A valid Generator or 
              array of Generator objects.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      directGenerator: function (oGenerator) {
        var i, len;

        if (suggest[name].phrase.direct_generator == null) {
          suggest[name].phrase.direct_generator = [];
        }

        if (oGenerator == null) {
          return suggest[name].phrase.direct_generator;
        }

        if (isGenerator(oGenerator)) {
          suggest[name].phrase.direct_generator.push(oGenerator._self());
        } else if (isArray(oGenerator)) {
          suggest[name].phrase.direct_generator = [];
          for (i = 0, len = oGenerator.length; i < len; i++) {
            if (!isGenerator(oGenerator[i])) {
              throw new TypeError('Argument must be an array of Generators');
            }

            suggest[name].phrase.direct_generator.push(oGenerator[i]._self());
          }
        } else {
          throw new TypeError('Argument must be a Generator or array of Generators');
        }

        return this;
      },
        
      /**
            <p>Allows you to serialize this object into a JSON encoded string.</p>

            @member ejs.PhraseSuggester
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(suggest);
      },

      /**
            The type of ejs object.  For internal use only.
          
            @member ejs.PhraseSuggester
            @returns {String} the type of object
            */
      _type: function () {
        return 'suggest';
      },
    
      /**
            <p>Retrieves the internal <code>suggest</code> object. This is typically used by
               internal API functions so use with caution.</p>

            @member ejs.PhraseSuggester
            @returns {String} returns this object's internal <code>suggest</code> property.
            */
      _self: function () {
        return suggest;
      }
    };
  };

  /**
    @class
    <p>TermSuggester suggests terms based on edit distance. The provided suggest 
    text is analyzed before terms are suggested. The suggested terms are 
    provided per analyzed suggest text token.  This leaves the suggest-selection 
    to the API consumer.  For a higher level suggester, please use the 
    <code>PhraseSuggester</code>.</p>

    @name ejs.TermSuggester

    @since elasticsearch 0.90
    
    @desc
    <p>A suggester that suggests terms based on edit distance.</p>

    @borrows ejs.DirectSettingsMixin.accuracy as accuracy
    @borrows ejs.DirectSettingsMixin.suggestMode as suggestMode
    @borrows ejs.DirectSettingsMixin.sort as sort
    @borrows ejs.DirectSettingsMixin.stringDistance as stringDistance
    @borrows ejs.DirectSettingsMixin.maxEdits as maxEdits
    @borrows ejs.DirectSettingsMixin.maxInspections as maxInspections
    @borrows ejs.DirectSettingsMixin.maxTermFreq as maxTermFreq
    @borrows ejs.DirectSettingsMixin.prefixLength as prefixLength
    @borrows ejs.DirectSettingsMixin.minWordLen as minWordLen
    @borrows ejs.DirectSettingsMixin.minDocFreq as minDocFreq

    @param {String} name The name which be used to refer to this suggester.
    */
  ejs.TermSuggester = function (name) {

    /**
        The internal suggest object.
        @member ejs.TermSuggester
        @property {Object} suggest
        */
    var suggest = {},
  
    // common suggester options
    _common = ejs.DirectSettingsMixin();
    
    // setup correct term suggestor format
    suggest[name] = {term: _common._self()};

    return extend(_common, {

      /**
            <p>Sets the text to get suggestions for.  If not set, the global
            suggestion text will be used.</p>

            @member ejs.TermSuggester
            @param {String} txt A string to get suggestions for.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      text: function (txt) {
        if (txt == null) {
          return suggest[name].text;
        }
    
        suggest[name].text = txt;
        return this;
      },
    
      /**
            <p>Sets analyzer used to analyze the suggest text.</p>

            @member ejs.TermSuggester
            @param {String} analyzer A valid analyzer name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      analyzer: function (analyzer) {
        if (analyzer == null) {
          return suggest[name].term.analyzer;
        }
    
        suggest[name].term.analyzer = analyzer;
        return this;
      },
      
      /**
            <p>Sets the field used to generate suggestions from.</p>

            @member ejs.TermSuggester
            @param {String} field A valid field name.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      field: function (field) {
        if (field == null) {
          return suggest[name].term.field;
        }
    
        suggest[name].term.field = field;
        return this;
      },
      
      /**
            <p>Sets the number of suggestions returned for each token.</p>

            @member ejs.TermSuggester
            @param {Integer} s A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      size: function (s) {
        if (s == null) {
          return suggest[name].term.size;
        }
    
        suggest[name].term.size = s;
        return this;
      },
      
      /**
            <p>Sets the maximum number of suggestions to be retrieved from 
            each individual shard.</p>

            @member ejs.TermSuggester
            @param {Integer} s A positive integer value.
            @returns {Object} returns <code>this</code> so that calls can be chained.
            */
      shardSize: function (s) {
        if (s == null) {
          return suggest[name].term.shard_size;
        }
    
        suggest[name].term.shard_size = s;
        return this;
      },
      
      /**
            <p>Allows you to serialize this object into a JSON encoded string.</p>

            @member ejs.TermSuggester
            @returns {String} returns this object as a serialized JSON string.
            */
      toString: function () {
        return JSON.stringify(suggest);
      },

      /**
            The type of ejs object.  For internal use only.
          
            @member ejs.TermSuggester
            @returns {String} the type of object
            */
      _type: function () {
        return 'suggest';
      },
    
      /**
            <p>Retrieves the internal <code>suggest</code> object. This is typically used by
               internal API functions so use with caution.</p>

            @member ejs.TermSuggester
            @returns {String} returns this object's internal <code>suggest</code> property.
            */
      _self: function () {
        return suggest;
      }
    });
  };

  // run in noConflict mode
  ejs.noConflict = function () {
    root.ejs = _ejs;
    return this;
  };
  
}).call(this);
