import type { InvitationView } from "@/application/use-cases/get-invitation-view";

/**
 * Beneficiary portal label dictionaries (Slice 3.8, spec §6, §12C).
 * Static EN/TA/HI display strings only. Canonical amounts, IDs, and
 * coordinator-entered content are never translated.
 */
export type PortalLang = "en" | "ta" | "hi";

export const PORTAL_LANGS: PortalLang[] = ["en", "ta", "hi"];

export function isPortalLang(value: string | null | undefined): value is PortalLang {
  return value === "en" || value === "ta" || value === "hi";
}

export function resolvePortalLang(preferred: PortalLang, param: string | null | undefined): PortalLang {
  return isPortalLang(param) ? param : preferred;
}

export interface BeneficiaryStrings {
  greeting: string;
  yourSupportPlan: string;
  totalSupportAmount: string;
  proposedPlan: string;
  noCategoriesYet: string;
  flexible: string;
  fromYourCoordinator: string;
  yourChoice: string;
  consentStatement: string;
  privacyStatement: string;
  acceptPlan: string;
  suggestChanges: string;
  declineToShare: string;
  timeline: string;
  noEventsYet: string;
  programmeSupportPlan: string;
}

const EN: BeneficiaryStrings = {
  greeting: "Hello",
  yourSupportPlan: "your support plan",
  totalSupportAmount: "Total support amount",
  proposedPlan: "Proposed plan",
  noCategoriesYet:
    "Your coordinator has not added any categories yet. Your full support amount remains flexible.",
  flexible: "Flexible",
  fromYourCoordinator: "From your coordinator",
  yourChoice: "Your choice",
  consentStatement:
    "This is a voluntary support plan. It does not restrict how you use money you receive.",
  privacyStatement:
    "You can choose to share an allocation plan or not — your support payment is not conditional on sharing. FamilyLedger never asks for receipts and does not track how you spend. If something in this plan does not work for you, tell your coordinator.",
  acceptPlan: "Accept this plan",
  suggestChanges: "Suggest changes",
  declineToShare: "I prefer not to share a plan",
  timeline: "Timeline",
  noEventsYet: "No events yet.",
  programmeSupportPlan: "has put together a support plan for you, below.",
};

const TA: BeneficiaryStrings = {
  greeting: "வணக்கம்",
  yourSupportPlan: "உங்கள் ஆதரவு திட்டம்",
  totalSupportAmount: "மொத்த ஆதரவுத் தொகை",
  proposedPlan: "முன்மொழியப்பட்ட திட்டம்",
  noCategoriesYet:
    "உங்கள் ஒருங்கிணைப்பாளர் இன்னும் எந்தப் பிரிவுகளையும் சேர்க்கவில்லை. உங்கள் முழு ஆதரவுத் தொகையும் நெகிழ்வாகவே இருக்கும்.",
  flexible: "நெகிழ்வானது",
  fromYourCoordinator: "உங்கள் ஒருங்கிணைப்பாளரிடமிருந்து",
  yourChoice: "உங்கள் தேர்வு",
  consentStatement:
    "இது ஒரு தன்னார்வ ஆதரவு திட்டம். நீங்கள் பெறும் பணத்தை எப்படிப் பயன்படுத்துகிறீர்கள் என்பதை இது கட்டுப்படுத்தாது.",
  privacyStatement:
    "நீங்கள் ஒதுக்கீட்டுத் திட்டத்தைப் பகிரலாம் அல்லது பகிராமல் இருக்கலாம் — உங்கள் ஆதரவுத் தொகை அதைப் பொறுத்து அமையாது. FamilyLedger ரசீதுகள் கேட்காது, நீங்கள் செலவழிப்பதைக் கண்காணிக்காது. இந்த திட்டத்தில் ஏதேனும் பிடிக்கவில்லை என்றால், உங்கள் ஒருங்கிணைப்பாளரிடம் அதைப் பற்றிச் சொல்லுங்கள்.",
  acceptPlan: "இந்தத் திட்டத்தை ஏற்கவும்",
  suggestChanges: "மாற்றங்களைப் பரிந்துரைக்கவும்",
  declineToShare: "நான் திட்டத்தைப் பகிர விரும்பவில்லை",
  timeline: "காலவரிசை",
  noEventsYet: "இன்னும் நிகழ்வுகள் இல்லை.",
  programmeSupportPlan: "உங்களுக்காக ஒரு ஆதரவுத் திட்டத்தைத் தயாரித்துள்ளது.",
};

const HI: BeneficiaryStrings = {
  greeting: "नमस्ते",
  yourSupportPlan: "आपकी सहायता योजना",
  totalSupportAmount: "कुल सहायता राशि",
  proposedPlan: "प्रस्तावित योजना",
  noCategoriesYet:
    "आपके समन्वयक ने अभी कोई श्रेणियाँ नहीं जोड़ी हैं। आपकी पूरी सहायता राशि लचीली रहेगी।",
  flexible: "लचीला",
  fromYourCoordinator: "आपके समन्वयक से",
  yourChoice: "आपका विकल्प",
  consentStatement:
    "यह एक स्वैच्छिक सहायता योजना है। यह आपके द्वारा प्राप्त धन के उपयोग को प्रतिबंधित नहीं करती।",
  privacyStatement:
    "आप एक आवंटन योजना साझा करना चुन सकते हैं या नहीं — आपका सहायता भुगतान इस पर निर्भर नहीं है। FamilyLedger रसीदें नहीं मांगता और न ही आपके खर्च पर नज़र रखता है। यदि इस योजना में कुछ ठीक न लगे, तो अपने समन्वयक को बताएं।",
  acceptPlan: "इस योजना को स्वीकार करें",
  suggestChanges: "परिवर्तन सुझाएँ",
  declineToShare: "मैं योजना साझा नहीं करना चाहता",
  timeline: "समयरेखा",
  noEventsYet: "अभी कोई घटना नहीं।",
  programmeSupportPlan: "ने आपके लिए एक सहायता योजना तैयार की है।",
};

export const BENEFICIARY_STRINGS: Record<PortalLang, BeneficiaryStrings> = { en: EN, ta: TA, hi: HI };

export interface LocalizedView {
  strings: BeneficiaryStrings;
  view: InvitationView;
}

/**
 * Pairs a view with its dictionary. The view payload (amounts, items,
 * programme, note) passes through untouched — only labels change.
 */
export function localizeView(view: InvitationView, lang: PortalLang): LocalizedView {
  return { strings: BENEFICIARY_STRINGS[lang], view };
}
