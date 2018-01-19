package assertions

import "reflect"

type equalityMethodSpecification struct {
	a interface{}
	b interface{}

	aType reflect.Type
	bType reflect.Type

	equalMethod reflect.Value
}

func newEqualityMethodSpecification(a, b interface{}) *equalityMethodSpecification {
	return &equalityMethodSpecification{
		a: a,
		b: b,
	}
}

func (this *equalityMethodSpecification) IsSatisfied() bool {
	if !this.bothAreSameType() {
		return false
	}
	if !this.typeHasEqualMethod() {
		return false
	}
	if !this.equalMethodReceivesSameTypeForComparison() {
		return false
	}
	if !this.equalMethodReturnsBool() {
		return false
	}
	return true
}

func (this *equalityMethodSpecification) bothAreSameType() bool {
	this.aType = reflect.TypeOf(this.a)
	if this.aType == nil {
		return false
	}
	if this.aType.Kind() == reflect.Ptr {
		this.aType = this.aType.Elem()
	}
	this.bType = reflect.TypeOf(this.b)
	return this.aType == this.bType
}
func (this *equalityMethodSpecification) typeHasEqualMethod() bool {
	aInstance := reflect.ValueOf(this.a)
	this.equalMethod = aInstance.MethodByName("Equal")
	return this.equalMethod != reflect.Value{}
}

func (this *equalityMethodSpecification) equalMethodReceivesSameTypeForComparison() bool {
	signature := this.equalMethod.Type()
	return signature.NumIn() == 1 && signature.In(0) == this.aType
}

func (this *equalityMethodSpecification) equalMethodReturnsBool() bool {
	signature := this.equalMethod.Type()
	return signature.NumOut() == 1 && signature.Out(0) == reflect.TypeOf(true)
}

func (this *equalityMethodSpecification) AreEqual() bool {
	a := reflect.ValueOf(this.a)
	b := reflect.ValueOf(this.b)
	return areEqual(a, b) && areEqual(b, a)
}
func areEqual(receiver reflect.Value, argument reflect.Value) bool {
	equalMethod := receiver.MethodByName("Equal")
	argumentList := []reflect.Value{argument}
	result := equalMethod.Call(argumentList)
	return result[0].Bool()
}
