// Package bytebufferpool implements a pool of byte buffers
// with anti-fragmentation protection.
//
// The pool may waste limited amount of memory due to fragmentation.
// This amount equals to the maximum total size of the byte buffers
// in concurrent use.
package bytebufferpool
