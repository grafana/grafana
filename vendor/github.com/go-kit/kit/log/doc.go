// Package log provides a structured logger.
//
// Structured logging produces logs easily consumed later by humans or
// machines. Humans might be interested in debugging errors, or tracing
// specific requests. Machines might be interested in counting interesting
// events, or aggregating information for off-line processing. In both cases,
// it is important that the log messages are structured and actionable.
// Package log is designed to encourage both of these best practices.
//
// Basic Usage
//
// The fundamental interface is Logger. Loggers create log events from
// key/value data. The Logger interface has a single method, Log, which
// accepts a sequence of alternating key/value pairs, which this package names
// keyvals.
//
//    type Logger interface {
//        Log(keyvals ...interface{}) error
//    }
//
// Here is an example of a function using a Logger to create log events.
//
//    func RunTask(task Task, logger log.Logger) string {
//        logger.Log("taskID", task.ID, "event", "starting task")
//        ...
//        logger.Log("taskID", task.ID, "event", "task complete")
//    }
//
// The keys in the above example are "taskID" and "event". The values are
// task.ID, "starting task", and "task complete". Every key is followed
// immediately by its value.
//
// Keys are usually plain strings. Values may be any type that has a sensible
// encoding in the chosen log format. With structured logging it is a good
// idea to log simple values without formatting them. This practice allows
// the chosen logger to encode values in the most appropriate way.
//
// Contextual Loggers
//
// A contextual logger stores keyvals that it includes in all log events.
// Building appropriate contextual loggers reduces repetition and aids
// consistency in the resulting log output. With and WithPrefix add context to
// a logger. We can use With to improve the RunTask example.
//
//    func RunTask(task Task, logger log.Logger) string {
//        logger = log.With(logger, "taskID", task.ID)
//        logger.Log("event", "starting task")
//        ...
//        taskHelper(task.Cmd, logger)
//        ...
//        logger.Log("event", "task complete")
//    }
//
// The improved version emits the same log events as the original for the
// first and last calls to Log. Passing the contextual logger to taskHelper
// enables each log event created by taskHelper to include the task.ID even
// though taskHelper does not have access to that value. Using contextual
// loggers this way simplifies producing log output that enables tracing the
// life cycle of individual tasks. (See the Contextual example for the full
// code of the above snippet.)
//
// Dynamic Contextual Values
//
// A Valuer function stored in a contextual logger generates a new value each
// time an event is logged. The Valuer example demonstrates how this feature
// works.
//
// Valuers provide the basis for consistently logging timestamps and source
// code location. The log package defines several valuers for that purpose.
// See Timestamp, DefaultTimestamp, DefaultTimestampUTC, Caller, and
// DefaultCaller. A common logger initialization sequence that ensures all log
// entries contain a timestamp and source location looks like this:
//
//    logger := log.NewLogfmtLogger(log.NewSyncWriter(os.Stdout))
//    logger = log.With(logger, "ts", log.DefaultTimestampUTC, "caller", log.DefaultCaller)
//
// Concurrent Safety
//
// Applications with multiple goroutines want each log event written to the
// same logger to remain separate from other log events. Package log provides
// two simple solutions for concurrent safe logging.
//
// NewSyncWriter wraps an io.Writer and serializes each call to its Write
// method. Using a SyncWriter has the benefit that the smallest practical
// portion of the logging logic is performed within a mutex, but it requires
// the formatting Logger to make only one call to Write per log event.
//
// NewSyncLogger wraps any Logger and serializes each call to its Log method.
// Using a SyncLogger has the benefit that it guarantees each log event is
// handled atomically within the wrapped logger, but it typically serializes
// both the formatting and output logic. Use a SyncLogger if the formatting
// logger may perform multiple writes per log event.
//
// Error Handling
//
// This package relies on the practice of wrapping or decorating loggers with
// other loggers to provide composable pieces of functionality. It also means
// that Logger.Log must return an error because some
// implementations—especially those that output log data to an io.Writer—may
// encounter errors that cannot be handled locally. This in turn means that
// Loggers that wrap other loggers should return errors from the wrapped
// logger up the stack.
//
// Fortunately, the decorator pattern also provides a way to avoid the
// necessity to check for errors every time an application calls Logger.Log.
// An application required to panic whenever its Logger encounters
// an error could initialize its logger as follows.
//
//    fmtlogger := log.NewLogfmtLogger(log.NewSyncWriter(os.Stdout))
//    logger := log.LoggerFunc(func(keyvals ...interface{}) error {
//        if err := fmtlogger.Log(keyvals...); err != nil {
//            panic(err)
//        }
//        return nil
//    })
package log
