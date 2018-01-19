/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package common

import (
	"errors"
	"fmt"
	"encoding/hex"
	. "gen/thrifttest"
	"time"
)

var PrintingHandler = &printingHandler{}

type printingHandler struct{}

// Prints "testVoid()" and returns nothing.
func (p *printingHandler) TestVoid() (err error) {
	fmt.Println("testVoid()")
	return nil
}

// Prints 'testString("%s")' with thing as '%s'
// @param string thing - the string to print
// @return string - returns the string 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestString(thing string) (r string, err error) {
	fmt.Printf("testString(\"%s\")\n", thing)
	return thing, nil
}

// Prints 'testBool("%t")' with thing as 'true' or 'false'
// @param bool thing - the bool to print
// @return bool - returns the bool 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestBool(thing bool) (r bool, err error) {
	fmt.Printf("testBool(%t)\n", thing)
	return thing, nil
}

// Prints 'testByte("%d")' with thing as '%d'
// @param byte thing - the byte to print
// @return byte - returns the byte 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestByte(thing int8) (r int8, err error) {
	fmt.Printf("testByte(%d)\n", thing)
	return thing, nil
}

// Prints 'testI32("%d")' with thing as '%d'
// @param i32 thing - the i32 to print
// @return i32 - returns the i32 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestI32(thing int32) (r int32, err error) {
	fmt.Printf("testI32(%d)\n", thing)
	return thing, nil
}

// Prints 'testI64("%d")' with thing as '%d'
// @param i64 thing - the i64 to print
// @return i64 - returns the i64 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestI64(thing int64) (r int64, err error) {
	fmt.Printf("testI64(%d)\n", thing)
	return thing, nil
}

// Prints 'testDouble("%f")' with thing as '%f'
// @param double thing - the double to print
// @return double - returns the double 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestDouble(thing float64) (r float64, err error) {
	fmt.Printf("testDouble(%f)\n", thing)
	return thing, nil
}

// Prints 'testBinary("%s")' where '%s' is a hex-formatted string of thing's data
// @param []byte thing - the binary to print
// @return []byte - returns the binary 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestBinary(thing []byte) (r []byte, err error) {
	fmt.Printf("testBinary(%s)\n", hex.EncodeToString(thing))
	return thing, nil
}

// Prints 'testStruct("{%s}")' where thing has been formatted into a string of comma separated values
// @param Xtruct thing - the Xtruct to print
// @return Xtruct - returns the Xtruct 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestStruct(thing *Xtruct) (r *Xtruct, err error) {
	fmt.Printf("testStruct({\"%s\", %d, %d, %d})\n", thing.StringThing, thing.ByteThing, thing.I32Thing, thing.I64Thing)
	return thing, err
}

// Prints 'testNest("{%s}")' where thing has been formatted into a string of the nested struct
// @param Xtruct2 thing - the Xtruct2 to print
// @return Xtruct2 - returns the Xtruct2 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestNest(nest *Xtruct2) (r *Xtruct2, err error) {
	thing := nest.StructThing
	fmt.Printf("testNest({%d, {\"%s\", %d, %d, %d}, %d})\n", nest.ByteThing, thing.StringThing, thing.ByteThing, thing.I32Thing, thing.I64Thing, nest.I32Thing)
	return nest, nil
}

// Prints 'testMap("{%s")' where thing has been formatted into a string of  'key => value' pairs
//  separated by commas and new lines
// @param map<i32,i32> thing - the map<i32,i32> to print
// @return map<i32,i32> - returns the map<i32,i32> 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestMap(thing map[int32]int32) (r map[int32]int32, err error) {
	fmt.Printf("testMap({")
	first := true
	for k, v := range thing {
		if first {
			first = false
		} else {
			fmt.Printf(", ")
		}
		fmt.Printf("%d => %d", k, v)
	}
	fmt.Printf("})\n")
	return thing, nil
}

// Prints 'testStringMap("{%s}")' where thing has been formatted into a string of  'key => value' pairs
//  separated by commas and new lines
// @param map<string,string> thing - the map<string,string> to print
// @return map<string,string> - returns the map<string,string> 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestStringMap(thing map[string]string) (r map[string]string, err error) {
	fmt.Printf("testStringMap({")
	first := true
	for k, v := range thing {
		if first {
			first = false
		} else {
			fmt.Printf(", ")
		}
		fmt.Printf("%s => %s", k, v)
	}
	fmt.Printf("})\n")
	return thing, nil
}

// Prints 'testSet("{%s}")' where thing has been formatted into a string of  values
//  separated by commas and new lines
// @param set<i32> thing - the set<i32> to print
// @return set<i32> - returns the set<i32> 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestSet(thing map[int32]struct{}) (r map[int32]struct{}, err error) {
	fmt.Printf("testSet({")
	first := true
	for k, _ := range thing {
		if first {
			first = false
		} else {
			fmt.Printf(", ")
		}
		fmt.Printf("%d", k)
	}
	fmt.Printf("})\n")
	return thing, nil
}

// Prints 'testList("{%s}")' where thing has been formatted into a string of  values
//  separated by commas and new lines
// @param list<i32> thing - the list<i32> to print
// @return list<i32> - returns the list<i32> 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestList(thing []int32) (r []int32, err error) {
	fmt.Printf("testList({")
	for i, v := range thing {
		if i != 0 {
			fmt.Printf(", ")
		}
		fmt.Printf("%d", v)
	}
	fmt.Printf("})\n")
	return thing, nil
}

// Prints 'testEnum("%d")' where thing has been formatted into it's numeric value
// @param Numberz thing - the Numberz to print
// @return Numberz - returns the Numberz 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestEnum(thing Numberz) (r Numberz, err error) {
	fmt.Printf("testEnum(%d)\n", thing)
	return thing, nil
}

// Prints 'testTypedef("%d")' with thing as '%d'
// @param UserId thing - the UserId to print
// @return UserId - returns the UserId 'thing'
//
// Parameters:
//  - Thing
func (p *printingHandler) TestTypedef(thing UserId) (r UserId, err error) {
	fmt.Printf("testTypedef(%d)\n", thing)
	return thing, nil
}

// Prints 'testMapMap("%d")' with hello as '%d'
// @param i32 hello - the i32 to print
// @return map<i32,map<i32,i32>> - returns a dictionary with these values:
//   {-4 => {-4 => -4, -3 => -3, -2 => -2, -1 => -1, }, 4 => {1 => 1, 2 => 2, 3 => 3, 4 => 4, }, }
//
// Parameters:
//  - Hello
func (p *printingHandler) TestMapMap(hello int32) (r map[int32]map[int32]int32, err error) {
	fmt.Printf("testMapMap(%d)\n", hello)

	r = map[int32]map[int32]int32{
		-4: map[int32]int32{-4: -4, -3: -3, -2: -2, -1: -1},
		4:  map[int32]int32{4: 4, 3: 3, 2: 2, 1: 1},
	}
	return
}

// So you think you've got this all worked, out eh?
//
// Creates a the returned map with these values and prints it out:
//   { 1 => { 2 => argument,
//            3 => argument,
//          },
//     2 => { 6 => <empty Insanity struct>, },
//   }
// @return map<UserId, map<Numberz,Insanity>> - a map with the above values
//
// Parameters:
//  - Argument
func (p *printingHandler) TestInsanity(argument *Insanity) (r map[UserId]map[Numberz]*Insanity, err error) {
	fmt.Printf("testInsanity()\n")
	r = make(map[UserId]map[Numberz]*Insanity)
	r[1] = map[Numberz]*Insanity {
		2: argument,
		3: argument,
	}
	r[2] = map[Numberz]*Insanity {
		6: NewInsanity(),
	}
	return
}

// Prints 'testMulti()'
// @param byte arg0 -
// @param i32 arg1 -
// @param i64 arg2 -
// @param map<i16, string> arg3 -
// @param Numberz arg4 -
// @param UserId arg5 -
// @return Xtruct - returns an Xtruct with StringThing = "Hello2, ByteThing = arg0, I32Thing = arg1
//    and I64Thing = arg2
//
// Parameters:
//  - Arg0
//  - Arg1
//  - Arg2
//  - Arg3
//  - Arg4
//  - Arg5
func (p *printingHandler) TestMulti(arg0 int8, arg1 int32, arg2 int64, arg3 map[int16]string, arg4 Numberz, arg5 UserId) (r *Xtruct, err error) {
	fmt.Printf("testMulti()\n")
	r = NewXtruct()

	r.StringThing = "Hello2"
	r.ByteThing = arg0
	r.I32Thing = arg1
	r.I64Thing = arg2
	return
}

// Print 'testException(%s)' with arg as '%s'
// @param string arg - a string indication what type of exception to throw
// if arg == "Xception" throw Xception with errorCode = 1001 and message = arg
// elsen if arg == "TException" throw TException
// else do not throw anything
//
// Parameters:
//  - Arg
func (p *printingHandler) TestException(arg string) (err error) {
	fmt.Printf("testException(%s)\n", arg)
	switch arg {
	case "Xception":
		e := NewXception()
		e.ErrorCode = 1001
		e.Message = arg
		return e
	case "TException":
		return errors.New("Just TException")
	}
	return
}

// Print 'testMultiException(%s, %s)' with arg0 as '%s' and arg1 as '%s'
// @param string arg - a string indication what type of exception to throw
// if arg0 == "Xception" throw Xception with errorCode = 1001 and message = "This is an Xception"
// elsen if arg0 == "Xception2" throw Xception2 with errorCode = 2002 and message = "This is an Xception2"
// else do not throw anything
// @return Xtruct - an Xtruct with StringThing = arg1
//
// Parameters:
//  - Arg0
//  - Arg1
func (p *printingHandler) TestMultiException(arg0 string, arg1 string) (r *Xtruct, err error) {
	fmt.Printf("testMultiException(%s, %s)\n", arg0, arg1)
	switch arg0 {

	case "Xception":
		e := NewXception()
		e.ErrorCode = 1001
		e.Message = "This is an Xception"
		return nil, e
	case "Xception2":
		e := NewXception2()
		e.ErrorCode = 2002
		e.StructThing = NewXtruct()
		e.StructThing.StringThing = "This is an Xception2"
		return nil, e
	default:
		r = NewXtruct()
		r.StringThing = arg1
		return
	}
}

// Print 'testOneway(%d): Sleeping...' with secondsToSleep as '%d'
// sleep 'secondsToSleep'
// Print 'testOneway(%d): done sleeping!' with secondsToSleep as '%d'
// @param i32 secondsToSleep - the number of seconds to sleep
//
// Parameters:
//  - SecondsToSleep
func (p *printingHandler) TestOneway(secondsToSleep int32) (err error) {
	fmt.Printf("testOneway(%d): Sleeping...\n", secondsToSleep)
	time.Sleep(time.Second * time.Duration(secondsToSleep))
	fmt.Printf("testOneway(%d): done sleeping!\n", secondsToSleep)
	return
}
