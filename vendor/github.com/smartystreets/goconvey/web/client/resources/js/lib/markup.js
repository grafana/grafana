/*
  Markup.js v1.5.21: http://github.com/adammark/Markup.js
  MIT License
  (c) 2011 - 2014 Adam Mark
*/
var Mark = {
    // Templates to include, by name. A template is a string.
    includes: {},

    // Global variables, by name. Global variables take precedence over context variables.
    globals: {},

    // The delimiter to use in pipe expressions, e.g. {{if color|like>red}}.
    delimiter: ">",

    // Collapse white space between HTML elements in the resulting string.
    compact: false,

    // Shallow-copy an object.
    _copy: function (a, b) {
        b = b || [];

        for (var i in a) {
            b[i] = a[i];
        }

        return b;
    },

    // Get the value of a number or size of an array. This is a helper function for several pipes.
    _size: function (a) {
        return a instanceof Array ? a.length : (a || 0);
    },

    // This object represents an iteration. It has an index and length.
    _iter: function (idx, size) {
        this.idx = idx;
        this.size = size;
        this.length = size;
        this.sign = "#";

        // Print the index if "#" or the count if "##".
        this.toString = function () {
            return this.idx + this.sign.length - 1;
        };
    },

    // Pass a value through a series of pipe expressions, e.g. _pipe(123, ["add>10","times>5"]).
    _pipe: function (val, expressions) {
        var expression, parts, fn, result;

        // If we have expressions, pull out the first one, e.g. "add>10".
        if ((expression = expressions.shift())) {

            // Split the expression into its component parts, e.g. ["add", "10"].
            parts = expression.split(this.delimiter);

            // Pull out the function name, e.g. "add".
            fn = parts.shift().trim();

            try {
                // Run the function, e.g. add(123, 10) ...
                result = Mark.pipes[fn].apply(null, [val].concat(parts));

                // ... then pipe again with remaining expressions.
                val = this._pipe(result, expressions);
            }
            catch (e) {
            }
        }

        // Return the piped value.
        return val;
    },

    // TODO doc
    _eval: function (context, filters, child) {
        var result = this._pipe(context, filters),
            ctx = result,
            i = -1,
            j,
            opts;

        if (result instanceof Array) {
            result = "";
            j = ctx.length;

            while (++i < j) {
                opts = {
                    iter: new this._iter(i, j)
                };
                result += child ? Mark.up(child, ctx[i], opts) : ctx[i];
            }
        }
        else if (result instanceof Object) {
            result = Mark.up(child, ctx);
        }

        return result;
    },

    // Process the contents of an IF or IF/ELSE block.
    _test: function (bool, child, context, options) {
        // Process the child string, then split it into the IF and ELSE parts.
        var str = Mark.up(child, context, options).split(/\{\{\s*else\s*\}\}/);

        // Return the IF or ELSE part. If no ELSE, return an empty string.
        return (bool === false ? str[1] : str[0]) || "";
    },

    // Determine the extent of a block expression, e.g. "{{foo}}...{{/foo}}"
    _bridge: function (tpl, tkn) {
        tkn = tkn == "." ? "\\." : tkn.replace(/\$/g, "\\$");

        var exp = "{{\\s*" + tkn + "([^/}]+\\w*)?}}|{{/" + tkn + "\\s*}}",
            re = new RegExp(exp, "g"),
            tags = tpl.match(re) || [],
            t,
            i,
            a = 0,
            b = 0,
            c = -1,
            d = 0;

        for (i = 0; i < tags.length; i++) {
            t = i;
            c = tpl.indexOf(tags[t], c + 1);

            if (tags[t].indexOf("{{/") > -1) {
                b++;
            }
            else {
                a++;
            }

            if (a === b) {
                break;
            }
        }

        a = tpl.indexOf(tags[0]);
        b = a + tags[0].length;
        d = c + tags[t].length;

        // Return the block, e.g. "{{foo}}bar{{/foo}}" and its child, e.g. "bar".
        return [tpl.substring(a, d), tpl.substring(b, c)];
    }
};

// Inject a template string with contextual data and return a new string.
Mark.up = function (template, context, options) {
    context = context || {};
    options = options || {};

    // Match all tags like "{{...}}".
    var re = /\{\{(.+?)\}\}/g,
        // All tags in the template.
        tags = template.match(re) || [],
        // The tag being evaluated, e.g. "{{hamster|dance}}".
        tag,
        // The expression to evaluate inside the tag, e.g. "hamster|dance".
        prop,
        // The token itself, e.g. "hamster".
        token,
        // An array of pipe expressions, e.g. ["more>1", "less>2"].
        filters = [],
        // Does the tag close itself? e.g. "{{stuff/}}".
        selfy,
        // Is the tag an "if" statement?
        testy,
        // The contents of a block tag, e.g. "{{aa}}bb{{/aa}}" -> "bb".
        child,
        // The resulting string.
        result,
        // The global variable being evaluated, or undefined.
        global,
        // The included template being evaluated, or undefined.
        include,
        // A placeholder variable.
        ctx,
        // Iterators.
        i = 0,
        j = 0;

    // Set custom pipes, if provided.
    if (options.pipes) {
        this._copy(options.pipes, this.pipes);
    }

    // Set templates to include, if provided.
    if (options.includes) {
        this._copy(options.includes, this.includes);
    }

    // Set global variables, if provided.
    if (options.globals) {
        this._copy(options.globals, this.globals);
    }

    // Optionally override the delimiter.
    if (options.delimiter) {
        this.delimiter = options.delimiter;
    }

    // Optionally collapse white space.
    if (options.compact !== undefined) {
        this.compact = options.compact;
    }

    // Loop through tags, e.g. {{a}}, {{b}}, {{c}}, {{/c}}.
    while ((tag = tags[i++])) {
        result = undefined;
        child = "";
        selfy = tag.indexOf("/}}") > -1;
        prop = tag.substr(2, tag.length - (selfy ? 5 : 4));
        prop = prop.replace(/`(.+?)`/g, function (s, p1) {
            return Mark.up("{{" + p1 + "}}", context);
        });
        testy = prop.trim().indexOf("if ") === 0;
        filters = prop.split("|");
        filters.shift(); // instead of splice(1)
        prop = prop.replace(/^\s*if/, "").split("|").shift().trim();
        token = testy ? "if" : prop.split("|")[0];
        ctx = context[prop];

        // If an "if" statement without filters, assume "{{if foo|notempty}}"
        if (testy && !filters.length) {
            filters = ["notempty"];
        }

        // Does the tag have a corresponding closing tag? If so, find it and move the cursor.
        if (!selfy && template.indexOf("{{/" + token) > -1) {
            result = this._bridge(template, token);
            tag = result[0];
            child = result[1];
            i += tag.match(re).length - 1; // fast forward
        }

        // Skip "else" tags. These are pulled out in _test().
        if (/^\{\{\s*else\s*\}\}$/.test(tag)) {
            continue;
        }

        // Evaluating a global variable.
        else if ((global = this.globals[prop]) !== undefined) {
            result = this._eval(global, filters, child);
        }

        // Evaluating an included template.
        else if ((include = this.includes[prop])) {
            if (include instanceof Function) {
                include = include();
            }
            result = this._pipe(Mark.up(include, context, options), filters);
        }

        // Evaluating a loop counter ("#" or "##").
        else if (prop.indexOf("#") > -1) {
            options.iter.sign = prop;
            result = this._pipe(options.iter, filters);
        }

        // Evaluating the current context.
        else if (prop === ".") {
            result = this._pipe(context, filters);
        }

        // Evaluating a variable with dot notation, e.g. "a.b.c"
        else if (prop.indexOf(".") > -1) {
            prop = prop.split(".");
            ctx = Mark.globals[prop[0]];

            if (ctx) {
                j = 1;
            }
            else {
                j = 0;
                ctx = context;
            }

            // Get the actual context
            while (ctx && j < prop.length) {
                ctx = ctx[prop[j++]];
            }

            result = this._eval(ctx, filters, child);
        }

        // Evaluating an "if" statement.
        else if (testy) {
            result = this._pipe(ctx, filters);
        }

        // Evaluating an array, which might be a block expression.
        else if (ctx instanceof Array) {
            result = this._eval(ctx, filters, child);
        }

        // Evaluating a block expression.
        else if (child) {
            result = ctx ? Mark.up(child, ctx) : undefined;
        }

        // Evaluating anything else.
        else if (context.hasOwnProperty(prop)) {
            result = this._pipe(ctx, filters);
        }

        // Evaluating special case: if the resulting context is actually an Array
        if (result instanceof Array) {
            result = this._eval(result, filters, child);
        }

        // Evaluating an "if" statement.
        if (testy) {
            result = this._test(result, child, context, options);
        }

        // Replace the tag, e.g. "{{name}}", with the result, e.g. "Adam".
        template = template.replace(tag, result === undefined ? "???" : result);
    }

    return this.compact ? template.replace(/>\s+</g, "><") : template;
};

// Freebie pipes. See usage in README.md
Mark.pipes = {
    empty: function (obj) {
        return !obj || (obj + "").trim().length === 0 ? obj : false;
    },
    notempty: function (obj) {
        return obj && (obj + "").trim().length ? obj : false;
    },
    blank: function (str, val) {
        return !!str || str === 0 ? str : val;
    },
    more: function (a, b) {
        return Mark._size(a) > b ? a : false;
    },
    less: function (a, b) {
        return Mark._size(a) < b ? a : false;
    },
    ormore: function (a, b) {
        return Mark._size(a) >= b ? a : false;
    },
    orless: function (a, b) {
        return Mark._size(a) <= b ? a : false;
    },
    between: function (a, b, c) {
        a = Mark._size(a);
        return a >= b && a <= c ? a : false;
    },
    equals: function (a, b) {
        return a == b ? a : false;
    },
    notequals: function (a, b) {
        return a != b ? a : false;
    },
    like: function (str, pattern) {
        return new RegExp(pattern, "i").test(str) ? str : false;
    },
    notlike: function (str, pattern) {
        return !Mark.pipes.like(str, pattern) ? str : false;
    },
    upcase: function (str) {
        return String(str).toUpperCase();
    },
    downcase: function (str) {
        return String(str).toLowerCase();
    },
    capcase: function (str) {
        return str.replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });
    },
    chop: function (str, n) {
        return str.length > n ? str.substr(0, n) + "..." : str;
    },
    tease: function (str, n) {
        var a = str.split(/\s+/);
        return a.slice(0, n).join(" ") + (a.length > n ? "..." : "");
    },
    trim: function (str) {
        return str.trim();
    },
    pack: function (str) {
        return str.trim().replace(/\s{2,}/g, " ");
    },
    round: function (num) {
        return Math.round(+num);
    },
    clean: function (str) {
        return String(str).replace(/<\/?[^>]+>/gi, "");
    },
    size: function (obj) {
        return obj.length;
    },
    length: function (obj) {
        return obj.length;
    },
    reverse: function (arr) {
        return [].concat(arr).reverse();
    },
    join: function (arr, separator) {
        return arr.join(separator);
    },
    limit: function (arr, count, idx) {
        return arr.slice(+idx || 0, +count + (+idx || 0));
    },
    split: function (str, separator) {
        return str.split(separator || ",");
    },
    choose: function (bool, iffy, elsy) {
        return !!bool ? iffy : (elsy || "");
    },
    toggle: function (obj, csv1, csv2, str) {
        return csv2.split(",")[csv1.match(/\w+/g).indexOf(obj + "")] || str;
    },
    sort: function (arr, prop) {
        var fn = function (a, b) {
            return a[prop] > b[prop] ? 1 : -1;
        };
        return [].concat(arr).sort(prop ? fn : undefined);
    },
    fix: function (num, n) {
        return (+num).toFixed(n);
    },
    mod: function (num, n) {
        return (+num) % (+n);
    },
    divisible: function (num, n) {
        return num && (+num % n) === 0 ? num : false;
    },
    even: function (num) {
        return num && (+num & 1) === 0 ? num : false;
    },
    odd: function (num) {
        return num && (+num & 1) === 1 ? num : false;
    },
    number: function (str) {
        return parseFloat(str.replace(/[^\-\d\.]/g, ""));
    },
    url: function (str) {
        return encodeURI(str);
    },
    bool: function (obj) {
        return !!obj;
    },
    falsy: function (obj) {
        return !obj;
    },
    first: function (iter) {
        return iter.idx === 0;
    },
    last: function (iter) {
        return iter.idx === iter.size - 1;
    },
    call: function (obj, fn) {
        return obj[fn].apply(obj, [].slice.call(arguments, 2));
    },
    set: function (obj, key) {
        Mark.globals[key] = obj; return "";
    },
    log: function (obj) {
        console.log(obj);
        return obj;
    }
};

// Shim for IE.
if (typeof String.prototype.trim !== "function") {
    String.prototype.trim = function() {
        return this.replace(/^\s+|\s+$/g, ""); 
    }
}

// Export for Node.js and AMD.
if (typeof module !== "undefined" && module.exports) {
    module.exports = Mark;
}
else if (typeof define === "function" && define.amd) {
    define(function() {
        return Mark;
    });
}
