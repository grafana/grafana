{-# OPTIONS_GHC -fno-warn-orphans #-}

module Thrift.Arbitraries where

import Data.Bits()

import Test.QuickCheck.Arbitrary

import Control.Applicative ((<$>))
import Data.Map (Map)
import qualified Data.Map as Map
import qualified Data.Set as Set
import qualified Data.Vector as Vector
import qualified Data.Text.Lazy as Text
import qualified Data.HashSet as HSet
import qualified Data.HashMap.Strict as HMap
import Data.Hashable (Hashable)

import Data.ByteString.Lazy (ByteString)
import qualified Data.ByteString.Lazy as BS

-- String has an Arbitrary instance already
-- Bool has an Arbitrary instance already
-- A Thrift 'list' is a Vector.

instance Arbitrary ByteString where
  arbitrary = BS.pack . filter (/= 0) <$> arbitrary

instance (Arbitrary k) => Arbitrary (Vector.Vector k) where
  arbitrary = Vector.fromList <$> arbitrary

instance Arbitrary Text.Text where
  arbitrary = Text.pack . filter (/= '\0') <$> arbitrary

instance (Eq k, Hashable k, Arbitrary k) => Arbitrary (HSet.HashSet k) where
  arbitrary = HSet.fromList <$> arbitrary

instance (Eq k, Hashable k, Arbitrary k, Arbitrary v) =>
    Arbitrary (HMap.HashMap k v) where
  arbitrary = HMap.fromList <$> arbitrary

{-
   To handle Thrift 'enum' we would ideally use something like:

instance (Enum a, Bounded a) => Arbitrary a
    where arbitrary = elements (enumFromTo minBound maxBound)

Unfortunately this doesn't play nicely with the type system.
Instead we'll generate an arbitrary instance along with the code.
-}

{-
    There might be some way to introspect on the Haskell structure of a
    Thrift 'struct' or 'exception' but generating the code directly is simpler.
-}
