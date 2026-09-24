// =====================================================================
//  arris_mqtt_hid.ino
//  ESP32-S3 -> USB HID klavesnice (kabelem do zadniho USB portu Arris
//  VIP4302) + WiFi/MQTT most pro Home Assistant.
//
//  Deska musi mit v Arduino IDE nastaveno:
//     Tools > USB Mode: "USB-OTG (TinyUSB)"      <-- DULEZITE, jinak
//                                                     HID nepojede
//     Tools > USB CDC On Boot: "Disabled"         (Serial pak jede po
//                                                   UART0 / COM portu,
//                                                   nativni USB je
//                                                   cely pro HID)
//     Tools > Partition Scheme: cokoliv NENI "Custom"
//                                                   (Custom vyzaduje
//                                                    vlastni partitions.csv)
//
//  Potrebne knihovny (Library Manager):
//     - PubSubClient (Nick O'Leary)
//     (USB.h / USBHID.h jsou soucasti ESP32 Arduino core, nic
//      neinstalovat)
//
//  Princip:
//     ESP32-S3 se pripoji na WiFi a MQTT broker (Home Assistant).
//     Poslouchá topic arris/vip4302/cmd - kdyz prijde jmeno prikazu
//     (napr. "UP", "OK", "POWER", ...), posle se po USB HID stejny
//     keycode, jaky posila original dalkovy ovladac (zjisteno
//     rucnim testovanim proti krabici).
// =====================================================================

#include <WiFi.h>
#include <PubSubClient.h>
#include <USB.h>
#include <USBHID.h>

// ---------------------------------------------------------------------
//  KONFIGURACE - dopln si podle sve site / HA (NIKDY nedavej skutecne
//  heslo do verejneho repozitare - tenhle soubor je jen sablona)
// ---------------------------------------------------------------------
static const char *WIFI_SSID = "TVOJE_SSID";
static const char *WIFI_PASS = "TVOJE_HESLO";

static const char *MQTT_HOST = "192.168.1.10";   // IP tveho HA / mosquitto
static const uint16_t MQTT_PORT = 1883;
static const char *MQTT_USER = "TVOJE_MQTT_JMENO";
static const char *MQTT_PASS = "TVOJE_MQTT_HESLO";
static const char *MQTT_CLIENT_ID = "arris-vip4302-esp32";

static const char *TOPIC_CMD    = "arris/vip4302/cmd";     // sem HA posila prikazy
static const char *TOPIC_STATUS = "arris/vip4302/status";  // LWT: online/offline
static const char *TOPIC_LAST   = "arris/vip4302/last";    // echo posledniho prikazu

// jak dlouho drzet klavesu stisknutou pred pusteni (ms)
static const uint16_t DEFAULT_HOLD_MS = 40;

// ---------------------------------------------------------------------
//  HID Report Map - presna kopie z original ARRIS AURA RCL ovladace
//  (65 bajtu, zjisteno GATT dumpem). Report ID 2, format:
//  [modifiers(1B)][reserved(1B)][6x keycode]
// ---------------------------------------------------------------------
static const uint8_t reportDescriptor[] = {
  0x05, 0x01, 0x09, 0x06, 0xA1, 0x01, 0x85, 0x02, 0x05, 0x07, 0x19, 0xE0,
  0x29, 0xE7, 0x15, 0x00, 0x25, 0x01, 0x75, 0x01, 0x95, 0x08, 0x81, 0x02,
  0x95, 0x01, 0x75, 0x08, 0x81, 0x01, 0x95, 0x05, 0x75, 0x01, 0x05, 0x08,
  0x19, 0x01, 0x29, 0x05, 0x91, 0x02, 0x95, 0x01, 0x75, 0x03, 0x91, 0x01,
  0x95, 0x06, 0x75, 0x08, 0x15, 0x00, 0x25, 0x65, 0x05, 0x07, 0x19, 0x00,
  0x29, 0x65, 0x81, 0x00, 0xC0
};
static const uint8_t REPORT_ID = 2;

// ---------------------------------------------------------------------
//  Tabulka prikazu - jmeno (pouziva se v MQTT payloadu) -> mod + keycode
//  Prevzato z rucniho testovaciho session (sweep/hold prikazy na BLE
//  klonu ovladace), doplneno o vychozi hold cas tam, kde bylo
//  zjisteno, ze kratky stisk nestaci (napr. F8/F9 navigace v menu).
// ---------------------------------------------------------------------
struct Cmd {
  const char *name;
  uint8_t mod;
  uint8_t code;
  uint16_t holdMs;   // 0 = pouzij DEFAULT_HOLD_MS
};

static const Cmd COMMANDS[] = {
  // --- navigace / smerove sipky ---
  {"UP",        0x00, 0x52, 0},
  {"DOWN",      0x00, 0x51, 0},
  {"LEFT",      0x00, 0x50, 0},
  {"RIGHT",     0x00, 0x4F, 0},
  {"OK",        0x00, 0x44, 0},

  // --- info / teletext / TV ---
  {"INFO",      0x00, 0x3A, 0},
  {"TELETEXT",  0x00, 0x3B, 0},
  {"TV",        0x00, 0x3C, 0},

  // --- prehravani / nahravani ---
  {"RECORD",    0x00, 0x3E, 0},
  {"REPLAY",    0x00, 0x3F, 0},
  {"PAUSE",     0x00, 0x40, 0},
  {"STOP",      0x00, 0x48, 0},
  {"FWD",       0x00, 0x5C, 0},
  {"REV",       0x00, 0x5E, 0},

  // --- menu / navigace v UI (potrebuji delsi hold) ---
  {"MENU",      0x00, 0x41, 200},
  {"HOME",      0x00, 0x42, 200},
  {"BACK",      0x00, 0x43, 0},
  {"BACK2",     0x00, 0x45, 0},

  // --- cislice (horni rada klavesnice; na CZ layoutu +escrzyaie) ---
  {"DIGIT_1",   0x00, 0x1E, 0},
  {"DIGIT_2",   0x00, 0x1F, 0},
  {"DIGIT_3",   0x00, 0x20, 0},
  {"DIGIT_4",   0x00, 0x21, 0},
  {"DIGIT_5",   0x00, 0x22, 0},
  {"DIGIT_6",   0x00, 0x23, 0},
  {"DIGIT_7",   0x00, 0x24, 0},
  {"DIGIT_8",   0x00, 0x25, 0},
  {"DIGIT_9",   0x00, 0x26, 0},
  {"DIGIT_0",   0x00, 0x27, 0},

  // --- s modifikatorem (empiricky zjisteno na krabici) ---
  {"POWER",      0x01, 0x29, 0},
  {"VOL_DOWN",   0x01, 0x3B, 0},
  {"VOL_UP",     0x01, 0x3C, 0},
  {"MUTE",       0x01, 0x3D, 0},
  {"CTRL_PAUSE", 0x01, 0x3E, 0},
  {"RW",         0x01, 0x3F, 0},
  {"FF",         0x01, 0x40, 0},
  {"RESTART",    0x01, 0x41, 0},
  {"CH_LIST",    0x01, 0x42, 0},
  {"CH_UP",      0x01, 0x60, 0},
  {"CH_DOWN",    0x01, 0x5A, 0},
  {"SKIP_FWD",   0x01, 0x5C, 0},
  {"SKIP_BACK",  0x01, 0x5E, 0},
};
static const size_t NUM_COMMANDS = sizeof(COMMANDS) / sizeof(COMMANDS[0]);

// ---------------------------------------------------------------------
//  USB HID zarizeni (podle oficialniho espressif/arduino-esp32
//  CustomHIDDevice.ino prikladu)
// ---------------------------------------------------------------------
class ArrisKeyboardHID : public USBHIDDevice {
 public:
  ArrisKeyboardHID() {
    hid.addDevice(this, sizeof(reportDescriptor));
  }

  void begin() {
    hid.begin();
  }

  uint16_t _onGetDescriptor(uint8_t *buffer) override {
    memcpy(buffer, reportDescriptor, sizeof(reportDescriptor));
    return sizeof(reportDescriptor);
  }

  bool sendReport(uint8_t mod, uint8_t code) {
    uint8_t report[8] = {mod, 0x00, code, 0x00, 0x00, 0x00, 0x00, 0x00};
    return hid.SendReport(REPORT_ID, report, sizeof(report));
  }

  bool releaseAll() {
    uint8_t report[8] = {0};
    return hid.SendReport(REPORT_ID, report, sizeof(report));
  }

 private:
  USBHID hid;
};

static ArrisKeyboardHID keyboard;

// ---------------------------------------------------------------------
//  WiFi + MQTT
// ---------------------------------------------------------------------
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

static void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("[wifi] pripojuji se k %s...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(250);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[wifi] pripojeno, IP=%s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[wifi] pripojeni selhalo, zkusim znovu pozdeji");
  }
}

// najde prikaz podle jmena (case-insensitive)
static const Cmd *findCommand(const String &name) {
  for (size_t i = 0; i < NUM_COMMANDS; i++) {
    if (name.equalsIgnoreCase(COMMANDS[i].name)) {
      return &COMMANDS[i];
    }
  }
  return nullptr;
}

// posle jednu klavesu (stisk + pusteni)
static void pressKey(uint8_t mod, uint8_t code, uint16_t holdMs) {
  keyboard.sendReport(mod, code);
  delay(holdMs > 0 ? holdMs : DEFAULT_HOLD_MS);
  keyboard.releaseAll();
}

// zpracuje jeden prikaz z MQTT payloadu:
//   - jmeno z tabulky COMMANDS, napr. "UP", "POWER", "VOL_UP"
//   - nebo surovy format "RAW:mod:code" v hexu, napr. "RAW:00:52"
static void runCommand(const String &payload) {
  String cmd = payload;
  cmd.trim();

  if (cmd.startsWith("RAW:") || cmd.startsWith("raw:")) {
    int firstColon = cmd.indexOf(':', 4);
    if (firstColon > 0) {
      uint8_t mod = strtoul(cmd.substring(4, firstColon).c_str(), nullptr, 16);
      uint8_t code = strtoul(cmd.substring(firstColon + 1).c_str(), nullptr, 16);
      Serial.printf("[cmd] RAW mod=%02X code=%02X\n", mod, code);
      pressKey(mod, code, DEFAULT_HOLD_MS);
      mqtt.publish(TOPIC_LAST, cmd.c_str());
      return;
    }
  }

  const Cmd *c = findCommand(cmd);
  if (c) {
    Serial.printf("[cmd] %s -> mod=%02X code=%02X hold=%u\n", c->name, c->mod, c->code, c->holdMs);
    pressKey(c->mod, c->code, c->holdMs);
    mqtt.publish(TOPIC_LAST, c->name);
  } else {
    Serial.printf("[cmd] neznamy prikaz: '%s'\n", cmd.c_str());
  }
}

static void onMqttMessage(char *topic, byte *payload, unsigned int length) {
  String msg;
  msg.reserve(length);
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.printf("[mqtt] %s = %s\n", topic, msg.c_str());
  runCommand(msg);
}

static void connectMqtt() {
  if (mqtt.connected()) return;
  Serial.printf("[mqtt] pripojuji se k %s:%u...\n", MQTT_HOST, MQTT_PORT);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);

  bool ok;
  if (strlen(MQTT_USER) > 0) {
    ok = mqtt.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS, TOPIC_STATUS, 0, true, "offline");
  } else {
    ok = mqtt.connect(MQTT_CLIENT_ID, TOPIC_STATUS, 0, true, "offline");
  }

  if (ok) {
    Serial.println("[mqtt] pripojeno");
    mqtt.publish(TOPIC_STATUS, "online", true);
    mqtt.subscribe(TOPIC_CMD);
  } else {
    Serial.printf("[mqtt] pripojeni selhalo, rc=%d\n", mqtt.state());
  }
}

// ---------------------------------------------------------------------
//  Setup / loop
// ---------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== arris_mqtt_hid start ===");

  // USB HID klavesnice
  USB.manufacturerName("DIY");
  USB.productName("Arris Remote Bridge");
  keyboard.begin();
  USB.begin();
  Serial.println("[usb] HID klavesnice pripravena");

  connectWiFi();
  connectMqtt();

  Serial.printf("[info] pocet prikazu v tabulce: %u\n", (unsigned)NUM_COMMANDS);
  Serial.println("[info] posli prikaz pres MQTT topic 'arris/vip4302/cmd', napr. UP / OK / POWER");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  if (!mqtt.connected()) {
    connectMqtt();
  }
  mqtt.loop();

  // volitelne: rucni testovani pres Serial monitor - staci napsat
  // jmeno prikazu (napr. UP) a Enter
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      runCommand(line);
    }
  }
}
