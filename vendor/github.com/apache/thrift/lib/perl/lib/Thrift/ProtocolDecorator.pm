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

use strict;
use warnings;

use Thrift::Protocol;

package Thrift::ProtocolDecorator;
use base qw(Thrift::Protocol);

sub new {
    my $classname = shift;
    my $protocol  = shift;
    my $self      = $classname->SUPER::new($protocol->getTransport());
    
    $self->{concreteProtocol} = $protocol;

    return bless($self,$classname);
}

#
# Writes the message header
#
# @param string $name Function name
# @param int $type message type TMessageType::CALL or TMessageType::REPLY
# @param int $seqid The sequence id of this message
#
sub writeMessageBegin {
    my $self = shift;
    my ($name, $type, $seqid) = @_;
     
      return  $self->{concreteProtocol}->writeMessageBegin($name, $type, $seqid);
}

#
# Close the message
#
sub writeMessageEnd {
     my $self = shift;
     
     return $self->{concreteProtocol}->writeMessageEnd();
}

#
# Writes a struct header.
#
# @param string     $name Struct name
# @throws TException on write error
# @return int How many bytes written
#
sub writeStructBegin {
    my $self = shift;
    my ($name) = @_;

    return $self->{concreteProtocol}->writeStructBegin($name);
}

#
# Close a struct.
#
# @throws TException on write error
# @return int How many bytes written
#
sub writeStructEnd {
    my $self = shift;    

    return $self->{concreteProtocol}->writeStructEnd();
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
    my $self = shift;
    my ($fieldName, $fieldType, $fieldId) = @_;

    return $self->{concreteProtocol}->writeFieldBegin($fieldName, $fieldType, $fieldId);
}

sub writeFieldEnd {
    my $self = shift;    

    return $self->{concreteProtocol}->writeFieldEnd();
}

sub writeFieldStop {
    my $self = shift;    

    return $self->{concreteProtocol}->writeFieldStop();
}

sub writeMapBegin {
    my $self = shift;
    my ($keyType, $valType, $size) = @_;

    return $self->{concreteProtocol}->writeMapBegin($keyType, $valType, $size);
}

sub writeMapEnd {
    my $self = shift;
    
    return $self->{concreteProtocol}->writeMapEnd();
}

sub writeListBegin {
    my $self = shift;
    my ($elemType, $size) = @_;

    return $self->{concreteProtocol}->writeListBegin($elemType, $size);
}

sub writeListEnd {
    my $self = shift;
    
    return $self->{concreteProtocol}->writeListEnd();
}

sub writeSetBegin {
    my $self = shift;
    my ($elemType, $size) = @_;

    return $self->{concreteProtocol}->writeSetBegin($elemType, $size);
}

sub writeSetEnd {
    my $self = shift;
    
    return $self->{concreteProtocol}->writeListEnd();
}

sub writeBool {
    my $self = shift;
    my $bool = shift;

    return $self->{concreteProtocol}->writeBool($bool);
}

sub writeByte {
    my $self = shift;
    my $byte = shift;

    return $self->{concreteProtocol}->writeByte($byte);
}

sub writeI16 {
    my $self = shift;
    my $i16 = shift;

    return $self->{concreteProtocol}->writeI16($i16);
}

sub writeI32 {
    my $self = shift;
    my ($i32) = @_;

    return $self->{concreteProtocol}->writeI32($i32);
 
}

sub writeI64 {
    my $self = shift;
    my $i64 = shift;

    return $self->{concreteProtocol}->writeI64($i64);
}

sub writeDouble {
    my $self = shift;
    my $dub = shift;

    return $self->{concreteProtocol}->writeDouble($dub);
}

sub writeString {
    my $self = shift;
    my $str = shift;

    return $self->{concreteProtocol}->writeString($str);
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
    my $self = shift;
    my ($name, $type, $seqid) = @_;

    return $self->{concreteProtocol}->readMessageBegin($name, $type, $seqid);
}

#
# Read the close of message
#
sub readMessageEnd
{
    my $self = shift;    

    return $self->{concreteProtocol}->readMessageEnd();
}

sub readStructBegin
{
    my $self = shift;
    my $name = shift;

    return $self->{concreteProtocol}->readStructBegin($name);
}

sub readStructEnd
{
    my $self = shift;    

    return $self->{concreteProtocol}->readStructEnd();
}

sub readFieldBegin
{
    my $self = shift;
    my ($name, $fieldType, $fieldId) = @_;

    return $self->{concreteProtocol}->readFieldBegin($name, $fieldType, $fieldId);
}

sub readFieldEnd
{
    my $self = shift;    

    return $self->{concreteProtocol}->readFieldEnd();
}

sub readMapBegin
{
    my $self = shift;
    my ($keyType, $valType, $size) = @_;

    return $self->{concreteProtocol}->readMapBegin($keyType, $valType, $size);
}

sub readMapEnd
{
    my $self = shift;    

    return $self->{concreteProtocol}->readMapEnd();
}

sub readListBegin
{
    my $self = shift;
    my ($elemType, $size) = @_;

    return $self->{concreteProtocol}->readListBegin($elemType, $size);
}

sub readListEnd
{
    my $self = shift;    

    return $self->{concreteProtocol}->readListEnd();
}

sub readSetBegin
{
    my $self = shift;
    my ($elemType, $size) = @_;

    return $self->{concreteProtocol}->readSetBegin($elemType, $size);
}

sub readSetEnd
{
    my $self = shift;    

    return $self->{concreteProtocol}->readSetEnd();
}

sub readBool
{
    my $self = shift;
    my $bool = shift;

    return $self->{concreteProtocol}->readBool($bool);
}

sub readByte
{
    my $self = shift;
    my $byte = shift;

    return $self->{concreteProtocol}->readByte($byte);
}

sub readI16
{
    my $self = shift;
    my $i16 = shift;

    return $self->{concreteProtocol}->readI16($i16);
}

sub readI32
{
    my $self = shift;
    my $i32  = shift;

    return $self->{concreteProtocol}->readI32($i32);
}

sub readI64
{
    my $self = shift;
    my $i64  = shift;

    return $self->{concreteProtocol}->readI64($i64);
}

sub readDouble
{
    my $self = shift;
    my $dub  = shift;

    return $self->{concreteProtocol}->readDouble($dub);
}

sub readString
{
    my $self = shift;
    my $str = shift;

    return $self->{concreteProtocol}->readString($str);
}

1;
