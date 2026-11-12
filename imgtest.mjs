import { generateText } from "ai";
import * as ai from "ai";
import { writeFileSync } from "node:fs";
const prompt = "Photorealistic cinematic portrait of a friendly fictional Brazilian woman in her 30s who runs an artisanal cookie bakery, warm soft light, shallow depth of field, looking at camera, head and shoulders, plain warm pink backdrop, 85mm lens.";
const gen = ai.generateImage ?? ai.experimental_generateImage;
for (const m of process.argv.slice(2)) {
  const t = Date.now();
  try {
    if (m.startsWith("google/")) {
      const r = await generateText({ model: m, prompt });
      const f = r.files?.find(f => f.mediaType?.startsWith("image/"));
      if (!f) throw new Error("sem imagem");
      writeFileSync(`${process.env.TEMP}/fricimg/${m.replace("/","_")}.png`, f.uint8Array);
    } else {
      const r = await gen({ model: m, prompt, aspectRatio: "1:1" });
      writeFileSync(`${process.env.TEMP}/fricimg/${m.replace("/","_")}.png`, r.image.uint8Array);
    }
    console.log("OK", m, ((Date.now()-t)/1000).toFixed(1)+"s");
  } catch (e) { console.log("NO", m, String(e.message).slice(0,90)); }
}
