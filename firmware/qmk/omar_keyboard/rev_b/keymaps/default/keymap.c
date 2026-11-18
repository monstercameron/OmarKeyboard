#include QMK_KEYBOARD_H
#include "usb_device_state.h"
#include "omar-controls.h"
#include "omar-indicators.h"

const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
    [0] = LAYOUT(
        KC_MUTE, KC_ESC, OM_DESK1, OM_DESK2, OM_DESK3, OM_DESK4, OM_DESK5, OM_LAST_DESK, OM_STAY, OM_GO, LGUI(LCTL(KC_V)), LGUI(KC_V), LGUI(LSFT(LALT(KC_COMM))), KC_F15, KC_DEL, KC_PSCR, LGUI(LCTL(KC_PSCR)), LGUI(LCTL(KC_L)), LGUI(KC_L),
        KC_F13, KC_GRV, KC_1, KC_2, KC_3, KC_4, KC_5, KC_6, KC_7, KC_8, KC_9, KC_0, KC_MINS, KC_EQL, KC_BSPC, LGUI(KC_J),
        LGUI(LSFT(KC_B)), KC_TAB, KC_Q, KC_W, KC_E, KC_R, KC_T, KC_Y, KC_U, KC_I, KC_O, KC_P, KC_LBRC, KC_RBRC, KC_BSLS, LGUI(KC_T),
        OM_MENU, LT(1, KC_CAPS), KC_A, KC_S, KC_D, KC_F, KC_G, KC_H, KC_J, KC_K, KC_L, KC_SCLN, KC_QUOT, KC_ENT, LGUI(KC_F),
        LGUI(KC_ENT), KC_LSFT, KC_Z, KC_X, KC_C, KC_V, KC_B, KC_N, KC_M, KC_COMM, KC_DOT, KC_SLSH, KC_RSFT, KC_UP, OM_SWAP,
        LGUI(LSFT(KC_F)), KC_LCTL, KC_LGUI, KC_SPC, KC_RGUI, OM_NEXT, KC_RCTL, KC_LEFT, KC_DOWN, KC_RGHT, OM_FOCUS
    ),
    [1] = LAYOUT(
        KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_INS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS,
        KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS,
        KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, RM_VALD, RM_VALU, RM_TOGG, KC_TRNS,
        KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS,
        KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_PGUP, KC_TRNS,
        KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_TRNS, KC_F14, KC_TRNS, KC_HOME, KC_PGDN, KC_END, KC_TRNS
    )
};

const uint16_t PROGMEM encoder_map[][NUM_ENCODERS][NUM_DIRECTIONS] = {
    [0] = { ENCODER_CCW_CW(KC_VOLD, KC_VOLU), ENCODER_CCW_CW(KC_BRID, KC_BRIU), ENCODER_CCW_CW(MS_WHLU, MS_WHLD) },
    [1] = { ENCODER_CCW_CW(KC_VOLD, KC_VOLU), ENCODER_CCW_CW(LGUI(KC_MINS), LGUI(KC_EQL)), ENCODER_CCW_CW(KC_PGUP, KC_PGDN) }
};

bool process_record_user(uint16_t code, keyrecord_t *record) {
    return omar_process_record(code, record);
}

static const uint8_t status_pixel[15] = {62, 1, 2, 3, 4, 5, 7, 8, 12, 78, 79, 80, 81, 82, 77};

/* U4 /OE is high by default. A separate load switch removes pixel idle current. */
static bool led_rail_on;
static uint32_t led_rail_started;

static void lighting_off(void) {
    gpio_write_pin_high(GP28);
    gpio_write_pin_low(GP27);
    led_rail_on = false;
}

void keyboard_pre_init_user(void) {
    gpio_write_pin_high(GP28);
    gpio_set_pin_output(GP28);
    gpio_write_pin_low(GP27);
    gpio_set_pin_output(GP27);
}

void keyboard_post_init_user(void) { omar_init(); }

void matrix_scan_user(void) {
    omar_scan();
    omar_scan_indicators();
    if (usb_device_state_get_configure_state() != USB_DEVICE_STATE_CONFIGURED ||
        !rgb_matrix_is_enabled() || !rgb_matrix_get_val()) {
        lighting_off();
        return;
    }
    if (!led_rail_on) {
        gpio_write_pin_high(GP27);
        led_rail_started = timer_read32();
        led_rail_on = true;
    } else if (timer_elapsed32(led_rail_started) >= 5) {
        gpio_write_pin_low(GP28);
    }
}

void suspend_power_down_user(void) {
    lighting_off();
    omar_reset_input();
    omar_clear_indicators();
}

/* Inputs are 0..255 color weights. The level caps every channel, including overlays. */
static void status_color(uint8_t role, uint8_t level, uint8_t r, uint8_t g, uint8_t b) {
    rgb_matrix_set_color(status_pixel[role], r*level/255, g*level/255, b*level/255);
}

bool rgb_matrix_indicators_user(void) {
    uint8_t level = MIN(rgb_matrix_get_val(), RGB_MATRIX_MAXIMUM_BRIGHTNESS);
    rgb_matrix_set_color_all(level, level, level);
    if (host_keyboard_led_state().caps_lock) status_color(0, level, 60, 255, 60);
    if (omar_transfer) {
        for (uint8_t i=1; i<=5; ++i) status_color(i, level, 255, 100, 0);
        status_color(omar_transfer == OM_STAY ? 6 : 7, level, 255, 100, 0);
    } else if (omar_lit_desk) {
        status_color(omar_lit_desk, level, 0, 225, 255);
    }
    if (omar_mic_known && omar_mic_muted) status_color(8, level, 255, 0, 0);
    if (omar_swap_held) status_color(9, level, 0, 65, 255);
    if (omar_focus_held) status_color(10, level, 0, 65, 255);
    if (omar_focus_held || omar_swap_held) {
        for (uint8_t i=11; i<=14; ++i) status_color(i, level, 0, 65, 255);
    }
    return false;
}
