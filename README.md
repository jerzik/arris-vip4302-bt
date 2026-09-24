# ARRIS VIP4302 BT — USB/MQTT dálkové ovládání pro Home Assistant

Náhradní dálkové ovládání pro IPTV set-top box **Arris VIP4302** (originální dálkový ovladač: **ARRIS AURA RCL**, BLE 4.0 na čipu TI CC2541), postavené na **ESP32-S3**, ovládané z **Home Assistant** přes **MQTT**.

![Arris](images/arris.jpg)

## Jak to funguje

Box **VIP4302** má na zadní straně USB port, který trvale přijímá napájení a rozpoznává standardní USB HID klávesnici (ověřeno praktickým testem — připojená klávesnice reaguje na jednotlivé klávesy).

Architektura:

```
Home Assistant dashboard (tlačítko)
        │  service: mqtt.publish
        ▼
   MQTT broker (Mosquitto na HA)
        │  topic: arris/vip4302/cmd
        ▼
   ESP32-S3 (WiFi client + MQTT subscriber)
        │  USB HID (nativní USB-OTG/TinyUSB)
        ▼
   Arris VIP4302 (zadní USB port)
```

ESP32-S3 je fyzicky zapojen kabelem do zadního USB portu boxu a chová se jako klávesnice. Zároveň se připojí na domácí WiFi a MQTT broker v Home Assistantu. Když HA pošle na topic `arris/vip4302/cmd` jméno příkazu (např. `UP`, `OK`, `POWER`), ESP pošle přes USB HID přesně ten samý keycode, jaký odesílá originální BLE dálkový ovladač.

## Jak jsme se k tomu dostali (historie projektu)

1. **Reverse engineering originálního BLE ovladače** — ESP32-S3 jako BLE centrální zařízení / sniffer, GATT dump proti ARRIS AURA RCL (TI CC2541, HOGP profil, služby 0x1812/0x180A/0x180F/0x1800).
2. **Kritický objev:** CC2541 je Bluetooth 4.0 a **nepodporuje LE Secure Connections** (to je feature až od 4.2) — párování fungovalo teprve po přepnutí na legacy pairing (`setSecurityAuth(true, false, false)`). Bez toho spojení padalo s HCI reason 0x13/531 hned po připojení.
3. Po vyřešení párování se podařilo z originálu vytáhnout **65bajtový HID Report Map** (viz níže) — Report ID 2, standardní boot-keyboard formát.
4. Přímé sniffování stisků kláves na originálu bylo nespolehlivé (box aktivně odpojoval neznámá zařízení), takže jsme místo toho postavili **BLE HID klon** originálního ovladače a empiricky (sweep/hold přes sériovou linku) zjistili, které keycody odpovídají kterým funkcím boxu.
5. Zjistili jsme, že box umí mít **spárované jen jedno BLE zařízení najednou** — takže BLE klon a originál nešly používat současně.
6. IR dálkové ovládání se ukázalo jako nefunkční/neověřené (box nereagoval na běžné výrobce).
7. **Zlom:** zadní USB port boxu přijímá standardní USB klávesnici. Celý projekt byl přepracován na **USB HID + MQTT most** — spolehlivé, nezávislé na BLE párovacích slotech, ovladatelné odkudkoliv v síti přes Home Assistant.

## Hardware

- **ESP32-S3** (vyžaduje nativní USB-OTG — **funguje jen ESP32-S3 a ESP32-S2**, klasický ESP32/C3/C6/H2 nativní USB HID neumí)
- USB kabel z ESP32-S3 do zadního USB portu Arris VIP4302
- Domácí WiFi (2,4 GHz) a MQTT broker (Mosquitto add-on v Home Assistantu)

## Přesná konfigurace desky v Arduino IDE

Tohle je **nejdůležitější a nejčastější zdroj chyb** — bez správného nastavení HID nepojede nebo se sketch vůbec nezkompiluje.

| Nastavení (Tools menu) | Hodnota | Proč |
|---|---|---|
| **Board** | `ESP32S3 Dev Module` | |
| **USB Mode** | `USB-OTG (TinyUSB)` | Bez tohoto nefunguje nativní USB HID (klávesnice) |
| **USB CDC On Boot** | `Disabled` | `Serial` pak jede po UART0/COM portu; nativní USB je celé volné pro HID |
| **Partition Scheme** | cokoliv **kromě** `Custom` (např. `Default 4MB with spiffs`) | `Custom` vyžaduje vlastní `partitions.csv`, jinak build selže na `gen_esp32part.exe: ... No such file or directory` |
| **Upload Speed** | 921600 | |
| **Flash Mode / Size** | podle konkrétní desky (typicky QIO, 4–16 MB) | |
| **PSRAM** | podle desky (OPI, pokud má) | |

**Potřebné knihovny** (Library Manager, `Ctrl+Shift+I`):
- **PubSubClient** (autor: Nick O'Leary) — MQTT klient

`USB.h` a `USBHID.h` jsou součástí ESP32 Arduino core, nic se pro ně neinstaluje.

## MQTT konfigurace

Firmware (`firmware/arris_mqtt_hid.ino`) obsahuje na začátku placeholdery, které je nutné **před nahráním do ESP** upravit přímo v Arduino IDE (nedávej reálné WiFi/MQTT heslo do repozitáře):

```cpp
static const char *WIFI_SSID = "TVOJE_SSID";
static const char *WIFI_PASS = "TVOJE_HESLO";

static const char *MQTT_HOST = "192.168.1.10";   // IP tveho HA / mosquitto
static const uint16_t MQTT_PORT = 1883;
static const char *MQTT_USER = "TVOJE_MQTT_JMENO";
static const char *MQTT_PASS = "TVOJE_MQTT_HESLO";
```

MQTT topicy, které firmware používá:

| Topic | Směr | Popis |
|---|---|---|
| `arris/vip4302/cmd` | HA → ESP | Sem se posílají příkazy (jméno z tabulky `COMMANDS`, např. `UP`, `POWER`, nebo surový formát `RAW:mod:code` v hexu, např. `RAW:00:52`) |
| `arris/vip4302/status` | ESP → HA | LWT (Last Will and Testament): `online` po připojení, `offline` při výpadku |
| `arris/vip4302/last` | ESP → HA | Echo posledního úspěšně provedeného příkazu |

Po nahrání sketche do ESP32-S3 lze příkazy testovat i přímo v Arduino Serial Monitoru (115200 baud) — stačí napsat jméno příkazu (např. `UP`) a Enter, bez nutnosti MQTT.

## HID Report Map

65bajtový Report Map zjištěný GATT dumpem z originálního ovladače ARRIS AURA RCL. Report ID 2, formát `[modifiers(1B)][reserved(1B)][6x keycode]` (standardní boot-keyboard report):

```
05 01 09 06 A1 01 85 02 05 07 19 E0
29 E7 15 00 25 01 75 01 95 08 81 02
95 01 75 08 81 01 95 05 75 01 05 08
19 01 29 05 91 02 95 01 75 03 91 01
95 06 75 08 15 00 25 65 05 07 19 00
29 65 81 00 C0
```

## Zjištěné příkazy (keymap)

| Příkaz (MQTT payload) | Modifier | Keycode | Funkce |
|---|---|---|---|
| `UP` | 0x00 | 0x52 | nahoru |
| `DOWN` | 0x00 | 0x51 | dolů |
| `LEFT` | 0x00 | 0x50 | vlevo |
| `RIGHT` | 0x00 | 0x4F | vpravo |
| `OK` | 0x00 | 0x44 | OK / potvrdit |
| `INFO` | 0x00 | 0x3A | info |
| `TELETEXT` | 0x00 | 0x3B | teletext |
| `TV` | 0x00 | 0x3C | TV |
| `RECORD` | 0x00 | 0x3E | nahrávání |
| `REPLAY` | 0x00 | 0x3F | přehrát znovu |
| `PAUSE` | 0x00 | 0x40 | pauza |
| `STOP` | 0x00 | 0x48 | stop |
| `FWD` | 0x00 | 0x5C | rychle vpřed |
| `REV` | 0x00 | 0x5E | přetočit zpět |
| `MENU` | 0x00 | 0x41 | menu (delší hold, 200 ms) |
| `HOME` | 0x00 | 0x42 | domů (delší hold, 200 ms) |
| `BACK` | 0x00 | 0x43 | zpět |
| `BACK2` | 0x00 | 0x45 | zpět (alternativní) |
| `POWER` | 0x01 | 0x29 | zapnout/vypnout |
| `VOL_DOWN` | 0x01 | 0x3B | hlasitost − |
| `VOL_UP` | 0x01 | 0x3C | hlasitost + |
| `MUTE` | 0x01 | 0x3D | ztlumit |
| `CTRL_PAUSE` | 0x01 | 0x3E | pauza (alt.) |
| `RW` | 0x01 | 0x3F | převinout zpět |
| `FF` | 0x01 | 0x40 | převinout vpřed |
| `RESTART` | 0x01 | 0x41 | restart přehrávání |
| `CH_LIST` | 0x01 | 0x42 | seznam kanálů |
| `CH_UP` | 0x01 | 0x60 | kanál + |
| `CH_DOWN` | 0x01 | 0x5A | kanál − |
| `SKIP_FWD` | 0x01 | 0x5C | přeskočit vpřed |
| `SKIP_BACK` | 0x01 | 0x5E | přeskočit zpět |

**Zatím nezjištěné** (čekají na dohledání přes `RAW:mod:code` v Serial Monitoru): číslice 0–9, TEXT, EPG, hledání (lupa), PLAY, REC, VOD, prev/next skladba. Barevná tlačítka (červená/zelená/žlutá/modrá) se aktuálně neřeší.

## Home Assistant integrace

Tři hotové varianty dashboardu v `home-assistant/`:

- **`dashboard.yaml`** — postaveno čistě na vestavěných HA kartách (`grid` + `button`), **žádný HACS plugin není potřeba**, layout kopíruje rozložení fyzického ovladače (čísla, EPG, směrový kříž, transport controls...). Nefunkční tlačítka (chybí keycode) mají `tap_action: {action: none}` a komentář `# TODO`.
- **`dashboard-hacs-generic-remote-card.yaml`** — **doporučeno od v1.1b**. Přes HACS kartu [generic-remote-control-card](https://github.com/dimagoltsman/generic-remote-control-card) s vlastní šablonou `arris_vip4302` (viz níže) — vizuálně věrná kopie fyzického ovladače ARRIS AURA RCL, ne generický layout s náhodnou sadou tlačítek.

### Vlastní vzhled ovladače — šablona `arris_vip4302` (nové v1.1b)

Standardní šablony karty `generic-remote-control-card` (`simple`, `lg_new`, `mibox`...) mají pevnou předdefinovanou sadu tlačítek bez podpory číselné klávesnice, EPG clusteru nebo barevných tlačítek. Protože žádná neodpovídá layoutu ovladače ARRIS AURA RCL, tenhle projekt dodává **vlastní šablonu** jako samostatný JS soubor:

```
home-assistant/remotes/arris_vip4302/remote-html.js
```

Šablona vizuálně kopíruje fyzický ovladač 1:1 — zaoblené černé tělo, kruhové POWER tlačítko vpravo nahoře, číselná klávesnice 1–9 + TEXT/0/INFO, cluster hlasitost (+/−) / EPG / MUTE / kanál (CH +/−), kruhový d-pad s OK uprostřed, vlevo od něj svisle MENU + HOME, vpravo od něj svislý sloupec options (ikona) / modrá / žlutá / zelená / BACK (zpět) / červená — přesně podle rozmístění na originálním ovladači, TV/REC/VOD a dva řádky transport tlačítek (rewind/play-pause/forward, previous/stop/next). Tlačítka hlasitosti a skoku po programu (CH +/−) mají zvětšené ikony (~30 %) pro lepší čitelnost.

**Instalace šablony:**

1. Nainstaluj samotnou kartu `generic-remote-control-card` přes HACS (Frontend → Vlastní repozitáře).
2. Zkopíruj `home-assistant/remotes/arris_vip4302/remote-html.js` do:
   ```
   /config/www/community/generic-remote-control-card/remotes/arris_vip4302/remote-html.js
   ```
   (vedle existujících `remotes/simple/`, `remotes/lg_new/` atd. — karta si šablonu tahá z `/hacsfiles/generic-remote-control-card/remotes/<template>/remote-html.js`).
3. Vlož `home-assistant/dashboard-hacs-generic-remote-card.yaml` jako manuální (YAML) kartu do dashboardu (`remote_template: arris_vip4302`).
4. Tvrdý refresh prohlížeče (Ctrl+F5), ať se stáhne nová šablona.

**Namapovaná tlačítka** (podle aktuálně zjištěných keycodů — viz tabulka výše): power, směrovka (up/down/left/right/ok), back, menu, home, info, text (teletext), volup/voldown, mute, chup/chdown, tv, rec, playpause, stop, rewind/forward, previous/next.

**Zatím bez akce** (tlačítko je vidět, ale `null` v YAML — čeká na dohledaný keycode): číslice 0–9, EPG, hledání (lupa), VOD, barevná tlačítka.

### Postup nasazení

1. Nahraj `firmware/arris_mqtt_hid.ino` do ESP32-S3 (viz konfigurace desky výše), s doplněným WiFi a MQTT přihlášením.
2. Ověř v HA (**Developer Tools → MQTT**, listen na `arris/vip4302/#`), že ESP po startu pošle `online` na `arris/vip4302/status`.
3. Otestuj publish na `arris/vip4302/cmd` s payloadem např. `UP` — box by měl zareagovat.
4. Vlož `home-assistant/dashboard.yaml` (nebo `dashboard-hacs-generic-remote-card.yaml` + šablonu, viz výše) jako manuální (YAML) kartu do svého dashboardu.

## ⚠️ Poznámka k distribuci přes HACS

Tenhle projekt je **Arduino firmware + ukázková HA dashboard konfigurace + vlastní šablona pro cizí HACS kartu**, ne samostatná Python integrace ani vlastní JS Lovelace plugin — proto ho HACS nemůže nabídnout jako instalovatelnou "integraci" nebo "frontend" komponentu ve svém obchodě (na to by bylo potřeba napsat vlastní `custom_component` nebo publikovat vlastní Lovelace kartu). Releases na GitHubu (viz [Releases](../../releases)) slouží jako verzované ZIP balíčky ke stažení — firmware + dashboard konfigurace + šablona ovladače pohromadě — ne jako plugin instalovatelný přímo z HACS obchodu.

## Changelog

- **v1.2b** — oprava rozmístění tlačítek kolem d-padu podle fotek originálního ovladače ARRIS: MENU + HOME jsou vlevo od kolečka, vpravo svislý sloupec options / modrá / žlutá / zelená / BACK / červená (dřív byly v samostatných řádcích nad a pod kolečkem). Větší d-pad, širší tělo ovladače. ID tlačítek beze změny — MQTT mapování v dashboardu není potřeba upravovat.
- **v1.1b** — přidána vlastní šablona `arris_vip4302` pro `generic-remote-control-card` (vizuálně věrná kopie fyzického ovladače), aktualizovaná `dashboard-hacs-generic-remote-card.yaml` napojená na aktuální MQTT keymap, zvětšené ikony hlasitosti a kanálu (+30 %).
- **v1.0b** — první veřejná verze: USB HID + MQTT most, firmware, HA dashboard (`grid`+`button`), zjištěný keymap.

## Licence

MIT
