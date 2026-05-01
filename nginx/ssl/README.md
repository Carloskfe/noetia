# SSL Certificates

Place your SSL certificate and key files here for production use.

For local development, generate a self-signed certificate:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./nginx/ssl/privkey.pem \
  -out ./nginx/ssl/fullchain.pem \
  -subj "/C=US/ST=Local/L=Local/O=Noetia/CN=localhost"
```

For production, use certificates from Let's Encrypt (Certbot) or your provider.
Expected files: `fullchain.pem`, `privkey.pem`
