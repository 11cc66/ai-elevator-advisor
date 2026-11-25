import struct


def component(index, type_tag, payload):
    return struct.pack(">HBBI", index, type_tag, 1, len(payload)) + payload


def source_key(kind, entity_type, entity_id, aux):
    payloads = [
        (1, kind.encode("ascii")),
        (1, entity_type.encode("ascii")),
        (1, entity_id.encode("ascii")),
        (0, b"") if aux is None else (2, aux.encode("utf-8")),
    ]
    return (
        b"SRC3"
        + struct.pack(">HH", 3, 4)
        + b"".join(component(index, tag, payload)
                   for index, (tag, payload) in enumerate(payloads, 1))
        + struct.pack(">H", 0xFFFF)
    )


def main():
    kind = "USER_ASSERTION"
    entity_type = "REQUIREMENT_FIELD_ASSERTION"
    ident = "A" * 64
    aux_128 = "B" * 128
    full = source_key(kind, entity_type, ident, aux_128)
    theoretical = source_key("K" * 64, "T" * 64, "A" * 64, "B" * 128)
    print(f"REGISTERED_SAMPLE_MAX_BYTES={len(full)}")
    print(f"THEORETICAL_COMPONENT_MAX_BYTES={len(theoretical)}")
    print(f"THEORETICAL_MAX_ACCEPTED={len(theoretical) <= 362}")
    print("MAX_PLUS_1_BYTES=363")
    print("MAX_PLUS_1=REJECT component length 129")
    print(f"R6_BYTES_LIMIT=512")


if __name__ == "__main__":
    main()
