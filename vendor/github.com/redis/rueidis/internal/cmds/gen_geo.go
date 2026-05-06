// Code generated DO NOT EDIT

package cmds

import "strconv"

type Geoadd Incomplete

func (b Builder) Geoadd() (c Geoadd) {
	c = Geoadd{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "GEOADD")
	return c
}

func (c Geoadd) Key(key string) GeoaddKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GeoaddKey)(c)
}

type GeoaddChangeCh Incomplete

func (c GeoaddChangeCh) LongitudeLatitudeMember() GeoaddLongitudeLatitudeMember {
	return (GeoaddLongitudeLatitudeMember)(c)
}

type GeoaddConditionNx Incomplete

func (c GeoaddConditionNx) Ch() GeoaddChangeCh {
	c.cs.s = append(c.cs.s, "CH")
	return (GeoaddChangeCh)(c)
}

func (c GeoaddConditionNx) LongitudeLatitudeMember() GeoaddLongitudeLatitudeMember {
	return (GeoaddLongitudeLatitudeMember)(c)
}

type GeoaddConditionXx Incomplete

func (c GeoaddConditionXx) Ch() GeoaddChangeCh {
	c.cs.s = append(c.cs.s, "CH")
	return (GeoaddChangeCh)(c)
}

func (c GeoaddConditionXx) LongitudeLatitudeMember() GeoaddLongitudeLatitudeMember {
	return (GeoaddLongitudeLatitudeMember)(c)
}

type GeoaddKey Incomplete

func (c GeoaddKey) Nx() GeoaddConditionNx {
	c.cs.s = append(c.cs.s, "NX")
	return (GeoaddConditionNx)(c)
}

func (c GeoaddKey) Xx() GeoaddConditionXx {
	c.cs.s = append(c.cs.s, "XX")
	return (GeoaddConditionXx)(c)
}

func (c GeoaddKey) Ch() GeoaddChangeCh {
	c.cs.s = append(c.cs.s, "CH")
	return (GeoaddChangeCh)(c)
}

func (c GeoaddKey) LongitudeLatitudeMember() GeoaddLongitudeLatitudeMember {
	return (GeoaddLongitudeLatitudeMember)(c)
}

type GeoaddLongitudeLatitudeMember Incomplete

func (c GeoaddLongitudeLatitudeMember) LongitudeLatitudeMember(longitude float64, latitude float64, member string) GeoaddLongitudeLatitudeMember {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(longitude, 'f', -1, 64), strconv.FormatFloat(latitude, 'f', -1, 64), member)
	return c
}

func (c GeoaddLongitudeLatitudeMember) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Geodist Incomplete

func (b Builder) Geodist() (c Geodist) {
	c = Geodist{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "GEODIST")
	return c
}

func (c Geodist) Key(key string) GeodistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GeodistKey)(c)
}

type GeodistKey Incomplete

func (c GeodistKey) Member1(member1 string) GeodistMember1 {
	c.cs.s = append(c.cs.s, member1)
	return (GeodistMember1)(c)
}

type GeodistMember1 Incomplete

func (c GeodistMember1) Member2(member2 string) GeodistMember2 {
	c.cs.s = append(c.cs.s, member2)
	return (GeodistMember2)(c)
}

type GeodistMember2 Incomplete

func (c GeodistMember2) M() GeodistUnitM {
	c.cs.s = append(c.cs.s, "m")
	return (GeodistUnitM)(c)
}

func (c GeodistMember2) Km() GeodistUnitKm {
	c.cs.s = append(c.cs.s, "km")
	return (GeodistUnitKm)(c)
}

func (c GeodistMember2) Ft() GeodistUnitFt {
	c.cs.s = append(c.cs.s, "ft")
	return (GeodistUnitFt)(c)
}

func (c GeodistMember2) Mi() GeodistUnitMi {
	c.cs.s = append(c.cs.s, "mi")
	return (GeodistUnitMi)(c)
}

func (c GeodistMember2) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeodistMember2) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeodistUnitFt Incomplete

func (c GeodistUnitFt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeodistUnitFt) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeodistUnitKm Incomplete

func (c GeodistUnitKm) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeodistUnitKm) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeodistUnitM Incomplete

func (c GeodistUnitM) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeodistUnitM) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeodistUnitMi Incomplete

func (c GeodistUnitMi) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeodistUnitMi) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Geohash Incomplete

func (b Builder) Geohash() (c Geohash) {
	c = Geohash{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "GEOHASH")
	return c
}

func (c Geohash) Key(key string) GeohashKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GeohashKey)(c)
}

type GeohashKey Incomplete

func (c GeohashKey) Member(member ...string) GeohashMember {
	c.cs.s = append(c.cs.s, member...)
	return (GeohashMember)(c)
}

func (c GeohashKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeohashKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeohashMember Incomplete

func (c GeohashMember) Member(member ...string) GeohashMember {
	c.cs.s = append(c.cs.s, member...)
	return c
}

func (c GeohashMember) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeohashMember) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Geopos Incomplete

func (b Builder) Geopos() (c Geopos) {
	c = Geopos{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "GEOPOS")
	return c
}

func (c Geopos) Key(key string) GeoposKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GeoposKey)(c)
}

type GeoposKey Incomplete

func (c GeoposKey) Member(member ...string) GeoposMember {
	c.cs.s = append(c.cs.s, member...)
	return (GeoposMember)(c)
}

func (c GeoposKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoposKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoposMember Incomplete

func (c GeoposMember) Member(member ...string) GeoposMember {
	c.cs.s = append(c.cs.s, member...)
	return c
}

func (c GeoposMember) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoposMember) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Georadius Incomplete

func (b Builder) Georadius() (c Georadius) {
	c = Georadius{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "GEORADIUS")
	return c
}

func (c Georadius) Key(key string) GeoradiusKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GeoradiusKey)(c)
}

type GeoradiusCountAny Incomplete

func (c GeoradiusCountAny) Asc() GeoradiusOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusOrderAsc)(c)
}

func (c GeoradiusCountAny) Desc() GeoradiusOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusOrderDesc)(c)
}

func (c GeoradiusCountAny) Store(key string) GeoradiusStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusStoreKey)(c)
}

func (c GeoradiusCountAny) Storedist(key string) GeoradiusStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusStoredistKey)(c)
}

func (c GeoradiusCountAny) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusCountCount Incomplete

func (c GeoradiusCountCount) Any() GeoradiusCountAny {
	c.cs.s = append(c.cs.s, "ANY")
	return (GeoradiusCountAny)(c)
}

func (c GeoradiusCountCount) Asc() GeoradiusOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusOrderAsc)(c)
}

func (c GeoradiusCountCount) Desc() GeoradiusOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusOrderDesc)(c)
}

func (c GeoradiusCountCount) Store(key string) GeoradiusStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusStoreKey)(c)
}

func (c GeoradiusCountCount) Storedist(key string) GeoradiusStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusStoredistKey)(c)
}

func (c GeoradiusCountCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusKey Incomplete

func (c GeoradiusKey) Longitude(longitude float64) GeoradiusLongitude {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(longitude, 'f', -1, 64))
	return (GeoradiusLongitude)(c)
}

type GeoradiusLatitude Incomplete

func (c GeoradiusLatitude) Radius(radius float64) GeoradiusRadius {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(radius, 'f', -1, 64))
	return (GeoradiusRadius)(c)
}

type GeoradiusLongitude Incomplete

func (c GeoradiusLongitude) Latitude(latitude float64) GeoradiusLatitude {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(latitude, 'f', -1, 64))
	return (GeoradiusLatitude)(c)
}

type GeoradiusOrderAsc Incomplete

func (c GeoradiusOrderAsc) Store(key string) GeoradiusStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusStoreKey)(c)
}

func (c GeoradiusOrderAsc) Storedist(key string) GeoradiusStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusStoredistKey)(c)
}

func (c GeoradiusOrderAsc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusOrderDesc Incomplete

func (c GeoradiusOrderDesc) Store(key string) GeoradiusStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusStoreKey)(c)
}

func (c GeoradiusOrderDesc) Storedist(key string) GeoradiusStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusStoredistKey)(c)
}

func (c GeoradiusOrderDesc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusRadius Incomplete

func (c GeoradiusRadius) M() GeoradiusUnitM {
	c.cs.s = append(c.cs.s, "m")
	return (GeoradiusUnitM)(c)
}

func (c GeoradiusRadius) Km() GeoradiusUnitKm {
	c.cs.s = append(c.cs.s, "km")
	return (GeoradiusUnitKm)(c)
}

func (c GeoradiusRadius) Ft() GeoradiusUnitFt {
	c.cs.s = append(c.cs.s, "ft")
	return (GeoradiusUnitFt)(c)
}

func (c GeoradiusRadius) Mi() GeoradiusUnitMi {
	c.cs.s = append(c.cs.s, "mi")
	return (GeoradiusUnitMi)(c)
}

type GeoradiusRo Incomplete

func (b Builder) GeoradiusRo() (c GeoradiusRo) {
	c = GeoradiusRo{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "GEORADIUS_RO")
	return c
}

func (c GeoradiusRo) Key(key string) GeoradiusRoKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GeoradiusRoKey)(c)
}

type GeoradiusRoCountAny Incomplete

func (c GeoradiusRoCountAny) Asc() GeoradiusRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusRoOrderAsc)(c)
}

func (c GeoradiusRoCountAny) Desc() GeoradiusRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusRoOrderDesc)(c)
}

func (c GeoradiusRoCountAny) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusRoCountAny) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusRoCountCount Incomplete

func (c GeoradiusRoCountCount) Any() GeoradiusRoCountAny {
	c.cs.s = append(c.cs.s, "ANY")
	return (GeoradiusRoCountAny)(c)
}

func (c GeoradiusRoCountCount) Asc() GeoradiusRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusRoOrderAsc)(c)
}

func (c GeoradiusRoCountCount) Desc() GeoradiusRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusRoOrderDesc)(c)
}

func (c GeoradiusRoCountCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusRoCountCount) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusRoKey Incomplete

func (c GeoradiusRoKey) Longitude(longitude float64) GeoradiusRoLongitude {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(longitude, 'f', -1, 64))
	return (GeoradiusRoLongitude)(c)
}

type GeoradiusRoLatitude Incomplete

func (c GeoradiusRoLatitude) Radius(radius float64) GeoradiusRoRadius {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(radius, 'f', -1, 64))
	return (GeoradiusRoRadius)(c)
}

type GeoradiusRoLongitude Incomplete

func (c GeoradiusRoLongitude) Latitude(latitude float64) GeoradiusRoLatitude {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(latitude, 'f', -1, 64))
	return (GeoradiusRoLatitude)(c)
}

type GeoradiusRoOrderAsc Incomplete

func (c GeoradiusRoOrderAsc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusRoOrderAsc) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusRoOrderDesc Incomplete

func (c GeoradiusRoOrderDesc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusRoOrderDesc) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusRoRadius Incomplete

func (c GeoradiusRoRadius) M() GeoradiusRoUnitM {
	c.cs.s = append(c.cs.s, "m")
	return (GeoradiusRoUnitM)(c)
}

func (c GeoradiusRoRadius) Km() GeoradiusRoUnitKm {
	c.cs.s = append(c.cs.s, "km")
	return (GeoradiusRoUnitKm)(c)
}

func (c GeoradiusRoRadius) Ft() GeoradiusRoUnitFt {
	c.cs.s = append(c.cs.s, "ft")
	return (GeoradiusRoUnitFt)(c)
}

func (c GeoradiusRoRadius) Mi() GeoradiusRoUnitMi {
	c.cs.s = append(c.cs.s, "mi")
	return (GeoradiusRoUnitMi)(c)
}

type GeoradiusRoUnitFt Incomplete

func (c GeoradiusRoUnitFt) Withcoord() GeoradiusRoWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusRoWithcoord)(c)
}

func (c GeoradiusRoUnitFt) Withdist() GeoradiusRoWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusRoWithdist)(c)
}

func (c GeoradiusRoUnitFt) Withhash() GeoradiusRoWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusRoWithhash)(c)
}

func (c GeoradiusRoUnitFt) Count(count int64) GeoradiusRoCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusRoCountCount)(c)
}

func (c GeoradiusRoUnitFt) Asc() GeoradiusRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusRoOrderAsc)(c)
}

func (c GeoradiusRoUnitFt) Desc() GeoradiusRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusRoOrderDesc)(c)
}

func (c GeoradiusRoUnitFt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusRoUnitFt) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusRoUnitKm Incomplete

func (c GeoradiusRoUnitKm) Withcoord() GeoradiusRoWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusRoWithcoord)(c)
}

func (c GeoradiusRoUnitKm) Withdist() GeoradiusRoWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusRoWithdist)(c)
}

func (c GeoradiusRoUnitKm) Withhash() GeoradiusRoWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusRoWithhash)(c)
}

func (c GeoradiusRoUnitKm) Count(count int64) GeoradiusRoCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusRoCountCount)(c)
}

func (c GeoradiusRoUnitKm) Asc() GeoradiusRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusRoOrderAsc)(c)
}

func (c GeoradiusRoUnitKm) Desc() GeoradiusRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusRoOrderDesc)(c)
}

func (c GeoradiusRoUnitKm) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusRoUnitKm) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusRoUnitM Incomplete

func (c GeoradiusRoUnitM) Withcoord() GeoradiusRoWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusRoWithcoord)(c)
}

func (c GeoradiusRoUnitM) Withdist() GeoradiusRoWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusRoWithdist)(c)
}

func (c GeoradiusRoUnitM) Withhash() GeoradiusRoWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusRoWithhash)(c)
}

func (c GeoradiusRoUnitM) Count(count int64) GeoradiusRoCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusRoCountCount)(c)
}

func (c GeoradiusRoUnitM) Asc() GeoradiusRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusRoOrderAsc)(c)
}

func (c GeoradiusRoUnitM) Desc() GeoradiusRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusRoOrderDesc)(c)
}

func (c GeoradiusRoUnitM) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusRoUnitM) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusRoUnitMi Incomplete

func (c GeoradiusRoUnitMi) Withcoord() GeoradiusRoWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusRoWithcoord)(c)
}

func (c GeoradiusRoUnitMi) Withdist() GeoradiusRoWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusRoWithdist)(c)
}

func (c GeoradiusRoUnitMi) Withhash() GeoradiusRoWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusRoWithhash)(c)
}

func (c GeoradiusRoUnitMi) Count(count int64) GeoradiusRoCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusRoCountCount)(c)
}

func (c GeoradiusRoUnitMi) Asc() GeoradiusRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusRoOrderAsc)(c)
}

func (c GeoradiusRoUnitMi) Desc() GeoradiusRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusRoOrderDesc)(c)
}

func (c GeoradiusRoUnitMi) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusRoUnitMi) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusRoWithcoord Incomplete

func (c GeoradiusRoWithcoord) Withdist() GeoradiusRoWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusRoWithdist)(c)
}

func (c GeoradiusRoWithcoord) Withhash() GeoradiusRoWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusRoWithhash)(c)
}

func (c GeoradiusRoWithcoord) Count(count int64) GeoradiusRoCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusRoCountCount)(c)
}

func (c GeoradiusRoWithcoord) Asc() GeoradiusRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusRoOrderAsc)(c)
}

func (c GeoradiusRoWithcoord) Desc() GeoradiusRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusRoOrderDesc)(c)
}

func (c GeoradiusRoWithcoord) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusRoWithcoord) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusRoWithdist Incomplete

func (c GeoradiusRoWithdist) Withhash() GeoradiusRoWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusRoWithhash)(c)
}

func (c GeoradiusRoWithdist) Count(count int64) GeoradiusRoCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusRoCountCount)(c)
}

func (c GeoradiusRoWithdist) Asc() GeoradiusRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusRoOrderAsc)(c)
}

func (c GeoradiusRoWithdist) Desc() GeoradiusRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusRoOrderDesc)(c)
}

func (c GeoradiusRoWithdist) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusRoWithdist) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusRoWithhash Incomplete

func (c GeoradiusRoWithhash) Count(count int64) GeoradiusRoCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusRoCountCount)(c)
}

func (c GeoradiusRoWithhash) Asc() GeoradiusRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusRoOrderAsc)(c)
}

func (c GeoradiusRoWithhash) Desc() GeoradiusRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusRoOrderDesc)(c)
}

func (c GeoradiusRoWithhash) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusRoWithhash) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusStoreKey Incomplete

func (c GeoradiusStoreKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusStoredistKey Incomplete

func (c GeoradiusStoredistKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusUnitFt Incomplete

func (c GeoradiusUnitFt) Withcoord() GeoradiusWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusWithcoord)(c)
}

func (c GeoradiusUnitFt) Withdist() GeoradiusWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusWithdist)(c)
}

func (c GeoradiusUnitFt) Withhash() GeoradiusWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusWithhash)(c)
}

func (c GeoradiusUnitFt) Count(count int64) GeoradiusCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusCountCount)(c)
}

func (c GeoradiusUnitFt) Asc() GeoradiusOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusOrderAsc)(c)
}

func (c GeoradiusUnitFt) Desc() GeoradiusOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusOrderDesc)(c)
}

func (c GeoradiusUnitFt) Store(key string) GeoradiusStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusStoreKey)(c)
}

func (c GeoradiusUnitFt) Storedist(key string) GeoradiusStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusStoredistKey)(c)
}

func (c GeoradiusUnitFt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusUnitKm Incomplete

func (c GeoradiusUnitKm) Withcoord() GeoradiusWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusWithcoord)(c)
}

func (c GeoradiusUnitKm) Withdist() GeoradiusWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusWithdist)(c)
}

func (c GeoradiusUnitKm) Withhash() GeoradiusWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusWithhash)(c)
}

func (c GeoradiusUnitKm) Count(count int64) GeoradiusCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusCountCount)(c)
}

func (c GeoradiusUnitKm) Asc() GeoradiusOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusOrderAsc)(c)
}

func (c GeoradiusUnitKm) Desc() GeoradiusOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusOrderDesc)(c)
}

func (c GeoradiusUnitKm) Store(key string) GeoradiusStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusStoreKey)(c)
}

func (c GeoradiusUnitKm) Storedist(key string) GeoradiusStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusStoredistKey)(c)
}

func (c GeoradiusUnitKm) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusUnitM Incomplete

func (c GeoradiusUnitM) Withcoord() GeoradiusWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusWithcoord)(c)
}

func (c GeoradiusUnitM) Withdist() GeoradiusWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusWithdist)(c)
}

func (c GeoradiusUnitM) Withhash() GeoradiusWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusWithhash)(c)
}

func (c GeoradiusUnitM) Count(count int64) GeoradiusCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusCountCount)(c)
}

func (c GeoradiusUnitM) Asc() GeoradiusOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusOrderAsc)(c)
}

func (c GeoradiusUnitM) Desc() GeoradiusOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusOrderDesc)(c)
}

func (c GeoradiusUnitM) Store(key string) GeoradiusStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusStoreKey)(c)
}

func (c GeoradiusUnitM) Storedist(key string) GeoradiusStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusStoredistKey)(c)
}

func (c GeoradiusUnitM) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusUnitMi Incomplete

func (c GeoradiusUnitMi) Withcoord() GeoradiusWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusWithcoord)(c)
}

func (c GeoradiusUnitMi) Withdist() GeoradiusWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusWithdist)(c)
}

func (c GeoradiusUnitMi) Withhash() GeoradiusWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusWithhash)(c)
}

func (c GeoradiusUnitMi) Count(count int64) GeoradiusCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusCountCount)(c)
}

func (c GeoradiusUnitMi) Asc() GeoradiusOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusOrderAsc)(c)
}

func (c GeoradiusUnitMi) Desc() GeoradiusOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusOrderDesc)(c)
}

func (c GeoradiusUnitMi) Store(key string) GeoradiusStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusStoreKey)(c)
}

func (c GeoradiusUnitMi) Storedist(key string) GeoradiusStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusStoredistKey)(c)
}

func (c GeoradiusUnitMi) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusWithcoord Incomplete

func (c GeoradiusWithcoord) Withdist() GeoradiusWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusWithdist)(c)
}

func (c GeoradiusWithcoord) Withhash() GeoradiusWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusWithhash)(c)
}

func (c GeoradiusWithcoord) Count(count int64) GeoradiusCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusCountCount)(c)
}

func (c GeoradiusWithcoord) Asc() GeoradiusOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusOrderAsc)(c)
}

func (c GeoradiusWithcoord) Desc() GeoradiusOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusOrderDesc)(c)
}

func (c GeoradiusWithcoord) Store(key string) GeoradiusStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusStoreKey)(c)
}

func (c GeoradiusWithcoord) Storedist(key string) GeoradiusStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusStoredistKey)(c)
}

func (c GeoradiusWithcoord) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusWithdist Incomplete

func (c GeoradiusWithdist) Withhash() GeoradiusWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusWithhash)(c)
}

func (c GeoradiusWithdist) Count(count int64) GeoradiusCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusCountCount)(c)
}

func (c GeoradiusWithdist) Asc() GeoradiusOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusOrderAsc)(c)
}

func (c GeoradiusWithdist) Desc() GeoradiusOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusOrderDesc)(c)
}

func (c GeoradiusWithdist) Store(key string) GeoradiusStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusStoreKey)(c)
}

func (c GeoradiusWithdist) Storedist(key string) GeoradiusStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusStoredistKey)(c)
}

func (c GeoradiusWithdist) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusWithhash Incomplete

func (c GeoradiusWithhash) Count(count int64) GeoradiusCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusCountCount)(c)
}

func (c GeoradiusWithhash) Asc() GeoradiusOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusOrderAsc)(c)
}

func (c GeoradiusWithhash) Desc() GeoradiusOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusOrderDesc)(c)
}

func (c GeoradiusWithhash) Store(key string) GeoradiusStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusStoreKey)(c)
}

func (c GeoradiusWithhash) Storedist(key string) GeoradiusStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusStoredistKey)(c)
}

func (c GeoradiusWithhash) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Georadiusbymember Incomplete

func (b Builder) Georadiusbymember() (c Georadiusbymember) {
	c = Georadiusbymember{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "GEORADIUSBYMEMBER")
	return c
}

func (c Georadiusbymember) Key(key string) GeoradiusbymemberKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GeoradiusbymemberKey)(c)
}

type GeoradiusbymemberCountAny Incomplete

func (c GeoradiusbymemberCountAny) Asc() GeoradiusbymemberOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberOrderAsc)(c)
}

func (c GeoradiusbymemberCountAny) Desc() GeoradiusbymemberOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberOrderDesc)(c)
}

func (c GeoradiusbymemberCountAny) Store(key string) GeoradiusbymemberStoreStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusbymemberStoreStoreKey)(c)
}

func (c GeoradiusbymemberCountAny) Storedist(key string) GeoradiusbymemberStoreStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusbymemberStoreStoredistKey)(c)
}

func (c GeoradiusbymemberCountAny) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberCountCount Incomplete

func (c GeoradiusbymemberCountCount) Any() GeoradiusbymemberCountAny {
	c.cs.s = append(c.cs.s, "ANY")
	return (GeoradiusbymemberCountAny)(c)
}

func (c GeoradiusbymemberCountCount) Asc() GeoradiusbymemberOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberOrderAsc)(c)
}

func (c GeoradiusbymemberCountCount) Desc() GeoradiusbymemberOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberOrderDesc)(c)
}

func (c GeoradiusbymemberCountCount) Store(key string) GeoradiusbymemberStoreStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusbymemberStoreStoreKey)(c)
}

func (c GeoradiusbymemberCountCount) Storedist(key string) GeoradiusbymemberStoreStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusbymemberStoreStoredistKey)(c)
}

func (c GeoradiusbymemberCountCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberKey Incomplete

func (c GeoradiusbymemberKey) Member(member string) GeoradiusbymemberMember {
	c.cs.s = append(c.cs.s, member)
	return (GeoradiusbymemberMember)(c)
}

type GeoradiusbymemberMember Incomplete

func (c GeoradiusbymemberMember) Radius(radius float64) GeoradiusbymemberRadius {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(radius, 'f', -1, 64))
	return (GeoradiusbymemberRadius)(c)
}

type GeoradiusbymemberOrderAsc Incomplete

func (c GeoradiusbymemberOrderAsc) Store(key string) GeoradiusbymemberStoreStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusbymemberStoreStoreKey)(c)
}

func (c GeoradiusbymemberOrderAsc) Storedist(key string) GeoradiusbymemberStoreStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusbymemberStoreStoredistKey)(c)
}

func (c GeoradiusbymemberOrderAsc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberOrderDesc Incomplete

func (c GeoradiusbymemberOrderDesc) Store(key string) GeoradiusbymemberStoreStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusbymemberStoreStoreKey)(c)
}

func (c GeoradiusbymemberOrderDesc) Storedist(key string) GeoradiusbymemberStoreStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusbymemberStoreStoredistKey)(c)
}

func (c GeoradiusbymemberOrderDesc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberRadius Incomplete

func (c GeoradiusbymemberRadius) M() GeoradiusbymemberUnitM {
	c.cs.s = append(c.cs.s, "m")
	return (GeoradiusbymemberUnitM)(c)
}

func (c GeoradiusbymemberRadius) Km() GeoradiusbymemberUnitKm {
	c.cs.s = append(c.cs.s, "km")
	return (GeoradiusbymemberUnitKm)(c)
}

func (c GeoradiusbymemberRadius) Ft() GeoradiusbymemberUnitFt {
	c.cs.s = append(c.cs.s, "ft")
	return (GeoradiusbymemberUnitFt)(c)
}

func (c GeoradiusbymemberRadius) Mi() GeoradiusbymemberUnitMi {
	c.cs.s = append(c.cs.s, "mi")
	return (GeoradiusbymemberUnitMi)(c)
}

type GeoradiusbymemberRo Incomplete

func (b Builder) GeoradiusbymemberRo() (c GeoradiusbymemberRo) {
	c = GeoradiusbymemberRo{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "GEORADIUSBYMEMBER_RO")
	return c
}

func (c GeoradiusbymemberRo) Key(key string) GeoradiusbymemberRoKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GeoradiusbymemberRoKey)(c)
}

type GeoradiusbymemberRoCountAny Incomplete

func (c GeoradiusbymemberRoCountAny) Asc() GeoradiusbymemberRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberRoOrderAsc)(c)
}

func (c GeoradiusbymemberRoCountAny) Desc() GeoradiusbymemberRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberRoOrderDesc)(c)
}

func (c GeoradiusbymemberRoCountAny) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusbymemberRoCountAny) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberRoCountCount Incomplete

func (c GeoradiusbymemberRoCountCount) Any() GeoradiusbymemberRoCountAny {
	c.cs.s = append(c.cs.s, "ANY")
	return (GeoradiusbymemberRoCountAny)(c)
}

func (c GeoradiusbymemberRoCountCount) Asc() GeoradiusbymemberRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberRoOrderAsc)(c)
}

func (c GeoradiusbymemberRoCountCount) Desc() GeoradiusbymemberRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberRoOrderDesc)(c)
}

func (c GeoradiusbymemberRoCountCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusbymemberRoCountCount) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberRoKey Incomplete

func (c GeoradiusbymemberRoKey) Member(member string) GeoradiusbymemberRoMember {
	c.cs.s = append(c.cs.s, member)
	return (GeoradiusbymemberRoMember)(c)
}

type GeoradiusbymemberRoMember Incomplete

func (c GeoradiusbymemberRoMember) Radius(radius float64) GeoradiusbymemberRoRadius {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(radius, 'f', -1, 64))
	return (GeoradiusbymemberRoRadius)(c)
}

type GeoradiusbymemberRoOrderAsc Incomplete

func (c GeoradiusbymemberRoOrderAsc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusbymemberRoOrderAsc) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberRoOrderDesc Incomplete

func (c GeoradiusbymemberRoOrderDesc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusbymemberRoOrderDesc) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberRoRadius Incomplete

func (c GeoradiusbymemberRoRadius) M() GeoradiusbymemberRoUnitM {
	c.cs.s = append(c.cs.s, "m")
	return (GeoradiusbymemberRoUnitM)(c)
}

func (c GeoradiusbymemberRoRadius) Km() GeoradiusbymemberRoUnitKm {
	c.cs.s = append(c.cs.s, "km")
	return (GeoradiusbymemberRoUnitKm)(c)
}

func (c GeoradiusbymemberRoRadius) Ft() GeoradiusbymemberRoUnitFt {
	c.cs.s = append(c.cs.s, "ft")
	return (GeoradiusbymemberRoUnitFt)(c)
}

func (c GeoradiusbymemberRoRadius) Mi() GeoradiusbymemberRoUnitMi {
	c.cs.s = append(c.cs.s, "mi")
	return (GeoradiusbymemberRoUnitMi)(c)
}

type GeoradiusbymemberRoUnitFt Incomplete

func (c GeoradiusbymemberRoUnitFt) Withcoord() GeoradiusbymemberRoWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusbymemberRoWithcoord)(c)
}

func (c GeoradiusbymemberRoUnitFt) Withdist() GeoradiusbymemberRoWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusbymemberRoWithdist)(c)
}

func (c GeoradiusbymemberRoUnitFt) Withhash() GeoradiusbymemberRoWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusbymemberRoWithhash)(c)
}

func (c GeoradiusbymemberRoUnitFt) Count(count int64) GeoradiusbymemberRoCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusbymemberRoCountCount)(c)
}

func (c GeoradiusbymemberRoUnitFt) Asc() GeoradiusbymemberRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberRoOrderAsc)(c)
}

func (c GeoradiusbymemberRoUnitFt) Desc() GeoradiusbymemberRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberRoOrderDesc)(c)
}

func (c GeoradiusbymemberRoUnitFt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusbymemberRoUnitFt) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberRoUnitKm Incomplete

func (c GeoradiusbymemberRoUnitKm) Withcoord() GeoradiusbymemberRoWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusbymemberRoWithcoord)(c)
}

func (c GeoradiusbymemberRoUnitKm) Withdist() GeoradiusbymemberRoWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusbymemberRoWithdist)(c)
}

func (c GeoradiusbymemberRoUnitKm) Withhash() GeoradiusbymemberRoWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusbymemberRoWithhash)(c)
}

func (c GeoradiusbymemberRoUnitKm) Count(count int64) GeoradiusbymemberRoCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusbymemberRoCountCount)(c)
}

func (c GeoradiusbymemberRoUnitKm) Asc() GeoradiusbymemberRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberRoOrderAsc)(c)
}

func (c GeoradiusbymemberRoUnitKm) Desc() GeoradiusbymemberRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberRoOrderDesc)(c)
}

func (c GeoradiusbymemberRoUnitKm) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusbymemberRoUnitKm) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberRoUnitM Incomplete

func (c GeoradiusbymemberRoUnitM) Withcoord() GeoradiusbymemberRoWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusbymemberRoWithcoord)(c)
}

func (c GeoradiusbymemberRoUnitM) Withdist() GeoradiusbymemberRoWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusbymemberRoWithdist)(c)
}

func (c GeoradiusbymemberRoUnitM) Withhash() GeoradiusbymemberRoWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusbymemberRoWithhash)(c)
}

func (c GeoradiusbymemberRoUnitM) Count(count int64) GeoradiusbymemberRoCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusbymemberRoCountCount)(c)
}

func (c GeoradiusbymemberRoUnitM) Asc() GeoradiusbymemberRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberRoOrderAsc)(c)
}

func (c GeoradiusbymemberRoUnitM) Desc() GeoradiusbymemberRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberRoOrderDesc)(c)
}

func (c GeoradiusbymemberRoUnitM) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusbymemberRoUnitM) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberRoUnitMi Incomplete

func (c GeoradiusbymemberRoUnitMi) Withcoord() GeoradiusbymemberRoWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusbymemberRoWithcoord)(c)
}

func (c GeoradiusbymemberRoUnitMi) Withdist() GeoradiusbymemberRoWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusbymemberRoWithdist)(c)
}

func (c GeoradiusbymemberRoUnitMi) Withhash() GeoradiusbymemberRoWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusbymemberRoWithhash)(c)
}

func (c GeoradiusbymemberRoUnitMi) Count(count int64) GeoradiusbymemberRoCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusbymemberRoCountCount)(c)
}

func (c GeoradiusbymemberRoUnitMi) Asc() GeoradiusbymemberRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberRoOrderAsc)(c)
}

func (c GeoradiusbymemberRoUnitMi) Desc() GeoradiusbymemberRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberRoOrderDesc)(c)
}

func (c GeoradiusbymemberRoUnitMi) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusbymemberRoUnitMi) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberRoWithcoord Incomplete

func (c GeoradiusbymemberRoWithcoord) Withdist() GeoradiusbymemberRoWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusbymemberRoWithdist)(c)
}

func (c GeoradiusbymemberRoWithcoord) Withhash() GeoradiusbymemberRoWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusbymemberRoWithhash)(c)
}

func (c GeoradiusbymemberRoWithcoord) Count(count int64) GeoradiusbymemberRoCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusbymemberRoCountCount)(c)
}

func (c GeoradiusbymemberRoWithcoord) Asc() GeoradiusbymemberRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberRoOrderAsc)(c)
}

func (c GeoradiusbymemberRoWithcoord) Desc() GeoradiusbymemberRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberRoOrderDesc)(c)
}

func (c GeoradiusbymemberRoWithcoord) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusbymemberRoWithcoord) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberRoWithdist Incomplete

func (c GeoradiusbymemberRoWithdist) Withhash() GeoradiusbymemberRoWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusbymemberRoWithhash)(c)
}

func (c GeoradiusbymemberRoWithdist) Count(count int64) GeoradiusbymemberRoCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusbymemberRoCountCount)(c)
}

func (c GeoradiusbymemberRoWithdist) Asc() GeoradiusbymemberRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberRoOrderAsc)(c)
}

func (c GeoradiusbymemberRoWithdist) Desc() GeoradiusbymemberRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberRoOrderDesc)(c)
}

func (c GeoradiusbymemberRoWithdist) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusbymemberRoWithdist) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberRoWithhash Incomplete

func (c GeoradiusbymemberRoWithhash) Count(count int64) GeoradiusbymemberRoCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusbymemberRoCountCount)(c)
}

func (c GeoradiusbymemberRoWithhash) Asc() GeoradiusbymemberRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberRoOrderAsc)(c)
}

func (c GeoradiusbymemberRoWithhash) Desc() GeoradiusbymemberRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberRoOrderDesc)(c)
}

func (c GeoradiusbymemberRoWithhash) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeoradiusbymemberRoWithhash) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberStoreStoreKey Incomplete

func (c GeoradiusbymemberStoreStoreKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberStoreStoredistKey Incomplete

func (c GeoradiusbymemberStoreStoredistKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberUnitFt Incomplete

func (c GeoradiusbymemberUnitFt) Withcoord() GeoradiusbymemberWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusbymemberWithcoord)(c)
}

func (c GeoradiusbymemberUnitFt) Withdist() GeoradiusbymemberWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusbymemberWithdist)(c)
}

func (c GeoradiusbymemberUnitFt) Withhash() GeoradiusbymemberWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusbymemberWithhash)(c)
}

func (c GeoradiusbymemberUnitFt) Count(count int64) GeoradiusbymemberCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusbymemberCountCount)(c)
}

func (c GeoradiusbymemberUnitFt) Asc() GeoradiusbymemberOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberOrderAsc)(c)
}

func (c GeoradiusbymemberUnitFt) Desc() GeoradiusbymemberOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberOrderDesc)(c)
}

func (c GeoradiusbymemberUnitFt) Store(key string) GeoradiusbymemberStoreStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusbymemberStoreStoreKey)(c)
}

func (c GeoradiusbymemberUnitFt) Storedist(key string) GeoradiusbymemberStoreStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusbymemberStoreStoredistKey)(c)
}

func (c GeoradiusbymemberUnitFt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberUnitKm Incomplete

func (c GeoradiusbymemberUnitKm) Withcoord() GeoradiusbymemberWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusbymemberWithcoord)(c)
}

func (c GeoradiusbymemberUnitKm) Withdist() GeoradiusbymemberWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusbymemberWithdist)(c)
}

func (c GeoradiusbymemberUnitKm) Withhash() GeoradiusbymemberWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusbymemberWithhash)(c)
}

func (c GeoradiusbymemberUnitKm) Count(count int64) GeoradiusbymemberCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusbymemberCountCount)(c)
}

func (c GeoradiusbymemberUnitKm) Asc() GeoradiusbymemberOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberOrderAsc)(c)
}

func (c GeoradiusbymemberUnitKm) Desc() GeoradiusbymemberOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberOrderDesc)(c)
}

func (c GeoradiusbymemberUnitKm) Store(key string) GeoradiusbymemberStoreStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusbymemberStoreStoreKey)(c)
}

func (c GeoradiusbymemberUnitKm) Storedist(key string) GeoradiusbymemberStoreStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusbymemberStoreStoredistKey)(c)
}

func (c GeoradiusbymemberUnitKm) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberUnitM Incomplete

func (c GeoradiusbymemberUnitM) Withcoord() GeoradiusbymemberWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusbymemberWithcoord)(c)
}

func (c GeoradiusbymemberUnitM) Withdist() GeoradiusbymemberWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusbymemberWithdist)(c)
}

func (c GeoradiusbymemberUnitM) Withhash() GeoradiusbymemberWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusbymemberWithhash)(c)
}

func (c GeoradiusbymemberUnitM) Count(count int64) GeoradiusbymemberCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusbymemberCountCount)(c)
}

func (c GeoradiusbymemberUnitM) Asc() GeoradiusbymemberOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberOrderAsc)(c)
}

func (c GeoradiusbymemberUnitM) Desc() GeoradiusbymemberOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberOrderDesc)(c)
}

func (c GeoradiusbymemberUnitM) Store(key string) GeoradiusbymemberStoreStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusbymemberStoreStoreKey)(c)
}

func (c GeoradiusbymemberUnitM) Storedist(key string) GeoradiusbymemberStoreStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusbymemberStoreStoredistKey)(c)
}

func (c GeoradiusbymemberUnitM) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberUnitMi Incomplete

func (c GeoradiusbymemberUnitMi) Withcoord() GeoradiusbymemberWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeoradiusbymemberWithcoord)(c)
}

func (c GeoradiusbymemberUnitMi) Withdist() GeoradiusbymemberWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusbymemberWithdist)(c)
}

func (c GeoradiusbymemberUnitMi) Withhash() GeoradiusbymemberWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusbymemberWithhash)(c)
}

func (c GeoradiusbymemberUnitMi) Count(count int64) GeoradiusbymemberCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusbymemberCountCount)(c)
}

func (c GeoradiusbymemberUnitMi) Asc() GeoradiusbymemberOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberOrderAsc)(c)
}

func (c GeoradiusbymemberUnitMi) Desc() GeoradiusbymemberOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberOrderDesc)(c)
}

func (c GeoradiusbymemberUnitMi) Store(key string) GeoradiusbymemberStoreStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusbymemberStoreStoreKey)(c)
}

func (c GeoradiusbymemberUnitMi) Storedist(key string) GeoradiusbymemberStoreStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusbymemberStoreStoredistKey)(c)
}

func (c GeoradiusbymemberUnitMi) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberWithcoord Incomplete

func (c GeoradiusbymemberWithcoord) Withdist() GeoradiusbymemberWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeoradiusbymemberWithdist)(c)
}

func (c GeoradiusbymemberWithcoord) Withhash() GeoradiusbymemberWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusbymemberWithhash)(c)
}

func (c GeoradiusbymemberWithcoord) Count(count int64) GeoradiusbymemberCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusbymemberCountCount)(c)
}

func (c GeoradiusbymemberWithcoord) Asc() GeoradiusbymemberOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberOrderAsc)(c)
}

func (c GeoradiusbymemberWithcoord) Desc() GeoradiusbymemberOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberOrderDesc)(c)
}

func (c GeoradiusbymemberWithcoord) Store(key string) GeoradiusbymemberStoreStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusbymemberStoreStoreKey)(c)
}

func (c GeoradiusbymemberWithcoord) Storedist(key string) GeoradiusbymemberStoreStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusbymemberStoreStoredistKey)(c)
}

func (c GeoradiusbymemberWithcoord) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberWithdist Incomplete

func (c GeoradiusbymemberWithdist) Withhash() GeoradiusbymemberWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeoradiusbymemberWithhash)(c)
}

func (c GeoradiusbymemberWithdist) Count(count int64) GeoradiusbymemberCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusbymemberCountCount)(c)
}

func (c GeoradiusbymemberWithdist) Asc() GeoradiusbymemberOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberOrderAsc)(c)
}

func (c GeoradiusbymemberWithdist) Desc() GeoradiusbymemberOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberOrderDesc)(c)
}

func (c GeoradiusbymemberWithdist) Store(key string) GeoradiusbymemberStoreStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusbymemberStoreStoreKey)(c)
}

func (c GeoradiusbymemberWithdist) Storedist(key string) GeoradiusbymemberStoreStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusbymemberStoreStoredistKey)(c)
}

func (c GeoradiusbymemberWithdist) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeoradiusbymemberWithhash Incomplete

func (c GeoradiusbymemberWithhash) Count(count int64) GeoradiusbymemberCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeoradiusbymemberCountCount)(c)
}

func (c GeoradiusbymemberWithhash) Asc() GeoradiusbymemberOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeoradiusbymemberOrderAsc)(c)
}

func (c GeoradiusbymemberWithhash) Desc() GeoradiusbymemberOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeoradiusbymemberOrderDesc)(c)
}

func (c GeoradiusbymemberWithhash) Store(key string) GeoradiusbymemberStoreStoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STORE", key)
	return (GeoradiusbymemberStoreStoreKey)(c)
}

func (c GeoradiusbymemberWithhash) Storedist(key string) GeoradiusbymemberStoreStoredistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, "STOREDIST", key)
	return (GeoradiusbymemberStoreStoredistKey)(c)
}

func (c GeoradiusbymemberWithhash) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Geosearch Incomplete

func (b Builder) Geosearch() (c Geosearch) {
	c = Geosearch{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "GEOSEARCH")
	return c
}

func (c Geosearch) Key(key string) GeosearchKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GeosearchKey)(c)
}

type GeosearchCircleBoxBybox Incomplete

func (c GeosearchCircleBoxBybox) Height(height float64) GeosearchCircleBoxHeight {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(height, 'f', -1, 64))
	return (GeosearchCircleBoxHeight)(c)
}

type GeosearchCircleBoxHeight Incomplete

func (c GeosearchCircleBoxHeight) M() GeosearchCircleBoxUnitM {
	c.cs.s = append(c.cs.s, "m")
	return (GeosearchCircleBoxUnitM)(c)
}

func (c GeosearchCircleBoxHeight) Km() GeosearchCircleBoxUnitKm {
	c.cs.s = append(c.cs.s, "km")
	return (GeosearchCircleBoxUnitKm)(c)
}

func (c GeosearchCircleBoxHeight) Ft() GeosearchCircleBoxUnitFt {
	c.cs.s = append(c.cs.s, "ft")
	return (GeosearchCircleBoxUnitFt)(c)
}

func (c GeosearchCircleBoxHeight) Mi() GeosearchCircleBoxUnitMi {
	c.cs.s = append(c.cs.s, "mi")
	return (GeosearchCircleBoxUnitMi)(c)
}

type GeosearchCircleBoxUnitFt Incomplete

func (c GeosearchCircleBoxUnitFt) Asc() GeosearchOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchOrderAsc)(c)
}

func (c GeosearchCircleBoxUnitFt) Desc() GeosearchOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchOrderDesc)(c)
}

func (c GeosearchCircleBoxUnitFt) Count(count int64) GeosearchCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchCountCount)(c)
}

func (c GeosearchCircleBoxUnitFt) Withcoord() GeosearchWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeosearchWithcoord)(c)
}

func (c GeosearchCircleBoxUnitFt) Withdist() GeosearchWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeosearchWithdist)(c)
}

func (c GeosearchCircleBoxUnitFt) Withhash() GeosearchWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeosearchWithhash)(c)
}

func (c GeosearchCircleBoxUnitFt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchCircleBoxUnitFt) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchCircleBoxUnitKm Incomplete

func (c GeosearchCircleBoxUnitKm) Asc() GeosearchOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchOrderAsc)(c)
}

func (c GeosearchCircleBoxUnitKm) Desc() GeosearchOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchOrderDesc)(c)
}

func (c GeosearchCircleBoxUnitKm) Count(count int64) GeosearchCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchCountCount)(c)
}

func (c GeosearchCircleBoxUnitKm) Withcoord() GeosearchWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeosearchWithcoord)(c)
}

func (c GeosearchCircleBoxUnitKm) Withdist() GeosearchWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeosearchWithdist)(c)
}

func (c GeosearchCircleBoxUnitKm) Withhash() GeosearchWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeosearchWithhash)(c)
}

func (c GeosearchCircleBoxUnitKm) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchCircleBoxUnitKm) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchCircleBoxUnitM Incomplete

func (c GeosearchCircleBoxUnitM) Asc() GeosearchOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchOrderAsc)(c)
}

func (c GeosearchCircleBoxUnitM) Desc() GeosearchOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchOrderDesc)(c)
}

func (c GeosearchCircleBoxUnitM) Count(count int64) GeosearchCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchCountCount)(c)
}

func (c GeosearchCircleBoxUnitM) Withcoord() GeosearchWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeosearchWithcoord)(c)
}

func (c GeosearchCircleBoxUnitM) Withdist() GeosearchWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeosearchWithdist)(c)
}

func (c GeosearchCircleBoxUnitM) Withhash() GeosearchWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeosearchWithhash)(c)
}

func (c GeosearchCircleBoxUnitM) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchCircleBoxUnitM) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchCircleBoxUnitMi Incomplete

func (c GeosearchCircleBoxUnitMi) Asc() GeosearchOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchOrderAsc)(c)
}

func (c GeosearchCircleBoxUnitMi) Desc() GeosearchOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchOrderDesc)(c)
}

func (c GeosearchCircleBoxUnitMi) Count(count int64) GeosearchCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchCountCount)(c)
}

func (c GeosearchCircleBoxUnitMi) Withcoord() GeosearchWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeosearchWithcoord)(c)
}

func (c GeosearchCircleBoxUnitMi) Withdist() GeosearchWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeosearchWithdist)(c)
}

func (c GeosearchCircleBoxUnitMi) Withhash() GeosearchWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeosearchWithhash)(c)
}

func (c GeosearchCircleBoxUnitMi) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchCircleBoxUnitMi) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchCircleCircleByradius Incomplete

func (c GeosearchCircleCircleByradius) M() GeosearchCircleCircleUnitM {
	c.cs.s = append(c.cs.s, "m")
	return (GeosearchCircleCircleUnitM)(c)
}

func (c GeosearchCircleCircleByradius) Km() GeosearchCircleCircleUnitKm {
	c.cs.s = append(c.cs.s, "km")
	return (GeosearchCircleCircleUnitKm)(c)
}

func (c GeosearchCircleCircleByradius) Ft() GeosearchCircleCircleUnitFt {
	c.cs.s = append(c.cs.s, "ft")
	return (GeosearchCircleCircleUnitFt)(c)
}

func (c GeosearchCircleCircleByradius) Mi() GeosearchCircleCircleUnitMi {
	c.cs.s = append(c.cs.s, "mi")
	return (GeosearchCircleCircleUnitMi)(c)
}

type GeosearchCircleCircleUnitFt Incomplete

func (c GeosearchCircleCircleUnitFt) Bybox(width float64) GeosearchCircleBoxBybox {
	c.cs.s = append(c.cs.s, "BYBOX", strconv.FormatFloat(width, 'f', -1, 64))
	return (GeosearchCircleBoxBybox)(c)
}

func (c GeosearchCircleCircleUnitFt) Asc() GeosearchOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchOrderAsc)(c)
}

func (c GeosearchCircleCircleUnitFt) Desc() GeosearchOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchOrderDesc)(c)
}

func (c GeosearchCircleCircleUnitFt) Count(count int64) GeosearchCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchCountCount)(c)
}

func (c GeosearchCircleCircleUnitFt) Withcoord() GeosearchWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeosearchWithcoord)(c)
}

func (c GeosearchCircleCircleUnitFt) Withdist() GeosearchWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeosearchWithdist)(c)
}

func (c GeosearchCircleCircleUnitFt) Withhash() GeosearchWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeosearchWithhash)(c)
}

func (c GeosearchCircleCircleUnitFt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchCircleCircleUnitFt) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchCircleCircleUnitKm Incomplete

func (c GeosearchCircleCircleUnitKm) Bybox(width float64) GeosearchCircleBoxBybox {
	c.cs.s = append(c.cs.s, "BYBOX", strconv.FormatFloat(width, 'f', -1, 64))
	return (GeosearchCircleBoxBybox)(c)
}

func (c GeosearchCircleCircleUnitKm) Asc() GeosearchOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchOrderAsc)(c)
}

func (c GeosearchCircleCircleUnitKm) Desc() GeosearchOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchOrderDesc)(c)
}

func (c GeosearchCircleCircleUnitKm) Count(count int64) GeosearchCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchCountCount)(c)
}

func (c GeosearchCircleCircleUnitKm) Withcoord() GeosearchWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeosearchWithcoord)(c)
}

func (c GeosearchCircleCircleUnitKm) Withdist() GeosearchWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeosearchWithdist)(c)
}

func (c GeosearchCircleCircleUnitKm) Withhash() GeosearchWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeosearchWithhash)(c)
}

func (c GeosearchCircleCircleUnitKm) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchCircleCircleUnitKm) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchCircleCircleUnitM Incomplete

func (c GeosearchCircleCircleUnitM) Bybox(width float64) GeosearchCircleBoxBybox {
	c.cs.s = append(c.cs.s, "BYBOX", strconv.FormatFloat(width, 'f', -1, 64))
	return (GeosearchCircleBoxBybox)(c)
}

func (c GeosearchCircleCircleUnitM) Asc() GeosearchOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchOrderAsc)(c)
}

func (c GeosearchCircleCircleUnitM) Desc() GeosearchOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchOrderDesc)(c)
}

func (c GeosearchCircleCircleUnitM) Count(count int64) GeosearchCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchCountCount)(c)
}

func (c GeosearchCircleCircleUnitM) Withcoord() GeosearchWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeosearchWithcoord)(c)
}

func (c GeosearchCircleCircleUnitM) Withdist() GeosearchWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeosearchWithdist)(c)
}

func (c GeosearchCircleCircleUnitM) Withhash() GeosearchWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeosearchWithhash)(c)
}

func (c GeosearchCircleCircleUnitM) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchCircleCircleUnitM) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchCircleCircleUnitMi Incomplete

func (c GeosearchCircleCircleUnitMi) Bybox(width float64) GeosearchCircleBoxBybox {
	c.cs.s = append(c.cs.s, "BYBOX", strconv.FormatFloat(width, 'f', -1, 64))
	return (GeosearchCircleBoxBybox)(c)
}

func (c GeosearchCircleCircleUnitMi) Asc() GeosearchOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchOrderAsc)(c)
}

func (c GeosearchCircleCircleUnitMi) Desc() GeosearchOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchOrderDesc)(c)
}

func (c GeosearchCircleCircleUnitMi) Count(count int64) GeosearchCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchCountCount)(c)
}

func (c GeosearchCircleCircleUnitMi) Withcoord() GeosearchWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeosearchWithcoord)(c)
}

func (c GeosearchCircleCircleUnitMi) Withdist() GeosearchWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeosearchWithdist)(c)
}

func (c GeosearchCircleCircleUnitMi) Withhash() GeosearchWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeosearchWithhash)(c)
}

func (c GeosearchCircleCircleUnitMi) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchCircleCircleUnitMi) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchCountAny Incomplete

func (c GeosearchCountAny) Withcoord() GeosearchWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeosearchWithcoord)(c)
}

func (c GeosearchCountAny) Withdist() GeosearchWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeosearchWithdist)(c)
}

func (c GeosearchCountAny) Withhash() GeosearchWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeosearchWithhash)(c)
}

func (c GeosearchCountAny) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchCountAny) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchCountCount Incomplete

func (c GeosearchCountCount) Any() GeosearchCountAny {
	c.cs.s = append(c.cs.s, "ANY")
	return (GeosearchCountAny)(c)
}

func (c GeosearchCountCount) Withcoord() GeosearchWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeosearchWithcoord)(c)
}

func (c GeosearchCountCount) Withdist() GeosearchWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeosearchWithdist)(c)
}

func (c GeosearchCountCount) Withhash() GeosearchWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeosearchWithhash)(c)
}

func (c GeosearchCountCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchCountCount) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchFrommemberFromlonlat Incomplete

func (c GeosearchFrommemberFromlonlat) Byradius(radius float64) GeosearchCircleCircleByradius {
	c.cs.s = append(c.cs.s, "BYRADIUS", strconv.FormatFloat(radius, 'f', -1, 64))
	return (GeosearchCircleCircleByradius)(c)
}

func (c GeosearchFrommemberFromlonlat) Bybox(width float64) GeosearchCircleBoxBybox {
	c.cs.s = append(c.cs.s, "BYBOX", strconv.FormatFloat(width, 'f', -1, 64))
	return (GeosearchCircleBoxBybox)(c)
}

type GeosearchFrommemberFrommember Incomplete

func (c GeosearchFrommemberFrommember) Fromlonlat(longitude float64, latitude float64) GeosearchFrommemberFromlonlat {
	c.cs.s = append(c.cs.s, "FROMLONLAT", strconv.FormatFloat(longitude, 'f', -1, 64), strconv.FormatFloat(latitude, 'f', -1, 64))
	return (GeosearchFrommemberFromlonlat)(c)
}

func (c GeosearchFrommemberFrommember) Byradius(radius float64) GeosearchCircleCircleByradius {
	c.cs.s = append(c.cs.s, "BYRADIUS", strconv.FormatFloat(radius, 'f', -1, 64))
	return (GeosearchCircleCircleByradius)(c)
}

func (c GeosearchFrommemberFrommember) Bybox(width float64) GeosearchCircleBoxBybox {
	c.cs.s = append(c.cs.s, "BYBOX", strconv.FormatFloat(width, 'f', -1, 64))
	return (GeosearchCircleBoxBybox)(c)
}

type GeosearchKey Incomplete

func (c GeosearchKey) Frommember(member string) GeosearchFrommemberFrommember {
	c.cs.s = append(c.cs.s, "FROMMEMBER", member)
	return (GeosearchFrommemberFrommember)(c)
}

func (c GeosearchKey) Fromlonlat(longitude float64, latitude float64) GeosearchFrommemberFromlonlat {
	c.cs.s = append(c.cs.s, "FROMLONLAT", strconv.FormatFloat(longitude, 'f', -1, 64), strconv.FormatFloat(latitude, 'f', -1, 64))
	return (GeosearchFrommemberFromlonlat)(c)
}

type GeosearchOrderAsc Incomplete

func (c GeosearchOrderAsc) Count(count int64) GeosearchCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchCountCount)(c)
}

func (c GeosearchOrderAsc) Withcoord() GeosearchWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeosearchWithcoord)(c)
}

func (c GeosearchOrderAsc) Withdist() GeosearchWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeosearchWithdist)(c)
}

func (c GeosearchOrderAsc) Withhash() GeosearchWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeosearchWithhash)(c)
}

func (c GeosearchOrderAsc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchOrderAsc) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchOrderDesc Incomplete

func (c GeosearchOrderDesc) Count(count int64) GeosearchCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchCountCount)(c)
}

func (c GeosearchOrderDesc) Withcoord() GeosearchWithcoord {
	c.cs.s = append(c.cs.s, "WITHCOORD")
	return (GeosearchWithcoord)(c)
}

func (c GeosearchOrderDesc) Withdist() GeosearchWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeosearchWithdist)(c)
}

func (c GeosearchOrderDesc) Withhash() GeosearchWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeosearchWithhash)(c)
}

func (c GeosearchOrderDesc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchOrderDesc) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchWithcoord Incomplete

func (c GeosearchWithcoord) Withdist() GeosearchWithdist {
	c.cs.s = append(c.cs.s, "WITHDIST")
	return (GeosearchWithdist)(c)
}

func (c GeosearchWithcoord) Withhash() GeosearchWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeosearchWithhash)(c)
}

func (c GeosearchWithcoord) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchWithcoord) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchWithdist Incomplete

func (c GeosearchWithdist) Withhash() GeosearchWithhash {
	c.cs.s = append(c.cs.s, "WITHHASH")
	return (GeosearchWithhash)(c)
}

func (c GeosearchWithdist) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchWithdist) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchWithhash Incomplete

func (c GeosearchWithhash) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GeosearchWithhash) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Geosearchstore Incomplete

func (b Builder) Geosearchstore() (c Geosearchstore) {
	c = Geosearchstore{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "GEOSEARCHSTORE")
	return c
}

func (c Geosearchstore) Destination(destination string) GeosearchstoreDestination {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, destination)
	return (GeosearchstoreDestination)(c)
}

type GeosearchstoreCircleBoxBybox Incomplete

func (c GeosearchstoreCircleBoxBybox) Height(height float64) GeosearchstoreCircleBoxHeight {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(height, 'f', -1, 64))
	return (GeosearchstoreCircleBoxHeight)(c)
}

type GeosearchstoreCircleBoxHeight Incomplete

func (c GeosearchstoreCircleBoxHeight) M() GeosearchstoreCircleBoxUnitM {
	c.cs.s = append(c.cs.s, "m")
	return (GeosearchstoreCircleBoxUnitM)(c)
}

func (c GeosearchstoreCircleBoxHeight) Km() GeosearchstoreCircleBoxUnitKm {
	c.cs.s = append(c.cs.s, "km")
	return (GeosearchstoreCircleBoxUnitKm)(c)
}

func (c GeosearchstoreCircleBoxHeight) Ft() GeosearchstoreCircleBoxUnitFt {
	c.cs.s = append(c.cs.s, "ft")
	return (GeosearchstoreCircleBoxUnitFt)(c)
}

func (c GeosearchstoreCircleBoxHeight) Mi() GeosearchstoreCircleBoxUnitMi {
	c.cs.s = append(c.cs.s, "mi")
	return (GeosearchstoreCircleBoxUnitMi)(c)
}

type GeosearchstoreCircleBoxUnitFt Incomplete

func (c GeosearchstoreCircleBoxUnitFt) Asc() GeosearchstoreOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchstoreOrderAsc)(c)
}

func (c GeosearchstoreCircleBoxUnitFt) Desc() GeosearchstoreOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchstoreOrderDesc)(c)
}

func (c GeosearchstoreCircleBoxUnitFt) Count(count int64) GeosearchstoreCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchstoreCountCount)(c)
}

func (c GeosearchstoreCircleBoxUnitFt) Storedist() GeosearchstoreStoredist {
	c.cs.s = append(c.cs.s, "STOREDIST")
	return (GeosearchstoreStoredist)(c)
}

func (c GeosearchstoreCircleBoxUnitFt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchstoreCircleBoxUnitKm Incomplete

func (c GeosearchstoreCircleBoxUnitKm) Asc() GeosearchstoreOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchstoreOrderAsc)(c)
}

func (c GeosearchstoreCircleBoxUnitKm) Desc() GeosearchstoreOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchstoreOrderDesc)(c)
}

func (c GeosearchstoreCircleBoxUnitKm) Count(count int64) GeosearchstoreCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchstoreCountCount)(c)
}

func (c GeosearchstoreCircleBoxUnitKm) Storedist() GeosearchstoreStoredist {
	c.cs.s = append(c.cs.s, "STOREDIST")
	return (GeosearchstoreStoredist)(c)
}

func (c GeosearchstoreCircleBoxUnitKm) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchstoreCircleBoxUnitM Incomplete

func (c GeosearchstoreCircleBoxUnitM) Asc() GeosearchstoreOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchstoreOrderAsc)(c)
}

func (c GeosearchstoreCircleBoxUnitM) Desc() GeosearchstoreOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchstoreOrderDesc)(c)
}

func (c GeosearchstoreCircleBoxUnitM) Count(count int64) GeosearchstoreCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchstoreCountCount)(c)
}

func (c GeosearchstoreCircleBoxUnitM) Storedist() GeosearchstoreStoredist {
	c.cs.s = append(c.cs.s, "STOREDIST")
	return (GeosearchstoreStoredist)(c)
}

func (c GeosearchstoreCircleBoxUnitM) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchstoreCircleBoxUnitMi Incomplete

func (c GeosearchstoreCircleBoxUnitMi) Asc() GeosearchstoreOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchstoreOrderAsc)(c)
}

func (c GeosearchstoreCircleBoxUnitMi) Desc() GeosearchstoreOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchstoreOrderDesc)(c)
}

func (c GeosearchstoreCircleBoxUnitMi) Count(count int64) GeosearchstoreCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchstoreCountCount)(c)
}

func (c GeosearchstoreCircleBoxUnitMi) Storedist() GeosearchstoreStoredist {
	c.cs.s = append(c.cs.s, "STOREDIST")
	return (GeosearchstoreStoredist)(c)
}

func (c GeosearchstoreCircleBoxUnitMi) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchstoreCircleCircleByradius Incomplete

func (c GeosearchstoreCircleCircleByradius) M() GeosearchstoreCircleCircleUnitM {
	c.cs.s = append(c.cs.s, "m")
	return (GeosearchstoreCircleCircleUnitM)(c)
}

func (c GeosearchstoreCircleCircleByradius) Km() GeosearchstoreCircleCircleUnitKm {
	c.cs.s = append(c.cs.s, "km")
	return (GeosearchstoreCircleCircleUnitKm)(c)
}

func (c GeosearchstoreCircleCircleByradius) Ft() GeosearchstoreCircleCircleUnitFt {
	c.cs.s = append(c.cs.s, "ft")
	return (GeosearchstoreCircleCircleUnitFt)(c)
}

func (c GeosearchstoreCircleCircleByradius) Mi() GeosearchstoreCircleCircleUnitMi {
	c.cs.s = append(c.cs.s, "mi")
	return (GeosearchstoreCircleCircleUnitMi)(c)
}

type GeosearchstoreCircleCircleUnitFt Incomplete

func (c GeosearchstoreCircleCircleUnitFt) Bybox(width float64) GeosearchstoreCircleBoxBybox {
	c.cs.s = append(c.cs.s, "BYBOX", strconv.FormatFloat(width, 'f', -1, 64))
	return (GeosearchstoreCircleBoxBybox)(c)
}

func (c GeosearchstoreCircleCircleUnitFt) Asc() GeosearchstoreOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchstoreOrderAsc)(c)
}

func (c GeosearchstoreCircleCircleUnitFt) Desc() GeosearchstoreOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchstoreOrderDesc)(c)
}

func (c GeosearchstoreCircleCircleUnitFt) Count(count int64) GeosearchstoreCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchstoreCountCount)(c)
}

func (c GeosearchstoreCircleCircleUnitFt) Storedist() GeosearchstoreStoredist {
	c.cs.s = append(c.cs.s, "STOREDIST")
	return (GeosearchstoreStoredist)(c)
}

func (c GeosearchstoreCircleCircleUnitFt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchstoreCircleCircleUnitKm Incomplete

func (c GeosearchstoreCircleCircleUnitKm) Bybox(width float64) GeosearchstoreCircleBoxBybox {
	c.cs.s = append(c.cs.s, "BYBOX", strconv.FormatFloat(width, 'f', -1, 64))
	return (GeosearchstoreCircleBoxBybox)(c)
}

func (c GeosearchstoreCircleCircleUnitKm) Asc() GeosearchstoreOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchstoreOrderAsc)(c)
}

func (c GeosearchstoreCircleCircleUnitKm) Desc() GeosearchstoreOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchstoreOrderDesc)(c)
}

func (c GeosearchstoreCircleCircleUnitKm) Count(count int64) GeosearchstoreCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchstoreCountCount)(c)
}

func (c GeosearchstoreCircleCircleUnitKm) Storedist() GeosearchstoreStoredist {
	c.cs.s = append(c.cs.s, "STOREDIST")
	return (GeosearchstoreStoredist)(c)
}

func (c GeosearchstoreCircleCircleUnitKm) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchstoreCircleCircleUnitM Incomplete

func (c GeosearchstoreCircleCircleUnitM) Bybox(width float64) GeosearchstoreCircleBoxBybox {
	c.cs.s = append(c.cs.s, "BYBOX", strconv.FormatFloat(width, 'f', -1, 64))
	return (GeosearchstoreCircleBoxBybox)(c)
}

func (c GeosearchstoreCircleCircleUnitM) Asc() GeosearchstoreOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchstoreOrderAsc)(c)
}

func (c GeosearchstoreCircleCircleUnitM) Desc() GeosearchstoreOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchstoreOrderDesc)(c)
}

func (c GeosearchstoreCircleCircleUnitM) Count(count int64) GeosearchstoreCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchstoreCountCount)(c)
}

func (c GeosearchstoreCircleCircleUnitM) Storedist() GeosearchstoreStoredist {
	c.cs.s = append(c.cs.s, "STOREDIST")
	return (GeosearchstoreStoredist)(c)
}

func (c GeosearchstoreCircleCircleUnitM) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchstoreCircleCircleUnitMi Incomplete

func (c GeosearchstoreCircleCircleUnitMi) Bybox(width float64) GeosearchstoreCircleBoxBybox {
	c.cs.s = append(c.cs.s, "BYBOX", strconv.FormatFloat(width, 'f', -1, 64))
	return (GeosearchstoreCircleBoxBybox)(c)
}

func (c GeosearchstoreCircleCircleUnitMi) Asc() GeosearchstoreOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (GeosearchstoreOrderAsc)(c)
}

func (c GeosearchstoreCircleCircleUnitMi) Desc() GeosearchstoreOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (GeosearchstoreOrderDesc)(c)
}

func (c GeosearchstoreCircleCircleUnitMi) Count(count int64) GeosearchstoreCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchstoreCountCount)(c)
}

func (c GeosearchstoreCircleCircleUnitMi) Storedist() GeosearchstoreStoredist {
	c.cs.s = append(c.cs.s, "STOREDIST")
	return (GeosearchstoreStoredist)(c)
}

func (c GeosearchstoreCircleCircleUnitMi) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchstoreCountAny Incomplete

func (c GeosearchstoreCountAny) Storedist() GeosearchstoreStoredist {
	c.cs.s = append(c.cs.s, "STOREDIST")
	return (GeosearchstoreStoredist)(c)
}

func (c GeosearchstoreCountAny) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchstoreCountCount Incomplete

func (c GeosearchstoreCountCount) Any() GeosearchstoreCountAny {
	c.cs.s = append(c.cs.s, "ANY")
	return (GeosearchstoreCountAny)(c)
}

func (c GeosearchstoreCountCount) Storedist() GeosearchstoreStoredist {
	c.cs.s = append(c.cs.s, "STOREDIST")
	return (GeosearchstoreStoredist)(c)
}

func (c GeosearchstoreCountCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchstoreDestination Incomplete

func (c GeosearchstoreDestination) Source(source string) GeosearchstoreSource {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(source)
	} else {
		c.ks = check(c.ks, slot(source))
	}
	c.cs.s = append(c.cs.s, source)
	return (GeosearchstoreSource)(c)
}

type GeosearchstoreFrommemberFromlonlat Incomplete

func (c GeosearchstoreFrommemberFromlonlat) Byradius(radius float64) GeosearchstoreCircleCircleByradius {
	c.cs.s = append(c.cs.s, "BYRADIUS", strconv.FormatFloat(radius, 'f', -1, 64))
	return (GeosearchstoreCircleCircleByradius)(c)
}

func (c GeosearchstoreFrommemberFromlonlat) Bybox(width float64) GeosearchstoreCircleBoxBybox {
	c.cs.s = append(c.cs.s, "BYBOX", strconv.FormatFloat(width, 'f', -1, 64))
	return (GeosearchstoreCircleBoxBybox)(c)
}

type GeosearchstoreFrommemberFrommember Incomplete

func (c GeosearchstoreFrommemberFrommember) Fromlonlat(longitude float64, latitude float64) GeosearchstoreFrommemberFromlonlat {
	c.cs.s = append(c.cs.s, "FROMLONLAT", strconv.FormatFloat(longitude, 'f', -1, 64), strconv.FormatFloat(latitude, 'f', -1, 64))
	return (GeosearchstoreFrommemberFromlonlat)(c)
}

func (c GeosearchstoreFrommemberFrommember) Byradius(radius float64) GeosearchstoreCircleCircleByradius {
	c.cs.s = append(c.cs.s, "BYRADIUS", strconv.FormatFloat(radius, 'f', -1, 64))
	return (GeosearchstoreCircleCircleByradius)(c)
}

func (c GeosearchstoreFrommemberFrommember) Bybox(width float64) GeosearchstoreCircleBoxBybox {
	c.cs.s = append(c.cs.s, "BYBOX", strconv.FormatFloat(width, 'f', -1, 64))
	return (GeosearchstoreCircleBoxBybox)(c)
}

type GeosearchstoreOrderAsc Incomplete

func (c GeosearchstoreOrderAsc) Count(count int64) GeosearchstoreCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchstoreCountCount)(c)
}

func (c GeosearchstoreOrderAsc) Storedist() GeosearchstoreStoredist {
	c.cs.s = append(c.cs.s, "STOREDIST")
	return (GeosearchstoreStoredist)(c)
}

func (c GeosearchstoreOrderAsc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchstoreOrderDesc Incomplete

func (c GeosearchstoreOrderDesc) Count(count int64) GeosearchstoreCountCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (GeosearchstoreCountCount)(c)
}

func (c GeosearchstoreOrderDesc) Storedist() GeosearchstoreStoredist {
	c.cs.s = append(c.cs.s, "STOREDIST")
	return (GeosearchstoreStoredist)(c)
}

func (c GeosearchstoreOrderDesc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GeosearchstoreSource Incomplete

func (c GeosearchstoreSource) Frommember(member string) GeosearchstoreFrommemberFrommember {
	c.cs.s = append(c.cs.s, "FROMMEMBER", member)
	return (GeosearchstoreFrommemberFrommember)(c)
}

func (c GeosearchstoreSource) Fromlonlat(longitude float64, latitude float64) GeosearchstoreFrommemberFromlonlat {
	c.cs.s = append(c.cs.s, "FROMLONLAT", strconv.FormatFloat(longitude, 'f', -1, 64), strconv.FormatFloat(latitude, 'f', -1, 64))
	return (GeosearchstoreFrommemberFromlonlat)(c)
}

type GeosearchstoreStoredist Incomplete

func (c GeosearchstoreStoredist) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
