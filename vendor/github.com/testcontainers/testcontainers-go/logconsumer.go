package testcontainers

// StdoutLog is the log type for STDOUT
const StdoutLog = "STDOUT"

// StderrLog is the log type for STDERR
const StderrLog = "STDERR"

// logStruct {

// Log represents a message that was created by a process,
// LogType is either "STDOUT" or "STDERR",
// Content is the byte contents of the message itself
type Log struct {
	LogType string
	Content []byte
}

// }

// logConsumerInterface {

// LogConsumer represents any object that can
// handle a Log, it is up to the LogConsumer instance
// what to do with the log
type LogConsumer interface {
	Accept(Log)
}

// }

// LogConsumerConfig is a configuration object for the producer/consumer pattern
type LogConsumerConfig struct {
	Opts      []LogProductionOption // options for the production of logs
	Consumers []LogConsumer         // consumers for the logs
}
