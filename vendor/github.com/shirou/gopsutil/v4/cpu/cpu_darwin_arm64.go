// SPDX-License-Identifier: BSD-3-Clause
//go:build darwin && arm64

package cpu

import (
	"encoding/binary"
	"fmt"
	"unsafe"

	"github.com/shirou/gopsutil/v4/internal/common"
)

// https://github.com/shoenig/go-m1cpu/blob/v0.1.6/cpu.go
func getFrequency() (float64, error) {
	ioKit, err := common.NewLibrary(common.IOKit)
	if err != nil {
		return 0, err
	}
	defer ioKit.Close()

	coreFoundation, err := common.NewLibrary(common.CoreFoundation)
	if err != nil {
		return 0, err
	}
	defer coreFoundation.Close()

	ioServiceMatching := common.GetFunc[common.IOServiceMatchingFunc](ioKit, common.IOServiceMatchingSym)
	ioServiceGetMatchingServices := common.GetFunc[common.IOServiceGetMatchingServicesFunc](ioKit, common.IOServiceGetMatchingServicesSym)
	ioIteratorNext := common.GetFunc[common.IOIteratorNextFunc](ioKit, common.IOIteratorNextSym)
	ioRegistryEntryGetName := common.GetFunc[common.IORegistryEntryGetNameFunc](ioKit, common.IORegistryEntryGetNameSym)
	ioRegistryEntryCreateCFProperty := common.GetFunc[common.IORegistryEntryCreateCFPropertyFunc](ioKit, common.IORegistryEntryCreateCFPropertySym)
	ioObjectRelease := common.GetFunc[common.IOObjectReleaseFunc](ioKit, common.IOObjectReleaseSym)

	cfStringCreateWithCString := common.GetFunc[common.CFStringCreateWithCStringFunc](coreFoundation, common.CFStringCreateWithCStringSym)
	cfDataGetLength := common.GetFunc[common.CFDataGetLengthFunc](coreFoundation, common.CFDataGetLengthSym)
	cfDataGetBytePtr := common.GetFunc[common.CFDataGetBytePtrFunc](coreFoundation, common.CFDataGetBytePtrSym)
	cfRelease := common.GetFunc[common.CFReleaseFunc](coreFoundation, common.CFReleaseSym)

	matching := ioServiceMatching("AppleARMIODevice")

	var iterator uint32
	if status := ioServiceGetMatchingServices(common.KIOMainPortDefault, uintptr(matching), &iterator); status != common.KERN_SUCCESS {
		return 0.0, fmt.Errorf("IOServiceGetMatchingServices error=%d", status)
	}
	defer ioObjectRelease(iterator)

	pCorekey := cfStringCreateWithCString(common.KCFAllocatorDefault, "voltage-states5-sram", common.KCFStringEncodingUTF8)
	defer cfRelease(uintptr(pCorekey))

	var pCoreHz uint32
	for {
		service := ioIteratorNext(iterator)
		if !(service > 0) {
			break
		}

		buf := common.NewCStr(512)
		ioRegistryEntryGetName(service, buf)

		if buf.GoString() == "pmgr" {
			pCoreRef := ioRegistryEntryCreateCFProperty(service, uintptr(pCorekey), common.KCFAllocatorDefault, common.KNilOptions)
			length := cfDataGetLength(uintptr(pCoreRef))
			data := cfDataGetBytePtr(uintptr(pCoreRef))

			// composite uint32 from the byte array
			buf := unsafe.Slice((*byte)(data), length)

			// combine the bytes into a uint32 value
			b := buf[length-8 : length-4]
			pCoreHz = binary.LittleEndian.Uint32(b)
			ioObjectRelease(service)
			break
		}

		ioObjectRelease(service)
	}

	return float64(pCoreHz / 1_000_000), nil
}
