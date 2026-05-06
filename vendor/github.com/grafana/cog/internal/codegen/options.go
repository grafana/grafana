package codegen

import (
	"fmt"
)

func StdoutReporter(msg string) {
	fmt.Println(msg)
}

func Parameters(extraParameters map[string]string) PipelineOption {
	return func(pipeline *Pipeline) {
		for key, value := range extraParameters {
			pipeline.Parameters[key] = value
		}

		pipeline.interpolateParameters()
	}
}

func Reporter(reporter ProgressReporter) PipelineOption {
	return func(pipeline *Pipeline) {
		pipeline.reporter = reporter
	}
}
