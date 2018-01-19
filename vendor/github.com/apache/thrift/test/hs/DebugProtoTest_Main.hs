--
-- Licensed to the Apache Software Foundation (ASF) under one
-- or more contributor license agreements. See the NOTICE file
-- distributed with this work for additional information
-- regarding copyright ownership. The ASF licenses this file
-- to you under the Apache License, Version 2.0 (the
-- "License"); you may not use this file except in compliance
-- with the License. You may obtain a copy of the License at
--
--   http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing,
-- software distributed under the License is distributed on an
-- "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-- KIND, either express or implied. See the License for the
-- specific language governing permissions and limitations
-- under the License.
--

{-# LANGUAGE OverloadedStrings #-}

module Main where


import qualified Control.Exception
import qualified Data.ByteString.Lazy as DBL
import qualified Data.HashMap.Strict as Map
import qualified Data.HashSet as Set
import qualified Data.Vector as Vector
import qualified Network

import Thrift.Protocol.Binary
import Thrift.Server
import Thrift.Transport.Handle

import qualified ThriftTestUtils

import qualified DebugProtoTest_Types as Types
import qualified Inherited
import qualified Inherited_Client as IClient
import qualified Inherited_Iface as IIface
import qualified Srv_Client as SClient
import qualified Srv_Iface as SIface

-- we don't actually need this import, but force it to check the code generator exports proper Haskell syntax
import qualified Srv()


data InheritedHandler = InheritedHandler
instance SIface.Srv_Iface InheritedHandler where
    janky _ arg = do
        ThriftTestUtils.serverLog $ "Got janky method call: " ++ show arg
        return $ 31

    voidMethod _ = do
        ThriftTestUtils.serverLog "Got voidMethod method call"
        return ()

    primitiveMethod _ = do
        ThriftTestUtils.serverLog "Got primitiveMethod call"
        return $ 42

    structMethod _ = do
        ThriftTestUtils.serverLog "Got structMethod call"
        return $ Types.CompactProtoTestStruct {
            Types.compactProtoTestStruct_a_byte = 0x01,
            Types.compactProtoTestStruct_a_i16 = 0x02,
            Types.compactProtoTestStruct_a_i32 = 0x03,
            Types.compactProtoTestStruct_a_i64 = 0x04,
            Types.compactProtoTestStruct_a_double = 0.1,
            Types.compactProtoTestStruct_a_string = "abcdef",
            Types.compactProtoTestStruct_a_binary = DBL.empty,
            Types.compactProtoTestStruct_true_field = True,
            Types.compactProtoTestStruct_false_field = False,
            Types.compactProtoTestStruct_empty_struct_field = Types.Empty,
            
            Types.compactProtoTestStruct_byte_list = Vector.empty,
            Types.compactProtoTestStruct_i16_list = Vector.empty,
            Types.compactProtoTestStruct_i32_list = Vector.empty,
            Types.compactProtoTestStruct_i64_list = Vector.empty,
            Types.compactProtoTestStruct_double_list = Vector.empty,
            Types.compactProtoTestStruct_string_list = Vector.empty,
            Types.compactProtoTestStruct_binary_list = Vector.empty,
            Types.compactProtoTestStruct_boolean_list = Vector.empty,
            Types.compactProtoTestStruct_struct_list = Vector.empty,

            Types.compactProtoTestStruct_byte_set = Set.empty,
            Types.compactProtoTestStruct_i16_set = Set.empty,
            Types.compactProtoTestStruct_i32_set = Set.empty,
            Types.compactProtoTestStruct_i64_set = Set.empty,
            Types.compactProtoTestStruct_double_set = Set.empty,
            Types.compactProtoTestStruct_string_set = Set.empty,
            Types.compactProtoTestStruct_binary_set = Set.empty,
            Types.compactProtoTestStruct_boolean_set = Set.empty,
            Types.compactProtoTestStruct_struct_set = Set.empty,

            Types.compactProtoTestStruct_byte_byte_map = Map.empty,
            Types.compactProtoTestStruct_i16_byte_map = Map.empty,
            Types.compactProtoTestStruct_i32_byte_map = Map.empty,
            Types.compactProtoTestStruct_i64_byte_map = Map.empty,
            Types.compactProtoTestStruct_double_byte_map = Map.empty,
            Types.compactProtoTestStruct_string_byte_map = Map.empty,
            Types.compactProtoTestStruct_binary_byte_map = Map.empty,
            Types.compactProtoTestStruct_boolean_byte_map = Map.empty,

            Types.compactProtoTestStruct_byte_i16_map = Map.empty,
            Types.compactProtoTestStruct_byte_i32_map = Map.empty,
            Types.compactProtoTestStruct_byte_i64_map = Map.empty,
            Types.compactProtoTestStruct_byte_double_map = Map.empty,
            Types.compactProtoTestStruct_byte_string_map = Map.empty,
            Types.compactProtoTestStruct_byte_binary_map = Map.empty,
            Types.compactProtoTestStruct_byte_boolean_map = Map.empty,

            Types.compactProtoTestStruct_list_byte_map = Map.empty,
            Types.compactProtoTestStruct_set_byte_map = Map.empty,
            Types.compactProtoTestStruct_map_byte_map = Map.empty,

            Types.compactProtoTestStruct_byte_map_map = Map.empty,
            Types.compactProtoTestStruct_byte_set_map = Map.empty,
            Types.compactProtoTestStruct_byte_list_map = Map.empty }

    methodWithDefaultArgs _ arg = do
        ThriftTestUtils.serverLog $ "Got methodWithDefaultArgs: " ++ show arg
        return ()

    onewayMethod _ = do
        ThriftTestUtils.serverLog "Got onewayMethod"

instance IIface.Inherited_Iface InheritedHandler where
    identity _ arg = do
        ThriftTestUtils.serverLog $ "Got identity method: " ++ show arg
        return arg

client :: (String, Network.PortID) -> IO ()
client addr = do
    to <- hOpen addr
    let p =  BinaryProtocol to
    let ps = (p,p)

    v1 <- SClient.janky ps 42
    ThriftTestUtils.clientLog $ show v1

    SClient.voidMethod ps

    v2 <- SClient.primitiveMethod ps
    ThriftTestUtils.clientLog $ show v2

    v3 <- SClient.structMethod ps
    ThriftTestUtils.clientLog $ show v3

    SClient.methodWithDefaultArgs ps 42

    SClient.onewayMethod ps

    v4 <- IClient.identity ps 42
    ThriftTestUtils.clientLog $ show v4

    return ()

server :: Network.PortNumber -> IO ()
server port = do 
    ThriftTestUtils.serverLog "Ready..."
    (runBasicServer InheritedHandler Inherited.process port)
    `Control.Exception.catch`
    (\(TransportExn s _) -> error $ "FAILURE: " ++ show s)

main :: IO ()
main = ThriftTestUtils.runTest server client
