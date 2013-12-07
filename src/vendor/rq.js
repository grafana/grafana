/*
    rq.js

    Douglas Crockford
    2013-10-11
    Public Domain

This package uses four kinds of functions:
    requestor
    requestion
    quash
    requestory


requestor(requestion [, initial])
    may return a quash function

    A requestor is a function that makes a request. Such a request need not
    be satisified immediately. It is likely that the request will not be
    satisified until some future turn. Requestors provide a means of dealing
    with future activities without blocking.

    A requestor is a function that takes a requestion function as its first
    parameter, and optionally an initial value as its second parameter. The
    requestor uses the requestion to report its result. A requestor may
    optionally return a quash function that might be used to cancel the
    request, triggering the requestion function with a failure result.

    The initial parameter contains a value that may be used to initialize the
    request. It is provided specifically for RQ.sequence, but it may be passed
    to any requestor.


requestion(success, failure)
    returns undefined

    A requestion function is a continuation or callback. It is used to deliver
    the result of a request. A requestion takes two arguments: success and
    failure. If the request succeeds, then the result will be passed to the
    requestion function as the success parameter, and the failure parameter
    will be undefined. If the request fails, then the requestion function will
    be passed the reason as the failure parameter. If failure is undefined,
    then the request succeeded. If failure is any other value, then the request
    failed.


quash(reason)
    returns undefined

    If a request is likely to be expensive to satisfy, the requestor may
    optionally return a quash function that would allow the request to be
    cancelled. A requestor is not required to return a quash function, and
    the quash function will not be guaranteed to cancel the request. The
    quash's reason argument may become the requestion's failure argument.


requestory([arguments])
    returns a requestor function

    A requestory is a factory function that produces a requestor function. A
    requestory function will usually take parameters that will customize or
    specialize a request. It is possible to write requestor functions by hand,
    but it is usually easier to generate them with requestories.


The RQ object contains some requestory functions that permit the composition of
requestors:

    RQ.fallback(requestors, milliseconds)
    RQ.race(requestors, milliseconds)
    RQ.parallel(requestors, optionals, milliseconds, tilliseconds)
    RQ.sequence(requestors, milliseconds)

Each of these four requestory functions returns a requestor function that
returns a quash function.


RQ.fallback(requestors, milliseconds)

    RQ.fallback returns a requestor function that will call the first element
    in the requestors array. If that is ultimately successful, its value will
    be passed to the requestion. But if it fails, the next element will be
    called, and so on. If none of the elements are successful, then the
    fallback fails. If any succeeds, then the fallback succeeds.

    If the optional milliseconds argument is supplied, then if a request is not
    successful in the allotted time, then the fallback fails, and the pending
    requestor is cancelled.


RQ.race(requestors [, milliseconds])

    RQ.race returns a requestor that starts all of the functions in the
    requestors array in parallel. Its result is the result of the first of
    those requestors to successfully finish (all of the other requestors are
    cancelled). If all of those requestors fail, then the race fails.

    If the optional milliseconds argument is supplied, then if no requestor has
    been successful in the allotted time, then the race fails, and all pending
    requestors are cancelled.


RQ.parallel(requestors [, milliseconds])
RQ.parallel(requestors, optionals [, milliseconds, [tilliseconds]])

    RQ.parallel returns a requestor that processes many requestors in parallel,
    producing an array of all of the successful results. It can take two arrays
    of requests: Those that are required to produce results, and those that may
    optionally produce results. Each of the optional requestors has until all
    of the required requestors have finished, or until the optional
    tilliseconds timer has expired.

    The result maps the requestors and optionals into a single array. The
    value produced by the first element of the requestors array provides the
    first element of the result.

    If the optional milliseconds argument is supplied, then if all of the
    required requestors are not successful in the allotted time, then the
    parallel fails. If there are no required requestors, and if at least one
    optional requestor is successful within the allotted time, then the
    parallel succeeds.


RQ.sequence(requestors [, milliseconds])

    RQ.sequence returns a requestor that processes each element of the
    requestors array one at a time. Each will be passed the result of the
    previous. If all succeed, then the sequence succeeds, having the result of
    the last of the requestors. If any fail, then the sequence fails.

    If the optional milliseconds argument is supplied, then if all of the
    requestors have not all completed in the allotted time, then the sequence
    fails and the pending requestor is cancelled.
*/

/*global
    clearTimeout, setImmediate, setTimeout
*/

/*properties
    array, evidence, fallback, freeze, forEach, index, isArray, length,
    message, method, milliseconds, name, parallel, race, sequence, value
*/

var RQ = (function () {
    'use strict';

    function expired(method, milliseconds) {

// Make an expired exception.

        return {
            name: "expired",
            method: method,
            message: "expired after " + milliseconds,
            milliseconds: milliseconds
        };
    }

    function check(method, requestors, milliseconds, optionals, tilliseconds) {

// Verify that the arguments are typed properly.

        function is_function(value, index, array) {
            if (typeof value !== 'function') {
                var e = new TypeError("not a function");
                e.array = array;
                e.index = index;
                e.method = method;
                e.value = value;
                throw e;
            }
        }

// requestors must be an array of functions, and it may be empty only if
// optionals is present.

        if (optionals === undefined) {
            if (!Array.isArray(requestors) || requestors.length === 0) {
                throw new TypeError(method + " requestors");
            }
        } else {
            if (requestors && !Array.isArray(requestors)) {
                throw new TypeError(method + " requestors");
            }
            if (!Array.isArray(optionals) || optionals.length === 0) {
                throw new TypeError(method + " optionals");
            }
            optionals.forEach(is_function);
        }
        requestors.forEach(is_function);
        if (milliseconds &&
                (typeof milliseconds !== 'number' || milliseconds < 0)) {
            throw new TypeError(method + " milliseconds");
        }
        if (tilliseconds &&
                (typeof tilliseconds !== 'number' || tilliseconds < 0)) {
            throw new TypeError(method + " tilliseconds");
        }
    }

    function check_requestion(method, requestion, initial) {
        if (typeof requestion !== 'function') {
            throw new TypeError(method + " requestion");
        }
        if (initial !== null && typeof initial === 'object') {
            Object.freeze(initial);
        }
    }

    return {
        fallback : function fallback(requestors, milliseconds) {

// RQ.fallback takes an array of requestor functions, and returns a requestor
// that will call them each in order until it finds a successful outcome.

// If all of the requestor functions fail, then the fallback fails. If the time
// expires, then work in progress is cancelled.

            check("RQ.fallack", requestors, milliseconds);
            return function requestor(requestion, initial) {
                var cancel,
                    timeout_id;

                function finish(success, failure) {
                    var r = requestion;
                    cancel = null;
                    if (r) {
                        if (timeout_id) {
                            clearTimeout(timeout_id);
                        }
                        requestion = null;
                        timeout_id = null;
                        return r(success, failure);
                    }
                }

                function quash(reason) {
                    if (requestion && typeof cancel === 'function') {
                        setImmediate(cancel, reason);
                    }
                    return finish(undefined, reason || true);
                }

                check_requestion("RQ.fallack", requestion, initial);
                if (milliseconds) {
                    timeout_id = setTimeout(function () {
                        return quash(expired("RQ.fallback", milliseconds));
                    }, milliseconds);
                }
                (function next(index, failure) {
                    if (typeof requestion === 'function') {

// If there are no more requestors, then signal failure.

                        if (index >= requestors.length) {
                            clearTimeout(timeout_id);
                            cancel = null;
                            return quash(failure);
                        }

// If there is another requestor, call it in the next turn, passing the value
// and a requestion that will take the next step.

                        var requestor = requestors[index];
                        setImmediate(function () {
                            var once = true;
                            if (typeof requestion === 'function') {
                                cancel = requestor(
                                    function requestion(success, failure) {
                                        if (once) {
                                            once = false;
                                            cancel = null;
                                            return failure === undefined
                                                ? finish(success)
                                                : next(index + 1, failure);
                                        }
                                    },
                                    initial
                                );
                            }
                        });
                    }
                }(0));
                return quash;
            };
        },
        parallel: function parallel(requestors, optionals, milliseconds,
                tilliseconds) {

// RQ.parallel takes an array of requestors, and an optional second array of
// requestors, and starts them all. It succeeds if all of the requestors in
// the first array finish successfully before the time expires. The result
// is an array collecting the results of all of the requestors.

            if (typeof optionals === 'number') {
                milliseconds = optionals;
                tilliseconds = undefined;
                optionals = undefined;
            }
            check("RQ.parallel", requestors, milliseconds, optionals,
                tilliseconds);

            return function requestor(requestion, initial) {
                var quashes = [],
                    optionals_remaining,
                    optionals_successes = 0,
                    requestors_length = requestors.length,
                    requestors_remaining = requestors.length,
                    results = [],
                    timeout_till,
                    timeout_id;

                function finish(success, failure) {
                    var r = requestion;
                    if (r) {
                        requestion = null;
                        if (timeout_id) {
                            clearTimeout(timeout_id);
                            timeout_id = null;
                        }
                        if (timeout_till) {
                            clearTimeout(timeout_till);
                            timeout_till = null;
                        }
                        quashes.forEach(function (quash) {
                            if (typeof quash === 'function') {
                                return setImmediate(quash, failure);
                            }
                        });
                        quashes = null;
                        results = null;
                        return r(success, failure);
                    }
                }

                function quash(reason) {
                    return finish(undefined, reason || true);
                }

                check_requestion("RQ.parallel", requestion, initial);

// milliseconds, if specified, says take no longer to process this request. If
// any of the required requestors are not successful by this time, the parallel
// requestor fails.

                if (milliseconds) {
                    timeout_id = setTimeout(function () {
                        timeout_id = null;
                        return requestors_remaining === 0 &&
                                (requestors_length > 0 ||
                                optionals_successes > 0)
                            ? finish(results)
                            : quash(expired("RQ.parallel", milliseconds));
                    }, milliseconds);

// tilliseconds, if specified, gives more time for the optional requestors to
// complete. Normally, the optional requestors have until all of the required
// requestors finish. If tilliseconds is larger than milliseconds, milliseconds
// wins.

                }
                if (tilliseconds) {
                    timeout_till = setTimeout(function () {
                        timeout_till = null;
                        if (requestors_remaining === 0) {
                            return finish(results);
                        }
                    }, tilliseconds);
                }
                if (requestors) {
                    requestors.forEach(function (requestor, index) {
                        return setImmediate(function () {
                            var once = true, cancel = requestor(
                                function requestion(success, failure) {
                                    if (once && quashes) {
                                        once = false;
                                        quashes[index] = null;
                                        if (failure !== undefined) {
                                            return quash(failure);
                                        }
                                        results[index] = success;
                                        requestors_remaining -= 1;
                                        if (requestors_remaining === 0 &&
                                                !timeout_till) {
                                            return finish(results);
                                        }
                                    }
                                },
                                initial
                            );
                            if (quashes && quashes[index] === undefined) {
                                quashes[index] = cancel;
                            }
                        });
                    });
                }
                if (optionals) {
                    optionals_remaining = optionals.length;
                    optionals.forEach(function (requestor, index) {
                        return setImmediate(function () {
                            var once = true, cancel = requestor(
                                function requestion(success, failure) {
                                    if (once && quashes) {
                                        once = false;
                                        quashes[requestors_length + index]
                                            = null;
                                        if (failure === undefined) {
                                            results[requestors_length + index]
                                                = success;
                                            optionals_successes += 1;
                                        }
                                        optionals_remaining -= 1;
                                        if (optionals_remaining === 0) {
                                            if (requestors_remaining === 0) {
                                                return requestors_length > 0 ||
                                                        optionals_successes > 0
                                                    ? finish(results)
                                                    : quash(failure);
                                            }
                                            if (timeout_till) {
                                                clearTimeout(timeout_till);
                                                timeout_till = null;
                                            }
                                        }
                                    }
                                },
                                initial
                            );
                            if (quashes[requestors_length + index] ===
                                    undefined) {
                                quashes[requestors_length + index] = cancel;
                            }
                        });
                    });
                }
                return quash;
            };
        },
        race: function race(requestors, milliseconds) {

// RQ.race takes an array of requestor functions. It starts them all
// immediately. The first to finish wins. A race is successful if any
// contestant is successful. It fails if all requestors fail or if the time
// expires.

            check("RQ.race", requestors, milliseconds);
            return function requestor(requestion, initial) {
                var quashes = [],
                    remaining = requestors.length,
                    timeout_id;

                function finish(success, failure) {
                    var r = requestion;
                    if (r) {
                        requestion = null;
                        if (timeout_id) {
                            clearTimeout(timeout_id);
                        }
                        quashes.forEach(function stop(quash) {
                            if (typeof quash === 'function') {
                                return setImmediate(quash);
                            }
                        });
                        quashes = null;
                        return r(success, failure);
                    }
                }

                function quash(reason) {
                    return finish(undefined, reason || true);
                }

                check_requestion("RQ.race", requestion, initial);
                if (milliseconds) {
                    timeout_id = setTimeout(function timeout_id() {
                        return quash(expired("RQ.race", milliseconds));
                    }, milliseconds);
                }
                requestors.forEach(function (requestor, index) {
                    return setImmediate(function () {
                        var once = true, cancel = requestor(
                            function requestion(success, failure) {
                                if (once && quashes) {
                                    once = false;
                                    quashes[index] = null;
                                    if (failure === undefined) {
                                        return finish(success);
                                    }
                                    remaining -= 1;
                                    if (remaining === 0) {
                                        return quash(failure);
                                    }
                                }
                            },
                            initial
                        );
                        if (quashes[index] === undefined) {
                            quashes[index] = cancel;
                        }
                    });
                });
                return quash;
            };
        },
        sequence: function sequence(requestors, milliseconds) {

// RQ.sequence takes an array of requestor functions, and returns a requestor
// that will call them each in order. An initial value is passed to each, which
// is the previous success result.

// If any of the requestor functions fail, then the whole sequence fails, and
// the remaining requestors are not called.

            check("RQ.sequence", requestors, milliseconds);
            return function requestor(requestion, initial) {
                var cancel,
                    timeout_id;

                function finish(success, failure) {
                    var r = requestion;
                    cancel = null;
                    if (r) {
                        if (timeout_id) {
                            clearTimeout(timeout_id);
                        }
                        requestion = null;
                        return r(success, failure);
                    }
                }

                function quash(reason) {
                    if (requestion && typeof cancel === 'function') {
                        setImmediate(cancel, reason);
                    }
                    return finish(undefined, reason || true);
                }

                check_requestion("RQ.sequence", requestion, initial);
                if (milliseconds) {
                    timeout_id = setTimeout(function () {
                        timeout_id = null;
                        return quash(expired("RQ.sequence", milliseconds));
                    }, milliseconds);
                }
                (function next(index) {
                    var requestor, r = requestion;
                    if (typeof r === 'function') {

// If there are no more requestors, then signal success.

                        if (index >= requestors.length) {
                            if (timeout_id) {
                                clearTimeout(timeout_id);
                            }
                            requestion = null;
                            cancel = null;
                            return r(initial);
                        }

// If there is another requestor, call it in the next turn, passing the value
// and a requestion that will take the next step.

                        requestor = requestors[index];
                        setImmediate(function () {
                            var once = true;
                            cancel = requestor(
                                function requestion(success, failure) {
                                    if (once) {
                                        once = false;
                                        cancel = null;
                                        if (failure !== undefined) {
                                            return quash(failure);
                                        }
                                        initial = success;
                                        return next(index + 1);
                                    }
                                },
                                initial
                            );
                        });
                    }
                }(0));
                return quash;
            };
        }
    };
}());