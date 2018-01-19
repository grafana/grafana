# Thrift Coding Standards

   Any fool can write code that a computer can understand.
   Good programmers write code that humans can understand.
                                  -- Martin Fowler, 1999

The purpose of this document is to make everyone's life easier.

It's easier when you read good, well formatted, with clearly defined purpose, code.
But the only way to read clean code is to write such.

This document can help achieve that, but keep in mind that
those are not silver-bullet, fix-all-at-once rules. Just think about readability while writing code.
Write code like you would have to read it in ten years from now.

## General Coding Standards

Thrift has some history. Not all existing code follows those rules.
But we want to improve over time.
When making small change / bugfix - like single line fix - do *not* refactor whole function.
That disturbs code repository history.
Whenever adding something new and / or making bigger refactoring
 - follow those rules as strictly as you can.

When in doubt - contact other developers (using dev@ mailing list or IRC).
Code review is the best way to improve readability.

### Basics
 * Use spaces not tabs
 * Use only ASCII characters in file and directory names
 * Commit to repository using Unix-style line endings (LF)
     On Windows:
       git config core.autocrlf true
 * Maximum line width - 100 characters
 * If not specified otherwise in language specific standard - use 2 spaces as indent/tab

### Comments
 * Each file has to start with comment containing [Apache License](http://www.apache.org/licenses/LICENSE-2.0)
 * Public API of library should be documented, preferably using format native for language specific documentation generation tools (Javadoc, Doxygen etc.)
 * Other comments are discouraged - comments are lies. When one has to make comment it means one failed to write readable code. Instead of "I should write a comment here" think "I should clean it up"
 * Do not leave "TODO/FIXME" comments - file [Jira](http://issues.apache.org/jira/browse/THRIFT) issue instead

### Naming
 Finding proper names is the most important and most difficult task in software development.

## Language Specific Coding Standards

For detailed information see `lib/LANG/coding_standards.md`
