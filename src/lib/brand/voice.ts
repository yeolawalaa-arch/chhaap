import type { Rng } from "@/lib/brand/rng";
import type { TraitProfile } from "@/lib/brand/personality";
import type { IndustryProfile } from "@/lib/brand/industries";
import { languageDef } from "@/lib/brand/languages";
import type { BrandBrief, BrandStrategy, LanguageCode } from "@/types/brand";

/**
 * Brand voice and taglines.
 *
 * The output here is deliberately specific: a caption a shop owner could paste
 * into Instagram today, and a WhatsApp Business greeting in the language they
 * actually trade in. Generic "we deliver excellence" filler is what makes AI
 * branding tools feel worthless, so the templates are all written per language
 * and per category rather than translated from one English source.
 */

// ---------------------------------------------------------------------------
// Localised copy scaffolds
// ---------------------------------------------------------------------------

interface VoicePack {
  /** `{name}`, `{city}`, `{descriptor}` interpolate. */
  captions: string[];
  whatsapp: string[];
  /** Connector used when building bilingual taglines. */
  tone: string[];
}

const VOICE_PACKS: Record<LanguageCode, VoicePack> = {
  en: {
    captions: [
      "New in at {name} this week. Come see for yourself.",
      "{name} — made properly, priced fairly.",
      "The one everyone in {city} keeps asking about. Now at {name}.",
      "Small batch. Big difference. Only at {name}.",
    ],
    whatsapp: [
      "Hi! Thanks for messaging {name}. Tell us what you need and we'll get back within the hour.",
      "Welcome to {name}. Send us your order or ask for today's rates — we reply fast.",
    ],
    tone: ["direct", "warm", "unfussy"],
  },
  hinglish: {
    captions: [
      "Aaj kya naya hai {name} mein? Aakar dekhiye.",
      "{name} — sahi quality, sahi daam.",
      "{city} ka favourite ban gaya hai. {name} pe milte hain.",
      "Ek baar try kariye. Baar baar aayenge. — {name}",
    ],
    whatsapp: [
      "Namaste! {name} se baat karne ke liye shukriya. Bataiye kya chahiye, hum turant reply karte hain.",
      "Welcome to {name}! Order bhejiye ya aaj ka rate poochhiye — jaldi jawab milega.",
    ],
    tone: ["conversational", "warm", "code-switching naturally"],
  },
  hi: {
    captions: [
      "{name} में इस हफ़्ते कुछ नया। ज़रूर देखिए।",
      "{name} — सही गुणवत्ता, सही दाम।",
      "{city} की पसंद अब {name} पर।",
      "एक बार आइए, बार-बार आएँगे। — {name}",
    ],
    whatsapp: [
      "नमस्ते! {name} से संपर्क करने के लिए धन्यवाद। बताइए आपको क्या चाहिए, हम जल्दी जवाब देंगे।",
      "{name} में आपका स्वागत है। ऑर्डर भेजिए या आज का रेट पूछिए।",
    ],
    tone: ["सरल", "आदरपूर्ण", "सीधा"],
  },
  mr: {
    captions: [
      "{name} मध्ये या आठवड्यात नवीन. नक्की बघा.",
      "{name} — योग्य दर्जा, योग्य किंमत.",
      "{city} ची पसंती आता {name} वर.",
    ],
    whatsapp: [
      "नमस्कार! {name} शी संपर्क साधल्याबद्दल धन्यवाद. तुम्हाला काय हवं आहे सांगा, आम्ही लवकर उत्तर देऊ.",
      "{name} मध्ये आपले स्वागत आहे. ऑर्डर पाठवा किंवा आजचा दर विचारा.",
    ],
    tone: ["सोपं", "आपुलकीचं", "थेट"],
  },
  gu: {
    captions: [
      "{name} માં આ અઠવાડિયે નવું. જરૂર જુઓ.",
      "{name} — સાચી ગુણવત્તા, વાજબી ભાવ.",
      "{city} ની પસંદ હવે {name} પર.",
    ],
    whatsapp: [
      "નમસ્તે! {name} નો સંપર્ક કરવા બદલ આભાર. તમને શું જોઈએ છે જણાવો, અમે ઝડપથી જવાબ આપીશું.",
      "{name} માં આપનું સ્વાગત છે. ઓર્ડર મોકલો અથવા આજનો ભાવ પૂછો.",
    ],
    tone: ["સરળ", "વિશ્વાસપાત્ર", "સીધું"],
  },
  ta: {
    captions: [
      "{name} இல் இந்த வாரம் புதியது. கண்டிப்பாக பாருங்கள்.",
      "{name} — சரியான தரம், நியாயமான விலை.",
      "{city} இன் விருப்பம் இப்போது {name} இல்.",
    ],
    whatsapp: [
      "வணக்கம்! {name} ஐ தொடர்பு கொண்டதற்கு நன்றி. உங்களுக்கு என்ன வேண்டும் சொல்லுங்கள், விரைவில் பதிலளிப்போம்.",
      "{name} க்கு வரவேற்கிறோம். ஆர்டர் அனுப்புங்கள் அல்லது இன்றைய விலையை கேளுங்கள்.",
    ],
    tone: ["எளிமை", "மரியாதை", "நேரடி"],
  },
  te: {
    captions: [
      "{name} లో ఈ వారం కొత్తది. తప్పకుండా చూడండి.",
      "{name} — సరైన నాణ్యత, సరైన ధర.",
      "{city} ఇష్టం ఇప్పుడు {name} లో.",
    ],
    whatsapp: [
      "నమస్కారం! {name} ని సంప్రదించినందుకు ధన్యవాదాలు. మీకు ఏమి కావాలో చెప్పండి, త్వరగా స్పందిస్తాము.",
      "{name} కి స్వాగతం. ఆర్డర్ పంపండి లేదా ఈరోజు ధర అడగండి.",
    ],
    tone: ["సరళం", "గౌరవం", "నేరుగా"],
  },
  bn: {
    captions: [
      "{name} এ এই সপ্তাহে নতুন। অবশ্যই দেখুন।",
      "{name} — সঠিক মান, সঠিক দাম।",
      "{city} এর পছন্দ এখন {name} এ।",
    ],
    whatsapp: [
      "নমস্কার! {name} এ যোগাযোগ করার জন্য ধন্যবাদ। আপনার কী প্রয়োজন বলুন, আমরা দ্রুত উত্তর দেব।",
      "{name} এ আপনাকে স্বাগতম। অর্ডার পাঠান বা আজকের দাম জিজ্ঞাসা করুন।",
    ],
    tone: ["সহজ", "আন্তরিক", "সরাসরি"],
  },
  kn: {
    captions: [
      "{name} ನಲ್ಲಿ ಈ ವಾರ ಹೊಸತು. ಖಂಡಿತ ನೋಡಿ.",
      "{name} — ಸರಿಯಾದ ಗುಣಮಟ್ಟ, ಸರಿಯಾದ ಬೆಲೆ.",
      "{city} ನ ಆಯ್ಕೆ ಈಗ {name} ನಲ್ಲಿ.",
    ],
    whatsapp: [
      "ನಮಸ್ಕಾರ! {name} ಅನ್ನು ಸಂಪರ್ಕಿಸಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ನಿಮಗೆ ಏನು ಬೇಕು ಹೇಳಿ, ಬೇಗ ಉತ್ತರಿಸುತ್ತೇವೆ.",
      "{name} ಗೆ ಸ್ವಾಗತ. ಆರ್ಡರ್ ಕಳುಹಿಸಿ ಅಥವಾ ಇಂದಿನ ದರ ಕೇಳಿ.",
    ],
    tone: ["ಸರಳ", "ಗೌರವ", "ನೇರ"],
  },
  ml: {
    captions: [
      "{name} ൽ ഈ ആഴ്ച പുതിയത്. തീർച്ചയായും കാണുക.",
      "{name} — ശരിയായ ഗുണനിലവാരം, ന്യായമായ വില.",
      "{city} യുടെ ഇഷ്ടം ഇപ്പോൾ {name} ൽ.",
    ],
    whatsapp: [
      "നമസ്കാരം! {name} ബന്ധപ്പെട്ടതിന് നന്ദി. നിങ്ങൾക്ക് എന്താണ് വേണ്ടതെന്ന് പറയൂ, വേഗം മറുപടി നൽകാം.",
      "{name} ലേക്ക് സ്വാഗതം. ഓർഡർ അയക്കൂ അല്ലെങ്കിൽ ഇന്നത്തെ വില ചോദിക്കൂ.",
    ],
    tone: ["ലളിതം", "ആദരവ്", "നേരിട്ട്"],
  },
  pa: {
    captions: [
      "{name} ਵਿੱਚ ਇਸ ਹਫ਼ਤੇ ਨਵਾਂ। ਜ਼ਰੂਰ ਦੇਖੋ।",
      "{name} — ਸਹੀ ਗੁਣਵੱਤਾ, ਸਹੀ ਕੀਮਤ।",
      "{city} ਦੀ ਪਸੰਦ ਹੁਣ {name} ਤੇ।",
    ],
    whatsapp: [
      "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! {name} ਨਾਲ ਸੰਪਰਕ ਕਰਨ ਲਈ ਧੰਨਵਾਦ। ਦੱਸੋ ਤੁਹਾਨੂੰ ਕੀ ਚਾਹੀਦਾ ਹੈ, ਅਸੀਂ ਜਲਦੀ ਜਵਾਬ ਦੇਵਾਂਗੇ।",
      "{name} ਵਿੱਚ ਤੁਹਾਡਾ ਸਵਾਗਤ ਹੈ। ਆਰਡਰ ਭੇਜੋ ਜਾਂ ਅੱਜ ਦਾ ਰੇਟ ਪੁੱਛੋ।",
    ],
    tone: ["ਸਿੱਧਾ", "ਨਿੱਘਾ", "ਭਰੋਸੇਯੋਗ"],
  },
};

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "").replace(/\s{2,}/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Taglines
// ---------------------------------------------------------------------------

/**
 * Taglines come from three sources, blended: category scaffolds from the
 * industry table, personality-derived constructions, and a name-led line.
 * Duplicates and lines longer than a signboard can carry are dropped.
 */
export function generateTaglines(
  brief: BrandBrief,
  industry: IndustryProfile,
  profile: TraitProfile,
  rng: Rng,
  count = 6,
): string[] {
  const vars = {
    name: brief.businessName,
    city: brief.city || "town",
    year: String(new Date().getFullYear() - rng.int(1, 25)),
  };

  const out = new Set<string>();

  for (const seed of rng.sample(industry.taglineSeeds, 3)) {
    out.add(interpolate(seed, vars));
  }

  const [w1, w2] = rng.sample(profile.voiceWords, 2);
  if (w1 && w2) {
    out.add(titleish(`${cap(w1)}. ${cap(w2)}. Always.`));
    out.add(titleish(`${cap(w1)} by default.`));
  }

  const root = rng.pick(industry.nameRoots);
  out.add(`${brief.businessName}. Your ${root.toLowerCase()}, done right.`);

  if (brief.city) out.add(`${brief.city}'s own ${industry.name.split("/")[0]!.trim().toLowerCase()}.`);

  // Language-flavoured line for non-English brands.
  if (brief.language !== "en") {
    const pack = VOICE_PACKS[brief.language];
    const line = rng.pick(pack.captions);
    out.add(interpolate(line, vars));
  }

  return [...out]
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 58)
    .slice(0, count);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const titleish = (s: string) => s.replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// Full strategy
// ---------------------------------------------------------------------------

export interface StrategyOptions {
  brief: BrandBrief;
  industry: IndustryProfile;
  profile: TraitProfile;
  rng: Rng;
  paletteNarrative: string;
  typographyNarrative: string;
  markNarrative: string;
  directionLabel: string;
}

export function generateStrategy({
  brief,
  industry,
  profile,
  rng,
  paletteNarrative,
  typographyNarrative,
  markNarrative,
  directionLabel,
}: StrategyOptions): BrandStrategy {
  const lang = languageDef(brief.language);
  const pack = VOICE_PACKS[brief.language];
  const traitLabels = profile.traits.map((t) => t.label.toLowerCase());
  const vars = {
    name: brief.businessName,
    city: brief.city || "your city",
    descriptor: brief.descriptor || industry.name,
  };

  const toneWords = rng.sample([...new Set([...profile.voiceWords, ...pack.tone])], 4);

  return {
    personalitySummary:
      `${brief.businessName} is ${joinWords(traitLabels)}. ` +
      `Every choice below follows from that: the palette, the type and the mark all push in the same direction, ` +
      `so the brand still reads as itself whether someone meets it on a signboard, a bill or a phone screen.`,

    positioning:
      `A ${industry.name.toLowerCase()} for ${brief.audience.toLowerCase()}` +
      (brief.city ? ` in and around ${brief.city}` : "") +
      `. The brand's job is to make ${joinWords(traitLabels.slice(0, 2))} legible in three seconds — the time you get on a passing look.`,

    audience: brief.audience,
    colorPsychology: paletteNarrative,
    visualStyle:
      `${directionLabel}. ${markNarrative} ` +
      `Layouts stay on a single grid unit across every asset, so a visiting card and a hoarding are recognisably the same system at different sizes.`,

    voice: {
      tone: toneWords,
      dos: [
        `Write the way you speak to a regular customer — ${lang.name} first, not translated English.`,
        `Lead with the specific thing: the price, the item, the time. Vagueness reads as hiding something.`,
        `Keep sentences short enough to fit one line on a phone.`,
        ...(brief.language === "hinglish"
          ? [`Let Hindi and English mix naturally. Don't force either one.`]
          : []),
      ],
      donts: [
        `Avoid ${joinWords(rng.sample(profile.avoidWords, 3))} — they pull against the personality you picked.`,
        `Don't stack three adjectives where one specific noun does the work.`,
        `Never set the tagline in a different font to the one in this kit.`,
      ],
      sampleCaption: interpolate(rng.pick(pack.captions), vars),
      sampleWhatsApp: interpolate(rng.pick(pack.whatsapp), vars),
    },

    taglines: generateTaglines(brief, industry, profile, rng),

    socialStyle:
      `${industry.voiceHint}. Posts sit on the surface colour with the mark small in a corner — the product is the hero, ` +
      `the brand is the frame. Reserve the accent for one element per post. ` +
      `On a grid, alternate full-bleed product shots with flat colour panels carrying a single line of type so the profile has rhythm.`,

    packagingStyle:
      `${industry.packagingHint}. Print the mark in one colour wherever the substrate is rough — kraft, corrugate, cloth — ` +
      `and keep the full-colour lockup for coated surfaces. The monochrome variation in this kit exists exactly for this.`,

    logoDirection: markNarrative,
    fontRationale: typographyNarrative,
  };
}

function joinWords(words: string[]): string {
  const list = words.filter(Boolean);
  if (list.length === 0) return "distinctive";
  if (list.length === 1) return list[0]!;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/** Exposed for the AI layer, which uses these as few-shot anchors. */
export function voicePackFor(language: LanguageCode): VoicePack {
  return VOICE_PACKS[language] ?? VOICE_PACKS.en;
}
