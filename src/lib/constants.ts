import { UserProfile, Customer } from '../types';

export const DEF_FMT =
`🙏 Namaskar {name} ji! 

Aap ek Premium Number use kar rahe hain 🌟 
Vi aapke liye ek Matching Premium Number ZERO Price par laaya hai ✨

📱 Current No: {custNum} 
🎯 Matching No.: {matchNum} 
🎯 2nd Matching No.: {matchNum2} 

------ 

🕉️ *अंक ज्योतिष _(Numerology)_ एवं कुंडली अनुसार विशेष नंबर उपलब्ध हैं* 🔯📿
📈 Lucky Energy, Success & Business Growth ke liye! ✨ 

*Reply now "Yes"* 🤝 
📞 8377919293 
👉 https://wa.me/918377919293?text=Yes`;

// Master Admin system profile (no demo agents)
export const INITIAL_PROFILES: UserProfile[] = [
  {
    id: 'user-admin-master',
    name: 'Administrator',
    email: 'admin@vi-outreach.com',
    role: 'admin',
    status: 'active',
    daily_pull_limit: 1000,
    per_pull_limit: 100,
    created_at: '2026-04-17T09:00:00Z',
    updated_at: '2026-04-17T09:00:00Z',
  },
];

// Clean initial customer database (ready for Admin Excel/CSV uploads)
export const INITIAL_CUSTOMERS: Customer[] = [];
