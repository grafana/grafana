package convey

import (
	"reflect"
	"testing"
)

func expectPanic(t *testing.T, f string) interface{} {
	r := recover()
	if r != nil {
		if cp, ok := r.(*conveyErr); ok {
			if cp.fmt != f {
				t.Error("Incorrect panic message.")
			}
		} else {
			t.Errorf("Incorrect panic type. %s", reflect.TypeOf(r))
		}
	} else {
		t.Error("Expected panic but none occured")
	}
	return r
}

func TestMissingTopLevelGoTestReferenceCausesPanic(t *testing.T) {
	output := map[string]bool{}

	defer expectEqual(t, false, output["good"])
	defer expectPanic(t, missingGoTest)

	Convey("Hi", func() {
		output["bad"] = true // this shouldn't happen
	})
}

func requireGoTestReference(t *testing.T) {
	err := recover()
	if err == nil {
		t.Error("We should have recovered a panic here (because of a missing *testing.T reference)!")
	} else {
		expectEqual(t, missingGoTest, err)
	}
}

func TestMissingTopLevelGoTestReferenceAfterGoodExample(t *testing.T) {
	output := map[string]bool{}

	defer func() {
		expectEqual(t, true, output["good"])
		expectEqual(t, false, output["bad"])
	}()
	defer expectPanic(t, missingGoTest)

	Convey("Good example", t, func() {
		output["good"] = true
	})

	Convey("Bad example", func() {
		output["bad"] = true // shouldn't happen
	})
}

func TestExtraReferencePanics(t *testing.T) {
	output := map[string]bool{}

	defer expectEqual(t, false, output["bad"])
	defer expectPanic(t, extraGoTest)

	Convey("Good example", t, func() {
		Convey("Bad example - passing in *testing.T a second time!", t, func() {
			output["bad"] = true // shouldn't happen
		})
	})
}

func TestParseRegistrationMissingRequiredElements(t *testing.T) {
	defer expectPanic(t, parseError)

	Convey()
}

func TestParseRegistration_MissingNameString(t *testing.T) {
	defer expectPanic(t, parseError)

	Convey(func() {})
}

func TestParseRegistration_MissingActionFunc(t *testing.T) {
	defer expectPanic(t, parseError)

	Convey("Hi there", 12345)
}

func TestFailureModeNoContext(t *testing.T) {
	Convey("Foo", t, func() {
		done := make(chan int, 1)
		go func() {
			defer func() { done <- 1 }()
			defer expectPanic(t, noStackContext)
			So(len("I have no context"), ShouldBeGreaterThan, 0)
		}()
		<-done
	})
}

func TestFailureModeDuplicateSuite(t *testing.T) {
	Convey("cool", t, func() {
		defer expectPanic(t, multipleIdenticalConvey)

		Convey("dup", nil)
		Convey("dup", nil)
	})
}

func TestFailureModeIndeterminentSuiteNames(t *testing.T) {
	defer expectPanic(t, differentConveySituations)

	name := "bob"
	Convey("cool", t, func() {
		for i := 0; i < 3; i++ {
			Convey(name, func() {})
			name += "bob"
		}
	})
}

func TestFailureModeNestedIndeterminentSuiteNames(t *testing.T) {
	defer expectPanic(t, differentConveySituations)

	name := "bob"
	Convey("cool", t, func() {
		Convey("inner", func() {
			for i := 0; i < 3; i++ {
				Convey(name, func() {})
				name += "bob"
			}
		})
	})
}

func TestFailureModeParameterButMissing(t *testing.T) {
	defer expectPanic(t, parseError)

	prepare()

	Convey("Foobar", t, FailureHalts)
}

func TestFailureModeParameterWithAction(t *testing.T) {
	prepare()

	Convey("Foobar", t, FailureHalts, func() {})
}

func TestExtraConveyParameters(t *testing.T) {
	defer expectPanic(t, parseError)

	prepare()

	Convey("Foobar", t, FailureHalts, func() {}, "This is not supposed to be here")
}

func TestExtraConveyParameters2(t *testing.T) {
	defer expectPanic(t, parseError)

	prepare()

	Convey("Foobar", t, func() {}, "This is not supposed to be here")
}

func TestExtraConveyParameters3(t *testing.T) {
	defer expectPanic(t, parseError)

	output := prepare()

	Convey("A", t, func() {
		output += "A "

		Convey("B", func() {
			output += "B "
		}, "This is not supposed to be here")
	})

	expectEqual(t, "A ", output)
}
