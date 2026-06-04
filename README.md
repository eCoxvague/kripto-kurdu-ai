# Kripto Kurdu AI

Agnes AI API ile çalışan yerel web arayüzü. Chat, görsel üretimi ve video task akışını destekler.

## Özellikler

- Chat mesajlaşması
- Ctrl+V ile chat'e görsel ekleme
- Görsel üretimi ve girdi görsel URL desteği
- Video task oluşturma ve otomatik sonuç takip
- Prompt detay alanları
- Yerel konuşma geçmişi
- Tarayıcıdan API key kaydetme

## Kurulum

```powershell
npm install
```

`.env.example` dosyasını `.env` olarak kopyala ve API key'i gir:

```env
AGNES_API_KEY=your_agnes_api_key_here
PORT=3000
```

## Çalıştırma

```powershell
npm start
```

Sonra tarayıcıda şu adresi aç:

```text
http://localhost:3000
```

## API Key

API key iki şekilde kullanılabilir:

- `.env` dosyasına `AGNES_API_KEY` olarak eklenebilir.
- Arayüzdeki `API Ayarları` bölümünden tarayıcıya kaydedilebilir.

API key almak için Agnes platformu:

```text
https://platform.agnes-ai.com/
```

`.env` dosyası Git'e eklenmemelidir.

## Geçmiş

Chat geçmişi sunucuya yazılmaz. Tarayıcının `localStorage` alanında saklanır. En fazla 10 konuşma ve her konuşmada son 10 mesaj tutulur; eski kayıtlar otomatik düşer.
