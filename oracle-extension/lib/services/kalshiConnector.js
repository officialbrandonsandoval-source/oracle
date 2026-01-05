// Kalshi API V2 Connector with RSA Signing
// Note: Requires User to provide Key ID and Private Key string

const KalshiConnector = {
  BASE_URL: 'https://api.elections.kalshi.com/trade-api/v2',

  // Convert PEM private key to CryptoKey
  async importPrivateKey(pemKey) {
    // Remove header/footer
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = pemKey.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
    
    // Base64 decode
    const binaryDerString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    return await crypto.subtle.importKey(
        "pkcs8",
        binaryDer.buffer,
        {
            name: "RSA-PSS",
            hash: "SHA-256",
        },
        false,
        ["sign"]
    );
  },

  async signRequest(method, path, timestamp, privateKey) {
    // Method + Path + Timestamp + Msg (if any, skipped for GET)
    const msg = `${timestamp}${method}${path}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(msg);

    const signature = await crypto.subtle.sign(
        {
            name: "RSA-PSS",
            saltLength: 32,
        },
        privateKey,
        data
    );

    // Convert to Base64
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  },

  async getPortfolio(keyId, privateKeyPem) {
    if (!keyId || !privateKeyPem) return null;

    try {
      const privateKey = await this.importPrivateKey(privateKeyPem);
      const timestamp = Date.now().toString();
      const path = '/portfolio/balance';
      
      const signature = await this.signRequest('GET', path, timestamp, privateKey);

      const response = await fetch(`${this.BASE_URL}${path}`, {
        method: 'GET',
        headers: {
          'KALSHI-ACCESS-KEY': keyId,
          'KALSHI-ACCESS-SIGNATURE': signature,
          'KALSHI-ACCESS-TIMESTAMP': timestamp,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`Kalshi API Error: ${response.status}`);
      return await response.json();
    } catch (e) {
      console.error('[ORACLE] Kalshi portfolio fetch failed:', e);
      return null;
    }
  }
};
