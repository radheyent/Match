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

export const INITIAL_PROFILES: UserProfile[] = [
  {
    id: 'user-admin-1',
    name: 'Ram Gurgaon (Admin)',
    email: 'admin@vi-outreach.com',
    role: 'admin',
    status: 'active',
    daily_pull_limit: 500,
    per_pull_limit: 50,
    created_at: '2026-04-17T09:00:00Z',
    updated_at: '2026-04-17T09:00:00Z',
  },
  {
    id: 'user-exec-1',
    name: 'Ramesh Kumar',
    email: 'ramesh@vi-outreach.com',
    role: 'user',
    status: 'active',
    daily_pull_limit: 100,
    per_pull_limit: 20,
    created_at: '2026-05-01T10:00:00Z',
    updated_at: '2026-05-01T10:00:00Z',
  },
  {
    id: 'user-exec-2',
    name: 'Priya Sharma',
    email: 'priya@vi-outreach.com',
    role: 'user',
    status: 'active',
    daily_pull_limit: 50,
    per_pull_limit: 10,
    created_at: '2026-05-05T11:00:00Z',
    updated_at: '2026-05-05T11:00:00Z',
  },
  {
    id: 'user-exec-3',
    name: 'Ricky Delhi',
    email: 'ricky@vi-outreach.com',
    role: 'user',
    status: 'active',
    daily_pull_limit: 80,
    per_pull_limit: 15,
    created_at: '2026-05-10T12:00:00Z',
    updated_at: '2026-05-10T12:00:00Z',
  },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-101',
    customer_number: '9811223344',
    customer_name: 'Manish Verma',
    matching_number: '9811223355',
    matching_number_2: '9811223399',
    status: 'AVAILABLE',
    uploaded_at: '2026-10-01T08:00:00Z',
    created_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'cust-102',
    customer_number: '9876543210',
    customer_name: 'Ankit Gupta',
    matching_number: '9876543219',
    matching_number_2: '9876543211',
    status: 'AVAILABLE',
    uploaded_at: '2026-10-01T08:05:00Z',
    created_at: '2026-10-01T08:05:00Z',
  },
  {
    id: 'cust-103',
    customer_number: '8800112233',
    customer_name: 'Suresh Raina',
    matching_number: '8800112244',
    status: 'AVAILABLE',
    uploaded_at: '2026-10-01T08:10:00Z',
    created_at: '2026-10-01T08:10:00Z',
  },
  {
    id: 'cust-104',
    customer_number: '9999888877',
    customer_name: 'Kavita Joshi',
    matching_number: '9999888866',
    matching_number_2: '9999888855',
    status: 'AVAILABLE',
    uploaded_at: '2026-10-01T08:15:00Z',
    created_at: '2026-10-01T08:15:00Z',
  },
  {
    id: 'cust-105',
    customer_number: '7011223344',
    customer_name: 'Deepak Tyagi',
    matching_number: '7011223388',
    status: 'AVAILABLE',
    uploaded_at: '2026-10-01T08:20:00Z',
    created_at: '2026-10-01T08:20:00Z',
  },
  {
    id: 'cust-106',
    customer_number: '9810981098',
    customer_name: 'Rahul Khanna',
    matching_number: '9810981099',
    matching_number_2: '9810981090',
    status: 'AVAILABLE',
    uploaded_at: '2026-10-01T08:25:00Z',
    created_at: '2026-10-01T08:25:00Z',
  },
  {
    id: 'cust-107',
    customer_number: '9711554433',
    customer_name: 'Vikram Malhotra',
    matching_number: '9711554422',
    status: 'AVAILABLE',
    uploaded_at: '2026-10-01T08:30:00Z',
    created_at: '2026-10-01T08:30:00Z',
  },
  {
    id: 'cust-108',
    customer_number: '8527112233',
    customer_name: 'Pooja Aggarwal',
    matching_number: '8527112244',
    matching_number_2: '8527112299',
    status: 'AVAILABLE',
    uploaded_at: '2026-10-01T08:35:00Z',
    created_at: '2026-10-01T08:35:00Z',
  },
  {
    id: 'cust-109',
    customer_number: '9650123456',
    customer_name: 'Sanjay Rawat',
    matching_number: '9650123477',
    status: 'AVAILABLE',
    uploaded_at: '2026-10-01T08:40:00Z',
    created_at: '2026-10-01T08:40:00Z',
  },
  {
    id: 'cust-110',
    customer_number: '9899001122',
    customer_name: 'Tarun Saxena',
    matching_number: '9899001133',
    matching_number_2: '9899001144',
    status: 'AVAILABLE',
    uploaded_at: '2026-10-01T08:45:00Z',
    created_at: '2026-10-01T08:45:00Z',
  },
  {
    id: 'cust-111',
    customer_number: '7838556677',
    customer_name: 'Amitabh Sen',
    matching_number: '7838556688',
    status: 'AVAILABLE',
    uploaded_at: '2026-10-01T08:50:00Z',
    created_at: '2026-10-01T08:50:00Z',
  },
  {
    id: 'cust-112',
    customer_number: '8447123987',
    customer_name: 'Ritu Chawla',
    matching_number: '8447123988',
    matching_number_2: '8447123999',
    status: 'AVAILABLE',
    uploaded_at: '2026-10-01T08:55:00Z',
    created_at: '2026-10-01T08:55:00Z',
  },
];
