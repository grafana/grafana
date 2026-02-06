// Package level implements leveled logging on top of Go kit's log package. To
// use the level package, create a logger as per normal in your func main, and
// wrap it with level.NewFilter.
//
//    var logger log.Logger
//    logger = log.NewLogfmtLogger(os.Stderr)
//    logger = level.NewFilter(logger, level.AllowInfo()) // <--
//    logger = log.With(logger, "ts", log.DefaultTimestampUTC)
//
// It's also possible to configure log level from a string. For instance from
// a flag, environment variable or configuration file.
//
//    fs := flag.NewFlagSet("myprogram")
//    lvl := fs.String("log", "info", "debug, info, warn, error")
//
//    var logger log.Logger
//    logger = log.NewLogfmtLogger(os.Stderr)
//    logger = level.NewFilter(logger, level.Allow(level.ParseDefault(*lvl, level.InfoValue()))) // <--
//    logger = log.With(logger, "ts", log.DefaultTimestampUTC)
//
// Then, at the callsites, use one of the level.Debug, Info, Warn, or Error
// helper methods to emit leveled log events.
//
//    logger.Log("foo", "bar") // as normal, no level
//    level.Debug(logger).Log("request_id", reqID, "trace_data", trace.Get())
//    if value > 100 {
//        level.Error(logger).Log("value", value)
//    }
//
// NewFilter allows precise control over what happens when a log event is
// emitted without a level key, or if a squelched level is used. Check the
// Option functions for details.
package level
