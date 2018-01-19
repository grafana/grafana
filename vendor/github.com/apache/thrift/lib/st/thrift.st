"
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
License); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
AS IS BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.

Contains some contributions under the Thrift Software License.
Please see doc/old-thrift-license.txt in the Thrift distribution for
details. 
"

SystemOrganization addCategory: #Thrift!
SystemOrganization addCategory: #'Thrift-Protocol'!
SystemOrganization addCategory: #'Thrift-Transport'!

Error subclass: #TError
	instanceVariableNames: 'code'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift'!

!TError class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:28'!
signalWithCode: anInteger
	self new code: anInteger; signal! !

!TError methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:28'!
code
	^ code! !

!TError methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:28'!
code: anInteger
	code := anInteger! !

TError subclass: #TProtocolError
	instanceVariableNames: ''
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Protocol'!

!TProtocolError class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 18:39'!
badVersion
	^ 4! !

!TProtocolError class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 18:39'!
invalidData
	^ 1! !

!TProtocolError class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 18:39'!
negativeSize
	^ 2! !

!TProtocolError class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 18:40'!
sizeLimit
	^ 3! !

!TProtocolError class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 18:40'!
unknown
	^ 0! !

TError subclass: #TTransportError
	instanceVariableNames: ''
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Transport'!

TTransportError subclass: #TTransportClosedError
	instanceVariableNames: ''
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Transport'!

Object subclass: #TClient
	instanceVariableNames: 'iprot oprot seqid remoteSeqid'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift'!

!TClient class methodsFor: 'as yet unclassified' stamp: 'pc 11/7/2007 06:00'!
binaryOnHost: aString port: anInteger
	| sock |
	sock := TSocket new host: aString; port: anInteger; open; yourself.
	^ self new
		inProtocol: (TBinaryProtocol new transport: sock);
		yourself! !

!TClient methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 23:03'!
inProtocol: aProtocol
	iprot := aProtocol.
	oprot ifNil: [oprot := aProtocol]! !

!TClient methodsFor: 'as yet unclassified' stamp: 'pc 10/26/2007 04:28'!
nextSeqid
	^ seqid
		ifNil: [seqid := 0]
		ifNotNil: [seqid := seqid + 1]! !

!TClient methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 22:51'!
outProtocol: aProtocol
	oprot := aProtocol! !

!TClient methodsFor: 'as yet unclassified' stamp: 'pc 10/28/2007 15:32'!
validateRemoteMessage: aMsg
	remoteSeqid
		ifNil: [remoteSeqid := aMsg seqid]
		ifNotNil:
			[(remoteSeqid + 1) = aMsg seqid ifFalse:
				[TProtocolError signal: 'Bad seqid: ', aMsg seqid asString,
							'; wanted: ', remoteSeqid asString].
			remoteSeqid := aMsg seqid]! !

Object subclass: #TField
	instanceVariableNames: 'name type id'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Protocol'!

!TField methodsFor: 'accessing' stamp: 'pc 10/24/2007 20:05'!
id
	^ id ifNil: [0]! !

!TField methodsFor: 'accessing' stamp: 'pc 10/24/2007 19:44'!
id: anInteger
	id := anInteger! !

!TField methodsFor: 'accessing' stamp: 'pc 10/24/2007 20:04'!
name
	^ name ifNil: ['']! !

!TField methodsFor: 'accessing' stamp: 'pc 10/24/2007 19:44'!
name: anObject
	name := anObject! !

!TField methodsFor: 'accessing' stamp: 'pc 10/24/2007 20:05'!
type
	^ type ifNil: [TType stop]! !

!TField methodsFor: 'accessing' stamp: 'pc 10/24/2007 19:44'!
type: anInteger
	type := anInteger! !

Object subclass: #TMessage
	instanceVariableNames: 'name seqid type'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Protocol'!

TMessage subclass: #TCallMessage
	instanceVariableNames: ''
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Protocol'!

!TCallMessage methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 22:53'!
type
	^ 1! !

!TMessage methodsFor: 'accessing' stamp: 'pc 10/24/2007 20:05'!
name
	^ name ifNil: ['']! !

!TMessage methodsFor: 'accessing' stamp: 'pc 10/24/2007 19:35'!
name: aString
	name := aString! !

!TMessage methodsFor: 'accessing' stamp: 'pc 10/24/2007 20:05'!
seqid
	^ seqid ifNil: [0]! !

!TMessage methodsFor: 'accessing' stamp: 'pc 10/24/2007 19:35'!
seqid: anInteger
	seqid := anInteger! !

!TMessage methodsFor: 'accessing' stamp: 'pc 10/24/2007 20:06'!
type
	^ type ifNil: [0]! !

!TMessage methodsFor: 'accessing' stamp: 'pc 10/24/2007 19:35'!
type: anInteger
	type := anInteger! !

Object subclass: #TProtocol
	instanceVariableNames: 'transport'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Protocol'!

TProtocol subclass: #TBinaryProtocol
	instanceVariableNames: ''
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Protocol'!

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 11/1/2007 04:24'!
intFromByteArray: buf
	| vals |
	vals := Array new: buf size.
	1 to: buf size do: [:n | vals at: n put: ((buf at: n) bitShift: (buf size - n) * 8)].
	^ vals sum! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 18:46'!
readBool
	^ self readByte isZero not! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 10/25/2007 00:02'!
readByte
	^ (self transport read: 1) first! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 10/28/2007 16:24'!
readDouble
	| val |
	val := Float new: 2.
	^ val basicAt: 1 put: (self readRawInt: 4);
		basicAt: 2 put: (self readRawInt: 4);
		yourself! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 20:02'!
readFieldBegin
	| field |
	field := TField new type: self readByte.

	^ field type = TType stop
		ifTrue: [field]
		ifFalse: [field id: self readI16; yourself]! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:15'!
readI16
	^ self readInt: 2! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:20'!
readI32
	^ self readInt: 4! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:20'!
readI64
	^ self readInt: 8! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 11/1/2007 02:35'!
readInt: size
	| buf val |
	buf := transport read: size.
	val := self intFromByteArray: buf.
	^ buf first > 16r7F
		ifTrue: [self unsignedInt: val size: size]
		ifFalse: [val]! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:57'!
readListBegin
	^ TList new
		elemType: self readByte;
		size: self readI32! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:58'!
readMapBegin
	^ TMap new
		keyType: self readByte;
		valueType: self readByte;
		size: self readI32! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 11/1/2007 04:22'!
readMessageBegin
	| version |
	version := self readI32.

	(version bitAnd: self versionMask) = self version1
		ifFalse: [TProtocolError signalWithCode: TProtocolError badVersion].

	^ TMessage new
		type: (version bitAnd: 16r000000FF);
		name: self readString;
		seqid: self readI32! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 10/28/2007 16:24'!
readRawInt: size
	^ self intFromByteArray: (transport read: size)! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 11/1/2007 00:59'!
readSetBegin
	"element type, size"
	^ TSet new
		elemType: self readByte;
		size: self readI32! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 02/07/2009 19:00'!
readString
	| sz |
	sz := self readI32.
	^ sz > 0 ifTrue: [(transport read: sz) asString] ifFalse: ['']! !

!TBinaryProtocol methodsFor: 'reading' stamp: 'pc 11/1/2007 04:22'!
unsignedInt: val size: size
	^ 0 - ((val - 1) bitXor: ((2 raisedTo: (size * 8)) - 1))! !

!TBinaryProtocol methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 22:13'!
version1
	^ 16r80010000 ! !

!TBinaryProtocol methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 18:01'!
versionMask
	^ 16rFFFF0000! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 18:35'!
write: aString
	transport write: aString! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:23'!
writeBool: bool
	bool ifTrue: [self writeByte: 1]
		ifFalse: [self writeByte: 0]! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 10/26/2007 09:31'!
writeByte: aNumber
	aNumber > 16rFF ifTrue: [TError signal: 'writeByte too big'].
	transport write: (Array with: aNumber)! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 10/28/2007 16:16'!
writeDouble: aDouble
	self writeI32: (aDouble basicAt: 1);
		writeI32: (aDouble basicAt: 2)! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:56'!
writeField: aField
	self writeByte: aField type;
		writeI16: aField id! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 10/25/2007 00:01'!
writeFieldBegin: aField
	self writeByte: aField type.
	self writeI16: aField id! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 18:04'!
writeFieldStop
	self writeByte: TType stop! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 11/1/2007 02:06'!
writeI16: i16
	self writeInt: i16 size: 2! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 11/1/2007 02:06'!
writeI32: i32
	self writeInt: i32 size: 4! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 11/1/2007 02:06'!
writeI64: i64
	self writeInt: i64 size: 8! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 11/1/2007 04:23'!
writeInt: val size: size
	1 to: size do: [:n | self writeByte: ((val bitShift: (size negated + n) * 8) bitAnd: 16rFF)]! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 11/1/2007 00:48'!
writeListBegin: aList
	self writeByte: aList elemType; writeI32: aList size! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:55'!
writeMapBegin: aMap
	self writeByte: aMap keyType;
		writeByte: aMap valueType;
		writeI32: aMap size! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 20:36'!
writeMessageBegin: msg
	self writeI32: (self version1 bitOr: msg type);
		writeString: msg name;
		writeI32: msg seqid! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 11/1/2007 00:56'!
writeSetBegin: aSet
	self writeByte: aSet elemType; writeI32: aSet size! !

!TBinaryProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 18:35'!
writeString: aString
	self writeI32: aString size;
		write: aString! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readBool! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readByte! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readDouble! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readFieldBegin! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readFieldEnd! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readI16! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readI32! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readI64! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readListBegin! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readListEnd! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readMapBegin! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readMapEnd! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:39'!
readMessageBegin! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:39'!
readMessageEnd! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readSetBegin! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readSetEnd! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/25/2007 16:10'!
readSimpleType: aType
	aType = TType bool ifTrue: [^ self readBool].
	aType = TType byte ifTrue: [^ self readByte].
	aType = TType double ifTrue: [^ self readDouble].
	aType = TType i16 ifTrue: [^ self readI16].
	aType = TType i32 ifTrue: [^ self readI32].
	aType = TType i64 ifTrue: [^ self readI64].
	aType = TType list ifTrue: [^ self readBool].! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readString! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readStructBegin
	! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/24/2007 19:40'!
readStructEnd! !

!TProtocol methodsFor: 'reading' stamp: 'pc 10/26/2007 21:34'!
skip: aType
	aType = TType stop ifTrue: [^ self].
	aType = TType bool ifTrue: [^ self readBool].
	aType = TType byte ifTrue: [^ self readByte].
	aType = TType i16 ifTrue: [^ self readI16].
	aType = TType i32 ifTrue: [^ self readI32].
	aType = TType i64 ifTrue: [^ self readI64].
	aType = TType string ifTrue: [^ self readString].
	aType = TType double ifTrue: [^ self readDouble].
	aType = TType struct ifTrue:
		[| field |
		self readStructBegin.
		[(field := self readFieldBegin) type = TType stop] whileFalse:
			[self skip: field type. self readFieldEnd].
		^ self readStructEnd].
	aType = TType map ifTrue:
		[| map |
		map := self readMapBegin.
		map size timesRepeat: [self skip: map keyType. self skip: map valueType].
		^ self readMapEnd].
	aType = TType list ifTrue:
		[| list |
		list := self readListBegin.
		list size timesRepeat: [self skip: list elemType].
		^ self readListEnd].
	aType = TType set ifTrue:
		[| set |
		set := self readSetBegin.
		set size timesRepeat: [self skip: set elemType].
		^ self readSetEnd].

	self error: 'Unknown type'! !

!TProtocol methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 23:02'!
transport
	^ transport! !

!TProtocol methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:28'!
transport: aTransport
	transport := aTransport! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:37'!
writeBool: aBool! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:37'!
writeByte: aByte! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:38'!
writeDouble: aFloat! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:38'!
writeFieldBegin: aField! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:37'!
writeFieldEnd! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:37'!
writeFieldStop! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:37'!
writeI16: i16! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:37'!
writeI32: i32! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:37'!
writeI64: i64! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:39'!
writeListBegin: aList! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:37'!
writeListEnd! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:39'!
writeMapBegin: aMap! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:37'!
writeMapEnd! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:36'!
writeMessageBegin! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:36'!
writeMessageEnd! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:39'!
writeSetBegin: aSet! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:37'!
writeSetEnd! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:38'!
writeString: aString! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:38'!
writeStructBegin: aStruct! !

!TProtocol methodsFor: 'writing' stamp: 'pc 10/24/2007 19:37'!
writeStructEnd! !

Object subclass: #TResult
	instanceVariableNames: 'success oprot iprot exception'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift'!

!TResult methodsFor: 'as yet unclassified' stamp: 'pc 10/26/2007 21:35'!
exception
	^ exception! !

!TResult methodsFor: 'as yet unclassified' stamp: 'pc 10/26/2007 21:35'!
exception: anError
	exception := anError! !

!TResult methodsFor: 'as yet unclassified' stamp: 'pc 10/26/2007 14:43'!
success
	^ success! !

!TResult methodsFor: 'as yet unclassified' stamp: 'pc 10/26/2007 14:43'!
success: anObject
	success := anObject! !

Object subclass: #TSizedObject
	instanceVariableNames: 'size'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Protocol'!

TSizedObject subclass: #TList
	instanceVariableNames: 'elemType'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Protocol'!

!TList methodsFor: 'accessing' stamp: 'pc 10/24/2007 20:04'!
elemType
	^ elemType ifNil: [TType stop]! !

!TList methodsFor: 'accessing' stamp: 'pc 10/24/2007 19:42'!
elemType: anInteger
	elemType := anInteger! !

TList subclass: #TSet
	instanceVariableNames: ''
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Protocol'!

TSizedObject subclass: #TMap
	instanceVariableNames: 'keyType valueType'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Protocol'!

!TMap methodsFor: 'accessing' stamp: 'pc 10/24/2007 20:04'!
keyType
	^ keyType ifNil: [TType stop]! !

!TMap methodsFor: 'accessing' stamp: 'pc 10/24/2007 19:45'!
keyType: anInteger
	keyType := anInteger! !

!TMap methodsFor: 'accessing' stamp: 'pc 10/24/2007 20:04'!
valueType
	^ valueType ifNil: [TType stop]! !

!TMap methodsFor: 'accessing' stamp: 'pc 10/24/2007 19:45'!
valueType: anInteger
	valueType := anInteger! !

!TSizedObject methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 20:03'!
size
	^ size ifNil: [0]! !

!TSizedObject methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 20:06'!
size: anInteger
	size := anInteger! !

Object subclass: #TSocket
	instanceVariableNames: 'host port stream'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Transport'!

!TSocket methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 22:34'!
close
	self isOpen ifTrue: [stream close]! !

!TSocket methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 22:23'!
connect
	^ (self socketStream openConnectionToHost:
		(NetNameResolver addressForName: host) port: port)
			timeout: 180;
			binary;
			yourself! !

!TSocket methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 20:35'!
flush
	stream flush! !

!TSocket methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:08'!
host: aString
	host := aString! !

!TSocket methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 20:34'!
isOpen
	^ stream isNil not
		and: [stream socket isConnected]
		and: [stream socket isOtherEndClosed not]! !

!TSocket methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 22:22'!
open
	stream := self connect! !

!TSocket methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:09'!
port: anInteger
	port := anInteger! !

!TSocket methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:17'!
read: size
	| data |
	[data := stream next: size.
	data isEmpty ifTrue: [TTransportError signal: 'Could not read ', size asString, ' bytes'].
	^ data]
		on: ConnectionClosed
		do: [TTransportClosedError signal]! !

!TSocket methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 22:18'!
socketStream
	^ Smalltalk at: #FastSocketStream ifAbsent: [SocketStream] ! !

!TSocket methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 22:17'!
write: aCollection
	[stream nextPutAll: aCollection]
		on: ConnectionClosed
		do: [TTransportClosedError signal]! !

Object subclass: #TStruct
	instanceVariableNames: 'name'
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Protocol'!

!TStruct methodsFor: 'accessing' stamp: 'pc 10/24/2007 19:47'!
name
	^ name! !

!TStruct methodsFor: 'accessing' stamp: 'pc 10/24/2007 19:47'!
name: aString
	name := aString! !

Object subclass: #TTransport
	instanceVariableNames: ''
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift-Transport'!

!TTransport methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:18'!
close
	self subclassResponsibility! !

!TTransport methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:22'!
flush
	self subclassResponsibility! !

!TTransport methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:18'!
isOpen
	self subclassResponsibility! !

!TTransport methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:18'!
open
	self subclassResponsibility! !

!TTransport methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:18'!
read: anInteger
	self subclassResponsibility! !

!TTransport methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:22'!
readAll: anInteger
	^ String streamContents: [:str |
		[str size < anInteger] whileTrue:
			[str nextPutAll: (self read: anInteger - str size)]]! !

!TTransport methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:22'!
write: aString
	self subclassResponsibility! !

Object subclass: #TType
	instanceVariableNames: ''
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Thrift'!

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:03'!
bool
	^ 2! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:03'!
byte
	^ 3! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/25/2007 15:55'!
codeOf: aTypeName
	self typeMap do: [:each | each first = aTypeName ifTrue: [^ each second]].
	^ nil! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:03'!
double
	^ 4! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:04'!
i16
	^ 6! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:04'!
i32
	^ 8! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:04'!
i64
	^ 10! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:04'!
list
	^ 15! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:04'!
map
	^ 13! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/25/2007 15:56'!
nameOf: aTypeCode
	self typeMap do: [:each | each second = aTypeCode ifTrue: [^ each first]].
	^ nil! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:04'!
set
	^ 14! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:03'!
stop
	^ 0! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:04'!
string
	^ 11! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:04'!
struct
	^ 12! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/25/2007 15:51'!
typeMap
	^ #((bool 2) (byte 3) (double 4) (i16 6) (i32 8) (i64 10) (list 15)
	   (map 13) (set 15) (stop 0) (string 11) (struct 12) (void 1))! !

!TType class methodsFor: 'as yet unclassified' stamp: 'pc 10/24/2007 17:03'!
void
	^ 1! !
