#include "upstream/xxhash.h"
#include <stdio.h>

int main() {
    unsigned char buf[4096];
    for (int i = 0; i < 4096; i++) {
        buf[i] = (unsigned char)((i+1)%251);
    }

    printf("var testVecs64 = []uint64{\n");
    for (int i = 0; i < 4096; i++) {
        if (i % 4 == 0) {
            printf("\t");
        }

        uint64_t h = XXH3_64bits(buf, (size_t)i);
        printf("0x%lx, ", h);

        if (i % 4 == 3) {
            printf("\n\t");
        }
    }
    printf("}\n\n");

    printf("var testVecs128 = [][2]uint64{\n");
    for (int i = 0; i < 4096; i++) {
        if (i % 4 == 0) {
            printf("\t");
        }

        XXH128_hash_t h = XXH3_128bits(buf, (size_t)i);
        printf("{0x%lx, 0x%lx}, ", h.high64, h.low64);

        if (i % 4 == 3) {
            printf("\n");
        }
    }
    printf("}\n\n");
}
