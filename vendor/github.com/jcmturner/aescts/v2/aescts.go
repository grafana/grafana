// Package aescts provides AES CBC CipherText Stealing encryption and decryption methods
package aescts

import (
	"crypto/aes"
	"crypto/cipher"
	"errors"
	"fmt"
)

// Encrypt the message with the key and the initial vector.
// Returns: next iv, ciphertext bytes, error
func Encrypt(key, iv, plaintext []byte) ([]byte, []byte, error) {
	l := len(plaintext)

	block, err := aes.NewCipher(key)
	if err != nil {
		return []byte{}, []byte{}, fmt.Errorf("error creating cipher: %v", err)
	}
	mode := cipher.NewCBCEncrypter(block, iv)

	m := make([]byte, len(plaintext))
	copy(m, plaintext)

	/*For consistency, ciphertext stealing is always used for the last two
	blocks of the data to be encrypted, as in [RC5].  If the data length
	is a multiple of the block size, this is equivalent to plain CBC mode
	with the last two ciphertext blocks swapped.*/
	/*The initial vector carried out from one encryption for use in a
	subsequent encryption is the next-to-last block of the encryption
	output; this is the encrypted form of the last plaintext block.*/
	if l <= aes.BlockSize {
		m, _ = zeroPad(m, aes.BlockSize)
		mode.CryptBlocks(m, m)
		return m, m, nil
	}
	if l%aes.BlockSize == 0 {
		mode.CryptBlocks(m, m)
		iv = m[len(m)-aes.BlockSize:]
		rb, _ := swapLastTwoBlocks(m, aes.BlockSize)
		return iv, rb, nil
	}
	m, _ = zeroPad(m, aes.BlockSize)
	rb, pb, lb, err := tailBlocks(m, aes.BlockSize)
	if err != nil {
		return []byte{}, []byte{}, fmt.Errorf("error tailing blocks: %v", err)
	}
	var ct []byte
	if rb != nil {
		// Encrpt all but the lats 2 blocks and update the rolling iv
		mode.CryptBlocks(rb, rb)
		iv = rb[len(rb)-aes.BlockSize:]
		mode = cipher.NewCBCEncrypter(block, iv)
		ct = append(ct, rb...)
	}
	mode.CryptBlocks(pb, pb)
	mode = cipher.NewCBCEncrypter(block, pb)
	mode.CryptBlocks(lb, lb)
	// Cipher Text Stealing (CTS) - Ref: https://en.wikipedia.org/wiki/Ciphertext_stealing#CBC_ciphertext_stealing
	// Swap the last two cipher blocks
	// Truncate the ciphertext to the length of the original plaintext
	ct = append(ct, lb...)
	ct = append(ct, pb...)
	return lb, ct[:l], nil
}

// Decrypt the ciphertext with the key and the initial vector.
func Decrypt(key, iv, ciphertext []byte) ([]byte, error) {
	// Copy the cipher text as golang slices even when passed by value to this method can result in the backing arrays of the calling code value being updated.
	ct := make([]byte, len(ciphertext))
	copy(ct, ciphertext)
	if len(ct) < aes.BlockSize {
		return []byte{}, fmt.Errorf("ciphertext is not large enough. It is less that one block size. Blocksize:%v; Ciphertext:%v", aes.BlockSize, len(ct))
	}
	// Configure the CBC
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("error creating cipher: %v", err)
	}
	var mode cipher.BlockMode

	//If ciphertext is multiple of blocksize we just need to swap back the last two blocks and then do CBC
	//If the ciphertext is just one block we can't swap so we just decrypt
	if len(ct)%aes.BlockSize == 0 {
		if len(ct) > aes.BlockSize {
			ct, _ = swapLastTwoBlocks(ct, aes.BlockSize)
		}
		mode = cipher.NewCBCDecrypter(block, iv)
		message := make([]byte, len(ct))
		mode.CryptBlocks(message, ct)
		return message[:len(ct)], nil
	}

	// Cipher Text Stealing (CTS) using CBC interface. Ref: https://en.wikipedia.org/wiki/Ciphertext_stealing#CBC_ciphertext_stealing
	// Get ciphertext of the 2nd to last (penultimate) block (cpb), the last block (clb) and the rest (crb)
	crb, cpb, clb, _ := tailBlocks(ct, aes.BlockSize)
	v := make([]byte, len(iv), len(iv))
	copy(v, iv)
	var message []byte
	if crb != nil {
		//If there is more than just the last and the penultimate block we decrypt it and the last bloc of this becomes the iv for later
		rb := make([]byte, len(crb))
		mode = cipher.NewCBCDecrypter(block, v)
		v = crb[len(crb)-aes.BlockSize:]
		mode.CryptBlocks(rb, crb)
		message = append(message, rb...)
	}

	// We need to modify the cipher text
	// Decryt the 2nd to last (penultimate) block with a the original iv
	pb := make([]byte, aes.BlockSize)
	mode = cipher.NewCBCDecrypter(block, iv)
	mode.CryptBlocks(pb, cpb)
	// number of byte needed to pad
	npb := aes.BlockSize - len(ct)%aes.BlockSize
	//pad last block using the number of bytes needed from the tail of the plaintext 2nd to last (penultimate) block
	clb = append(clb, pb[len(pb)-npb:]...)

	// Now decrypt the last block in the penultimate position (iv will be from the crb, if the is no crb it's zeros)
	// iv for the penultimate block decrypted in the last position becomes the modified last block
	lb := make([]byte, aes.BlockSize)
	mode = cipher.NewCBCDecrypter(block, v)
	v = clb
	mode.CryptBlocks(lb, clb)
	message = append(message, lb...)

	// Now decrypt the penultimate block in the last position (iv will be from the modified last block)
	mode = cipher.NewCBCDecrypter(block, v)
	mode.CryptBlocks(cpb, cpb)
	message = append(message, cpb...)

	// Truncate to the size of the original cipher text
	return message[:len(ct)], nil
}

func tailBlocks(b []byte, c int) ([]byte, []byte, []byte, error) {
	if len(b) <= c {
		return []byte{}, []byte{}, []byte{}, errors.New("bytes slice is not larger than one block so cannot tail")
	}
	// Get size of last block
	var lbs int
	if l := len(b) % aes.BlockSize; l == 0 {
		lbs = aes.BlockSize
	} else {
		lbs = l
	}
	// Get last block
	lb := b[len(b)-lbs:]
	// Get 2nd to last (penultimate) block
	pb := b[len(b)-lbs-c : len(b)-lbs]
	if len(b) > 2*c {
		rb := b[:len(b)-lbs-c]
		return rb, pb, lb, nil
	}
	return nil, pb, lb, nil
}

func swapLastTwoBlocks(b []byte, c int) ([]byte, error) {
	rb, pb, lb, err := tailBlocks(b, c)
	if err != nil {
		return nil, err
	}
	var out []byte
	if rb != nil {
		out = append(out, rb...)
	}
	out = append(out, lb...)
	out = append(out, pb...)
	return out, nil
}

// zeroPad pads bytes with zeros to nearest multiple of message size m.
func zeroPad(b []byte, m int) ([]byte, error) {
	if m <= 0 {
		return nil, errors.New("invalid message block size when padding")
	}
	if b == nil || len(b) == 0 {
		return nil, errors.New("data not valid to pad: Zero size")
	}
	if l := len(b) % m; l != 0 {
		n := m - l
		z := make([]byte, n)
		b = append(b, z...)
	}
	return b, nil
}
