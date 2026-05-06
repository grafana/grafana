import peachpy.x86_64

k0 = 0xD6D018F5
k1 = 0xA2AA033B
k2 = 0x62992FC1
k3 = 0x30BC5B29

def advance(p,l,c):
    ADD(p,c)
    SUB(l,c)

def imul(r,k):
    t = GeneralPurposeRegister64()
    MOV(t, k)
    IMUL(r, t)

def update32(v, p,idx,  k, vadd):
    r = GeneralPurposeRegister64()
    MOV(r, [p + idx])
    imul(r, k)
    ADD(v, r)
    ROR(v, 29)
    ADD(v, vadd)

def final32(v, regs, keys):
    r = GeneralPurposeRegister64()
    MOV(r, v[regs[1]])
    ADD(r, v[regs[2]])
    imul(r, keys[0])
    ADD(r, v[regs[3]])
    ROR(r, 37)
    imul(r, keys[1])
    XOR(v[regs[0]], r)

seed = Argument(uint64_t)
buffer_base = Argument(ptr())
buffer_len = Argument(int64_t)
buffer_cap = Argument(int64_t)

def makeHash(name, args):
    with Function(name, args, uint64_t) as function:

        reg_ptr = GeneralPurposeRegister64()
        reg_ptr_len = GeneralPurposeRegister64()
        reg_hash = GeneralPurposeRegister64()

        LOAD.ARGUMENT(reg_hash, seed)
        LOAD.ARGUMENT(reg_ptr, buffer_base)
        LOAD.ARGUMENT(reg_ptr_len, buffer_len)

        imul(reg_hash, k0)
        r = GeneralPurposeRegister64()
        MOV(r, k2*k0)
        ADD(reg_hash, r)

        after32 = Label("after32")

        CMP(reg_ptr_len, 32)
        JL(after32)
        v = [GeneralPurposeRegister64() for _ in range(4)]
        for i in range(4):
            MOV(v[i], reg_hash)

        with Loop() as loop:
            update32(v[0], reg_ptr, 0, k0, v[2])
            update32(v[1], reg_ptr, 8, k1, v[3])
            update32(v[2], reg_ptr, 16, k2, v[0])
            update32(v[3], reg_ptr, 24, k3, v[1])

            ADD(reg_ptr, 32)
            SUB(reg_ptr_len, 32)
            CMP(reg_ptr_len, 32)
            JGE(loop.begin)

        final32(v, [2,0,3,1], [k0, k1])
        final32(v, [3,1,2,0], [k1, k0])
        final32(v, [0,0,2,3], [k0, k1])
        final32(v, [1,1,3,2], [k1, k0])

        XOR(v[0], v[1])
        ADD(reg_hash, v[0])

        LABEL(after32)

        after16 = Label("after16")
        CMP(reg_ptr_len, 16)
        JL(after16)

        for i in range(2):
            MOV(v[i], [reg_ptr])
            imul(v[i], k2)
            ADD(v[i], reg_hash)

            advance(reg_ptr, reg_ptr_len, 8)

            ROR(v[i], 29)
            imul(v[i], k3)

        r = GeneralPurposeRegister64()
        MOV(r, v[0])
        imul(r, k0)
        ROR(r, 21)
        ADD(r, v[1])
        XOR(v[0], r)

        MOV(r, v[1])
        imul(r, k3)
        ROR(r, 21)
        ADD(r, v[0])
        XOR(v[1], r)

        ADD(reg_hash, v[1])

        LABEL(after16)

        after8 = Label("after8")
        CMP(reg_ptr_len, 8)
        JL(after8)

        r = GeneralPurposeRegister64()
        MOV(r, [reg_ptr])
        imul(r, k3)
        ADD(reg_hash, r)
        advance(reg_ptr, reg_ptr_len, 8)

        MOV(r, reg_hash)
        ROR(r, 55)
        imul(r, k1)
        XOR(reg_hash, r)

        LABEL(after8)

        after4 = Label("after4")
        CMP(reg_ptr_len, 4)
        JL(after4)

        r = GeneralPurposeRegister64()
        XOR(r, r)
        MOV(r.as_dword, dword[reg_ptr])
        imul(r, k3)
        ADD(reg_hash, r)
        advance(reg_ptr, reg_ptr_len, 4)

        MOV(r, reg_hash)
        ROR(r, 26)
        imul(r, k1)
        XOR(reg_hash, r)

        LABEL(after4)

        after2 = Label("after2")
        CMP(reg_ptr_len, 2)
        JL(after2)

        r = GeneralPurposeRegister64()
        XOR(r,r)
        MOV(r.as_word, word[reg_ptr])
        imul(r, k3)
        ADD(reg_hash, r)
        advance(reg_ptr, reg_ptr_len, 2)

        MOV(r, reg_hash)
        ROR(r, 48)
        imul(r, k1)
        XOR(reg_hash, r)

        LABEL(after2)

        after1 = Label("after1")
        CMP(reg_ptr_len, 1)
        JL(after1)

        r = GeneralPurposeRegister64()
        MOVZX(r, byte[reg_ptr])
        imul(r, k3)
        ADD(reg_hash, r)

        MOV(r, reg_hash)
        ROR(r, 37)
        imul(r, k1)
        XOR(reg_hash, r)

        LABEL(after1)

        r = GeneralPurposeRegister64()
        MOV(r, reg_hash)
        ROR(r, 28)
        XOR(reg_hash, r)

        imul(reg_hash, k0)

        MOV(r, reg_hash)
        ROR(r, 29)
        XOR(reg_hash, r)

        RETURN(reg_hash)

makeHash("Hash64", (buffer_base, buffer_len, buffer_cap, seed))
makeHash("Hash64Str", (buffer_base, buffer_len, seed))