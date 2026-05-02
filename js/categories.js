/**
 * Spend categories with display metadata and keyword-based auto-classification rules.
 * Each keyword list is matched against the lowercase merchant / description field.
 */
const CATEGORIES = [
  {
    id: 'groceries',
    name: 'Groceries',
    icon: '🛒',
    color: '#22c55e',
    keywords: ['bigbasket', 'grofers', 'blinkit', 'zepto', 'dmart', 'reliance fresh',
               'more supermarket', 'spencer', 'grocery', 'supermarket', 'vegetables',
               'fruits', 'kirana', 'nature basket', 'jiomart', 'swiggy instamart']
  },
  {
    id: 'dining',
    name: 'Dining & Food',
    icon: '🍽️',
    color: '#f97316',
    keywords: ['swiggy', 'zomato', 'restaurant', 'cafe', 'pizza', 'dominos',
               'mcdonald', 'kfc', 'burger', 'biryani', 'food', 'dining',
               'starbucks', 'chai', 'bakery', 'dunkin']
  },
  {
    id: 'fuel',
    name: 'Fuel & Transport',
    icon: '⛽',
    color: '#eab308',
    keywords: ['petrol', 'diesel', 'fuel', 'hp petroleum', 'indian oil', 'bharat petroleum',
               'ola', 'uber', 'rapido', 'metro', 'auto', 'cab', 'parking',
               'toll', 'fastag', 'irctc', 'railway', 'bus']
  },
  {
    id: 'utilities',
    name: 'Utilities & Bills',
    icon: '💡',
    color: '#06b6d4',
    keywords: ['electricity', 'water bill', 'gas bill', 'broadband', 'internet',
               'wifi', 'airtel', 'jio', 'vi ', 'bsnl', 'mobile recharge',
               'dth', 'tata sky', 'maintenance', 'society']
  },
  {
    id: 'shopping',
    name: 'Shopping',
    icon: '🛍️',
    color: '#8b5cf6',
    keywords: ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho',
               'snapdeal', 'tatacliq', 'croma', 'reliance digital',
               'decathlon', 'ikea', 'shopping', 'mall', 'fashion']
  },
  {
    id: 'health',
    name: 'Health & Medical',
    icon: '🏥',
    color: '#ef4444',
    keywords: ['pharmacy', 'medical', 'hospital', 'doctor', 'clinic',
               'apollo', 'medplus', 'netmeds', 'pharmeasy', '1mg',
               'diagnostic', 'lab', 'dental', 'eye', 'health']
  },
  {
    id: 'education',
    name: 'Education',
    icon: '📚',
    color: '#3b82f6',
    keywords: ['school', 'college', 'tuition', 'course', 'udemy', 'coursera',
               'book', 'stationery', 'education', 'coaching', 'exam',
               'university', 'library']
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: '🎬',
    color: '#ec4899',
    keywords: ['netflix', 'prime video', 'hotstar', 'disney', 'spotify',
               'youtube', 'movie', 'cinema', 'pvr', 'inox', 'game',
               'playstation', 'xbox', 'concert', 'event', 'ticket']
  },
  {
    id: 'insurance',
    name: 'Insurance & EMI',
    icon: '🛡️',
    color: '#14b8a6',
    keywords: ['insurance', 'lic', 'premium', 'emi', 'loan', 'sip',
               'mutual fund', 'policy', 'term plan', 'health insurance',
               'motor insurance']
  },
  {
    id: 'household',
    name: 'Household',
    icon: '🏠',
    color: '#a855f7',
    keywords: ['rent', 'plumber', 'electrician', 'carpenter', 'cleaning',
               'maid', 'servant', 'repair', 'pest control', 'laundry',
               'dry clean', 'water purifier', 'ac service']
  },
  {
    id: 'personal',
    name: 'Personal Care',
    icon: '💇',
    color: '#f43f5e',
    keywords: ['salon', 'parlour', 'haircut', 'spa', 'grooming',
               'cosmetics', 'skincare', 'perfume', 'urban company']
  },
  {
    id: 'farm',
    name: 'Farm',
    icon: '🌾',
    color: '#65a30d',
    keywords: ['farm', 'agriculture', 'agri', 'seed', 'fertilizer', 'pesticide',
               'tractor', 'harvest', 'crop', 'irrigation', 'cattle', 'livestock',
               'dairy', 'poultry', 'nursery', 'farmland']
  },
  {
    id: 'other',
    name: 'Other',
    icon: '📦',
    color: '#94a3b8',
    keywords: []
  }
];

function classifyTransaction(description) {
  const desc = description.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.id === 'other') continue;
    for (const kw of cat.keywords) {
      if (desc.includes(kw)) return cat.id;
    }
  }
  return 'other';
}

function getCategoryById(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}
