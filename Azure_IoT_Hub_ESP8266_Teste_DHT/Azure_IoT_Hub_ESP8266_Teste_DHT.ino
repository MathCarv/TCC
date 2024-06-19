#include <cstdlib>
#include <stdbool.h>
#include <string.h>
#include <time.h>

#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <base64.h>
#include <bearssl/bearssl.h>
#include <bearssl/bearssl_hmac.h>
#include <libb64/cdecode.h>
#include <DHT.h>
#include <ESP8266WebServer.h>
#include <FS.h>

#include <az_core.h>
#include <az_iot.h>
#include <azure_ca.h>

#include "iot_configs.h"

#define AZURE_SDK_CLIENT_USER_AGENT "c%2F" AZ_SDK_VERSION_STRING "(ard;esp8266)"

static bool travaAberta = false; // Variável para armazenar o estado da trava
#define LED_PIN 2
#define DHT_PIN 4
#define SENSOR_PRESENCA_PIN 5
#define SENSOR_MAGNETISMO_PIN 16
#define SENSOR_TRAVA_PIN 0
#define DHT_TYPE DHT11
#define sizeofarray(a) (sizeof(a) / sizeof(a[0]))
#define ONE_HOUR_IN_SECS 3600
#define NTP_SERVERS "pool.ntp.org", "time.nist.gov"
#define MQTT_PACKET_SIZE 1024 

static const char* ssid = IOT_CONFIG_WIFI_SSID;
static const char* password = IOT_CONFIG_WIFI_PASSWORD;
static const char* host = IOT_CONFIG_IOTHUB_FQDN;

static const char* device_id_dht = IOT_CONFIG_DEVICE_ID_DHT;
static const char* device_key_dht = IOT_CONFIG_DEVICE_KEY_DHT;

static const char* device_id_presenca = IOT_CONFIG_DEVICE_ID_PRESENCA;
static const char* device_key_presenca = IOT_CONFIG_DEVICE_KEY_PRESENCA;

static const char* device_id_magnetismo = IOT_CONFIG_DEVICE_ID_MAGNETISMO;
static const char* device_key_magnetismo = IOT_CONFIG_DEVICE_KEY_MAGNETISMO;

static const char* device_id_trava = IOT_CONFIG_DEVICE_ID_TRAVA;
static const char* device_key_trava = IOT_CONFIG_DEVICE_KEY_TRAVA;

static const int port = 8883;
 
static WiFiClientSecure wifi_client;
static X509List cert((const char*)ca_pem);


static PubSubClient mqtt_client(wifi_client);


static az_iot_hub_client client_dht;
static az_iot_hub_client client_presenca;
static az_iot_hub_client client_magnetismo;
static az_iot_hub_client client_trava;
static char sas_token_dht[200];
static char sas_token_presenca[200];
static char sas_token_magnetismo[200];
static char sas_token_trava[200];
static uint8_t signature[512];
static unsigned char encrypted_signature[32];
static char base64_decoded_device_key_dht[32];
static char base64_decoded_device_key_presenca[32];
static char base64_decoded_device_key_magnetismo[32];
static char base64_decoded_device_key_trava[32];
static unsigned long next_telemetry_send_time_ms = 0;
static char telemetry_topic_dht[128];
static char telemetry_topic_presenca[128];
static char telemetry_topic_magnetismo[128];
static char telemetry_topic_trava[128];
static uint8_t telemetry_payload_dht[100];
static uint8_t telemetry_payload_presenca[100];
static uint8_t telemetry_payload_magnetismo[100];
static uint8_t telemetry_payload_trava[100];
static uint32_t telemetry_send_count_dht = 0;
static uint32_t telemetry_send_count_presenca = 0;
static uint32_t telemetry_send_count_magnetismo = 0;
static uint32_t telemetry_send_count_trava = 0;
static DHT dht(DHT_PIN, DHT_TYPE);

ESP8266WebServer server(80);

static void connectToWiFi() {
  Serial.begin(9600);
  Serial.println();
  Serial.print("Connecting to WIFI SSID ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }

  Serial.print("WiFi connected, IP address: ");
  Serial.println(WiFi.localIP());
}

static void initializeTime() {
  Serial.print("Setting time using SNTP");

  configTime(-5 * 3600, 0, NTP_SERVERS);
  time_t now = time(NULL);
  while (now < 1510592825)
  {
    delay(500);
    Serial.print(".");
    now = time(NULL);
  }
  Serial.println("done!");
}

static char* getCurrentLocalTimeString() {
  time_t now = time(NULL);
  return ctime(&now);
}

static void printCurrentTime() {
  Serial.print("Current time: ");
  Serial.print(getCurrentLocalTimeString());
}

void receivedCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message received on topic: ");
  Serial.println(topic);
  
  // Converte o payload em uma string
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  // Exemplo de processamento de mensagem
  // Aqui você deve implementar a lógica para interpretar a mensagem recebida do IoT Hub
  // Neste exemplo, considera-se que a mensagem contém o estado da trava (1 para aberta, 0 para fechada)
  if (message.equals("1")) {
    travaAberta = true;
    Serial.println("Trava está aberta.");
  } else if (message.equals("0")) {
    travaAberta = false;
    Serial.println("Trava está fechada.");
  } else {
    Serial.println("Mensagem recebida inválida.");
  }
}

static void initializeClients(const char* device_id, az_iot_hub_client* client) {
  az_iot_hub_client_options options = az_iot_hub_client_options_default();
  options.user_agent = AZ_SPAN_FROM_STR(AZURE_SDK_CLIENT_USER_AGENT);

  wifi_client.setTrustAnchors(&cert);
  if (az_result_failed(az_iot_hub_client_init(
          client,
          az_span_create((uint8_t*)host, strlen(host)),
          az_span_create((uint8_t*)device_id, strlen(device_id)),
          &options)))
  {
    Serial.println("Failed initializing Azure IoT Hub client for ");
    Serial.println(device_id);
    return;
  }

  mqtt_client.setServer(host, port);
  mqtt_client.setCallback(receivedCallback);
}

static uint32_t getSecondsSinceEpoch() { return (uint32_t)time(NULL); }

static int generateSasToken(char* sas_token, size_t size, const char* device_key, char* base64_decoded_device_key, az_iot_hub_client* client) {
  az_span signature_span = az_span_create((uint8_t*)signature, sizeofarray(signature));
  az_span out_signature_span;
  az_span encrypted_signature_span
      = az_span_create((uint8_t*)encrypted_signature, sizeofarray(encrypted_signature));

  uint32_t expiration = getSecondsSinceEpoch() + ONE_HOUR_IN_SECS;

  if (az_result_failed(az_iot_hub_client_sas_get_signature(
          client, expiration, signature_span, &out_signature_span)))
  {
    Serial.println("Failed getting SAS signature");
    return 1;
  }

  int base64_decoded_device_key_length
      = base64_decode_chars(device_key, strlen(device_key), base64_decoded_device_key);

  if (base64_decoded_device_key_length == 0)
  {
    Serial.println("Failed base64 decoding device key");
    return 1;
  }

  br_hmac_key_context kc;
  br_hmac_key_init(
      &kc, &br_sha256_vtable, base64_decoded_device_key, base64_decoded_device_key_length);

  br_hmac_context hmac_ctx;
  br_hmac_init(&hmac_ctx, &kc, 32);
  br_hmac_update(&hmac_ctx, az_span_ptr(out_signature_span), az_span_size(out_signature_span));
  br_hmac_out(&hmac_ctx, encrypted_signature);

  String b64enc_hmacsha256_signature = base64::encode(encrypted_signature, br_hmac_size(&hmac_ctx));

  az_span b64enc_hmacsha256_signature_span = az_span_create(
      (uint8_t*)b64enc_hmacsha256_signature.c_str(), b64enc_hmacsha256_signature.length());

  if (az_result_failed(az_iot_hub_client_sas_get_password(
          client,
          expiration,
          b64enc_hmacsha256_signature_span,
          AZ_SPAN_EMPTY,
          sas_token,
          size,
          NULL)))
  {
    Serial.println("Failed getting SAS token");
    return 1;
  }

  return 0;
}

static int connectToAzureIoTHub(char* sas_token, az_iot_hub_client* client) {
  size_t client_id_length;
  char mqtt_client_id[128];
  if (az_result_failed(az_iot_hub_client_get_client_id(
          client, mqtt_client_id, sizeof(mqtt_client_id) - 1, &client_id_length)))
  {
    Serial.println("Failed getting client id");
    return 1;
  }

  mqtt_client_id[client_id_length] = '\0';

  char mqtt_username[128];
  if (az_result_failed(az_iot_hub_client_get_user_name(
          client, mqtt_username, sizeofarray(mqtt_username), NULL)))
  {
    printf("Failed to get MQTT clientId, return code\n");
    return 1;
  }

  Serial.print("Client ID: ");
  Serial.println(mqtt_client_id);

  Serial.print("Username: ");
  Serial.println(mqtt_username);

  mqtt_client.setBufferSize(MQTT_PACKET_SIZE);

  while (!mqtt_client.connected())
  {
    time_t now = time(NULL);

    Serial.print("MQTT connecting ... ");

    if (mqtt_client.connect(mqtt_client_id, mqtt_username, sas_token))
    {
      Serial.println("connected.");
    }
    else
    {
      Serial.print("failed, status code =");
      Serial.print(mqtt_client.state());
      Serial.println(". Trying again in 5 seconds.");
      delay(5000);
    }
  }

  mqtt_client.subscribe(AZ_IOT_HUB_CLIENT_C2D_SUBSCRIBE_TOPIC);
  return 0;
}

static void establishConnection() {
  connectToWiFi();
  initializeTime();
  printCurrentTime();
  initializeClients(device_id_dht, &client_dht);
  initializeClients(device_id_presenca, &client_presenca);
  initializeClients(device_id_magnetismo, &client_magnetismo);
  initializeClients(device_id_trava, &client_trava);

  // Geração dos tokens SAS para cada dispositivo
  if (generateSasToken(sas_token_dht, sizeofarray(sas_token_dht), device_key_dht, base64_decoded_device_key_dht, &client_dht) != 0)
  {
    Serial.println("Failed generating MQTT password for DHT device");
  }

  if (generateSasToken(sas_token_presenca, sizeofarray(sas_token_presenca), device_key_presenca, base64_decoded_device_key_presenca, &client_presenca) != 0)
  {
    Serial.println("Failed generating MQTT password for presence sensor device");
  }

  if (generateSasToken(sas_token_magnetismo, sizeofarray(sas_token_magnetismo), device_key_magnetismo, base64_decoded_device_key_magnetismo, &client_magnetismo) != 0)
  {
    Serial.println("Failed generating MQTT password for magnetism sensor device");
  }

  if (generateSasToken(sas_token_trava, sizeofarray(sas_token_trava), device_key_trava, base64_decoded_device_key_trava, &client_trava) != 0)
  {
    Serial.println("Failed generating MQTT password for lock sensor device");
  }
  connectToAzureIoTHub(sas_token_dht, &client_dht);
  digitalWrite(LED_PIN, LOW);
}

static char* getTelemetryPayloadDHT(float temperature, float humidity) {
  snprintf((char*)telemetry_payload_dht, sizeof(telemetry_payload_dht), 
           "{ \"deviceId\": \"%s\", \"messageId\": %d, \"temperature\": %.2f, \"humidity\": %.2f }",
           device_id_dht, ++telemetry_send_count_dht, temperature, humidity);
  Serial.print("Telemetry Payload: ");
  Serial.println((char*)telemetry_payload_dht);
  return (char*)telemetry_payload_dht;
}

static char* getTelemetryPayloadPresenca(int presenceValue) {
  snprintf((char*)telemetry_payload_presenca, sizeof(telemetry_payload_presenca), 
           "{ \"deviceId\": \"%s\", \"messageId\": %d, \"presence\": %d }",
           device_id_presenca, ++telemetry_send_count_presenca, presenceValue);
  Serial.print("Telemetry Payload (Presence): ");
  Serial.println((char*)telemetry_payload_presenca);
  return (char*)telemetry_payload_presenca;
}

static char* getTelemetryPayloadMagnetismo(int magnetismValue) {
  snprintf((char*)telemetry_payload_magnetismo, sizeof(telemetry_payload_magnetismo), 
           "{ \"deviceId\": \"%s\", \"messageId\": %d, \"magnetism\": %d }",
           device_id_magnetismo, ++telemetry_send_count_magnetismo, magnetismValue);
  Serial.print("Telemetry Payload (Magnetism): ");
  Serial.println((char*)telemetry_payload_magnetismo);
  return (char*)telemetry_payload_magnetismo;
}

static char* getTelemetryPayloadTrava(int lockValue) {
  snprintf((char*)telemetry_payload_trava, sizeof(telemetry_payload_trava), 
           "{ \"deviceId\": \"%s\", \"messageId\": %d, \"lock\": %d }",
           device_id_trava, ++telemetry_send_count_trava, lockValue);
  Serial.print("Telemetry Payload (Lock): ");
  Serial.println((char*)telemetry_payload_trava);
  return (char*)telemetry_payload_trava;
}

static void sendTelemetry_dht() {
  digitalWrite(LED_PIN, HIGH);
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }
  
  Serial.print("ESP8266 Sending telemetry - Temperature: ");
  Serial.print(temperature);
  Serial.print(" °C , Humidity: ");
  Serial.print(humidity);
  Serial.println(" %");
  
  if (az_result_failed(az_iot_hub_client_telemetry_get_publish_topic(
          &client_dht, NULL, telemetry_topic_dht, sizeof(telemetry_topic_dht), NULL)))
  {
    Serial.println("Failed az_iot_hub_client_telemetry_get_publish_topic");
    return;
  }

  mqtt_client.publish(telemetry_topic_dht, getTelemetryPayloadDHT(temperature, humidity), false);
  Serial.println("OK");
  delay(100);
  digitalWrite(LED_PIN, LOW);
  mqtt_client.disconnect();
}

static void sendTelemetry_presenca() {
  pinMode(SENSOR_PRESENCA_PIN, INPUT);  // Define o pino como entrada para leitura do sensor
  digitalWrite(LED_PIN, HIGH);
  int presenceValue = digitalRead(SENSOR_PRESENCA_PIN);  // Lê o valor do sensor de presença
  
  Serial.print("ESP8266 Sending telemetry - Presence: ");
  Serial.println(presenceValue);
  
  if (az_result_failed(az_iot_hub_client_telemetry_get_publish_topic(
          &client_presenca, NULL, telemetry_topic_presenca, sizeof(telemetry_topic_presenca), NULL)))
  {
    Serial.println("Failed az_iot_hub_client_telemetry_get_publish_topic");
    return;
  }

  mqtt_client.publish(telemetry_topic_presenca, getTelemetryPayloadPresenca(presenceValue), false);
  Serial.println("OK");
  delay(100);
  digitalWrite(LED_PIN, LOW);
  mqtt_client.disconnect();
}

static void requestTravaState() {
    mqtt_client.setServer(IOT_CONFIG_IOTHUB_FQDN, port);
    Serial.print("Connecting to Azure IoT Hub...");

    while (!mqtt_client.connected()) {
    if (mqtt_client.connect(IOT_CONFIG_DEVICE_ID_TRAVA, IOT_CONFIG_DEVICE_KEY_TRAVA, NULL)) {
      Serial.println("Connected to Azure IoT Hub!");
    } else {
      Serial.print("Failed, rc=");
      Serial.print(mqtt_client.state());
      Serial.println(" Trying again in 5 seconds...");
      delay(5000);
    }
  }
  // Subscrever ao tópico para receber mensagens do dispositivo
  const char* subscribeTopic = "devices/sensortrava/messages/devicebound/#";
  if (mqtt_client.subscribe(subscribeTopic)) {
    Serial.print("Subscribed to topic: ");
    Serial.println(subscribeTopic);
  } else {
    Serial.println("Failed to subscribe. Check MQTT connection.");
  }

  if (travaAberta) {
      digitalWrite(SENSOR_TRAVA_PIN, HIGH); 
    } 
  else {
      digitalWrite(SENSOR_TRAVA_PIN, LOW); 
   }
}


static void sendTelemetry_magnetismo() {
  pinMode(SENSOR_MAGNETISMO_PIN, INPUT);  // Define o pino como entrada para leitura do sensor
  digitalWrite(LED_PIN, HIGH);
  int magnetismValue = digitalRead(SENSOR_MAGNETISMO_PIN);  // Lê o valor do sensor de magnetismo
  
  Serial.print("ESP8266 Sending telemetry - Magnetism: ");
  Serial.println(magnetismValue);
  
  if (az_result_failed(az_iot_hub_client_telemetry_get_publish_topic(
          &client_magnetismo, NULL, telemetry_topic_magnetismo, sizeof(telemetry_topic_magnetismo), NULL)))
  {
    Serial.println("Failed az_iot_hub_client_telemetry_get_publish_topic");
    return;
  }

  mqtt_client.publish(telemetry_topic_magnetismo, getTelemetryPayloadMagnetismo(magnetismValue), false);
  Serial.println("OK");
  delay(100);
  digitalWrite(LED_PIN, LOW);
  mqtt_client.disconnect();
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(SENSOR_PRESENCA_PIN, INPUT);
  pinMode(SENSOR_MAGNETISMO_PIN, INPUT);
  pinMode(SENSOR_TRAVA_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);
  dht.begin();
  connectToWiFi();
  initializeTime();
  printCurrentTime();
  initializeClients(device_id_dht, &client_dht);
  initializeClients(device_id_presenca, &client_presenca);
  initializeClients(device_id_magnetismo, &client_magnetismo);
  initializeClients(device_id_trava, &client_trava);
  mqtt_client.setServer(host, port);
  mqtt_client.setCallback(receivedCallback);

  // Geração dos tokens SAS para cada dispositivo
  if (generateSasToken(sas_token_dht, sizeofarray(sas_token_dht), device_key_dht, base64_decoded_device_key_dht, &client_dht) != 0)
  {
    Serial.println("Failed generating MQTT password for DHT device");
  }

  if (generateSasToken(sas_token_presenca, sizeofarray(sas_token_presenca), device_key_presenca, base64_decoded_device_key_presenca, &client_presenca) != 0)
  {
    Serial.println("Failed generating MQTT password for presence sensor device");
  }

  if (generateSasToken(sas_token_magnetismo, sizeofarray(sas_token_magnetismo), device_key_magnetismo, base64_decoded_device_key_magnetismo, &client_magnetismo) != 0)
  {
    Serial.println("Failed generating MQTT password for magnetism sensor device");
  }

  if (generateSasToken(sas_token_trava, sizeofarray(sas_token_trava), device_key_trava, base64_decoded_device_key_trava, &client_trava) != 0)
  {
    Serial.println("Failed generating MQTT password for lock sensor device");
  }
  connectToAzureIoTHub(sas_token_dht, &client_dht);
  // Aqui você pode continuar com a lógica de conexão aos respectivos hubs Azure IoT Hub
  digitalWrite(LED_PIN, LOW);
}

void loop() {
  server.handleClient();

  // Verifica se é hora de enviar telemetria
  if (millis() > next_telemetry_send_time_ms)
  {
    // Verifica se o cliente MQTT não está conectado e estabelece a conexão se necessário
    if (!mqtt_client.connected())
    {
      establishConnection();  // Esta função deve tentar conectar apenas se necessário
    }
    // Se a conexão foi estabelecida ou já estava conectado, envia telemetria para todos os dispositivos
    if (mqtt_client.connected())
    {
      sendTelemetry_dht();
      connectToAzureIoTHub(sas_token_magnetismo, &client_magnetismo);
      sendTelemetry_magnetismo();
      connectToAzureIoTHub(sas_token_presenca, &client_presenca);
      sendTelemetry_presenca();
      connectToAzureIoTHub(sas_token_trava, &client_trava);
      requestTravaState();
      connectToAzureIoTHub(sas_token_dht, &client_dht);
      // Atualiza o tempo para o próximo envio de telemetria
      next_telemetry_send_time_ms = millis() + TELEMETRY_FREQUENCY_MILLISECS;
    }
    else
    {
      // Caso não esteja conectado, você pode decidir o que fazer, como tentar conectar novamente ou apenas aguardar
      Serial.println("MQTT client is not connected. Waiting for connection...");
    }
  }

  // Mantém o loop do cliente MQTT
  mqtt_client.loop();

  // Aguarda um pequeno intervalo de tempo
  delay(500);
}
