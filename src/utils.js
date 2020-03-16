const jose = require('node-jose');
const forge = require('node-forge');
const fs = require('fs');


module.exports = {
  pkcs12ToJwk: async (file, password) => {
    const buffer = fs.readFileSync(file, 'binary');
    const p12Asn1 = forge.asn1.fromDer(buffer);
    // decrypt p12 using the password 'password'
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    // get bags by type
    const pkeyBags = p12.getBags({
      bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
    });
    const keybag = pkeyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
    // generate pem from private key
    const privateKeyPem = forge.pki.privateKeyToPem(keybag.key);
    const jwk = await jose.JWK.asKey(privateKeyPem, 'pem').then((r) => {
      return r.toJSON(true);
    });
    delete jwk.kid;
    return jwk;
  },
};
