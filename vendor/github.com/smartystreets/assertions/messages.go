package assertions

const (
	shouldHaveBeenEqual              = "Expected: '%v'\nActual:   '%v'\n(Should be equal)"
	shouldHaveBeenEqualNoResemblance = "Both the actual and expected values render equally ('%s') and their types are the same. Try using ShouldResemble instead."
	shouldNotHaveBeenEqual           = "Expected     '%v'\nto NOT equal '%v'\n(but it did)!"
	shouldHaveBeenEqualTypeMismatch  = "Expected: '%v' (%T)\nActual:   '%v' (%T)\n(Should be equal, type mismatch)"

	shouldHaveBeenAlmostEqual    = "Expected '%v' to almost equal '%v' (but it didn't)!"
	shouldHaveNotBeenAlmostEqual = "Expected '%v' to NOT almost equal '%v' (but it did)!"

	shouldHaveResembled    = "Expected: '%s'\nActual:   '%s'\n(Should resemble)!"
	shouldNotHaveResembled = "Expected        '%#v'\nto NOT resemble '%#v'\n(but it did)!"

	shouldBePointers            = "Both arguments should be pointers "
	shouldHaveBeenNonNilPointer = shouldBePointers + "(the %s was %s)!"
	shouldHavePointedTo         = "Expected '%+v' (address: '%v') and '%+v' (address: '%v') to be the same address (but their weren't)!"
	shouldNotHavePointedTo      = "Expected '%+v' and '%+v' to be different references (but they matched: '%v')!"

	shouldHaveBeenNil    = "Expected: nil\nActual:   '%v'"
	shouldNotHaveBeenNil = "Expected '%+v' to NOT be nil (but it was)!"

	shouldHaveBeenTrue  = "Expected: true\nActual:   %v"
	shouldHaveBeenFalse = "Expected: false\nActual:   %v"

	shouldHaveBeenZeroValue    = "'%+v' should have been the zero value" //"Expected: (zero value)\nActual:   %v"
	shouldNotHaveBeenZeroValue = "'%+v' should NOT have been the zero value"

	shouldHaveBeenGreater        = "Expected '%v' to be greater than '%v' (but it wasn't)!"
	shouldHaveBeenGreaterOrEqual = "Expected '%v' to be greater than or equal to '%v' (but it wasn't)!"

	shouldHaveBeenLess        = "Expected '%v' to be less than '%v' (but it wasn't)!"
	shouldHaveBeenLessOrEqual = "Expected '%v' to be less than or equal to '%v' (but it wasn't)!"

	shouldHaveBeenBetween            = "Expected '%v' to be between '%v' and '%v' (but it wasn't)!"
	shouldNotHaveBeenBetween         = "Expected '%v' NOT to be between '%v' and '%v' (but it was)!"
	shouldHaveDifferentUpperAndLower = "The lower and upper bounds must be different values (they were both '%v')."

	shouldHaveBeenBetweenOrEqual    = "Expected '%v' to be between '%v' and '%v' or equal to one of them (but it wasn't)!"
	shouldNotHaveBeenBetweenOrEqual = "Expected '%v' NOT to be between '%v' and '%v' or equal to one of them (but it was)!"

	shouldHaveContained            = "Expected the container (%v) to contain: '%v' (but it didn't)!"
	shouldNotHaveContained         = "Expected the container (%v) NOT to contain: '%v' (but it did)!"
	shouldHaveBeenAValidCollection = "You must provide a valid container (was %v)!"

	shouldHaveContainedKey    = "Expected the %v to contain the key: %v (but it didn't)!"
	shouldNotHaveContainedKey = "Expected the %v NOT to contain the key: %v (but it did)!"
	shouldHaveBeenAValidMap   = "You must provide a valid map type (was %v)!"

	shouldHaveBeenIn    = "Expected '%v' to be in the container (%v), but it wasn't!"
	shouldNotHaveBeenIn = "Expected '%v' NOT to be in the container (%v), but it was!"

	shouldHaveBeenEmpty    = "Expected %+v to be empty (but it wasn't)!"
	shouldNotHaveBeenEmpty = "Expected %+v to NOT be empty (but it was)!"

	shouldHaveBeenAValidInteger = "You must provide a valid integer (was %v)!"
	shouldHaveBeenAValidLength  = "You must provide a valid positive integer (was %v)!"
	shouldHaveHadLength         = "Expected collection to have length equal to [%v], but it's length was [%v] instead! contents: %+v"

	shouldHaveStartedWith    = "Expected      '%v'\nto start with '%v'\n(but it didn't)!"
	shouldNotHaveStartedWith = "Expected          '%v'\nNOT to start with '%v'\n(but it did)!"

	shouldHaveEndedWith    = "Expected    '%v'\nto end with '%v'\n(but it didn't)!"
	shouldNotHaveEndedWith = "Expected        '%v'\nNOT to end with '%v'\n(but it did)!"

	shouldAllBeStrings  = "All arguments to this assertion must be strings (you provided: %v)."
	shouldBothBeStrings = "Both arguments to this assertion must be strings (you provided %v and %v)."

	shouldHaveContainedSubstring    = "Expected '%s' to contain substring '%s' (but it didn't)!"
	shouldNotHaveContainedSubstring = "Expected '%s' NOT to contain substring '%s' (but it did)!"

	shouldBeString         = "The argument to this assertion must be a string (you provided %v)."
	shouldHaveBeenBlank    = "Expected '%s' to be blank (but it wasn't)!"
	shouldNotHaveBeenBlank = "Expected value to NOT be blank (but it was)!"

	shouldUseVoidNiladicFunction = "You must provide a void, niladic function as the first argument!"
	shouldHavePanicked           = "Expected func() to panic (but it didn't)!"
	shouldNotHavePanicked        = "Expected func() NOT to panic (error: '%+v')!"

	shouldHavePanickedWith    = "Expected func() to panic with '%v' (but it panicked with '%v')!"
	shouldNotHavePanickedWith = "Expected func() NOT to panic with '%v' (but it did)!"

	shouldHaveBeenA    = "Expected '%v' to be: '%v' (but was: '%v')!"
	shouldNotHaveBeenA = "Expected '%v' to NOT be: '%v' (but it was)!"

	shouldHaveImplemented             = "Expected: '%v interface support'\nActual:   '%v' does not implement the interface!"
	shouldNotHaveImplemented          = "Expected         '%v'\nto NOT implement '%v'\n(but it did)!"
	shouldCompareWithInterfacePointer = "The expected value must be a pointer to an interface type (eg. *fmt.Stringer)"
	shouldNotBeNilActual              = "The actual value was 'nil' and should be a value or a pointer to a value!"

	shouldBeError                       = "Expected an error value (but was '%v' instead)!"
	shouldBeErrorInvalidComparisonValue = "The final argument to this assertion must be a string or an error value (you provided: '%v')."

	shouldUseTimes           = "You must provide time instances as arguments to this assertion."
	shouldUseTimeSlice       = "You must provide a slice of time instances as the first argument to this assertion."
	shouldUseDurationAndTime = "You must provide a duration and a time as arguments to this assertion."

	shouldHaveHappenedBefore         = "Expected '%v' to happen before '%v' (it happened '%v' after)!"
	shouldHaveHappenedAfter          = "Expected '%v' to happen after '%v' (it happened '%v' before)!"
	shouldHaveHappenedBetween        = "Expected '%v' to happen between '%v' and '%v' (it happened '%v' outside threshold)!"
	shouldNotHaveHappenedOnOrBetween = "Expected '%v' to NOT happen on or between '%v' and '%v' (but it did)!"

	// format params: incorrect-index, previous-index, previous-time, incorrect-index, incorrect-time
	shouldHaveBeenChronological    = "The 'Time' at index [%d] should have happened after the previous one (but it didn't!):\n  [%d]: %s\n  [%d]: %s (see, it happened before!)"
	shouldNotHaveBeenchronological = "The provided times should NOT be chronological, but they were."
)
