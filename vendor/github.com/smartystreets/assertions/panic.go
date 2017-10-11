package assertions

import "fmt"

// ShouldPanic receives a void, niladic function and expects to recover a panic.
func ShouldPanic(actual interface{}, expected ...interface{}) (message string) {
	if fail := need(0, expected); fail != success {
		return fail
	}

	action, _ := actual.(func())

	if action == nil {
		message = shouldUseVoidNiladicFunction
		return
	}

	defer func() {
		recovered := recover()
		if recovered == nil {
			message = shouldHavePanicked
		} else {
			message = success
		}
	}()
	action()

	return
}

// ShouldNotPanic receives a void, niladic function and expects to execute the function without any panic.
func ShouldNotPanic(actual interface{}, expected ...interface{}) (message string) {
	if fail := need(0, expected); fail != success {
		return fail
	}

	action, _ := actual.(func())

	if action == nil {
		message = shouldUseVoidNiladicFunction
		return
	}

	defer func() {
		recovered := recover()
		if recovered != nil {
			message = fmt.Sprintf(shouldNotHavePanicked, recovered)
		} else {
			message = success
		}
	}()
	action()

	return
}

// ShouldPanicWith receives a void, niladic function and expects to recover a panic with the second argument as the content.
func ShouldPanicWith(actual interface{}, expected ...interface{}) (message string) {
	if fail := need(1, expected); fail != success {
		return fail
	}

	action, _ := actual.(func())

	if action == nil {
		message = shouldUseVoidNiladicFunction
		return
	}

	defer func() {
		recovered := recover()
		if recovered == nil {
			message = shouldHavePanicked
		} else {
			if equal := ShouldEqual(recovered, expected[0]); equal != success {
				message = serializer.serialize(expected[0], recovered, fmt.Sprintf(shouldHavePanickedWith, expected[0], recovered))
			} else {
				message = success
			}
		}
	}()
	action()

	return
}

// ShouldNotPanicWith receives a void, niladic function and expects to recover a panic whose content differs from the second argument.
func ShouldNotPanicWith(actual interface{}, expected ...interface{}) (message string) {
	if fail := need(1, expected); fail != success {
		return fail
	}

	action, _ := actual.(func())

	if action == nil {
		message = shouldUseVoidNiladicFunction
		return
	}

	defer func() {
		recovered := recover()
		if recovered == nil {
			message = success
		} else {
			if equal := ShouldEqual(recovered, expected[0]); equal == success {
				message = fmt.Sprintf(shouldNotHavePanickedWith, expected[0])
			} else {
				message = success
			}
		}
	}()
	action()

	return
}
