/*
包 qiniupkg.com/x/bytes.v7 提供了 byte slice 相关的功能扩展

NewReader 创建一个 byte slice 的只读流：

	var slice []byte
	...
	r := bytes.NewReader(slice)
	...
	r.Seek(0, 0) // r.SeekToBegin()
	...

和标准库的 bytes.NewReader 不同的是，这里的 Reader 支持 Seek。

NewWriter 创建一个有上限容量的写流：

	slice := make([]byte, 1024)
	w := bytes.NewWriter(slice)
	...
	writtenData := w.Bytes()

如果我们向 w 里面写入超过 1024 字节的数据，那么多余的数据会被丢弃。

NewBuffer 创建一个可随机读写的内存文件，支持 ReadAt/WriteAt 方法，而不是 Read/Write:

	b := bytes.NewBuffer()
	b.Truncate(100)
	b.WriteAt([]byte("hello"), 100)
	slice := make([]byte, 105)
	n, err := b.ReadAt(slice, 0)
	...
*/
package bytes

