/**
 * Contains a modified version of std.algorithm.remove that doesn't take an
 * alias parameter to avoid DMD @@BUG6395@@.
 */
module thrift.internal.algorithm;

import std.algorithm : move;
import std.exception;
import std.functional;
import std.range;
import std.traits;

enum SwapStrategy
{
    unstable,
    semistable,
    stable,
}

Range removeEqual(SwapStrategy s = SwapStrategy.stable, Range, E)(Range range, E e)
if (isBidirectionalRange!Range)
{
    auto result = range;
    static if (s != SwapStrategy.stable)
    {
        for (;!range.empty;)
        {
            if (range.front !is e)
            {
                range.popFront;
                continue;
            }
            move(range.back, range.front);
            range.popBack;
            result.popBack;
        }
    }
    else
    {
        auto tgt = range;
        for (; !range.empty; range.popFront)
        {
            if (range.front is e)
            {
                // yank this guy
                result.popBack;
                continue;
            }
            // keep this guy
            move(range.front, tgt.front);
            tgt.popFront;
        }
    }
    return result;
}
