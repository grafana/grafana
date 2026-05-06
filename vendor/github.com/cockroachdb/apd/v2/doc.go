// Copyright 2016 The Cockroach Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

/*
Package apd implements arbitrary-precision decimals.

apd implements much of the decimal specification from the General
Decimal Arithmetic (http://speleotrove.com/decimal/) description, which
is refered to here as GDA. This is the same specification implemented by
pythons decimal module (https://docs.python.org/2/library/decimal.html)
and GCCs decimal extension.

Features

Panic-free operation. The math/big types don’t return errors, and instead
panic under some conditions that are documented. This requires users to
validate the inputs before using them. Meanwhile, we’d like our decimal
operations to have more failure modes and more input requirements than the
math/big types, so using that API would be difficult. apd instead returns
errors when needed.

Support for standard functions. sqrt, ln, pow, etc.

Accurate and configurable precision. Operations will use enough internal
precision to produce a correct result at the requested precision. Precision
is set by a "context" structure that accompanies the function arguments,
as discussed in the next section.

Good performance. Operations will either be fast enough or will produce an
error if they will be slow. This prevents edge-case operations from consuming
lots of CPU or memory.

Condition flags and traps. All operations will report whether their
result is exact, is rounded, is over- or under-flowed, is subnormal
(https://en.wikipedia.org/wiki/Denormal_number), or is some other
condition. apd supports traps which will trigger an error on any of these
conditions. This makes it possible to guarantee exactness in computations,
if needed.

SQL scan and value methods are implemented. This allows the use of Decimals as
placeholder parameters and row result Scan destinations.

Usage

apd has two main types. The first is Decimal which holds the values of
decimals. It is simple and uses a big.Int with an exponent to describe
values. Most operations on Decimals can’t produce errors as they work
directly on the underlying big.Int. Notably, however, there are no arithmetic
operations on Decimals.

The second main type is Context, which is where all arithmetic operations
are defined. A Context describes the precision, range, and some other
restrictions during operations. These operations can all produce failures,
and so return errors.

Context operations, in addition to errors, return a Condition, which is a
bitfield of flags that occurred during an operation. These include overflow,
underflow, inexact, rounded, and others. The Traps field of a Context can be
set which will produce an error if the corresponding flag occurs. An example
of this is given below.

*/
package apd
