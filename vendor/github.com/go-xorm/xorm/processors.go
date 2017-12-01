// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

// BeforeInsertProcessor executed before an object is initially persisted to the database
type BeforeInsertProcessor interface {
	BeforeInsert()
}

// BeforeUpdateProcessor executed before an object is updated
type BeforeUpdateProcessor interface {
	BeforeUpdate()
}

// BeforeDeleteProcessor executed before an object is deleted
type BeforeDeleteProcessor interface {
	BeforeDelete()
}

// BeforeSetProcessor executed before data set to the struct fields
type BeforeSetProcessor interface {
	BeforeSet(string, Cell)
}

// AfterSetProcessor executed after data set to the struct fields
type AfterSetProcessor interface {
	AfterSet(string, Cell)
}

// !nashtsai! TODO enable BeforeValidateProcessor when xorm start to support validations
//// Executed before an object is validated
//type BeforeValidateProcessor interface {
//    BeforeValidate()
//}
// --

// AfterInsertProcessor executed after an object is persisted to the database
type AfterInsertProcessor interface {
	AfterInsert()
}

// AfterUpdateProcessor executed after an object has been updated
type AfterUpdateProcessor interface {
	AfterUpdate()
}

// AfterDeleteProcessor executed after an object has been deleted
type AfterDeleteProcessor interface {
	AfterDelete()
}
