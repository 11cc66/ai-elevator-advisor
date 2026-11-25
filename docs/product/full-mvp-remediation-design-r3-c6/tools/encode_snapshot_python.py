import hashlib
import json
import re
import struct
import sys
import unicodedata
from pathlib import Path

FIELD_SCHEMA = {
    0: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("CANONICAL_ID",),4:("CANONICAL_ID",),5:("CANONICAL_ID",),6:("CANONICAL_ID",),7:("ENUM",),8:("CANONICAL_ID",),9:("CANONICAL_ID",),10:("TEXT",),11:("TIMESTAMP",),12:("ENUM",),13:("ENUM",),14:("ENUM",)},
    1: {1:("TEXT",),2:("ENUM",),3:("BOOLEAN","INTEGER","DECIMAL","TEXT","ENUM","CANONICAL_ID","TIMESTAMP","BYTES","NULL"),4:("TEXT","NULL"),5:("ENUM",),6:("CANONICAL_ID",),7:("ENUM",),8:("ENUM",),9:("CANONICAL_ID",),10:("TEXT","NULL"),11:("BYTES",)},
    2: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("CANONICAL_ID",),4:("CANONICAL_ID",),5:("TEXT",),6:("CANONICAL_ID",),7:("TEXT",),8:("CANONICAL_ID","NULL"),9:("CANONICAL_ID",),10:("ENUM",),11:("ENUM",),12:("ENUM",),13:("ENUM",),14:("ENUM",)},
    3: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("TEXT",),4:("ENUM",),5:("BOOLEAN","INTEGER","DECIMAL","TEXT","ENUM","CANONICAL_ID","TIMESTAMP","BYTES"),6:("TEXT","NULL"),7:("CANONICAL_ID",)},
    4: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("CANONICAL_ID",),4:("CANONICAL_ID",),5:("INTEGER",),6:("ENUM",),7:("ENUM",),8:("ENUM",),9:("ENUM",),10:("TIMESTAMP",),11:("TIMESTAMP","NULL"),12:("TIMESTAMP",)},
    5: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("TEXT",),4:("ENUM",),5:("TIMESTAMP",)},
    6: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("CANONICAL_ID",),4:("CANONICAL_ID",),5:("ENUM",),6:("TIMESTAMP",)},
    7: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("INTEGER",),4:("CANONICAL_ID",),5:("ENUM",),6:("TEXT",),7:("TIMESTAMP",)},
    8: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("INTEGER",),4:("ENUM",),5:("ENUM",),6:("TEXT",)},
    9: {1:("CANONICAL_ID",),2:("TEXT",),3:("ENUM",),4:("ENUM",)},
}

TUPLE_SCHEMA = {
    0:(("snapshotId","ASCII_ID"),),
    1:(("requirementVersionId","ASCII_ID"),("fieldKey","ASCII_KEY")),
    2:(("candidateId","ASCII_ID"),),
    3:(("candidateId","ASCII_ID"),("parameterKey","ASCII_KEY")),
    4:(("candidateId","ASCII_ID"),("priceRevisionId","ASCII_ID")),
    5:(("sourceRevisionId","ASCII_ID"),),
    6:(("catalogReviewId","ASCII_ID"),),
    7:(("professionalReviewId","ASCII_ID"),("eventSequence","INT64")),
    8:(("candidateId","ASCII_ID"),("warningSequence","INT64")),
    9:(("candidateId","ASCII_ID"),("fieldKey","ASCII_KEY")),
}

def u16(n): return struct.pack(">H", n)
def u32(n): return struct.pack(">I", n)
def u64(n): return struct.pack(">Q", n)
def i64(n):
    if not isinstance(n, int) or isinstance(n, bool) or not -(2**63) <= n < 2**63:
        raise ValueError("INT64")
    return struct.pack(">q", n)

def ascii_bytes(v, empty=False):
    if not isinstance(v, str) or (not v and not empty): raise ValueError("ASCII")
    try: b=v.encode("ascii")
    except UnicodeEncodeError as exc: raise ValueError("ASCII") from exc
    if len(b)>64 or any(x<0x20 or x>0x7e for x in b): raise ValueError("ASCII domain")
    return b

def tuple_key(rt, values):
    defs=TUPLE_SCHEMA[rt]
    if len(defs)!=len(values): raise ValueError("tuple arity")
    out=bytearray(b"SKR2"+u16(2)+u16(3)+u16(rt)+u16(len(values)))
    for i,(d,s) in enumerate(zip(defs,values),1):
        if tuple(d)!=tuple(s[:2]): raise ValueError("tuple definition")
        typ,val=s[1],s[2]
        if typ in ("ASCII_ID","ASCII_KEY"):
            pay=ascii_bytes(val,True); tag=1 if typ=="ASCII_ID" else 2
        elif typ=="INT64": pay=i64(val); tag=3
        else: raise ValueError("tuple type")
        out+=u16(i)+bytes([tag,1])+u32(len(pay))+pay
    out+=u16(0xffff)
    if len(out)>158: raise ValueError("stable key length")
    return bytes(out)

def source_key(components):
    if len(components)!=4: raise ValueError("source components")
    out=bytearray(b"SRC3"+u16(3)+u16(4))
    for i,(name,typ,val) in enumerate(components,1):
        if val is None:
            if typ!="UTF8_NULLABLE": raise ValueError("source null")
            tag,pres,pay=0,0,b""
        elif typ=="ASCII":
            tag,pres,pay=1,1,ascii_bytes(val)
        elif typ=="UTF8_NULLABLE":
            if not isinstance(val,str): raise ValueError("source UTF8")
            val=unicodedata.normalize("NFC",val)
            if not val or any(ord(c)<0x20 or 0x7f <= ord(c) <= 0x9f for c in val): raise ValueError("source aux")
            pay=val.encode("utf-8")
            if len(pay)>128: raise ValueError("source aux length")
            tag,pres=2,1
        else: raise ValueError("source type")
        out+=u16(i)+bytes([tag,pres])+u32(len(pay))+pay
    out+=u16(0xffff)
    if len(out)>362: raise ValueError("source key length")
    return bytes(out)

DECIMAL=re.compile(r"^-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?$")
def scalar(f):
    typ,v=f["type"],f.get("value")
    if typ=="NULL": return 0,0,b""
    if typ=="BOOLEAN":
        if not isinstance(v,bool): raise ValueError("boolean")
        return 1,1,bytes([1 if v else 0])
    if typ=="INTEGER": return 2,1,i64(v)
    if typ=="DECIMAL":
        if not isinstance(v,str) or not DECIMAL.fullmatch(v): raise ValueError("decimal")
        if re.fullmatch(r"-0(?:\.0+)?",v): raise ValueError("negative zero")
        whole,_,frac=v.lstrip("-").partition(".")
        if len(whole)>18 or (len(whole)+len(frac))>18: raise ValueError("decimal precision")
        if frac.endswith("0"): raise ValueError("decimal not canonical") if frac else None
        return 3,1,v.encode("ascii")
    if typ=="TEXT":
        if not isinstance(v,str) or v!=unicodedata.normalize("NFC",v) or len(v)>4000 or "\x00" in v:
            raise ValueError("text")
        return 4,1,v.encode("utf-8")
    if typ=="ENUM": return 5,1,ascii_bytes(v)
    if typ=="CANONICAL_ID": return 6,1,ascii_bytes(v)
    if typ=="TIMESTAMP": return 7,1,i64(v)
    if typ=="BYTES":
        if f.get("derive")!="SOURCE_KEY_R3": raise ValueError("bytes derivation")
        pay=source_key(f["sourceComponents"])
        if len(pay)>512: raise ValueError("bytes length")
        return 8,1,pay
    raise ValueError("field type")

def record(fixture,r):
    rt=r["recordType"]; defs=TUPLE_SCHEMA[rt]
    if tuple(tuple(x) for x in fixture["recordTypeDefinitions"][str(rt)]["tuple"])!=defs: raise ValueError("registry tuple")
    key=tuple_key(rt,r["stableKeyTuple"]); row=ascii_bytes(r["rowId"])
    fs=sorted(r["fields"],key=lambda x:x["tag"])
    if set(x["tag"] for x in fs)!=set(FIELD_SCHEMA[rt]) or len(fs)!=len(FIELD_SCHEMA[rt]): raise ValueError("field inventory")
    fb=bytearray()
    for f in fs:
        if f["type"] not in FIELD_SCHEMA[rt][f["tag"]]: raise ValueError("field type")
        tag,pres,pay=scalar(f); fb+=u16(f["tag"])+bytes([tag,pres])+u32(len(pay))+pay
    body=u16(rt)+u16(len(row))+row+u16(len(key))+key+u16(len(fs))+fb
    return u32(len(body)+4)+body,key

def main():
    fixture=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if (fixture["registryVersion"],fixture["protocolVersion"],fixture["stableKeyEncodingVersion"])!=("SNAPSHOT-R3","R3-BASIS-1-R6","SK-R2"): raise ValueError("version")
    encoded=[]
    for r in fixture["records"]:
        b,k=record(fixture,r); encoded.append((r["recordType"],k,r["rowId"].encode(),b,r["rowId"]))
    encoded.sort(key=lambda x:(x[0],x[1],x[2])); body=b"".join(x[3] for x in encoded)
    basis=b"R3BASIS\0"+u16(6)+u16(1)+u32(28)+u32(len(encoded))+u64(len(body))+body
    print(json.dumps({"length":len(basis),"sha256":hashlib.sha256(basis).hexdigest().upper(),"records":[{"recordType":x[0],"rowId":x[4],"stableKeyHex":x[1].hex().upper(),"recordLength":len(x[3])} for x in encoded],"basisHex":basis.hex().upper()},separators=(",",":")))

if __name__=="__main__": main()
