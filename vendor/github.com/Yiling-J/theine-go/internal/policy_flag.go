package internal

// Flag struct uses 8 bits, with each bit representing a boolean value.
// Currently, 5 bits are used.
// All bits are read/write in policy only(with policy mutex), so safe to put them together.
// Bit 1: Indicates if this entry is a root of linked list.
// Bit 2: Indicates if this entry is on probation.
// Bit 3: Indicates if this entry is protected.
// Bit 4: Indicates if this entry is removed from main(SLRU).
// Bit 5: Indicates if this entry is from NVM.
// Bit 6: Indicates if this entry is deleted by API.
// Bit 7: Indicates if this entry is window.
type Flag struct {
	Flags int8
}

func (f *Flag) SetRoot(isRoot bool) {
	if isRoot {
		f.Flags |= (1 << 0) // Set bit 1 (root)
	} else {
		f.Flags &^= (1 << 0) // Clear bit 1 (root)
	}
}

func (f *Flag) SetProbation(isProbation bool) {
	if isProbation {
		f.Flags |= (1 << 1) // Set bit 2 (probation)
	} else {
		f.Flags &^= (1 << 1) // Clear bit 2 (probation)
	}
}

func (f *Flag) SetProtected(isProtected bool) {
	if isProtected {
		f.Flags |= (1 << 2) // Set bit 3 (protected)
	} else {
		f.Flags &^= (1 << 2) // Clear bit 3 (protected)
	}
}

func (f *Flag) SetWindow(isWindow bool) {
	if isWindow {
		f.Flags |= (1 << 6) // Set bit 7 (window)
	} else {
		f.Flags &^= (1 << 6) // Clear bit 7 (window)
	}
}

func (f *Flag) SetRemoved(isRemoved bool) {
	if isRemoved {
		f.Flags |= (1 << 3) // Set bit 4 (removed)
	} else {
		f.Flags &^= (1 << 3) // Clear bit 4 (removed)
	}
}

func (f *Flag) SetFromNVM(isFromNVM bool) {
	if isFromNVM {
		f.Flags |= (1 << 4) // Set bit 5 (from NVM)
	} else {
		f.Flags &^= (1 << 4) // Clear bit 5 (from NVM)
	}
}

func (f *Flag) SetDeleted(isDeleted bool) {
	if isDeleted {
		f.Flags |= (1 << 5) // Set bit 6 (deleted)
	} else {
		f.Flags &^= (1 << 5) // Clear bit 6 (deleted)
	}
}

func (f *Flag) IsRoot() bool {
	return (f.Flags & (1 << 0)) != 0
}

func (f *Flag) IsProbation() bool {
	return (f.Flags & (1 << 1)) != 0
}

func (f *Flag) IsProtected() bool {
	return (f.Flags & (1 << 2)) != 0
}

func (f *Flag) IsRemoved() bool {
	return (f.Flags & (1 << 3)) != 0
}

func (f *Flag) IsFromNVM() bool {
	return (f.Flags & (1 << 4)) != 0
}

func (f *Flag) IsDeleted() bool {
	return (f.Flags & (1 << 5)) != 0
}

func (f *Flag) IsWindow() bool {
	return (f.Flags & (1 << 6)) != 0
}
