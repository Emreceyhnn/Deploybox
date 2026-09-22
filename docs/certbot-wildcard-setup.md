# Let's Encrypt Wildcard SSL (*.emreceyhan.xyz) Kurulum Rehberi

Wildcard SSL sertifikaları (`*.emreceyhan.xyz` ve `emreceyhan.xyz`), güvenlik kuralları gereği Let's Encrypt tarafından **sadece DNS-01 Challenge** yöntemiyle verilir. HTTP-01 challenge wildcard sertifikaları desteklemez.

Bu rehber, Certbot ve DNS eklentileri (örneğin Cloudflare) ile otomatik wildcard sertifika alma, yenileme ve Nginx entegrasyonunu açıklar.

---

## 📋 1. Gereksinimler

- Linux Sunucu (Ubuntu 22.04 / 24.04 veya Debian 12)
- Domain DNS yönetimi (Cloudflare, AWS Route53, DigitalOcean vb.)
- Nginx Gateway

---

## 🚀 2. Adım Adım Kurulum (Cloudflare Örneği)

### Adım 1: Certbot ve Cloudflare DNS Eklentisini Kurun

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-dns-cloudflare
```

---

### Adım 2: Cloudflare API Token Oluşturun

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) adresine gidin.
2. **My Profile -> API Tokens -> Create Token** butonuna tıklayın.
3. **Edit zone DNS** şablonunu seçin.
4. **Zone Resources** alanında domaininizi (`emreceyhan.xyz`) veya *All zones* seçin.
5. Token'ı oluşturup kopyalayın.

---

### Adım 3: Kimlik Bilgileri Dosyasını Oluşturun

Sunucu üzerinde güvenli bir klasör oluşturun ve API Token bilgisini kaydedin:

```bash
sudo mkdir -p /etc/letsencrypt/secrets
sudo nano /etc/letsencrypt/secrets/cloudflare.ini
```

Dosya içeriği:
```ini
# Cloudflare API token for Certbot DNS-01 challenge
dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN_HERE
```

Dosya izinlerini sıkılaştırın (sadece root okuyabilsin):
```bash
sudo chmod 600 /etc/letsencrypt/secrets/cloudflare.ini
```

---

### Adım 4: Wildcard Sertifikayı Alın

Aşağıdaki komutu çalıştırarak wildcard sertifikanızı indirin:

```bash
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/secrets/cloudflare.ini \
  -d "*.emreceyhan.xyz" \
  -d "emreceyhan.xyz" \
  --agree-tos \
  --email admin@emreceyhan.xyz \
  --non-interactive
```

---

### Adım 5: Sertifikaları Nginx Gateway Diziniyle Eşleştirin

Sertifikalar `/etc/letsencrypt/live/emreceyhan.xyz/` altına indirilir. DeployBox Nginx konfigürasyonunun okuyacağı varsayılan dizine symlink oluşturun:

```bash
sudo mkdir -p /etc/nginx/certs

sudo ln -sf /etc/letsencrypt/live/emreceyhan.xyz/fullchain.pem /etc/nginx/certs/cert.pem
sudo ln -sf /etc/letsencrypt/live/emreceyhan.xyz/privkey.pem /etc/nginx/certs/key.pem
```

---

## 🔄 3. Otomatik Yenileme (Auto-Renewal) & Nginx Deploy Hook

Let's Encrypt sertifikaları **90 gün** geçerlidir. Certbot otomatik olarak yenilendiğinde Nginx'in kesintisiz olarak yeni sertifikayı yüklemesi için bir **Deploy Hook** ekleyin.

### Deploy Hook Oluşturma:

```bash
sudo nano /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

Dosya içeriği:
```bash
#!/bin/bash
# Certbot sertifikayı yenilediğinde Nginx syntax kontrolü yapar ve kesintisiz reload atar.
if nginx -t; then
    nginx -s reload
    echo "[$(date)] Nginx konfigürasyonu başarıyla reload edildi." >> /var/log/certbot-reload.log
else
    echo "[$(date)] ERR: Nginx syntax testi başarısız, reload atlanmadı!" >> /var/log/certbot-reload.log
fi
```

Çalıştırma izni verin:
```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

### Yenileme Testi (Dry Run):

Sistemin otomatik yenileme mekanizmasını simüle edin:
```bash
sudo certbot renew --dry-run
```

---

## 🌐 4. Diğer DNS Sağlayıcılar için Eklentiler

Farklı bir DNS sağlayıcısı kullanıyorsanız uygun paketi kurup ilgili `--dns-<provider>` bayrağını kullanabilirsiniz:

| DNS Sağlayıcı | Certbot Paket Adı | Bayrak |
| :--- | :--- | :--- |
| **Cloudflare** | `python3-certbot-dns-cloudflare` | `--dns-cloudflare` |
| **AWS Route53** | `python3-certbot-dns-route53` | `--dns-route53` |
| **DigitalOcean** | `python3-certbot-dns-digitalocean` | `--dns-digitalocean` |
| **Hetzner** | `python3-certbot-dns-hetzner` | `--dns-hetzner` |
| **Google Cloud DNS** | `python3-certbot-dns-google` | `--dns-google` |
