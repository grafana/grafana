package sockaddr

import "testing"

func Test_parseWindowsDefaultIfName_new_vs_old(t *testing.T) {
	if !hasPowershell() {
		t.Skip("this test requires powershell.")
		return
	}
	ri, err := NewRouteInfo()
	if err != nil {
		t.Fatalf("bad: %v", err)
	}
	psVer, err1 := ri.GetDefaultInterfaceName()
	legacyVer, err2 := ri.GetDefaultInterfaceNameLegacy()
	if err1 != nil {
		t.Errorf("err != nil for GetDefaultInterfaceName - %v", err1)
	}
	if err2 != nil {
		t.Errorf("err != nil for GetDefaultInterfaceNameLegacy - %v", err2)
	}
	if psVer != legacyVer {
		t.Errorf("got %s; want %s", psVer, legacyVer)
	}
}
