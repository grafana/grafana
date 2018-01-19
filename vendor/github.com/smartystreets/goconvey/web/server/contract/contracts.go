package contract

import "net/http"

type (
	Server interface {
		ReceiveUpdate(root string, update *CompleteOutput)
		Watch(writer http.ResponseWriter, request *http.Request)
		Ignore(writer http.ResponseWriter, request *http.Request)
		Reinstate(writer http.ResponseWriter, request *http.Request)
		Status(writer http.ResponseWriter, request *http.Request)
		LongPollStatus(writer http.ResponseWriter, request *http.Request)
		Results(writer http.ResponseWriter, request *http.Request)
		Execute(writer http.ResponseWriter, request *http.Request)
		TogglePause(writer http.ResponseWriter, request *http.Request)
	}

	Executor interface {
		ExecuteTests([]*Package) *CompleteOutput
		Status() string
		ClearStatusFlag() bool
	}

	Shell interface {
		GoTest(directory, packageName string, tags, arguments []string) (output string, err error)
	}
)
