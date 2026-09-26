/**
 * GigSetu seed — realistic synthetic Maharashtra cooperative ecosystem.
 * Run: bun prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// deterministic PRNG for stable synthetic data
let _s = 42
const rnd = () => (_s = (_s * 1103515245 + 12345) % 2147483648) / 2147483648
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const pick = <T,>(arr: T[]): T => arr[ri(0, arr.length - 1)]
const j = (v: unknown) => JSON.stringify(v)

// ---------------- taxonomy ----------------
const CATEGORIES = [
  { key: 'electrician', nameEn: 'Electrician', nameMr: 'विजेवाला', nameHi: 'बिजली मिस्त्री', icon: 'Zap', baseRate: 250, avgDurationMin: 60, descEn: 'Wiring, switchboards, fans, MCB, lighting', descMr: 'वायरिंग, स्विचबोर्ड, पंखे, एमसीबी, लाइटिंग', descHi: 'वायरिंग, स्विचबोर्ड, पंखे, एमसीबी, लाइटिंग' },
  { key: 'plumber', nameEn: 'Plumber', nameMr: 'प्लंबर', nameHi: 'प्लंबर', icon: 'Droplets', baseRate: 250, avgDurationMin: 60, descEn: 'Leaks, taps, drains, fittings, tanks', descMr: 'गळती, नळ, गटार, फिटिंग्ज, टाकी', descHi: 'रिसाव, नल, नाली, फिटिंग, टंकी' },
  { key: 'carpenter', nameEn: 'Carpenter', nameMr: 'सुतार', nameHi: 'बढ़ई', icon: 'Hammer', baseRate: 300, avgDurationMin: 90, descEn: 'Furniture, doors, repairs, fittings', descMr: 'फर्निचर, दारं, दुरुस्ती, फिटिंग्ज', descHi: 'फर्नीचर, दरवाजे, मरम्मत, फिटिंग' },
  { key: 'painter', nameEn: 'Painter', nameMr: 'रंगारी', nameHi: 'पेंटर', icon: 'Paintbrush', baseRate: 400, avgDurationMin: 240, descEn: 'Interior/exterior painting, polishing', descMr: 'आतील/बाहेरील रंगकाम, पॉलिश', descHi: 'अंदरूनी/बाहरी पेंटिंग, पॉलिश' },
  { key: 'cleaning', nameEn: 'Cleaning', nameMr: 'स्वच्छता', nameHi: 'सफाई', icon: 'Sparkles', baseRate: 500, avgDurationMin: 120, descEn: 'Deep cleaning, society, offices', descMr: 'सखोल सफाई, सोसायटी, कार्यालये', descHi: 'गहरी सफाई, सोसायटी, कार्यालय' },
  { key: 'driver', nameEn: 'Driver', nameMr: 'चालक', nameHi: 'ड्राइवर', icon: 'Car', baseRate: 900, avgDurationMin: 480, descEn: 'Local/outstation, school, event driving', descMr: 'स्थानिक/बाहेरचा प्रवास, शाळा, कार्यक्रम', descHi: 'लोकल/आउटस्टेशन, स्कूल, इवेंट ड्राइविंग' },
  { key: 'caregiver', nameEn: 'Caregiver', nameMr: 'पालक', nameHi: 'देखभालकर्ता', icon: 'HeartHandshake', baseRate: 800, avgDurationMin: 480, descEn: 'Elderly care, patient care, childcare', descMr: 'वृद्ध, रुग्ण, बालकांची काळजी', descHi: 'बुज़ुर्ग, मरीज़, बच्चों की देखभाल' },
  { key: 'gardener', nameEn: 'Gardener', nameMr: 'माळी', nameHi: 'माली', icon: 'Leaf', baseRate: 300, avgDurationMin: 120, descEn: 'Garden upkeep, trimming, plants', descMr: 'बगीच्याची देखभाल, छाटणी, झाडे', descHi: 'बगीचे रखरखाव, छँटाई, पौधे' },
  { key: 'technician', nameEn: 'Technician', nameMr: 'तंत्रज्ञ', nameHi: 'तकनीशियन', icon: 'Wrench', baseRate: 350, avgDurationMin: 90, descEn: 'General maintenance & installation', descMr: 'सामान्य देखभाल व स्थापना', descHi: 'सामान्य रखरखाव और इंस्टॉलेशन' },
  { key: 'appliance', nameEn: 'Appliance Repair', nameMr: 'उपकरण दुरुस्ती', nameHi: 'उपकरण मरम्मत', icon: 'Refrigerator', baseRate: 400, avgDurationMin: 75, descEn: 'Fridge, AC, washing machine, geyser', descMr: 'फ्रिज, एसी, वॉशिंग मशीन, गीझर', descHi: 'फ्रिज, एसी, वॉशिंग मशीन, गीज़र' },
  { key: 'other', nameEn: 'Other Services', nameMr: 'इतर सेवा', nameHi: 'अन्य सेवाएं', icon: 'MoreHorizontal', baseRate: 300, avgDurationMin: 90, descEn: 'Verified workers for varied needs', descMr: 'विविध गरजांसाठी सत्यापित कामगार', descHi: 'विभिन्न ज़रूरतों के लिए सत्यापित कारीगर' },
]

const HIERARCHY = [
  { level: 0, code: 'GOV', nameEn: 'Government / Regulatory Ecosystem', nameMr: 'शासकीय / नियामक परिसंस्था', nameHi: 'सरकारी / नियामक इकोसिस्टम', descriptionEn: 'External institutional ecosystem — registrars, cooperative departments, national databases. Integrated only via authorized data-sharing.', orderIndex: 0 },
  { level: 1, code: 'APEX', nameEn: 'National / Apex Cooperative Network', nameMr: 'राष्ट्रीय / सर्वोच्च सहकारी नेटवर्क', nameHi: 'राष्ट्रीय / शीर्ष सहकारी नेटवर्क', descriptionEn: 'Apex national network coordinating state federations.', orderIndex: 1 },
  { level: 2, code: 'STATE', nameEn: 'State Federation', nameMr: 'राज्य महासंघ', nameHi: 'राज्य महासंघ', descriptionEn: 'State-level labour cooperative federation.', orderIndex: 2 },
  { level: 3, code: 'DISTRICT', nameEn: 'District Cooperative Network', nameMr: 'जिल्हा सहकारी नेटवर्क', nameHi: 'जिला सहकारी नेटवर्क', descriptionEn: 'District-level cooperative network.', orderIndex: 3 },
  { level: 4, code: 'TALUKA', nameEn: 'Taluka / Block Network', nameMr: 'तालुका / खंड नेटवर्क', nameHi: 'तहसील / ब्लॉक नेटवर्क', descriptionEn: 'Taluka/Block level local administrative network.', orderIndex: 4 },
  { level: 5, code: 'PRIMARY', nameEn: 'Primary Labour Cooperative Society', nameMr: 'प्राथमिक श्रम सहकारी संस्था', nameHi: 'प्राथमिक श्रम सहकारी समिति', descriptionEn: 'Primary society of individual workers.', orderIndex: 5 },
  { level: 6, code: 'WORKER', nameEn: 'Individual Worker', nameMr: 'वैयक्तिक कामगार', nameHi: 'व्यक्तिगत श्रमिक', descriptionEn: 'Verified skilled service worker.', orderIndex: 6 },
]

const INTEGRATIONS = [
  { name: 'National Cooperative Database', domain: 'Cooperative registry', purpose: 'Verify society registration & identity', status: 'FUTURE', dataFlow: 'Read-only registry lookup via authorized API' },
  { name: 'e-Shram', domain: 'Unorganised worker registry', purpose: 'Worker identity cross-verification', status: 'FUTURE', dataFlow: 'Consent-based UAN verification' },
  { name: 'Skill / Certification Ecosystem', domain: 'Skilling (NSQF aligned)', purpose: 'Validate worker certifications (RPL / QP)', status: 'FUTURE', dataFlow: 'Certificate verification service' },
  { name: 'Social Security & Welfare', domain: 'Welfare boards / insurance', purpose: 'Welfare coverage status & enrolment', status: 'FUTURE', dataFlow: 'Scheme eligibility & enrolment APIs' },
  { name: 'Worker Support Schemes', domain: 'Government schemes', purpose: 'Surface eligible schemes to workers', status: 'FUTURE', dataFlow: 'Scheme rules + consented worker data' },
  { name: 'Open Digital Commerce Network', domain: 'Open networks', purpose: 'Service discovery across open networks', status: 'DESIGNED', dataFlow: 'Buyer/seller side adapter (blueprint ready)' },
]

// ---------------- geography ----------------
const AREAS: Record<string, { x: number; y: number }> = {
  'Kothrud': { x: 4, y: 8 }, 'Karve Nagar': { x: 5, y: 9.5 }, 'Warje': { x: 5.5, y: 11 },
  'Sinhagad Road': { x: 6.5, y: 12 }, 'Shivajinagar': { x: 7, y: 5 }, 'Aundh': { x: 7, y: 2.5 },
  'Baner': { x: 7.5, y: 1.5 }, 'Bavdhan': { x: 6.5, y: 2.5 }, 'Erandwane': { x: 6, y: 7 },
  'Deccan': { x: 7, y: 6.5 }, 'Swargate': { x: 8, y: 8.5 }, 'Parvati': { x: 8, y: 9.5 },
  'Sahakarnagar': { x: 8.5, y: 10.5 }, 'Katraj': { x: 9, y: 12.5 }, 'Kondhwa': { x: 10, y: 10.5 },
  'Wanowrie': { x: 9.8, y: 9.8 }, 'Hadapsar': { x: 12, y: 9.5 }, 'Viman Nagar': { x: 13, y: 6 },
  'Chandan Nagar': { x: 13.5, y: 7.5 }, 'Yerawada': { x: 12, y: 5 }, 'Dhanori': { x: 13, y: 4 },
  'Vishrantwadi': { x: 12.5, y: 4 }, 'Pimple Saudagar': { x: 10, y: 2 }, 'Pimpri': { x: 9.5, y: 1 },
  'Chinchwad': { x: 10, y: 0.5 }, 'Nigdi': { x: 9, y: 0.8 }, 'Akurdi': { x: 9, y: 1.5 },
  'Wakad': { x: 9.5, y: 2 }, 'Hinjewadi': { x: 9, y: 3 }, 'Balewadi': { x: 8.2, y: 2.2 },
  'Pashan': { x: 8, y: 3 }, 'Sus': { x: 8.5, y: 4 }, 'Bibwewadi': { x: 9.5, y: 9.5 },
  'Balaji Nagar': { x: 9.5, y: 10.8 }, 'Dhankawadi': { x: 9, y: 11.5 }, 'Gultekdi': { x: 9.2, y: 9 },
  'Market Yard': { x: 9.5, y: 10 }, 'Kharadi': { x: 14, y: 8.5 }, 'Wagholi': { x: 15.5, y: 7 },
}
const AREA_LIST = Object.keys(AREAS)
export function areaDistance(a: string, b: string): number {
  const pa = AREAS[a] ?? { x: 8, y: 7 }
  const pb = AREAS[b] ?? { x: 8, y: 7 }
  return Math.round(Math.hypot(pa.x - pb.x, pa.y - pb.y) * 1.6 * 10) / 10
}

const FIRST = ['Rajesh', 'Sunil', 'Mahesh', 'Vikram', 'Santosh', 'Prakash', 'Amit', 'Ganesh', 'Nitin', 'Ravi', 'Deepak', 'Ajay', 'Suresh', 'Manoj', 'Kiran', 'Rahul', 'Sameer', 'Ashok', 'Vinod', 'Ramesh', 'Sanjay', 'Umesh', 'Mangesh', 'Rohit', 'Sagar', 'Nilesh', 'Tushar', 'Dattatray', 'Bhima', 'Laxman']
const LAST = ['Kumar', 'Pawar', 'Jadhav', 'Shinde', 'Kamble', 'Salunkhe', 'Gaikwad', 'Thorat', 'Bhosale', 'Kadam', 'Sawant', 'Patil', 'Deshmukh', 'Chavan', 'More', 'Nikam', 'Wagh', 'Koli', 'Mane', 'Shaikh']
const LANGS = ['Marathi', 'Hindi', 'English', 'Kannada', 'Telugu']

const SKILL_BANK: Record<string, string[]> = {
  electrician: ['Domestic wiring', 'Fan installation', 'MCB installation', 'Switchboard repair', 'Inverter setup', 'Lighting fixtures', 'Motor rewiring basics', 'Safety & earthing'],
  plumber: ['Leak detection', 'Tap & mixer fitting', 'Drain cleaning', 'Bathroom fittings', 'Tank plumbing', 'Pipe replacement', 'Water pump setup'],
  carpenter: ['Door & lock fitting', 'Furniture repair', 'Modular fittings', 'Window frames', 'Polishing', 'Cabinet installation'],
  painter: ['Interior emulsion', 'Exterior weather coat', 'Putty & primer', 'Texture finish', 'Wood polishing'],
  cleaning: ['Deep home cleaning', 'Sofa shampooing', 'Water tank cleaning', 'Office cleaning', 'Pest-prep cleaning'],
  driver: ['Local driving', 'Outstation driving', 'School routes', 'Event driving', 'Defensive driving'],
  caregiver: ['Elderly care', 'Patient mobility', 'Bedside assistance', 'Vitals monitoring basics', 'Companion care'],
  gardener: ['Lawn upkeep', 'Trimming & pruning', 'Plant care', 'Terrace garden setup'],
  technician: ['Furniture assembly', 'Curtain & rods', 'TV mounting', 'General repairs'],
  appliance: ['Refrigerator repair', 'AC service', 'Washing machine repair', 'Geyser repair', 'Microwave repair'],
  other: ['Shifting help', 'Event support', 'Loading assistance'],
}

// ---------------- org data ----------------
const DISTRICTS = [
  { name: 'Pune', coordinator: 'Meera Kulkarni', cooperatives: 37, workers: 4827, activeWorkers: 3784, jobsToday: 12438, utilizationPct: 78.4, map: { x: 34, y: 55 }, demand: { plumber: 'HIGH', electrician: 'MEDIUM', cleaning: 'LOW', carpenter: 'MEDIUM', appliance: 'HIGH', caregiver: 'MEDIUM' }, recs: ['Deploy 14 plumbers to Zone 4', 'Train 22 appliance repair workers', 'Maintain 8 emergency plumbers on standby', 'Procure 100 plumbing toolkits for federated societies'] },
  { name: 'Nashik', coordinator: 'Avinash Wagh', cooperatives: 24, workers: 2964, activeWorkers: 2210, jobsToday: 7102, utilizationPct: 71.2, map: { x: 30, y: 30 }, demand: { plumber: 'MEDIUM', electrician: 'HIGH', cleaning: 'MEDIUM', carpenter: 'LOW', appliance: 'MEDIUM', caregiver: 'LOW' }, recs: ['Certify 18 electricians for industrial panels', 'Deploy 6 cleaners to grape-export pack houses'] },
  { name: 'Nagpur', coordinator: 'Rajendra Bhoyar', cooperatives: 28, workers: 3510, activeWorkers: 2570, jobsToday: 8841, utilizationPct: 69.5, map: { x: 78, y: 42 }, demand: { plumber: 'LOW', electrician: 'MEDIUM', cleaning: 'HIGH', carpenter: 'MEDIUM', appliance: 'MEDIUM', caregiver: 'MEDIUM' }, recs: ['Open emergency cleaning pool for winter season', 'Upskill 12 caregivers in bedside assistance'] },
  { name: 'Thane', coordinator: 'Shalini Mhatre', cooperatives: 31, workers: 4120, activeWorkers: 3390, jobsToday: 10902, utilizationPct: 82.1, map: { x: 22, y: 18 }, demand: { plumber: 'HIGH', electrician: 'HIGH', cleaning: 'HIGH', carpenter: 'MEDIUM', appliance: 'HIGH', caregiver: 'HIGH' }, recs: [' urgent: 9 electrician slots unfilled in Zone 2', 'Coordinate society AMC renewal pipeline with 14 coops'] },
  { name: 'Kolhapur', coordinator: 'Vishwas Patil', cooperatives: 19, workers: 2244, activeWorkers: 1580, jobsToday: 5320, utilizationPct: 64.8, map: { x: 26, y: 82 }, demand: { plumber: 'MEDIUM', electrician: 'LOW', cleaning: 'LOW', carpenter: 'HIGH', appliance: 'LOW', caregiver: 'LOW' }, recs: ['Cross-transfer 5 carpenters from surplus societies', 'Schedule RPL batch for 30 un-certified workers'] },
  { name: 'Chh. Sambhajinagar', coordinator: 'Imran Qureshi', cooperatives: 17, workers: 2011, activeWorkers: 1420, jobsToday: 4715, utilizationPct: 61.9, map: { x: 50, y: 52 }, demand: { plumber: 'MEDIUM', electrician: 'MEDIUM', cleaning: 'MEDIUM', carpenter: 'LOW', appliance: 'MEDIUM', caregiver: 'LOW' }, recs: ['Launch appliance repair training with ITI partner'] },
  { name: 'Solapur', coordinator: 'Sangita Chowdhary', cooperatives: 15, workers: 1877, activeWorkers: 1290, jobsToday: 4102, utilizationPct: 63.4, map: { x: 55, y: 75 }, demand: { plumber: 'LOW', electrician: 'MEDIUM', cleaning: 'MEDIUM', carpenter: 'LOW', appliance: 'LOW', caregiver: 'MEDIUM' }, recs: ['Pareto: textile-mill cluster needs 10 technicians'] },
  { name: 'Amravati', coordinator: 'Prakash Deshmukh', cooperatives: 13, workers: 1544, activeWorkers: 1050, jobsToday: 3311, utilizationPct: 58.7, map: { x: 68, y: 26 }, demand: { plumber: 'LOW', electrician: 'LOW', cleaning: 'MEDIUM', carpenter: 'LOW', appliance: 'LOW', caregiver: 'LOW' }, recs: ['Consolidate 4 low-activity societies into hub model'] },
]

const TALUKAS: Record<string, Array<{ name: string; coordinator: string; cooperatives: number; workers: number; availableWorkers: number; emergencyCapacity: number; jobsToday: number; utilizationPct: number; demand: Record<string, string>; zones: Array<{ zone: string; demand: Record<string, string>; note?: string }>; skillGap: Array<{ skill: string; have: number; need: number }>; recommendation: string }>> = {
  Pune: [
    {
      name: 'Haveli', coordinator: 'Vikram Jadhav', cooperatives: 10, workers: 862, availableWorkers: 468, emergencyCapacity: 30, jobsToday: 1834, utilizationPct: 76.2,
      demand: { electrician: 'HIGH', plumber: 'HIGH', cleaning: 'MEDIUM', carpenter: 'LOW' },
      zones: [
        { zone: 'Zone 1 — West (Kothrud, Karve Nagar, Warje)', demand: { electrician: 'HIGH', plumber: 'MEDIUM', cleaning: 'MEDIUM', carpenter: 'LOW' } },
        { zone: 'Zone 2 — Central (Shivajinagar, Deccan, Swargate)', demand: { electrician: 'MEDIUM', plumber: 'HIGH', cleaning: 'HIGH', carpenter: 'MEDIUM' } },
        { zone: 'Zone 3 — East (Hadapsar, Viman Nagar, Kharadi)', demand: { electrician: 'HIGH', plumber: 'HIGH', cleaning: 'MEDIUM', carpenter: 'MEDIUM' }, note: 'IT-corridor growth; appliance & plumbing requests up 34% this week' },
        { zone: 'Zone 4 — North (Aundh, Baner, Pimple Saudagar)', demand: { electrician: 'MEDIUM', plumber: 'HIGH', cleaning: 'LOW', carpenter: 'LOW' } },
        { zone: 'Zone 5 — South (Katraj, Kondhwa, Sahakarnagar)', demand: { electrician: 'MEDIUM', plumber: 'MEDIUM', cleaning: 'MEDIUM', carpenter: 'HIGH' } },
      ],
      skillGap: [{ skill: 'plumber', have: 96, need: 158 }, { skill: 'appliance', have: 41, need: 78 }, { skill: 'caregiver', have: 55, need: 70 }, { skill: 'electrician', have: 187, need: 210 }],
      recommendation: 'Deploy 6 additional plumbers to Zone 3',
    },
    { name: 'Maval', coordinator: 'Gopal Tilekar', cooperatives: 3, workers: 288, availableWorkers: 170, emergencyCapacity: 9, jobsToday: 702, utilizationPct: 68.0, demand: { electrician: 'MEDIUM', plumber: 'MEDIUM', cleaning: 'LOW', carpenter: 'MEDIUM' }, zones: [{ zone: 'Zone 1 — Industrial Belt (Chakan belt edge)', demand: { electrician: 'HIGH', plumber: 'MEDIUM' } }, { zone: 'Zone 2 — Ghat Section (Lonavala side)', demand: { plumber: 'MEDIUM', carpenter: 'MEDIUM' } }], skillGap: [{ skill: 'electrician', have: 74, need: 92 }], recommendation: 'Shift 4 electricians from Zone 2 evenings to industrial belt mornings' },
    { name: 'Baramati', coordinator: 'Sunanda Awale', cooperatives: 2, workers: 224, availableWorkers: 151, emergencyCapacity: 7, jobsToday: 512, utilizationPct: 59.4, demand: { electrician: 'LOW', plumber: 'MEDIUM', cleaning: 'MEDIUM', carpenter: 'LOW' }, zones: [{ zone: 'Zone 1 — Town', demand: { plumber: 'MEDIUM', cleaning: 'MEDIUM' } }, { zone: 'Zone 2 — Rural', demand: { electrician: 'LOW', carpenter: 'MEDIUM' } }], skillGap: [{ skill: 'plumber', have: 33, need: 52 }], recommendation: 'Pool rural demand into weekly society visit circuits' },
    { name: 'Indapur', coordinator: 'Ravindra Kale', cooperatives: 2, workers: 176, availableWorkers: 121, emergencyCapacity: 5, jobsToday: 388, utilizationPct: 54.1, demand: { electrician: 'LOW', plumber: 'LOW', cleaning: 'MEDIUM', carpenter: 'LOW' }, zones: [{ zone: 'Zone 1 — Market belt', demand: { cleaning: 'MEDIUM', plumber: 'LOW' } }], skillGap: [{ skill: 'cleaning', have: 22, need: 35 }], recommendation: 'Train 12 cleaning workers for institutional contracts' },
  ],
}

function defaultTalukas(dName: string, base: number) {
  return [
    { name: `${dName} City`, coordinator: `${pick(FIRST)} ${pick(LAST)}`, cooperatives: ri(3, 6), workers: base, availableWorkers: Math.round(base * 0.58), emergencyCapacity: ri(6, 14), jobsToday: Math.round(base * 2.4), utilizationPct: 60 + ri(0, 20), demand: { electrician: pick(['LOW', 'MEDIUM', 'HIGH']), plumber: pick(['LOW', 'MEDIUM', 'HIGH']), cleaning: pick(['LOW', 'MEDIUM', 'HIGH']), carpenter: pick(['LOW', 'MEDIUM']) }, zones: [{ zone: 'Zone 1 — Urban Core', demand: { electrician: 'MEDIUM', plumber: 'MEDIUM', cleaning: 'MEDIUM' } }, { zone: 'Zone 2 — Outskirts', demand: { electrician: 'LOW', plumber: 'MEDIUM', carpenter: 'MEDIUM' } }], skillGap: [{ skill: pick(['plumber', 'appliance', 'caregiver']), have: base, need: Math.round(base * 1.3) }], recommendation: pick(['Balance morning/evening shift allocation across zones', 'Onboard 8 apprentice workers via RPL bridge', 'Open weekend emergency pool for society cluster']) },
    { name: `${pick(['Sinnar', 'Katol', 'Kalyan', 'Ichalkaranji', 'Paithan', 'Pandharpur', 'Chandur'])}`, coordinator: `${pick(FIRST)} ${pick(LAST)}`, cooperatives: ri(2, 4), workers: Math.round(base * 0.55), availableWorkers: Math.round(base * 0.3), emergencyCapacity: ri(4, 8), jobsToday: Math.round(base * 1.2), utilizationPct: 52 + ri(0, 14), demand: { electrician: pick(['LOW', 'MEDIUM']), plumber: pick(['LOW', 'MEDIUM']), cleaning: pick(['LOW', 'MEDIUM']), carpenter: 'LOW' }, zones: [{ zone: 'Zone 1 — Town', demand: { plumber: 'MEDIUM', electrician: 'LOW' } }], skillGap: [{ skill: 'plumber', have: Math.round(base * 0.2), need: Math.round(base * 0.35) }], recommendation: 'Cross-transfer surplus from City taluka on weekends' },
  ]
}

const COOPS: Array<{ name: string; sector: string; societyType: string; featured?: boolean; workerCount: number }> = [
  { name: 'Pune Electrical Labour Cooperative Society', sector: 'electrician', societyType: 'Primary Labour Cooperative Society', featured: true, workerCount: 248 },
  { name: 'Haveli Plumbing & Sanitation Cooperative', sector: 'plumber', societyType: 'Primary Labour Cooperative Society', workerCount: 190 },
  { name: 'Shram Shakti Domestic Workers Cooperative', sector: 'cleaning', societyType: 'Primary Labour Cooperative Society', workerCount: 164 },
  { name: 'Pune Master Carpenters Cooperative', sector: 'carpenter', societyType: 'Primary Labour Cooperative Society', workerCount: 138 },
  { name: 'Swayamsiddhi Care & Support Cooperative', sector: 'caregiver', societyType: 'Primary Labour Cooperative Society', workerCount: 96 },
  { name: 'Haveli Appliance Service & Repair Cooperative', sector: 'appliance', societyType: 'Primary Labour Cooperative Society', workerCount: 74 },
  // spec §6 / §56: the service catalogue must be fully staffed, otherwise
  // Skill Gap Intelligence reports "1393 expected / 0 certified" for a trade
  // that has no society at all — which reads as a broken model, not a real gap.
  { name: 'Haveli Rang & Coating Shramik Sahakari Sanstha', sector: 'painter', societyType: 'Primary Labour Cooperative Society', workerCount: 88 },
  { name: 'Haveli Bagvan & Mali Shramik Sahakari Sanstha', sector: 'gardener', societyType: 'Primary Labour Cooperative Society', workerCount: 54 },
  { name: 'Pune Driver Shramik Sahakari Sanstha', sector: 'driver', societyType: 'Primary Labour Cooperative Society', workerCount: 46 },
  { name: 'Haveli Installed Equipment Technician Cooperative', sector: 'technician', societyType: 'Primary Labour Cooperative Society', workerCount: 62 },
]

const SECTOR_COOP_SUFFIX: Record<string, string> = {
  electrician: 'Vidyut', plumber: 'Pani-Puravanch', carpenter: 'Sutar', caregiver: 'Nirdhula',
  cleaning: 'Swachhata', painter: 'Rang', gardener: 'Bagvan', driver: 'Driver', technician: 'Technician',
  appliance: 'Appliance',
}

const WORKER_COUNTS: Record<string, number> = {
  electrician: 26, plumber: 12, cleaning: 10, carpenter: 9, caregiver: 8, appliance: 7,
  painter: 9, gardener: 6, driver: 5, technician: 7,
}

function workerFor(coop: { name: string; sector: string }, i: number, isRajesh: boolean, localAreas: string[]) {
  const name = isRajesh ? 'Rajesh Kumar' : `${FIRST[(i * 7 + 3) % FIRST.length]} ${LAST[(i * 5 + 1) % LAST.length]}`
  const skills = SKILL_BANK[coop.sector] ?? SKILL_BANK.other
  const certExpiryPool = ['2027-08-02', '2027-11-19', '2027-01-27', '2027-05-30', '2027-03-14', '2028-01-15']
  const status = isRajesh ? 'AVAILABLE' : pick(['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'BUSY', 'OFFLINE'])
  const areas = [pick(localAreas), pick(localAreas), pick(localAreas)].filter((v, idx, a) => a.indexOf(v) === idx)
  return {
    name, phone: `+91 9${ri(100000000, 999999999)}`,
    primarySkill: coop.sector,
    secondarySkills: j(coop.sector === 'electrician' && isRajesh ? ['appliance'] : [pick(Object.keys(SKILL_BANK))]),
    experienceYears: isRajesh ? 8 : ri(2, 18),
    certName: isRajesh ? 'ITI Electrician (NCVT) — Wireman License' : `${coop.sector === 'other' ? 'Multi-skill' : coop.sector} Trade Certification (RPL/NSQF Level ${ri(3, 4)})`,
    certStatus: isRajesh ? 'VERIFIED' : pick(['VERIFIED', 'VERIFIED', 'VERIFIED', 'VERIFIED', 'EXPIRING', 'PENDING']),
    certExpiry: certExpiryPool[ri(0, certExpiryPool.length - 1)],
    languages: j(['Marathi', 'Hindi', 'English'].slice(0, ri(2, 3))),
    serviceAreas: j(areas),
    baseArea: areas[0],
    completedJobs: isRajesh ? 347 : ri(38, 420),
    rating: isRajesh ? 4.72 : Math.round((3.9 + rnd() * 1.05) * 100) / 100,
    completionRate: Math.round((88 + rnd() * 11) * 10) / 10,
    safetyValid: rnd() > 0.06,
    availability: status,
    emergencyPool: isRajesh ? true : rnd() > 0.72,
    activeJobsToday: status === 'BUSY' ? ri(1, 2) : 0,
    earningsMonthRs: ri(14000, 34000),
    welfareBalanceRs: ri(800, 6400),
    trainingsDone: ri(1, 6),
    skillsJson: j(skills.slice(0, ri(3, skills.length))),
    bioEn: isRajesh
      ? 'Senior electrician at Pune Electrical Labour Cooperative. Specialist in domestic wiring, fan and MCB installation, and switchboard repair. Emergency pool member.'
      : `Verified ${coop.sector} worker of ${coop.name}.`,
  }
}

/** Fail fast if a cooperative sector has no matching ServiceCategory row. */
async function assertSectorsMatchCategories() {
  const keys = new Set((await db.serviceCategory.findMany({ select: { key: true } })).map((c) => c.key))
  for (const c of COOPS) {
    if (!keys.has(c.sector)) {
      throw new Error(`Seed error: cooperative sector "${c.sector}" (${c.name}) has no ServiceCategory row`)
    }
  }
}

async function main() {
  console.log('Resetting tables…')
  // Delete order must respect FK constraints. Every table that references
  // Customer / Worker / Cooperative must be cleared before its parent, or
  // Prisma raises P2003 (Foreign key constraint violated) and the seed dies.
  // This block MUST stay idempotent — the README documents re-running it.
  await db.notification.deleteMany()
  await db.trainingEnrollment.deleteMany()
  await db.trainingCourse.deleteMany()
  await db.complaint.deleteMany()
  await db.welfareLedger.deleteMany()
  await db.exchangeRecommendation.deleteMany()
  await db.trustReport.deleteMany() // -> Worker
  await db.institutionRequest.deleteMany() // -> Customer
  await db.amcContract.deleteMany() // -> Customer, Cooperative
  await db.savedPlace.deleteMany() // -> Customer (cascade, cleared explicitly for clarity)
  await db.booking.deleteMany()
  await db.customer.deleteMany()
  await db.worker.deleteMany()
  await db.govRegistration.deleteMany() // -> Cooperative
  await db.cooperative.deleteMany()
  await db.taluka.deleteMany() // -> District
  await db.district.deleteMany() // -> Federation
  await db.federation.deleteMany()
  await db.hierarchyLevelConfig.deleteMany()
  await db.integrationRegistry.deleteMany()
  await db.serviceCategory.deleteMany()
  await db.auditLog.deleteMany()
  await db.matchWeightConfig.deleteMany()
  await db.feeConfig.deleteMany()
  await db.economicsConfig.deleteMany()
  await db.$executeRawUnsafe("DELETE FROM sqlite_sequence WHERE name IN ('Booking','Worker','Customer','Cooperative','Taluka','District','Federation','Notification','Complaint','WelfareLedger','ExchangeRecommendation','TrainingCourse','TrainingEnrollment','GovRegistration','HierarchyLevelConfig','IntegrationRegistry','SavedPlace','AmcContract','InstitutionRequest','TrustReport')").catch(() => {})

  console.log('Taxonomy…')
  for (const c of CATEGORIES) await db.serviceCategory.create({ data: { ...c } })
  for (const h of HIERARCHY) await db.hierarchyLevelConfig.create({ data: { ...h } })
  for (const it of INTEGRATIONS) await db.integrationRegistry.create({ data: { ...it } })
  await assertSectorsMatchCategories()

  console.log('Courses…')
  const courses = [
    { id: 'seed-solar', title: 'Solar Rooftop Installation & Safety', categoryKey: 'electrician', provider: 'Skill Federation Partner ITI', durationHrs: 40, mode: 'FIELD', certification: 'NSQF Level 4 Solar QP', seats: 30 },
    { title: 'Advanced Plumbing & Water-Efficient Fittings', categoryKey: 'plumber', provider: 'Maharashtra Skill Development Society', durationHrs: 36, mode: 'HYBRID', certification: 'NSQF Level 4 Plumbing QP', seats: 40 },
    { title: 'Appliance Repair — Refrigeration Basics', categoryKey: 'appliance', provider: 'Partner OEM Academy', durationHrs: 48, mode: 'FIELD', certification: 'OEM Service Certificate', seats: 25 },
    { title: 'Elderly Care & Patient Mobility (QP)', categoryKey: 'caregiver', provider: 'State Health Mission Partner', durationHrs: 60, mode: 'HYBRID', certification: 'Caregiver NSQF Level 3', seats: 35 },
    { title: 'Electrical Safety Refresh & Earthing Practice', categoryKey: 'electrician', provider: 'Cooperative Training Cell', durationHrs: 8, mode: 'ONLINE', certification: 'Coop Safety Badge (annual)', seats: 100 },
    { title: 'Deep Cleaning & Institutional Hygiene', categoryKey: 'cleaning', provider: 'Swachhata Mission Partner', durationHrs: 24, mode: 'FIELD', certification: 'Institutional Hygiene Certificate', seats: 50 },
    { title: 'Customer Communication & Digital App Literacy', categoryKey: 'other', provider: 'GigSetu Academy', durationHrs: 6, mode: 'ONLINE', certification: 'Digital Readiness Badge', seats: 200 },
    { title: 'AC Service & Energy Efficiency', categoryKey: 'appliance', provider: 'Partner OEM Academy', durationHrs: 40, mode: 'FIELD', certification: 'OEM AC Service Certificate', seats: 30 },
  ]
  for (const c of courses) await db.trainingCourse.create({ data: { ...c } })

  console.log('Federation + districts…')
  const mh = await db.federation.create({
    data: {
      type: 'STATE', name: 'Maharashtra Rajya Shramik Sahakari Mahasangh', region: 'Maharashtra', chairperson: 'Adv. Rohit Deshmukh', regNo: 'MH/SLCF/1998/0221',
      districts: DISTRICTS.length, cooperatives: DISTRICTS.reduce((s, d) => s + d.cooperatives, 0), workers: DISTRICTS.reduce((s, d) => s + d.workers, 0),
      activeWorkersPct: 74.6, jobsToday: DISTRICTS.reduce((s, d) => s + d.jobsToday, 0), revenueMonthLakh: 842.6, welfareCoveragePct: 68.3,
      demandJson: j({ plumber: 'HIGH', electrician: 'HIGH', appliance: 'HIGH', cleaning: 'MEDIUM', carpenter: 'MEDIUM', caregiver: 'MEDIUM' }),
      skillGapJson: j([
        { skill: 'Plumbing', gap: 412, action: 'Fast-track RPL + toolkit finance' }, { skill: 'Appliance Repair', gap: 288, action: 'Partner ITI batch in Pune, Nagpur' },
        { skill: 'Caregiving', gap: 214, action: 'Elderly-care QP training push' }, { skill: 'Certified Electricians', gap: 156, action: 'Wireman license camps' },
      ]),
    },
  })
  await db.federation.create({
    data: {
      type: 'NATIONAL', name: 'Bharatiya Shramik Sahakari Apex Network', region: 'India', chairperson: 'Dr. V. R. Iyer', regNo: 'NAT/ACN/2011/0087',
      districts: 94, cooperatives: 607, workers: 41250, activeWorkersPct: 71.9, jobsToday: 88450, revenueMonthLakh: 3120.5, welfareCoveragePct: 61.4,
      demandJson: j({ plumber: 'HIGH', electrician: 'HIGH', cleaning: 'HIGH', appliance: 'MEDIUM', carpenter: 'MEDIUM', caregiver: 'MEDIUM' }),
      skillGapJson: j([{ skill: 'Plumbing', gap: 1900, action: 'National toolkit finance + RPL' }]),
      nationalJson: j({
        states: [
          { state: 'Maharashtra', federations: 3, districts: 8, cooperatives: 184, workers: 23097, intensity: 1 },
          { state: 'Karnataka', federations: 2, districts: 6, cooperatives: 121, workers: 14800, intensity: 0.85 },
          { state: 'Gujarat', federations: 2, districts: 5, cooperatives: 96, workers: 9600, intensity: 0.7 },
          { state: 'Tamil Nadu', federations: 2, districts: 5, cooperatives: 88, workers: 8900, intensity: 0.68 },
          { state: 'Uttar Pradesh', federations: 1, districts: 4, cooperatives: 61, workers: 7100, intensity: 0.55 },
          { state: 'Telangana', federations: 1, districts: 3, cooperatives: 44, workers: 4200, intensity: 0.42 },
          { state: 'Madhya Pradesh', federations: 1, districts: 3, cooperatives: 39, workers: 3800, intensity: 0.38 },
          { state: 'Kerala', federations: 1, districts: 2, cooperatives: 33, workers: 3100, intensity: 0.33 },
        ],
        contracts: { institutionalAMC: 118, govtInstitutions: 47, monthlyValueCr: 4.6 },
        note: 'Prototype synthetic data — no official government statistics are represented',
      }),
    },
  })

  const districtRows: Record<string, string> = {}
  for (const d of DISTRICTS) {
    const row = await db.district.create({
      data: {
        federationId: mh.id, name: d.name, coordinator: d.coordinator, zoneCount: ri(4, 6), cooperatives: d.cooperatives, workers: d.workers,
        activeWorkers: d.activeWorkers, jobsToday: d.jobsToday, utilizationPct: d.utilizationPct,
        demandJson: j(d.demand), recommendationsJson: j(d.recs), mapPos: j(d.map),
        comparisonJson: j(d.name === 'Pune' ? [
          { coop: 'Haveli Plumbing & Sanitation Cooperative', skill: 'plumber', available: 20, expectedJobs: 8 },
          { coop: 'Pune Electrical Labour Cooperative Society', skill: 'electrician', available: 25, expectedJobs: 40 },
          { coop: 'Pune Master Carpenters Cooperative', skill: 'carpenter', available: 18, expectedJobs: 6 },
          { coop: 'Shram Shakti Domestic Workers Cooperative', skill: 'cleaning', available: 22, expectedJobs: 19 },
          { coop: 'Swayamsiddhi Care & Support Cooperative', skill: 'caregiver', available: 9, expectedJobs: 12 },
        ] : [
          { coop: `${d.name} City Labour Cooperative`, skill: pick(['plumber', 'electrician', 'cleaning']), available: ri(8, 24), expectedJobs: ri(4, 20) },
          { coop: `${d.name} Granchin Shramik Sangh`, skill: pick(['carpenter', 'appliance', 'caregiver']), available: ri(6, 18), expectedJobs: ri(2, 10) },
        ]),
      },
    })
    districtRows[d.name] = row.id
    const tDefs = TALUKAS[d.name] ?? defaultTalukas(d.name, Math.round(d.workers / 2.6))
    for (const t of tDefs) {
      const taluka = await db.taluka.create({
        data: {
          districtId: row.id, name: t.name, coordinator: t.coordinator, cooperatives: t.cooperatives, workers: t.workers,
          availableWorkers: t.availableWorkers, emergencyCapacity: t.emergencyCapacity, jobsToday: t.jobsToday, utilizationPct: t.utilizationPct,
          demandJson: j(t.demand), zonesJson: j(t.zones), skillGapJson: j(t.skillGap), recommendation: t.recommendation,
        },
      })
      const coopDefs = d.name === 'Pune' && t.name === 'Haveli' ? COOPS : COOPS.slice(0, Math.max(2, t.cooperatives - ri(0, 2))).map((c) => ({ ...c, name: `${t.name} ${SECTOR_COOP_SUFFIX[c.sector] ?? 'Shramik'} Shramik Sahakari Sanstha`, featured: false, workerCount: ri(60, 180) }))
      for (const c of coopDefs) {
        const coop = await db.cooperative.create({
          data: {
            talukaId: taluka.id, name: c.name, regNo: `MH/${d.name.slice(0, 2).toUpperCase()}/T-${taluka.name.slice(0, 2).toUpperCase()}/S${ri(1000, 9999)}`,
            societyType: c.societyType, sector: c.sector,
            repName: c.featured ? 'Sunita Patil' : `${pick(FIRST)} ${pick(LAST)}`, repRole: 'Secretary',
            memberCount: c.workerCount + ri(10, 40), workerCount: c.workerCount, activeToday: Math.round(c.workerCount * 0.7), jobsToday: c.featured ? 421 : Math.round(c.workerCount * 1.7),
            utilizationPct: c.featured ? 76 : 55 + ri(0, 20), welfareFundRs: c.featured ? 184500 : ri(40000, 160000), emergencyPoolSize: c.featured ? 18 : ri(4, 10),
            earningsMonthRs: c.featured ? 2340000 : ri(400000, 1400000), featured: !!c.featured,
            pricingPolicyJson: j({
              visitBaseByCategory: 'Federation rate card 2025-26',
              urgencyMultiplier: { NORMAL: 1.0, URGENT: 1.2, EMERGENCY: 1.5 },
              eveningSurchargePct: 10, negotiationFloorPct: 92, maxQuoteUpliftPct: 17, travelRatePerKmRs: 12,
              welfareContributionPct: 2, coopCommissionPct: 8, platformFeePct: 4,
            }),
          },
        })
        if (c.featured) {
          await db.govRegistration.create({
            data: {
              cooperativeId: coop.id, registrationNumber: 'MH/PNV/HAV/ELC/1987/0458', registeredOn: '1987-06-21',
              registeringAuthority: 'Office of the Deputy Registrar of Cooperative Societies, Pune', state: 'Maharashtra', district: 'Pune', taluka: 'Haveli',
              societyType: c.societyType, authorizedRepresentative: 'Sunita Patil (Secretary)', memberCount: coop.memberCount, workerCount: 248,
              serviceCategories: j(['electrician', 'appliance', 'technician']), operationalStatus: 'OPERATIONAL', verificationStatus: 'VERIFIED (Prototype mock record)',
            },
          })
        }
        const n = c.featured ? (WORKER_COUNTS[c.sector] ?? 20) : 4
        const localAreas = d.name === 'Pune' && t.name === 'Haveli' ? AREA_LIST : [`${t.name} Town`, `${t.name} Market`, `${t.name} Rural`, `${t.name} Outskirts`, `${d.name} Road`]
        for (let i = 0; i < n; i++) {
          const isRajesh = !!c.featured && i === 0
          const isHaveli = d.name === 'Pune' && t.name === 'Haveli'
          const w0 = workerFor(c, i, isRajesh, localAreas)
          // Demo-critical: Rajesh serves Kothrud (Anita's area) and is the strongest candidate;
          // 3 more electricians also cover Kothrud so matching shows real alternatives.
          if (isRajesh) Object.assign(w0, { serviceAreas: j(['Kothrud', 'Karve Nagar', 'Erandwane', 'Bavdhan', 'Shivajinagar']), baseArea: 'Karve Nagar', completionRate: 97.2 })
          if (!isRajesh && isHaveli && c.sector === 'electrician' && i >= 1 && i <= 3) Object.assign(w0, { serviceAreas: j(['Kothrud', pick(AREA_LIST), pick(AREA_LIST)]), availability: 'AVAILABLE', certStatus: 'VERIFIED', rating: Math.round((3.9 + rnd() * 0.4) * 100) / 100 })
          // reliable demo coverage: every 3rd Haveli worker also covers Kothrud & Karve Nagar
          if (!isRajesh && isHaveli && i % 3 === 0) Object.assign(w0, { serviceAreas: j(['Kothrud', 'Karve Nagar', pick(AREA_LIST)]), availability: w0.availability === 'OFFLINE' ? 'AVAILABLE' : w0.availability })
          // Demo-critical (plumbing): the spec §51/§87 story is a Kothrud emergency
          // pipe burst. Guarantee several NEARBY, AVAILABLE, CERTIFIED plumbers in
          // the Kothrud/Karve Nagar belt so the signature demo never falls back to
          // a 30 km mutual-aid deputation when Rajesh happens to be busy.
          if (!isRajesh && isHaveli && c.sector === 'plumber') {
            const belt = ['Kothrud', 'Karve Nagar', 'Warje', 'Erandwane', 'Bavdhan', 'Paud Road']
            Object.assign(w0, {
              baseArea: belt[i % belt.length],
              serviceAreas: j([belt[i % belt.length], 'Kothrud', 'Karve Nagar', belt[(i + 2) % belt.length]]),
              availability: i <= 4 ? 'AVAILABLE' : w0.availability === 'OFFLINE' ? 'AVAILABLE' : w0.availability,
              certStatus: i <= 4 ? 'VERIFIED' : w0.certStatus,
              rating: Math.round((4.1 + rnd() * 0.6) * 100) / 100,
            })
          }
          if (!isRajesh && isHaveli && c.sector === 'electrician' && i === 0) {
            Object.assign(w0, { baseArea: 'Kothrud', serviceAreas: j(['Kothrud', 'Karve Nagar', 'Warje', 'Bavdhan']), availability: 'AVAILABLE', certStatus: 'VERIFIED' })
          }
          // spec: exactly 3 certifications expiring within 45 days (attention item)
          if (!isRajesh && isHaveli && (i === 2 || i === 5 || i === 8)) Object.assign(w0, { certExpiry: '2026-10-18', certStatus: 'EXPIRING' })
          const w = await db.worker.create({ data: { ...w0, cooperativeId: coop.id } })
          if (isRajesh) {
            for (const [m, amt] of [['2026-02-05', 520], ['2026-02-12', 520], ['2026-02-19', 520], ['2026-02-26', 520], ['2026-03-05', 520]] as const) {
              await db.welfareLedger.create({ data: { workerId: w.id, type: 'CONTRIBUTION', amount: amt, note: 'Weekly welfare contribution (matched by cooperative)', createdAt: new Date(m) } })
            }
            await db.welfareLedger.create({ data: { workerId: w.id, type: 'BENEFIT', amount: 2500, note: 'Daughter\u2019s education support — welfare wallet claim approved', createdAt: new Date('2026-02-22') } })
            await db.trainingEnrollment.create({ data: { workerId: w.id, courseId: 'seed-solar', progress: 60, status: 'IN_PROGRESS' } })
          }
        }
      }
    }
  }

  console.log('Customers + bookings…')
  const anita = await db.customer.create({ data: { name: 'Anita Deshmukh', phone: '+91 98220 41187', type: 'HOUSEHOLD', address: 'B-402, Shreeji Residency, Lane 5', area: 'Kothrud', city: 'Pune', lang: 'en' } })
  const society = await db.customer.create({ data: { name: 'Sunrose Apartments Society', phone: '+91 98230 77215', type: 'SOCIETY', address: 'Sunrose Apartments, FC Road', area: 'Shivajinagar', city: 'Pune', lang: 'en' } })
  const hostel = await db.customer.create({ data: { name: 'St. Mary\u2019s Boys Hostel', phone: '+91 90210 55342', type: 'HOSTEL', address: 'Hostel Block C, College Road', area: 'Deccan', city: 'Pune', lang: 'en' } })
  const firm = await db.customer.create({ data: { name: 'Nirmiti Constructions LLP', phone: '+91 99700 21419', type: 'BUSINESS', address: 'Site Office, Wakad', area: 'Wakad', city: 'Pune', lang: 'en' } })

  // Saved places (customer address book) — demo-critical for the one-tap booking flow
  await db.savedPlace.createMany({
    data: [
      { customerId: anita.id, label: 'Home', area: 'Kothrud', address: 'B-402, Shreeji Residency, Lane 5, near Kothrud depot', isDefault: true },
      { customerId: anita.id, label: "Aai's home", area: 'Sinhagad Road', address: 'Flat 12, Snehadaan CHS, above Lakme salon' },
      { customerId: anita.id, label: 'Office', area: 'Hinjewadi', address: 'IT Service Desk, Phase 2, Trios building' },
      { customerId: society.id, label: 'Society office', area: 'Shivajinagar', address: 'Sunrose Apartments, FC Road — office near gate 2', isDefault: true },
      { customerId: hostel.id, label: 'Hostel block C', area: 'Deccan', address: 'Hostel Block C, College Road — warden office', isDefault: true },
      { customerId: firm.id, label: 'Site office', area: 'Wakad', address: 'Site Office, Wakad — security desk', isDefault: true },
    ],
  })

  const featuredCoop = await db.cooperative.findFirst({ where: { featured: true }, include: { workers: true } })
  const workers = featuredCoop!.workers
  const elec = workers.filter((w) => w.primarySkill === 'electrician')
  const plumb = workers.filter((w) => w.primarySkill === 'plumber')
  const histDefs: Array<{ cust: string; cat: string; title: string; daysAgo: number; status: string; workerIdx?: number; rating?: number }> = [
    { cust: society.id, cat: 'cleaning', title: 'Deep cleaning — common areas & lobby', daysAgo: 26, status: 'REVIEWED', rating: 5 },
    { cust: anita.id, cat: 'electrician', title: 'Fan speed regulator replacement', daysAgo: 21, status: 'REVIEWED', workerIdx: 1, rating: 5 },
    { cust: anita.id, cat: 'plumber', title: 'Kitchen sink choke cleared', daysAgo: 17, status: 'REVIEWED', rating: 4 },
    { cust: hostel.id, cat: 'electrician', title: 'Corridor tube-light batch replacement', daysAgo: 14, status: 'REVIEWED', workerIdx: 2, rating: 5 },
    { cust: firm.id, cat: 'carpenter', title: 'Site office door realignment', daysAgo: 11, status: 'REVIEWED', rating: 4 },
    { cust: anita.id, cat: 'electrician', title: 'MCB tripping diagnosis', daysAgo: 8, status: 'REVIEWED', workerIdx: 0, rating: 5 },
    { cust: society.id, cat: 'plumber', title: 'Overhead tank valve replacement', daysAgo: 5, status: 'REVIEWED', rating: 5 },
    { cust: anita.id, cat: 'appliance', title: 'Geyser heating element check', daysAgo: 3, status: 'PAID', rating: 4 },
    { cust: hostel.id, cat: 'cleaning', title: 'Monthly hostel room cleaning cycle', daysAgo: 1, status: 'COMPLETED' },
    { cust: anita.id, cat: 'electrician', title: 'Bathroom exhaust fan installation', daysAgo: 0, status: 'ACCEPTED', workerIdx: 0 },
  ]
  for (const h of histDefs) {
    const worker = h.workerIdx !== undefined ? elec[h.workerIdx % elec.length] : pick(workers.filter((w) => w.primarySkill === h.cat)) ?? workers[0]
    const cat = CATEGORIES.find((c) => c.key === h.cat)!
    const price = Math.round(cat.baseRate * (1 + rnd() * 0.6) / 10) * 10
    const created = new Date(Date.now() - h.daysAgo * 86400000)
    const timeline: Array<{ status: string; at: string; note?: string }> = [
      { status: 'REQUESTED', at: created.toISOString() },
      { status: 'ACCEPTED', at: new Date(created.getTime() + 600000).toISOString(), note: 'Worker accepted via cooperative network' },
      { status: 'ON_THE_WAY', at: new Date(created.getTime() + 1500000).toISOString() },
      { status: 'IN_PROGRESS', at: new Date(created.getTime() + 3900000).toISOString() },
      { status: 'COMPLETED', at: new Date(created.getTime() + 7200000).toISOString() },
    ]
    if (h.status === 'PAID' || h.status === 'REVIEWED') timeline.push({ status: 'PAID', at: new Date(created.getTime() + 7500000).toISOString() })
    if (h.status === 'REVIEWED') timeline.push({ status: 'REVIEWED', at: new Date(created.getTime() + 9000000).toISOString() })
    await db.booking.create({
      data: {
        refCode: `GS-${created.getFullYear()}${String(created.getMonth() + 1).padStart(2, '0')}-${ri(1000, 9999)}`,
        customerId: h.cust, categoryKey: h.cat, title: h.title, description: h.title, area: pick(AREA_LIST), address: 'Service address on file',
        scheduledAt: created, urgency: 'NORMAL', mode: 'INSTANT', status: h.status,
        analysisJson: j({ source: 'heuristic', estimatedMinutes: cat.avgDurationMin, difficulty: 'moderate' }),
        cooperativeId: worker.cooperativeId, workerId: worker.id, finalPrice: price,
        paymentJson: h.status === 'PAID' || h.status === 'REVIEWED' ? j({ method: 'UPI (Prototype)', amount: price, workerShare: Math.round(price * 0.86), coopCommission: Math.round(price * 0.08), welfare: Math.round(price * 0.02), platformFee: Math.round(price * 0.04), paidAt: new Date(created.getTime() + 7500000).toISOString() }) : undefined,
        rating: h.rating, review: h.rating === 5 ? 'Prompt, polite and neat work. Verified ID gave confidence.' : h.rating ? 'Good work, slightly late arrival.' : undefined,
        timelineJson: j(timeline), createdAt: created,
      },
    })
  }

  console.log('Complaints / exchange / notifications…')
  const coopId = featuredCoop!.id
  await db.complaint.create({ data: { cooperativeId: coopId, workerId: workers[5].id, customerName: 'R. Kulkarni (Society)', subject: 'Repeated rescheduling by worker', detail: 'Worker rescheduled twice without prior notice for panel work.', severity: 'SERIOUS', status: 'OPEN' } })
  await db.complaint.create({ data: { cooperativeId: coopId, workerId: workers[7].id, customerName: 'M. Shaikh', subject: 'Charge quoted above rate card', detail: 'Customer charged 30% above federation rate card for switch repair.', severity: 'SERIOUS', status: 'RESOLVING' } })
  await db.complaint.create({ data: { cooperativeId: coopId, customerName: 'P. Joshi', subject: 'Late arrival without call', detail: 'Worker arrived 50 minutes late.', severity: 'MEDIUM', status: 'RESOLVED' } })
  await db.complaint.create({ data: { cooperativeId: coopId, customerName: 'A. Bose', subject: 'Debris not cleared after work', detail: 'Minor cleanup pending after drilling.', severity: 'LOW', status: 'RESOLVED' } })

  const haveliPlumbCoop = (await db.cooperative.findFirst({ where: { name: { contains: 'Plumbing' } } }))!
  const haveliCarpCoop = (await db.cooperative.findFirst({ where: { name: { contains: 'Carpenters' } } }))!
  await db.exchangeRecommendation.create({ data: { skill: 'electrician', fromCoopId: haveliCarpCoop.id, fromCoopName: 'Pune Master Carpenters Cooperative', toCoopId: coopId, toCoopName: 'Pune Electrical Labour Cooperative Society', districtName: 'Pune', workerCount: 6, distanceKm: 7.5, expectedDemand: 15, durationDays: 21, rationale: 'Carpenters have 12 surplus this week; Pune Electrical expects 40 jobs vs 25 available electricians. Cross-skill certified volunteers identified via Skill Passport.', status: 'PENDING' } })
  await db.exchangeRecommendation.create({ data: { skill: 'plumber', fromCoopId: haveliPlumbCoop.id, fromCoopName: haveliPlumbCoop.name, toCoopId: coopId, toCoopName: 'Pune Electrical Labour Cooperative Society', districtName: 'Pune', workerCount: 4, distanceKm: 5.2, expectedDemand: 12, durationDays: 14, rationale: 'Monsoon leak-season surge. Plumbing coop has evening surplus; transfer covers Zone 3 emergency window.', status: 'PENDING' } })
  await db.exchangeRecommendation.create({ data: { skill: 'cleaning', fromCoopId: coopId, fromCoopName: 'Pune Electrical Labour Cooperative Society', toCoopId: haveliPlumbCoop.id, toCoopName: 'Society AMC cluster (Haveli)', districtName: 'Pune', workerCount: 3, distanceKm: 4.1, expectedDemand: 9, durationDays: 7, rationale: 'AMC cluster needs pre-Diwali cleaning support; electrical coop has 6 idle apprentices with dual certification.', status: 'PENDING' } })
  await db.exchangeRecommendation.create({ data: { skill: 'caregiver', fromCoopId: haveliCarpCoop.id, fromCoopName: 'Swayamsiddhi Care & Support Cooperative', toCoopId: haveliPlumbCoop.id, toCoopName: 'Haveli Plumbing & Sanitation Cooperative', districtName: 'Pune', workerCount: 2, distanceKm: 9.8, expectedDemand: 5, durationDays: 30, rationale: 'Hospital-cluster AMC pilot. Care coop operates below capacity on weekdays.', status: 'PENDING' } })
  await db.exchangeRecommendation.create({ data: { skill: 'electrician', fromCoopId: haveliPlumbCoop.id, fromCoopName: 'Maval Vidyut Shramik Sangh', toCoopId: coopId, toCoopName: 'Pune Electrical Labour Cooperative Society', districtName: 'Pune', workerCount: 5, distanceKm: 32.4, expectedDemand: 10, durationDays: 10, rationale: 'Festival-season demand spike in Pune city; approved model from last year reused.', status: 'APPROVED', approvedBy: 'District Coordinator — Meera Kulkarni', decidedAt: new Date(Date.now() - 2 * 86400000) } })

  await db.notification.create({ data: { audience: 'COOP', audienceId: coopId, title: '3 certifications expiring in 30 days', body: 'Renewal reminders sent to workers. Follow up in Certifications tab.', type: 'WARNING' } })
  await db.notification.create({ data: { audience: 'COOP', audienceId: coopId, title: '2 serious complaints need review', body: 'Complaints committee scheduled for Friday.', type: 'WARNING' } })
  await db.notification.create({ data: { audience: 'WORKER', audienceId: workers[0].id, title: 'Emergency pool roster updated', body: 'You are on emergency standby this week. +2% bonus per emergency job.', type: 'INFO' } })
  await db.notification.create({ data: { audience: 'STATE', audienceId: mh.id, title: 'Skill gap report published', body: 'Plumbing gap widest across 6 districts. Training push recommended.', type: 'INFO' } })

  console.log('Seed complete ✔')
  console.log(JSON.stringify({ federation: mh.id, featuredCoop: coopId, workers: workers.length, rajesh: workers[0].id }, null, 2))

  // ---- Demo-story seed (spec §51): the plumber Rajesh Kumar the WhatsApp demo
  // story dispatches to, plus the governance trail the demo needs on screen. ----
  console.log('Demo story…')
  const storyWorker = await db.worker.create({
    data: {
      name: 'Rajesh Kumar',
      phone: `+91 9${ri(100000000, 999999999)}`,
      cooperativeId: haveliPlumbCoop.id,
      primarySkill: 'plumber',
      secondarySkills: j(['appliance']),
      experienceYears: 11,
      certName: 'ITI Plumber (NCVT) — Plumbing Trade License',
      certStatus: 'VERIFIED',
      certExpiry: '2028-04-18',
      languages: j(['Marathi', 'Hindi', 'English']),
      serviceAreas: j(['Kothrud', 'Karve Nagar', 'Erandwane', 'Warje', 'Bavdhan']),
      baseArea: 'Karve Nagar',
      completedJobs: 412,
      rating: 4.81,
      completionRate: 98.4,
      safetyValid: true,
      availability: 'AVAILABLE',
      emergencyPool: true,
      activeJobsToday: 0,
      earningsMonthRs: 31200,
      welfareBalanceRs: 4820,
      trainingsDone: 5,
      skillsJson: j(['Pipe replacement', 'Leak detection', 'Motor fitting', 'Sanitary fitting', 'Water tank repair']),
      bioEn: 'Senior plumber at Haveli Plumbing & Sanitation Cooperative. 11 years in domestic and commercial water systems, emergency-pool member.',
    },
  })
  console.log('  + plumber Rajesh Kumar', storyWorker.id)

  const plumbingCourse = await db.trainingCourse.findFirst({ where: { categoryKey: 'plumber' } })
  if (plumbingCourse) {
    const enr = await db.trainingEnrollment.create({
      data: { workerId: storyWorker.id, courseId: plumbingCourse.id, progress: 60, status: 'IN_PROGRESS' },
    })
    await db.welfareLedger.createMany({
      data: [
        { workerId: storyWorker.id, type: 'CONTRIBUTION', amount: 940, note: 'Welfare contributions from settled jobs' },
        { workerId: storyWorker.id, type: 'BENEFIT', amount: -500, note: 'Toolkit finance repayment' },
        { workerId: storyWorker.id, type: 'CONTRIBUTION', amount: 310, note: 'Welfare contributions from settled jobs' },
      ],
    })
    console.log('  + welfare ledger + training enrolment', enr.id)
  }

  // Governance trail the Platform Admin console renders (spec §57).
  await db.auditLog.createMany({
    data: [
      { actor: 'Sunita Patil', actorRole: 'COOP_ADMIN', action: 'PRICING_POLICY_UPDATED', entity: 'Cooperative', entityId: coopId, detail: 'Negotiation floor 92% · quote cap +17% · travel ₹12/km applied' },
      { actor: 'GigSetu Ops', actorRole: 'PLATFORM_ADMIN', action: 'AI_WEIGHTS_UPDATED', entity: 'MatchWeightConfig', entityId: 'default', detail: 'skillMatch 35 · cert 15 · distance 15 · availability 15 · workload 10 · history 10' },
      { actor: 'Meera Kulkarni', actorRole: 'DISTRICT_COORD', action: 'EXCHANGE_APPROVED', entity: 'ExchangeRecommendation', entityId: '-', detail: '5 electricians Maval → Pune Electrical for the festival window' },
      { actor: 'Sunita Patil', actorRole: 'COOP_ADMIN', action: 'WORKER_STATUS_CHANGE', entity: 'Worker', entityId: storyWorker.id, detail: 'Availability → AVAILABLE (emergency pool recall)' },
      { actor: 'System', actorRole: 'SYSTEM', action: 'SESSION_LOGIN', entity: 'Session', entityId: '-', detail: 'Seeded prototype dataset' },
    ],
  })
  console.log('  + 5 audit rows')

  await db.complaint.create({
    data: {
      cooperativeId: haveliPlumbCoop.id,
      workerId: storyWorker.id,
      customerName: 'Sunrise Apartments Society',
      subject: 'Overcharge on emergency call-out',
      detail: 'Society secretary reports ₹1,400 charged for a burst-pipe repair against a ₹700 fair range quote. Escalated: cooperative committee could not reach the worker.',
      severity: 'SERIOUS',
      status: 'ESCALATED',
    },
  })
  console.log('  + 1 ESCALATED complaint')
  console.log('Demo story done.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
