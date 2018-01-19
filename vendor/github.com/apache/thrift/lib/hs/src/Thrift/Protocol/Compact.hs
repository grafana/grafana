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

{-# LANGUAGE CPP #-}
{-# LANGUAGE ExistentialQuantification #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE ScopedTypeVariables #-}

module Thrift.Protocol.Compact
    ( module Thrift.Protocol
    , CompactProtocol(..)
    ) where

import Control.Applicative
import Control.Exception ( throw )
import Control.Monad
import Data.Attoparsec.ByteString as P
import Data.Attoparsec.ByteString.Lazy as LP
import Data.Bits
import Data.ByteString.Lazy.Builder as B
import Data.Int
import Data.List as List
import Data.Monoid
import Data.Word
import Data.Text.Lazy.Encoding ( decodeUtf8, encodeUtf8 )

import Thrift.Protocol hiding (versionMask)
import Thrift.Transport
import Thrift.Types

import qualified Data.ByteString as BS
import qualified Data.ByteString.Lazy as LBS
import qualified Data.HashMap.Strict as Map
import qualified Data.Text.Lazy as LT

-- | the Compact Protocol implements the standard Thrift 'TCompactProcotol'
-- which is similar to the 'TBinaryProtocol', but takes less space on the wire.
-- Integral types are encoded using as varints.
data CompactProtocol a = CompactProtocol a
                         -- ^ Constuct a 'CompactProtocol' with a 'Transport'

protocolID, version, versionMask, typeMask, typeBits :: Word8
protocolID  = 0x82 -- 1000 0010
version     = 0x01
versionMask = 0x1f -- 0001 1111
typeMask    = 0xe0 -- 1110 0000
typeBits    = 0x07 -- 0000 0111
typeShiftAmount :: Int
typeShiftAmount = 5


instance Protocol CompactProtocol where
    getTransport (CompactProtocol t) = t

    writeMessageBegin p (n, t, s) = tWrite (getTransport p) $ toLazyByteString $
      B.word8 protocolID <>
      B.word8 ((version .&. versionMask) .|.
              (((fromIntegral $ fromEnum t) `shiftL`
                typeShiftAmount) .&. typeMask)) <>
      buildVarint (i32ToZigZag s) <>
      buildCompactValue (TString $ encodeUtf8 n)
    
    readMessageBegin p = runParser p $ do
      pid <- fromIntegral <$> P.anyWord8
      when (pid /= protocolID) $ error "Bad Protocol ID"
      w <- fromIntegral <$> P.anyWord8
      let ver = w .&. versionMask 
      when (ver /= version) $ error "Bad Protocol version"
      let typ = (w `shiftR` typeShiftAmount) .&. typeBits
      seqId <- parseVarint zigZagToI32
      TString name <- parseCompactValue T_STRING
      return (decodeUtf8 name, toEnum $ fromIntegral $ typ, seqId)

    serializeVal _ = toLazyByteString . buildCompactValue
    deserializeVal _ ty bs =
      case LP.eitherResult $ LP.parse (parseCompactValue ty) bs of
        Left s -> error s
        Right val -> val

    readVal p ty = runParser p $ parseCompactValue ty


-- | Writing Functions
buildCompactValue :: ThriftVal -> Builder
buildCompactValue (TStruct fields) = buildCompactStruct fields
buildCompactValue (TMap kt vt entries) =
  let len = fromIntegral $ length entries :: Word32 in
  if len == 0
  then B.word8 0x00
  else buildVarint len <>
       B.word8 (fromTType kt `shiftL` 4 .|. fromTType vt) <>
       buildCompactMap entries
buildCompactValue (TList ty entries) =
  let len = length entries in
  (if len < 15
   then B.word8 $ (fromIntegral len `shiftL` 4) .|. fromTType ty
   else B.word8 (0xF0 .|. fromTType ty) <>
        buildVarint (fromIntegral len :: Word32)) <>
  buildCompactList entries
buildCompactValue (TSet ty entries) = buildCompactValue (TList ty entries)
buildCompactValue (TBool b) =
  B.word8 $ toEnum $ if b then 1 else 0
buildCompactValue (TByte b) = int8 b
buildCompactValue (TI16 i) = buildVarint $ i16ToZigZag i
buildCompactValue (TI32 i) = buildVarint $ i32ToZigZag i
buildCompactValue (TI64 i) = buildVarint $ i64ToZigZag i
buildCompactValue (TDouble d) = doubleLE d
buildCompactValue (TString s) = buildVarint len <> lazyByteString s
  where
    len = fromIntegral (LBS.length s) :: Word32
buildCompactValue (TBinary s) = buildCompactValue (TString s)

buildCompactStruct :: Map.HashMap Int16 (LT.Text, ThriftVal) -> Builder
buildCompactStruct = flip (loop 0) mempty . Map.toList
  where
    loop _ [] acc = acc <> B.word8 (fromTType T_STOP)
    loop lastId ((fid, (_,val)) : fields) acc = loop fid fields $ acc <>
      (if fid > lastId && fid - lastId <= 15
       then B.word8 $ fromIntegral ((fid - lastId) `shiftL` 4) .|. typeOf val
       else B.word8 (typeOf val) <> buildVarint (i16ToZigZag fid)) <>
      (if typeOf val > 0x02 -- Not a T_BOOL
       then buildCompactValue val
       else mempty) -- T_BOOLs are encoded in the type
buildCompactMap :: [(ThriftVal, ThriftVal)] -> Builder
buildCompactMap = foldl combine mempty
  where
    combine s (key, val) = buildCompactValue key <> buildCompactValue val <> s

buildCompactList :: [ThriftVal] -> Builder
buildCompactList = foldr (mappend . buildCompactValue) mempty

-- | Reading Functions
parseCompactValue :: ThriftType -> Parser ThriftVal
parseCompactValue (T_STRUCT tmap) = TStruct <$> parseCompactStruct tmap
parseCompactValue (T_MAP kt' vt') = do
  n <- parseVarint id
  if n == 0
    then return $ TMap kt' vt' []
    else do
    w <- P.anyWord8
    let kt = typeFrom $ w `shiftR` 4
        vt = typeFrom $ w .&. 0x0F
    TMap kt vt <$> parseCompactMap kt vt n
parseCompactValue (T_LIST ty) = TList ty <$> parseCompactList
parseCompactValue (T_SET ty) = TSet ty <$> parseCompactList
parseCompactValue T_BOOL = TBool . (/=0) <$> P.anyWord8
parseCompactValue T_BYTE = TByte . fromIntegral <$> P.anyWord8
parseCompactValue T_I16 = TI16 <$> parseVarint zigZagToI16
parseCompactValue T_I32 = TI32 <$> parseVarint zigZagToI32
parseCompactValue T_I64 = TI64 <$> parseVarint zigZagToI64
parseCompactValue T_DOUBLE = TDouble . bsToDoubleLE <$> P.take 8
parseCompactValue T_STRING = parseCompactString TString
parseCompactValue T_BINARY = parseCompactString TBinary
parseCompactValue ty = error $ "Cannot read value of type " ++ show ty

parseCompactString ty = do
  len :: Word32 <- parseVarint id
  ty . LBS.fromStrict <$> P.take (fromIntegral len)

parseCompactStruct :: TypeMap -> Parser (Map.HashMap Int16 (LT.Text, ThriftVal))
parseCompactStruct tmap = Map.fromList <$> parseFields 0
  where
    parseFields :: Int16 -> Parser [(Int16, (LT.Text, ThriftVal))]
    parseFields lastId = do
      w <- P.anyWord8
      if w == 0x00
        then return []
        else do
          let ty = typeFrom (w .&. 0x0F)
              modifier = (w .&. 0xF0) `shiftR` 4
          fid <- if modifier /= 0
                 then return (lastId + fromIntegral modifier)
                 else parseVarint zigZagToI16
          val <- if ty == T_BOOL
                 then return (TBool $ (w .&. 0x0F) == 0x01)
                 else case (ty, Map.lookup fid tmap) of
                        (T_STRING, Just (_, T_BINARY)) -> parseCompactValue T_BINARY
                        _ -> parseCompactValue ty
          ((fid, (LT.empty, val)) : ) <$> parseFields fid

parseCompactMap :: ThriftType -> ThriftType -> Int32 ->
                   Parser [(ThriftVal, ThriftVal)]
parseCompactMap kt vt n | n <= 0 = return []
                        | otherwise = do
  k <- parseCompactValue kt
  v <- parseCompactValue vt
  ((k,v) :) <$> parseCompactMap kt vt (n-1)

parseCompactList :: Parser [ThriftVal]
parseCompactList = do
  w <- P.anyWord8
  let ty = typeFrom $ w .&. 0x0F
      lsize = w `shiftR` 4
  size <- if lsize == 0xF
          then parseVarint id
          else return $ fromIntegral lsize
  loop ty size
  where
    loop :: ThriftType -> Int32 -> Parser [ThriftVal]
    loop ty n | n <= 0 = return []
              | otherwise = liftM2 (:) (parseCompactValue ty)
                            (loop ty (n-1))

-- Signed numbers must be converted to "Zig Zag" format before they can be
-- serialized in the Varint format
i16ToZigZag :: Int16 -> Word16
i16ToZigZag n = fromIntegral $ (n `shiftL` 1) `xor` (n `shiftR` 15)

zigZagToI16 :: Word16 -> Int16
zigZagToI16 n = fromIntegral $ (n `shiftR` 1) `xor` negate (n .&. 0x1)

i32ToZigZag :: Int32 -> Word32
i32ToZigZag n = fromIntegral $ (n `shiftL` 1) `xor` (n `shiftR` 31)

zigZagToI32 :: Word32 -> Int32
zigZagToI32 n = fromIntegral $ (n `shiftR` 1) `xor` negate (n .&. 0x1)

i64ToZigZag :: Int64 -> Word64
i64ToZigZag n = fromIntegral $ (n `shiftL` 1) `xor` (n `shiftR` 63)

zigZagToI64 :: Word64 -> Int64
zigZagToI64 n = fromIntegral $ (n `shiftR` 1) `xor` negate (n .&. 0x1)

buildVarint :: (Bits a, Integral a)  => a -> Builder
buildVarint n | n .&. complement 0x7F == 0 = B.word8 $ fromIntegral n
              | otherwise = B.word8 (0x80 .|. (fromIntegral n .&. 0x7F)) <>
                            buildVarint (n `shiftR` 7)

parseVarint :: (Bits a, Integral a, Ord a) => (a -> b) -> Parser b
parseVarint fromZigZag = do
  bytestemp <- BS.unpack <$> P.takeTill (not . flip testBit 7)
  lsb <- P.anyWord8
  let bytes = lsb : List.reverse bytestemp
  return $ fromZigZag $ List.foldl' combine 0x00 bytes
  where combine a b = (a `shiftL` 7) .|. (fromIntegral b .&. 0x7f)

-- | Compute the Compact Type
fromTType :: ThriftType -> Word8
fromTType ty = case ty of
  T_STOP -> 0x00
  T_BOOL -> 0x01
  T_BYTE -> 0x03
  T_I16 -> 0x04
  T_I32 -> 0x05
  T_I64 -> 0x06
  T_DOUBLE -> 0x07
  T_STRING -> 0x08
  T_BINARY -> 0x08
  T_LIST{} -> 0x09
  T_SET{} -> 0x0A
  T_MAP{} -> 0x0B
  T_STRUCT{} -> 0x0C
  T_VOID -> error "No Compact type for T_VOID"

typeOf :: ThriftVal -> Word8
typeOf v = case v of
  TBool True -> 0x01
  TBool False -> 0x02
  TByte _ -> 0x03
  TI16 _ -> 0x04
  TI32 _ -> 0x05
  TI64 _ -> 0x06
  TDouble _ -> 0x07
  TString _ -> 0x08
  TBinary _ -> 0x08
  TList{} -> 0x09
  TSet{} -> 0x0A
  TMap{} -> 0x0B
  TStruct{} -> 0x0C
  
typeFrom :: Word8 -> ThriftType
typeFrom w = case w of
  0x01 -> T_BOOL
  0x02 -> T_BOOL
  0x03 -> T_BYTE
  0x04 -> T_I16
  0x05 -> T_I32
  0x06 -> T_I64
  0x07 -> T_DOUBLE
  0x08 -> T_STRING
  0x09 -> T_LIST T_VOID
  0x0A -> T_SET T_VOID
  0x0B -> T_MAP T_VOID T_VOID
  0x0C -> T_STRUCT Map.empty
  n -> error $ "typeFrom: " ++ show n ++ " is not a compact type"
