(*
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements. See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership. The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License. You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied. See the License for the
 specific language governing permissions and limitations
 under the License.
*)

exception Break;;
exception Thrift_error;;
exception Field_empty of string;;

class t_exn =
object
  val mutable message = ""
  method get_message = message
  method set_message s = message <- s
end;;

module Transport =
struct
  type exn_type =
      | UNKNOWN
      | NOT_OPEN
      | ALREADY_OPEN
      | TIMED_OUT
      | END_OF_FILE;;

  exception E of exn_type * string

  class virtual t =
  object (self)
    method virtual isOpen : bool
    method virtual opn : unit
    method virtual close : unit
    method virtual read : string -> int -> int -> int
    method readAll buf off len =
      let got = ref 0 in
      let ret = ref 0 in
        while !got < len do
          ret := self#read buf (off+(!got)) (len - (!got));
          if !ret <= 0 then
            raise (E (UNKNOWN, "Cannot read. Remote side has closed."));
          got := !got + !ret
        done;
        !got
    method virtual write : string -> int -> int -> unit
    method virtual flush : unit
  end

  class factory =
  object
    method getTransport (t : t) = t
  end

  class virtual server_t =
  object (self)
    method virtual listen : unit
    method accept = self#acceptImpl
    method virtual close : unit
    method virtual acceptImpl : t
  end

end;;



module Protocol =
struct
  type t_type =
      | T_STOP
      | T_VOID
      | T_BOOL
      | T_BYTE
      | T_I08
      | T_I16
      | T_I32
      | T_U64
      | T_I64
      | T_DOUBLE
      | T_STRING
      | T_UTF7
      | T_STRUCT
      | T_MAP
      | T_SET
      | T_LIST
      | T_UTF8
      | T_UTF16

  let t_type_to_i = function
      T_STOP       -> 0
    | T_VOID       -> 1
    | T_BOOL       -> 2
    | T_BYTE       -> 3
    | T_I08        -> 3
    | T_I16        -> 6
    | T_I32        -> 8
    | T_U64        -> 9
    | T_I64        -> 10
    | T_DOUBLE     -> 4
    | T_STRING     -> 11
    | T_UTF7       -> 11
    | T_STRUCT     -> 12
    | T_MAP        -> 13
    | T_SET        -> 14
    | T_LIST       -> 15
    | T_UTF8       -> 16
    | T_UTF16      -> 17

  let t_type_of_i = function
      0 -> T_STOP
    | 1 -> T_VOID
    | 2 -> T_BOOL
    | 3 ->  T_BYTE
    | 6-> T_I16
    | 8 -> T_I32
    | 9 -> T_U64
    | 10 -> T_I64
    | 4 -> T_DOUBLE
    | 11 -> T_STRING
    | 12 -> T_STRUCT
    | 13 -> T_MAP
    | 14 -> T_SET
    | 15 -> T_LIST
    | 16 -> T_UTF8
    | 17 -> T_UTF16
    | _ -> raise Thrift_error

  type message_type =
    | CALL
    | REPLY
    | EXCEPTION
    | ONEWAY

  let message_type_to_i = function
    | CALL -> 1
    | REPLY -> 2
    | EXCEPTION -> 3
    | ONEWAY -> 4

  let message_type_of_i = function
    | 1 -> CALL
    | 2 -> REPLY
    | 3 -> EXCEPTION
    | 4 -> ONEWAY
    | _ -> raise Thrift_error

  class virtual t (trans: Transport.t) =
  object (self)
    val mutable trans_ = trans
    method getTransport = trans_
      (* writing methods *)
    method virtual writeMessageBegin : string * message_type * int -> unit
    method virtual writeMessageEnd : unit
    method virtual writeStructBegin : string -> unit
    method virtual writeStructEnd : unit
    method virtual writeFieldBegin : string * t_type * int -> unit
    method virtual writeFieldEnd : unit
    method virtual writeFieldStop : unit
    method virtual writeMapBegin : t_type * t_type * int -> unit
    method virtual writeMapEnd : unit
    method virtual writeListBegin : t_type * int -> unit
    method virtual writeListEnd : unit
    method virtual writeSetBegin : t_type * int -> unit
    method virtual writeSetEnd : unit
    method virtual writeBool : bool -> unit
    method virtual writeByte : int -> unit
    method virtual writeI16 : int -> unit
    method virtual writeI32 : Int32.t -> unit
    method virtual writeI64 : Int64.t -> unit
    method virtual writeDouble : float -> unit
    method virtual writeString : string -> unit
    method virtual writeBinary : string -> unit
      (* reading methods *)
    method virtual readMessageBegin : string * message_type * int
    method virtual readMessageEnd : unit
    method virtual readStructBegin : string
    method virtual readStructEnd : unit
    method virtual readFieldBegin : string * t_type * int
    method virtual readFieldEnd : unit
    method virtual readMapBegin : t_type * t_type * int
    method virtual readMapEnd : unit
    method virtual readListBegin : t_type * int
    method virtual readListEnd : unit
    method virtual readSetBegin : t_type * int
    method virtual readSetEnd : unit
    method virtual readBool : bool
    method virtual readByte : int
    method virtual readI16 : int
    method virtual readI32: Int32.t
    method virtual readI64 : Int64.t
    method virtual readDouble : float
    method virtual readString : string
    method virtual readBinary : string
        (* skippage *)
    method skip typ =
      match typ with
        | T_STOP -> ()
        | T_VOID -> ()
        | T_BOOL -> ignore self#readBool
        | T_BYTE
        | T_I08 -> ignore self#readByte
        | T_I16 -> ignore self#readI16
        | T_I32 -> ignore self#readI32
        | T_U64
        | T_I64 -> ignore self#readI64
        | T_DOUBLE -> ignore self#readDouble
        | T_STRING -> ignore self#readString
        | T_UTF7 -> ()
        | T_STRUCT -> ignore ((ignore self#readStructBegin);
                              (try
                                   while true do
                                     let (_,t,_) = self#readFieldBegin in
                                       if t = T_STOP then
                                         raise Break
                                       else
                                         (self#skip t;
                                          self#readFieldEnd)
                                   done
                               with Break -> ());
                              self#readStructEnd)
        | T_MAP -> ignore (let (k,v,s) = self#readMapBegin in
                             for i=0 to s do
                               self#skip k;
                               self#skip v;
                             done;
                             self#readMapEnd)
        | T_SET -> ignore (let (t,s) = self#readSetBegin in
                             for i=0 to s do
                               self#skip t
                             done;
                             self#readSetEnd)
        | T_LIST -> ignore (let (t,s) = self#readListBegin in
                              for i=0 to s do
                                self#skip t
                              done;
                              self#readListEnd)
        | T_UTF8 -> ()
        | T_UTF16 -> ()
  end

  class virtual factory =
  object
    method virtual getProtocol : Transport.t -> t
  end

  type exn_type =
      | UNKNOWN
      | INVALID_DATA
      | NEGATIVE_SIZE
      | SIZE_LIMIT
      | BAD_VERSION
      | NOT_IMPLEMENTED
      | DEPTH_LIMIT

  exception E of exn_type * string;;

end;;


module Processor =
struct
  class virtual t =
  object
    method virtual process : Protocol.t -> Protocol.t -> bool
  end;;

  class factory (processor : t) =
  object
    val processor_ = processor
    method getProcessor (trans : Transport.t) = processor_
  end;;
end


(* Ugly *)
module Application_Exn =
struct
  type typ=
      | UNKNOWN
      | UNKNOWN_METHOD
      | INVALID_MESSAGE_TYPE
      | WRONG_METHOD_NAME
      | BAD_SEQUENCE_ID
      | MISSING_RESULT
      | INTERNAL_ERROR
      | PROTOCOL_ERROR
      | INVALID_TRANSFORM
      | INVALID_PROTOCOL
      | UNSUPPORTED_CLIENT_TYPE

  let typ_of_i = function
      0l -> UNKNOWN
    | 1l -> UNKNOWN_METHOD
    | 2l -> INVALID_MESSAGE_TYPE
    | 3l -> WRONG_METHOD_NAME
    | 4l -> BAD_SEQUENCE_ID
    | 5l -> MISSING_RESULT
    | 6l -> INTERNAL_ERROR
    | 7l -> PROTOCOL_ERROR
    | 8l -> INVALID_TRANSFORM
    | 9l -> INVALID_PROTOCOL
    | 10l -> UNSUPPORTED_CLIENT_TYPE
    | _ -> raise Thrift_error;;
  let typ_to_i = function
    | UNKNOWN -> 0l
    | UNKNOWN_METHOD -> 1l
    | INVALID_MESSAGE_TYPE -> 2l
    | WRONG_METHOD_NAME -> 3l
    | BAD_SEQUENCE_ID -> 4l
    | MISSING_RESULT -> 5l
    | INTERNAL_ERROR -> 6l
    | PROTOCOL_ERROR -> 7l
    | INVALID_TRANSFORM -> 8l
    | INVALID_PROTOCOL -> 9l
    | UNSUPPORTED_CLIENT_TYPE -> 10l

  class t =
  object (self)
    inherit t_exn
    val mutable typ = UNKNOWN
    method get_type = typ
    method set_type t = typ <- t
    method write (oprot : Protocol.t) =
      oprot#writeStructBegin "TApplicationExeception";
      if self#get_message != "" then
        (oprot#writeFieldBegin ("message",Protocol.T_STRING, 1);
         oprot#writeString self#get_message;
         oprot#writeFieldEnd)
      else ();
      oprot#writeFieldBegin ("type",Protocol.T_I32,2);
      oprot#writeI32 (typ_to_i typ);
      oprot#writeFieldEnd;
      oprot#writeFieldStop;
      oprot#writeStructEnd
  end;;

  let create typ msg =
    let e = new t in
      e#set_type typ;
    e#set_message msg;
    e

  let read (iprot : Protocol.t) =
    let msg = ref "" in
    let typ = ref 0l in
      ignore iprot#readStructBegin;
      (try
           while true do
             let (name,ft,id) =iprot#readFieldBegin in
               if ft = Protocol.T_STOP
               then raise Break
               else ();
               (match id with
             | 1 -> (if ft = Protocol.T_STRING
               then msg := (iprot#readString)
               else iprot#skip ft)
             | 2 -> (if ft = Protocol.T_I32
               then typ := iprot#readI32
               else iprot#skip ft)
             | _ -> iprot#skip ft);
               iprot#readFieldEnd
      done
       with Break -> ());
      iprot#readStructEnd;
      let e = new t in
        e#set_type (typ_of_i !typ);
        e#set_message !msg;
        e;;

  exception E of t
end;;
