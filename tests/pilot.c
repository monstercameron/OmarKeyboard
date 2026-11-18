#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <assert.h>
#define MATRIX_ROWS 8
#define MATRIX_COLS 12
#define SAFE_RANGE 0x6000
#define MOD_BIT(x) (1u << ((x) & 7))
#define MOD_MASK_SHIFT 0x22
enum {KC_1=30, KC_ESC=41, KC_TAB=43, KC_SPC=44, KC_RGHT=79, KC_LEFT, KC_DOWN, KC_UP, KC_LCTL=224, KC_LSFT, KC_LALT, KC_LGUI, KC_RCTL, KC_RSFT, KC_RALT, KC_RGUI};
#define IS_MODIFIER_KEYCODE(c) ((c) >= KC_LCTL && (c) <= KC_RGUI)
#define IS_QK_LAYER_TAP(c) ((c) >= 0x4000 && (c) <= 0x4FFF)
#define IS_QK_MOMENTARY(c) ((c) >= 0x5220 && (c) <= 0x523F)
#define LT1_CAPS 0x4129
#define OMAR_ARMED_LED_PIN 25
static bool led_out, led_level;
static void gpio_set_pin_output(int p){assert(p==OMAR_ARMED_LED_PIN);led_out=true;}
static void gpio_write_pin_low(int p){assert(p==OMAR_ARMED_LED_PIN);led_level=false;}
static void gpio_write_pin(int p,bool v){assert(p==OMAR_ARMED_LED_PIN);led_level=v;}
typedef struct { struct {bool pressed; struct {uint8_t row,col;} key;} event;} keyrecord_t;
static uint8_t mods, weak, oneshot, outmods, outkey;
static uint32_t ticks;
static uint8_t get_mods(void){return mods;}
static uint8_t get_weak_mods(void){return weak;}
static uint8_t get_oneshot_mods(void){return oneshot;}
static void set_mods(uint8_t n){mods=n;}
static void set_weak_mods(uint8_t n){weak=n;}
static void set_oneshot_mods(uint8_t n){oneshot=n;}
static void clear_weak_mods(void){weak=0;}
static void clear_oneshot_mods(void){oneshot=0;}
static uint32_t timer_read32(void){return ticks;}
static uint32_t timer_elapsed32(uint32_t at){return ticks-at;}
static void send_keyboard_report(void){}
static void tap_code(uint8_t key){outkey=key;outmods=mods|weak|oneshot;}
#include "omar-controls.h"
#include "omar-indicators.h"
static bool event(uint16_t code, bool down, int col){
    keyrecord_t r={.event={.pressed=down,.key={.row=0,.col=col}}};
    return omar_process_record(code,&r);
}
static void tap(uint16_t code){event(code,true,0);event(code,false,0);}
static bool event_at(uint16_t code, bool down, int row, int col){
    keyrecord_t r={.event={.pressed=down,.key={.row=row,.col=col}}};
    return omar_process_record(code,&r);
}
int main(void){
    omar_init();assert(led_out && !led_level);
    tap(OM_STAY);ticks=2999;tap(OM_DESK3);assert(outkey==KC_1+2 && outmods==14);
    tap(OM_GO);ticks+=3000;tap(OM_DESK2);assert(outmods==8 && outkey==KC_1+1);
    tap(OM_GO);tap(OM_DESK1);assert(outmods==10);
    tap(OM_GO);tap(OM_STAY);assert(omar_transfer==OM_STAY);
    tap(OM_STAY);assert(!omar_transfer);
    tap(OM_GO);assert(!event(KC_ESC,true,2));assert(!event(KC_ESC,false,2));assert(!omar_transfer);
    tap(OM_GO);assert(event(KC_LEFT,true,2));assert(!omar_transfer);
    tap(OM_GO);tap(OM_LAST_DESK);assert(outkey==KC_TAB && outmods==9);
    tap(OM_GO);assert(event(4,true,2));assert(!omar_transfer);
    tap(OM_FOCUS);assert(event(KC_LEFT,true,2));
    event(OM_SWAP,true,0);assert(!event(KC_LEFT,true,1));assert(outmods==10);
    event(OM_SWAP,false,0);assert(!event(KC_LEFT,false,1));assert(event(KC_LEFT,true,1));
    event(OM_FOCUS,true,0);event(OM_SWAP,true,2);tap(KC_UP);assert(outmods==8);
    omar_reset_input();mods=2;weak=1;oneshot=8;tap(OM_NEXT);
    assert(outmods==6 && outkey==KC_TAB && mods==2 && weak==1 && oneshot==8);
    tap(OM_MENU);assert(outmods==12 && outkey==KC_SPC);
    ticks=0xfffffff0;tap(OM_GO);ticks+=3000;omar_scan();assert(!omar_transfer);
    uint8_t data[32]={0x4f,1,7,3};raw_hid_receive(data,32);
    assert(omar_lit_desk==3 && omar_mic_known && omar_mic_muted);
    ticks+=2999;omar_scan_indicators();assert(omar_lit_desk==3);
    ticks++;omar_scan_indicators();assert(!omar_lit_desk && !omar_mic_known);
    data[2]=0;raw_hid_receive(data,32);assert(!omar_lit_desk && !omar_mic_muted);
    /* Spec item 4: modifiers, layer keys and encoder events keep a pending transfer. */
    omar_reset_input();mods=0;weak=0;oneshot=0;ticks=0;
    tap(OM_STAY);omar_scan();assert(led_level);
    assert(event(KC_LSFT,true,3));mods=2;assert(omar_transfer==OM_STAY);
    ticks=100;tap(OM_DESK3);assert(outkey==KC_1+2 && outmods==14 && !omar_transfer);
    omar_scan();assert(!led_level);
    mods=0;tap(OM_GO);assert(event(KC_LCTL,true,3)&&event(KC_RALT,true,3)&&event(KC_RGUI,true,3));assert(omar_transfer==OM_GO);
    assert(event(LT1_CAPS,true,4));assert(event(LT1_CAPS,false,4));assert(event(0x5222,true,4));assert(omar_transfer==OM_GO);
    assert(event_at(KC_ESC,true,254,0));assert(event_at(KC_UP,true,254,1));assert(omar_transfer==OM_GO);
    assert(event(4,true,2));assert(!omar_transfer);
    omar_scan();assert(!led_level);
    event(OM_FOCUS,true,0);omar_scan();assert(led_level);
    event(OM_FOCUS,false,0);omar_scan();assert(!led_level);
    event(OM_SWAP,true,0);omar_scan();assert(led_level);
    event(OM_SWAP,false,0);omar_scan();assert(!led_level);
    tap(OM_STAY);ticks+=3000;omar_scan();assert(!omar_transfer && !led_level);
    /* Suspend clears the armed light without waiting for another scan. */
    tap(OM_GO);omar_scan();assert(led_level);omar_reset_input();assert(!led_level);
    puts("Pilot gesture and raw HID C harness passed.");
}
