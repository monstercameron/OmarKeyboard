#pragma once
/* Optional receiver for QMK RAW_ENABLE. Include once in the keymap. */
#include "raw_hid.h"

static uint8_t omar_lit_desk;
static bool omar_mic_known, omar_mic_muted;
static uint32_t omar_last_report;

static void omar_clear_indicators(void) {
    omar_lit_desk = 0;
    omar_mic_known = false;
    omar_mic_muted = false;
}

void raw_hid_receive(uint8_t *data, uint8_t length) {
    if (length != 32 || data[0] != 0x4f || data[1] != 1) return;
    uint8_t flags = data[2], desk = data[3];
    omar_lit_desk = (flags & 1) && desk >= 1 && desk <= 5 ? desk : 0;
    omar_mic_known = (flags & 2) != 0;
    omar_mic_muted = omar_mic_known && (flags & 4);
    omar_last_report = timer_read32();
}

static void omar_scan_indicators(void) {
    if (timer_elapsed32(omar_last_report) >= 3000) omar_clear_indicators();
}
