export function formatPaise(paise) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100); }

