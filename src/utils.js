let jose = require('node-jose');
let forge = require('node-forge');
let fs = require('fs');


module.exports = {
  pkcs12ToJwk: async (file, password) => {

    let buffer = fs.readFileSync(file, 'binary');
    let p12Asn1 = forge.asn1.fromDer(buffer);
    // decrypt p12 using the password 'password'
    let p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    // get bags by type
    var certBags = p12.getBags({
      bagType: forge.pki.oids.certBag
    });
    var pkeyBags = p12.getBags({
      bagType: forge.pki.oids.pkcs8ShroudedKeyBag
    });
    // fetching certBag
    var certBag = certBags[forge.pki.oids.certBag][0];
    // fetching keyBag
    var keybag = pkeyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
    // generate pem from private key
    var privateKeyPem = forge.pki.privateKeyToPem(keybag.key);
    // generate pem from cert
    var certificate = forge.pki.certificateToPem(certBag.cert);
    let jwk = await jose.JWK.asKey(privateKeyPem, 'pem').then((r) => {
      return r.toJSON(true)
    })
    delete jwk.kid
    return jwk;
  }
}