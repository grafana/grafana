Typical usage
=============
```
thrift.exe --audit <oldFile> <newFile>
```
Example run
===========
```
> thrift.exe --audit test.thrift break1.thrift
[Thrift Audit Failure:break1.thrift] New Thrift File has missing function base_function3
[Thrift Audit Warning:break1.thrift] Constant const3 has different value
```

Problems that the audit tool can catch
======================================
Errors
* Removing an enum value
* Changing the type of a struct field
* Changing the required-ness of a struct field
* Removing a struct field
* Adding a required struct field
* Adding a struct field 'in the middle'.  This usually indicates an old ID has been recycled
* Struct removed
* Oneway-ness change
* Return type change
* Missing function
* Missing service
* Change in service inheritance

Warnings
* Removing a language namespace declaration
* Changing a namespace
* Changing an enum value's name
* Removing an enum class
* Default value changed
* Struct field name change
* Removed constant
* Type of constant changed
* Value of constant changed
    