// frontend/src/modules/payments/PaymentUtils.js

// Helper function to format date from DB to Professional Display (e.g., 12 Nov, 2025)
export const formatDateForDisplay = (dbDate) => {
  if (!dbDate) return '-'; // Return a dash for empty dates instead of 'N/A' for cleaner tables
  try {
    const date = new Date(dbDate);
    // 'en-GB' or 'en-IN' usually gives DD/MM/YYYY or DD Mon YYYY which is cleaner
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return 'Invalid Date';
  }
};

// Helper function to format date for input (YYYY-MM-DD) - No changes needed here
export const formatDateForInput = (dbDate) => {
  if (!dbDate) return '';
  const date = new Date(dbDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function for Status Display and Styling 
// UPDATED: Matches the Emerald/Amber/Slate/Red theme of the new Dashboard
export const getStatusDisplay = (status) => {
    // Normalize input to uppercase just in case
    const key = status ? status.toUpperCase() : 'PENDING';

    const statusMap = {
        'PAID': { 
            text: 'Paid', 
            // Emerald-50 bg, Emerald-700 text
            bgColor: '#ecfdf5',   
            color: '#047857'      
        },     
        'PARTIAL': { 
            text: 'Partial', 
            // Amber-50 bg, Amber-700 text
            bgColor: '#fffbeb',   
            color: '#b45309'      
        }, 
        'PENDING': { 
            text: 'Pending', 
            // Red-50 bg, Red-700 text
            bgColor: '#fef2f2',   
            color: '#b91c1c'      
        },   
    };
    return statusMap[key] || statusMap['PENDING'];
};