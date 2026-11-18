#pragma once

/* Include once in a QMK keymap.c, after QMK_KEYBOARD_H.
 * Call omar_init() from keyboard_post_init_user(). Optionally #define
 * OMAR_ARMED_LED_PIN (for example GP25) before including this header to drive
 * an armed light while a transfer is pending or Focus/Swap is held. */
#include <string.h>

enum omar_keycode {
    OM_DESK1 = SAFE_RANGE, OM_DESK2, OM_DESK3, OM_DESK4, OM_DESK5,
    OM_STAY, OM_GO, OM_FOCUS, OM_SWAP, OM_NEXT, OM_LAST_DESK, OM_MENU,
    OM_KEYCODE_END
};

static uint16_t omar_transfer;
static uint32_t omar_armed_at;
static bool omar_focus_held, omar_swap_held;
static bool omar_intercepted[MATRIX_ROWS][MATRIX_COLS];

static void omar_reset_input(void) {
    omar_transfer = 0;
    omar_focus_held = false;
    omar_swap_held = false;
    memset(omar_intercepted, 0, sizeof(omar_intercepted));
#ifdef OMAR_ARMED_LED_PIN
    gpio_write_pin_low(OMAR_ARMED_LED_PIN);
#endif
}

static void omar_init(void) {
#ifdef OMAR_ARMED_LED_PIN
    gpio_set_pin_output(OMAR_ARMED_LED_PIN);
    gpio_write_pin_low(OMAR_ARMED_LED_PIN);
#endif
}

/* Call on every scan and before rendering local destination lights. */
static void omar_scan(void) {
    if (omar_transfer && timer_elapsed32(omar_armed_at) >= 3000) {
        omar_transfer = 0;
    }
#ifdef OMAR_ARMED_LED_PIN
    gpio_write_pin(OMAR_ARMED_LED_PIN, omar_transfer != 0 || omar_focus_held || omar_swap_held);
#endif
}

/* Emit one exact desktop chord, then return the user's physical modifiers. */
static void omar_tap_chord(uint8_t mods, uint8_t key) {
    const uint8_t physical = get_mods();
    const uint8_t weak = get_weak_mods();
#ifndef NO_ACTION_ONESHOT
    const uint8_t oneshot = get_oneshot_mods();
    clear_oneshot_mods();
#endif
    clear_weak_mods();
    set_mods(mods);
    send_keyboard_report();
    tap_code(key);
    set_mods(physical);
    set_weak_mods(weak);
#ifndef NO_ACTION_ONESHOT
    set_oneshot_mods(oneshot);
#endif
    send_keyboard_report();
}

static bool omar_process_record(uint16_t code, keyrecord_t *record) {
    const bool pressed = record->event.pressed;
    const uint8_t row = record->event.key.row, col = record->event.key.col;
    const bool matrix_key = row < MATRIX_ROWS && col < MATRIX_COLS;
    const bool custom = code >= OM_DESK1 && code < OM_KEYCODE_END;
    omar_scan();
    if (!pressed && matrix_key && omar_intercepted[row][col]) {
        omar_intercepted[row][col] = false;
        return false;
    }
    if (code == OM_FOCUS || code == OM_SWAP) {
        if (pressed) omar_transfer = 0;
        if (code == OM_FOCUS) omar_focus_held = pressed;
        else omar_swap_held = pressed;
        return false;
    }
    if (!pressed) return !custom;
    /* Modifiers, layer keys and non-matrix events (encoder detents) never end a pending transfer. */
    if (!custom && (!matrix_key || IS_MODIFIER_KEYCODE(code) || IS_QK_LAYER_TAP(code) || IS_QK_MOMENTARY(code))) {
        return true;
    }

    const uint16_t previous = omar_transfer;
    const uint8_t gui = MOD_BIT(KC_LGUI), shift = MOD_BIT(KC_LSFT);
    const uint8_t alt = MOD_BIT(KC_LALT), ctrl = MOD_BIT(KC_LCTL);
    uint8_t held_mods = get_mods() | get_weak_mods();
#ifndef NO_ACTION_ONESHOT
    held_mods |= get_oneshot_mods();
#endif
    const bool shifted = (held_mods & MOD_MASK_SHIFT) != 0;
    omar_transfer = 0;
    if (code == OM_STAY || code == OM_GO) {
        if (previous != code) {
            omar_transfer = code;
            omar_armed_at = timer_read32();
        }
        return false;
    }
    if (code >= OM_DESK1 && code <= OM_DESK5) {
        uint8_t mods = gui;
        if (previous) mods |= shift;
        if (previous == OM_STAY) mods |= alt;
        omar_tap_chord(mods, KC_1 + (code - OM_DESK1));
        return false;
    }
    if (previous && code == KC_ESC) {
        if (matrix_key) omar_intercepted[row][col] = true;
        return false;
    }
    bool arrow = code == KC_LEFT || code == KC_RGHT || code == KC_UP || code == KC_DOWN;
    if (arrow && (omar_focus_held || omar_swap_held)) {
        if (matrix_key) omar_intercepted[row][col] = true;
        omar_tap_chord(omar_focus_held ? gui : gui | shift, code);
        return false;
    }
    switch (code) {
        case OM_NEXT: omar_tap_chord(shifted ? alt | shift : alt, KC_TAB); return false;
        case OM_LAST_DESK: omar_tap_chord(gui | ctrl, KC_TAB); return false;
        case OM_MENU: omar_tap_chord(shifted ? gui | alt : gui, KC_SPC); return false;
        default: return true;
    }
}
