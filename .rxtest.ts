import { writeFileSync } from "node:fs";
import QRCode from "qrcode";
import { buildSheet, builtinConfig, sampleSheet } from "./src/lib/rx-sheet";
import { opsToPdf } from "./src/lib/rx-render";
import { demoSignature, demoStamp } from "./prisma/lib/demo-images";
const out = process.argv[2];
(async () => {
  const doctor = { name: "Dr Amira Trabelsi", title: "Dermatologue", specialty: "Dermatologie", license: "TN-DER-1407", clinic: "Clinique Dermatologique de Sfax", address: "Avenue Habib Bourguiba", city: "Sfax", phone: "+216 74 000 000" };
  const data = { ...sampleSheet(doctor), number: "RX-20260930-1A2B3C4D", verify: { url: "https://lifedeux.afdev.site/verify/RX-20260930-1A2B3C4D", fingerprint: "08D0F06C76327BFC" } };
  const qr = await QRCode.toBuffer(data.verify.url, { margin: 1, width: 240 });
  for (const ref of ["builtin:teal", "builtin:rose"]) {
    const pdf = await opsToPdf(buildSheet(data, builtinConfig(ref)!), { stamp: { bytes: demoStamp(), mime: "image/png" }, signature: { bytes: demoSignature(), mime: "image/png" }, qr: { bytes: qr, mime: "image/png" } }, { title: "t", author: "a" });
    writeFileSync(`${out}/${ref.split(":")[1]}.pdf`, pdf);
  }
  const draft = await opsToPdf(buildSheet(sampleSheet(doctor), builtinConfig("builtin:teal")!), { stamp: { bytes: demoStamp(), mime: "image/png" } }, { title: "t", author: "a" });
  writeFileSync(`${out}/teal-draft.pdf`, draft);
})();
