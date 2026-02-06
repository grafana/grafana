package util

import (
	"github.com/stretchr/testify/mock"
)

type ExtendedMock struct {
	mock.Mock
}

func (m *ExtendedMock) GetMockedCallsByMethod(method string) []mock.Call {
	calls := make([]mock.Call, 0)

	for _, call := range m.Calls {
		if call.Method == method {
			calls = append(calls, call)
		}
	}

	return calls
}
