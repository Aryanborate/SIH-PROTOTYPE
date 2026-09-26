// Phase 3/4 i18n module dict — cooperative upgrades (reserve pool stats, matching weights admin, fair pricing)
// Owned by coop/platform components. Shape: [en, mr, hi]
// Prefixes: rp* = reserve pool (Task 17) · mw* = matching weights (Task 9) · fp* = fair pricing (Task 10)
export const COOP_DICT: Record<string, [string, string, string]> = {
  // ---------- Emergency Reserve Pool — per-skill reserve capacity ----------
  rpTitle: ['Reserve capacity by skill', 'कौशल्यानुसार राखीव क्षमता', 'कौशल के अनुसार आरक्षित क्षमता'],
  rpDesc: [
    'Emergency-pool members grouped by trade — who can be dispatched right now.',
    'आपत्कालीन पूलमधील सदस्य व्यवसायानुसार — आत्ता कोण पाठवता येईल.',
    'आपातकालीन पूल के सदस्य ट्रेड के अनुसार — अभी किसे रवाना किया जा सकता है.',
  ],
  rpKpiReserve: ['Total reserve', 'एकूण राखीव', 'कुल आरक्षित'],
  rpKpiAvailable: ['Reserve available', 'राखीव उपलब्ध', 'आरक्षित उपलब्ध'],
  rpKpiDispatched: ['Reserve dispatched', 'राखीव पाठवले', 'आरक्षित रवाना'],
  rpAvailable: ['Available', 'उपलब्ध', 'उपलब्ध'],
  rpDispatched: ['Dispatched', 'पाठवले', 'रवाना'],
  rpIdle: ['Idle', 'निष्क्रिय', 'निष्क्रिय'],
  rpReserveWord: ['Reserve', 'राखीव', 'आरक्षित'],
  rpNoPoolTitle: ['No emergency-pool members yet', 'अजून आपत्कालीन पूल सदस्य नाहीत', 'अभी आपातकालीन पूल सदस्य नहीं'],
  rpNoPoolBody: [
    'Members added to the emergency pool will appear here, grouped by trade.',
    'आपत्कालीन पूलमध्ये जोडलेले सदस्य येथे व्यवसायानुसार दिसतील.',
    'आपातकालीन पूल में जोड़े गए सदस्य यहाँ ट्रेड के अनुसार दिखेंगे.',
  ],
  rpBarAria: [
    '{a} available, {d} dispatched of {t} reserve',
    '{t} पैकी {a} उपलब्ध, {d} पाठवले',
    '{t} में से {a} उपलब्ध, {d} रवाना',
  ],

  // ---------- AI matching weights — platform admin ----------
  mwTitle: ['AI matching weights', 'AI जुळणी वजन', 'AI मैचिंग वज़न'],
  mwDesc: [
    'Tune how the matching engine scores workers. Changes apply to every new match request.',
    'जुळणी इंजिन कामगारांना कसे गुण देते ते बदला. बदल प्रत्येक नवीन विनंतीला लागू होतात.',
    'मैचिंग इंजन कार्यकर्ताओं को कैसे स्कोर करता है, उसे बदलें. बदल हर नए मैच अनुरोध पर लागू होते हैं.',
  ],
  mwBadge: ['AI-assisted workforce matching — prototype', 'AI-सहाय्यित कामगार जुळणी — प्रोटोटाइप', 'AI-सहाय्यित कार्यबल मैचिंग — प्रोटोटाइप'],
  mwTotal: ['Total', 'एकूण', 'कुल'],
  mwPts: ['pts', 'गुण', 'अंक'],
  mwTotalWarn: [
    'Weights no longer sum to 100 — the engine normalises them proportionally.',
    'वजनांची बेरीज 100 नाही — इंजिन त्यांना प्रमाणानुसार नियमित करेल.',
    'वज़नों का योग 100 नहीं है — इंजन उन्हें आनुपातिक रूप से सामान्य करेगा.',
  ],
  mwSave: ['Save weights', 'वजन जतन करा', 'वज़न सहेजें'],
  mwReset: ['Reset to defaults', 'डीफॉल्टवर परत आणा', 'डिफ़ॉल्ट पर रीसेट करें'],
  mwSavedToast: ['Matching weights updated', 'जुळणी वजन अद्ययावत झाले', 'मैचिंग वज़न अपडेट हुए'],
  mwSavedToastSub: [
    'New matches now use the updated factor weights.',
    'नवीन जुळण्या आता अद्ययावत वजन वापरतात.',
    'नए मैच अब अपडेट किए गए वज़न का उपयोग करते हैं.',
  ],
  mwSaveFailToast: ['Could not save weights', 'वजन जतन करता आले नाही', 'वज़न सहेजे नहीं जा सके'],
  mwSaveFailSub: [
    'Check the platform API and try again.',
    'प्लॅटफॉर्म API तपासा आणि पुन्हा प्रयत्न करा.',
    'प्लेटफ़ॉर्म API जांचें और फिर से प्रयास करें.',
  ],
  mwResetToast: ['Draft reset to engine defaults', 'ड्राफ्ट इंजिन डीफॉल्टवर परत आणला', 'ड्राफ्ट इंजन डिफ़ॉल्ट पर रीसेट हुआ'],
  mwResetToastSub: [
    'Press “Save weights” to apply them to the live engine.',
    'लाइव्ह इंजिनला लागू करण्यासाठी “वजन जतन करा” दाबा.',
    'लाइव इंजन पर लागू करने के लिए “वज़न सहेजें” दबाएँ.',
  ],
  mwUpdatedBy: ['Last updated by', 'शेवटचे अद्ययावत', 'अंतिम अपडेट'],
  mwNeverEdited: ['Not yet customised — engine defaults in use', 'अजून बदलले नाही — इंजिन डीफॉल्ट वापरले जात आहेत', 'अभी अनुकूलित नहीं — इंजन डिफ़ॉल्ट उपयोग में'],
  mwConfiguredBy: [
    'Weights are configured by the platform/federation admin.',
    'वजन प्लॅटफॉर्म/महासंघ प्रशासकाकडून सेट केले जातात.',
    'वज़न प्लेटफ़ॉर्म/महासंघ प्रशासक द्वारा कॉन्फ़िगर किए जाते हैं.',
  ],
  // Factor labels + descriptions (fallback to API meta label/desc when a key is missing)
  mwFskillMatch: ['Skill match', 'कौशल्य जुळणी', 'कौशल मैच'],
  mwFcertification: ['Certification', 'प्रमाणपत्र', 'प्रमाणन'],
  mwFdistance: ['Distance', 'अंतर', 'दूरी'],
  mwFavailability: ['Availability', 'उपलब्धता', 'उपलब्धता'],
  mwFworkload: ['Workload balance', 'कामाचा ताळमेळ', 'कार्यभार संतुलन'],
  mwFserviceHistory: ['Service history', 'सेवा इतिहास', 'सेवा इतिहास'],
  mwDskillMatch: [
    'Primary skill exact match vs secondary skill overlap',
    'प्राथमिक कौशल्य जुळणी आणि द्वितीय कौशल्य सुसंगती',
    'प्राथमिक कौशल सटीक मैच बनाम द्वितीय कौशल ओवरलैप',
  ],
  mwDcertification: [
    'NSQF / trade certificate verified by the cooperative',
    'सहकारी संस्थेकडून सत्यापित NSQF / व्यवसाय प्रमाणपत्र',
    'सहकारी समिति द्वारा सत्यापित NSQF / ट्रेड प्रमाणपत्र',
  ],
  mwDdistance: [
    'Travel distance from worker base area to the request',
    'कामगाराच्या ठिकाणापासून विनंतीपर्यंतचे अंतर',
    'कार्यकर्ता के क्षेत्र से अनुरोध तक की दूरी',
  ],
  mwDavailability: [
    'Live roster status (available / busy / offline)',
    'थेट उपलब्धता स्थिती (उपलब्ध / व्यस्त / ऑफलाइन)',
    'लाइव उपलब्धता (उपलब्ध / व्यस्त / ऑफलाइन)',
  ],
  mwDworkload: [
    'Active jobs today — spreads work fairly across members',
    'आजची सुरू असलेली कामे — सदस्यांमध्ये काम न्याय्यपणे वाटते',
    'आज के सक्रिय काम — सदस्यों में कार्य का न्यायसंगत वितरण',
  ],
  mwDserviceHistory: [
    'Rating, completion rate and repeat-customer familiarity',
    'रेटिंग, पूर्णता दर आणि नियमित ग्राहक परिचय',
    'रेटिंग, पूर्णता दर और पुराने ग्राहक की जानकारी',
  ],

  // ---------- Fair Pricing Engine detail — calculator + live weights ----------
  fpTitle: ['Fair price range calculator', 'वाजवी किंमत श्रेणी कॅल्क्युलेटर', 'उचित मूल्य श्रेणी कैलकुलेटर'],
  fpDesc: [
    'Simulate the cooperative rate card for any job before it is booked.',
    'काम बुक होण्यापूर्वी सहकारी दरपत्रकाची आधीची गणना पहा.',
    'काम बुक होने से पहले सहकारी दर-पत्रक की गणना देखें.',
  ],
  fpSkill: ['Skill', 'कौशल्य', 'कौशल'],
  fpUrgency: ['Urgency', 'तातडी', 'तत्कालता'],
  fpMinutes: ['Estimated minutes', 'अंदाजित मिनिटे', 'अनुमानित मिनट'],
  fpMinutesHint: [
    'Longer jobs scale the labour base (up to ×2.5).',
    'जास्त वेळेची कामे मजुरीचा पाया वाढवतात (×2.5 पर्यंत).',
    'लंबे काम श्रम आधार को बढ़ाते हैं (×2.5 तक).',
  ],
  fpEvening: ['Evening visit (after 6 PM · +10%)', 'संध्याकाळची भेट (सायं. ६ नंतर · +10%)', 'शाम की विज़िट (6 PM के बाद · +10%)'],
  fpUrNormal: ['Normal (×1.0)', 'सामान्य (×1.0)', 'सामान्य (×1.0)'],
  fpUrUrgent: ['Urgent (×1.2)', 'तातडीचे (×1.2)', 'तत्काल (×1.2)'],
  fpUrEmergency: ['Emergency (×1.5)', 'आपत्कालीन (×1.5)', 'आपातकाल (×1.5)'],
  fpLabourBase: ['Labour base', 'मजुरीचा पाया', 'श्रम आधार'],
  fpRange: ['Fair price range', 'वाजवी किंमत श्रेणी', 'उचित मूल्य श्रेणी'],
  fpRangeNote: [
    'Fair Price Range — not a guaranteed price; the final agreed price stays within the cooperative floor.',
    'वाजवी किंमत श्रेणी — हमीभाव नाही; अंतिम मान्य किंमत सहकारी किमान मर्यादेत राहते.',
    'उचित मूल्य श्रेणी — गारंटीशुदा कीमत नहीं; अंतिम सहमत कीमत सहकारी न्यूनतम सीमा में रहती है.',
  ],
  fpWelfareLine: [
    '2% of every payment flows to the worker welfare wallet.',
    'प्रत्येक देयकेच्या 2% कामगार कल्याण वॉलेटमध्ये जातात.',
    'हर भुगतान का 2% श्रमिक कल्याण वॉलेट में जाता है.',
  ],
  fpPolicyLine: [
    'Federation rate card 2025-26 · negotiation floor protects worker income',
    'महासंघ दरपत्रक 2025-26 · किमान मर्यादा कामगारांच्या उत्पन्नाचे रक्षण करते',
    'महासंघ दर-पत्रक 2025-26 · न्यूनतम सीमा श्रमिक आय की रक्षा करती है',
  ],
  fpReadonlyTitle: ['Active matching weights', 'सध्या लागू जुळणी वजन', 'वर्तमान मैचिंग वज़न'],
  fpReadonlyDesc: [
    'Live factor weights the matching engine applies to every new request.',
    'जुळणी इंजिन प्रत्येक नवीन विनंतीला लागू करणारे वजन.',
    'मैचिंग इंजन हर नए अनुरोध पर लागू करता है वे वज़न.',
  ],
}
