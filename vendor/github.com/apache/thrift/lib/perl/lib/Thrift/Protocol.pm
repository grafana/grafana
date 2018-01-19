#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

require 5.6.0;
use strict;
use warnings;

use Thrift;

#
# Protocol exceptions
#
package TProtocolException;
use base('Thrift::TException');

use constant UNKNOWN       => 0;
use constant INVALID_DATA  => 1;
use constant NEGATIVE_SIZE => 2;
use constant SIZE_LIMIT    => 3;
use constant BAD_VERSION   => 4;
use constant NOT_IMPLEMENTED => 5;
use constant DEPTH_LIMIT   => 6;


sub new {
    my $classname = shift;

    my $self = $classname->SUPER::new();

    return bless($self,$classname);
}

#
# Protocol base class module.
#
package Thrift::Protocol;

sub new {
    my $classname = shift;
    my $self      = {};

    my $trans     = shift;
    $self->{trans}= $trans;

    return bless($self,$classname);
}

sub getTransport
{
    my $self = shift;

    return $self->{trans};
}

#
# Writes the message header
#
# @param string $name Function name
# @param int $type message type TMessageType::CALL or TMessageType::REPLY
# @param int $seqid The sequence id of this message
#
sub writeMessageBegin
{
    my ($name, $type, $seqid);
    die "abstract";
}

#
# Close the message
#
sub writeMessageEnd {
    die "abstract";
}

#
# Writes a struct header.
#
# @param string     $name Struct name
# @throws TException on write error
# @return int How many bytes written
#
sub writeStructBegin {
    my ($name);

    die "abstract";
}

#
# Close a struct.
#
# @throws TException on write error
# @return int How many bytes written
#
sub writeStructEnd {
    die "abstract";
}

#
# Starts a field.
#
# @param string     $name Field name
# @param int        $type Field type
# @param int        $fid  Field id
# @throws TException on write error
# @return int How many bytes written
#
sub writeFieldBegin {
    my ($fieldName, $fieldType, $fieldId);

    die "abstract";
}

sub writeFieldEnd {
    die "abstract";
}

sub writeFieldStop {
    die "abstract";
}

sub writeMapBegin {
    my ($keyType, $valType, $size);

    die "abstract";
}

sub writeMapEnd {
    die "abstract";
}

sub writeListBegin {
    my ($elemType, $size);
    die "abstract";
}

sub writeListEnd {
    die "abstract";
}

sub writeSetBegin {
    my ($elemType, $size);
    die "abstract";
}

sub writeSetEnd {
    die "abstract";
}

sub writeBool {
    my ($bool);
    die "abstract";
}

sub writeByte {
    my ($byte);
    die "abstract";
}

sub writeI16 {
    my ($i16);
    die "abstract";
}

sub writeI32 {
    my ($i32);
    die "abstract";
}

sub writeI64 {
    my ($i64);
    die "abstract";
}

sub writeDouble {
    my ($dub);
    die "abstract";
}

sub writeString
{
    my ($str);
    die "abstract";
}

#
# Reads the message header
#
# @param string $name Function name
# @param int $type message type TMessageType::CALL or TMessageType::REPLY
# @parem int $seqid The sequence id of this message
#
sub readMessageBegin
{
    my ($name, $type, $seqid);
    die "abstract";
}

#
# Read the close of message
#
sub readMessageEnd
{
    die "abstract";
}

sub readStructBegin
{
    my($name);

    die "abstract";
}

sub readStructEnd
{
    die "abstract";
}

sub readFieldBegin
{
    my ($name, $fieldType, $fieldId);
    die "abstract";
}

sub readFieldEnd
{
    die "abstract";
}

sub readMapBegin
{
    my ($keyType, $valType, $size);
    die "abstract";
}

sub readMapEnd
{
    die "abstract";
}

sub readListBegin
{
    my ($elemType, $size);
    die "abstract";
}

sub readListEnd
{
    die "abstract";
}

sub readSetBegin
{
    my ($elemType, $size);
    die "abstract";
}

sub readSetEnd
{
    die "abstract";
}

sub readBool
{
    my ($bool);
    die "abstract";
}

sub readByte
{
    my ($byte);
    die "abstract";
}

sub readI16
{
    my ($i16);
    die "abstract";
}

sub readI32
{
    my ($i32);
    die "abstract";
}

sub readI64
{
    my ($i64);
    die "abstract";
}

sub readDouble
{
    my ($dub);
    die "abstract";
}

sub readString
{
    my ($str);
    die "abstract";
}

#
# The skip function is a utility to parse over unrecognized data without
# causing corruption.
#
# @param TType $type What type is it
#
sub skip
{
    my $self = shift;
    my $type = shift;

    my $ref;
    my $result;
    my $i;

    if($type == TType::BOOL)
    {
        return $self->readBool(\$ref);
    }
    elsif($type == TType::BYTE){
        return $self->readByte(\$ref);
    }
    elsif($type == TType::I16){
        return $self->readI16(\$ref);
    }
    elsif($type == TType::I32){
        return $self->readI32(\$ref);
    }
    elsif($type == TType::I64){
        return $self->readI64(\$ref);
    }
    elsif($type == TType::DOUBLE){
        return $self->readDouble(\$ref);
    }
    elsif($type == TType::STRING)
    {
        return $self->readString(\$ref);
    }
    elsif($type == TType::STRUCT)
    {
        $result = $self->readStructBegin(\$ref);
        while (1) {
            my ($ftype,$fid);
            $result += $self->readFieldBegin(\$ref, \$ftype, \$fid);
            if ($ftype == TType::STOP) {
                last;
            }
            $result += $self->skip($ftype);
            $result += $self->readFieldEnd();
        }
        $result += $self->readStructEnd();
        return $result;
    }
    elsif($type == TType::MAP)
    {
        my($keyType,$valType,$size);
        $result = $self->readMapBegin(\$keyType, \$valType, \$size);
        for ($i = 0; $i < $size; $i++) {
          $result += $self->skip($keyType);
          $result += $self->skip($valType);
        }
        $result += $self->readMapEnd();
        return $result;
    }
    elsif($type == TType::SET)
    {
        my ($elemType,$size);
        $result = $self->readSetBegin(\$elemType, \$size);
        for ($i = 0; $i < $size; $i++) {
            $result += $self->skip($elemType);
        }
        $result += $self->readSetEnd();
        return $result;
    }
    elsif($type == TType::LIST)
    {
        my ($elemType,$size);
        $result = $self->readListBegin(\$elemType, \$size);
        for ($i = 0; $i < $size; $i++) {
            $result += $self->skip($elemType);
        }
        $result += $self->readListEnd();
        return $result;
    }

    die new Thrift::TException("Type $type not recognised --- corrupt data?");

  }

#
# Utility for skipping binary data
#
# @param TTransport $itrans TTransport object
# @param int        $type   Field type
#
sub skipBinary
{
    my $self   = shift;
    my $itrans = shift;
    my $type   = shift;

    if($type == TType::BOOL)
    {
      return $itrans->readAll(1);
    }
    elsif($type == TType::BYTE)
    {
        return $itrans->readAll(1);
    }
    elsif($type == TType::I16)
    {
        return $itrans->readAll(2);
    }
    elsif($type == TType::I32)
    {
        return $itrans->readAll(4);
    }
    elsif($type == TType::I64)
    {
        return $itrans->readAll(8);
    }
    elsif($type == TType::DOUBLE)
    {
        return $itrans->readAll(8);
    }
    elsif( $type == TType::STRING )
    {
        my @len = unpack('N', $itrans->readAll(4));
        my $len = $len[0];
        if ($len > 0x7fffffff) {
            $len = 0 - (($len - 1) ^ 0xffffffff);
        }
        return 4 + $itrans->readAll($len);
    }
    elsif( $type == TType::STRUCT )
    {
        my $result = 0;
        while (1) {
          my $ftype = 0;
          my $fid = 0;
          my $data = $itrans->readAll(1);
          my @arr = unpack('c', $data);
          $ftype = $arr[0];
          if ($ftype == TType::STOP) {
            last;
          }
          # I16 field id
          $result += $itrans->readAll(2);
          $result += $self->skipBinary($itrans, $ftype);
        }
        return $result;
    }
    elsif($type == TType::MAP)
    {
        # Ktype
        my $data = $itrans->readAll(1);
        my @arr = unpack('c', $data);
        my $ktype = $arr[0];
        # Vtype
        $data = $itrans->readAll(1);
        @arr = unpack('c', $data);
        my $vtype = $arr[0];
        # Size
        $data = $itrans->readAll(4);
        @arr = unpack('N', $data);
        my $size = $arr[0];
        if ($size > 0x7fffffff) {
            $size = 0 - (($size - 1) ^ 0xffffffff);
        }
        my $result = 6;
        for (my $i = 0; $i < $size; $i++) {
            $result += $self->skipBinary($itrans, $ktype);
            $result += $self->skipBinary($itrans, $vtype);
        }
        return $result;
    }
    elsif($type == TType::SET || $type == TType::LIST)
    {
        # Vtype
        my $data = $itrans->readAll(1);
        my @arr = unpack('c', $data);
        my $vtype = $arr[0];
        # Size
        $data = $itrans->readAll(4);
        @arr = unpack('N', $data);
        my $size = $arr[0];
        if ($size > 0x7fffffff) {
            $size = 0 - (($size - 1) ^ 0xffffffff);
        }
        my $result = 5;
        for (my $i = 0; $i < $size; $i++) {
          $result += $self->skipBinary($itrans, $vtype);
        }
        return $result;
    }

    die new Thrift::TException("Type $type not recognised --- corrupt data?");
}

#
# Protocol factory creates protocol objects from transports
#
package TProtocolFactory;


sub new {
    my $classname = shift;
    my $self      = {};

    return bless($self,$classname);
}

#
# Build a protocol from the base transport
#
# @return TProtcol protocol
#
sub getProtocol
{
    my ($trans);
    die "interface";
}


1;
