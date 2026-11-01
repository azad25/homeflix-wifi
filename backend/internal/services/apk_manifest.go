package services

import (
	"archive/zip"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"unicode/utf16"
)

// APKInfo is what the server needs to know about an uploaded TV app build.
type APKInfo struct {
	Package     string
	VersionCode int64
	VersionName string
}

// Android framework resource ids for the <manifest> attributes we read. Builds
// can strip attribute *names* from the binary XML; the resource ids remain.
const (
	attrVersionCode = 0x0101021b
	attrVersionName = 0x0101021c
)

const (
	chunkStringPool   = 0x0001
	chunkXML          = 0x0003
	chunkResourceMap  = 0x0180
	chunkStartElement = 0x0102

	typeString = 0x03
	typeIntDec = 0x10
	typeIntHex = 0x11

	stringPoolUTF8 = 1 << 8
)

var errNotAPK = errors.New("not an Android app (no AndroidManifest.xml)")

// ReadAPKInfo reads the package name and version from an APK's binary
// AndroidManifest.xml. It has no dependencies beyond the standard library.
func ReadAPKInfo(path string) (APKInfo, error) {
	zr, err := zip.OpenReader(path)
	if err != nil {
		return APKInfo{}, errNotAPK
	}
	defer zr.Close()
	for _, f := range zr.File {
		if f.Name != "AndroidManifest.xml" {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return APKInfo{}, err
		}
		defer rc.Close()
		data, err := io.ReadAll(io.LimitReader(rc, 8<<20))
		if err != nil {
			return APKInfo{}, err
		}
		return parseBinaryManifest(data)
	}
	return APKInfo{}, errNotAPK
}

func parseBinaryManifest(b []byte) (APKInfo, error) {
	le := binary.LittleEndian
	if len(b) < 8 || le.Uint16(b[0:]) != chunkXML {
		return APKInfo{}, errors.New("AndroidManifest.xml is not binary XML")
	}
	var strs []string
	var resIDs []uint32
	off := int(le.Uint16(b[2:])) // skip the XML header
	for off+8 <= len(b) {
		typ := le.Uint16(b[off:])
		hdr := int(le.Uint16(b[off+2:]))
		size := int(le.Uint32(b[off+4:]))
		if size < 8 || off+size > len(b) {
			return APKInfo{}, errors.New("corrupt binary XML chunk")
		}
		chunk := b[off : off+size]
		switch typ {
		case chunkStringPool:
			s, err := parseStringPool(chunk)
			if err != nil {
				return APKInfo{}, err
			}
			strs = s
		case chunkResourceMap:
			for i := hdr; i+4 <= len(chunk); i += 4 {
				resIDs = append(resIDs, le.Uint32(chunk[i:]))
			}
		case chunkStartElement:
			if len(chunk) < hdr+20 {
				return APKInfo{}, errors.New("corrupt start element")
			}
			ext := chunk[hdr:]
			if str(strs, le.Uint32(ext[4:])) != "manifest" {
				break
			}
			attrStart := int(le.Uint16(ext[8:]))
			attrSize := int(le.Uint16(ext[10:]))
			attrCount := int(le.Uint16(ext[12:]))
			var info APKInfo
			for i := 0; i < attrCount; i++ {
				a := hdr + attrStart + i*attrSize
				if a+20 > len(chunk) {
					return APKInfo{}, errors.New("corrupt manifest attributes")
				}
				nameIdx := le.Uint32(chunk[a+4:])
				raw := le.Uint32(chunk[a+8:])
				dataType := chunk[a+15]
				data := le.Uint32(chunk[a+16:])
				var resID uint32
				if int(nameIdx) < len(resIDs) {
					resID = resIDs[nameIdx]
				}
				name := str(strs, nameIdx)
				value := func() string {
					if raw != 0xffffffff {
						return str(strs, raw)
					}
					if dataType == typeString {
						return str(strs, data)
					}
					return ""
				}
				switch {
				case resID == attrVersionCode || name == "versionCode":
					if dataType == typeIntDec || dataType == typeIntHex {
						info.VersionCode = int64(data)
					}
				case resID == attrVersionName || name == "versionName":
					info.VersionName = value()
				case name == "package":
					info.Package = value()
				}
			}
			if info.Package == "" || info.VersionCode <= 0 {
				return APKInfo{}, fmt.Errorf("manifest has no package/versionCode")
			}
			return info, nil
		}
		off += size
	}
	return APKInfo{}, errors.New("no <manifest> element found")
}

func str(strs []string, idx uint32) string {
	if int(idx) < len(strs) {
		return strs[idx]
	}
	return ""
}

func parseStringPool(c []byte) ([]string, error) {
	le := binary.LittleEndian
	if len(c) < 28 {
		return nil, errors.New("corrupt string pool")
	}
	hdr := int(le.Uint16(c[2:]))
	count := int(le.Uint32(c[8:]))
	flags := le.Uint32(c[16:])
	start := int(le.Uint32(c[20:]))
	if count < 0 || hdr+count*4 > len(c) {
		return nil, errors.New("corrupt string pool offsets")
	}
	out := make([]string, count)
	for i := 0; i < count; i++ {
		p := start + int(le.Uint32(c[hdr+i*4:]))
		if p >= len(c) {
			return nil, errors.New("string offset out of range")
		}
		if flags&stringPoolUTF8 != 0 {
			_, n := decodeLen8(c[p:]) // UTF-16 length, unused
			p += n
			l, n := decodeLen8(c[p:])
			p += n
			if p+l > len(c) {
				return nil, errors.New("string out of range")
			}
			out[i] = string(c[p : p+l])
		} else {
			l, n := decodeLen16(c[p:])
			p += n
			if p+2*l > len(c) {
				return nil, errors.New("string out of range")
			}
			u := make([]uint16, l)
			for j := 0; j < l; j++ {
				u[j] = le.Uint16(c[p+2*j:])
			}
			out[i] = string(utf16.Decode(u))
		}
	}
	return out, nil
}

func decodeLen8(b []byte) (int, int) {
	if len(b) == 0 {
		return 0, 1
	}
	if b[0]&0x80 != 0 && len(b) > 1 {
		return int(b[0]&0x7f)<<8 | int(b[1]), 2
	}
	return int(b[0]), 1
}

func decodeLen16(b []byte) (int, int) {
	if len(b) < 2 {
		return 0, 2
	}
	v := int(binary.LittleEndian.Uint16(b))
	if v&0x8000 != 0 && len(b) >= 4 {
		return (v&0x7fff)<<16 | int(binary.LittleEndian.Uint16(b[2:])), 4
	}
	return v, 2
}
